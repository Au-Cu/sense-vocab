import json
import os
import threading
import time
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable

try:
    from .batch_content_utils import build_asset_manifest, chunks
except ImportError:
    from batch_content_utils import build_asset_manifest, chunks


MODEL_DIR = Path(
    os.environ.get("ARGOS_EN_ZH_MODEL_DIR", r"D:\Files\argos-en-zh-audit")
)
LOCAL_PROVIDER = "argos-opus-en-zh-cc-by-4.0"
LEGACY_PROVIDER = "legacy-unofficial-google-translate"
LEGACY_ENDPOINT = "https://translate.googleapis.com/translate_a/single"

_local_translator = None
_local_lock = threading.Lock()

DEFAULT_BATCH_SIZE = 24
DEFAULT_INTER_THREADS = 1
DEFAULT_INTRA_THREADS = 8
DEFAULT_COMPUTE_TYPE = "float32"
DEFAULT_LENGTH_BUCKETS = (16, 32, 64, 128, 256)
DEFAULT_DECODE_OPTIONS = {
    "beam_size": 1,
    "num_hypotheses": 1,
    "replace_unknowns": True,
    "max_input_length": 1024,
    "max_decoding_length": 256,
}


def _language_code(value):
    return str(value or "").strip().lower().replace("_", "-")


def _is_en_to_zh(source, target):
    return _language_code(source).startswith("en") and _language_code(
        target
    ).startswith("zh")


class TranslationProviderUnavailable(RuntimeError):
    pass


class TranslationBatchError(RuntimeError):
    def __init__(self, message, report):
        super().__init__(message)
        self.report = report


@dataclass
class BatchTranslationItem:
    index: int
    status: str
    output: str | None
    error: str | None
    input_tokens: int
    token_bucket: str
    inference_ms: float
    retry_count: int


def local_model_manifest(model_dir=MODEL_DIR):
    model_dir = Path(model_dir)
    model_path = model_dir / "model"
    sentencepiece_path = model_dir / "sentencepiece.model"
    if not model_path.is_dir() or not sentencepiece_path.is_file():
        raise TranslationProviderUnavailable(
            f"Local translation provider unavailable: missing model assets under {model_dir}"
        )

    def include(relative):
        return (
            relative == Path("sentencepiece.model")
            or relative == Path("metadata.json")
            or relative.parts[0] == "model"
        )

    return build_asset_manifest(model_dir, include=include)


def local_model_identity(model_dir=MODEL_DIR):
    manifest = local_model_manifest(model_dir)
    return {
        "provider": LOCAL_PROVIDER,
        "assetSha256": manifest["aggregateSha256"],
        "assetBytes": manifest["totalBytes"],
        "assets": manifest["files"],
    }


def _token_bucket(length, boundaries):
    for boundary in boundaries:
        if length <= boundary:
            return f"le-{boundary}"
    return f"gt-{boundaries[-1]}"


def _safe_error(error):
    return f"{type(error).__name__}: {error}"[:500]


class LocalBatchTranslator:
    """Strict local batch translator used by reproducible CD jobs.

    This path never falls back to the historical unofficial web endpoint. The
    legacy ``translate_text`` function below intentionally keeps its existing
    maintenance behavior.
    """

    def __init__(
        self,
        model_dir=MODEL_DIR,
        *,
        inter_threads=DEFAULT_INTER_THREADS,
        intra_threads=DEFAULT_INTRA_THREADS,
        compute_type=DEFAULT_COMPUTE_TYPE,
        decode_options=None,
        processor=None,
        translator=None,
    ):
        self.model_dir = Path(model_dir)
        self.inter_threads = int(inter_threads)
        self.intra_threads = int(intra_threads)
        self.compute_type = str(compute_type)
        self.decode_options = {
            **DEFAULT_DECODE_OPTIONS,
            **(decode_options or {}),
        }
        if self.inter_threads < 1 or self.intra_threads < 1:
            raise ValueError("inter_threads and intra_threads must both be positive")
        logical_cpus = os.cpu_count() or 1
        if self.inter_threads * self.intra_threads > logical_cpus:
            raise ValueError(
                "inter_threads * intra_threads must not exceed the available "
                f"logical CPUs ({logical_cpus})"
            )

        started = time.perf_counter()
        if processor is None or translator is None:
            model_path = self.model_dir / "model"
            sentencepiece_path = self.model_dir / "sentencepiece.model"
            if not model_path.is_dir() or not sentencepiece_path.is_file():
                raise TranslationProviderUnavailable(
                    "Local translation provider unavailable: missing model assets "
                    f"under {self.model_dir}"
                )
            try:
                import ctranslate2
                import sentencepiece as spm
            except ImportError as error:
                raise TranslationProviderUnavailable(
                    "Local translation provider unavailable: install "
                    "requirements-translation.txt"
                ) from error

            processor = spm.SentencePieceProcessor(
                model_file=str(sentencepiece_path)
            )
            translator = ctranslate2.Translator(
                str(model_path),
                device="cpu",
                compute_type=self.compute_type,
                inter_threads=self.inter_threads,
                intra_threads=self.intra_threads,
                max_queued_batches=self.inter_threads,
            )
        self.processor = processor
        self.translator = translator
        self.cold_start_ms = (time.perf_counter() - started) * 1000

    def _translate_chunk(self, entries, metrics, retry_count, on_checkpoint):
        started = time.perf_counter()
        metrics["batchCalls"] += 1
        try:
            translated = self.translator.translate_batch(
                [entry[1] for entry in entries],
                max_batch_size=len(entries),
                batch_type="examples",
                **self.decode_options,
            )
            elapsed_ms = (time.perf_counter() - started) * 1000
            if len(translated) != len(entries):
                raise RuntimeError(
                    "translation output count mismatch: "
                    f"expected {len(entries)}, received {len(translated)}"
                )
            metrics["inferenceMs"] += elapsed_ms
        except Exception as error:
            elapsed_ms = (time.perf_counter() - started) * 1000
            metrics["inferenceMs"] += elapsed_ms
            metrics["failedBatchCalls"] += 1
            if len(entries) > 1:
                metrics["retryCount"] += 2
                midpoint = len(entries) // 2
                left = self._translate_chunk(
                    entries[:midpoint],
                    metrics,
                    retry_count + 1,
                    on_checkpoint,
                )
                right = self._translate_chunk(
                    entries[midpoint:],
                    metrics,
                    retry_count + 1,
                    on_checkpoint,
                )
                return left + right

            item = BatchTranslationItem(
                index=entries[0][0],
                status="failed",
                output=None,
                error=_safe_error(error),
                input_tokens=len(entries[0][1]),
                token_bucket=entries[0][2],
                inference_ms=round(elapsed_ms, 3),
                retry_count=retry_count,
            )
            if on_checkpoint:
                on_checkpoint([item])
            return [item]

        per_item_ms = elapsed_ms / max(1, len(entries))
        items = []
        for entry, result in zip(entries, translated):
            try:
                if not result.hypotheses:
                    raise RuntimeError("translation result has no hypotheses")
                output = self.processor.decode(result.hypotheses[0])
                output = str(output).replace("\u2581", " ").strip()
                items.append(
                    BatchTranslationItem(
                        index=entry[0],
                        status="success",
                        output=output,
                        error=None,
                        input_tokens=len(entry[1]),
                        token_bucket=entry[2],
                        inference_ms=round(per_item_ms, 3),
                        retry_count=retry_count,
                    )
                )
            except Exception as error:
                items.append(
                    BatchTranslationItem(
                        index=entry[0],
                        status="failed",
                        output=None,
                        error=_safe_error(error),
                        input_tokens=len(entry[1]),
                        token_bucket=entry[2],
                        inference_ms=round(per_item_ms, 3),
                        retry_count=retry_count,
                    )
                )
        if on_checkpoint:
            on_checkpoint(items)
        return items

    def translate_many_detailed(
        self,
        texts,
        *,
        batch_size=DEFAULT_BATCH_SIZE,
        length_buckets=DEFAULT_LENGTH_BUCKETS,
        on_checkpoint: Callable[[list[BatchTranslationItem]], None] | None = None,
    ):
        values = [str(text or "").strip() for text in texts]
        batch_size = int(batch_size)
        boundaries = tuple(int(value) for value in length_buckets)
        if batch_size < 1:
            raise ValueError("batch_size must be positive")
        if not boundaries or any(value < 1 for value in boundaries):
            raise ValueError("length_buckets must contain positive boundaries")
        if tuple(sorted(set(boundaries))) != boundaries:
            raise ValueError("length_buckets must be strictly increasing")

        metrics = {
            "coldStartMs": round(self.cold_start_ms, 3),
            "tokenizationMs": 0.0,
            "inferenceMs": 0.0,
            "batchCalls": 0,
            "failedBatchCalls": 0,
            "retryCount": 0,
            "inputTokens": 0,
        }
        results = []
        groups = {}
        tokenization_started = time.perf_counter()
        for index, value in enumerate(values):
            if not value:
                item = BatchTranslationItem(
                    index=index,
                    status="failed",
                    output=None,
                    error="ValueError: source text is empty",
                    input_tokens=0,
                    token_bucket="empty",
                    inference_ms=0.0,
                    retry_count=0,
                )
                results.append(item)
                if on_checkpoint:
                    on_checkpoint([item])
                continue
            try:
                encoded = self.processor.encode(value, out_type=str)
            except Exception as error:
                item = BatchTranslationItem(
                    index=index,
                    status="failed",
                    output=None,
                    error=_safe_error(error),
                    input_tokens=0,
                    token_bucket="tokenization-failed",
                    inference_ms=0.0,
                    retry_count=0,
                )
                results.append(item)
                if on_checkpoint:
                    on_checkpoint([item])
                continue
            bucket = _token_bucket(len(encoded), boundaries)
            groups.setdefault(bucket, []).append((index, encoded, bucket))
            metrics["inputTokens"] += len(encoded)
        metrics["tokenizationMs"] = round(
            (time.perf_counter() - tokenization_started) * 1000,
            3,
        )

        for entries in groups.values():
            for batch in chunks(entries, batch_size):
                results.extend(
                    self._translate_chunk(batch, metrics, 0, on_checkpoint)
                )

        results.sort(key=lambda item: item.index)
        successful = sum(item.status == "success" for item in results)
        failed = len(results) - successful
        inference_seconds = metrics["inferenceMs"] / 1000
        metrics.update(
            {
                "successfulItems": successful,
                "failedItems": failed,
                "itemsPerSecond": round(
                    successful / inference_seconds, 3
                )
                if inference_seconds
                else None,
                "tokensPerSecond": round(
                    metrics["inputTokens"] / inference_seconds,
                    3,
                )
                if inference_seconds
                else None,
            }
        )
        metrics["inferenceMs"] = round(metrics["inferenceMs"], 3)
        return {
            "items": [asdict(item) for item in results],
            "metrics": metrics,
        }


def translate_many(
    texts,
    source="en",
    target="zh-CN",
    *,
    model_dir=MODEL_DIR,
    batch_size=DEFAULT_BATCH_SIZE,
    inter_threads=DEFAULT_INTER_THREADS,
    intra_threads=DEFAULT_INTRA_THREADS,
    compute_type=DEFAULT_COMPUTE_TYPE,
    decode_options=None,
):
    """Translate a homogeneous batch with the approved local model only."""

    if not _is_en_to_zh(source, target):
        raise TranslationProviderUnavailable(
            "Strict batch translation currently supports English to Chinese only"
        )
    translator = LocalBatchTranslator(
        model_dir,
        inter_threads=inter_threads,
        intra_threads=intra_threads,
        compute_type=compute_type,
        decode_options=decode_options,
    )
    report = translator.translate_many_detailed(texts, batch_size=batch_size)
    failures = [item for item in report["items"] if item["status"] != "success"]
    if failures:
        raise TranslationBatchError(
            f"Batch translation failed for {len(failures)} item(s)",
            report,
        )
    return [item["output"] for item in report["items"]]


class _LocalEnZhTranslator:
    def __init__(self, model_dir):
        import ctranslate2
        import sentencepiece as spm

        model_path = model_dir / "model"
        sentencepiece_path = model_dir / "sentencepiece.model"
        if not model_path.exists() or not sentencepiece_path.exists():
            raise FileNotFoundError(f"Missing local Argos model: {model_dir}")

        self.processor = spm.SentencePieceProcessor(
            model_file=str(sentencepiece_path)
        )
        self.translator = ctranslate2.Translator(str(model_path), device="cpu")

    def translate(self, text):
        encoded = self.processor.encode(str(text), out_type=str)
        result = self.translator.translate_batch(
            [encoded],
            beam_size=1,
            num_hypotheses=1,
            replace_unknowns=True,
        )[0]
        return self.processor.decode(result.hypotheses[0]).replace("▁", " ").strip()


def _get_local_translator():
    global _local_translator
    if _local_translator is None:
        _local_translator = _LocalEnZhTranslator(MODEL_DIR)
    return _local_translator


def _legacy_translate(text, source, target, timeout):
    query = urllib.parse.urlencode(
        {
            "client": "gtx",
            "sl": source,
            "tl": target,
            "dt": "t",
            "q": text,
        }
    )
    request = urllib.request.Request(
        f"{LEGACY_ENDPOINT}?{query}",
        headers={"User-Agent": "sense-vocab-maintenance/1.0"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return "".join(part[0] for part in payload[0] if part and part[0]).strip()


def provider_for(source="en", target="zh-CN"):
    if _is_en_to_zh(source, target) and (
        (MODEL_DIR / "model").exists()
        and (MODEL_DIR / "sentencepiece.model").exists()
    ):
        return LOCAL_PROVIDER
    return LEGACY_PROVIDER


def translate_text(text, source="en", target="zh-CN", timeout=30):
    value = str(text or "").strip()
    if not value:
        return ""

    if provider_for(source, target) == LOCAL_PROVIDER:
        # CTranslate2 inference is serialized because several legacy maintenance
        # scripts call this helper from worker pools.
        with _local_lock:
            return _get_local_translator().translate(value)

    # No locally licensed zh-to-en model is bundled yet. Retain the historical
    # endpoint for maintenance compatibility and keep it visibly audited.
    return _legacy_translate(value, source, target, timeout)
