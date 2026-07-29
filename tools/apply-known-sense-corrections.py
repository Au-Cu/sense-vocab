import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"

CORRECTIONS = {
    ("cut", "sense-1"): {
        "meaning": "显得，给人……印象",
        "meaningSource": "human-reviewed",
    },
    ("plenty", "sense-2"): {
        "meaning": "大量，许多",
        "meaningSource": "human-reviewed",
    },
    ("entire", "sense-1"): {
        "meaning": "未阉割的（动物）",
        "meaningSource": "human-reviewed",
    },
    ("overcome", "sense-1"): {
        "meaning": "使不支，压倒",
        "definition": "overpower or overwhelm, usually through no fault or weakness of the person affected",
        "definitionSentence": "To overcome means to overpower or overwhelm, usually through no fault or weakness of the person affected.",
        "definitionSource": "human-reviewed",
        "meaningSource": "human-reviewed",
        "auditStatus": "human-reviewed",
    },
    ("clip", "sense-2"): {
        "meaning": "夹子，别针，饰夹",
        "meaningSource": "human-reviewed",
    },
    ("pink", "sense-2"): {
        "meaning": "（发动机）爆震，发出爆震声",
        "definition": "of an engine, to make a series of light metallic knocks because fuel is burning abnormally",
        "definitionSentence": "When an engine pinks, it makes a series of light metallic knocks because fuel is burning abnormally.",
        "definitionSource": "human-reviewed",
        "meaningSource": "human-reviewed",
        "auditStatus": "human-reviewed",
    },
    ("nowadays", "sense-1"): {
        "pos": "adv.",
        "meaning": "现今，现在",
        "definition": "at the present time, especially when contrasted with the past",
        "definitionSentence": "Nowadays means at the present time, especially when contrasted with the past.",
        "definitionSource": "human-reviewed",
        "meaningSource": "human-reviewed",
        "auditStatus": "human-reviewed",
    },
    ("disc", "sense-2"): {
        "meaning": "磁盘",
        "meaningSource": "human-reviewed",
    },
    ("disk", "sense-1"): {
        "meaning": "磁盘",
        "meaningSource": "human-reviewed",
    },
    ("gallop", "sense-1"): {
        "meaning": "奔驰，飞奔",
        "meaningSource": "human-reviewed",
    },
    ("knot", "sense-2"): {
        "meaning": "节（航速单位）",
        "definition": "a unit of speed equal to one nautical mile per hour",
        "definitionSentence": "Knot is a unit of speed equal to one nautical mile per hour.",
        "definitionSource": "human-reviewed",
        "meaningSource": "human-reviewed",
        "auditStatus": "human-reviewed",
    },
    ("tender", "sense-1"): {
        "meaning": "温柔的，充满关爱的",
        "meaningSource": "human-reviewed",
    },
    ("unit", "sense-2"): {
        "meaning": "整体，单元",
        "meaningSource": "human-reviewed",
    },
    ("germ", "sense-1"): {
        "meaning": "胚芽，胚原基",
        "meaningSource": "human-reviewed",
    },
    ("sort", "sense-2"): {
        "meaning": "分选，分类过程",
        "meaningSource": "human-reviewed",
    },
    ("drain", "sense-3"): {
        "meaning": "排水，放空",
        "meaningSource": "human-reviewed",
    },
    ("heave", "sense-1"): {
        "meaning": "抬起，起伏",
        "meaningSource": "human-reviewed",
    },
}


def main():
    words = json.loads(WORDS_PATH.read_text(encoding="utf-8-sig"))
    index = {
        (word["word"], sense.get("id")): sense
        for word in words
        for sense in word.get("senses", [])
    }
    missing = sorted(set(CORRECTIONS) - set(index))
    if missing:
        raise RuntimeError(f"Missing correction targets: {missing}")
    for key, fields in CORRECTIONS.items():
        index[key].update(fields)
    WORDS_PATH.write_text(
        json.dumps(words, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"correctedSenses": len(CORRECTIONS)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
