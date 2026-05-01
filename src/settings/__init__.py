from split_settings.tools import include, optional

include(
    "components/paths.py",
    "components/env.py",
    "components/db.py",
    "components/redis.py",
    "components/secrets.py",
    "components/cache.py",
    "components/celery.py",
    "components/common.py",
    "components/site.py",
    "components/allauth.py",
    "components/cloudflare.py",
    "components/email.py",
    "components/restframework.py",
    "components/cors.py",
    "components/integrations.py",
    "components/ai_engine.py",
    "components/rwanga.py",
    optional("components/local.py"),
)
