import json
import os
import threading
import urllib.parse
import urllib.request
from pathlib import Path


MODEL_DIR = Path(
    os.environ.get("ARGOS_EN_ZH_MODEL_DIR", r"D:\Files\argos-en-zh-audit")
)
LOCAL_PROVIDER = "argos-opus-en-zh-cc-by-4.0"
LEGACY_PROVIDER = "legacy-unofficial-google-translate"
LEGACY_ENDPOINT = "https://translate.googleapis.com/translate_a/single"

_local_translator = None
_local_lock = threading.Lock()


def _language_code(value):
    return str(value or "").strip().lower().replace("_", "-")


def _is_en_to_zh(source, target):
    return _language_code(source).startswith("en") and _language_code(
        target
    ).startswith("zh")


class _LocalEnZhTranslator:
    def __init__(self, model_dir):
        import ctranslate2
        import sentencepiece as spm

        model_path = model_dir / "model"
        sentencepiece_path = model_dir / "sentencepiece.model"
        if not model_path.exists() or not sentencepiece_path.exists():
            raise FileNotFoundError(f"Missing local Argos model: {model_dir}")

        self.processor = spm.SentencePieceProcessor(
            model_file=str(sentencepiece_path)
        )
        self.translator = ctranslate2.Translator(str(model_path), device="cpu")

    def translate(self, text):
        encoded = self.processor.encode(str(text), out_type=str)
        result = self.translator.translate_batch(
            [encoded],
            beam_size=1,
            num_hypotheses=1,
            replace_unknowns=True,
        )[0]
        return self.processor.decode(result.hypotheses[0]).replace("▁", " ").strip()


def _get_local_translator():
    global _local_translator
    if _local_translator is None:
        _local_translator = _LocalEnZhTranslator(MODEL_DIR)
    return _local_translator


def _legacy_translate(text, source, target, timeout):
    query = urllib.parse.urlencode(
        {
            "client": "gtx",
            "sl": source,
            "tl": target,
            "dt": "t",
            "q": text,
        }
    )
    request = urllib.request.Request(
        f"{LEGACY_ENDPOINT}?{query}",
        headers={"User-Agent": "sense-vocab-maintenance/1.0"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return "".join(part[0] for part in payload[0] if part and part[0]).strip()


def provider_for(source="en", target="zh-CN"):
    if _is_en_to_zh(source, target) and (
        (MODEL_DIR / "model").exists()
        and (MODEL_DIR / "sentencepiece.model").exists()
    ):
        return LOCAL_PROVIDER
    return LEGACY_PROVIDER


def translate_text(text, source="en", target="zh-CN", timeout=30):
    value = str(text or "").strip()
    if not value:
        return ""

    if provider_for(source, target) == LOCAL_PROVIDER:
        # CTranslate2 inference is serialized because several legacy maintenance
        # scripts call this helper from worker pools.
        with _local_lock:
            return _get_local_translator().translate(value)

    # No locally licensed zh-to-en model is bundled yet. Retain the historical
    # endpoint for maintenance compatibility and keep it visibly audited.
    return _legacy_translate(value, source, target, timeout)
