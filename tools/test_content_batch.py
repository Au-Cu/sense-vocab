from __future__ import annotations

import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

import numpy as np

from content_batch_job import (
    ContentAddressedTranslationCache,
    JobValidationError,
    TranslationCacheCorruption,
    run_translation_job,
    validate_job,
)
from semantic_example_matching import (
    EmbeddingCacheCorruption,
    embed_texts_with_cache,
    score_candidate_matrix,
)
from translation_provider import LocalBatchTranslator, translate_many
from translation_provider import TranslationProviderUnavailable


TOOLS = Path(__file__).resolve().parent


class FakeProcessor:
    def encode(self, text, out_type=str):
        return str(text).split()

    def decode(self, tokens):
        return " ".join(tokens)


class FakeResult:
    def __init__(self, tokens):
        self.hypotheses = [tokens]


class FakeTranslator:
    def __init__(self, fail_tokens=None, mismatch=False):
        self.fail_tokens = set(fail_tokens or [])
        self.mismatch = mismatch
        self.calls = []

    def translate_batch(self, source, **options):
        self.calls.append([list(tokens) for tokens in source])
        if any(self.fail_tokens.intersection(tokens) for tokens in source):
            raise RuntimeError("synthetic batch failure")
        results = [FakeResult([*tokens, "zh"]) for tokens in source]
        return results[:-1] if self.mismatch and len(results) > 1 else results


def fake_model_identity(_):
    return {
        "provider": "argos-opus-en-zh-cc-by-4.0",
        "assetSha256": "a" * 64,
        "assetBytes": 123,
        "assets": [],
    }


def fake_job(items):
    return {
        "schemaVersion": 1,
        "jobId": "test-job",
        "rulesVersion": "test-rules-v1",
        "decodeOptions": {
            "beam_size": 1,
            "num_hypotheses": 1,
            "replace_unknowns": True,
            "max_input_length": 1024,
            "max_decoding_length": 256,
        },
        "items": items,
    }


def item(item_id, text, source="en", target="zh-CN"):
    return {
        "itemId": item_id,
        "wordId": f"word-{item_id}",
        "senseId": "n-1",
        "pos": "n.",
        "synsetId": None,
        "targetField": "exampleZh",
        "sourceText": text,
        "sourceLanguage": source,
        "targetLanguage": target,
    }


class FakeEngineFactory:
    def __init__(self, fail_tokens=None):
        self.processor = FakeProcessor()
        self.translator = FakeTranslator(fail_tokens=fail_tokens)
        self.instances = 0

    def __call__(self, model_dir, **options):
        self.instances += 1
        return LocalBatchTranslator(
            model_dir,
            processor=self.processor,
            translator=self.translator,
            **options,
        )


class FakeEmbeddingModel:
    def __init__(self):
        self.calls = []

    def embed(self, texts, batch_size):
        self.calls.append(list(texts))
        return [
            np.asarray([len(text), sum(map(ord, text)) % 97, 1.0], dtype=np.float32)
            for text in texts
        ]


class ContentBatchTests(unittest.TestCase):
    def test_job_requires_unique_stable_item_ids(self):
        payload = fake_job([item("same", "one"), item("same", "two")])
        with self.assertRaisesRegex(JobValidationError, "Duplicate itemId"):
            validate_job(payload)

    def test_job_requires_part_of_speech_for_sense_binding(self):
        row = item("missing-pos", "one")
        row["pos"] = ""
        with self.assertRaisesRegex(JobValidationError, "pos"):
            validate_job(fake_job([row]))

    def test_local_batch_recursively_isolates_single_failure(self):
        backend = FakeTranslator(fail_tokens={"bad"})
        engine = LocalBatchTranslator(
            ".",
            processor=FakeProcessor(),
            translator=backend,
            inter_threads=1,
            intra_threads=1,
        )
        report = engine.translate_many_detailed(
            ["good one", "bad item", "good two"],
            batch_size=3,
        )
        self.assertEqual(
            [row["status"] for row in report["items"]],
            ["success", "failed", "success"],
        )
        self.assertGreaterEqual(report["metrics"]["failedBatchCalls"], 2)
        self.assertGreater(report["metrics"]["retryCount"], 0)

    def test_tokenization_failure_isolated_to_one_item(self):
        class SelectiveProcessor(FakeProcessor):
            def encode(self, text, out_type=str):
                if text == "bad tokenize":
                    raise ValueError("synthetic tokenization failure")
                return super().encode(text, out_type=out_type)

        engine = LocalBatchTranslator(
            ".",
            processor=SelectiveProcessor(),
            translator=FakeTranslator(),
            inter_threads=1,
            intra_threads=1,
        )
        report = engine.translate_many_detailed(
            ["good", "bad tokenize", "also good"],
            batch_size=3,
        )
        self.assertEqual(
            [row["status"] for row in report["items"]],
            ["success", "failed", "success"],
        )
        self.assertIn("tokenization failure", report["items"][1]["error"])

    def test_missing_local_model_is_an_explicit_provider_error(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(
                TranslationProviderUnavailable,
                "missing model assets",
            ):
                LocalBatchTranslator(
                    Path(directory),
                    inter_threads=1,
                    intra_threads=1,
                )

    def test_strict_batch_api_never_falls_back_for_unsupported_direction(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(
                TranslationProviderUnavailable,
                "English to Chinese only",
            ):
                translate_many(
                    ["测试"],
                    source="zh-CN",
                    target="en",
                    model_dir=Path(directory),
                )

    def test_output_count_mismatch_is_not_silently_zipped(self):
        backend = FakeTranslator(mismatch=True)
        engine = LocalBatchTranslator(
            ".",
            processor=FakeProcessor(),
            translator=backend,
            inter_threads=1,
            intra_threads=1,
        )
        report = engine.translate_many_detailed(["one", "two"], batch_size=2)
        self.assertEqual(len(report["items"]), 2)
        self.assertTrue(all(row["status"] == "success" for row in report["items"]))
        self.assertGreaterEqual(report["metrics"]["failedBatchCalls"], 1)

    def test_persistent_output_count_mismatch_fails_each_item(self):
        class EmptyTranslator:
            def translate_batch(self, source, **options):
                return []

        engine = LocalBatchTranslator(
            ".",
            processor=FakeProcessor(),
            translator=EmptyTranslator(),
            inter_threads=1,
            intra_threads=1,
        )
        report = engine.translate_many_detailed(["one", "two"], batch_size=2)
        self.assertEqual(len(report["items"]), 2)
        self.assertTrue(all(row["status"] == "failed" for row in report["items"]))
        self.assertTrue(
            all("output count mismatch" in row["error"] for row in report["items"])
        )

    def test_job_deduplicates_then_cache_hit_skips_model(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "job.json"
            output_path = root / "result.json"
            cache_path = root / "cache.json"
            input_path.write_text(
                json.dumps(fake_job([item("a", "same text"), item("b", "same text")])),
                encoding="utf-8",
            )
            engine = FakeEngineFactory()
            first = run_translation_job(
                input_path,
                output_path,
                cache_path=cache_path,
                model_dir=root,
                batch_size=8,
                inter_threads=1,
                intra_threads=1,
                engine_factory=engine,
                model_identity_resolver=fake_model_identity,
            )
            self.assertEqual(engine.instances, 1)
            self.assertEqual(first["metrics"]["inferredUniqueItems"], 1)
            self.assertEqual(first["items"][0]["output"], first["items"][1]["output"])
            self.assertTrue(first["items"][1]["deduplicated"])

            output_path.unlink()
            second_engine = FakeEngineFactory()
            second = run_translation_job(
                input_path,
                output_path,
                cache_path=cache_path,
                model_dir=root,
                batch_size=8,
                inter_threads=1,
                intra_threads=1,
                engine_factory=second_engine,
                model_identity_resolver=fake_model_identity,
            )
            self.assertEqual(second_engine.instances, 0)
            self.assertEqual(second["summary"]["cacheHits"], 2)
            self.assertEqual(second["metrics"]["inferredUniqueItems"], 0)

    def test_rules_version_invalidates_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "job.json"
            output_path = root / "result.json"
            cache_path = root / "cache.json"
            payload = fake_job([item("a", "one")])
            input_path.write_text(json.dumps(payload), encoding="utf-8")
            first_engine = FakeEngineFactory()
            run_translation_job(
                input_path,
                output_path,
                cache_path=cache_path,
                model_dir=root,
                inter_threads=1,
                intra_threads=1,
                engine_factory=first_engine,
                model_identity_resolver=fake_model_identity,
            )
            payload["rulesVersion"] = "test-rules-v2"
            input_path.write_text(json.dumps(payload), encoding="utf-8")
            output_path.unlink()
            second_engine = FakeEngineFactory()
            second = run_translation_job(
                input_path,
                output_path,
                cache_path=cache_path,
                model_dir=root,
                inter_threads=1,
                intra_threads=1,
                engine_factory=second_engine,
                model_identity_resolver=fake_model_identity,
            )
            self.assertEqual(second_engine.instances, 1)
            self.assertEqual(second["summary"]["cacheHits"], 0)

    def test_interrupted_job_resumes_without_reprocessing_completed_items(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "job.json"
            output_path = root / "result.json"
            cache_path = root / "cache.json"
            input_path.write_text(
                json.dumps(fake_job([item("a", "one"), item("b", "two")])),
                encoding="utf-8",
            )
            first_engine = FakeEngineFactory()
            with self.assertRaises(KeyboardInterrupt):
                run_translation_job(
                    input_path,
                    output_path,
                    cache_path=cache_path,
                    model_dir=root,
                    batch_size=1,
                    inter_threads=1,
                    intra_threads=1,
                    engine_factory=first_engine,
                    model_identity_resolver=fake_model_identity,
                    interrupt_after_checkpoints=1,
                )
            interrupted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(interrupted["status"], "interrupted")
            self.assertEqual(interrupted["summary"]["successful"], 1)

            second_engine = FakeEngineFactory()
            resumed = run_translation_job(
                input_path,
                output_path,
                cache_path=cache_path,
                model_dir=root,
                batch_size=1,
                inter_threads=1,
                intra_threads=1,
                engine_factory=second_engine,
                model_identity_resolver=fake_model_identity,
            )
            self.assertEqual(resumed["status"], "complete")
            self.assertEqual(resumed["summary"]["resumeHits"], 1)
            self.assertEqual(resumed["metrics"]["inferredUniqueItems"], 1)
            self.assertEqual(len(second_engine.translator.calls), 1)

    def test_modified_checkpoint_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "job.json"
            output_path = root / "result.json"
            input_path.write_text(
                json.dumps(fake_job([item("a", "one")])),
                encoding="utf-8",
            )
            run_translation_job(
                input_path,
                output_path,
                cache_path=root / "cache.json",
                model_dir=root,
                inter_threads=1,
                intra_threads=1,
                engine_factory=FakeEngineFactory(),
                model_identity_resolver=fake_model_identity,
            )
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            payload["items"][0]["output"] = "tampered"
            output_path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(JobValidationError, "result hash mismatch"):
                run_translation_job(
                    input_path,
                    output_path,
                    cache_path=root / "cache.json",
                    model_dir=root,
                    inter_threads=1,
                    intra_threads=1,
                    engine_factory=FakeEngineFactory(),
                    model_identity_resolver=fake_model_identity,
                )

    def test_invalid_direction_and_empty_text_are_explicit_failures(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "job.json"
            output_path = root / "result.json"
            input_path.write_text(
                json.dumps(
                    fake_job(
                        [
                            item("empty", ""),
                            item("direction", "文本", source="zh-CN", target="en"),
                        ]
                    )
                ),
                encoding="utf-8",
            )
            engine = FakeEngineFactory()
            report = run_translation_job(
                input_path,
                output_path,
                cache_path=root / "cache.json",
                model_dir=root,
                inter_threads=1,
                intra_threads=1,
                engine_factory=engine,
                model_identity_resolver=fake_model_identity,
            )
            self.assertEqual(report["status"], "completed_with_errors")
            self.assertEqual(engine.instances, 0)
            self.assertEqual(
                [row["error"]["code"] for row in report["items"]],
                ["invalid_source", "provider_unavailable"],
            )

    def test_corrupt_translation_cache_blocks_job(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cache.json"
            path.write_text("{not json", encoding="utf-8")
            with self.assertRaises(TranslationCacheCorruption):
                ContentAddressedTranslationCache(path)

    def test_tampered_translation_cache_entry_is_rejected_on_read(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "job.json"
            output_path = root / "result.json"
            cache_path = root / "cache.sqlite3"
            input_path.write_text(
                json.dumps(fake_job([item("a", "one")])),
                encoding="utf-8",
            )
            run_translation_job(
                input_path,
                output_path,
                cache_path=cache_path,
                model_dir=root,
                inter_threads=1,
                intra_threads=1,
                engine_factory=FakeEngineFactory(),
                model_identity_resolver=fake_model_identity,
            )
            connection = sqlite3.connect(cache_path)
            try:
                connection.execute(
                    "UPDATE translation_entries SET output = ?",
                    ("tampered",),
                )
                connection.commit()
            finally:
                connection.close()
            output_path.unlink()
            with self.assertRaisesRegex(
                TranslationCacheCorruption,
                "hash mismatch",
            ):
                run_translation_job(
                    input_path,
                    output_path,
                    cache_path=cache_path,
                    model_dir=root,
                    inter_threads=1,
                    intra_threads=1,
                    engine_factory=FakeEngineFactory(),
                    model_identity_resolver=fake_model_identity,
                )

    def test_embedding_cache_only_embeds_new_text(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.npz"
            identity = {"model": "fake", "assetSha256": "b" * 64}
            model = FakeEmbeddingModel()
            first, first_metrics = embed_texts_with_cache(
                model,
                ["alpha", "beta", "alpha"],
                cache_path=path,
                model_identity=identity,
                batch_size=4,
            )
            self.assertEqual(first_metrics["embeddedTexts"], 2)
            self.assertEqual(len(model.calls), 1)
            second, second_metrics = embed_texts_with_cache(
                model,
                ["beta", "alpha"],
                cache_path=path,
                model_identity=identity,
                batch_size=4,
            )
            self.assertEqual(second_metrics["embeddedTexts"], 0)
            self.assertEqual(second_metrics["cacheHitRate"], 1.0)
            self.assertEqual(len(model.calls), 1)
            np.testing.assert_allclose(first["alpha"], second["alpha"])

    def test_embedding_cache_model_identity_change_uses_distinct_key(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.npz"
            first_model = FakeEmbeddingModel()
            embed_texts_with_cache(
                first_model,
                ["alpha"],
                cache_path=path,
                model_identity={"model": "fake", "assetSha256": "a" * 64},
            )
            second_model = FakeEmbeddingModel()
            with self.assertRaisesRegex(
                EmbeddingCacheCorruption,
                "model identity",
            ):
                embed_texts_with_cache(
                    second_model,
                    ["alpha"],
                    cache_path=path,
                    model_identity={"model": "fake", "assetSha256": "b" * 64},
                )

    def test_corrupt_embedding_cache_blocks_job(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.npz"
            path.write_bytes(b"not an npz")
            with self.assertRaises(EmbeddingCacheCorruption):
                embed_texts_with_cache(
                    FakeEmbeddingModel(),
                    ["alpha"],
                    cache_path=path,
                    model_identity={"model": "fake", "assetSha256": "b" * 64},
                )

    def test_tampered_embedding_vector_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.npz"
            identity = {"model": "fake", "assetSha256": "b" * 64}
            embed_texts_with_cache(
                FakeEmbeddingModel(),
                ["alpha"],
                cache_path=path,
                model_identity=identity,
            )
            with np.load(path, allow_pickle=False) as payload:
                values = {name: payload[name].copy() for name in payload.files}
            values["vectors"][0, 0] += 0.25
            with path.open("wb") as handle:
                np.savez_compressed(handle, **values)
            with self.assertRaisesRegex(
                EmbeddingCacheCorruption,
                "payload hash mismatch",
            ):
                embed_texts_with_cache(
                    FakeEmbeddingModel(),
                    ["alpha"],
                    cache_path=path,
                    model_identity=identity,
                )

    def test_vectorized_scoring_matches_legacy_formula(self):
        spec = importlib.util.spec_from_file_location(
            "content_benchmark", TOOLS / "benchmark-content-batch.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        rng = np.random.default_rng(123)

        def unit():
            vector = rng.normal(size=16).astype(np.float32)
            return vector / np.linalg.norm(vector)

        senses = [
            {"id": "s1", "definition": "definition one", "synsetId": "syn-1"},
            {"id": "s2", "definition": "definition two", "synsetId": "syn-2"},
            {"id": "s3", "definition": "definition three", "synsetId": "syn-3"},
        ]
        candidates = [
            {
                "text": "candidate one has many useful words here",
                "anchor": "anchor one",
                "source": "semantic-kaikki-wiktionary",
                "metadata": {"exactSynsetId": "syn-1"},
            },
            {
                "text": "candidate two has enough words here",
                "anchor": "",
                "source": "semantic-tatoeba",
                "metadata": {},
            },
        ]
        examples = {
            "s1": ["example one"],
            "s2": [],
            "s3": ["example three a", "example three b"],
        }
        texts = [sense["definition"] for sense in senses]
        texts += [candidate["text"] for candidate in candidates]
        texts += [candidate["anchor"] for candidate in candidates if candidate["anchor"]]
        texts += [value for rows in examples.values() for value in rows]
        vectors = {text: unit() for text in texts}

        lookup = lambda sense: examples[sense["id"]]
        lexical = lambda left, right: len(set(left.split()) & set(right.split())) / 10
        legacy_score, legacy_contrast = module._legacy_scores(
            senses,
            candidates,
            vectors,
            lookup,
            lexical,
        )
        vectorized = score_candidate_matrix(
            senses,
            candidates,
            vectors,
            synset_example_lookup=lookup,
            lexical_overlap=lexical,
        )
        np.testing.assert_allclose(legacy_score, vectorized["score"], atol=1e-6)
        np.testing.assert_allclose(legacy_contrast, vectorized["contrast"], atol=1e-6)
        np.testing.assert_array_equal(
            np.argsort(-legacy_score, axis=1, kind="stable"),
            np.argsort(-vectorized["score"], axis=1, kind="stable"),
        )


if __name__ == "__main__":
    unittest.main()
