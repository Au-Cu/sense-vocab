"""Place actual words with incomplete sense vectors for visualization only.

The preferred hint is the same spelling's WordNet lemma documents, without
asserting that any of its synsets matches an unverified vocabulary sense.
If no lemma vector is available, the actual word uses an explicitly marked
outer-ring placeholder. Neither kind yields a semantic score or graph edge.
"""
import hashlib
import json
import math
import zipfile
from collections import defaultdict

import numpy as np

from wordnet_frozen_model import place_new_words


def separation(word_id):
    """A tiny stable offset separates coincident real words, not fake stars."""
    value = hashlib.sha256(word_id.encode('utf8')).digest()
    angle = int.from_bytes(value[:4], 'big') / 2**32 * math.tau
    radius = 2 + 5 * int.from_bytes(value[4:8], 'big') / 2**32
    return np.asarray([math.cos(angle) * radius, math.sin(angle) * radius])


def ring_fallback(word_id):
    value = hashlib.sha256(word_id.encode('utf8')).digest()
    angle = int.from_bytes(value[:4], 'big') / 2**32 * math.tau
    radius = 1130 + int.from_bytes(value[4:8], 'big') / 2**32 * 190
    return [math.cos(angle) * radius, math.sin(angle) * radius]


def incomplete_positions(words, anchor_ids, anchor_words, anchor_vectors, anchor_coords, archive, model):
    if not words:
        return {}, {'wordnetLemma': 0, 'outerRingFallback': 0}
    if (len(anchor_ids) != len(anchor_words) or len(set(anchor_ids)) != len(anchor_ids) or
        len({word['id'] for word in words}) != len(words)):
        raise ValueError('duplicate or mismatched placement identities')
    with np.load(model, allow_pickle=False) as payload:
        keys = [tuple(json.loads(key)) for key in payload['documentKeys'].tolist()]
        document_vectors = np.asarray(payload['documentVectors'], dtype=np.float32)
    by_key = {key: i for i, key in enumerate(keys)}
    if (len(by_key) != len(keys) or document_vectors.shape != (len(keys), 128) or
        not np.isfinite(document_vectors).all()):
        raise ValueError('invalid WordNet document vectors')
    lemma_to_keys = defaultdict(set)
    wanted = {word['word'].strip().lower().replace(' ', '_') for word in words}
    with zipfile.ZipFile(archive) as zipped:
        for raw in zipped.open('wordnet/index.sense'):
            sense_key, offset, _rank, _tag_count = raw.decode('utf8').split()
            lemma, suffix = sense_key.split('%')
            if lemma not in wanted:
                continue
            kind = {'1': 'n', '2': 'v', '3': 'a', '4': 'r', '5': 's'}[suffix[0]]
            if (offset, kind) in by_key:
                lemma_to_keys[lemma].add((offset, kind))
    lemma_ids, lemma_vectors, unknown = [], [], []
    for word in words:
        lemma = word['word'].strip().lower().replace(' ', '_')
        indices = [by_key[key] for key in sorted(lemma_to_keys[lemma])]
        vector = document_vectors[indices].mean(axis=0) if indices else None
        norm = float(np.linalg.norm(vector)) if vector is not None else 0.0
        if vector is not None and np.isfinite(norm) and norm > 1e-12:
            lemma_ids.append(word['id'])
            lemma_vectors.append(vector / norm)
        else:
            unknown.append(word)
    result = {}
    if lemma_ids:
        estimated = place_new_words(anchor_ids, anchor_vectors, anchor_coords, lemma_ids, lemma_vectors)
        for word_id in lemma_ids:
            result[word_id] = {'position': (np.asarray(estimated[word_id]['position']) + separation(word_id)).tolist(),
                               'status': 'wordnet-lemma-estimate'}
    for word in unknown:
        result[word['id']] = {'position': ring_fallback(word['id']), 'status': 'unavailable-placeholder'}
    if set(result) != {word['id'] for word in words}:
        raise ValueError('unplaced incomplete words')
    return result, {'wordnetLemma': len(lemma_ids), 'outerRingFallback': len(unknown)}
