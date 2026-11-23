import math
import unittest

import numpy as np

from universe_core import (damerau_osa, deletion_signatures, frequency_weights,
                           spelling_form, spelling_threshold, weighted_similarity,
                           weighted_vector, wordnet_key)


class UniverseCoreTests(unittest.TestCase):
    def test_smoothing_distinguishes_unknown_and_observed_zero(self):
        weights = frequency_weights([9, 0, None])
        self.assertTrue(math.isclose(sum(weights), 1))
        self.assertGreater(weights[2], weights[1])
        self.assertGreater(weights[0], weights[2])
        self.assertEqual(frequency_weights([None, None]), [0.5, 0.5])
        self.assertEqual(frequency_weights([0, 0]), [0.5, 0.5])
        with self.assertRaises(ValueError):
            frequency_weights([1, -1])

    def test_double_sum_equals_dot_product_without_word_renormalization(self):
        rng = np.random.default_rng(42)
        for _ in range(200):
            a, b = rng.normal(size=(4, 9)), rng.normal(size=(3, 9))
            pa = np.array(frequency_weights([9, 1, None, 0])); pb = np.array(frequency_weights([2, 4, 5]))
            an = a / np.linalg.norm(a, axis=1)[:, None]
            bn = b / np.linalg.norm(b, axis=1)[:, None]
            expected = sum(pa[i] * pb[j] * (an[i] @ bn[j]) for i in range(4) for j in range(3))
            got = weighted_similarity(a.tolist(), pa, b.tolist(), pb)
            self.assertAlmostEqual(expected, got, places=12)
            self.assertAlmostEqual(got, weighted_similarity(b.tolist(), pb, a.tolist(), pa), places=12)
            self.assertLess(np.linalg.norm(weighted_vector(a.tolist(), pa)), 1)

    def test_frequency_changes_ranking_and_does_not_reduce_to_maximum(self):
        a = [[1, 0], [0, 1]]
        target_a, target_b = [[1, 0]], [[0, 1]]
        bank_heavy = frequency_weights([9, 1])
        river_heavy = frequency_weights([1, 9])
        self.assertGreater(weighted_similarity(a, bank_heavy, target_a, [1]), weighted_similarity(a, bank_heavy, target_b, [1]))
        self.assertLess(weighted_similarity(a, river_heavy, target_a, [1]), weighted_similarity(a, river_heavy, target_b, [1]))
        self.assertLess(weighted_similarity(a, bank_heavy, target_a, [1]), 1.0)

    def test_incomplete_vectors_never_silently_drop_senses(self):
        self.assertIsNone(weighted_similarity([[1, 0], None], [0.5, 0.5], [[1, 0]], [1]))
        with self.assertRaises(ValueError):
            weighted_similarity([[1, 0]], [0.5], [[1, 0]], [1])

    def test_wordnet_binding_checks_pos_and_versioned_offset(self):
        self.assertEqual(wordnet_key('bank', 'n.', 'omw-en-08420278-n'), ('bank', '08420278', 'n'))
        self.assertEqual(wordnet_key('bank', 'n.', 'omw-en-09213565-n'), ('bank', '09213565', 'n'))
        self.assertIsNone(wordnet_key('nowadays', 'adv.', 'omw-en-12345678-n'))
        self.assertIsNone(wordnet_key('bank', 'n.', 'wn31-08420278-n'))

    def test_spelling_distance_is_not_semantic_similarity(self):
        self.assertEqual(damerau_osa('bank', 'bark'), 1)
        self.assertEqual(damerau_osa('form', 'from'), 1)
        self.assertEqual(damerau_osa('bank', 'shore'), 5)
        self.assertEqual(spelling_threshold('bank', 'bark'), 1)
        self.assertEqual(spelling_threshold('planet', 'planets'), 2)
        self.assertTrue(deletion_signatures('form') & deletion_signatures('from'))
        self.assertIsNone(spelling_form('hello world'))


if __name__ == '__main__':
    unittest.main()
