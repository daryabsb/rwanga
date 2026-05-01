# AI Engine — Development Mode Specification

> **Purpose:** Run the full AI pipeline locally with zero cost during development. When the system is production-ready and budget-approved, swap endpoint URLs to cloud APIs — the pipeline stays identical.

## Architecture

```
Django View/API
  → Celery Task (async)
    → AI Provider (local or cloud — swappable)
    → Update AIJob progress via WebSocket
    → Store result in DB
  → WebSocket streams progress to browser
  → HTMX refreshes target pane on completion
```

The key design: `src/ai_engine/providers/` contains provider classes. A setting controls which provider is active. Development uses local models. Production uses Anthropic/OpenAI.

## Provider Pattern

```python
# src/ai_engine/providers/base.py
from abc import ABC, abstractmethod

class AIProvider(ABC):
    """Base class for all AI providers."""

    @abstractmethod
    def generate_text(self, prompt: str, system: str = "", max_tokens: int = 4096) -> str:
        """Generate text from a prompt."""
        ...

    @abstractmethod
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate text between languages."""
        ...

    @abstractmethod
    def generate_image(self, prompt: str, width: int = 512, height: int = 512) -> bytes:
        """Generate an image from a text prompt. Returns PNG bytes."""
        ...
```

```python
# src/ai_engine/providers/ollama.py
import requests
from .base import AIProvider

class OllamaProvider(AIProvider):
    """Local LLM via Ollama. Free, runs on localhost."""

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
                "options": {"num_predict": max_tokens}
            }
        )
        response.raise_for_status()
        return response.json()["response"]

    def translate(self, text, source_lang, target_lang):
        prompt = f"Translate the following {source_lang} text to {target_lang}. Output ONLY the translation, nothing else.\n\n{text}"
        return self.generate_text(prompt, system="You are a professional translator.")

    def generate_image(self, prompt, width=512, height=512):
        raise NotImplementedError("Ollama does not support image generation. Use StableDiffusionProvider.")
```

```python
# src/ai_engine/providers/nllb.py
from .base import AIProvider

class NLLBProvider(AIProvider):
    """Facebook NLLB-200 for Kurdish translation. Free, runs locally via HuggingFace."""

    def __init__(self, model_name="facebook/nllb-200-distilled-600M"):
        self.model_name = model_name
        self._pipeline = None

    @property
    def pipeline(self):
        if self._pipeline is None:
            from transformers import pipeline
            self._pipeline = pipeline(
                "translation",
                model=self.model_name,
                device=-1,  # CPU. Use 0 for GPU.
            )
        return self._pipeline

    # NLLB language codes:
    # Kurdish Sorani = ckb_Arab
    # English = eng_Latn
    # Arabic = arb_Arab

    def translate(self, text, source_lang="ckb_Arab", target_lang="eng_Latn"):
        result = self.pipeline(
            text,
            src_lang=source_lang,
            tgt_lang=target_lang,
            max_length=2048,
        )
        return result[0]["translation_text"]

    def generate_text(self, prompt, system="", max_tokens=4096):
        raise NotImplementedError("NLLB is translation-only. Use OllamaProvider for text generation.")

    def generate_image(self, prompt, width=512, height=512):
        raise NotImplementedError("NLLB is translation-only.")
```

```python
# src/ai_engine/providers/stable_diffusion.py
from .base import AIProvider

class StableDiffusionProvider(AIProvider):
    """Local image generation via Stable Diffusion / Flux. Free, runs locally."""

    def __init__(self, model_id="stabilityai/sdxl-turbo"):
        self.model_id = model_id
        self._pipe = None

    @property
    def pipe(self):
        if self._pipe is None:
            from diffusers import AutoPipelineForText2Image
            import torch
            self._pipe = AutoPipelineForText2Image.from_pretrained(
                self.model_id,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                variant="fp16" if torch.cuda.is_available() else None,
            )
            if torch.cuda.is_available():
                self._pipe = self._pipe.to("cuda")
        return self._pipe

    def generate_image(self, prompt, width=512, height=512):
        image = self.pipe(
            prompt=prompt,
            num_inference_steps=4,  # SDXL-Turbo is fast
            guidance_scale=0.0,
            width=width,
            height=height,
        ).images[0]
        import io
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return buf.getvalue()

    def generate_text(self, prompt, system="", max_tokens=4096):
        raise NotImplementedError("SD is image-only. Use OllamaProvider for text.")

    def translate(self, text, source_lang, target_lang):
        raise NotImplementedError("SD is image-only. Use NLLBProvider for translation.")
```

```python
# src/ai_engine/providers/anthropic_provider.py (PRODUCTION — future)
from .base import AIProvider

class AnthropicProvider(AIProvider):
    """Claude API for production use. Requires ANTHROPIC_API_KEY."""

    def __init__(self):
        import anthropic
        self.client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

    def generate_text(self, prompt, system="", max_tokens=4096):
        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    def translate(self, text, source_lang, target_lang):
        prompt = f"Translate from {source_lang} to {target_lang}. Output ONLY the translation.\n\n{text}"
        return self.generate_text(prompt, system="You are a professional Kurdish-English translator.")

    def generate_image(self, prompt, width=512, height=512):
        raise NotImplementedError("Use StableDiffusionProvider or an image API for image generation.")
```

## Settings Configuration

```python
# src/settings/components/ai_engine.py

# AI Provider Configuration
# Options: "ollama", "nllb", "anthropic"
AI_TEXT_PROVIDER = env("AI_TEXT_PROVIDER", default="ollama")
AI_TRANSLATION_PROVIDER = env("AI_TRANSLATION_PROVIDER", default="ollama")  # or "nllb" for dedicated translation
AI_IMAGE_PROVIDER = env("AI_IMAGE_PROVIDER", default="stable_diffusion")

# Ollama settings (development)
OLLAMA_BASE_URL = env("OLLAMA_BASE_URL", default="http://localhost:11434")
OLLAMA_MODEL = env("OLLAMA_MODEL", default="llama3.1:8b")

# NLLB settings (development — dedicated Kurdish translator)
NLLB_MODEL = env("NLLB_MODEL", default="facebook/nllb-200-distilled-600M")

# Stable Diffusion settings (development)
SD_MODEL = env("SD_MODEL", default="stabilityai/sdxl-turbo")

# Anthropic settings (production — future)
# ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")
```

```python
# src/ai_engine/providers/__init__.py
from django.conf import settings

def get_text_provider():
    if settings.AI_TEXT_PROVIDER == "ollama":
        from .ollama import OllamaProvider
        return OllamaProvider(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
        )
    elif settings.AI_TEXT_PROVIDER == "anthropic":
        from .anthropic_provider import AnthropicProvider
        return AnthropicProvider()
    raise ValueError(f"Unknown text provider: {settings.AI_TEXT_PROVIDER}")

def get_translation_provider():
    if settings.AI_TRANSLATION_PROVIDER == "nllb":
        from .nllb import NLLBProvider
        return NLLBProvider(model_name=settings.NLLB_MODEL)
    elif settings.AI_TRANSLATION_PROVIDER == "ollama":
        from .ollama import OllamaProvider
        return OllamaProvider(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
        )
    raise ValueError(f"Unknown translation provider: {settings.AI_TRANSLATION_PROVIDER}")

def get_image_provider():
    if settings.AI_IMAGE_PROVIDER == "stable_diffusion":
        from .stable_diffusion import StableDiffusionProvider
        return StableDiffusionProvider(model_id=settings.SD_MODEL)
    raise ValueError(f"Unknown image provider: {settings.AI_IMAGE_PROVIDER}")
```

## AI Job Types and Their Pipelines

### 1. Script Breakdown (`breakdown`)
```
Input: Script text (Kurdish)
Pipeline:
  1. Translate script Kurdish → English (translation provider)
  2. Parse scenes from translated text (text provider)
  3. Extract elements per scene: characters, props, locations, wardrobe, vehicles, SFX (text provider)
  4. Store ScriptElement records in DB
  5. Create Scene records if they don't exist
Output: List of scenes with extracted elements
```

### 2. Storyboard Generation (`storyboard`)
```
Input: Scene description + shot list
Pipeline:
  1. For each shot, generate a visual description prompt (text provider)
  2. Generate storyboard frame image (image provider)
  3. Store as StoryboardFrame records
Output: Images attached to shots
```

### 3. Floor Plan Generation (`floorplan`)
```
Input: Scene description + character list
Pipeline:
  1. Analyze scene for spatial requirements (text provider)
  2. Generate room layout as structured JSON (text provider)
  3. Generate camera positions based on shot list (text provider)
  4. Store as FloorPlan JSON record
Output: FloorPlan with furniture, cameras, paths
```

### 4. Schedule Optimization (`schedule`)
```
Input: All scenes + locations + cast availability
Pipeline:
  1. Analyze scene dependencies and location groupings (text provider)
  2. Generate optimal shoot day ordering (text provider)
  3. Create ShootDay + ScheduleBlock records
Output: Proposed shooting schedule
```

## Setup Instructions (Development Machine)

### Install Ollama
```bash
# Windows
winget install Ollama.Ollama

# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

```bash
# Pull a model (one-time, ~4.7GB for 8B)
ollama pull llama3.1:8b

# Verify it's running
curl http://localhost:11434/api/generate -d '{"model":"llama3.1:8b","prompt":"Hello","stream":false}'
```

### Install Python AI dependencies
```bash
# Add to requirements/development.txt
pip install transformers sentencepiece protobuf  # for NLLB
pip install diffusers accelerate torch           # for Stable Diffusion
# Note: torch is large (~2GB). For CPU-only: pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### .env additions
```
AI_TEXT_PROVIDER=ollama
AI_TRANSLATION_PROVIDER=ollama
AI_IMAGE_PROVIDER=stable_diffusion
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

## Switching to Production

When ready, just change `.env`:
```
AI_TEXT_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

No code changes needed. The Celery tasks call `get_text_provider()` which reads the setting and returns the right provider. Pipeline stays the same, quality goes up.

## Dependencies Summary

| Component | Size | GPU Required? | Purpose |
|-----------|------|--------------|---------|
| Ollama + Llama 3.1 8B | ~5GB | No (CPU ok, GPU faster) | Text generation, breakdown, analysis |
| NLLB-200-distilled-600M | ~1.2GB | No | Kurdish↔English translation (optional — Ollama can do this too) |
| SDXL-Turbo | ~6GB | Recommended | Storyboard frame generation |
| **Total (minimal: Ollama only)** | **~5GB** | **No** | **Handles text + translation** |
| **Total (full: all three)** | **~12GB** | **GPU recommended for images** | **All AI features** |

For a lean start, just install Ollama. It handles both text generation and translation adequately. Add NLLB later if Kurdish translation quality needs improvement. Add SD only when storyboard generation is being tested.
