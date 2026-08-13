"""Run restartable, content-addressed translation jobs for CD review files.

This command produces candidate output only. It never edits the runtime
vocabulary bundle or falls back to an online translation provider.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Callable

try:
    from .batch_content_utils import (
        atomic_write_json,
        canonical_json,
        peak_rss_bytes,
        read_json,
        sha256_json,
        sha256_text,
        utc_now_iso,
    )
    from .translation_provider import (
        DEFAULT_BATCH_SIZE,
        DEFAULT_COMPUTE_TYPE,
        DEFAULT_DECODE_OPTIONS,
        DEFAULT_INTER_THREADS,
        DEFAULT_INTRA_THREADS,
        DEFAULT_LENGTH_BUCKETS,
        LOCAL_PROVIDER,
        MODEL_DIR,
        BatchTranslationItem,
        LocalBatchTranslator,
        TranslationProviderUnavailable,
        local_model_identity,
    )
except ImportError:
    from batch_content_utils import (
        atomic_write_json,
        canonical_json,
        peak_rss_bytes,
        read_json,
        sha256_json,
        sha256_text,
        utc_now_iso,
    )
    from translation_provider import (
        DEFAULT_BATCH_SIZE,
        DEFAULT_COMPUTE_TYPE,
        DEFAULT_DECODE_OPTIONS,
        DEFAULT_INTER_THREADS,
        DEFAULT_INTRA_THREADS,
        DEFAULT_LENGTH_BUCKETS,
        LOCAL_PROVIDER,
        MODEL_DIR,
        BatchTranslationItem,
        LocalBatchTranslator,
        TranslationProviderUnavailable,
        local_model_identity,
    )


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CACHE_PATH = (
    ROOT / "data" / ".content-batch-cache" / "translations-v1.sqlite3"
)
JOB_SCHEMA_VERSION = 1
CACHE_SCHEMA_VERSION = 1
JOB_KIND = "sense-vocab-content-batch-translation"
TRANSLATION_PIPELINE_VERSION = "strict-local-translation-v1"
ALLOWED_DECODE_OPTIONS = {
    "beam_size": int,
    "num_hypotheses": int,
    "replace_unknowns": bool,
    "max_input_length": int,
    "max_decoding_length": int,
    "length_penalty": (int, float),
    "repetition_penalty": (int, float),
    "no_repeat_ngram_size": int,
}


class JobValidationError(ValueError):
    pass


class TranslationCacheCorruption(RuntimeError):
    pass


def _normalized_language(value: str) -> str:
    return str(value or "").strip().lower().replace("_", "-")


def _supports_local_provider(source: str, target: str) -> bool:
    return _normalized_language(source).startswith("en") and _normalized_language(
        target
    ).startswith("zh")


def _validated_decode_options(value: Any) -> dict[str, Any]:
    if value is None:
        return dict(DEFAULT_DECODE_OPTIONS)
    if not isinstance(value, dict):
        raise JobValidationError("decodeOptions must be an object")
    unknown = sorted(set(value) - set(ALLOWED_DECODE_OPTIONS))
    if unknown:
        raise JobValidationError(
            f"Unsupported decodeOptions: {', '.join(unknown)}"
        )
    result = dict(DEFAULT_DECODE_OPTIONS)
    for name, option in value.items():
        expected_type = ALLOWED_DECODE_OPTIONS[name]
        if not isinstance(option, expected_type) or (
            expected_type is not bool and isinstance(option, bool)
        ):
            raise JobValidationError(f"decodeOptions.{name} has an invalid type")
        result[name] = option
    if result["beam_size"] < 1 or result["num_hypotheses"] != 1:
        raise JobValidationError(
            "decodeOptions requires beam_size >= 1 and num_hypotheses = 1"
        )
    if result["max_input_length"] < 1 or result["max_decoding_length"] < 1:
        raise JobValidationError("decode length limits must be positive")
    return result


def validate_job(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise JobValidationError("Job input must be a JSON object")
    if payload.get("schemaVersion") != JOB_SCHEMA_VERSION:
        raise JobValidationError(
            f"schemaVersion must be {JOB_SCHEMA_VERSION}"
        )
    job_id = str(payload.get("jobId") or "").strip()
    rules_version = str(payload.get("rulesVersion") or "").strip()
    if not job_id:
        raise JobValidationError("jobId is required")
    if not rules_version:
        raise JobValidationError("rulesVersion is required for cache invalidation")
    raw_items = payload.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        raise JobValidationError("items must be a non-empty array")

    item_ids = set()
    items = []
    for index, raw_item in enumerate(raw_items):
        if not isinstance(raw_item, dict):
            raise JobValidationError(f"items[{index}] must be an object")
        item = {
            "itemId": str(raw_item.get("itemId") or "").strip(),
            "wordId": str(raw_item.get("wordId") or "").strip(),
            "senseId": str(raw_item.get("senseId") or "").strip(),
            "pos": str(raw_item.get("pos") or "").strip(),
            "synsetId": str(raw_item.get("synsetId") or "").strip() or None,
            "targetField": str(raw_item.get("targetField") or "").strip(),
            "sourceText": str(raw_item.get("sourceText") or "").strip(),
            "sourceLanguage": str(
                raw_item.get("sourceLanguage") or "en"
            ).strip(),
            "targetLanguage": str(
                raw_item.get("targetLanguage") or "zh-CN"
            ).strip(),
        }
        missing = [
            name
            for name in ("itemId", "wordId", "senseId", "pos", "targetField")
            if not item[name]
        ]
        if missing:
            raise JobValidationError(
                f"items[{index}] is missing stable mapping fields: "
                f"{', '.join(missing)}"
            )
        if item["itemId"] in item_ids:
            raise JobValidationError(f"Duplicate itemId: {item['itemId']}")
        item_ids.add(item["itemId"])
        items.append(item)

    return {
        "schemaVersion": JOB_SCHEMA_VERSION,
        "jobId": job_id,
        "rulesVersion": rules_version,
        "decodeOptions": _validated_decode_options(payload.get("decodeOptions")),
        "items": items,
    }


def translation_identity(
    item: dict[str, Any],
    *,
    model_asset_sha256: str,
    compute_type: str,
    decode_options: dict[str, Any],
    rules_version: str,
) -> dict[str, Any]:
    return {
        "sourceTextSha256": sha256_text(item["sourceText"]),
        "sourceLanguage": _normalized_language(item["sourceLanguage"]),
        "targetLanguage": _normalized_language(item["targetLanguage"]),
        "provider": LOCAL_PROVIDER,
        "modelAssetSha256": model_asset_sha256,
        "computeType": compute_type,
        "decodeOptions": decode_options,
        "pipelineVersion": TRANSLATION_PIPELINE_VERSION,
        "rulesVersion": rules_version,
    }


class ContentAddressedTranslationCache:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.read_ms = 0.0
        self.write_ms = 0.0
        started = time.perf_counter()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.is_dir():
            raise TranslationCacheCorruption(
                f"Translation cache path is a directory: {self.path}"
            )
        try:
            self.connection = sqlite3.connect(self.path, timeout=5)
            self.connection.execute("PRAGMA busy_timeout = 5000")
            self.connection.execute("PRAGMA journal_mode = WAL")
            self.connection.execute("PRAGMA synchronous = FULL")
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS cache_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS translation_entries (
                    cache_key TEXT PRIMARY KEY,
                    identity_json TEXT NOT NULL,
                    output TEXT NOT NULL,
                    output_sha256 TEXT NOT NULL,
                    input_tokens INTEGER,
                    token_bucket TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )
            self.connection.execute(
                "INSERT OR IGNORE INTO cache_metadata(key, value) VALUES (?, ?)",
                ("schema_version", str(CACHE_SCHEMA_VERSION)),
            )
            schema_row = self.connection.execute(
                "SELECT value FROM cache_metadata WHERE key = ?",
                ("schema_version",),
            ).fetchone()
            if schema_row != (str(CACHE_SCHEMA_VERSION),):
                raise TranslationCacheCorruption(
                    "Unsupported translation cache schema"
                )
            integrity = self.connection.execute("PRAGMA quick_check").fetchone()
            if integrity != ("ok",):
                raise TranslationCacheCorruption(
                    f"Translation cache integrity check failed: {integrity}"
                )
            self.connection.commit()
        except TranslationCacheCorruption:
            connection = getattr(self, "connection", None)
            if connection is not None:
                connection.close()
                self.connection = None
            raise
        except (sqlite3.DatabaseError, OSError) as error:
            connection = getattr(self, "connection", None)
            if connection is not None:
                connection.close()
                self.connection = None
            raise TranslationCacheCorruption(
                f"Translation cache is unreadable: {self.path}"
            ) from error
        self.read_ms = (time.perf_counter() - started) * 1000

    @staticmethod
    def _validate_entry(cache_key: str, entry: dict[str, Any]) -> None:
        identity = entry.get("identity")
        output = entry.get("output")
        if (
            entry.get("cacheKey") != cache_key
            or sha256_json(identity) != cache_key
            or not isinstance(output, str)
            or sha256_text(output) != entry.get("outputSha256")
        ):
            raise TranslationCacheCorruption(
                f"Translation cache entry hash mismatch: {cache_key}"
            )

    def get(self, cache_key: str) -> dict[str, Any] | None:
        started = time.perf_counter()
        try:
            row = self.connection.execute(
                """
                SELECT identity_json, output, output_sha256, input_tokens,
                       token_bucket, created_at
                FROM translation_entries
                WHERE cache_key = ?
                """,
                (cache_key,),
            ).fetchone()
        except sqlite3.DatabaseError as error:
            raise TranslationCacheCorruption(
                f"Translation cache query failed: {cache_key}"
            ) from error
        finally:
            self.read_ms += (time.perf_counter() - started) * 1000
        if row is None:
            return None
        try:
            identity = json.loads(row[0])
        except json.JSONDecodeError as error:
            raise TranslationCacheCorruption(
                f"Translation cache identity is invalid: {cache_key}"
            ) from error
        entry = {
            "cacheKey": cache_key,
            "identity": identity,
            "output": row[1],
            "outputSha256": row[2],
            "inputTokens": row[3],
            "tokenBucket": row[4],
            "createdAt": row[5],
        }
        self._validate_entry(cache_key, entry)
        return entry

    def put_many(self, entries: list[dict[str, Any]]) -> None:
        if not entries:
            return
        started = time.perf_counter()
        try:
            with self.connection:
                for entry in entries:
                    cache_key = entry["cacheKey"]
                    self._validate_entry(cache_key, entry)
                    identity_json = canonical_json(entry["identity"])
                    self.connection.execute(
                        """
                        INSERT OR IGNORE INTO translation_entries(
                            cache_key,
                            identity_json,
                            output,
                            output_sha256,
                            input_tokens,
                            token_bucket,
                            created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            cache_key,
                            identity_json,
                            entry["output"],
                            entry["outputSha256"],
                            entry.get("inputTokens"),
                            entry.get("tokenBucket"),
                            entry["createdAt"],
                        ),
                    )
                    stored = self.connection.execute(
                        """
                        SELECT identity_json, output, output_sha256
                        FROM translation_entries
                        WHERE cache_key = ?
                        """,
                        (cache_key,),
                    ).fetchone()
                    if stored != (
                        identity_json,
                        entry["output"],
                        entry["outputSha256"],
                    ):
                        raise TranslationCacheCorruption(
                            "Translation cache collision or conflicting output: "
                            f"{cache_key}"
                        )
        except sqlite3.DatabaseError as error:
            raise TranslationCacheCorruption(
                "Translation cache write failed"
            ) from error
        finally:
            self.write_ms += (time.perf_counter() - started) * 1000

    def close(self) -> None:
        connection = getattr(self, "connection", None)
        if connection is None:
            return
        try:
            try:
                connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            except sqlite3.DatabaseError as error:
                raise TranslationCacheCorruption(
                    "Translation cache checkpoint failed"
                ) from error
        finally:
            connection.close()
            self.connection = None

    def __del__(self):
        try:
            self.close()
        except (AttributeError, sqlite3.DatabaseError, TranslationCacheCorruption):
            pass


def _base_output_item(
    item: dict[str, Any],
    *,
    cache_key: str,
    model_asset_sha256: str,
    parameter_sha256: str,
    rules_version: str,
) -> dict[str, Any]:
    return {
        **item,
        "status": "pending",
        "cacheKey": cache_key,
        "cacheHit": False,
        "resumeHit": False,
        "deduplicated": False,
        "provider": LOCAL_PROVIDER,
        "modelAssetSha256": model_asset_sha256,
        "parameterSha256": parameter_sha256,
        "rulesVersion": rules_version,
        "inputSha256": sha256_text(item["sourceText"]),
        "output": None,
        "outputSha256": None,
        "error": None,
        "inputTokens": None,
        "tokenBucket": None,
        "inferenceMs": 0.0,
        "retryCount": 0,
    }


def _load_resume_items(
    output_path: Path,
    request_sha256: str,
    parameter_sha256: str,
) -> tuple[dict[str, dict[str, Any]], str | None]:
    if not output_path.exists():
        return {}, None
    try:
        payload = read_json(output_path)
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise JobValidationError(
            f"Existing output checkpoint is unreadable: {output_path}"
        ) from error
    if (
        not isinstance(payload, dict)
        or payload.get("kind") != JOB_KIND
        or payload.get("requestSha256") != request_sha256
        or payload.get("parameterSha256") != parameter_sha256
    ):
        raise JobValidationError(
            "Output path contains a different job or parameter set; use a new output path"
        )
    if payload.get("resultSha256") != sha256_json(payload.get("items", [])):
        raise JobValidationError("Existing output checkpoint result hash mismatch")
    completed = {}
    for item in payload.get("items", []):
        if item.get("status") != "success":
            continue
        output = item.get("output")
        if not isinstance(output, str) or sha256_text(output) != item.get(
            "outputSha256"
        ):
            raise JobValidationError(
                f"Existing output checkpoint hash mismatch: {item.get('itemId')}"
            )
        completed[item.get("itemId")] = item
    return completed, payload.get("startedAt")


def _update_report_summary(report: dict[str, Any]) -> None:
    counts = Counter(item["status"] for item in report["items"])
    report["summary"] = {
        "total": len(report["items"]),
        "successful": counts["success"],
        "failed": counts["failed"],
        "pending": counts["pending"],
        "cacheHits": sum(bool(item["cacheHit"]) for item in report["items"]),
        "resumeHits": sum(bool(item["resumeHit"]) for item in report["items"]),
        "deduplicated": sum(
            bool(item["deduplicated"]) for item in report["items"]
        ),
    }


def _audit_output_integrity(
    job_items: list[dict[str, Any]],
    output_items: list[dict[str, Any]],
) -> None:
    if len(job_items) != len(output_items):
        raise JobValidationError("Final result count does not match the job input")
    stable_fields = (
        "itemId",
        "wordId",
        "senseId",
        "pos",
        "synsetId",
        "targetField",
        "sourceText",
        "sourceLanguage",
        "targetLanguage",
    )
    outputs_by_cache_key = {}
    for index, (source, result) in enumerate(zip(job_items, output_items)):
        if any(source.get(field) != result.get(field) for field in stable_fields):
            raise JobValidationError(
                f"Final result mapping changed at input index {index}"
            )
        if result["status"] == "success":
            output = result.get("output")
            if not isinstance(output, str) or sha256_text(output) != result.get(
                "outputSha256"
            ):
                raise JobValidationError(
                    f"Final result output hash mismatch: {result['itemId']}"
                )
            prior = outputs_by_cache_key.setdefault(result["cacheKey"], output)
            if prior != output:
                raise JobValidationError(
                    f"Identical cache keys produced different outputs: {result['itemId']}"
                )
        elif result["status"] == "failed":
            if result.get("output") is not None or not result.get("error"):
                raise JobValidationError(
                    f"Failed result is incomplete: {result['itemId']}"
                )
        else:
            raise JobValidationError(
                f"Final result remains pending: {result['itemId']}"
            )


def _run_translation_job_impl(
    input_path: Path,
    output_path: Path,
    *,
    cache_path: Path = DEFAULT_CACHE_PATH,
    model_dir: Path = MODEL_DIR,
    batch_size: int = DEFAULT_BATCH_SIZE,
    inter_threads: int = DEFAULT_INTER_THREADS,
    intra_threads: int = DEFAULT_INTRA_THREADS,
    compute_type: str = DEFAULT_COMPUTE_TYPE,
    length_buckets=DEFAULT_LENGTH_BUCKETS,
    engine_factory: Callable[..., LocalBatchTranslator] = LocalBatchTranslator,
    model_identity_resolver: Callable[[Path], dict[str, Any]] = local_model_identity,
    interrupt_after_checkpoints: int | None = None,
    _cache_holder: list[ContentAddressedTranslationCache] | None = None,
) -> dict[str, Any]:
    total_started = time.perf_counter()
    input_path = Path(input_path)
    output_path = Path(output_path)
    raw_input = input_path.read_bytes()
    try:
        job = validate_job(json.loads(raw_input.decode("utf-8-sig")))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise JobValidationError(f"Job input is not valid UTF-8 JSON: {input_path}") from error

    model_hash_started = time.perf_counter()
    model = model_identity_resolver(Path(model_dir))
    model_hash_ms = (time.perf_counter() - model_hash_started) * 1000
    model_asset_sha256 = model["assetSha256"]
    decode_options = job["decodeOptions"]
    parameters = {
        "batchSize": int(batch_size),
        "interThreads": int(inter_threads),
        "intraThreads": int(intra_threads),
        "computeType": str(compute_type),
        "lengthBuckets": [int(value) for value in length_buckets],
        "decodeOptions": decode_options,
        "pipelineVersion": TRANSLATION_PIPELINE_VERSION,
    }
    parameter_sha256 = sha256_json(parameters)
    request_sha256 = sha256_json(job)
    resumed, prior_started_at = _load_resume_items(
        output_path,
        request_sha256,
        parameter_sha256,
    )
    cache = ContentAddressedTranslationCache(cache_path)
    if _cache_holder is not None:
        _cache_holder.append(cache)

    output_items = []
    indexes_by_cache_key = defaultdict(list)
    cache_keys = []
    for index, item in enumerate(job["items"]):
        identity = translation_identity(
            item,
            model_asset_sha256=model_asset_sha256,
            compute_type=str(compute_type),
            decode_options=decode_options,
            rules_version=job["rulesVersion"],
        )
        cache_key = sha256_json(identity)
        cache_keys.append(cache_key)
        indexes_by_cache_key[cache_key].append(index)
        output_items.append(
            _base_output_item(
                item,
                cache_key=cache_key,
                model_asset_sha256=model_asset_sha256,
                parameter_sha256=parameter_sha256,
                rules_version=job["rulesVersion"],
            )
        )

    report = {
        "schemaVersion": JOB_SCHEMA_VERSION,
        "kind": JOB_KIND,
        "jobId": job["jobId"],
        "requestSha256": request_sha256,
        "inputFileSha256": sha256_text(raw_input.decode("utf-8-sig")),
        "parameterSha256": parameter_sha256,
        "rulesVersion": job["rulesVersion"],
        "pipelineVersion": TRANSLATION_PIPELINE_VERSION,
        "status": "running",
        "startedAt": prior_started_at or utc_now_iso(),
        "updatedAt": utc_now_iso(),
        "provider": {
            **model,
            "computeType": str(compute_type),
            "decodeOptions": decode_options,
        },
        "parameters": parameters,
        "items": output_items,
        "summary": {},
        "metrics": {},
    }

    def checkpoint() -> None:
        report["updatedAt"] = utc_now_iso()
        report["metrics"].update(
            {
                "modelAssetHashMs": round(model_hash_ms, 3),
                "cacheReadMs": round(cache.read_ms, 3),
                "cacheWriteMs": round(cache.write_ms, 3),
                "peakRssBytes": peak_rss_bytes(),
            }
        )
        _update_report_summary(report)
        report["resultSha256"] = sha256_json(report["items"])
        atomic_write_json(output_path, report)

    # Resume checkpoints take precedence and are verified above.
    for index, item in enumerate(job["items"]):
        prior = resumed.get(item["itemId"])
        if not prior:
            continue
        if prior.get("cacheKey") != cache_keys[index]:
            raise JobValidationError(
                f"Resume checkpoint content mismatch: {item['itemId']}"
            )
        preserved = {
            key: prior.get(key)
            for key in (
                "output",
                "outputSha256",
                "inputTokens",
                "tokenBucket",
                "inferenceMs",
                "retryCount",
            )
        }
        report["items"][index].update(
            {
                **preserved,
                "status": "success",
                "resumeHit": True,
                "error": None,
            }
        )

    # Fill remaining items from the content-addressed cache.
    for cache_key, indexes in indexes_by_cache_key.items():
        pending = [index for index in indexes if report["items"][index]["status"] == "pending"]
        if not pending:
            continue
        cached = cache.get(cache_key)
        if not cached:
            continue
        for index in pending:
            report["items"][index].update(
                {
                    "status": "success",
                    "cacheHit": True,
                    "output": cached["output"],
                    "outputSha256": cached["outputSha256"],
                    "inputTokens": cached.get("inputTokens"),
                    "tokenBucket": cached.get("tokenBucket"),
                    "inferenceMs": 0.0,
                    "retryCount": 0,
                    "error": None,
                }
            )

    for index, item in enumerate(report["items"]):
        if item["status"] != "pending":
            continue
        if not item["sourceText"]:
            item.update(
                {
                    "status": "failed",
                    "error": {
                        "code": "invalid_source",
                        "message": "sourceText is empty",
                    },
                }
            )
        elif not _supports_local_provider(
            item["sourceLanguage"], item["targetLanguage"]
        ):
            item.update(
                {
                    "status": "failed",
                    "error": {
                        "code": "provider_unavailable",
                        "message": "Approved local provider supports English to Chinese only",
                    },
                }
            )

    checkpoint()

    unique_missing = []
    for cache_key, indexes in indexes_by_cache_key.items():
        pending = [index for index in indexes if report["items"][index]["status"] == "pending"]
        if not pending:
            continue
        representative = pending[0]
        unique_missing.append(
            {
                "cacheKey": cache_key,
                "representative": representative,
                "indexes": pending,
                "item": job["items"][representative],
            }
        )
        for duplicate_index in pending[1:]:
            report["items"][duplicate_index]["deduplicated"] = True

    aggregate_metrics = Counter()
    checkpoint_metrics = Counter()
    checkpoint_count = 0
    if unique_missing:
        engine = engine_factory(
            Path(model_dir),
            inter_threads=int(inter_threads),
            intra_threads=int(intra_threads),
            compute_type=str(compute_type),
            decode_options=decode_options,
        )
        groups = defaultdict(list)
        for missing in unique_missing:
            item = missing["item"]
            groups[
                (
                    _normalized_language(item["sourceLanguage"]),
                    _normalized_language(item["targetLanguage"]),
                    model_asset_sha256,
                )
            ].append(missing)

        try:
            for group in groups.values():
                processed_results = []

                def handle_results(results: list[BatchTranslationItem]) -> None:
                    nonlocal checkpoint_count
                    processed_results.extend(results)
                    checkpoint_metrics["checkpointedItems"] += len(results)
                    checkpoint_metrics["checkpointedInputTokens"] += sum(
                        result.input_tokens for result in results
                    )
                    checkpoint_metrics["checkpointedInferenceMs"] += sum(
                        result.inference_ms for result in results
                    )
                    report["metrics"].update(
                        {
                            key: round(value, 3)
                            for key, value in checkpoint_metrics.items()
                        }
                    )
                    cache_entries = []
                    for result in results:
                        missing = group[result.index]
                        output_sha256 = (
                            sha256_text(result.output)
                            if result.status == "success" and result.output is not None
                            else None
                        )
                        if output_sha256:
                            identity = translation_identity(
                                missing["item"],
                                model_asset_sha256=model_asset_sha256,
                                compute_type=str(compute_type),
                                decode_options=decode_options,
                                rules_version=job["rulesVersion"],
                            )
                            cache_entries.append(
                                {
                                    "cacheKey": missing["cacheKey"],
                                    "identity": identity,
                                    "output": result.output,
                                    "outputSha256": output_sha256,
                                    "inputTokens": result.input_tokens,
                                    "tokenBucket": result.token_bucket,
                                    "createdAt": utc_now_iso(),
                                }
                            )
                        for item_index in missing["indexes"]:
                            report["items"][item_index].update(
                                {
                                    "status": result.status,
                                    "output": result.output,
                                    "outputSha256": output_sha256,
                                    "inputTokens": result.input_tokens,
                                    "tokenBucket": result.token_bucket,
                                    "inferenceMs": result.inference_ms,
                                    "retryCount": result.retry_count,
                                    "error": (
                                        None
                                        if result.status == "success"
                                        else {
                                            "code": "translation_failed",
                                            "message": result.error,
                                        }
                                    ),
                                }
                            )
                    cache.put_many(cache_entries)
                    checkpoint()
                    checkpoint_count += 1
                    if (
                        interrupt_after_checkpoints is not None
                        and checkpoint_count >= interrupt_after_checkpoints
                    ):
                        raise KeyboardInterrupt("simulated interruption after checkpoint")

                batch_report = engine.translate_many_detailed(
                    [missing["item"]["sourceText"] for missing in group],
                    batch_size=int(batch_size),
                    length_buckets=tuple(int(value) for value in length_buckets),
                    on_checkpoint=handle_results,
                )
                if len(processed_results) != len(group):
                    raise RuntimeError(
                        "translation checkpoint callback count mismatch: "
                        f"expected {len(group)}, received {len(processed_results)}"
                    )
                for key, value in batch_report["metrics"].items():
                    if isinstance(value, (int, float)) and value is not None:
                        if key == "coldStartMs":
                            aggregate_metrics[key] = max(
                                aggregate_metrics[key], value
                            )
                        elif key not in ("itemsPerSecond", "tokensPerSecond"):
                            aggregate_metrics[key] += value
        except KeyboardInterrupt:
            report["status"] = "interrupted"
            report["metrics"].update(
                {
                    "totalMs": round(
                        (time.perf_counter() - total_started) * 1000,
                        3,
                    ),
                    "peakRssBytes": peak_rss_bytes(),
                }
            )
            checkpoint()
            cache.close()
            raise

    audit_started = time.perf_counter()
    _audit_output_integrity(job["items"], report["items"])
    audit_ms = (time.perf_counter() - audit_started) * 1000
    total_ms = (time.perf_counter() - total_started) * 1000
    report["status"] = (
        "complete"
        if all(item["status"] == "success" for item in report["items"])
        else "completed_with_errors"
    )
    inferred = sum(
        item["status"] == "success"
        and not item["cacheHit"]
        and not item["resumeHit"]
        and not item["deduplicated"]
        for item in report["items"]
    )
    inference_seconds = aggregate_metrics["inferenceMs"] / 1000
    report["metrics"].update(
        {
            **{
                key: round(value, 3)
                for key, value in aggregate_metrics.items()
            },
            "cacheReadMs": round(cache.read_ms, 3),
            "cacheWriteMs": round(cache.write_ms, 3),
            "modelAssetHashMs": round(model_hash_ms, 3),
            "auditMs": round(audit_ms, 3),
            "totalMs": round(total_ms, 3),
            "inferredUniqueItems": inferred,
            "itemsPerSecond": (
                round(inferred / inference_seconds, 3)
                if inference_seconds
                else None
            ),
            "tokensPerSecond": (
                round(aggregate_metrics["inputTokens"] / inference_seconds, 3)
                if inference_seconds
                else None
            ),
            "cacheHitRate": round(
                sum(item["cacheHit"] or item["resumeHit"] for item in report["items"])
                / len(report["items"]),
                6,
            ),
            "peakRssBytes": peak_rss_bytes(),
        }
    )
    checkpoint()
    cache.close()
    return report


def run_translation_job(
    input_path: Path,
    output_path: Path,
    *,
    cache_path: Path = DEFAULT_CACHE_PATH,
    model_dir: Path = MODEL_DIR,
    batch_size: int = DEFAULT_BATCH_SIZE,
    inter_threads: int = DEFAULT_INTER_THREADS,
    intra_threads: int = DEFAULT_INTRA_THREADS,
    compute_type: str = DEFAULT_COMPUTE_TYPE,
    length_buckets=DEFAULT_LENGTH_BUCKETS,
    engine_factory: Callable[..., LocalBatchTranslator] = LocalBatchTranslator,
    model_identity_resolver: Callable[[Path], dict[str, Any]] = local_model_identity,
    interrupt_after_checkpoints: int | None = None,
) -> dict[str, Any]:
    cache_holder = []
    try:
        return _run_translation_job_impl(
            input_path,
            output_path,
            cache_path=cache_path,
            model_dir=model_dir,
            batch_size=batch_size,
            inter_threads=inter_threads,
            intra_threads=intra_threads,
            compute_type=compute_type,
            length_buckets=length_buckets,
            engine_factory=engine_factory,
            model_identity_resolver=model_identity_resolver,
            interrupt_after_checkpoints=interrupt_after_checkpoints,
            _cache_holder=cache_holder,
        )
    finally:
        active_error = sys.exc_info()[0] is not None
        for cache in reversed(cache_holder):
            try:
                cache.close()
            except TranslationCacheCorruption:
                if not active_error:
                    raise


def parse_length_buckets(value: str) -> tuple[int, ...]:
    try:
        result = tuple(int(part.strip()) for part in value.split(",") if part.strip())
    except ValueError as error:
        raise argparse.ArgumentTypeError("Length buckets must be integers") from error
    if not result or tuple(sorted(set(result))) != result or result[0] < 1:
        raise argparse.ArgumentTypeError(
            "Length buckets must be unique, positive, and increasing"
        )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run a strict local translation job and write a CD review file."
    )
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_PATH)
    parser.add_argument("--model-dir", type=Path, default=MODEL_DIR)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--inter-threads", type=int, default=DEFAULT_INTER_THREADS)
    parser.add_argument("--intra-threads", type=int, default=DEFAULT_INTRA_THREADS)
    parser.add_argument("--compute-type", default=DEFAULT_COMPUTE_TYPE)
    parser.add_argument(
        "--length-buckets",
        type=parse_length_buckets,
        default=DEFAULT_LENGTH_BUCKETS,
    )
    args = parser.parse_args()
    try:
        report = run_translation_job(
            args.input,
            args.output,
            cache_path=args.cache,
            model_dir=args.model_dir,
            batch_size=args.batch_size,
            inter_threads=args.inter_threads,
            intra_threads=args.intra_threads,
            compute_type=args.compute_type,
            length_buckets=args.length_buckets,
        )
    except KeyboardInterrupt:
        print("Translation job interrupted after an atomic checkpoint", file=sys.stderr)
        return 130
    except (
        JobValidationError,
        TranslationCacheCorruption,
        TranslationProviderUnavailable,
        FileNotFoundError,
        OSError,
        ValueError,
        RuntimeError,
    ) as error:
        print(f"Translation job failed: {error}", file=sys.stderr)
        return 2

    print(
        json.dumps(
            {
                "status": report["status"],
                "summary": report["summary"],
                "metrics": report["metrics"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if report["status"] == "complete" else 1


if __name__ == "__main__":
    raise SystemExit(main())
