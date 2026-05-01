from django.test import SimpleTestCase, override_settings

from src.ai_engine.providers import get_image_provider, get_text_provider, get_translation_provider


class ProviderFactoryTests(SimpleTestCase):
    @override_settings(AI_TEXT_PROVIDER="ollama", OLLAMA_BASE_URL="http://localhost:11434", OLLAMA_MODEL="llama3.1:8b")
    def test_get_text_provider(self):
        provider = get_text_provider()
        self.assertEqual(provider.__class__.__name__, "OllamaProvider")

    @override_settings(AI_TRANSLATION_PROVIDER="nllb", NLLB_MODEL="facebook/nllb-200-distilled-600M")
    def test_get_translation_provider(self):
        provider = get_translation_provider()
        self.assertEqual(provider.__class__.__name__, "NLLBProvider")

    @override_settings(AI_IMAGE_PROVIDER="stable_diffusion", SD_MODEL="stabilityai/sdxl-turbo")
    def test_get_image_provider(self):
        provider = get_image_provider()
        self.assertEqual(provider.__class__.__name__, "StableDiffusionProvider")
