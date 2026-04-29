from decouple import config

CLOUDFLARE_ACCOUNT_ID = config("CLOUDFLARE_ACCOUNT_ID", default="")
CLOUDFLARE_API_TOKEN = config("CLOUDFLARE_API_TOKEN", default="")
