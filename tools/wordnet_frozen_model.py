"""Validated frozen WordNet-only encoder and stable incremental positions.

The frozen model is a local build input, not a browser asset. A saved model
is accepted only together with its exact expected SHA-256, the pinned WordNet
archive, and the runtime version that created it. It contains arrays, not a
pickle. Similarity-based placement is a visualization hint, not a synonym edge.
"""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path

import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer

from universe_core import wordnet_key

TOKEN_PATTERN = r"(?u)\b[a-zA-Z][a-zA-Z0-9_'-]+\b"


def definition_matches(left, right):
    def normalize(value):
        return re.sub(r'[^a-z0-9]+', ' ', (value or '').lower()).strip()
    a, b = normalize(left), normalize(right)
    return bool(a and a == b)


def load_wordnet(path):
    counts, glosses, tags = {}, {}, {}
    with zipfile.ZipFile(path) as archive:
        if ('WordNet 3.0' not in archive.read('wordnet/README').decode('utf8', 'replace') or
            'Princeton' not in archive.read('wordnet/LICENSE').decode('utf8', 'replace')):
            raise ValueError('WordNet source is not verified as 3.0')
        for raw in archive.open('wordnet/index.sense'):
            key, offset, _rank, count = raw.decode('utf8').split()
            lemma, suffix = key.split('%')
            part = {'1': 'n', '2': 'v', '3': 'a', '4': 'r', '5': 'a'}[suffix[0]]
            identity = (lemma, offset, part)
            if identity in counts:
                raise ValueError('ambiguous WordNet identity')
            counts[identity] = int(count)
        for part, kind in (('n', 'noun'), ('v', 'verb'), ('a', 'adj'), ('r', 'adv')):
            for raw in archive.open(f'wordnet/data.{kind}'):
                line = raw.decode('utf8').strip()
                if line and line[0].isdigit() and ' | ' in line:
                    header, body = line.split(' | ', 1)
                    fields = header.split()
                    glosses[(fields[0], part)] = body.split('; "')[0].strip()
                    tags[(fields[0], part)] = fields[2]
    return counts, glosses, tags


def file_sha256(path):
    sha = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            sha.update(chunk)
    return sha.hexdigest()


def split_pair(pair):
    data = json.dumps(['split-v1', pair], separators=(',', ':')).encode('utf8')
    value = int.from_bytes(hashlib.sha256(data).digest()[:4], 'big') % 10
    return 'test' if value < 2 else 'validation' if value < 4 else 'train'


def wordnet_neighbors(path):
    keys, links = [], set()
    with zipfile.ZipFile(path) as archive:
        for kind in ('noun', 'verb', 'adj', 'adv'):
            for raw in archive.open(f'wordnet/data.{kind}'):
                line = raw.decode('utf8').strip()
                if not line or not line[0].isdigit() or ' | ' not in line:
                    continue
                fields = line.split(' | ', 1)[0].split()
                key = (fields[0], fields[2])
                keys.append(key)
                if fields[2] not in ('n', 'v'):
                    continue
                cursor = 4 + 2 * int(fields[3], 16)
                for i in range(int(fields[cursor])):
                    symbol, target, target_pos, source_target = fields[cursor + 1 + i * 4:cursor + 5 + i * 4]
                    if symbol in ('@', '@i') and target_pos == fields[2] and source_target == '0000':
                        pair = (key, (target, target_pos))
                        if split_pair(pair) == 'train':
                            links.add(pair)
    by_key = {key: i for i, key in enumerate(keys)}
    if len(by_key) != len(keys):
        raise ValueError('duplicate WordNet document identities')
    neighbors = {}
    for a, b in sorted(links):
        if a in by_key and b in by_key:
            neighbors.setdefault(a, set()).add(b)
            neighbors.setdefault(b, set()).add(a)
    return keys, by_key, neighbors


class FrozenWordNetEncoder:
    def __init__(self, archive, model_path, expected_model_sha256):
        self.archive = Path(archive)
        if not isinstance(expected_model_sha256, str) or file_sha256(model_path) != expected_model_sha256:
            raise ValueError('frozen model checksum mismatch')
        with np.load(model_path, allow_pickle=False) as model:
            if str(model['algorithm'].item()) != 'wordnet-only-graph-context-lsa-v1':
                raise ValueError('unknown frozen model algorithm')
            if str(model['sklearnVersion'].item()) != sklearn.__version__:
                raise ValueError('frozen model runtime version mismatch')
            if str(model['wordnetSha256'].item()) != file_sha256(self.archive):
                raise ValueError('WordNet archive mismatch')
            vocabulary = model['vocabulary'].tolist()
            idf = np.asarray(model['idf'], dtype=np.float32)
            self.components = np.asarray(model['components'], dtype=np.float32)
            expected_keys = [tuple(json.loads(item)) for item in model['documentKeys'].tolist()]
            self.document_vectors = np.asarray(model['documentVectors'], dtype=np.float32)
            self.alpha = float(model['alpha'].item())
        if len(vocabulary) != len(set(vocabulary)) or not vocabulary or self.alpha != 2.0:
            raise ValueError('invalid frozen model vocabulary or context strength')
        keys, self.by_key, self.neighbors = wordnet_neighbors(self.archive)
        if (keys != expected_keys or self.components.shape != (128, len(vocabulary)) or
            idf.shape != (len(vocabulary),) or self.document_vectors.shape != (len(keys), 128) or
            not np.isfinite(idf).all() or not np.isfinite(self.components).all() or
            not np.isfinite(self.document_vectors).all()):
            raise ValueError('invalid frozen model structure')
        self.vectorizer = TfidfVectorizer(vocabulary={item: i for i, item in enumerate(vocabulary)},
            token_pattern=TOKEN_PATTERN, sublinear_tf=True, dtype=np.float32)
        self.vectorizer.fit(['placeholder'])
        self.vectorizer.idf_ = idf
        self.counts, self.glosses, self.tags = load_wordnet(self.archive)

    def encode(self, records):
        """Encode records of (word, sense); unmatched identity fails closed."""
        texts, synsets = [], []
        for word, sense in records:
            key = wordnet_key(word, sense.get('pos'), sense.get('synsetId'))
            gloss = self.glosses.get((key[1], key[2])) if key and key in self.counts else None
            synset_type = (sense.get('synsetId') or '').rsplit('-', 1)[-1]
            if (not gloss or self.tags.get((key[1], key[2])) != synset_type or
                not definition_matches(sense.get('definition'), gloss)):
                raise ValueError('sense does not independently match WordNet')
            texts.append(f"{word} | {sense['pos']} | {gloss}")
            synsets.append((key[1], synset_type))
        if not texts:
            return np.empty((0, 128), dtype=np.float32)
        base = np.asarray(self.vectorizer.transform(texts) @ self.components.T, dtype=np.float64)
        norms = np.linalg.norm(base, axis=1)
        if not np.isfinite(base).all() or np.any(norms < 1e-12):
            raise ValueError('invalid or zero text vector')
        base /= norms[:, None]
        for i, key in enumerate(synsets):
            neighbors = [self.by_key[item] for item in sorted(self.neighbors.get(key, ()))
                         if np.linalg.norm(self.document_vectors[self.by_key[item]]) > 1e-12]
            if neighbors:
                base[i] += self.alpha * self.document_vectors[neighbors].mean(axis=0)
        norms = np.linalg.norm(base, axis=1)
        if not np.isfinite(base).all() or np.any(norms < 1e-12):
            raise ValueError('invalid graph-context vector')
        return (base / norms[:, None]).astype(np.float32)


def place_new_words(anchor_ids, anchor_vectors, anchor_xy, new_ids, new_vectors):
    """Place new words by frozen anchors, returning only provisional positions.

    Existing coordinates are never modified. These positions do not create or
    approve graph edges. Ties are broken by stable word ID for determinism.
    """
    anchor_ids, new_ids = list(anchor_ids), list(new_ids)
    av, xy, nv = (np.asarray(values, dtype=np.float64) for values in (anchor_vectors, anchor_xy, new_vectors))
    if (len(anchor_ids) < 3 or len(set(anchor_ids)) != len(anchor_ids) or
        len(set(new_ids)) != len(new_ids) or set(anchor_ids) & set(new_ids) or
        av.ndim != 2 or xy.shape != (len(anchor_ids), 2) or
        av.shape[0] != len(anchor_ids) or nv.shape != (len(new_ids), av.shape[1]) or
        not np.isfinite(av).all() or not np.isfinite(xy).all() or not np.isfinite(nv).all()):
        raise ValueError('invalid or overlapping anchor and new-word data')
    result = {}
    for word_id, vector in zip(new_ids, nv):
        scores = av @ vector
        best = sorted(range(len(anchor_ids)), key=lambda i: (-scores[i], anchor_ids[i]))[:3]
        weights = np.exp((scores[best] - scores[best[0]]) / 0.01)
        weights /= weights.sum()
        result[word_id] = {'position': (weights @ xy[best]).tolist(),
                           'status': 'estimated-from-frozen-anchors',
                           'anchorIds': [anchor_ids[i] for i in best]}
    return result
