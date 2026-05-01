from src.ai_engine.providers.base import AIProvider


class NLLBProvider(AIProvider):
    def __init__(self, model_name="facebook/nllb-200-distilled-600M"):
        self.model_name = model_name
        self._pipeline = None

    @property
    def pipeline(self):
        if self._pipeline is None:
            from transformers import pipeline

            self._pipeline = pipeline("translation", model=self.model_name, device=-1)
        return self._pipeline

    def translate(self, text, source_lang="ckb_Arab", target_lang="eng_Latn"):
        result = self.pipeline(text, src_lang=source_lang, tgt_lang=target_lang, max_length=2048)
        return result[0]["translation_text"]

    def generate_text(self, prompt, system="", max_tokens=4096):
        raise NotImplementedError("NLLB is translation-only")

    def generate_image(self, prompt, width=512, height=512):
        raise NotImplementedError("NLLB is translation-only")
