from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from src.ai_engine.providers.ollama import OllamaProvider


class OllamaProviderTests(SimpleTestCase):
    @patch("src.ai_engine.providers.ollama.requests.post")
    def test_generate_text_http_contract(self, mock_post):
        response = Mock()
        response.json.return_value = {"response": "ok"}
        response.raise_for_status.return_value = None
        mock_post.return_value = response

        provider = OllamaProvider(base_url="http://localhost:11434", model="llama3.1:8b")
        out = provider.generate_text("hello", system="sys", max_tokens=100)

        self.assertEqual(out, "ok")
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "http://localhost:11434/api/generate")
        self.assertEqual(kwargs["json"]["model"], "llama3.1:8b")
        self.assertEqual(kwargs["json"]["options"]["num_predict"], 100)
