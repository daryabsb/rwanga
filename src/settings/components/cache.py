from decouple import config

CACHE_PREFIX = config("CACHE_PREFIX", default="rwanga")
CACHE_ENV = config("CACHE_ENV", default="development")
CACHE_FRAMEWORK_ENABLED = config("CACHE_FRAMEWORK_ENABLED", default=True, cast=bool)
CACHE_FRAMEWORK_ALIAS = config("CACHE_FRAMEWORK_ALIAS", default="default")
CACHE_FRAMEWORK_LOCK_TIMEOUT_SECONDS = config(
    "CACHE_FRAMEWORK_LOCK_TIMEOUT_SECONDS",
    default=30,
    cast=int,
)
CACHE_FRAMEWORK_MONITORING_ENABLED = config(
    "CACHE_FRAMEWORK_MONITORING_ENABLED",
    default=True,
    cast=bool,
)
