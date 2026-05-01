from abc import ABC, abstractmethod


class AIProvider(ABC):
    @abstractmethod
    def generate_text(self, prompt: str, system: str = "", max_tokens: int = 4096) -> str:
        ...

    @abstractmethod
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        ...

    @abstractmethod
    def generate_image(self, prompt: str, width: int = 512, height: int = 512) -> bytes:
        ...
