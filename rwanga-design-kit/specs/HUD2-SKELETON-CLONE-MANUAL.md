# HUD2 Skeleton Clone Manual (Django Platform Blueprint)

## 1) Goal
This manual is for the implementation agent to clone the `hud2` project skeleton for a new product purpose while preserving the proven Django platform architecture and infrastructure wiring.

Use this as a technical baseline only. Do not carry over domain/business modules that are specific to the current product context.

## 2) Reference Inputs
- Source codebase root: `E:\api\hud2`
- Design direction reference: `C:\Users\darya\Desktop\Sarwar\normalize\Projects\design\MASTER-DESIGN.md`

`MASTER-DESIGN.md` reinforces that the new system will need robust async/background processing, realtime updates, and modular app boundaries. Keep those as platform capabilities, independent of domain.

## 3) High-Level Skeleton (Keep)
```text
hud2/
  manage.py
  requirements.txt
  src/
    asgi.py
    wsgi.py
    urls.py
    routing.py
    settings/
      __init__.py
      components/
        __init__.py
        paths.py
        env.py
        db.py
        redis.py
        cache.py
        celery.py
        common.py
        restframework.py
        cors.py
        allauth.py
        site.py
        secrets.py
        local.py
        integrations.py
        email.py
        cloudflare.py
        accounting.py
```

## 4) Bootstrap Entry Points
### `manage.py`
- Uses `DJANGO_SETTINGS_MODULE=src.settings`
- Keep this unchanged for cloned projects unless package path changes.

### Settings loader: `src/settings/__init__.py`
- Uses `django-split-settings` include order.
- Current base include sequence:
  1. `components/paths.py`
  2. `components/db.py`
  3. `components/redis.py`
  4. `components/secrets.py`
  5. `components/cache.py`
  6. `components/celery.py`
  7. `components/common.py`
  8. `components/site.py`
  9. `components/allauth.py`
  10. `components/accounting.py`
  11. `components/cloudflare.py`
  12. `components/email.py`
  13. `components/restframework.py`
  14. `components/cors.py`
  15. `components/integrations.py`
  16. optional `components/local.py`

## 5) URL + Protocol Wiring (Keep Pattern)
### HTTP routing
- Root URLConf: `src.urls`
- `src/urls.py` aggregates app URLs with `include(...)`, has admin route, auth route, and debug-only routes.
- Keep the composition pattern: one root `urlpatterns` that mounts bounded app URL modules.

### ASGI + WebSocket routing
- `src/asgi.py` uses `ProtocolTypeRouter`:
  - `http` -> Django ASGI app
  - `websocket` -> `AuthMiddlewareStack(URLRouter(...))`
- `src/routing.py` imports websocket routes from `src.realtime.routing`.
- Keep this shape for future realtime features even if websocket handlers are initially minimal.

## 6) Settings Architecture (Core to Preserve)
### `common.py` (platform defaults)
- Defines:
  - `DJANGO_APPS`, `THIRD_PARTY_APPS`, `LOCAL_APPS`, `INSTALLED_APPS`
  - `MIDDLEWARE`
  - `ROOT_URLCONF`, `TEMPLATES`, `WSGI_APPLICATION`, `ASGI_APPLICATION`
  - `LANGUAGE_CODE`, `TIME_ZONE`, i18n/l10n settings
  - static/media config
  - authentication backends and login URLs
- Current baseline includes `channels`, `daphne`, `rest_framework`, `drf_spectacular`, `django_htmx`, and allauth support.

### `redis.py`
- Central Redis host/port and URL.
- Wires:
  - `CELERY_BROKER_URL`
  - `CELERY_RESULT_BACKEND = "django-db"`
  - `CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers.DatabaseScheduler"`
  - `CACHES` using `django_redis.cache.RedisCache`
  - `CHANNEL_LAYERS` using `channels_redis.core.RedisChannelLayer`

### `celery.py`
- Celery payload/serialization behavior:
  - `CELERY_ACCEPT_CONTENT = ['json']`
  - `CELERY_TASK_SERIALIZER = 'json'`
  - `CELERY_RESULT_SERIALIZER = 'json'`
  - `DJANGO_CELERY_BEAT_TZ_AWARE = False` (explicit in current baseline)

### `cache.py`
- Cache framework global knobs:
  - prefix/environment toggles
  - framework enable/disable switch
  - lock timeout / monitoring flags

### `restframework.py`
- DRF defaults:
  - `JSONRenderer` always; browsable renderer in debug mode
  - session authentication
  - `IsAuthenticated` default permissions
  - unified exception envelope handler
  - standard pagination + page size
  - OpenAPI via drf-spectacular

## 7) App Strategy for the New Project
Do not copy current domain modules (`hr`, `finances`, etc.) into the new project purpose.

For clone bootstrap:
1. Keep `DJANGO_APPS` and `THIRD_PARTY_APPS` platform entries intact.
2. Replace `LOCAL_APPS` with only new-product apps.
3. Keep infra/technical apps required by platform behavior:
   - `src.core`-equivalent shared framework app (or renamed equivalent)
   - `src.accounts`-equivalent if auth/user domain is reused
   - `src.notifications`/`src.realtime` equivalents if websocket events are needed
4. Keep URL include style modular, one `urls.py` per app.

## 8) Requirements Baseline (from current `requirements.txt`)
Retain the platform-critical packages:
- Django, asgiref
- channels, channels_redis, daphne
- celery, django-celery-beat, django_celery_results
- redis, django-redis
- djangorestframework, drf-spectacular, django-filter
- dj-database-url, python-decouple
- django-allauth
- django-htmx
- psycopg2-binary

Optional by product need:
- xhtml2pdf / reportlab / weasyprint-related stack
- openpyxl
- storage/integration-specific libraries

## 9) Environment Variables to Define Early
Minimum:
- `DJANGO_ENV`
- `SECRET_KEY`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `DEBUG`

Recommended (future-safe):
- cache framework flags (`CACHE_FRAMEWORK_*`)
- feature flags for async/realtime behavior
- site URL / email backend settings

## 10) Practical Clone Procedure
1. Copy repository skeleton and rename product/package identifiers if needed.
2. Keep `manage.py`, `src/settings`, `src/asgi.py`, `src/routing.py`, `src/urls.py` architecture.
3. Replace domain `LOCAL_APPS` list with new product apps only.
4. Keep Redis/Celery/Channels/DRF settings modules active.
5. Update root `urlpatterns` to mount only new product apps.
6. Run migrations after app replacement and clean old migration references.
7. Validate:
   - HTTP server starts
   - ASGI boot succeeds
   - Celery worker boots
   - Redis connection succeeds
   - cache backend reachable
   - DRF endpoint returns authenticated response
   - websocket handshake succeeds on at least one route

## 11) Guardrails for the Implementing Agent
- Preserve split-settings modularity; do not collapse to one settings file.
- Preserve async architecture even if first release uses only part of it.
- Keep middleware ordering intentional (auth/session/htmx and request context layers).
- Keep domain logic decoupled from platform/infrastructure modules.
- Avoid introducing hardcoded business terms from current hud2 domains.

## 12) Suggested Deliverables From Agent
Ask the implementing agent to deliver:
1. New repository with same platform skeleton structure.
2. Cleaned `LOCAL_APPS` and URL includes for new purpose.
3. Working `.env.example` with required variables.
4. Startup commands for:
   - Django app
   - Celery worker
   - Celery beat
   - ASGI/Daphne server
5. A short validation report proving HTTP, DRF, Redis, Celery, cache, and websocket are functional.
