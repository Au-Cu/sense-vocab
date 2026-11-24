"""Build a review-only derivational graph from pinned WordNet lexical pointers.

The generator never changes the vocabulary or user state.  Each displayed
relationship is a direct WordNet lemma pointer, with both original sense keys;
unknown vocabulary senses and words outside the pool stay explicitly unknown.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from nltk.corpus.reader.wordnet import WordNetCorpusReader
from nltk.data import ZipFilePathPointer

ROOT = Path(__file__).resolve().parent.parent
WORDNET_SHA256 = "cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59"
LICENSE_URL = "https://wordnet.princeton.edu/license-and-commercial-use"
POS_LABEL = {"n": "n.", "v": "v.", "a": "adj.", "s": "adj.", "r": "adv."}


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf8")


def synset_id(synset):
    return f"omw-en-{synset.offset():08d}-{synset.pos()}"


def node_maps(nodes):
    by_name = {}
    for node in nodes:
        key = node["word"].replace("_", " ").casefold()
        if key in by_name:
            raise ValueError(f"ambiguous vocabulary spelling: {node['word']}")
        by_name[key] = node
    return by_name


def endpoint(lemma, by_name):
    word = lemma.name().replace("_", " ")
    synset = lemma.synset()
    identity = synset_id(synset)
    node = by_name.get(word.casefold())
    matched = [sense for sense in (node or {}).get("senses", [])
               if sense.get("verified") and sense.get("synsetId") == identity]
    if len(matched) > 1:
        raise ValueError(f"ambiguous matched sense: {word} / {identity}")
    # Do not attach an unmatched proper-noun capitalization to a different
    # existing word merely because a case-insensitive spelling is equal.
    if node and not matched and node["word"] != word:
        node = None
    return {
        "word": node["word"] if node else word,
        "wordId": node["id"] if node else None,
        "senseId": matched[0]["id"] if matched else None,
        "synset": identity,
        "pos": POS_LABEL[synset.pos()],
        "lemmaKey": lemma.key(),
    }


def edge_record(source, target):
    if not source["wordId"]:
        raise ValueError("a graph source must be an existing vocabulary word")
    identity = sha256(f"{source['lemmaKey']}\0{target['lemmaKey']}".encode("utf8"))[:24]
    return {
        "id": f"wn-deriv-{identity}",
        "to": target["wordId"],
        "word": target["word"],
        "sourceSense": source["senseId"],
        "targetSense": target["senseId"],
        "sourceSynset": source["synset"],
        "targetSynset": target["synset"],
        "sourcePos": source["pos"],
        "targetPos": target["pos"],
        "sourceKey": source["lemmaKey"],
        "targetKey": target["lemmaKey"],
    }


def build_entries(nodes, wordnet):
    by_name = node_maps(nodes)
    entries = {node["id"]: {} for node in nodes}
    verified_senses = 0

    def add(source, target):
        edge = edge_record(source, target)
        previous = entries[source["wordId"]].get(edge["id"])
        if previous is not None and previous != edge:
            raise ValueError("derivational relation identity collision")
        entries[source["wordId"]][edge["id"]] = edge

    for node in nodes:
        for sense in node["senses"]:
            if not sense.get("verified") or not sense.get("synsetId"):
                continue
            parts = sense["synsetId"].split("-")
            if len(parts) != 4 or parts[:2] != ["omw", "en"] or parts[-1] not in POS_LABEL:
                raise ValueError("invalid verified WordNet sense identity")
            synset = wordnet.synset_from_pos_and_offset(parts[-1], int(parts[-2]))
            lemmas = [lemma for lemma in synset.lemmas()
                      if lemma.name().replace("_", " ").casefold() == node["word"].casefold()]
            exact = [lemma for lemma in lemmas if lemma.name().replace("_", " ") == node["word"]]
            if len(exact) == 1:
                lemmas = exact
            if len(lemmas) != 1:
                raise ValueError(f"verified sense has no unique source lemma: {node['id']}")
            lemma = lemmas[0]
            source = endpoint(lemma, by_name)
            if source["wordId"] != node["id"] or source["senseId"] != sense["id"]:
                raise ValueError(f"source sense binding mismatch: {node['id']}")
            verified_senses += 1
            for other in lemma.derivationally_related_forms():
                if other.key() == lemma.key():
                    continue
                target = endpoint(other, by_name)
                add(source, target)
                # Only expose the reverse direction when WordNet explicitly
                # records it; do not infer a relationship from spelling alone.
                if target["wordId"] and any(back.key() == lemma.key()
                                           for back in other.derivationally_related_forms()):
                    add(target, source)

    ordered = {word_id: sorted(edges.values(), key=lambda e: (
        e["word"].casefold(), e["targetPos"], e["sourceKey"], e["targetKey"]))
        for word_id, edges in sorted(entries.items())}
    return ordered, verified_senses


def write_json(path, value, *, pretty=False):
    content = json.dumps(value, ensure_ascii=False, sort_keys=True,
                         indent=2 if pretty else None,
                         separators=None if pretty else (",", ":")) + "\n"
    path.write_bytes(content.encode("utf8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--wordnet-zip", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    out = args.out.resolve()
    cache = (ROOT / ".op-cache").resolve()
    if cache not in out.parents or out.exists():
        parser.error("output must be a new directory under this worktree's .op-cache")

    archive_bytes = args.wordnet_zip.read_bytes()
    if sha256(archive_bytes) != WORDNET_SHA256:
        raise ValueError("unexpected WordNet archive")
    old_manifest = json.loads((ROOT / "data/universes/manifest.json").read_text(encoding="utf8"))
    index_path = ROOT / "data/universes" / old_manifest["version"] / "index.json"
    index_bytes = index_path.read_bytes()
    index = json.loads(index_bytes)
    bundle_sha = sha256((ROOT / "data/vocabulary-bundle.json").read_bytes())
    if (index.get("version") != old_manifest.get("version") or
            index.get("bundleSha256") != bundle_sha or old_manifest.get("bundleSha256") != bundle_sha):
        raise ValueError("vocabulary and existing universe do not match")
    expected_index = next((item for item in old_manifest["files"] if item["path"] == "index.json"), None)
    if not expected_index or expected_index["sha256"] != sha256(index_bytes):
        raise ValueError("existing universe index checksum mismatch")

    wordnet = WordNetCorpusReader(ZipFilePathPointer(str(args.wordnet_zip.resolve()), "wordnet/"), None)
    entries, verified_senses = build_entries(index["nodes"], wordnet)
    payload = {"schema": 1, "format": "lexical-shards-v1", "baseUniverseVersion": index["version"],
               "bundleSha256": bundle_sha, "wordnetSha256": WORDNET_SHA256, "entries": entries}
    version = sha256(encoded(payload))[:16]
    out.mkdir(parents=False, exist_ok=False)
    version_dir = out / version
    (version_dir / "derivation").mkdir(parents=True, exist_ok=False)
    counts = {word_id: len({edge["to"] for edge in edges if edge["to"] and edge["to"] != word_id})
              for word_id, edges in entries.items()}
    write_json(version_dir / "index.json", {"schema": 1, "version": version,
               "baseUniverseVersion": index["version"], "bundleSha256": bundle_sha,
               "wordnetSha256": WORDNET_SHA256, "counts": counts})
    shards = {}
    for node in index["nodes"]:
        tile = node["spellingTile"]
        if not re.fullmatch(r"[0-7]-[0-7]", tile):
            raise ValueError("invalid existing spelling tile")
        shards.setdefault(tile, {})[node["id"]] = entries[node["id"]]
    for tile, adjacency in sorted(shards.items()):
        write_json(version_dir / "derivation" / f"{tile}.json", {"schema": 1, "version": version,
                   "kind": "derivation", "tile": tile, "adjacency": adjacency})
    files = []
    for file in sorted(version_dir.rglob("*.json")):
        data = file.read_bytes()
        files.append({"path": file.relative_to(version_dir).as_posix(),
                      "sha256": sha256(data), "bytes": len(data)})
    artifact_list_sha = sha256(encoded(files))

    statistics = Counter()
    unique_external = set()
    with (out / "trace.jsonl").open("x", encoding="utf8", newline="\n") as trace:
        for word_id, edges in entries.items():
            if edges:
                statistics["wordsWithRelations"] += 1
            for edge in edges:
                statistics["relations"] += 1
                if edge["to"] is None:
                    statistics["externalRelations"] += 1
                    unique_external.add(edge["word"].casefold())
                elif edge["to"] == word_id:
                    statistics["sameWordRelations"] += 1
                else:
                    statistics["vocabularyRelations"] += 1
                if edge["sourceSense"] is None or (edge["to"] and edge["targetSense"] is None):
                    statistics["unmatchedVocabularySenseRelations"] += 1
                row = {"assetId": edge["id"], "wordId": word_id,
                       "targetWordId": edge["to"], "sourceSenseId": edge["sourceSense"],
                       "targetSenseId": edge["targetSense"], "sourceKey": edge["sourceKey"],
                       "targetKey": edge["targetKey"], "oldValueSha256": None,
                       "fields": {name: {"newValueSha256": sha256(encoded(value))}
                                  for name, value in sorted(edge.items())},
                       "source": LICENSE_URL, "wordnetArchiveSha256": WORDNET_SHA256,
                       "reviewStatus": "pending"}
                trace.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    statistics["uniqueExternalWords"] = len(unique_external)
    statistics["verifiedSourceSenses"] = verified_senses
    manifest = {"schema": 1, "version": version, "index": f"./{version}/index.json",
                "bundleSha256": bundle_sha, "baseUniverseVersion": index["version"],
                "files": files, "artifactListSha256": artifact_list_sha,
                "source": {"name": "Princeton WordNet 3.0", "license": LICENSE_URL,
                           "archiveSha256": WORDNET_SHA256, "baseIndexSha256": sha256(index_bytes),
                           "generatorSha256": sha256(Path(__file__).read_bytes())},
                "distribution": "blocked-pending-review", "review": None}
    write_json(out / "manifest.json", manifest, pretty=True)
    write_json(out / "summary.json", {"generatedAt": datetime.now(timezone.utc).isoformat(),
               "version": version, "statistics": dict(statistics), "artifactListSha256": artifact_list_sha,
               "traceSha256": sha256((out / "trace.jsonl").read_bytes()),
               "reviewStatus": "pending; not a legal or semantic approval"}, pretty=True)
    print(json.dumps({"version": version, "statistics": dict(statistics),
                      "artifactListSha256": artifact_list_sha, "files": len(files)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
