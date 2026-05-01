ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
    "rwanga.zeneon.co.uk",
    ".zeneon.co.uk",
    "*.zeneon.co.uk",
]

CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]

CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "https://rwanga.zeneon.co.uk",
    "https://*.zeneon.co.uk",
]
