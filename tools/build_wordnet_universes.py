"""Build an isolated WordNet-only map candidate; never modify a release.

The semantic vectors and t-SNE coordinates are independently prepared local
artifacts based on WordNet. No BGE/IBM weights or vectors enter this output.
The output is explicitly blocked pending review and real product integration.
"""
import argparse
import itertools
import json
import os
import sys
import time
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
os.environ.setdefault('OMP_NUM_THREADS', '2')
import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from build_word_universes import (connectivity, definition_matches, fallback_position,  # noqa: E402
    fit_or_restore_layout, json_write, load_wordnet, sha256_bytes, sha256_file, spelling_edges, tile)
from universe_core import frequency_weights, wordnet_key  # noqa: E402
from universe_placement import incomplete_positions  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--wordnet-zip', type=Path, required=True)
    parser.add_argument('--bundle', type=Path, default=ROOT / 'data/vocabulary-bundle.json')
    parser.add_argument('--vectors', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--training-report', type=Path, required=True)
    parser.add_argument('--base-training-report', type=Path)
    parser.add_argument('--coordinates', type=Path, required=True)
    parser.add_argument('--layout-report', type=Path, required=True)
    parser.add_argument('--previous-report', type=Path)
    parser.add_argument('--previous-index', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    out = args.out.resolve()
    allowed = (ROOT / '.op-cache').resolve()
    if allowed not in out.parents or out.exists():
        parser.error('output must be a new directory inside the isolated cache')
    if bool(args.previous_report) != bool(args.previous_index):
        parser.error('previous report and index must be supplied together')
    source = args.bundle
    bundle = json.loads(source.read_text(encoding='utf8'))
    bundle_sha = sha256_file(source)
    wordnet_sha = sha256_file(args.wordnet_zip)
    if wordnet_sha != 'cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59':
        raise ValueError('unexpected WordNet archive')
    vector_sha = sha256_file(args.vectors)
    model_sha = sha256_file(args.model)
    training = json.loads(args.training_report.read_text(encoding='utf8'))
    layout_report = json.loads(args.layout_report.read_text(encoding='utf8'))
    if (training.get('status') != 'candidate-pending-review' or
        training.get('modelSha256') != model_sha or training.get('vectorsSha256') != vector_sha or
        training.get('wordnetArchiveSha256') != wordnet_sha or training.get('bundleSha256') != bundle_sha or
        training.get('trainerSha256') != sha256_file(ROOT / 'tools/train_wordnet_frozen_model.py') or
        training.get('encoderSha256') != sha256_file(ROOT / 'tools/wordnet_frozen_model.py') or
        training.get('coreScriptSha256') != sha256_file(ROOT / 'tools/universe_core.py')):
        raise ValueError('training evidence does not bind to the current inputs and tools')
    if training.get('mode') == 'frozen-encoding':
        if (not args.base_training_report or
            training.get('encodingToolSha256') != sha256_file(ROOT / 'tools/encode_wordnet_frozen_model.py') or
            training.get('coreScriptSha256') != sha256_file(ROOT / 'tools/universe_core.py') or
            training.get('baseTrainingReportSha256') != sha256_file(args.base_training_report)):
            raise ValueError('frozen-encoding evidence lacks its pinned tool and base training report')
        base_training = json.loads(args.base_training_report.read_text(encoding='utf8'))
        if base_training.get('modelSha256') != model_sha or base_training.get('wordnetArchiveSha256') != wordnet_sha:
            raise ValueError('base training evidence does not bind the frozen model')
    elif training.get('mode') is not None or args.base_training_report:
        raise ValueError('unexpected training mode or base training report')
    layout_inputs = layout_report.get('inputs', {})
    if (layout_report.get('status') != 'candidate-pending-review' or
        layout_report.get('modelSha256') != model_sha or
        layout_report.get('coordinatesSha256') != sha256_file(args.coordinates) or
        layout_inputs.get('wordnetArchiveSha256') != wordnet_sha or
        layout_inputs.get('bundleSha256') != bundle_sha or layout_inputs.get('senseVectorsSha256') != vector_sha or
        layout_inputs.get('layoutScriptSha256') != sha256_file(ROOT / 'tools/build_wordnet_layout.py') or
        layout_inputs.get('encoderScriptSha256') != sha256_file(ROOT / 'tools/wordnet_frozen_model.py') or
        layout_inputs.get('coreScriptSha256') != sha256_file(ROOT / 'tools/universe_core.py')):
        raise ValueError('layout evidence does not bind to the current inputs and tools')
    with np.load(args.vectors, allow_pickle=False) as data:
        if str(data['method'].item()) != 'wordnet-only-graph-context-lsa-v1':
            raise ValueError('unexpected local vector method')
        if str(data['modelSha256'].item()) != model_sha:
            raise ValueError('vector model identity mismatch')
        ids = [tuple(json.loads(x)) for x in data['ids'].tolist()]
        vectors = np.asarray(data['vectors'], dtype=np.float64)
    norms = np.linalg.norm(vectors, axis=1)
    if len(ids) != len(set(ids)) or vectors.shape != (len(ids), 128) or not np.all(np.isfinite(vectors)) or np.any(norms < 1e-12):
        raise ValueError('invalid local vectors')
    vectors /= norms[:, None]
    vector_idx = {identity: i for i, identity in enumerate(ids)}
    with np.load(args.coordinates, allow_pickle=False) as data:
        if str(data['vectorsSha256'].item()) != vector_sha:
            raise ValueError('layout and vectors do not match')
        if str(data['modelSha256'].item()) != model_sha:
            raise ValueError('layout and model do not match')
        coordinate_ids = data['wordIds'].tolist()
        coordinates = np.asarray(data['coords'], dtype=np.float64)
        coordinate_vectors = np.asarray(data['wordVectors'], dtype=np.float64)
        coordinate_status = data['layoutStatus'].tolist()
        layout_mode = str(data['layoutMode'].item())
    if layout_mode not in ('initial', 'frozen-anchors') or (layout_mode == 'frozen-anchors') != bool(args.previous_report):
        raise ValueError('incremental semantic layout requires its previous report and index')
    if (len(coordinate_ids) != len(set(coordinate_ids)) or coordinates.shape != (len(coordinate_ids), 2) or
        coordinate_vectors.shape != (len(coordinate_ids), 128) or not np.all(np.isfinite(coordinates)) or
        not np.all(np.isfinite(coordinate_vectors))):
        raise ValueError('invalid local layout')
    if len(coordinate_status) != len(coordinate_ids) or any(s not in ('initial', 'estimated-from-frozen-anchors') for s in coordinate_status):
        raise ValueError('invalid coordinate status')
    # Keep all fitted nodes within the established logical plane. Words with
    # incomplete sense vectors remain explicit, deterministic placeholders.
    scale = 940.0 / max(float(np.max(np.abs(coordinates))), 1e-12)
    coordinates *= scale
    coordinate_idx = {identity: i for i, identity in enumerate(coordinate_ids)}
    words_by_id = {word['id']: word for word in bundle['words']}
    if len(words_by_id) != len(bundle['words']) or any(word_id not in words_by_id for word_id in coordinate_ids):
        raise ValueError('layout word identities do not match bundle')
    incomplete_words = [word for word in bundle['words'] if word['id'] not in coordinate_idx]
    estimated_positions, placement_counts = incomplete_positions(incomplete_words, coordinate_ids,
        [words_by_id[word_id]['word'] for word_id in coordinate_ids], coordinate_vectors, coordinates,
        args.wordnet_zip, args.model)
    counts, glosses, tags = load_wordnet(args.wordnet_zip)
    nodes, groups = [], defaultdict(list)
    frequency, quality = Counter(), Counter()
    seen_vectors = set()
    for word in bundle['words']:
        senses, raw_counts = [], []
        for sense in word['senses']:
            key = wordnet_key(word['word'], sense['pos'], sense.get('synsetId'))
            count = counts.get(key) if key else None
            wn_id = (key[1], key[2]) if key else None
            expected_tag = (sense.get('synsetId') or '').rsplit('-', 1)[-1]
            actual_tag = tags.get(wn_id) if wn_id else None
            valid = bool(count is not None and wn_id and actual_tag == expected_tag and
                         definition_matches(sense.get('definition'), glosses.get(wn_id)))
            identity = (word['id'], sense['id'])
            if valid != (identity in vector_idx):
                raise ValueError(f'sense/vector mismatch: {identity}')
            if valid:
                seen_vectors.add(identity)
                groups[(key[1], actual_tag)].append((word['id'], sense['id'], vector_idx[identity]))
            tag_count = count if valid else None
            label = 'missing' if tag_count is None else 'observed-zero' if tag_count == 0 else 'observed-positive'
            frequency[label] += 1
            quality['semanticSenseMatched' if valid else 'semanticSenseUnavailable'] += 1
            raw_counts.append(tag_count)
            senses.append({'id': sense['id'], 'pos': sense['pos'], 'synsetId': sense.get('synsetId'),
                           'tagCount': tag_count, 'frequency': label, 'verified': valid})
        for sense, weight in zip(senses, frequency_weights(raw_counts)):
            sense['weight'] = weight
        complete = bool(senses and all(sense['verified'] for sense in senses))
        if complete != (word['id'] in coordinate_idx):
            raise ValueError(f'word/layout completeness mismatch: {word["id"]}')
        semantic = ([round(float(x), 3) for x in coordinates[coordinate_idx[word['id']]]]
                    if complete else [round(float(x), 3) for x in estimated_positions[word['id']]['position']])
        nodes.append({'id': word['id'], 'word': word['word'], 'senses': senses,
                      'complete': complete, 'semantic': semantic,
                      'semanticPlacement': coordinate_status[coordinate_idx[word['id']]] if complete
                          else estimated_positions[word['id']]['status']})
    if seen_vectors != set(vector_idx) or sum(node['complete'] for node in nodes) != len(coordinate_ids):
        raise ValueError('unbound source or layout vector')
    quality['completeWordVectors'] = len(coordinate_ids)
    quality['incompleteWordVectors'] = len(nodes) - len(coordinate_ids)
    shape_model = HashingVectorizer(analyzer='char', ngram_range=(2, 4), n_features=512,
                                    alternate_sign=False, norm='l2')
    shape_vectors = shape_model.transform([node['word'].lower() for node in nodes]).toarray().astype(np.float32)
    prior_index = {}
    prior_layout = None
    if args.previous_report:
        previous_report = json.loads(args.previous_report.read_text(encoding='utf8'))
        if (previous_report.get('indexSha256') != sha256_file(args.previous_index) or
            previous_report.get('inputs', {}).get('modelSha256') != model_sha or
            previous_report.get('inputs', {}).get('placementScriptSha256') != sha256_file(ROOT / 'tools/universe_placement.py') or
            previous_report.get('inputs', {}).get('coordinateSha256') != layout_inputs.get('previousCoordinatesSha256')):
            raise ValueError('previous map report does not bind the supplied index and model')
        previous_index = json.loads(args.previous_index.read_text(encoding='utf8'))
        prior_index = {node['id']: node for node in previous_index['nodes']}
        if len(prior_index) != len(previous_index['nodes']):
            raise ValueError('duplicate prior word IDs')
        prior_layout = {'spelling': previous_report['layout']['spellingBasis']}
        current_ids = {node['id'] for node in nodes}
        if any(word_id not in current_ids for word_id in prior_index):
            raise ValueError('previous words disappeared; explicit review required')
    shape_coords, shape_basis, shape_mode = fit_or_restore_layout(shape_vectors, prior_layout, 'spelling', 'char-2-4-hash512-v1')
    for node, xy in zip(nodes, shape_coords):
        prior = prior_index.get(node['id'])
        if prior and prior['word'] != node['word']:
            raise ValueError('existing word spelling changed; explicit review required')
        if prior and prior['complete'] and prior['semantic'] != node['semantic']:
            raise ValueError('existing semantic position changed; explicit review required')
        if prior and not prior['complete'] and not node['complete']:
            node['semantic'], node['semanticPlacement'] = prior['semantic'], prior['semanticPlacement']
        node['spelling'] = prior['spelling'] if prior else [round(float(x), 3) for x in xy]
    forms, shape_edges, shape_metrics = spelling_edges(nodes)
    semantic_edges = []
    for (offset, pos), members in sorted(groups.items()):
        for (a, sa, ia), (b, sb, ib) in itertools.combinations(members, 2):
            if a != b:
                semantic_edges.append((a, sa, b, sb, f'omw-en-{offset}-{pos}', round(float(vectors[ia] @ vectors[ib]), 5)))
    with zipfile.ZipFile(args.wordnet_zip) as archive:
        license_bytes = archive.read('wordnet/LICENSE')
        wn_index_sha = sha256_bytes(archive.read('wordnet/index.sense'))
    generation = {'bundleSha256': bundle_sha, 'wordnetArchiveSha256': wordnet_sha,
        'wordnetIndexSha256': wn_index_sha, 'wordnetLicenseSha256': sha256_bytes(license_bytes),
        'modelSha256': model_sha, 'vectorSha256': vector_sha, 'coordinateSha256': sha256_file(args.coordinates),
        'generatorSha256': sha256_file(Path(__file__)),
        'trainingReportSha256': sha256_file(args.training_report), 'layoutReportSha256': sha256_file(args.layout_report),
        'vectorMethodScriptSha256': sha256_file(ROOT / 'tools/train_wordnet_frozen_model.py'),
        'encoderScriptSha256': sha256_file(ROOT / 'tools/wordnet_frozen_model.py'),
        'layoutScriptSha256': sha256_file(ROOT / 'tools/build_wordnet_layout.py'),
        'placementScriptSha256': sha256_file(ROOT / 'tools/universe_placement.py'),
        'shapeCoreSha256': sha256_file(ROOT / 'tools/universe_core.py'),
        'semanticMethod': 'WordNet-only-TFIDF-SVD-graph-context-128',
        'semanticLayout': 'TSNE-weighted-dot-perplexity50-seed1776' if layout_mode == 'initial' else 'frozen-anchors',
        'spellingLayout': 'char-2-4-hash512-PCA',
        'previousReportSha256': sha256_file(args.previous_report) if args.previous_report else None}
    version = sha256_bytes(json.dumps(generation, sort_keys=True, separators=(',', ':')).encode('utf8'))[:16]
    # A fresh private directory prevents overwriting any previous candidate.
    out.mkdir(parents=False, exist_ok=False)
    version_dir = out / version
    version_dir.mkdir()
    with (version_dir / 'WORDNET-3.0-LICENSE.txt').open('xb') as output:
        output.write(license_bytes)
    adjacency = {'synonym': defaultdict(list), 'spelling': defaultdict(list)}
    for a, sa, b, sb, synset, score in semantic_edges:
        adjacency['synonym'][a].append({'to': b, 'sourceSense': sa, 'targetSense': sb, 'synset': synset, 'cosine': score})
        adjacency['synonym'][b].append({'to': a, 'sourceSense': sb, 'targetSense': sa, 'synset': synset, 'cosine': score})
    for distance, a, b in shape_edges:
        adjacency['spelling'][a].append({'to': b, 'distance': distance})
        adjacency['spelling'][b].append({'to': a, 'distance': distance})
    regions = {'synonym': defaultdict(dict), 'spelling': defaultdict(dict)}
    for node in nodes:
        # Counts are distinct retained words, not sense edges or a claim that
        # the source contains every synonym/spelling neighbor in existence.
        node['synonymNeighborCount'] = len({edge['to'] for edge in adjacency['synonym'].get(node['id'], [])})
        node['spellingNeighborCount'] = len({edge['to'] for edge in adjacency['spelling'].get(node['id'], [])})
        node['semanticTile'], node['spellingTile'] = tile(*node['semantic']), tile(*node['spelling'])
        node['spellingSupported'] = node['id'] in forms
        for kind, tile_key in [('synonym', 'semanticTile'), ('spelling', 'spellingTile')]:
            regions[kind][node[tile_key]][node['id']] = sorted(adjacency[kind].get(node['id'], []),
                key=lambda edge: (edge['to'], edge.get('sourceSense', '')))
    for kind, tiles in regions.items():
        for key, payload in tiles.items():
            json_write(version_dir / kind / f'{key}.json',
                       {'schema': 1, 'version': version, 'kind': kind, 'tile': key, 'adjacency': payload})
    json_write(version_dir / 'index.json', {'schema': 1, 'version': version, 'bundleSha256': bundle_sha, 'nodes': nodes})
    linked = {value for a, _, b, _, _, _ in semantic_edges for value in (a, b)}
    graph_quality = {**dict(quality), 'nodeCount': len(nodes), 'synonymSensePairs': len(semantic_edges),
        'synonymLinkedWords': len(linked), 'spellingSupportedWords': len(forms), 'spelling': shape_metrics,
        'connectivity': {'synonym': connectivity((n['id'] for n in nodes), ((a, b) for a, _, b, _, _, _ in semantic_edges)),
                         'spelling': connectivity((n['id'] for n in nodes), ((a, b) for _, a, b in shape_edges))}}
    report = {'schema': 1, 'version': version, 'algorithm': 'wordnet-only-universe-candidate-v1', 'inputs': generation,
        'model': {'name': 'WordNet-only TF-IDF/SVD graph-context', 'source': 'local computation from WordNet 3.0',
                  'trainingData': 'WordNet 3.0 archive; no third-party pretrained weights',
                  'dimensions': 128, 'metric': 'unnormalized frequency-weighted mean of unit-sense-vector dot products',
                  'outputRights': 'pending human scope review'},
        'frequency': {'source': 'WordNet 3.0 index.sense tag_cnt', 'counts': dict(frequency),
                      'policy': 'observed+1; missing mean-observed+1; all-missing equal; tagged count is not universal frequency'},
        'indexSha256': sha256_file(version_dir / 'index.json'),
        'quality': graph_quality, 'layout': {'semantic': layout_mode, 'spelling': shape_mode, 'spellingBasis': shape_basis,
             'incrementalStability': 'freeze prior coordinates and basis; new positions are estimated, vector drift fails closed',
             'incompleteVisualPlacement': placement_counts,
             'note': 'visual proximity does not imply synonymy'},
        'resources': {'tiles': {kind: len(items) for kind, items in regions.items()}, 'localVectorsSha256': vector_sha},
        'distribution': 'blocked-until-source-model-input-output-and-field-rights-reviewed'}
    json_write(version_dir / 'report.json', report)
    files = [{'path': p.relative_to(version_dir).as_posix(), 'sha256': sha256_file(p), 'bytes': p.stat().st_size}
             for p in sorted((p for p in version_dir.rglob('*') if p.is_file()), key=lambda p: p.relative_to(version_dir).as_posix())]
    json_write(out / 'manifest.json', {'schema': 1, 'version': version, 'index': f'./{version}/index.json',
        'report': f'./{version}/report.json', 'bundleSha256': bundle_sha,
        'distribution': report['distribution'], 'files': files})
    print(json.dumps({'out': str(out), 'version': version, 'manifestSha256': sha256_file(out / 'manifest.json'),
                      'files': len(files), 'quality': graph_quality, 'distribution': report['distribution']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
