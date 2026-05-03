from decouple import config

# Do not override ALLOWED_HOSTS here.
# Host allow-list is defined in `components/secrets.py` and can be provided
# with the ALLOWED_HOSTS env var in each environment.

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://127.0.0.1:8000,http://localhost:8000",
).split(",")

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://127.0.0.1:8000,http://localhost:8000,https://rwanga.zeneon.co.uk",
).split(",")
