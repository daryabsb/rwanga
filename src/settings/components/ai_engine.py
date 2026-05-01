from decouple import config

AI_TEXT_PROVIDER = config("AI_TEXT_PROVIDER", default="ollama")
AI_TRANSLATION_PROVIDER = config("AI_TRANSLATION_PROVIDER", default="ollama")
AI_IMAGE_PROVIDER = config("AI_IMAGE_PROVIDER", default="stable_diffusion")
OLLAMA_BASE_URL = config("OLLAMA_BASE_URL", default="http://localhost:11434")
OLLAMA_MODEL = config("OLLAMA_MODEL", default="llama3.1:8b")
NLLB_MODEL = config("NLLB_MODEL", default="facebook/nllb-200-distilled-600M")
SD_MODEL = config("SD_MODEL", default="stabilityai/sdxl-turbo")
