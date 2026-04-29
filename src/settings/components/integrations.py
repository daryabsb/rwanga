from decouple import config

ANTHROPIC_API_KEY = config("ANTHROPIC_API_KEY", default="")
TWILIO_ACCOUNT_SID = config("TWILIO_ACCOUNT_SID", default="")
TWILIO_AUTH_TOKEN = config("TWILIO_AUTH_TOKEN", default="")
TWILIO_WHATSAPP_NUMBER = config("TWILIO_WHATSAPP_NUMBER", default="")
SENTRY_DSN = config("SENTRY_DSN", default="")
MCP_SERVER_ENABLED = config("MCP_SERVER_ENABLED", default=False, cast=bool)
MCP_SERVER_PORT = config("MCP_SERVER_PORT", default=8002, cast=int)
