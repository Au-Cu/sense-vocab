import unittest

from tools.build_wordnet_derivations import build_entries, endpoint, node_maps


class Synset:
    def __init__(self, offset, pos):
        self._offset, self._pos, self.items = offset, pos, []

    def offset(self): return self._offset
    def pos(self): return self._pos
    def lemmas(self): return self.items


class Lemma:
    def __init__(self, name, key, synset):
        self._name, self._key, self._synset, self.links = name, key, synset, []
        synset.items.append(self)

    def name(self): return self._name
    def key(self): return self._key
    def synset(self): return self._synset
    def derivationally_related_forms(self): return self.links


class WordNet:
    def __init__(self, synsets):
        self.synsets = {(item.pos(), item.offset()): item for item in synsets}

    def synset_from_pos_and_offset(self, pos, offset): return self.synsets[(pos, offset)]


def fixture():
    create_syn, creation_syn = Synset(1, "v"), Synset(2, "n")
    other_syn, proper_syn, creator_syn = Synset(3, "n"), Synset(4, "n"), Synset(5, "n")
    create = Lemma("create", "create%2:00:00::", create_syn)
    creation = Lemma("creation", "creation%1:00:00::", creation_syn)
    other = Lemma("creation", "creation%1:00:01::", other_syn)
    proper = Lemma("Creation", "creation%1:00:02::", proper_syn)
    creator = Lemma("creator", "creator%1:00:00::", creator_syn)
    create.links = [creation, other, proper, creator]
    creation.links = [create]
    nodes = [
        {"id": "create", "word": "create", "senses": [
            {"id": "v-1", "synsetId": "omw-en-00000001-v", "verified": True}]},
        {"id": "creation", "word": "creation", "senses": [
            {"id": "n-1", "synsetId": "omw-en-00000002-n", "verified": True}]},
    ]
    return nodes, WordNet([create_syn, creation_syn, other_syn, proper_syn, creator_syn]), create, creation, proper


class DerivationTests(unittest.TestCase):
    def test_relations_keep_exact_senses_and_explicit_external_words(self):
        nodes, wordnet, _, _, _ = fixture()
        entries, matched = build_entries(nodes, wordnet)
        self.assertEqual(matched, 2)
        edges = entries["create"]
        matched_edge = next(edge for edge in edges if edge["targetSynset"] == "omw-en-00000002-n")
        self.assertEqual((matched_edge["to"], matched_edge["sourceSense"], matched_edge["targetSense"]),
                         ("creation", "v-1", "n-1"))
        missing_sense = next(edge for edge in edges if edge["targetSynset"] == "omw-en-00000003-n")
        self.assertEqual(missing_sense["to"], "creation")
        self.assertIsNone(missing_sense["targetSense"])
        creator = next(edge for edge in edges if edge["word"] == "creator")
        self.assertIsNone(creator["to"])
        self.assertIsNone(creator["targetSense"])
        self.assertTrue(any(edge["to"] == "create" for edge in entries["creation"]))

    def test_reverse_is_not_inferred_from_spelling(self):
        nodes, wordnet, _, creation, _ = fixture()
        creation.links = []
        entries, _ = build_entries(nodes, wordnet)
        self.assertFalse(any(edge["to"] == "create" for edge in entries["creation"]))

    def test_unmatched_proper_case_is_not_attached_to_a_vocab_word(self):
        nodes, _, _, _, proper = fixture()
        result = endpoint(proper, node_maps(nodes))
        self.assertEqual(result["word"], "Creation")
        self.assertIsNone(result["wordId"])

    def test_duplicate_casefolded_words_fail_closed(self):
        with self.assertRaises(ValueError):
            node_maps([{"word": "Bank"}, {"word": "bank"}])

    def test_ids_and_output_order_are_deterministic(self):
        nodes, wordnet, _, _, _ = fixture()
        left, _ = build_entries(nodes, wordnet)
        right, _ = build_entries(nodes, wordnet)
        self.assertEqual(left, right)
        self.assertTrue(all(edge["id"].startswith("wn-deriv-") for edges in left.values() for edge in edges))


if __name__ == "__main__":
    unittest.main()
