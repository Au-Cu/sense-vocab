"""Read-only verification of a locally generated candidate graph and its vectors.

This is a structural and numerical check, not legal clearance or a substitute
for contextual review of a particular synonym relation.
"""
from __future__ import annotations

import argparse
import json
import math
import random
from collections import Counter
from pathlib import Path

import numpy as np

from build_word_universes import ROOT, connectivity, definition_matches, load_wordnet, sha256_file, tile
from universe_core import damerau_osa, frequency_weights, spelling_form, spelling_threshold, wordnet_key


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    return json.loads(path.read_text(encoding="utf8"))


def verify(root, bundle_path, cache_dir, wordnet_path=None):
    manifest = read_json(root / "manifest.json")
    version = manifest["version"]
    require(len(version) == 16 and all(c in "0123456789abcdef" for c in version), "invalid version")
    version_dir = root / version
    bundle_hash = sha256_file(bundle_path)
    require(manifest["bundleSha256"] == bundle_hash, "bundle hash mismatch")
    files = manifest.get("files")
    require(isinstance(files, list) and files, "missing artifact manifest")
    seen_files = set()
    for item in files:
        relative = Path(item["path"])
        require(not relative.is_absolute() and ".." not in relative.parts, "unsafe artifact path")
        require(item["path"] not in seen_files, "duplicate artifact")
        seen_files.add(item["path"])
        artifact = version_dir / relative
        require(artifact.is_file() and artifact.stat().st_size == item["bytes"] and sha256_file(artifact) == item["sha256"],
                f"artifact checksum mismatch: {relative}")
    require({"index.json", "report.json", "WORDNET-3.0-LICENSE.txt"} <= seen_files, "missing required artifacts")
    index, report, bundle = read_json(version_dir / "index.json"), read_json(version_dir / "report.json"), read_json(bundle_path)
    require(index["version"] == report["version"] == version and index["bundleSha256"] == bundle_hash, "version mismatch")
    require(report["inputs"]["bundleSha256"] == bundle_hash, "report bundle mismatch")
    require(report["inputs"]["generatorSha256"] == sha256_file(ROOT / "tools/build_word_universes.py") and
            report["inputs"]["coreSha256"] == sha256_file(ROOT / "tools/universe_core.py"), "generator input changed")
    if wordnet_path:
        require(sha256_file(wordnet_path) == report["inputs"]["wordnetArchiveSha256"], "WordNet archive mismatch")
        wn_counts, wn_glosses, wn_tags = load_wordnet(wordnet_path)
    nodes = {node["id"]: node for node in index["nodes"]}
    words = {word["id"]: word for word in bundle["words"]}
    require(len(nodes) == len(index["nodes"]) and set(nodes) == set(words), "word IDs do not match bundle")

    cache = report["resources"]["localSenseVectorCache"]
    cache_path = cache_dir / f'{cache["key"]}.npz'
    require(sha256_file(cache_path) == cache["sha256"], "sense-vector cache hash mismatch")
    with np.load(cache_path, allow_pickle=False) as data:
        require(str(data["key"].item()) == cache["key"], "sense-vector cache identity mismatch")
        identities = [tuple(json.loads(value)) for value in data["ids"].tolist()]
        vectors = np.asarray(data["vectors"], dtype=np.float64)
    vector_index = {identity: i for i, identity in enumerate(identities)}
    require(len(vector_index) == len(identities) == vectors.shape[0] and vectors.shape[1] == 384, "invalid vector identities")
    require(np.all(np.isfinite(vectors)) and np.allclose(np.linalg.norm(vectors, axis=1), 1, atol=1e-4), "invalid vectors")
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    frequency, quality = Counter(), Counter()
    senses = {}
    complete = []
    for word_id, node in nodes.items():
        word = words[word_id]
        require(node["word"] == word["word"], f"word spelling mismatch: {word_id}")
        original = {sense["id"]: sense for sense in word["senses"]}
        require(len(original) == len(word["senses"]) and set(original) == {sense["id"] for sense in node["senses"]}, f"sense IDs mismatch: {word_id}")
        expected_weights = frequency_weights([sense["tagCount"] for sense in node["senses"]])
        for sense, expected in zip(node["senses"], expected_weights):
            key = (word_id, sense["id"])
            source = original[sense["id"]]
            require(sense["pos"] == source["pos"] and sense["synsetId"] == source.get("synsetId"), f"sense identity mismatch: {key}")
            require(math.isclose(sense["weight"], expected, abs_tol=1e-12), f"invalid frequency weight: {key}")
            require(sense["verified"] == (key in vector_index), f"vector binding mismatch: {key}")
            tag = sense["tagCount"]
            if wordnet_path:
                wn_key = wordnet_key(word["word"], source["pos"], source.get("synsetId"))
                count = wn_counts.get(wn_key) if wn_key else None
                wn_id = (wn_key[1], wn_key[2]) if wn_key else None
                expected_tag = (source.get("synsetId") or "").rsplit("-", 1)[-1]
                verified = bool(count is not None and wn_id and wn_tags.get(wn_id) == expected_tag and
                                definition_matches(source.get("definition"), wn_glosses.get(wn_id)))
                require(sense["verified"] == verified and tag == (count if verified else None), f"WordNet binding mismatch: {key}")
            expected_frequency = "missing" if tag is None else "observed-zero" if tag == 0 else "observed-positive"
            require(sense["frequency"] == expected_frequency and (sense["verified"] or tag is None), f"frequency mismatch: {key}")
            frequency[expected_frequency] += 1
            quality["semanticSenseMatched" if sense["verified"] else "semanticSenseUnavailable"] += 1
            senses[key] = sense
        is_complete = bool(node["senses"]) and all(s["verified"] for s in node["senses"])
        require(node["complete"] == is_complete, f"completeness mismatch: {word_id}")
        if is_complete:
            complete.append(node)
        for coordinate, tile_name in [("semantic", "semanticTile"), ("spelling", "spellingTile")]:
            xy = node[coordinate]
            require(len(xy) == 2 and all(math.isfinite(value) for value in xy) and node[tile_name] == tile(*xy), f"invalid spatial index: {word_id}")
    require(dict(frequency) == report["frequency"]["counts"], "frequency counts differ from report")
    require(len(complete) == report["quality"]["completeWordVectors"], "complete count differs")

    adjacency = {"synonym": {}, "spelling": {}}
    for kind in adjacency:
        for filename in (version_dir / kind).glob("*.json"):
            shard = read_json(filename)
            require(shard["version"] == version and shard["kind"] == kind and shard["tile"] == filename.stem, "invalid shard")
            for word_id, links in shard["adjacency"].items():
                require(word_id in nodes and word_id not in adjacency[kind], f"duplicate or unknown node in {kind}")
                expected_tile = nodes[word_id]["semanticTile" if kind == "synonym" else "spellingTile"]
                require(expected_tile == shard["tile"] and isinstance(links, list), f"incorrect shard for {word_id}")
                adjacency[kind][word_id] = links
        require(set(adjacency[kind]) == set(nodes), f"missing adjacency nodes in {kind}")

    pairs = Counter()
    linked = set()
    for source_id, links in adjacency["synonym"].items():
        seen = set()
        for edge in links:
            target_id = edge["to"]
            source_key, target_key = (source_id, edge["sourceSense"]), (target_id, edge["targetSense"])
            require(target_id in nodes and source_id != target_id and source_key in senses and target_key in senses, "invalid synonym endpoint")
            a, b = senses[source_key], senses[target_key]
            require(a["verified"] and b["verified"] and a["pos"] == b["pos"] and
                    a["synsetId"] == b["synsetId"] == edge["synset"], "synonym evidence mismatch")
            key = (target_id, edge["sourceSense"], edge["targetSense"], edge["synset"])
            require(key not in seen, "duplicate synonym edge")
            seen.add(key)
            expected = float(vectors[vector_index[source_key]] @ vectors[vector_index[target_key]])
            require(math.isclose(edge["cosine"], expected, abs_tol=6e-6), "sense cosine mismatch")
            reverse = {"to": source_id, "sourceSense": edge["targetSense"], "targetSense": edge["sourceSense"],
                       "synset": edge["synset"], "cosine": edge["cosine"]}
            require(reverse in adjacency["synonym"][target_id], "missing reverse synonym edge")
            linked.update((source_id, target_id)); pairs["synonymDirected"] += 1

    for source_id, links in adjacency["spelling"].items():
        require(len(links) <= 20, "spelling degree exceeded")
        seen = set()
        for edge in links:
            target_id = edge["to"]
            require(target_id in nodes and source_id != target_id and target_id not in seen, "invalid spelling endpoint")
            seen.add(target_id)
            a, b = spelling_form(nodes[source_id]["word"]), spelling_form(nodes[target_id]["word"])
            require(a and b and damerau_osa(a, b) == edge["distance"] and 0 < edge["distance"] <= spelling_threshold(a, b), "spelling score mismatch")
            require({"to": source_id, "distance": edge["distance"]} in adjacency["spelling"][target_id], "missing reverse spelling edge")
            pairs["spellingDirected"] += 1
    require(pairs["synonymDirected"] == 2 * report["quality"]["synonymSensePairs"] and len(linked) == report["quality"]["synonymLinkedWords"], "synonym counts differ")
    require(pairs["spellingDirected"] == 2 * report["quality"]["spelling"]["retainedPairs"], "spelling counts differ")
    for kind in adjacency:
        computed = connectivity(nodes, ((source, edge["to"]) for source, links in adjacency[kind].items() for edge in links))
        require(computed == report["quality"]["connectivity"][kind], f"{kind} connectivity counts differ")
    require(senses[("bank", "n-1")]["synsetId"] != senses[("bank", "n-2")]["synsetId"], "bank senses conflated")
    require(not any(edge["to"] == "shore" for edge in adjacency["synonym"]["bank"]), "bank-shore relation lacks matching synset")

    rng = random.Random(1776)
    max_error = 0.0
    for _ in range(min(250, len(complete) ** 2)):
        a, b = rng.choice(complete), rng.choice(complete)
        av = np.asarray([vectors[vector_index[(a["id"], sense["id"])]] for sense in a["senses"]])
        bv = np.asarray([vectors[vector_index[(b["id"], sense["id"])]] for sense in b["senses"]])
        pa, pb = np.asarray([s["weight"] for s in a["senses"]]), np.asarray([s["weight"] for s in b["senses"]])
        direct = sum(pa[i] * pb[j] * float(av[i] @ bv[j]) for i in range(len(pa)) for j in range(len(pb)))
        optimized = float((pa @ av) @ (pb @ bv))
        max_error = max(max_error, abs(direct - optimized))
    require(max_error < 1e-12, "weighted score identity failed")
    return {"version": version, "words": len(nodes), "senses": len(senses), "frequency": dict(frequency),
            "semanticSensePairs": pairs["synonymDirected"] // 2, "synonymLinkedWords": len(linked),
            "spellingPairs": pairs["spellingDirected"] // 2, "completeWordVectors": len(complete),
            "connectivity": report["quality"]["connectivity"],
            "maxSampledWeightedFormulaError": max_error, "artifactFiles": len(files),
            "wordnetSourceVerified": bool(wordnet_path), "distribution": manifest.get("distribution"), "legalClearance": "not evaluated"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT / "data/universes")
    parser.add_argument("--bundle", type=Path, default=ROOT / "data/vocabulary-bundle.json")
    parser.add_argument("--vector-cache", type=Path, default=ROOT / ".op-cache/universe-vectors")
    parser.add_argument("--wordnet-zip", type=Path, help="original WordNet 3.0 archive for source binding verification")
    args = parser.parse_args()
    print(json.dumps(verify(args.root, args.bundle, args.vector_cache, args.wordnet_zip), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
