"""Encode a changed bundle with a previously reviewed, frozen WordNet model.

This creates only local candidate vectors and provenance, not a release or an
approval. Archive, model and prior training evidence are checksum-pinned.
"""
import argparse
import json
import os
from pathlib import Path

os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
os.environ.setdefault('OMP_NUM_THREADS', '2')
import numpy as np

from universe_core import wordnet_key
from wordnet_frozen_model import FrozenWordNetEncoder, definition_matches, file_sha256
from train_wordnet_frozen_model import WORDNET_SHA256, save_npz_new

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--wordnet-zip', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--model-sha256', required=True)
    parser.add_argument('--base-training-report', type=Path, required=True)
    parser.add_argument('--base-training-report-sha256', required=True)
    parser.add_argument('--bundle', type=Path, default=ROOT / 'data/vocabulary-bundle.json')
    parser.add_argument('--vectors-out', type=Path, required=True)
    parser.add_argument('--report-out', type=Path, required=True)
    args = parser.parse_args()
    if (args.vectors_out.resolve() == args.report_out.resolve() or args.vectors_out.exists() or
        args.report_out.exists() or Path(str(args.vectors_out) + '.partial').exists()):
        parser.error('distinct new output paths are required')
    input_paths = {'wordnetArchiveSha256': args.wordnet_zip, 'bundleSha256': args.bundle,
        'modelSha256': args.model, 'baseTrainingReportSha256': args.base_training_report,
        'encodingToolSha256': Path(__file__), 'encoderSha256': ROOT / 'tools/wordnet_frozen_model.py',
        'coreScriptSha256': ROOT / 'tools/universe_core.py', 'trainerSha256': ROOT / 'tools/train_wordnet_frozen_model.py'}
    inputs = {key: file_sha256(value) for key, value in input_paths.items()}
    if (inputs['wordnetArchiveSha256'] != WORDNET_SHA256 or inputs['modelSha256'] != args.model_sha256 or
        inputs['baseTrainingReportSha256'] != args.base_training_report_sha256):
        raise ValueError('archive, model or base training evidence checksum mismatch')
    base = json.loads(args.base_training_report.read_text(encoding='utf8'))
    if (base.get('status') != 'candidate-pending-review' or base.get('modelSha256') != inputs['modelSha256'] or
        base.get('wordnetArchiveSha256') != WORDNET_SHA256):
        raise ValueError('base training evidence does not bind the frozen model and archive')
    encoder = FrozenWordNetEncoder(args.wordnet_zip, args.model, args.model_sha256)
    bundle = json.loads(args.bundle.read_text(encoding='utf8'))
    ids, records = [], []
    for word in bundle['words']:
        for sense in word['senses']:
            key = wordnet_key(word['word'], sense['pos'], sense.get('synsetId'))
            gloss = encoder.glosses.get((key[1], key[2])) if key and key in encoder.counts else None
            tag = (sense.get('synsetId') or '').rsplit('-', 1)[-1]
            if gloss and encoder.tags.get((key[1], key[2])) == tag and definition_matches(sense.get('definition'), gloss):
                ids.append(json.dumps([word['id'], sense['id']], ensure_ascii=False, separators=(',', ':')))
                records.append((word['word'], sense))
    if not ids or len(ids) != len(set(ids)):
        raise ValueError('empty or duplicate sense identities')
    vectors = encoder.encode(records)
    if any(file_sha256(path) != inputs[name] for name, path in input_paths.items()):
        raise RuntimeError('encoding inputs changed during generation')
    save_npz_new(args.vectors_out, ids=np.asarray(ids), vectors=vectors,
        method=np.asarray('wordnet-only-graph-context-lsa-v1'), modelSha256=np.asarray(args.model_sha256))
    report = {'status': 'candidate-pending-review', 'mode': 'frozen-encoding', **inputs,
        'vectorsSha256': file_sha256(args.vectors_out), 'matchedSenses': len(ids),
        'limitations': ['The prior model is frozen; source changes require separate review.',
                        'Matching and numeric encoding are not content or rights approval.']}
    with args.report_out.open('x', encoding='utf8', newline='\n') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
