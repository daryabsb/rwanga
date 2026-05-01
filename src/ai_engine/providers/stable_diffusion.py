from src.ai_engine.providers.base import AIProvider


class StableDiffusionProvider(AIProvider):
    def __init__(self, model_id="stabilityai/sdxl-turbo"):
        self.model_id = model_id
        self._pipe = None

    @property
    def pipe(self):
        if self._pipe is None:
            from diffusers import AutoPipelineForText2Image
            import torch

            dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            kwargs = {"torch_dtype": dtype}
            if torch.cuda.is_available():
                kwargs["variant"] = "fp16"
            self._pipe = AutoPipelineForText2Image.from_pretrained(self.model_id, **kwargs)
            if torch.cuda.is_available():
                self._pipe = self._pipe.to("cuda")
        return self._pipe

    def generate_image(self, prompt, width=512, height=512):
        image = self.pipe(prompt=prompt, num_inference_steps=4, guidance_scale=0.0, width=width, height=height).images[0]
        import io

        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return buf.getvalue()

    def generate_text(self, prompt, system="", max_tokens=4096):
        raise NotImplementedError("Stable diffusion is image-only")

    def translate(self, text, source_lang, target_lang):
        raise NotImplementedError("Stable diffusion is image-only")
