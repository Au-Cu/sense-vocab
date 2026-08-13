"""Persistent embedding cache and vectorized semantic-example scoring."""

from __future__ import annotations

import hashlib
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Callable

import numpy as np

try:
    from .batch_content_utils import (
        build_asset_manifest,
        canonical_json,
        peak_rss_bytes,
        sha256_json,
        sha256_text,
    )
except ImportError:
    from batch_content_utils import (
        build_asset_manifest,
        canonical_json,
        peak_rss_bytes,
        sha256_json,
        sha256_text,
    )


EMBEDDING_CACHE_SCHEMA_VERSION = 1
EMBEDDING_RULES_VERSION = "l2-normalized-float32-v1"


class EmbeddingCacheCorruption(RuntimeError):
    pass


def normalized_matrix(vectors) -> np.ndarray:
    matrix = np.asarray(vectors, dtype=np.float32)
    if matrix.ndim != 2:
        raise ValueError("Embedding output must be a two-dimensional matrix")
    if not np.all(np.isfinite(matrix)):
        raise ValueError("Embedding output contains non-finite values")
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.maximum(norms, 1e-12)


def fastembed_model_identity(model, model_name: str) -> dict[str, Any]:
    backend = getattr(model, "model", None)
    model_dir = getattr(backend, "_model_dir", None)
    if model_dir is None or not Path(model_dir).is_dir():
        raise FileNotFoundError(
            "Unable to locate the loaded FastEmbed model assets for hashing"
        )
    manifest = build_asset_manifest(Path(model_dir))
    return {
        "model": model_name,
        "snapshot": Path(model_dir).name,
        "assetSha256": manifest["aggregateSha256"],
        "assetBytes": manifest["totalBytes"],
        "normalizationVersion": EMBEDDING_RULES_VERSION,
    }


def embedding_cache_key(text: str, model_identity: dict[str, Any]) -> str:
    return sha256_json(
        {
            "textSha256": sha256_text(text),
            "model": model_identity,
        }
    )


class PersistentEmbeddingCache:
    def __init__(self, path: Path, model_identity: dict[str, Any]):
        self.path = Path(path)
        self.model_identity = model_identity
        self.identity_json = canonical_json(model_identity)
        self.keys: list[str] = []
        self.vectors: np.ndarray | None = None
        self.index: dict[str, int] = {}
        self.read_ms = 0.0
        self.write_ms = 0.0

        started = time.perf_counter()
        if self.path.exists():
            self._load()
        self.read_ms = (time.perf_counter() - started) * 1000

    def _load(self) -> None:
        try:
            with np.load(self.path, allow_pickle=False) as payload:
                schema_version = int(payload["schema_version"].item())
                identity_json = str(payload["identity_json"].item())
                keys = [str(value) for value in payload["keys"].tolist()]
                vectors = np.asarray(payload["vectors"], dtype=np.float32)
                payload_sha256 = str(payload["payload_sha256"].item())
        except (OSError, ValueError, KeyError, EOFError) as error:
            raise EmbeddingCacheCorruption(
                f"Embedding cache is unreadable: {self.path}"
            ) from error
        if schema_version != EMBEDDING_CACHE_SCHEMA_VERSION:
            raise EmbeddingCacheCorruption("Unsupported embedding cache schema")
        if identity_json != self.identity_json:
            raise EmbeddingCacheCorruption(
                "Embedding cache model identity does not match its path"
            )
        if vectors.ndim != 2 or len(keys) != vectors.shape[0]:
            raise EmbeddingCacheCorruption("Embedding cache dimensions are invalid")
        valid_hex = set("0123456789abcdef")
        if (
            len(keys) != len(set(keys))
            or any(len(key) != 64 or not set(key) <= valid_hex for key in keys)
            or not np.all(np.isfinite(vectors))
        ):
            raise EmbeddingCacheCorruption("Embedding cache entries are invalid")
        if payload_sha256 != self._payload_sha256(identity_json, keys, vectors):
            raise EmbeddingCacheCorruption("Embedding cache payload hash mismatch")
        self.keys = keys
        self.vectors = vectors
        self.index = {key: index for index, key in enumerate(keys)}

    @staticmethod
    def _payload_sha256(
        identity_json: str,
        keys: list[str],
        vectors: np.ndarray,
    ) -> str:
        digest = hashlib.sha256()
        digest.update(str(EMBEDDING_CACHE_SCHEMA_VERSION).encode("ascii"))
        identity_bytes = identity_json.encode("utf-8")
        digest.update(len(identity_bytes).to_bytes(8, "big"))
        digest.update(identity_bytes)
        for key in keys:
            key_bytes = key.encode("ascii")
            digest.update(len(key_bytes).to_bytes(8, "big"))
            digest.update(key_bytes)
        matrix = np.asarray(vectors, dtype="<f4", order="C")
        digest.update(np.asarray(matrix.shape, dtype="<i8").tobytes())
        digest.update(matrix.tobytes(order="C"))
        return digest.hexdigest()

    def get_many(self, keys: list[str]) -> dict[str, np.ndarray]:
        if self.vectors is None:
            return {}
        return {
            key: self.vectors[self.index[key]]
            for key in keys
            if key in self.index
        }

    def put_many(self, rows: list[tuple[str, np.ndarray]]) -> None:
        new_rows = [(key, vector) for key, vector in rows if key not in self.index]
        if not new_rows:
            return
        matrix = normalized_matrix([vector for _, vector in new_rows])
        if self.vectors is not None and self.vectors.shape[1] != matrix.shape[1]:
            raise EmbeddingCacheCorruption(
                "Embedding cache vector width changed for the same model identity"
            )
        self.keys.extend(key for key, _ in new_rows)
        self.vectors = (
            matrix
            if self.vectors is None
            else np.concatenate([self.vectors, matrix], axis=0)
        )
        self.index = {key: index for index, key in enumerate(self.keys)}
        self._write()

    def _write(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temp_name = tempfile.mkstemp(
            prefix=f".{self.path.name}.",
            suffix=".tmp",
            dir=str(self.path.parent),
        )
        temp_path = Path(temp_name)
        started = time.perf_counter()
        try:
            with os.fdopen(descriptor, "wb") as handle:
                np.savez_compressed(
                    handle,
                    schema_version=np.asarray(
                        EMBEDDING_CACHE_SCHEMA_VERSION,
                        dtype=np.int64,
                    ),
                    identity_json=np.asarray(self.identity_json),
                    keys=np.asarray(self.keys),
                    vectors=self.vectors,
                    payload_sha256=np.asarray(
                        self._payload_sha256(
                            self.identity_json,
                            self.keys,
                            self.vectors,
                        )
                    ),
                )
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path, self.path)
        finally:
            temp_path.unlink(missing_ok=True)
        self.write_ms += (time.perf_counter() - started) * 1000


def embed_texts_with_cache(
    model,
    texts,
    *,
    cache_path: Path,
    model_identity: dict[str, Any],
    batch_size: int = 512,
) -> tuple[dict[str, np.ndarray], dict[str, Any]]:
    ordered_texts = sorted({str(text) for text in texts if str(text)})
    cache = PersistentEmbeddingCache(cache_path, model_identity)
    keys_by_text = {
        text: embedding_cache_key(text, model_identity) for text in ordered_texts
    }
    cached = cache.get_many(list(keys_by_text.values()))
    missing = [text for text in ordered_texts if keys_by_text[text] not in cached]

    embedding_started = time.perf_counter()
    new_vectors = []
    if missing:
        new_vectors = list(model.embed(missing, batch_size=int(batch_size)))
        if len(new_vectors) != len(missing):
            raise RuntimeError(
                "embedding output count mismatch: "
                f"expected {len(missing)}, received {len(new_vectors)}"
            )
        new_vectors = list(normalized_matrix(new_vectors))
        cache.put_many(
            [
                (keys_by_text[text], vector)
                for text, vector in zip(missing, new_vectors)
            ]
        )
    embedding_ms = (time.perf_counter() - embedding_started) * 1000

    cache_rows = cache.get_many(list(keys_by_text.values()))
    vectors_by_text = {
        text: cache_rows[key]
        for text, key in keys_by_text.items()
        if key in cache_rows
    }
    if len(vectors_by_text) != len(ordered_texts):
        raise EmbeddingCacheCorruption(
            "Embedding cache checkpoint did not retain every requested vector"
        )
    total = len(ordered_texts)
    hits = total - len(missing)
    metrics = {
        "requestedTexts": total,
        "cacheHits": hits,
        "embeddedTexts": len(missing),
        "cacheHitRate": round(hits / total, 6) if total else 1.0,
        "cacheReadMs": round(cache.read_ms, 3),
        "embeddingMs": round(embedding_ms, 3),
        "cacheWriteMs": round(cache.write_ms, 3),
        "itemsPerSecond": (
            round(len(missing) / (embedding_ms / 1000), 3)
            if embedding_ms and missing
            else None
        ),
        "peakRssBytes": peak_rss_bytes(),
    }
    return vectors_by_text, metrics


def score_candidate_matrix(
    senses: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    vector_by_text: dict[str, np.ndarray],
    *,
    synset_example_lookup: Callable[[dict[str, Any]], list[str]],
    lexical_overlap: Callable[[str, str], float],
) -> dict[str, np.ndarray]:
    """Score all sense/candidate pairs with matrix operations.

    The returned rows follow ``senses`` and columns follow ``candidates``.
    Missing sense definitions are marked through ``validSense`` and should be
    skipped by callers.
    """

    if not candidates:
        empty = np.empty((len(senses), 0), dtype=np.float64)
        return {
            "score": empty,
            "contrast": empty,
            "sentenceSimilarity": empty,
            "anchorSimilarity": empty,
            "sameSynset": np.empty((len(senses), 0), dtype=bool),
            "validSense": np.zeros(len(senses), dtype=bool),
        }

    first_vector = next(iter(vector_by_text.values()), None)
    if first_vector is None:
        raise ValueError("No embeddings are available for semantic scoring")
    width = len(first_vector)
    valid_sense = np.asarray(
        [str(sense.get("definition", "")) in vector_by_text for sense in senses],
        dtype=bool,
    )
    definition_vectors = np.zeros((len(senses), width), dtype=np.float32)
    for index, sense in enumerate(senses):
        definition = str(sense.get("definition", ""))
        if definition in vector_by_text:
            definition_vectors[index] = vector_by_text[definition]

    try:
        sentence_vectors = np.asarray(
            [vector_by_text[candidate["text"]] for candidate in candidates],
            dtype=np.float32,
        )
    except KeyError as error:
        raise ValueError(f"Candidate embedding is missing: {error}") from error
    anchor_vectors = np.asarray(
        [
            vector_by_text.get(candidate.get("anchor", ""), sentence_vectors[index])
            for index, candidate in enumerate(candidates)
        ],
        dtype=np.float32,
    )

    sentence_similarity = (definition_vectors @ sentence_vectors.T).astype(
        np.float64
    )
    anchor_similarity = (definition_vectors @ anchor_vectors.T).astype(np.float64)
    wordnet_similarity = sentence_similarity.copy()
    wordnet_examples_by_sense = []
    for sense_index, sense in enumerate(senses):
        examples = synset_example_lookup(sense)
        embedded_examples = [
            example
            for example in examples
            if example in vector_by_text
        ]
        wordnet_examples_by_sense.append(examples)
        if embedded_examples:
            wordnet_vectors = np.asarray(
                [vector_by_text[example] for example in embedded_examples],
                dtype=np.float32,
            )
            wordnet_similarity[sense_index] = np.max(
                sentence_vectors @ wordnet_vectors.T,
                axis=1,
            ).astype(np.float64)

    score = (
        0.43 * sentence_similarity
        + 0.47 * anchor_similarity
        + 0.10 * wordnet_similarity
    )
    lexical_bonus = np.asarray(
        [
            [
                min(
                    0.055,
                    lexical_overlap(
                        " ".join(
                            [
                                str(sense.get("definition", "")),
                                *wordnet_examples_by_sense[sense_index],
                            ]
                        ),
                        f"{candidate.get('anchor', '')} {candidate['text']}",
                    )
                    * 0.08,
                )
                for candidate in candidates
            ]
            for sense_index, sense in enumerate(senses)
        ],
        dtype=np.float64,
    )
    score += lexical_bonus

    same_synset = np.asarray(
        [
            [
                bool(candidate.get("metadata", {}).get("exactSynsetId"))
                and candidate["metadata"]["exactSynsetId"] == sense.get("synsetId")
                for candidate in candidates
            ]
            for sense in senses
        ],
        dtype=bool,
    )
    score += same_synset.astype(np.float64) * 0.14
    score += np.asarray(
        [
            0.015
            if candidate.get("source", "").startswith("semantic-kaikki")
            else 0.0
            for candidate in candidates
        ],
        dtype=np.float64,
    )[None, :]
    score += np.asarray(
        [0.01 if len(candidate["text"].split()) >= 9 else 0.0 for candidate in candidates],
        dtype=np.float64,
    )[None, :]

    exclusion_scores = 0.48 * sentence_similarity + 0.52 * anchor_similarity
    valid_count = int(valid_sense.sum())
    if valid_count <= 1:
        best_other = np.zeros_like(exclusion_scores)
    else:
        masked = np.where(valid_sense[:, None], exclusion_scores, -np.inf)
        best_index = np.argmax(masked, axis=0)
        best_value = np.max(masked, axis=0)
        second_value = np.partition(masked, -2, axis=0)[-2]
        row_indexes = np.arange(len(senses))[:, None]
        best_other = np.where(
            row_indexes == best_index[None, :],
            second_value[None, :],
            best_value[None, :],
        )
    contrast = score - best_other
    return {
        "score": score,
        "contrast": contrast,
        "sentenceSimilarity": sentence_similarity,
        "anchorSimilarity": anchor_similarity,
        "sameSynset": same_synset,
        "validSense": valid_sense,
    }
