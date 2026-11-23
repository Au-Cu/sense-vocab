"""Placement hints never create words or pretend to verify a sense."""
import json
import math
import tempfile
import unittest
import zipfile
from pathlib import Path

import numpy as np

from universe_placement import incomplete_positions, ring_fallback, separation


class IncompletePlacementTests(unittest.TestCase):
    def test_known_lemma_and_last_resort_ring_preserve_real_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            model, archive = root / 'model.npz', root / 'wordnet.zip'
            vector = np.zeros((1, 128), dtype=np.float32)
            vector[0, 0] = 1
            np.savez_compressed(model, documentKeys=np.asarray([json.dumps(['12345678', 'n'])]),
                                documentVectors=vector)
            with zipfile.ZipFile(archive, 'w') as zipped:
                zipped.writestr('wordnet/index.sense', 'known%1:00:00:: 12345678 1 2\n')
            anchor_ids = ['a', 'b', 'c']
            anchors = np.zeros((3, 128), dtype=np.float64)
            anchors[0, 0], anchors[1, 1], anchors[2, 2] = 1, 1, 1
            xy = np.asarray([[10., 10.], [100., 0.], [0., 100.]])
            words = [{'id': 'known', 'word': 'known'}, {'id': 'unknown', 'word': 'unknown'}]
            result, counts = incomplete_positions(words, anchor_ids, anchor_ids, anchors, xy, archive, model)
            self.assertEqual(set(result), {'known', 'unknown'})
            self.assertEqual(counts, {'wordnetLemma': 1, 'outerRingFallback': 1})
            self.assertEqual(result['known']['status'], 'wordnet-lemma-estimate')
            self.assertEqual(result['unknown']['status'], 'unavailable-placeholder')
            self.assertGreaterEqual(math.hypot(*result['unknown']['position']), 1130)
            self.assertLessEqual(math.hypot(*result['unknown']['position']), 1320)
            np.testing.assert_allclose(result['known']['position'], np.asarray([10., 10.]) + separation('known'))
            np.testing.assert_allclose(result['unknown']['position'], ring_fallback('unknown'))


if __name__ == '__main__':
    unittest.main()
