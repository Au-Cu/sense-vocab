import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_WORDS_PATH = ROOT / "data" / "ielts-new-words.json"

MANUAL_SENSES = {
    "booklist": [
        {
            "pos": "n.",
            "meaning": "推荐书目，书单",
            "definition": "a list of books recommended for a subject or course",
            "example": "The lecturer added two recent studies to the booklist before the new semester began.",
        }
    ],
    "bring about": [
        {
            "pos": "v.",
            "meaning": "导致，引起",
            "definition": "cause something to happen",
            "example": "The vaccination campaign helped bring about a sharp fall in infection rates.",
        }
    ],
    "first aid": [
        {
            "pos": "n.",
            "meaning": "急救",
            "definition": "immediate medical help given before full treatment is available",
            "example": "A trained passenger gave first aid and stopped the bleeding until the ambulance arrived.",
        }
    ],
    "helpline": [
        {
            "pos": "n.",
            "meaning": "服务热线，求助电话",
            "definition": "a telephone service that gives advice or help",
            "example": "Students in distress can call the confidential helpline for counselling and urgent support.",
        }
    ],
    "key word": [
        {
            "pos": "n.",
            "meaning": "关键词",
            "definition": "an important word used to identify a topic or search for information",
            "example": "She entered the key word into the database and quickly found every article on climate migration.",
        }
    ],
    "low-risk": [
        {
            "pos": "adj.",
            "meaning": "低风险的",
            "definition": "unlikely to cause loss, harm, or danger",
            "example": "The pension fund chose low-risk bonds to protect retirees from sudden market losses.",
        }
    ],
    "midmorning": [
        {
            "pos": "n.",
            "meaning": "上午中段，上午十时左右",
            "definition": "the middle part of the morning",
            "example": "By midmorning, the early fog had lifted and the research team could begin its field survey.",
        }
    ],
    "nondrinker": [
        {
            "pos": "n.",
            "meaning": "不饮酒者",
            "definition": "a person who does not drink alcohol",
            "example": "As a nondrinker, Lena ordered sparkling water while the other guests chose wine.",
        }
    ],
    "open-book": [
        {
            "pos": "adj.",
            "meaning": "开卷的",
            "definition": "allowing reference books or notes during an examination",
            "example": "Although the test was open-book, students still had to analyse the case rather than copy definitions.",
        }
    ],
    "overhead projector": [
        {
            "pos": "n.",
            "meaning": "高射投影仪，投影仪",
            "definition": "a device that projects an enlarged image from a transparency onto a screen",
            "example": "The lecturer placed a transparency on the overhead projector so the diagram filled the classroom screen.",
        }
    ],
    "phd": [
        {
            "pos": "n.",
            "meaning": "博士学位，哲学博士学位",
            "definition": "the highest university degree awarded for advanced research",
            "example": "After defending her original research on marine ecosystems, Mei was awarded a PhD.",
        }
    ],
    "psycholinguistic": [
        {
            "pos": "adj.",
            "meaning": "心理语言学的",
            "definition": "relating to how psychological processes affect the learning and use of language",
            "example": "The researchers used a psycholinguistic experiment to measure how quickly bilingual speakers recognized words.",
        }
    ],
    "secondhand": [
        {
            "pos": "adj.",
            "meaning": "二手的，用过的",
            "definition": "previously owned or used by someone else",
            "example": "She bought a secondhand bicycle from its previous owner and replaced the worn brakes.",
        }
    ],
    "water clock": [
        {
            "pos": "n.",
            "meaning": "水钟",
            "definition": "a clock that measures time by the regulated flow of water",
            "example": "The ancient water clock marked each hour as water dripped steadily into the lower vessel.",
        }
    ],
    "while": [
        {
            "pos": "conj.",
            "meaning": "在……期间，与……同时",
            "definition": "during the time that something else is happening",
            "example": "While the surgeon operated, the monitors continuously displayed the patient's heart rate.",
        },
        {
            "pos": "conj.",
            "meaning": "尽管，虽然",
            "definition": "although something is true",
            "example": "While the treatment cannot cure the disease, it can greatly reduce the patient's pain.",
        },
        {
            "pos": "conj.",
            "meaning": "而，然而",
            "definition": "used to contrast two facts or situations",
            "example": "Urban rents rose sharply last year, while housing costs in rural areas remained stable.",
        },
    ],
}


def main():
    parser = argparse.ArgumentParser(
        description="Fill only IELTS entries left empty by semantic auditing."
    )
    parser.add_argument("--words-path", type=Path, default=DEFAULT_WORDS_PATH)
    args = parser.parse_args()

    words = json.loads(args.words_path.read_text(encoding="utf-8-sig"))
    filled = []
    unresolved = []

    for word_entry in words:
        if word_entry.get("senses"):
            continue
        key = word_entry["word"].lower()
        rows = MANUAL_SENSES.get(key, [])
        if not rows:
            unresolved.append(word_entry["word"])
            continue
        word_entry["senses"] = []
        for index, row in enumerate(rows):
            word_entry["senses"].append(
                {
                    "id": f"sense-{index + 1}",
                    **row,
                    "definitionSentence": row["definition"],
                    "definitionSource": "manual-ielts-fallback",
                    "exampleSource": "manual-ielts-fallback",
                    "meaningSource": "manual-ielts-fallback",
                    "auditStatus": "manual-reviewed",
                    "importance": max(1, 100 - index * 3),
                }
            )
        filled.append(word_entry["word"])

    args.words_path.write_text(
        json.dumps(words, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "filledWords": filled,
                "unresolvedWords": unresolved,
                "totalSenses": sum(len(entry.get("senses", [])) for entry in words),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if unresolved:
        raise RuntimeError(f"Missing manual fallback content for: {unresolved}")


if __name__ == "__main__":
    main()
