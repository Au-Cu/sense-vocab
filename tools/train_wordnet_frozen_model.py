"""Train a local WordNet-only model. Outputs are candidates, not clearance.

Requires the pinned NLTK WordNet 3.0 archive. Reads only WordNet and the public
vocabulary bundle: no model weights, third-party embeddings, or user data.
Output paths must not exist; partially written artifacts are never accepted.
"""
import argparse
import json
import os
import re
import time
import zipfile
from pathlib import Path

os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
os.environ.setdefault('OMP_NUM_THREADS', '2')
import numpy as np
import sklearn
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

from universe_core import wordnet_key
from wordnet_frozen_model import (FrozenWordNetEncoder, TOKEN_PATTERN, definition_matches,
                                  file_sha256, load_wordnet, wordnet_neighbors)

ROOT = Path(__file__).resolve().parent.parent
WORDNET_SHA256 = 'cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59'


def corpus_documents(archive_path):
    docs = []
    with zipfile.ZipFile(archive_path) as archive:
        for kind in ('noun', 'verb', 'adj', 'adv'):
            for raw in archive.open(f'wordnet/data.{kind}'):
                line = raw.decode('utf8').strip()
                if not line or not line[0].isdigit() or ' | ' not in line:
                    continue
                header, body = line.split(' | ', 1)
                fields = header.split()
                lemmas = [fields[4 + 2 * i].replace('_', ' ') for i in range(int(fields[3], 16))]
                gloss = re.split(r';\s*"', body, maxsplit=1)[0].strip()
                docs.append(' '.join(lemmas) + ' | ' + gloss)
    return docs


def save_npz_new(path, **arrays):
    partial = Path(str(path) + '.partial')
    if path.exists() or partial.exists():
        raise FileExistsError('refusing to overwrite output or partial file')
    with partial.open('xb') as stream:
        np.savez_compressed(stream, **arrays)
        stream.flush()
        os.fsync(stream.fileno())
    partial.rename(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--wordnet-zip', type=Path, required=True)
    parser.add_argument('--bundle', type=Path, default=ROOT / 'data/vocabulary-bundle.json')
    parser.add_argument('--model-out', type=Path, required=True)
    parser.add_argument('--vectors-out', type=Path, required=True)
    parser.add_argument('--report-out', type=Path, required=True)
    args = parser.parse_args()
    outputs = [args.model_out, args.vectors_out, args.report_out]
    if len({p.resolve() for p in outputs}) != len(outputs) or any(
        p.exists() or Path(str(p) + '.partial').exists() for p in outputs):
        parser.error('distinct new output paths are required')
    if file_sha256(args.wordnet_zip) != WORDNET_SHA256:
        raise ValueError('WordNet archive checksum mismatch')
    script_hash = file_sha256(Path(__file__))
    encoder_hash = file_sha256(ROOT / 'tools/wordnet_frozen_model.py')
    core_hash = file_sha256(ROOT / 'tools/universe_core.py')
    bundle_hash = file_sha256(args.bundle)
    started = time.perf_counter()
    bundle = json.loads(args.bundle.read_text(encoding='utf8'))
    counts, glosses, tags = load_wordnet(args.wordnet_zip)
    identities, records = [], []
    for word in bundle['words']:
        for sense in word['senses']:
            key = wordnet_key(word['word'], sense['pos'], sense.get('synsetId'))
            gloss = glosses.get((key[1], key[2])) if key and key in counts else None
            tag = (sense.get('synsetId') or '').rsplit('-', 1)[-1]
            if gloss and tags.get((key[1], key[2])) == tag and definition_matches(sense.get('definition'), gloss):
                identities.append(json.dumps([word['id'], sense['id']], ensure_ascii=False, separators=(',', ':')))
                records.append((word['word'], sense))
    if not identities or len(identities) != len(set(identities)):
        raise ValueError('empty or duplicate stable sense identities')
    docs = corpus_documents(args.wordnet_zip)
    keys, _by_key, _neighbors = wordnet_neighbors(args.wordnet_zip)
    if len(docs) != len(keys):
        raise ValueError('WordNet corpus and document identities differ')
    print(json.dumps({'phase': 'training', 'documents': len(docs), 'matchedSenses': len(records)}), flush=True)
    vectorizer = TfidfVectorizer(min_df=2, max_df=0.25, max_features=30000,
        token_pattern=TOKEN_PATTERN, sublinear_tf=True, dtype=np.float32)
    corpus = vectorizer.fit_transform(docs)
    model = TruncatedSVD(n_components=128, n_iter=3, random_state=471).fit(corpus)
    document_vectors = model.transform(corpus).astype(np.float32, copy=False)
    norms = np.linalg.norm(document_vectors, axis=1)
    nonzero = norms > 1e-12
    document_vectors[nonzero] /= norms[nonzero, None]
    document_vectors[~nonzero] = 0
    save_npz_new(args.model_out, vocabulary=np.asarray(vectorizer.get_feature_names_out(), dtype=str),
        idf=vectorizer.idf_, components=model.components_,
        documentKeys=np.asarray([json.dumps(k, separators=(',', ':')) for k in keys]),
        documentVectors=document_vectors, alpha=np.asarray(2.0), wordnetSha256=np.asarray(WORDNET_SHA256),
        sklearnVersion=np.asarray(sklearn.__version__), algorithm=np.asarray('wordnet-only-graph-context-lsa-v1'))
    model_hash = file_sha256(args.model_out)
    encoder = FrozenWordNetEncoder(args.wordnet_zip, args.model_out, model_hash)
    vectors = encoder.encode(records)
    save_npz_new(args.vectors_out, ids=np.asarray(identities), vectors=vectors,
                 method=np.asarray('wordnet-only-graph-context-lsa-v1'), modelSha256=np.asarray(model_hash))
    if (file_sha256(Path(__file__)) != script_hash or
        file_sha256(ROOT / 'tools/wordnet_frozen_model.py') != encoder_hash or
        file_sha256(ROOT / 'tools/universe_core.py') != core_hash or
        file_sha256(args.bundle) != bundle_hash or file_sha256(args.wordnet_zip) != WORDNET_SHA256):
        raise RuntimeError('training inputs changed during generation; output is not a verified result')
    report = {'status': 'candidate-pending-review', 'algorithm': 'wordnet-only-graph-context-lsa-v1',
        'modelSha256': model_hash, 'vectorsSha256': file_sha256(args.vectors_out),
        'wordnetArchiveSha256': WORDNET_SHA256, 'bundleSha256': bundle_hash,
        'trainerSha256': script_hash, 'encoderSha256': encoder_hash, 'coreScriptSha256': core_hash,
        'sklearnVersion': sklearn.__version__, 'numpyVersion': np.__version__,
        'documents': len(docs), 'matchedSenses': len(identities),
        'source': 'WordNet 3.0 archive and stable vocabulary identities; no pretrained models',
        'elapsedSeconds': round(time.perf_counter() - started, 3),
        'limitations': ['WordNet matching does not approve display or grant rights.',
                        'Floating point can vary with library and hardware versions.']}
    with args.report_out.open('x', encoding='utf8', newline='\n') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
