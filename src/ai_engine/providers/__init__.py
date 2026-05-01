from django.conf import settings


def get_text_provider():
    if settings.AI_TEXT_PROVIDER == "ollama":
        from src.ai_engine.providers.ollama import OllamaProvider

        return OllamaProvider(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)
    raise ValueError(f"Unknown text provider: {settings.AI_TEXT_PROVIDER}")


def get_translation_provider():
    if settings.AI_TRANSLATION_PROVIDER == "nllb":
        from src.ai_engine.providers.nllb import NLLBProvider

        return NLLBProvider(model_name=settings.NLLB_MODEL)
    if settings.AI_TRANSLATION_PROVIDER == "ollama":
        from src.ai_engine.providers.ollama import OllamaProvider

        return OllamaProvider(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)
    raise ValueError(f"Unknown translation provider: {settings.AI_TRANSLATION_PROVIDER}")


def get_image_provider():
    if settings.AI_IMAGE_PROVIDER == "stable_diffusion":
        from src.ai_engine.providers.stable_diffusion import StableDiffusionProvider

        return StableDiffusionProvider(model_id=settings.SD_MODEL)
    raise ValueError(f"Unknown image provider: {settings.AI_IMAGE_PROVIDER}")
