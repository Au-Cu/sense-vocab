import argparse
import json
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import eng_to_ipa


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
CACHE_PATH = ROOT / "data" / "dictionary-phonetic-cache.json"
REPORT_PATH = ROOT / "data" / "sense-ipa-audit.json"

VOWELS = {
    "AA": "ɑ", "AE": "æ", "AH": "ʌ", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ",
    "EH": "ɛ", "ER": "ɝ", "EY": "eɪ", "IH": "ɪ", "IY": "i", "OW": "oʊ",
    "OY": "ɔɪ", "UH": "ʊ", "UW": "u",
}
CONSONANTS = {
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "F": "f", "G": "ɡ",
    "HH": "h", "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n",
    "NG": "ŋ", "P": "p", "R": "r", "S": "s", "SH": "ʃ", "T": "t",
    "TH": "θ", "V": "v", "W": "w", "Y": "j", "Z": "z", "ZH": "ʒ",
}

# Entries here are lexical heteronyms, not accent variants. Values are American broad IPA.
POS_OVERRIDES = {
    "abstract": {"n.": "ˈæbstrækt", "adj.": "ˈæbstrækt", "v.": "æbˈstrækt"},
    "accent": {"n.": "ˈæksɛnt", "v.": "ækˈsɛnt"},
    "addict": {"n.": "ˈædɪkt", "v.": "əˈdɪkt"},
    "aggregate": {"n.": "ˈæɡrɪɡət", "adj.": "ˈæɡrɪɡət", "v.": "ˈæɡrɪɡeɪt"},
    "abuse": {"n.": "əˈbjus", "v.": "əˈbjuz"},
    "advocate": {"n.": "ˈædvəkət", "v.": "ˈædvəkeɪt"},
    "alternate": {"adj.": "ˈɔltərnət", "n.": "ˈɔltərnət", "v.": "ˈɔltərneɪt"},
    "approximate": {"adj.": "əˈprɑksəmət", "v.": "əˈprɑksəmeɪt"},
    "appropriate": {"adj.": "əˈproʊpriət", "v.": "əˈproʊprieɪt"},
    "associate": {"n.": "əˈsoʊsiət", "adj.": "əˈsoʊsiət", "v.": "əˈsoʊsieɪt"},
    "attribute": {"n.": "ˈætrəbjut", "v.": "əˈtrɪbjut"},
    "close": {"adj.": "kloʊs", "adv.": "kloʊs", "v.": "kloʊz"},
    "combat": {"n.": "ˈkɑmbæt", "v.": "kəmˈbæt"},
    "compact": {"n.": "ˈkɑmpækt", "adj.": "ˈkɑmpækt", "v.": "kəmˈpækt"},
    "compound": {"n.": "ˈkɑmpaʊnd", "adj.": "ˈkɑmpaʊnd", "v.": "kəmˈpaʊnd"},
    "conduct": {"n.": "ˈkɑndʌkt", "v.": "kənˈdʌkt"},
    "conflict": {"n.": "ˈkɑnflɪkt", "v.": "kənˈflɪkt"},
    "console": {"n.": "ˈkɑnsoʊl", "v.": "kənˈsoʊl"},
    "construct": {"n.": "ˈkɑnstrʌkt", "v.": "kənˈstrʌkt"},
    "contest": {"n.": "ˈkɑntɛst", "v.": "kənˈtɛst"},
    "contract": {"n.": "ˈkɑntrækt", "v.": "kənˈtrækt"},
    "contrast": {"n.": "ˈkɑntræst", "v.": "kənˈtræst"},
    "converse": {"n.": "ˈkɑnvɜrs", "adj.": "ˈkɑnvɜrs", "v.": "kənˈvɜrs"},
    "convict": {"n.": "ˈkɑnvɪkt", "v.": "kənˈvɪkt"},
    "convert": {"n.": "ˈkɑnvɜrt", "v.": "kənˈvɜrt"},
    "coordinate": {"n.": "koʊˈɔrdənət", "adj.": "koʊˈɔrdənət", "v.": "koʊˈɔrdəneɪt"},
    "decrease": {"n.": "ˈdikris", "v.": "dɪˈkris"},
    "deliberate": {"adj.": "dɪˈlɪbərət", "v.": "dɪˈlɪbəreɪt"},
    "delegate": {"n.": "ˈdɛləɡət", "v.": "ˈdɛləɡeɪt"},
    "desert": {"n.": "ˈdɛzərt", "adj.": "ˈdɛzərt", "v.": "dɪˈzɜrt"},
    "digest": {"n.": "ˈdaɪdʒɛst", "v.": "daɪˈdʒɛst"},
    "duplicate": {"n.": "ˈduplɪkət", "adj.": "ˈduplɪkət", "v.": "ˈduplɪkeɪt"},
    "elaborate": {"adj.": "ɪˈlæbərət", "v.": "ɪˈlæbəreɪt"},
    "entrance": {"n.": "ˈɛntrəns", "v.": "ɪnˈtræns"},
    "estimate": {"n.": "ˈɛstəmət", "v.": "ˈɛstəmeɪt"},
    "excuse": {"n.": "ɪkˈskjus", "v.": "ɪkˈskjuz"},
    "export": {"n.": "ˈɛkspɔrt", "v.": "ɪkˈspɔrt"},
    "exploit": {"n.": "ˈɛksplɔɪt", "v.": "ɪkˈsplɔɪt"},
    "extract": {"n.": "ˈɛkstrækt", "v.": "ɪkˈstrækt"},
    "graduate": {"n.": "ˈɡrædʒuət", "adj.": "ˈɡrædʒuət", "v.": "ˈɡrædʒueɪt"},
    "import": {"n.": "ˈɪmpɔrt", "v.": "ɪmˈpɔrt"},
    "impact": {"n.": "ˈɪmpækt", "v.": "ɪmˈpækt"},
    "implant": {"n.": "ˈɪmplænt", "v.": "ɪmˈplænt"},
    "incline": {"n.": "ˈɪnklaɪn", "v.": "ɪnˈklaɪn"},
    "increase": {"n.": "ˈɪnkris", "v.": "ɪnˈkris"},
    "insult": {"n.": "ˈɪnsʌlt", "v.": "ɪnˈsʌlt"},
    "insert": {"n.": "ˈɪnsɜrt", "v.": "ɪnˈsɜrt"},
    "intern": {"n.": "ˈɪntɜrn", "v.": "ɪnˈtɜrn"},
    "intimate": {"adj.": "ˈɪntəmət", "n.": "ˈɪntəmət", "v.": "ˈɪntəmeɪt"},
    "live": {"adj.": "laɪv", "adv.": "laɪv", "v.": "lɪv"},
    "moderate": {"adj.": "ˈmɑdərət", "n.": "ˈmɑdərət", "v.": "ˈmɑdəreɪt"},
    "object": {"n.": "ˈɑbdʒɛkt", "v.": "əbˈdʒɛkt"},
    "permit": {"n.": "ˈpɜrmɪt", "v.": "pərˈmɪt"},
    "perfect": {"adj.": "ˈpɜrfɪkt", "n.": "ˈpɜrfɪkt", "v.": "pərˈfɛkt"},
    "predicate": {"n.": "ˈprɛdɪkət", "v.": "ˈprɛdɪkeɪt"},
    "prefix": {"n.": "ˈprifɪks", "v.": "priˈfɪks"},
    "present": {"n.": "ˈprɛzənt", "adj.": "ˈprɛzənt", "v.": "prɪˈzɛnt"},
    "produce": {"n.": "ˈproʊdus", "v.": "prəˈdus"},
    "progress": {"n.": "ˈprɑɡrɛs", "v.": "prəˈɡrɛs"},
    "project": {"n.": "ˈprɑdʒɛkt", "v.": "prəˈdʒɛkt"},
    "protest": {"n.": "ˈproʊtɛst", "v.": "prəˈtɛst"},
    "rebel": {"n.": "ˈrɛbəl", "adj.": "ˈrɛbəl", "v.": "rɪˈbɛl"},
    "record": {"n.": "ˈrɛkərd", "v.": "rɪˈkɔrd"},
    "refund": {"n.": "ˈrifʌnd", "v.": "rɪˈfʌnd"},
    "reject": {"n.": "ˈridʒɛkt", "v.": "rɪˈdʒɛkt"},
    "relay": {"n.": "ˈrileɪ", "v.": "riˈleɪ"},
    "research": {"n.": "ˈrisɜrtʃ", "v.": "rɪˈsɜrtʃ"},
    "refuse": {"n.": "ˈrɛfjus", "v.": "rɪˈfjuz"},
    "separate": {"adj.": "ˈsɛpərət", "v.": "ˈsɛpəreɪt"},
    "segment": {"n.": "ˈsɛɡmənt", "v.": "sɛɡˈmɛnt"},
    "subordinate": {"n.": "səˈbɔrdənət", "adj.": "səˈbɔrdənət", "v.": "səˈbɔrdəneɪt"},
    "subject": {"n.": "ˈsʌbdʒɪkt", "adj.": "ˈsʌbdʒɪkt", "v.": "səbˈdʒɛkt"},
    "survey": {"n.": "ˈsɜrveɪ", "v.": "sərˈveɪ"},
    "suspect": {"n.": "ˈsʌspɛkt", "adj.": "ˈsʌspɛkt", "v.": "səˈspɛkt"},
    "transport": {"n.": "ˈtrænspɔrt", "v.": "trænˈspɔrt"},
    "transfer": {"n.": "ˈtrænsfɜr", "v.": "trænsˈfɜr"},
    "transplant": {"n.": "ˈtrænsplænt", "v.": "trænsˈplænt"},
    "use": {"n.": "jus", "v.": "juz"},
}

WORD_OVERRIDES = {
    "read": "rid",
    "resumé": "ˈrɛzəmeɪ",
    "resume": "rɪˈzum",
}

LOOKUP_ALIASES = {
    "aeroplane": "airplane", "analyse": "analyze", "appal": "appall",
    "characterise": "characterize", "cigaret": "cigarette", "civilisation": "civilization",
    "civilise": "civilize", "criticise": "criticize", "despatch": "dispatch",
    "emphasise": "emphasize", "favourable": "favorable", "fertiliser": "fertilizer",
    "fulfil": "fulfill", "gaol": "jail", "gasolene": "gasoline", "generalise": "generalize",
    "gramme": "gram", "industrialise": "industrialize", "instalment": "installment",
    "jewellery": "jewelry", "litre": "liter", "manoeuvre": "maneuver", "maths": "math",
    "mobilise": "mobilize", "organise": "organize", "paralyse": "paralyze",
    "reflexion": "reflection", "specialise": "specialize", "summarise": "summarize",
    "sympathise": "sympathize", "tumour": "tumor", "utilise": "utilize", "vapour": "vapor",
    "vs.": "versus", "waggon": "wagon",
}

MISSING_WORD_OVERRIDES = {
    "account for": "əˈkaʊnt fɔr",
    "bring about": "brɪŋ əˈbaʊt",
    "carcase": "ˈkɑrkəs",
    "cd-rom": "ˌsiːdiːˈrɑm",
    "coeducation": "ˌkoʊˌedʒəˈkeɪʃən",
    "destine": "ˈdɛstɪn",
    "dynamical": "daɪˈnæmɪkəl",
    "enrolment": "ɪnˈroʊlmənt",
    "fantastical": "fænˈtæstɪkəl",
    "first aid": "ˌfɜrst ˈeɪd",
    "flavour": "ˈfleɪvər",
    "flyover": "ˈflaɪˌoʊvər",
    "fund-raising": "ˈfʌndˌreɪzɪŋ",
    "high-rise": "ˈhaɪˌraɪz",
    "inapt": "ɪnˈæpt",
    "key word": "ˈkiːˌwɜrd",
    "low-risk": "ˌloʊˈrɪsk",
    "memorise": "ˈmɛməˌraɪz",
    "mischance": "ˌmɪsˈtʃæns",
    "nondrinker": "ˌnɑnˈdrɪŋkər",
    "offence": "əˈfɛns",
    "open-book": "ˌoʊpənˈbʊk",
    "overhead projector": "ˌoʊvərˈhɛd prəˈdʒɛktər",
    "phone-in": "ˈfoʊnˌɪn",
    "photojournalism": "ˌfoʊtoʊˈdʒɜrnəlɪzəm",
    "preposition": "ˌprɛpəˈzɪʃən",
    "psycholinguistic": "ˌsaɪkoʊlɪŋˈɡwɪstɪk",
    "reflectance": "rɪˈflɛktəns",
    "sceptical": "ˈskɛptɪkəl",
    "self-discipline": "ˌsɛlfˈdɪsəplɪn",
    "soundproof": "ˈsaʊndˌpruːf",
    "statical": "ˈstætɪkəl",
    "superintend": "ˌsuːpərɪnˈtɛnd",
    "unsocial": "ʌnˈsoʊʃəl",
    "up-to-date": "ˌʌptəˈdeɪt",
    "water clock": "ˈwɔtər ˌklɑk",
    "water-skiing": "ˈwɔtərˌskiːɪŋ",
    "wreathe": "riːð",
}

SENSE_OVERRIDES = {
    "bass": [(r"鱼|鲈", "bæs"), (r"低音|男低音|贝斯", "beɪs")],
    "bow": [(r"弓|蝴蝶结|琴弓", "boʊ"), (r"鞠躬|船首|弯腰", "baʊ")],
    "content": [(r"满意|满足", "kənˈtɛnt"), (r"内容|含量|目录", "ˈkɑntɛnt")],
    "does": [(r"雌鹿", "doʊz"), (r"做|助动词", "dʌz")],
    "lead": [(r"铅|铅制", "lɛd"), (r"领导|带领|领先|线索|主角", "lid")],
    "invalid": [(r"病弱|病人|伤残", "ˈɪnvəlɪd"), (r"无效|不合法|错误", "ɪnˈvælɪd")],
    "minute": [(r"微小|细微", "maɪˈnut"), (r"分钟|会议记录", "ˈmɪnɪt")],
    "row": [(r"争吵|吵架", "raʊ"), (r"排|行|划船", "roʊ")],
    "sow": [(r"母猪", "saʊ"), (r"播种|散布", "soʊ")],
    "tear": [(r"眼泪|泪水", "tɪr"), (r"撕|扯|裂口", "tɛr")],
    "wind": [(r"缠绕|卷绕|蜿蜒|上发条", "waɪnd"), (r"风|气流", "wɪnd")],
}


def read_json(path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def plain_lookup(word):
    normalized = unicodedata.normalize("NFKD", word.lower())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return normalized.replace("’", "'")


def cmu_pronunciation_to_ipa(pronunciation):
    phones = pronunciation.upper().split()
    syllables = sum(1 for phone in phones if re.match(r"^[A-Z]+[012]$", phone))
    marked_phones = eng_to_ipa.find_stress(pronunciation, type="all").split()
    result = []
    for index, phone in enumerate(phones):
        match = re.match(r"^([A-Z]+)([012])?$", phone)
        if not match:
            continue
        symbol, stress = match.groups()
        if syllables > 1 and index < len(marked_phones):
            marked = marked_phones[index]
            if marked.startswith("ˈ"):
                result.append("ˈ")
            elif marked.startswith("ˌ"):
                result.append("ˌ")
        if symbol in VOWELS:
            if symbol == "AH" and stress == "0":
                ipa = "ə"
            elif symbol == "ER" and stress == "0":
                ipa = "ɚ"
            else:
                ipa = VOWELS[symbol]
            result.append(ipa)
        else:
            result.append(CONSONANTS.get(symbol, symbol.lower()))
    return "".join(result)


def parse_api_ipa(value):
    text = str(value or "").strip().strip("/")
    return re.sub(r"\s+", "", text)


def fetch_dictionary_ipa(word, cache):
    if word in cache:
        return cache[word]
    url = "https://api.dictionaryapi.dev/api/v2/entries/en/" + urllib.parse.quote(word)
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            payload = json.load(response)
        values = []
        for entry in payload if isinstance(payload, list) else []:
            values.append(parse_api_ipa(entry.get("phonetic")))
            values.extend(parse_api_ipa(item.get("text")) for item in entry.get("phonetics", []))
        cache[word] = list(dict.fromkeys(value for value in values if value))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError):
        cache[word] = []
    return cache[word]


def pronunciation_for_sense(word, sense, variants, api_variants):
    lower = word.lower()
    meaning = str(sense.get("meaning", ""))
    for pattern, pronunciation in SENSE_OVERRIDES.get(lower, []):
        if re.search(pattern, meaning):
            return pronunciation, "heteronym-sense-override"
    if lower in WORD_OVERRIDES:
        return WORD_OVERRIDES[lower], "word-override"
    if sense.get("pos") in POS_OVERRIDES.get(lower, {}):
        return POS_OVERRIDES[lower][sense["pos"]], "heteronym-pos-override"
    if variants:
        return variants[0], "cmudict"
    if api_variants:
        return api_variants[0], "dictionary-api"
    return "", "missing"


def main():
    parser = argparse.ArgumentParser(description="Build a per-sense IPA field")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--fetch-missing", action="store_true")
    parser.add_argument("--preserve-existing", action="store_true")
    parser.add_argument("--words-path", type=Path, default=WORDS_PATH)
    parser.add_argument("--cache-path", type=Path, default=CACHE_PATH)
    parser.add_argument("--report-path", type=Path, default=REPORT_PATH)
    args = parser.parse_args()

    words = read_json(args.words_path, [])
    cache = read_json(args.cache_path, {})
    cmu = eng_to_ipa.mode_type("json")
    missing_words = []
    source_counts = {}
    heteronym_words = set()

    for word_entry in words:
        word = word_entry["word"]
        lookup = plain_lookup(word)
        cmu_lookup = LOOKUP_ALIASES.get(lookup, lookup)
        raw_variants = cmu.get(cmu_lookup, [])
        variants = list(dict.fromkeys(cmu_pronunciation_to_ipa(item) for item in raw_variants))
        api_variants = cache.get(lookup, [])
        if not variants and args.fetch_missing:
            api_variants = fetch_dictionary_ipa(lookup, cache)
        if len(variants) > 1 or lookup in POS_OVERRIDES or lookup in SENSE_OVERRIDES:
            heteronym_words.add(word)
        for sense in word_entry.get("senses", []):
            if args.preserve_existing and sense.get("ipa"):
                source = str(sense.get("ipaSource") or "existing")
                source_counts[source] = source_counts.get(source, 0) + 1
                continue
            pronunciation, source = pronunciation_for_sense(
                lookup,
                sense,
                variants,
                api_variants,
            )
            if not pronunciation and lookup in MISSING_WORD_OVERRIDES:
                pronunciation = MISSING_WORD_OVERRIDES[lookup]
                source = "word-override"
            if pronunciation:
                sense["ipa"] = pronunciation
                sense["ipaSource"] = source
                source_counts[source] = source_counts.get(source, 0) + 1
            else:
                sense.pop("ipa", None)
                sense.pop("ipaSource", None)
        if any(not sense.get("ipa") for sense in word_entry.get("senses", [])):
            missing_words.append(word)

    report = {
        "summary": {
            "words": len(words),
            "senses": sum(len(word.get("senses", [])) for word in words),
            "missingWords": len(missing_words),
            "heteronymWordsReviewed": len(heteronym_words),
        },
        "sourceCounts": source_counts,
        "missingWords": missing_words,
        "heteronymWords": sorted(heteronym_words),
    }
    write_json(args.report_path, report)
    if args.fetch_missing:
        write_json(args.cache_path, cache)
    print(json.dumps(report["summary"], ensure_ascii=False))
    print(json.dumps(source_counts, ensure_ascii=False))

    if args.write:
        if missing_words:
            raise RuntimeError(f"Refusing to write: {len(missing_words)} words still lack IPA")
        write_json(args.words_path, words)


if __name__ == "__main__":
    main()
