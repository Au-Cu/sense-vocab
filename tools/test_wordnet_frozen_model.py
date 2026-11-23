"""Checks for frozen WordNet encoding and incremental visualization anchors."""
import json
import os
import tempfile
import unittest
from pathlib import Path

import numpy as np

from wordnet_frozen_model import FrozenWordNetEncoder, file_sha256, place_new_words
from build_wordnet_layout import anchored_layout

ROOT = Path(__file__).resolve().parent.parent


class IncrementalPlacementTests(unittest.TestCase):
    def setUp(self):
        self.ids = ['c', 'a', 'b']
        self.vectors = np.asarray([[1., 0.], [1., 0.], [0., 1.]])
        self.coordinates = np.asarray([[0., 0.], [2., 0.], [0., 4.]])

    def test_new_word_has_deterministic_tie_and_preserves_all_old_coordinates(self):
        before = self.coordinates.copy()
        result = place_new_words(self.ids, self.vectors, self.coordinates, ['new'], [[1., 0.]])
        np.testing.assert_array_equal(self.coordinates, before)
        self.assertEqual(result['new']['anchorIds'][:2], ['a', 'c'])
        self.assertEqual(result['new']['status'], 'estimated-from-frozen-anchors')
        self.assertAlmostEqual(result['new']['position'][0], 1.)

    def test_duplicate_existing_id_fails(self):
        with self.assertRaises(ValueError):
            place_new_words(self.ids, self.vectors, self.coordinates, ['a'], [[1., 0.]])

    def test_invalid_or_nonfinite_inputs_fail(self):
        with self.assertRaises(ValueError):
            place_new_words(self.ids, self.vectors, self.coordinates, ['new'], [[np.nan, 0.]])
        with self.assertRaises(ValueError):
            place_new_words(self.ids[:2], self.vectors[:2], self.coordinates[:2], ['new'], [[1., 0.]])

    def test_incremental_map_preserves_old_coordinates_and_rejects_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            old = Path(directory) / 'old.npz'
            matrix = np.zeros((3, 128), dtype=np.float64)
            matrix[:, :2] = self.vectors
            np.savez_compressed(old, wordIds=np.asarray(self.ids), wordVectors=matrix,
                coords=self.coordinates.astype(np.float32), layoutStatus=np.asarray(['initial'] * 3),
                modelSha256=np.asarray('a' * 64))
            new_matrix = np.vstack([matrix, matrix[0]])
            coords, statuses, added = anchored_layout(self.ids + ['new'], new_matrix, old, 'a' * 64)
            np.testing.assert_array_equal(coords[:3], self.coordinates.astype(np.float32))
            self.assertEqual(added, 1)
            self.assertEqual(statuses[-1], 'estimated-from-frozen-anchors')
            with self.assertRaisesRegex(ValueError, 'model changed'):
                anchored_layout(self.ids + ['new'], new_matrix, old, 'b' * 64)
            changed = new_matrix.copy()
            changed[0, 0] += 0.01
            with self.assertRaisesRegex(ValueError, 'existing word vector changed'):
                anchored_layout(self.ids + ['new'], changed, old, 'a' * 64)


@unittest.skipUnless(all(os.environ.get(key) for key in (
    'SENSE_VOCAB_WORDNET_ZIP', 'SENSE_VOCAB_FROZEN_MODEL', 'SENSE_VOCAB_FROZEN_MODEL_SHA',
    'SENSE_VOCAB_FROZEN_VECTORS')), 'frozen local experiment inputs not supplied')
class RealFrozenModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.archive = Path(os.environ['SENSE_VOCAB_WORDNET_ZIP'])
        cls.model_path = Path(os.environ['SENSE_VOCAB_FROZEN_MODEL'])
        cls.expected_sha = os.environ['SENSE_VOCAB_FROZEN_MODEL_SHA']
        cls.encoder = FrozenWordNetEncoder(cls.archive, cls.model_path, cls.expected_sha)

    def test_frozen_encoder_reconstructs_all_candidate_sense_vectors(self):
        with np.load(os.environ['SENSE_VOCAB_FROZEN_VECTORS'], allow_pickle=False) as payload:
            ids, expected = payload['ids'].tolist(), np.asarray(payload['vectors'], dtype=np.float32)
        bundle = json.loads((ROOT / 'data/vocabulary-bundle.json').read_text(encoding='utf8'))
        words = {word['id']: word for word in bundle['words']}
        records = []
        for identity in ids:
            word_id, sense_id = json.loads(identity)
            word = words[word_id]
            sense = next(item for item in word['senses'] if item['id'] == sense_id)
            records.append((word['word'], sense))
        actual = self.encoder.encode(records)
        self.assertEqual(actual.shape, (len(ids), 128))
        np.testing.assert_allclose(actual, expected, rtol=0, atol=1e-7)

    def test_wrong_model_hash_and_unknown_sense_fail_closed(self):
        self.assertEqual(file_sha256(self.model_path), self.expected_sha)
        with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
            FrozenWordNetEncoder(self.archive, self.model_path, '0' * 64)
        with self.assertRaisesRegex(ValueError, 'does not independently match'):
            self.encoder.encode([('not-a-wordnet-sense', {'pos': 'n.', 'synsetId': 'not-a-synset'})])

    def test_new_word_uses_frozen_encoder_without_changing_existing_anchors(self):
        coordinates_path = os.environ.get('SENSE_VOCAB_FROZEN_COORDINATES')
        if not coordinates_path:
            self.skipTest('frozen coordinate fixture not supplied')
        sense = {'pos': 'n.', 'synsetId': 'omw-en-02082791-n',
                 'definition': self.encoder.glosses[('02082791', 'n')]}
        vector = self.encoder.encode([('aardvark', sense)])[0]
        with np.load(coordinates_path, allow_pickle=False) as old:
            ids = old['wordIds'].tolist()
            matrix = np.asarray(old['wordVectors'], dtype=np.float64)
            coords = np.asarray(old['coords'], dtype=np.float32)
        self.assertNotIn('aardvark', ids)
        before = coords.copy()
        result = place_new_words(ids, matrix, coords, ['aardvark'], [vector])
        np.testing.assert_array_equal(coords, before)
        self.assertEqual(result['aardvark']['status'], 'estimated-from-frozen-anchors')
        self.assertEqual(len(result['aardvark']['anchorIds']), 3)
        self.assertTrue(np.isfinite(result['aardvark']['position']).all())


if __name__ == '__main__':
    unittest.main()
