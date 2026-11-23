"""Prepare an initial or incrementally anchored WordNet-only map candidate.

Existing coordinates are retained exactly. Changed existing word vectors or a
changed model are explicitly rejected: this tool never silently rebuilds the
map. Newly interpolated positions are estimates and do not imply synonymy.
"""
import argparse
import json
import os
from pathlib import Path

os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
os.environ.setdefault('OMP_NUM_THREADS', '2')
import numpy as np
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE

from universe_core import frequency_weights, wordnet_key
from wordnet_frozen_model import definition_matches, file_sha256, load_wordnet, place_new_words

ROOT = Path(__file__).resolve().parent.parent
WORDNET_SHA256 = 'cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59'


def collect_complete_words(bundle, archive, vector_ids, vectors):
    counts, glosses, tags = load_wordnet(archive)
    lookup = {tuple(json.loads(key)): i for i, key in enumerate(vector_ids)}
    if len(lookup) != len(vector_ids) or vectors.shape != (len(vector_ids), 128):
        raise ValueError('duplicate or invalid sense vectors')
    vectors = np.asarray(vectors, dtype=np.float64)
    norms = np.linalg.norm(vectors, axis=1)
    if not np.isfinite(vectors).all() or np.any(norms < 1e-12):
        raise ValueError('invalid or zero sense vector')
    vectors /= norms[:, None]
    word_ids, word_vectors, seen = [], [], set()
    for word in bundle['words']:
        observed, indices = [], []
        for sense in word['senses']:
            key = wordnet_key(word['word'], sense['pos'], sense.get('synsetId'))
            gloss = glosses.get((key[1], key[2])) if key and key in counts else None
            kind = (sense.get('synsetId') or '').rsplit('-', 1)[-1]
            matched = bool(gloss and tags.get((key[1], key[2])) == kind and
                           definition_matches(sense.get('definition'), gloss))
            identity = (word['id'], sense['id'])
            if matched != (identity in lookup):
                raise ValueError('WordNet and vector sense identities differ')
            observed.append(counts[key] if matched else None)
            if matched:
                indices.append(lookup[identity])
                seen.add(identity)
        if word['senses'] and len(indices) == len(word['senses']):
            word_ids.append(word['id'])
            word_vectors.append(np.asarray(frequency_weights(observed)) @ vectors[indices])
    if seen != set(lookup) or len(word_ids) != len(set(word_ids)):
        raise ValueError('unbound vectors or duplicate word identity')
    return word_ids, np.asarray(word_vectors, dtype=np.float64)


def anchored_layout(word_ids, vectors, previous_path, model_hash):
    with np.load(previous_path, allow_pickle=False) as old:
        old_ids = old['wordIds'].tolist()
        old_vectors = np.asarray(old['wordVectors'], dtype=np.float64)
        old_coords = np.asarray(old['coords'], dtype=np.float32)
        old_status = old['layoutStatus'].tolist()
        if str(old['modelSha256'].item()) != model_hash:
            raise ValueError('model changed; existing layout requires explicit review')
    lookup = {word_id: i for i, word_id in enumerate(word_ids)}
    if (len(old_ids) != len(set(old_ids)) or len(old_status) != len(old_ids) or
        old_coords.shape != (len(old_ids), 2) or old_vectors.shape != (len(old_ids), 128) or
        any(word_id not in lookup for word_id in old_ids) or not np.isfinite(old_coords).all()):
        raise ValueError('old map anchors missing or invalid')
    for i, word_id in enumerate(old_ids):
        if not np.array_equal(old_vectors[i], vectors[lookup[word_id]]):
            raise ValueError(f'existing word vector changed; requires explicit review: {word_id}')
    old_index = {word_id: i for i, word_id in enumerate(old_ids)}
    added_ids = [word_id for word_id in word_ids if word_id not in old_index]
    added_vectors = np.asarray([vectors[lookup[word_id]] for word_id in added_ids], dtype=np.float64).reshape(-1, 128)
    estimated = place_new_words(old_ids, old_vectors, old_coords, added_ids, added_vectors)
    result = np.asarray([old_coords[old_index[word_id]] if word_id in old_index else estimated[word_id]['position']
                         for word_id in word_ids], dtype=np.float32)
    statuses = [old_status[old_index[word_id]] if word_id in old_index else estimated[word_id]['status']
                for word_id in word_ids]
    return result, statuses, len(added_ids)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--wordnet-zip', type=Path, required=True)
    parser.add_argument('--vectors', type=Path, required=True)
    parser.add_argument('--bundle', type=Path, default=ROOT / 'data/vocabulary-bundle.json')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--initialize', action='store_true', help='explicitly generate an initial layout')
    group.add_argument('--previous-coordinates', type=Path, help='preserve an existing layout')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    partial = Path(str(args.out) + '.partial')
    if len({args.out.resolve(), args.report.resolve()}) != 2 or any(p.exists() for p in (args.out, args.report, partial)):
        parser.error('distinct new output paths are required')
    if file_sha256(args.wordnet_zip) != WORDNET_SHA256:
        raise ValueError('WordNet archive checksum mismatch')
    input_paths = {'wordnetArchiveSha256': args.wordnet_zip, 'bundleSha256': args.bundle,
                   'senseVectorsSha256': args.vectors, 'layoutScriptSha256': Path(__file__),
                   'encoderScriptSha256': ROOT / 'tools/wordnet_frozen_model.py',
                   'coreScriptSha256': ROOT / 'tools/universe_core.py'}
    if args.previous_coordinates:
        input_paths['previousCoordinatesSha256'] = args.previous_coordinates
    inputs = {name: file_sha256(path) for name, path in input_paths.items()}
    bundle = json.loads(args.bundle.read_text(encoding='utf8'))
    with np.load(args.vectors, allow_pickle=False) as saved:
        if str(saved['method'].item()) != 'wordnet-only-graph-context-lsa-v1':
            raise ValueError('unexpected model method')
        model_hash = str(saved['modelSha256'].item())
        identities, vectors = saved['ids'].tolist(), saved['vectors']
    if len(model_hash) != 64 or any(ch not in '0123456789abcdef' for ch in model_hash):
        raise ValueError('model checksum is missing')
    word_ids, word_vectors = collect_complete_words(bundle, args.wordnet_zip, identities, vectors)
    if args.previous_coordinates:
        coords, statuses, added = anchored_layout(word_ids, word_vectors, args.previous_coordinates, model_hash)
        mode = 'frozen-anchors'
    else:
        if len(word_ids) <= 50:
            raise ValueError('initial map needs more than 50 complete words')
        initial = PCA(n_components=2, svd_solver='randomized', random_state=431).fit_transform(word_vectors)
        initial = (initial - initial.mean(axis=0)) / max(float(np.std(initial[:, 0])), 1e-8) * 1e-4
        similarity = word_vectors.astype(np.float32) @ word_vectors.astype(np.float32).T
        distances = np.sqrt(np.maximum(0.0, 1.0 - similarity), dtype=np.float32)
        np.fill_diagonal(distances, 0.0)
        del similarity
        coords = TSNE(n_components=2, perplexity=50, early_exaggeration=12.0, learning_rate='auto',
            max_iter=500, metric='precomputed', init=initial.astype(np.float32), random_state=1776,
            method='barnes_hut', n_jobs=2).fit_transform(distances).astype(np.float32)
        statuses, added, mode = ['initial'] * len(word_ids), len(word_ids), 'initial'
    if not np.isfinite(coords).all():
        raise ValueError('invalid coordinates')
    if any(file_sha256(path) != inputs[name] for name, path in input_paths.items()):
        raise RuntimeError('layout inputs changed during generation')
    with partial.open('xb') as stream:
        np.savez_compressed(stream, wordIds=np.asarray(word_ids), coords=coords, wordVectors=word_vectors,
            vectorsSha256=np.asarray(inputs['senseVectorsSha256']), modelSha256=np.asarray(model_hash),
            layoutStatus=np.asarray(statuses), layoutMode=np.asarray(mode))
        stream.flush()
        os.fsync(stream.fileno())
    partial.rename(args.out)
    report = {'status': 'candidate-pending-review', 'mode': mode, 'wordCount': len(word_ids),
        'newOrInitialWords': added, 'modelSha256': model_hash, 'inputs': inputs,
        'coordinatesSha256': file_sha256(args.out),
        'limitations': ['Estimated positions do not create synonym edges.',
                        '2D distance does not establish exact semantic distance or synonymy.']}
    with args.report.open('x', encoding='utf8', newline='\n') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
