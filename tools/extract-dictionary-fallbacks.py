import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "data" / "dictionary-definition-fallbacks.json"
POS_MAP = {
    "n": "n.",
    "v": "v.",
    "vt": "v.",
    "vi": "v.",
    "adj": "adj.",
    "a": "adj.",
    "adv": "adv.",
    "ad": "adv.",
}


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def clean_meaning(value):
    meaning = re.split(r"[;；]", clean(value), maxsplit=1)[0].strip()
    meaning = re.sub(r"^(?:n|v|adj|adv)(?:&(?:n|v|adj|adv))*\.?", "", meaning, flags=re.I)
    return meaning.strip(" <")


def clean_definition(value):
    definition = clean(value).replace("（", "(")
    definition = re.sub(r"\s*Compare\s*\.\s*$", "", definition, flags=re.I)
    return definition.rstrip(" (<")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("reference_dir", type=Path)
    args = parser.parse_args()

    output = {}
    seen = set()
    for path in sorted(args.reference_dir.glob("KaoYan_*.json")):
        rows = json.loads(path.read_text(encoding="utf-8-sig"))
        for row in rows:
            word = clean(row.get("headWord")).lower()
            content = row.get("content", {}).get("word", {}).get("content", {})
            for index, item in enumerate(content.get("trans", [])):
                pos = POS_MAP.get(clean(item.get("pos")).lower())
                meaning = clean_meaning(item.get("tranCn"))
                definition = clean_definition(item.get("tranOther"))
                key = (word, pos, meaning, definition)
                if not word or not pos or not meaning or not definition or key in seen:
                    continue
                seen.add(key)
                output.setdefault(word, []).append(
                    {
                        "pos": pos,
                        "meaning": meaning,
                        "definition": definition,
                        "source": f"{path.stem}:{row.get('wordRank', index + 1)}",
                    }
                )

    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"words": len(output), "senses": sum(map(len, output.values()))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
