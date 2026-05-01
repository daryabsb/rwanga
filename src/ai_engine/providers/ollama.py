import requests

from src.ai_engine.providers.base import AIProvider


class OllamaProvider(AIProvider):
    def __init__(self, base_url="http://localhost:11434", model="llama3.1:8b"):
        self.base_url = base_url
        self.model = model

    def generate_text(self, prompt, system="", max_tokens=4096):
        response = requests.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "system": system,
                "stream": False,
                "options": {"num_predict": max_tokens},
            },
            timeout=60,
        )
        response.raise_for_status()
        return response.json().get("response", "")

    def translate(self, text, source_lang, target_lang):
        prompt = f"Translate from {source_lang} to {target_lang}. Output only translation.\\n\\n{text}"
        return self.generate_text(prompt, system="You are a precise translator.")

    def generate_image(self, prompt, width=512, height=512):
        raise NotImplementedError("Ollama text provider does not generate images")
