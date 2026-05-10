from pathlib import Path

from src.settings.components.env import DEBUG
from src.settings.components.paths import BASE_DIR

DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
]

THIRD_PARTY_APPS = [
    "channels",
    "rest_framework",
    "rest_framework.authtoken",
    "drf_spectacular",
    "django_filters",
    "django_htmx",
    "django_celery_beat",
    "django_celery_results",
    "allauth",
    "allauth.account",
    "corsheaders",
]

LOCAL_APPS = [
    "src.core",
    "src.accounts",
    "src.projects",
    "src.reviews",
    "src.scripts",
    "src.shots",
    "src.floorplans",
    "src.scheduling",
    "src.departments",
    "src.ai_engine",
    "src.realtime",
    "src.exports",
    "src.locations",
    "src.notifications",
    "src.progress",
    "src.community",
    "src.billing",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django_htmx.middleware.HtmxMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "src.core.middleware.StudioContextMiddleware",
]

ROOT_URLCONF = "src.urls"
WSGI_APPLICATION = "src.wsgi.application"
ASGI_APPLICATION = "src.asgi.application"

LANGUAGE_CODE = "ckb"
TIME_ZONE = "Asia/Baghdad"
USE_I18N = True
USE_L10N = True
USE_TZ = True
LANGUAGES = [
    ("ckb", "Kurdish Sorani"),
    ("ku", "Kurmanji"),
    ("ar", "Arabic"),
    ("en", "English"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.i18n",
                "src.core.context_processors.studio_context",
                "src.core.context_processors.navigation_context",
            ],
        },
    }
]

LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/projects/"
LOGOUT_REDIRECT_URL = "/accounts/login/"
AUTH_USER_MODEL = "accounts.User"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

if DEBUG:
    INTERNAL_IPS = ["127.0.0.1"]
