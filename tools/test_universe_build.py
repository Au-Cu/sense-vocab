import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from build_word_universes import cached_embeddings, connectivity, definition_matches, install_immutable_version


class UniverseBuildTests(unittest.TestCase):
    def test_definition_match_does_not_treat_substrings_as_equivalent(self):
        self.assertTrue(definition_matches("A financial institution.", "a financial institution"))
        self.assertFalse(definition_matches("not a financial institution", "a financial institution"))
        self.assertFalse(definition_matches("", ""))

    def test_connectivity_reports_isolated_words_and_components(self):
        self.assertEqual(connectivity(["a", "b", "c", "d"], [("a", "b"), ("b", "c")]),
                         {"components": 2, "largestComponentWords": 3, "isolatedWords": 1})

    def test_cache_is_identity_bound_and_does_not_reinfer_on_hit(self):
        values = np.zeros((2, 384), dtype=np.float32)
        values[0, 0] = values[1, 1] = 1
        with tempfile.TemporaryDirectory() as directory, patch("build_word_universes.embed", return_value=(values, 1.25)) as call:
            arguments = (["one", "two"], ['["a","n-1"]', '["b","n-1"]'], Path(directory), "model-a", Path(directory), 2)
            first, _, metadata = cached_embeddings(*arguments)
            second, seconds, hit = cached_embeddings(*arguments)
            np.testing.assert_array_equal(first, second)
            self.assertEqual(call.call_count, 1)
            self.assertFalse(metadata["hit"])
            self.assertTrue(hit["hit"])
            self.assertEqual(seconds, 0)
            self.assertEqual(metadata["sha256"], hit["sha256"])
            reordered = (arguments[0][::-1], arguments[1][::-1], *arguments[2:])
            cached_embeddings(*reordered)
            self.assertEqual(call.call_count, 2)

    def test_corrupt_cache_fails_closed(self):
        values = np.zeros((1, 384), dtype=np.float32)
        values[0, 0] = 1
        with tempfile.TemporaryDirectory() as directory, patch("build_word_universes.embed", return_value=(values, 1)) as call:
            arguments = (["one"], ['["a","n-1"]'], Path(directory), "model-a", Path(directory), 2)
            _, _, metadata = cached_embeddings(*arguments)
            path = Path(directory) / f'{metadata["key"]}.npz'
            path.write_bytes(b"not a valid vector cache")
            with self.assertRaisesRegex(ValueError, "cache is damaged"):
                cached_embeddings(*arguments)
            self.assertEqual(call.call_count, 1)

    def test_version_install_is_immutable_and_preserves_first_run_report(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first, second, changed, target = [root / name for name in ("first", "second", "changed", "version")]
            for folder, timing, content in [(first, 3, "same"), (second, 1, "same"), (changed, 1, "different")]:
                folder.mkdir()
                (folder / "report.json").write_text('{"inputs":{"model":"a"},"seconds":' + str(timing) + '}', encoding="utf8")
                (folder / "index.json").write_text(content, encoding="utf8")
            install_immutable_version(first, target)
            install_immutable_version(second, target)
            self.assertFalse(second.exists())
            self.assertIn('"seconds":3', (target / "report.json").read_text(encoding="utf8"))
            with self.assertRaisesRegex(ValueError, "artifact differs"):
                install_immutable_version(changed, target)
            self.assertEqual((target / "index.json").read_text(encoding="utf8"), "same")


if __name__ == "__main__":
    unittest.main()
