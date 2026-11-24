"""Independently check a local derivation candidate against the pinned corpus.

This read-only audit checks provenance and structural completeness. It is not
an individual semantic review, a license grant, or a release authorization.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from functools import lru_cache
from pathlib import Path

from nltk.corpus.reader.wordnet import WordNetCorpusReader
from nltk.data import ZipFilePathPointer

ROOT = Path(__file__).resolve().parent.parent
WORDNET_SHA256 = "cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59"
POS = {"n": "n.", "v": "v.", "a": "adj.", "s": "adj.", "r": "adv."}


def digest(value):
    return hashlib.sha256(value).hexdigest()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf8")


def read_json(path):
    return json.loads(path.read_bytes())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--wordnet-zip", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    args = parser.parse_args()
    candidate = args.candidate.resolve()
    manifest = read_json(candidate / "manifest.json")
    summary = read_json(candidate / "summary.json")
    require(digest(args.wordnet_zip.read_bytes()) == WORDNET_SHA256, "source archive mismatch")
    require(manifest["source"]["archiveSha256"] == WORDNET_SHA256, "manifest source mismatch")
    require(digest((ROOT / "data/vocabulary-bundle.json").read_bytes()) == manifest["bundleSha256"], "bundle mismatch")
    universe_manifest = read_json(ROOT / "data/universes/manifest.json")
    require(universe_manifest["version"] == manifest["baseUniverseVersion"], "base universe mismatch")
    index_bytes = (ROOT / "data/universes" / universe_manifest["version"] / "index.json").read_bytes()
    require(digest(index_bytes) == manifest["source"]["baseIndexSha256"], "base index mismatch")
    require(digest((ROOT / "tools/build_wordnet_derivations.py").read_bytes()) == manifest["source"]["generatorSha256"], "generator mismatch")
    nodes = json.loads(index_bytes)["nodes"]
    by_id = {node["id"]: node for node in nodes}
    by_name = {node["word"].replace("_", " ").casefold(): node for node in nodes}
    require(len(by_id) == len(by_name) == len(nodes), "duplicate vocabulary identity")

    version_dir = candidate / manifest["version"]
    files = sorted(manifest["files"], key=lambda item: item["path"])
    require(digest(encoded(files)) == manifest["artifactListSha256"] == summary["artifactListSha256"], "file list mismatch")
    for item in files:
        relative = Path(item["path"])
        require(not relative.is_absolute() and ".." not in relative.parts, "unsafe file path")
        data = (version_dir / relative).read_bytes()
        require(len(data) == item["bytes"] and digest(data) == item["sha256"], "candidate file mismatch")
    graph = read_json(version_dir / "index.json")
    require(graph["version"] == manifest["version"] and set(graph["counts"]) == set(by_id), "graph identity mismatch")
    wn = WordNetCorpusReader(ZipFilePathPointer(str(args.wordnet_zip.resolve()), "wordnet/"), None)

    @lru_cache(maxsize=None)
    def lemma_for(key):
        lemma = wn.lemma_from_key(key)
        require(lemma.key() == key, "corpus sense key mismatch")
        return lemma

    @lru_cache(maxsize=None)
    def related_keys(key):
        return frozenset(item.key() for item in lemma_for(key).derivationally_related_forms())

    def endpoint(lemma):
        word = lemma.name().replace("_", " ")
        synset = lemma.synset()
        synset_id = f"omw-en-{synset.offset():08d}-{synset.pos()}"
        node = by_name.get(word.casefold())
        matches = [sense for sense in (node or {}).get("senses", [])
                   if sense.get("verified") and sense.get("synsetId") == synset_id]
        require(len(matches) <= 1, "ambiguous sense identity")
        if node and not matches and node["word"] != word:
            node = None
        return (node, matches[0]["id"] if matches else None, synset_id, POS[synset.pos()], node["word"] if node else word)

    entries, seen_ids = {}, set()
    for item in files:
        if not item["path"].startswith("derivation/"):
            continue
        shard = read_json(version_dir / item["path"])
        require(shard["schema"] == 1 and shard["version"] == manifest["version"] and shard["kind"] == "derivation", "shard metadata mismatch")
        tile = Path(item["path"]).stem
        require(shard["tile"] == tile, "shard tile mismatch")
        for word_id, edges in shard["adjacency"].items():
            require(word_id in by_id and by_id[word_id]["spellingTile"] == tile and word_id not in entries, "shard word identity mismatch")
            entries[word_id] = edges
    require(set(entries) == set(by_id), "missing or extra graph words")

    stats, external = Counter(), set()
    edge_lookup = {}
    for word_id, edges in entries.items():
        if edges:
            stats["wordsWithRelations"] += 1
        neighbors = set()
        for edge in edges:
            source, target = lemma_for(edge["sourceKey"]), lemma_for(edge["targetKey"])
            require(edge["targetKey"] in related_keys(edge["sourceKey"]), "edge absent from WordNet")
            source_node, source_sense, source_synset, source_pos, _ = endpoint(source)
            target_node, target_sense, target_synset, target_pos, target_word = endpoint(target)
            require(source_node is not None and source_node["id"] == word_id, "source word mismatch")
            require((edge["sourceSense"], edge["sourceSynset"], edge["sourcePos"]) == (source_sense, source_synset, source_pos), "source sense mismatch")
            require((edge["to"], edge["targetSense"], edge["targetSynset"], edge["targetPos"], edge["word"]) ==
                    (target_node["id"] if target_node else None, target_sense, target_synset, target_pos, target_word), "target identity mismatch")
            expected_id = "wn-deriv-" + digest((edge["sourceKey"] + "\0" + edge["targetKey"]).encode("utf8"))[:24]
            require(edge["id"] == expected_id and expected_id not in seen_ids, "duplicate or incorrect edge identity")
            seen_ids.add(expected_id)
            edge_lookup[(word_id, expected_id)] = edge
            stats["relations"] += 1
            if edge["to"] is None:
                stats["externalRelations"] += 1
                external.add(edge["word"].casefold())
            elif edge["to"] == word_id:
                stats["sameWordRelations"] += 1
            else:
                stats["vocabularyRelations"] += 1
                neighbors.add(edge["to"])
            if edge["sourceSense"] is None or (edge["to"] and edge["targetSense"] is None):
                stats["unmatchedVocabularySenseRelations"] += 1
        require(graph["counts"][word_id] == len(neighbors), "neighbor count mismatch")
    stats["uniqueExternalWords"] = len(external)

    # Check no direct relation of a verified source sense was silently omitted.
    expected = set()
    for node in nodes:
        for sense in node["senses"]:
            if not sense.get("verified") or not sense.get("synsetId"):
                continue
            parts = sense["synsetId"].split("-")
            synset = wn.synset_from_pos_and_offset(parts[-1], int(parts[-2]))
            choices = [item for item in synset.lemmas() if item.name().replace("_", " ").casefold() == node["word"].casefold()]
            exact = [item for item in choices if item.name().replace("_", " ") == node["word"]]
            if len(exact) == 1:
                choices = exact
            require(len(choices) == 1, "verified source lemma ambiguous")
            source = choices[0]
            require(endpoint(source)[:2] == (node, sense["id"]), "verified source binding mismatch")
            stats["verifiedSourceSenses"] += 1
            for target_key in related_keys(source.key()):
                if target_key == source.key():
                    continue
                pair_id = "wn-deriv-" + digest((source.key() + "\0" + target_key).encode("utf8"))[:24]
                expected.add((node["id"], pair_id))
                target_node = endpoint(lemma_for(target_key))[0]
                if target_node and source.key() in related_keys(target_key):
                    reverse_id = "wn-deriv-" + digest((target_key + "\0" + source.key()).encode("utf8"))[:24]
                    expected.add((target_node["id"], reverse_id))
    require(expected == set(edge_lookup), "missing or extra corpus-derived relations")
    require(dict(stats) == summary["statistics"], "statistics mismatch")

    trace_path = candidate / "trace.jsonl"
    require(digest(trace_path.read_bytes()) == summary["traceSha256"], "trace hash mismatch")
    trace_ids = set()
    with trace_path.open(encoding="utf8") as source:
        for line in source:
            row = json.loads(line)
            key = (row["wordId"], row["assetId"])
            require(key in edge_lookup and key not in trace_ids, "trace identity mismatch")
            edge = edge_lookup[key]
            require(row["reviewStatus"] == "pending" and row["oldValueSha256"] is None and
                    row["wordnetArchiveSha256"] == WORDNET_SHA256 and
                    row["sourceKey"] == edge["sourceKey"] and row["targetKey"] == edge["targetKey"] and
                    row["targetWordId"] == edge["to"] and row["sourceSenseId"] == edge["sourceSense"] and
                    row["targetSenseId"] == edge["targetSense"], "trace source mismatch")
            require(row["fields"] == {name: {"newValueSha256": digest(encoded(value))} for name, value in sorted(edge.items())}, "trace field hash mismatch")
            trace_ids.add(key)
    require(trace_ids == set(edge_lookup), "trace incomplete")
    print(json.dumps({"status": "passed", "version": manifest["version"], "wordCount": len(nodes),
                      "statistics": dict(stats), "artifactListSha256": manifest["artifactListSha256"],
                      "traceSha256": summary["traceSha256"], "humanReview": "not performed"}, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
