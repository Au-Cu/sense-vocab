"""Build versioned public-map candidates from WordNet 3.0 and local BGE ONNX.

No network access, no edits to the vocabulary bundle and no user data.  Outputs
are candidate artifacts: their source/output rights must be reviewed before
distribution.  Full-word semantic scores are unavailable if ANY sense lacks
an independently matched vector; missing senses are never reweighted away.
"""

from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import math
import os
import re
import tempfile
import time
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")

import numpy as np
import onnxruntime as ort
import sklearn
import tokenizers
from sklearn.decomposition import PCA, TruncatedSVD
from sklearn.feature_extraction.text import HashingVectorizer
from tokenizers import Tokenizer

from universe_core import (damerau_osa, deletion_signatures, frequency_weights,
                           spelling_form, spelling_threshold, wordnet_key)

ROOT = Path(__file__).resolve().parent.parent
ALGORITHM = "word-universes-v1.0"
GRID = 8
MODEL_NAME = "BAAI/bge-small-en-v1.5"
MODEL_SOURCE = "Qdrant/bge-small-en-v1.5-onnx-Q"
MODEL_SNAPSHOT = "52398278842ec682c6f32300af41344b1c0b0bb2"
MAX_SHAPE_DEGREE = 20


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalized_text(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def definition_matches(a, b):
    a, b = normalized_text(a or ""), normalized_text(b or "")
    # A substring may omit a qualification or a negation.  Unreviewed
    # paraphrases are therefore unavailable rather than assumed equivalent.
    return bool(a and a == b)


def load_wordnet(path):
    counts, glosses, synset_tags = {}, {}, {}
    with zipfile.ZipFile(path) as archive:
        readme = archive.read("wordnet/README").decode("utf8", "replace")
        license_text = archive.read("wordnet/LICENSE").decode("utf8", "replace")
        if "WordNet 3.0" not in readme or "Princeton" not in license_text:
            raise ValueError("WordNet source is not verified as 3.0")
        for line in archive.open("wordnet/index.sense"):
            key, offset, _rank, count = line.decode("utf8").split()
            lemma, suffix = key.split("%")
            pos = {"1": "n", "2": "v", "3": "a", "4": "r", "5": "a"}[suffix[0]]
            identity = (lemma, offset, pos)
            if identity in counts:
                raise ValueError(f"Ambiguous lemma+offset+POS: {identity}")
            counts[identity] = int(count)
        for pos, name in [("n", "noun"), ("v", "verb"), ("a", "adj"), ("r", "adv")]:
            for raw in archive.open(f"wordnet/data.{name}"):
                line = raw.decode("utf8").strip()
                if line and line[0].isdigit() and " | " in line:
                    header, body = line.split(" | ", 1)
                    fields = header.split()
                    glosses[(fields[0], pos)] = body.split('; "')[0].strip()
                    synset_tags[(fields[0], pos)] = fields[2]
    return counts, glosses, synset_tags


def embed(texts, model_dir, batch_size):
    tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
    tokenizer.enable_truncation(max_length=128)
    tokenizer.enable_padding()
    options = ort.SessionOptions()
    options.intra_op_num_threads = min(os.cpu_count() or 1, 4)
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(model_dir / "model_optimized.onnx"), options,
                                   providers=["CPUExecutionProvider"])
    result = []
    started = time.perf_counter()
    for start in range(0, len(texts), batch_size):
        batch = tokenizer.encode_batch(texts[start:start + batch_size])
        inputs = {
            "input_ids": np.asarray([item.ids for item in batch], dtype=np.int64),
            "attention_mask": np.asarray([item.attention_mask for item in batch], dtype=np.int64),
            "token_type_ids": np.asarray([item.type_ids for item in batch], dtype=np.int64),
        }
        values = np.asarray(session.run(None, inputs)[0][:, 0, :], dtype=np.float32)
        lengths = np.linalg.norm(values, axis=1, keepdims=True)
        if not np.all(np.isfinite(values)) or np.any(lengths < 1e-12):
            raise ValueError("Model returned invalid or zero embeddings")
        result.append(values / lengths)
        if start % (batch_size * 20) == 0:
            print(f"embedding {min(start + batch_size, len(texts))}/{len(texts)}", flush=True)
    return np.vstack(result), time.perf_counter() - started


def cached_embeddings(texts, identities, model_dir, model_identity, cache_dir, batch_size):
    """Keep versioned, identifiable sense vectors outside browser artifacts.

    A damaged cache fails closed.  Inputs, order, model and inference versions
    are part of the key, and the file is atomically installed after validation.
    """
    if not texts or len(texts) != len(identities) or len(set(identities)) != len(identities):
        raise ValueError("each embedded sense must have a unique stable identity")
    identity = {"model": model_identity, "texts": texts, "senseIds": identities,
                "pooling": "cls-l2-maxlen128-v1", "batchSize": batch_size,
                "onnxruntime": ort.__version__, "tokenizers": tokenizers.__version__,
                "numpy": np.__version__, "intraThreads": min(os.cpu_count() or 1, 4)}
    cache_key = sha256_bytes(json.dumps(identity, ensure_ascii=False, sort_keys=True,
                                         separators=(",", ":")).encode("utf8"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / f"{cache_key}.npz"

    def validate(vectors):
        vectors = np.asarray(vectors)
        if (vectors.ndim != 2 or vectors.shape != (len(texts), 384) or
                not np.all(np.isfinite(vectors)) or
                not np.allclose(np.linalg.norm(vectors, axis=1), 1, rtol=1e-4, atol=1e-4)):
            raise ValueError("invalid sense-vector dimensions, values or norms")
        return vectors.astype(np.float32, copy=False)

    if path.exists():
        try:
            with np.load(path, allow_pickle=False) as cached:
                if str(cached["key"].item()) != cache_key or cached["ids"].tolist() != identities:
                    raise ValueError("sense-vector cache identities do not match")
                vectors = validate(cached["vectors"])
        except Exception as error:
            raise ValueError(f"sense-vector cache is damaged: {path}") from error
        return vectors, 0.0, {"key": cache_key, "sha256": sha256_file(path), "hit": True}

    vectors, seconds = embed(texts, model_dir, batch_size)
    vectors = validate(vectors)
    with tempfile.NamedTemporaryFile(dir=cache_dir, prefix="universe-", suffix=".tmp", delete=False) as stream:
        temporary_path = Path(stream.name)
        np.savez_compressed(stream, key=np.asarray(cache_key), ids=np.asarray(identities), vectors=vectors)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary_path, path)
    return vectors, seconds, {"key": cache_key, "sha256": sha256_file(path), "hit": False}


def tile(x, y):
    # Both semantic and spelling layouts use a fixed logical plane [-1500,1500].
    a = min(GRID - 1, max(0, int((x + 1500) / 3000 * GRID)))
    b = min(GRID - 1, max(0, int((y + 1500) / 3000 * GRID)))
    return f"{a}-{b}"


def fallback_position(word_id):
    digest = hashlib.sha256(word_id.encode("utf8")).digest()
    angle = int.from_bytes(digest[:4], "big") / 2**32 * math.tau
    radius = 1130 + int.from_bytes(digest[4:8], "big") / 2**32 * 190
    return [round(math.cos(angle) * radius, 3), round(math.sin(angle) * radius, 3)]


def fit_or_restore_layout(matrix, old, name, model_identity):
    prior = old.get(name) if old else None
    if prior:
        if prior.get("identity") != model_identity:
            raise ValueError(f"{name} layout model changed: use --rebuild-layout to explicitly regenerate")
        mean = np.asarray(prior["mean"], dtype=np.float64)
        components = np.asarray(prior["components"], dtype=np.float64)
        scale = float(prior["scale"])
        if components.shape != (2, matrix.shape[1]) or mean.shape != (matrix.shape[1],):
            raise ValueError(f"{name} layout basis is incompatible")
        coords = (matrix - mean) @ components.T * scale
        return coords, prior, "preserved-basis"
    estimator = PCA(n_components=2, svd_solver="randomized", random_state=431)
    coords = estimator.fit_transform(matrix)
    max_abs = float(np.max(np.abs(coords))) or 1.0
    scale = 940.0 / max_abs
    definition = {"identity": model_identity, "mean": estimator.mean_.tolist(),
                  "components": estimator.components_.tolist(), "scale": scale,
                  "explainedVarianceRatio": estimator.explained_variance_ratio_.tolist()}
    return coords * scale, definition, "new-basis"


def semantic_distortion(matrix, coords, basis, sample_size=30000):
    if len(matrix) < 2:
        return {"samplePairs": 0}
    rng = np.random.default_rng(1776)
    a = rng.integers(0, len(matrix), size=sample_size)
    b = rng.integers(0, len(matrix), size=sample_size)
    keep = a != b
    a, b = a[keep], b[keep]
    matrix = np.asarray(matrix, dtype=np.float64)
    projected = np.asarray(coords, dtype=np.float64) / basis["scale"]
    high_dist = np.linalg.norm(matrix[a] - matrix[b], axis=1)
    low_dist = np.linalg.norm(projected[a] - projected[b], axis=1)
    stress = np.sqrt(np.sum((high_dist - low_dist) ** 2) / max(1e-12, np.sum(high_dist ** 2)))
    mean = np.asarray(basis["mean"])
    components = np.asarray(basis["components"])
    mean_projection = components @ mean
    actual = np.einsum("ij,ij->i", matrix[a], matrix[b])
    approximate = (mean @ mean + projected[a] @ mean_projection + projected[b] @ mean_projection +
                   np.einsum("ij,ij->i", projected[a], projected[b]))
    return {"samplePairs": len(a), "seed": 1776, "relativeDistanceStress": round(float(stress), 5),
            "meanAbsoluteSimilarityError": round(float(np.mean(np.abs(actual - approximate))), 5),
            "similarityPearson": round(float(np.corrcoef(actual, approximate)[0, 1]), 5),
            "similarityVsNegativeMapDistancePearson": round(float(np.corrcoef(actual, -low_dist)[0, 1]), 5)}


def connectivity(node_ids, edges):
    parent = {node_id: node_id for node_id in node_ids}

    def find(node_id):
        while parent[node_id] != node_id:
            parent[node_id] = parent[parent[node_id]]
            node_id = parent[node_id]
        return node_id

    for a, b in edges:
        x, y = find(a), find(b)
        if x != y:
            parent[x] = y
    sizes = Counter(find(node_id) for node_id in parent)
    return {"components": len(sizes), "largestComponentWords": max(sizes.values(), default=0),
            "isolatedWords": sum(size == 1 for size in sizes.values())}


def spelling_edges(nodes):
    inverted = defaultdict(list)
    forms = {}
    for node in nodes:
        form = spelling_form(node["word"])
        if not form or len(form) < 3 or len(form) > 24:
            continue
        forms[node["id"]] = form
        for signature in deletion_signatures(form):
            if len(signature) >= 2:
                inverted[signature].append(node["id"])
    candidates = set()
    for ids in inverted.values():
        if len(ids) < 2:
            continue
        for a, b in itertools.combinations(ids, 2):
            if abs(len(forms[a]) - len(forms[b])) <= 2:
                candidates.add(tuple(sorted((a, b))))
    matches = []
    for a, b in sorted(candidates):
        x, y = forms[a], forms[b]
        if x == y:
            continue
        d = damerau_osa(x, y)
        if 0 < d <= spelling_threshold(x, y):
            matches.append((d, a, b))
    # Symmetric, deterministic bounded detail: prevents a single crowded word
    # from overwhelming mobile devices.  The report states all pruning.
    matches.sort()
    degrees = Counter()
    kept = []
    for distance, a, b in matches:
        if degrees[a] >= MAX_SHAPE_DEGREE or degrees[b] >= MAX_SHAPE_DEGREE:
            continue
        kept.append((distance, a, b))
        degrees[a] += 1
        degrees[b] += 1
    return forms, kept, {"candidatePairs": len(candidates), "matchingPairs": len(matches),
                         "retainedPairs": len(kept), "prunedPairs": len(matches) - len(kept),
                         "maxDegree": MAX_SHAPE_DEGREE}


def json_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(content + "\n", encoding="utf8", newline="\n")
    os.replace(temp, path)


def install_immutable_version(staged, target):
    """Install a complete version atomically, never rewrite an existing map."""
    if not target.exists():
        os.replace(staged, target)
        return
    if not target.is_dir():
        raise ValueError(f"version path is not a directory: {target}")
    staged_files = {p.relative_to(staged).as_posix(): p for p in staged.rglob("*") if p.is_file()}
    existing_files = {p.relative_to(target).as_posix(): p for p in target.rglob("*") if p.is_file()}
    if set(staged_files) != set(existing_files):
        raise ValueError(f"existing immutable version has different files: {target}")
    for name, path in staged_files.items():
        if name == "report.json":
            # Runtime observations differ per invocation, but the first
            # version report and all of its input identities remain intact.
            old = json.loads(existing_files[name].read_text(encoding="utf8"))
            new = json.loads(path.read_text(encoding="utf8"))
            if old.get("inputs") != new.get("inputs"):
                raise ValueError(f"existing version report inputs changed: {target}")
        elif sha256_file(path) != sha256_file(existing_files[name]):
            raise ValueError(f"existing immutable artifact differs: {name}")
    # The staged path was created exclusively by this run under the output
    # directory. Remove only its verified generated files and empty folders.
    for path in staged_files.values():
        path.unlink()
    for directory in sorted((p for p in staged.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
        directory.rmdir()
    staged.rmdir()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", type=Path, default=ROOT / "data/vocabulary-bundle.json")
    parser.add_argument("--wordnet-zip", type=Path, required=True)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "data/universes")
    parser.add_argument("--vector-cache", type=Path, default=ROOT / ".op-cache/universe-vectors")
    parser.add_argument("--batch-size", type=int, default=48)
    parser.add_argument("--rebuild-layout", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 256:
        parser.error("batch size must be between 1 and 256")
    started = time.perf_counter()
    bundle = json.loads(args.bundle.read_text(encoding="utf8"))
    counts, glosses, synset_tags = load_wordnet(args.wordnet_zip)
    model_files = {name: sha256_file(args.model_dir / name) for name in
                   ["model_optimized.onnx", "tokenizer.json", "tokenizer_config.json", "config.json"]}
    model_identity = sha256_bytes(json.dumps(model_files, sort_keys=True).encode("utf8"))
    inputs = {"bundleSha256": sha256_file(args.bundle), "wordnetArchiveSha256": sha256_file(args.wordnet_zip),
              "wordnetIndexSha256": None, "modelFiles": model_files, "modelIdentity": model_identity,
              "generatorSha256": sha256_file(Path(__file__)), "coreSha256": sha256_file(ROOT / "tools/universe_core.py"),
              "algorithm": ALGORITHM, "embeddingBatchSize": args.batch_size,
              "runtime": {"numpy": np.__version__, "onnxruntime": ort.__version__,
                          "tokenizers": tokenizers.__version__, "scikitLearn": sklearn.__version__}}
    with zipfile.ZipFile(args.wordnet_zip) as archive:
        inputs["wordnetIndexSha256"] = sha256_bytes(archive.read("wordnet/index.sense"))
        license_bytes = archive.read("wordnet/LICENSE")
        inputs["wordnetLicenseSha256"] = sha256_bytes(license_bytes)
    previous_path = args.out / "layout.json"
    previous = json.loads(previous_path.read_text(encoding="utf8")) if previous_path.exists() and not args.rebuild_layout else None
    nodes, texts, identities, groups = [], [], [], defaultdict(list)
    quality, frequency = Counter(), Counter()
    for word in bundle["words"]:
        senses, tag_counts = [], []
        for sense in word["senses"]:
            key = wordnet_key(word["word"], sense["pos"], sense.get("synsetId"))
            raw_count = counts.get(key) if key else None
            glossary = glosses.get((key[1], key[2])) if key else None
            expected_tag = (sense.get("synsetId") or "").rsplit("-", 1)[-1]
            actual_tag = synset_tags.get((key[1], key[2])) if key else None
            valid = bool(raw_count is not None and glossary and expected_tag == actual_tag and
                         definition_matches(sense.get("definition"), glossary))
            count = raw_count if valid else None
            tag_counts.append(count)
            freq_type = "missing" if count is None else ("observed-zero" if count == 0 else "observed-positive")
            frequency[freq_type] += 1
            if valid:
                vector_index = len(texts)
                texts.append(f"{word['word']} | {sense['pos']} | {glossary}")
                identities.append(json.dumps([word["id"], sense["id"]], ensure_ascii=False, separators=(",", ":")))
                groups[(key[1], actual_tag)].append((word["id"], sense["id"], vector_index))
                quality["semanticSenseMatched"] += 1
            else:
                vector_index = None
                quality["semanticSenseUnavailable"] += 1
            senses.append({"id": sense["id"], "pos": sense["pos"], "synsetId": sense.get("synsetId"), "tagCount": count,
                           "frequency": freq_type, "verified": valid, "vectorIndex": vector_index})
        weights = frequency_weights(tag_counts)
        for item, weight in zip(senses, weights):
            item["weight"] = weight
        nodes.append({"id": word["id"], "word": word["word"], "senses": senses})
    print(f"WordNet-matched senses: {len(texts)} / {sum(len(w['senses']) for w in bundle['words'])}", flush=True)
    vectors, embed_seconds, vector_cache = cached_embeddings(
        texts, identities, args.model_dir, model_identity, args.vector_cache, args.batch_size)
    # The cache uses compact float32 storage; normalize again in float64 so
    # every dot product below is a cosine, not merely approximately unit length.
    vectors = np.asarray(vectors, dtype=np.float64)
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    complete_indices, word_vectors = [], []
    for i, node in enumerate(nodes):
        slots = [sense["vectorIndex"] for sense in node["senses"]]
        complete = bool(slots and all(slot is not None for slot in slots))
        node["complete"] = complete
        if complete:
            # Do not L2-normalize this aggregate.  Its dot product is exactly
            # the user-specified double sum over unit sense-vector cosines.
            weights = np.asarray([sense["weight"] for sense in node["senses"]], dtype=np.float64)
            weights /= weights.sum()  # Correct floating-point summation, not missingness.
            word_vectors.append(weights @ vectors[slots])
            complete_indices.append(i)
    word_vectors = np.asarray(word_vectors)
    coords, semantic_basis, semantic_layout_mode = fit_or_restore_layout(word_vectors, previous, "semantic", model_identity)
    for i, xy in zip(complete_indices, coords):
        nodes[i]["semantic"] = [round(float(x), 3) for x in xy]
    for node in nodes:
        if not node["complete"]:
            node["semantic"] = fallback_position(node["id"])
    quality["completeWordVectors"] = len(complete_indices)
    quality["incompleteWordVectors"] = len(nodes) - len(complete_indices)
    distortion = semantic_distortion(word_vectors, coords, semantic_basis)
    print("Semantic coordinates and distortion computed", flush=True)

    shape_model = HashingVectorizer(analyzer="char", ngram_range=(2, 4), n_features=512,
                                    alternate_sign=False, norm="l2")
    shape_vectors = shape_model.transform([node["word"].lower() for node in nodes]).toarray().astype(np.float32)
    shape_coords, shape_basis, shape_layout_mode = fit_or_restore_layout(shape_vectors, previous, "spelling", "char-2-4-hash512-v1")
    for node, xy in zip(nodes, shape_coords):
        node["spelling"] = [round(float(x), 3) for x in xy]
    print("Computing spelling candidates", flush=True)
    forms, shape_edges, shape_metrics = spelling_edges(nodes)
    semantic_edges = []
    for (offset, pos), members in sorted(groups.items()):
        for (a, sa, ia), (b, sb, ib) in itertools.combinations(members, 2):
            if a == b:
                continue
            score = float(vectors[ia] @ vectors[ib])
            semantic_edges.append((a, sa, b, sb, f"omw-en-{offset}-{pos}", round(score, 5)))

    layout = {"schema": 1, "semantic": semantic_basis, "spelling": shape_basis}
    inputs["layoutBasisSha256"] = sha256_bytes(json.dumps(layout, sort_keys=True, separators=(",", ":")).encode("utf8"))
    inputs["vectorCacheKey"] = vector_cache["key"]
    version_hash = sha256_bytes(json.dumps(inputs, sort_keys=True).encode("utf8"))[:16]
    args.out.mkdir(parents=True, exist_ok=True)
    staging_root = Path(tempfile.mkdtemp(prefix=".stage-", dir=args.out))
    version_dir = staging_root / "payload"
    version_dir.mkdir()
    (version_dir / "WORDNET-3.0-LICENSE.txt").write_bytes(license_bytes)
    adjacency = {"synonym": defaultdict(list), "spelling": defaultdict(list)}
    for a, sa, b, sb, synset, score in semantic_edges:
        adjacency["synonym"][a].append({"to": b, "sourceSense": sa, "targetSense": sb,
                                         "synset": synset, "cosine": score})
        adjacency["synonym"][b].append({"to": a, "sourceSense": sb, "targetSense": sa,
                                         "synset": synset, "cosine": score})
    for distance, a, b in shape_edges:
        adjacency["spelling"][a].append({"to": b, "distance": distance})
        adjacency["spelling"][b].append({"to": a, "distance": distance})
    region_payloads = {"synonym": defaultdict(dict), "spelling": defaultdict(dict)}
    for node in nodes:
        node["semanticTile"] = tile(*node["semantic"])
        node["spellingTile"] = tile(*node["spelling"])
        node["spellingSupported"] = node["id"] in forms
        for sense in node["senses"]:
            del sense["vectorIndex"]
        for kind, tile_key in [("synonym", "semanticTile"), ("spelling", "spellingTile")]:
            region_payloads[kind][node[tile_key]][node["id"]] = sorted(
                adjacency[kind].get(node["id"], []), key=lambda edge: (edge["to"], edge.get("sourceSense", "")))
    for kind, tiles in region_payloads.items():
        for key, payload in tiles.items():
            json_write(version_dir / kind / f"{key}.json", {"schema": 1, "version": version_hash,
                                                            "kind": kind, "tile": key, "adjacency": payload})
    json_write(version_dir / "index.json", {"schema": 1, "version": version_hash,
                                             "bundleSha256": inputs["bundleSha256"], "nodes": nodes})
    linked = {value for a, _, b, _, _, _ in semantic_edges for value in (a, b)}
    connectivity_report = {
        "synonym": connectivity((node["id"] for node in nodes), ((a, b) for a, _, b, _, _, _ in semantic_edges)),
        "spelling": connectivity((node["id"] for node in nodes), ((a, b) for _, a, b in shape_edges)),
    }
    output_bytes = sum(path.stat().st_size for path in version_dir.rglob("*.json"))
    report = {"schema": 1, "version": version_hash, "algorithm": ALGORITHM,
              "inputs": inputs, "model": {"name": MODEL_NAME, "source": MODEL_SOURCE,
                 "snapshot": MODEL_SNAPSHOT, "architectureLicense": "MIT declared by upstream model",
                 "weightsLicense": "pinned transformed snapshot README declares Apache-2.0; current card declares MIT; release scope requires review",
                 "pinnedCardEvidence": "https://huggingface.co/Qdrant/bge-small-en-v1.5-onnx-Q/commit/52398278842ec682c6f32300af41344b1c0b0bb2",
                 "trainingData": "not fully verified", "input": "WordNet 3.0 lemma, POS and matching English gloss",
                 "outputRights": "not yet cleared for publication", "pooling": "CLS, unit L2",
                 "metric": "sense cosine; S is the dot product of non-normalized frequency-weighted means"},
              "frequency": {"source": "WordNet 3.0 index.sense tag_cnt (semantic concordance)",
                 "policy": "matched tag count + 1; missing uses mean matched count + 1; all missing equal; zero means no tagged examples, not universal non-use",
                 "counts": dict(frequency)},
              "quality": {**dict(quality), "nodeCount": len(nodes), "synonymSensePairs": len(semantic_edges),
                 "synonymLinkedWords": len(linked), "spellingSupportedWords": len(forms),
                 "spelling": shape_metrics, "connectivity": connectivity_report},
              "layout": {"semantic": semantic_layout_mode, "spelling": shape_layout_mode,
                         "semanticDistortion": distortion, "note": "2D projection is approximate; proximity does not imply an edge."},
              "resources": {"jsonBytes": output_bytes, "tiles": {kind: len(regions) for kind, regions in region_payloads.items()},
                            "localSenseVectorCache": vector_cache},
              "timing": {"embeddingSeconds": round(embed_seconds, 3), "totalSeconds": round(time.perf_counter() - started, 3)},
              "distribution": "blocked-until-source-model-input-output-and-field-rights-reviewed"}
    json_write(version_dir / "report.json", report)
    final_dir = args.out / version_hash
    install_immutable_version(version_dir, final_dir)
    staging_root.rmdir()
    # Write the mutable basis and manifest only after the immutable version is
    # safely in place; a failed generation leaves the last manifest usable.
    json_write(args.out / "layout.json", layout)
    files = [{"path": p.relative_to(final_dir).as_posix(), "sha256": sha256_file(p), "bytes": p.stat().st_size}
             for p in sorted((p for p in final_dir.rglob("*") if p.is_file()), key=lambda p: p.relative_to(final_dir).as_posix())]
    json_write(args.out / "manifest.json", {"schema": 1, "version": version_hash,
                                            "index": f"./{version_hash}/index.json", "report": f"./{version_hash}/report.json",
                                            "bundleSha256": inputs["bundleSha256"],
                                            "distribution": report["distribution"], "files": files})
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
