# ڕوانگە — Master System Design

**For: Engineering Agent**
**Owner: Darya Ibrahim (daryabsb@gmail.com)**
**Version: 3.0 — April 29, 2026**

> **MANDATORY RULE — DOCUMENTATION & TDD**
> This project is built entirely by AI agents. Every phase, every task, every class, every function MUST be:
> 1. **Documented** — docstrings, inline comments, module-level docs
> 2. **Registered** — added to the Progress app AND the project map (ARCHITECTURE.md)
> 3. **Test-first** — write the test BEFORE writing the code (TDD)
> 4. **Human-readable** — a human taking over this project must understand it from docs alone
> 5. **Progress-tracked** — every task, change, gap, and decision recorded in the Progress app (DB-backed, MCP-accessible)
>
> No code ships without its test. No module ships without its documentation entry. No phase completes without the Progress app updated.

---

## PART 1: FOUNDATION — CLONE FROM HUD2

### 1.1 Clone Source

The project skeleton is cloned from an existing production Django platform:

```
Source: /e/api/hud2/
```

**Clone procedure:**
1. Copy the entire repository skeleton
2. Strip all domain-specific apps (`hr`, `finances`, etc.) from `LOCAL_APPS`
3. Keep ALL infrastructure: settings components, ASGI wiring, Celery config, Redis config, DRF config
4. Keep `src/` as the root package name — do NOT rename to `rwanga/`
5. Clone `.env` file and update only product-specific values (DB name, secret key)
6. Most host settings (Celery broker, PostgreSQL, Redis) remain identical — same machine

**Why `src/`:** Settings imports, environment configs, and code snippets are all written with `src.` prefix. Keeping it avoids rewriting every import path. This is a deliberate architectural choice.

### 1.2 Project Skeleton (After Clone + Clean)

```
rwanga/                              ← repo root (git)
│
├── manage.py                        ← DJANGO_SETTINGS_MODULE=src.settings
├── requirements.txt                 ← platform + product packages
├── .env                             ← cloned from HUD2, updated for rwanga
├── .env.example                     ← documented env vars
├── docker-compose.yml               ← dev services
├── Dockerfile                       ← production build
│
├── docs/                            ← PROJECT DOCUMENTATION (mandatory)
│   ├── ARCHITECTURE.md              ← system map — every app, model, view registered
│   ├── FLOWCHART.md                 ← visual topology — updated every phase
│   ├── API-REFERENCE.md             ← DRF endpoint documentation (auto + manual)
│   ├── MODULES.md                   ← per-app documentation
│   └── CHANGELOG.md                 ← what changed, when, why
│
├── src/                             ← main Django package
│   ├── __init__.py
│   ├── asgi.py                      ← ProtocolTypeRouter: http + websocket
│   ├── wsgi.py                      ← WSGI fallback
│   ├── urls.py                      ← root URLConf — mounts all app URLs
│   ├── routing.py                   ← imports from src.realtime.routing
│   │
│   ├── settings/                    ← django-split-settings
│   │   ├── __init__.py              ← include() order (see Section 2)
│   │   └── components/
│   │       ├── __init__.py
│   │       ├── paths.py             ← BASE_DIR, directory paths
│   │       ├── env.py               ← python-decouple config loading
│   │       ├── db.py                ← dj-database-url + PostgreSQL + extensions
│   │       ├── redis.py             ← Redis host/port/URL, Celery broker, Channels, Cache
│   │       ├── secrets.py           ← SECRET_KEY, security settings
│   │       ├── cache.py             ← cache framework config, lock timeouts
│   │       ├── celery.py            ← Celery serialization, beat scheduler
│   │       ├── common.py            ← INSTALLED_APPS, MIDDLEWARE, TEMPLATES, i18n
│   │       ├── restframework.py     ← DRF defaults, renderers, pagination, spectacular
│   │       ├── cors.py              ← CORS config
│   │       ├── allauth.py           ← django-allauth providers, magic link
│   │       ├── site.py              ← SITE_ID, domain config
│   │       ├── cloudflare.py        ← Cloudflare domains, tunnels, R2 storage
│   │       ├── email.py             ← email backend (placeholder/commented for now)
│   │       ├── integrations.py      ← Claude API, Twilio, Sentry, team notifications
│   │       ├── local.py             ← optional local overrides (gitignored)
│   │       └── rwanga.py            ← NEW: Rwanga-specific settings (feature flags, etc.)
│   │
│   ├── core/                        ← shared framework app
│   │   ├── models.py                ← BaseModel (timestamps, uuid), abstract mixins
│   │   ├── services.py              ← shared service layer utilities
│   │   ├── constants.py             ← platform-wide constants, enums
│   │   ├── exceptions.py            ← custom exception classes
│   │   ├── permissions.py           ← shared DRF permission classes
│   │   ├── pagination.py            ← custom pagination classes
│   │   ├── serializers.py           ← base serializer mixins
│   │   ├── managers.py              ← custom model managers (soft delete, etc.)
│   │   ├── middleware.py            ← custom middleware (studio context, etc.)
│   │   ├── utils.py                 ← utility functions
│   │   ├── tests/                   ← core test suite
│   │   └── urls.py
│   │
│   ├── accounts/                    ← auth, Studio, ProjectMembership, ConsultantProfile
│   ├── projects/                    ← Project, Scene, Character, Location
│   ├── scripts/                     ← script upload, parsing, breakdown
│   ├── shots/                       ← Shot, Setup, StoryboardFrame
│   ├── floorplans/                  ← FloorPlan (JSON → SVG client-side)
│   ├── reviews/                     ← InlineComment, BibleReview, ReviewSession (3 review systems)
│   ├── scheduling/                  ← ShootDay, ScheduleBlock, CallSheet
│   ├── departments/                 ← Lighting, Sound, Props, Wardrobe, Continuity
│   ├── ai_engine/                   ← AIJob, Celery tasks, Claude SDK, MCP server
│   ├── exports/                     ← scene viewer HTML, PDF generation
│   ├── locations/                   ← location management, Leaflet maps
│   ├── notifications/               ← notification model, delivery
│   ├── realtime/                    ← WebSocket consumers, routing
│   ├── progress/                    ← DB-backed project tracking, agent reports, MCP-exposed
│   └── community/                   ← community review sessions, external reviewer sandbox
│
├── static/                          ← collected static files
│   ├── css/
│   │   ├── bootstrap.rtl.min.css
│   │   ├── rwanga.css
│   │   └── floorplan.css
│   ├── js/
│   │   ├── htmx.min.js
│   │   ├── sortable.min.js
│   │   ├── floorplan-editor.js
│   │   └── rwanga.js
│   └── img/
│
├── templates/                       ← project-level templates
│   ├── base.html
│   ├── components/
│   └── [app templates — see Part 6]
│
├── locale/                          ← i18n translations
│   ├── ckb/                         ← Kurdish Sorani
│   ├── ku/                          ← Kurmanji
│   ├── ar/                          ← Arabic
│   └── en/                          ← English
│
└── tests/                           ← integration + E2E tests
    ├── conftest.py                  ← shared fixtures
    ├── factories.py                 ← model factories (factory_boy)
    └── test_e2e/                    ← end-to-end test suites
```

---

## PART 2: SETTINGS ARCHITECTURE

### 2.1 Settings Load Order (`src/settings/__init__.py`)

```python
from split_settings.tools import include, optional

include(
    'components/paths.py',
    'components/env.py',
    'components/db.py',
    'components/redis.py',
    'components/secrets.py',
    'components/cache.py',
    'components/celery.py',
    'components/common.py',
    'components/site.py',
    'components/allauth.py',
    'components/cloudflare.py',
    'components/email.py',
    'components/restframework.py',
    'components/cors.py',
    'components/integrations.py',
    'components/rwanga.py',
    optional('components/local.py'),
)
```

### 2.2 Settings Component Specifications

#### `paths.py`
```python
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'
```

#### `env.py`
```python
from decouple import config
DJANGO_ENV = config('DJANGO_ENV', default='development')
DEBUG = config('DEBUG', default=True, cast=bool)
```

#### `db.py`
```python
import dj_database_url
from decouple import config

DATABASES = {
    'default': dj_database_url.config(
        default=config('DATABASE_URL', default='postgres://rwanga:rwanga@localhost:5432/rwanga')
    )
}

# Extensions — activate as needed
# DATABASES['default']['OPTIONS'] = {
#     'options': '-c search_path=public',
# }
# Note: Enable these PostgreSQL extensions when features require them:
# - pg_trgm: for Kurdish text search (trigram similarity)
# - PostGIS: for location mapping (when Leaflet integration goes live)
# - uuid-ossp: for UUID primary keys (already handled by Django)
```

#### `redis.py`
```python
from decouple import config

REDIS_HOST = config('REDIS_HOST', default='127.0.0.1')
REDIS_PORT = config('REDIS_PORT', default=6379, cast=int)
REDIS_URL = f'redis://{REDIS_HOST}:{REDIS_PORT}'

# Celery broker
CELERY_BROKER_URL = f'{REDIS_URL}/0'
CELERY_RESULT_BACKEND = 'django-db'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers.DatabaseScheduler'

# Cache
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': f'{REDIS_URL}/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# Channels
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(REDIS_HOST, REDIS_PORT)],
        },
    },
}
```

#### `celery.py`
```python
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
DJANGO_CELERY_BEAT_TZ_AWARE = False

# Rwanga task routes
CELERY_TASK_ROUTES = {
    'src.ai_engine.tasks.*': {'queue': 'ai'},
    'src.scheduling.tasks.*': {'queue': 'scheduling'},
    'src.exports.tasks.*': {'queue': 'exports'},
}
```

#### `common.py`
```python
DJANGO_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
]

THIRD_PARTY_APPS = [
    'channels',
    'rest_framework',
    'drf_spectacular',
    'django_filters',
    'django_htmx',
    'django_celery_beat',
    'django_celery_results',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'corsheaders',
]

LOCAL_APPS = [
    'src.core',
    'src.accounts',
    'src.projects',
    'src.scripts',
    'src.shots',
    'src.floorplans',
    'src.scheduling',
    'src.departments',
    'src.ai_engine',
    'src.exports',
    'src.locations',
    'src.notifications',
    'src.realtime',
    'src.reviews',
    'src.progress',
    'src.community',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    'django_htmx.middleware.HtmxMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'src.core.middleware.StudioContextMiddleware',  # injects active studio
]

ROOT_URLCONF = 'src.urls'
WSGI_APPLICATION = 'src.wsgi.application'
ASGI_APPLICATION = 'src.asgi.application'

LANGUAGE_CODE = 'ckb'  # Kurdish Sorani
TIME_ZONE = 'Asia/Baghdad'
USE_I18N = True
USE_L10N = True
USE_TZ = True
LANGUAGES = [
    ('ckb', 'Kurdish Sorani'),
    ('ku', 'Kurmanji'),
    ('ar', 'Arabic'),
    ('en', 'English'),
]
LOCALE_PATHS = [BASE_DIR / 'locale']

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            'django.template.context_processors.debug',
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
            'django.template.context_processors.i18n',
            'src.core.context_processors.studio_context',
        ],
    },
}]

LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/projects/'
LOGOUT_REDIRECT_URL = '/accounts/login/'
```

#### `restframework.py`
```python
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'src.core.exceptions.unified_exception_handler',
}

# Add browsable API in debug mode
import os
if os.environ.get('DEBUG', 'True') == 'True':
    REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'].append(
        'rest_framework.renderers.BrowsableAPIRenderer'
    )

SPECTACULAR_SETTINGS = {
    'TITLE': 'ڕوانگە API',
    'DESCRIPTION': 'Rwanga — Kurdish Cinema Preproduction Platform',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
```

#### `integrations.py`
```python
from decouple import config

# Claude API (Anthropic)
ANTHROPIC_API_KEY = config('ANTHROPIC_API_KEY', default='')

# Twilio (WhatsApp call sheet delivery)
TWILIO_ACCOUNT_SID = config('TWILIO_ACCOUNT_SID', default='')
TWILIO_AUTH_TOKEN = config('TWILIO_AUTH_TOKEN', default='')
TWILIO_WHATSAPP_NUMBER = config('TWILIO_WHATSAPP_NUMBER', default='')

# Sentry (error tracking)
SENTRY_DSN = config('SENTRY_DSN', default='')

# MCP Server settings (AI agent connectivity)
MCP_SERVER_ENABLED = config('MCP_SERVER_ENABLED', default=False, cast=bool)
MCP_SERVER_PORT = config('MCP_SERVER_PORT', default=8002, cast=int)
```

#### `cloudflare.py`
```python
from decouple import config

# Cloudflare — domains, tunnels, R2 storage
# Clone from HUD2 — same infrastructure
CLOUDFLARE_ACCOUNT_ID = config('CLOUDFLARE_ACCOUNT_ID', default='')
CLOUDFLARE_API_TOKEN = config('CLOUDFLARE_API_TOKEN', default='')

# R2 Storage (S3-compatible)
# AWS_ACCESS_KEY_ID = config('R2_ACCESS_KEY_ID', default='')
# AWS_SECRET_ACCESS_KEY = config('R2_SECRET_ACCESS_KEY', default='')
# AWS_STORAGE_BUCKET_NAME = config('R2_BUCKET_NAME', default='rwanga-media')
# AWS_S3_ENDPOINT_URL = f"https://{CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
# AWS_S3_REGION_NAME = 'auto'
# DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

# Tunnel
# CLOUDFLARE_TUNNEL_TOKEN = config('CLOUDFLARE_TUNNEL_TOKEN', default='')
```

#### `email.py`
```python
# Email backend — placeholder for now
# Uncomment and configure when magic link auth goes live

# EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
# EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
# EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
# EMAIL_USE_TLS = True
# EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
# EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
# DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@rwanga.dev')

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

#### `rwanga.py` (NEW — product-specific)
```python
# Rwanga platform feature flags
RWANGA_MAX_SCENES_FREE = 10
RWANGA_MAX_PROJECTS_FREE = 1
RWANGA_AI_ENABLED = False  # Phase 4
RWANGA_COMMUNITY_ENABLED = False  # Phase 6
SUBSCRIPTION_ENABLED = False  # bypass all subscription checks
RWANGA_EXPORT_OFFLINE = True  # scene viewer exports always work offline
RWANGA_WHATSAPP_ENABLED = False  # activate when Twilio is configured

# Design system
RWANGA_DEFAULT_THEME = 'dark'
RWANGA_DEFAULT_LANGUAGE = 'ckb'
```

### 2.3 Environment Variables (`.env.example`)

```bash
# Django
DJANGO_ENV=development
DEBUG=True
SECRET_KEY=change-me-to-a-real-secret-key

# Database (same host as HUD2)
DATABASE_URL=postgres://rwanga:rwanga@localhost:5432/rwanga

# Redis (same host as HUD2)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Claude API
ANTHROPIC_API_KEY=

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# Sentry
SENTRY_DSN=

# MCP Server
MCP_SERVER_ENABLED=False
MCP_SERVER_PORT=8002

# Email (commented until needed)
# EMAIL_HOST=
# EMAIL_PORT=587
# EMAIL_HOST_USER=
# EMAIL_HOST_PASSWORD=
# DEFAULT_FROM_EMAIL=

# Cache
CACHE_FRAMEWORK_ENABLED=True
```

---

## PART 3: ASGI + ROUTING ARCHITECTURE

### 3.1 `src/asgi.py`
```python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'src.settings')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application
from src.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
```

### 3.2 `src/routing.py`
```python
from src.realtime.routing import websocket_urlpatterns
# Re-export — this is the single import point for asgi.py
```

### 3.3 `src/realtime/routing.py`
```python
from django.urls import re_path
from src.realtime import consumers

websocket_urlpatterns = [
    re_path(r'ws/ai-jobs/(?P<project_id>[^/]+)/$', consumers.AIJobConsumer.as_asgi()),
    re_path(r'ws/notifications/(?P<user_id>[^/]+)/$', consumers.NotificationConsumer.as_asgi()),
]
```

### 3.4 `src/urls.py` (Root URL Configuration)
```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Auth (allauth)
    path('accounts/', include('allauth.urls')),

    # API schema
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    # REST API endpoints (v1)
    path('api/v1/', include([
        path('projects/', include('src.projects.api.urls')),
        path('shots/', include('src.shots.api.urls')),
        path('floorplans/', include('src.floorplans.api.urls')),
        path('scheduling/', include('src.scheduling.api.urls')),
        path('departments/', include('src.departments.api.urls')),
        path('ai/', include('src.ai_engine.api.urls')),
        path('exports/', include('src.exports.api.urls')),
        path('reviews/', include('src.reviews.api.urls')),
        path('community/', include('src.community.api.urls')),
        path('progress/', include('src.progress.api.urls')),
    ])),

    # HTMX + template views (web UI)
    path('', include('src.projects.urls')),
    path('scripts/', include('src.scripts.urls')),
    path('shots/', include('src.shots.urls')),
    path('floorplans/', include('src.floorplans.urls')),
    path('scheduling/', include('src.scheduling.urls')),
    path('departments/', include('src.departments.urls')),
    path('locations/', include('src.locations.urls')),
    path('exports/', include('src.exports.urls')),
    path('notifications/', include('src.notifications.urls')),
    path('reviews/', include('src.reviews.urls')),
    path('community/', include('src.community.urls')),
    path('progress/', include('src.progress.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

**Dual routing pattern:** Every app has TWO URL modules:
- `src/<app>/urls.py` — HTMX template views (web UI)
- `src/<app>/api/urls.py` — DRF API endpoints

This gives you both the HTMX-driven web interface AND a full REST API from day one.

---

## PART 4: APP-BY-APP SPECIFICATIONS

### Standard App Structure

Every app follows this structure:

```
src/<app>/
├── __init__.py
├── apps.py                  ← AppConfig
├── models.py                ← Django models (inherit from core.BaseModel)
├── admin.py                 ← Django admin registration
├── services.py              ← business logic (not in views!)
├── urls.py                  ← HTMX/template URL routes
├── views.py                 ← template views (HTMX partials)
├── forms.py                 ← Django forms
├── api/
│   ├── __init__.py
│   ├── urls.py              ← DRF URL routes
│   ├── views.py             ← DRF ViewSets / APIViews
│   └── serializers.py       ← DRF serializers
├── templates/<app>/         ← app-level templates
├── tests/
│   ├── __init__.py
│   ├── test_models.py       ← model tests
│   ├── test_services.py     ← service layer tests
│   ├── test_views.py        ← template view tests
│   └── test_api.py          ← DRF endpoint tests
└── tasks.py                 ← Celery tasks (if applicable)
```

**Rules:**
- Business logic lives in `services.py`, NOT in views
- Views are thin — call services, return responses
- Every model inherits from `src.core.models.BaseModel`
- Every API endpoint has a corresponding test in `test_api.py`
- Tests are written BEFORE the code (TDD)

### App: `core`

**Purpose:** Shared framework — base models, mixins, services, constants, permissions. The foundation everything else inherits from.

```python
# src/core/models.py
import uuid
from django.db import models

class BaseModel(models.Model):
    """Abstract base for all Rwanga models."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

class SoftDeleteModel(BaseModel):
    """Base model with soft delete support."""
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def soft_delete(self):
        from django.utils import timezone
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])
```

```python
# src/core/permissions.py
from rest_framework.permissions import BasePermission

from src.accounts.models import ProjectMembership

DEPARTMENT_HIERARCHY = {
    'director': 100, 'dp': 80, 'ad': 60,
    'art': 40, 'sound': 40, 'editor': 20,
}

class HasProjectAccess(BasePermission):
    """Check user has active membership in the project."""
    def has_permission(self, request, view):
        project = view.get_project()
        return ProjectMembership.objects.filter(
            user=request.user, project=project, is_active=True
        ).exists()

class HasDepartmentRole(BasePermission):
    """Check crew member has minimum department role."""
    required_role = 'editor'

    def has_permission(self, request, view):
        project = view.get_project()
        membership = ProjectMembership.objects.filter(
            user=request.user, project=project, role_type='crew', is_active=True
        ).first()
        if not membership:
            return False
        return DEPARTMENT_HIERARCHY.get(membership.department_role, 0) >= DEPARTMENT_HIERARCHY[self.required_role]

class IsDirectorOrAbove(HasDepartmentRole):
    required_role = 'director'
```

```python
# src/core/context_processors.py
def studio_context(request):
    """Inject active studio into template context."""
    studio = getattr(request, 'studio', None)
    return {
        'active_studio': studio,
        'RWANGA_THEME': getattr(request, 'theme', 'dark'),
    }
```

```python
# src/core/middleware.py
class StudioContextMiddleware:
    """Resolve active studio from session/URL and attach to request."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Resolve studio from session or URL
        studio_id = request.session.get('active_studio_id')
        if studio_id:
            from src.accounts.models import Studio
            request.studio = Studio.objects.filter(id=studio_id).first()
        else:
            request.studio = None
        request.theme = request.COOKIES.get('rwanga_theme', 'dark')
        return self.get_response(request)
```

### App: `accounts`

| Model | Inherits | Key Fields |
|-------|----------|------------|
| Studio | BaseModel | name, slug, logo, language (default: ckb), timezone (default: Asia/Baghdad), plan, subscription_tier (default: "beta") |
| ProjectMembership | BaseModel | user (FK→User), project (FK→Project), role_type ("crew" / "internal_reviewer"), department_role (nullable — for crew), review_scope (nullable — for internal_reviewer), is_active, invited_by (FK→User), invited_at, accepted_at |
| ConsultantProfile | BaseModel | user (OneToOne→User), is_active, specialization (nullable) |
| ProjectConsultantAssignment | BaseModel | project (FK→Project), consultant (FK→ConsultantProfile), assigned_by (FK→User), status ("active" / "completed") |

**Role system (3 separate models — NOT unified):**
- `ProjectMembership` — crew + internal reviewers. Project-scoped. Has department_role or review_scope.
- `ConsultantProfile` — system-level designation. The paid review authority.
- `ProjectConsultantAssignment` — links a consultant to a specific project engagement.

**Subscription scaffolding:**
- `Studio.subscription_tier` tracks the plan level. Default: "beta" (unlimited).
- Feature flag `SUBSCRIPTION_ENABLED = False` in `src/settings/components/rwanga.py` bypasses all checks.
- When enabled, the system checks Studio tier against limits (projects, scenes, etc.).
- Soft indicators in UI show usage ("3 of 5 projects") without blocking.

**DRF endpoints:**
| Method | URL | Action |
|--------|-----|--------|
| GET | /api/v1/accounts/studios/ | List user's studios |
| POST | /api/v1/accounts/studios/ | Create studio |
| GET | /api/v1/accounts/studios/{id}/members/ | List members |
| POST | /api/v1/accounts/studios/{id}/invite/ | Invite member (crew or internal_reviewer) |
| PATCH | /api/v1/accounts/members/{id}/ | Update role |

**Signup fields:**
- Email = username (no traditional username)
- Additional: nickname, first_name, last_name, gender

### App: `projects`

| Model | Inherits | Key Fields |
|-------|----------|------------|
| Project | BaseModel | studio (FK), title, title_latin, project_type, logline, cover, status |
| Scene | BaseModel | project (FK), number, int_ext, location_name, time_of_day, description, script_text, page_count |
| Character | BaseModel | project (FK), name, description, scenes (M2M) |
| Location | BaseModel | project (FK), name, address, latitude, longitude, photos (JSON), notes |

**DRF endpoints:**
| Method | URL | Action |
|--------|-----|--------|
| GET/POST | /api/v1/projects/ | List/Create projects |
| GET/PATCH/DELETE | /api/v1/projects/{id}/ | Retrieve/Update/Delete |
| GET/POST | /api/v1/projects/{id}/scenes/ | List/Create scenes |
| GET/PATCH/DELETE | /api/v1/projects/{id}/scenes/{id}/ | Scene detail |
| GET | /api/v1/projects/{id}/characters/ | List characters |

### App: `shots`

| Model | Inherits | Key Fields |
|-------|----------|------------|
| Setup | BaseModel | scene (FK), letter, description |
| Shot | BaseModel | scene (FK), setup (FK), number, style, lens, movement, duration, shot_type, description, notes, has_dialogue, order |
| StoryboardFrame | BaseModel | shot (1-to-1), image, annotations (JSON), ai_generated |

**DRF endpoints:**
| Method | URL | Action |
|--------|-----|--------|
| GET/POST | /api/v1/shots/{project_id}/ | List/Create shots |
| GET/PATCH/DELETE | /api/v1/shots/{project_id}/{id}/ | Shot detail |
| PATCH | /api/v1/shots/{project_id}/reorder/ | Drag-and-drop reorder |
| POST | /api/v1/shots/{project_id}/{id}/storyboard/ | Upload storyboard |

### App: `floorplans`

| Model | Inherits | Key Fields |
|-------|----------|------------|
| FloorPlan | BaseModel | scene (FK), name, room_width, room_height, furniture (JSON), cameras (JSON), paths (JSON), ai_generated |

**CRITICAL:** Store structured JSON, render SVG client-side. Never store raw SVG markup.

**DRF endpoints:**
| Method | URL | Action |
|--------|-----|--------|
| GET/POST | /api/v1/floorplans/{project_id}/ | List/Create |
| GET/PATCH | /api/v1/floorplans/{project_id}/{id}/ | Get/Update (JSON payload) |

### App: `reviews` (Three Review Systems)

This app contains all three review systems. They share infrastructure but are functionally separate.

#### System 1: Inline Review (Production Context)

| Model | Inherits | Key Fields |
|-------|----------|------------|
| InlineComment | BaseModel | content_type (GenericFK), object_id, author (FK→User), body, parent (self FK — for threads), visibility ("internal" / "review_visible"), resolved, resolved_by (FK→User) |

**Purpose:** Contextual feedback attached to production objects (scenes, shots, departments).
**Used by:** Crew + internal reviewers.
**Boundaries:** Only ProjectMembership holders can create. Visibility controls who sees it.

#### System 2: Structured Review (Consultation Deliverable)

| Model | Inherits | Key Fields |
|-------|----------|------------|
| BibleReview | BaseModel | project (FK→Project), author (FK→ConsultantProfile), status ("draft" / "in_review" / "delivered"), version, content (JSONField — structured evaluation data) |
| SceneEvaluation | BaseModel | bible_review (FK→BibleReview), scene (FK→Scene), analysis, tension_score, notes, recommendations |
| ReviewDecision | BaseModel | bible_review (FK→BibleReview), scene (nullable FK→Scene), topic, decision_text, status ("proposed" / "locked" / "rejected"), proposed_by (FK→User), locked_by (nullable FK→User), locked_at, rejected_by (nullable FK→User), rejected_at |

**Purpose:** The core business product. Paid consultation deliverable.
**Authority rules (enforced in services.py):**
- **Propose decisions:** Consultant only.
- **Lock decisions:** Consultant OR Director.
- **Reject decisions:** Director only.
- Only users with `ConsultantProfile` + active `ProjectConsultantAssignment` can create/edit BibleReview.

**DRF endpoints:**
| Method | URL | Action |
|--------|-----|--------|
| GET/POST | /api/v1/reviews/bible/{project_id}/ | List/Create bible reviews |
| GET/PATCH | /api/v1/reviews/bible/{project_id}/{id}/ | Review detail |
| GET/POST | /api/v1/reviews/decisions/{review_id}/ | List/Create decisions |
| PATCH | /api/v1/reviews/decisions/{review_id}/{id}/ | Lock/reject decision |

#### System 3: Community Review (External Sandbox)

This system lives in `src/community/` (separate app) but is documented here for architectural clarity. See App: `community` below.

### App: `scheduling`

| Model | Inherits | Key Fields |
|-------|----------|------------|
| ShootDay | BaseModel | project (FK), date, day_number, notes |
| ScheduleBlock | BaseModel | shoot_day (FK), scene (FK), order, time_start, duration, block_type, title, shots (M2M), notes |
| CallSheet | BaseModel | shoot_day (1-to-1), general_call, location (FK), weather_data (JSON), sent_at, pdf |

### App: `departments`

Five sub-modules, one Django app:

| Model | FK Chain | Key Fields |
|-------|----------|------------|
| LightingNote | Shot | note, color_temp, equipment |
| SoundNote | Shot | note, sound_type |
| Prop | Project + M2M Scene | name, category (A/B/C), status, notes, image |
| WardrobeItem | Character + Scene | outfit_name, description, notes, image |
| ContinuityItem | Scene | direction (in/out), description, checked |

### App: `ai_engine`

| Model | Inherits | Key Fields |
|-------|----------|------------|
| AIJob | BaseModel | project (FK), type, status, progress (0-100), step, result (JSON), error |

**Celery tasks:** `src/ai_engine/tasks.py` — each AI feature is a Celery task that updates progress via WebSocket.

**MCP Server:** `src/ai_engine/mcp/` — Model Context Protocol server for AI agent connectivity. Exposes project data and actions to external AI tools.

### App: `realtime`

**Purpose:** Dedicated WebSocket consumers and routing. Centralizes all real-time behavior.

```python
# src/realtime/consumers.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class AIJobConsumer(AsyncJsonWebsocketConsumer):
    """Streams AI job progress to connected clients."""
    async def connect(self):
        self.project_id = self.scope['url_route']['kwargs']['project_id']
        self.group = f'project_{self.project_id}'
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def job_progress(self, event):
        await self.send_json(event)

    async def job_complete(self, event):
        await self.send_json(event)

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Push notifications to individual users."""
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.group = f'user_{self.user_id}'
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def notification(self, event):
        await self.send_json(event)
```

### App: `exports`

**Scene Viewer Export:** Self-contained HTML, zero external dependencies, works offline.

**DRF endpoints:**
| Method | URL | Action |
|--------|-----|--------|
| GET | /api/v1/exports/scene-viewer/{scene_id}/ | Download standalone HTML |
| GET | /api/v1/exports/call-sheet/{shoot_day_id}/ | Download PDF |
| GET | /api/v1/exports/shot-list/{project_id}/ | Download PDF |

### App: `community` (Community Review — External Sandbox)

| Model | Inherits | Key Fields |
|-------|----------|------------|
| ReviewSession | BaseModel | project (FK→Project), title, session_type ("screenplay" / "bible" / "scene_selection"), status ("draft" / "open" / "closed"), created_by (FK→User), visibility ("invite_only" / "public") |
| SessionContent | BaseModel | session (FK→ReviewSession), content_type ("screenplay" / "scene" / "bible"), content_data (JSONField — frozen snapshot), label (CharField), order, version (default 1) |
| ReviewSessionParticipant | BaseModel | user (FK→User), session (FK→ReviewSession), role ("external_reviewer"), invited_by (FK→User), invited_at, accepted_at, is_active |
| SessionComment | BaseModel | session_content (FK→SessionContent), author (FK→User), anchor_type ("line" / "paragraph" / "scene" / "general"), anchor_ref (CharField), body, parent (self FK — threads) |
| SessionReaction | BaseModel | comment (FK→SessionComment), author (FK→User), reaction_type ("agree" / "disagree" / "question") |

**CRITICAL ISOLATION RULES:**
- `SessionContent.content_data` is a **frozen JSON snapshot**. No live FK to production objects.
- No `source_id`. No FK dependency on project models. No navigation back to project.
- `ReviewSessionParticipant` has NO FK to Project or ProjectMembership.
- External reviewers see ONLY: ReviewSession, SessionContent, SessionComment, SessionReaction.
- External reviewers NEVER see: project workspace, production data, inline comments, bible reviews.

**UX model:**
- Director creates session from project workspace → selects content to share → system snapshots it → invites external reviewers.
- External reviewers receive invitation link → land directly in session view (sandboxed) → comment and react.
- Session view: shared content on left, comment threads on right. No project navigation.
- "Studio = project workspace. Session = screening room. Different doors, different rules."

**DRF endpoints:**
| Method | URL | Action |
|--------|-----|--------|
| GET/POST | /api/v1/community/sessions/{project_id}/ | List/Create sessions |
| GET/PATCH | /api/v1/community/sessions/{project_id}/{id}/ | Session detail/close |
| POST | /api/v1/community/sessions/{id}/invite/ | Invite external reviewer |
| GET/POST | /api/v1/community/sessions/{id}/comments/ | List/Create comments |
| POST | /api/v1/community/sessions/{id}/comments/{id}/react/ | Add reaction |

### App: `progress` (DB-Backed Project Tracking — Phase 0 Mandatory)

**Purpose:** Real-time project state visible to Darya (web UI) and AI agents (MCP). This is the source of truth for all implementation tracking. Markdown docs are generated exports.

| Model | Inherits | Key Fields |
|-------|----------|------------|
| ProgressTask | BaseModel | title, description, task_type ("implementation" / "design" / "infrastructure" / "documentation" / "testing"), phase, app_name (nullable), status ("pending" / "in_progress" / "completed" / "blocked"), priority ("critical" / "high" / "normal" / "low"), assigned_to, blocked_by (M2M self) |
| ProgressUpdate | BaseModel | task (nullable FK→ProgressTask), author, update_type ("status_change" / "implementation" / "fix" / "note" / "question"), body, files_affected (JSONField), tests_run (JSONField) |
| DesignDecision | BaseModel | title, context, decision, alternatives_considered (nullable), decided_by, phase, app_name (nullable), status ("proposed" / "approved" / "superseded"), superseded_by (nullable self FK) |
| AgentReport | BaseModel | agent_name, session_id, report_type ("phase_completion" / "blocker" / "progress" / "handoff"), phase, summary, tasks_completed (M2M→ProgressTask), tasks_blocked (M2M→ProgressTask), gaps_found (M2M→GapBlocker) |
| GapBlocker | BaseModel | title, description, gap_type ("design_gap" / "spec_unclear" / "dependency_missing" / "technical_blocker" / "question_for_owner"), severity ("critical" / "major" / "minor"), related_task (nullable FK→ProgressTask), related_app (nullable), phase, status ("open" / "resolved" / "deferred"), resolution (nullable), resolved_at (nullable) |
| ChangeRecord | BaseModel | task (nullable FK→ProgressTask), change_type ("model_added" / "model_modified" / "view_added" / "url_added" / "test_added" / "config_changed" / "migration_run" / "dependency_added"), app_name, description, files_changed (JSONField), diff_summary (nullable), commit_hash (nullable) |
| SystemDiagram | BaseModel | title, diagram_type ("architecture" / "topology" / "dependency_graph" / "data_model" / "flow"), phase, content (TextField — Mermaid or SVG), render_format ("mermaid" / "svg"), is_current (BooleanField), notes (nullable) |
| DocumentVersion | BaseModel | document_name, version, content (TextField), changed_by, change_summary, phase |

**URL patterns:**
```
/progress/                          → dashboard (summary of all sections)
/progress/tasks/                    → full task list with filters
/progress/tasks/<id>/               → task detail with linked updates
/progress/updates/                  → chronological feed
/progress/diagrams/                 → current system diagrams
/progress/flowchart/                → current flowchart
/progress/decisions/                → design decisions
/progress/gaps/                     → open gaps and blockers
/progress/agent-reports/            → agent session reports
/progress/changelog/                → change records
/progress/docs/                     → document versions
```

**DRF endpoints (agent-writable):**
| Method | URL | Action |
|--------|-----|--------|
| GET/POST | /api/v1/progress/tasks/ | List/Create tasks |
| GET/PATCH | /api/v1/progress/tasks/{id}/ | Task detail/update |
| POST | /api/v1/progress/updates/ | Record update |
| POST | /api/v1/progress/gaps/ | Report gap |
| POST | /api/v1/progress/agent-reports/ | Submit report |
| POST | /api/v1/progress/changes/ | Record change |
| POST | /api/v1/progress/decisions/ | Record decision |
| POST | /api/v1/progress/diagrams/ | Update diagram |

**Permissions:**
- Darya (superuser): full read/write
- Agents: write via API/MCP, read everything
- Normal platform users: no access (403)

**MCP integration:** Full MCP resources + tools exposed. See MCP-SERVER-SPEC.md Section 9.

**Documentation flow:**
```
Progress DB (source of truth)
    → Web UI (for Darya to browse)
    → MCP (for AI agents to read/write)
    → Management command exports → docs/*.md (generated artifacts)
```

---

## PART 5: IMPLEMENTATION PHASES

### Phase 0 — Skeleton + Infrastructure + Progress App (Foundation)

**Goal:** Cloned, booting, all services connected, progress tracking live. No domain logic yet.

```
TASKS:
[ ] P0.1  Clone HUD2 skeleton to new rwanga/ repository
[ ] P0.2  Strip all HUD2 domain apps from LOCAL_APPS
[ ] P0.3  Create .env from HUD2's .env (update DB name to 'rwanga')
[ ] P0.4  Add rwanga.py settings component (feature flags incl. SUBSCRIPTION_ENABLED=False)
[ ] P0.5  Create src/core/ app (BaseModel, SoftDeleteModel, permissions, middleware)
[ ] P0.6  Write tests for core models (test_models.py)
[ ] P0.7  Create src/progress/ app (all 8 models, admin, basic views, API endpoints)
[ ] P0.8  Write tests for progress models and API
[ ] P0.9  Verify progress dashboard renders at /progress/
[ ] P0.10 Run validation checklist:
          [ ] Django runserver starts
          [ ] ASGI boot succeeds (daphne)
          [ ] Celery worker boots and connects to Redis
          [ ] Redis connection works
          [ ] Cache backend reachable
          [ ] PostgreSQL connection works
          [ ] DRF browsable API returns 403 (auth required)
          [ ] WebSocket handshake succeeds on test route
          [ ] /progress/ dashboard renders
[ ] P0.11 Record all P0 work in Progress app (first entries)
[ ] P0.12 Create initial SystemDiagram (architecture type)

DELIVERABLES:
- Booting Django app with all services connected
- Progress app live with web UI and API
- No domain models yet — just infrastructure + tracking
- All P0 tests passing
- First ProgressTask entries recorded
```

### Phase 1 — Base Template + Auth + Project CRUD

**Goal:** A user can log in, create a studio, create a project with scenes.

```
TASKS:
[ ] P1.1  Create src/accounts/ app
          [ ] Write test_models.py for Studio, ProjectMembership
          [ ] Implement models
          [ ] Write test_api.py for studio CRUD, invite
          [ ] Implement DRF serializers + viewsets
          [ ] Implement template views (login, register, team)
[ ] P1.2  Create base.html
          [ ] BS5 RTL layout with design tokens from design-plan.md
          [ ] Icon sidebar (64px rail) component
          [ ] Top navigation bar component
          [ ] Dark/light theme toggle
          [ ] Cairo + Inter fonts
          [ ] Kurdish RTL stress test (mixed Kurdish + English technical terms)
[ ] P1.3  Create rwanga.css with all design tokens
[ ] P1.4  Create src/projects/ app
          [ ] Write test_models.py for Project, Scene, Character, Location
          [ ] Implement models
          [ ] Write test_api.py for project CRUD, scene CRUD
          [ ] Implement DRF serializers + viewsets
          [ ] Implement template views (list, dashboard, create wizard)
[ ] P1.5  Create scene_view.html (tabbed interface shell — tabs exist, content empty)
[ ] P1.6  Create src/reviews/ app (InlineComment model, BibleReview shell, ReviewDecision model)
          [ ] Write test_models.py for all review models
          [ ] Implement models
          [ ] Write test_services.py for decision authority rules
          [ ] Implement ReviewService with authority enforcement
          [ ] Implement DRF serializers + viewsets
[ ] P1.7  Wire InlineComment into scene view (comment sidebar/panel)
[ ] P1.8  Implement project-as-workspace UX:
          [ ] Dashboard = lobby (owned projects, member projects, invitations)
          [ ] Project entry = full context switch (project-scoped navigation)
          [ ] Clear "Back to Dashboard" / "Exit Project" in header
          [ ] Deep link handling (direct URL to scene loads project context)
[ ] P1.9  TV-first validation: test all sizes at 1920×1080
[ ] P1.10 Update ARCHITECTURE.md, FLOWCHART.md, CHANGELOG.md

DELIVERABLES:
- Login → create studio → create project → add scenes
- Scene view shell with empty tabs
- Review models with authority enforcement
- Project-as-workspace navigation
- Full DRF API for projects + scenes + reviews
- All P1 tests passing
- Documentation updated
```

### Phase 2 — Shot List + Floor Plan + Export (MVP Core)

**Goal:** A director can enter shots, place cameras, and export a scene viewer.

```
TASKS:
[ ] P2.1  Create src/shots/ app
          [ ] Write test_models.py for Setup, Shot, StoryboardFrame
          [ ] Implement models
          [ ] Write test_api.py for shot CRUD, reorder, filter
          [ ] Implement DRF serializers + viewsets
          [ ] Implement HTMX views (inline edit, filter)
          [ ] Build scenes/tabs/shots.html partial
[ ] P2.2  Create src/floorplans/ app
          [ ] Write test_models.py for FloorPlan (JSON storage)
          [ ] Implement model
          [ ] Write test_api.py for CRUD + JSON save/load
          [ ] Implement DRF serializers + viewsets
          [ ] Build floorplan-editor.js (vanilla JS SVG editor)
          [ ] Build scenes/tabs/floorplan.html partial
[ ] P2.3  Create src/exports/ app
          [ ] Write test for scene viewer generation
          [ ] Implement scene viewer HTML generator
          [ ] Verify offline functionality (zero external deps)
          [ ] Build scenes/tabs/overview.html partial
[ ] P2.4  Wire Sortable.js for shot reorder (test RTL!)
[ ] P2.5  Build project dashboard (stats, quick access)
[ ] P2.6  Update ARCHITECTURE.md, FLOWCHART.md, API-REFERENCE.md

DELIVERABLES:
- Shot list with HTMX inline editing + filters
- Interactive floor plan editor (drag cameras, furniture, paths)
- Scene viewer export (offline HTML)
- DRF API for shots + floor plans + exports
- All P2 tests passing
```

### Phase 3 — Department Modules (Complete Scene View)

**Goal:** Every department tab works. Scene view is the full preproduction workspace.

```
TASKS:
[ ] P3.1  Create src/departments/ app
          [ ] Write test_models.py for ALL 5 sub-modules
          [ ] Implement models (Lighting, Sound, Props, Wardrobe, Continuity)
          [ ] Write test_api.py for all department endpoints
          [ ] Implement DRF serializers + viewsets
[ ] P3.2  Build tab templates:
          [ ] scenes/tabs/lighting.html (color temp bar, per-shot grid)
          [ ] scenes/tabs/sound.html (golden rule, track setup, critical moments)
          [ ] scenes/tabs/props.html (categorized checklist, HTMX toggle)
          [ ] scenes/tabs/wardrobe.html (character outfit cards)
          [ ] scenes/tabs/continuity.html (scene flow, in/out checklists)
[ ] P3.3  Build scenes/tabs/storyboard.html (upload-only grid, Sortable.js)
[ ] P3.4  Update scene viewer export to include ALL department data
[ ] P3.5  Update ARCHITECTURE.md, FLOWCHART.md, API-REFERENCE.md

DELIVERABLES:
- Complete 10-tab scene view
- All department DRF endpoints
- Updated scene viewer export with full data
- All P3 tests passing
```

### Phase 4 — Scheduling + Call Sheets + Locations

**Goal:** The platform manages a shoot day, not just a scene.

```
TASKS:
[ ] P4.1  Create src/scheduling/ app
          [ ] Models + tests + DRF + views
          [ ] Stripboard UI with Sortable.js (RTL)
          [ ] Schedule tab template
[ ] P4.2  Call sheet generation
          [ ] WeasyPrint PDF generation
          [ ] WhatsApp delivery via Twilio (Celery task)
          [ ] test_tasks.py for WhatsApp delivery
[ ] P4.3  Create src/locations/ app
          [ ] Leaflet.js/OSM map integration
          [ ] Photo gallery per location
[ ] P4.4  Create src/notifications/ app
          [ ] Notification model + feed
          [ ] Wire to WebSocket via src/realtime/
[ ] P4.5  Update documentation

DELIVERABLES:
- Shooting schedule with stripboard
- Call sheets → PDF → WhatsApp
- Location management with maps
- In-app notifications
```

### Phase 5 — AI Engine + MCP Server

**Goal:** AI eliminates grunt work. MCP server enables agent connectivity.

```
TASKS:
[ ] P5.1  Create src/ai_engine/ app
          [ ] AIJob model + tests
          [ ] Celery tasks for async AI work
          [ ] Claude SDK wrapper (src/ai_engine/client.py)
          [ ] Kurdish-tuned prompts (src/ai_engine/prompts.py)
[ ] P5.2  AI Script Breakdown
          [ ] Upload Kurdish screenplay → Claude parses
          [ ] Director review + approve tags
[ ] P5.3  AI Floor Plan Generation
          [ ] Describe room → get JSON floor plan
[ ] P5.4  AI Schedule Optimization
          [ ] Suggest shooting order with explanation
[ ] P5.5  MCP Server
          [ ] Expose project data + actions for external AI agents
          [ ] Authentication + authorization for MCP connections
[ ] P5.6  WebSocket progress for all AI jobs
[ ] P5.7  Update documentation

DO NOT BUILD: AI storyboard generation (deferred indefinitely)
```

### Phase 6 — Community Reviews + Bible Review Output

**Goal:** The community review sandbox and the professional review output format go live.

```
TASKS:
[ ] P6.1  Create src/community/ app
          [ ] ReviewSession, SessionContent, ReviewSessionParticipant, SessionComment, SessionReaction models
          [ ] Snapshot system (freeze content from project into SessionContent JSON)
          [ ] DRF endpoints + template views
          [ ] External reviewer invitation flow
          [ ] Sandboxed session view (isolated from project workspace)
          [ ] Verify isolation: no FK leakage, no project navigation from session
[ ] P6.2  Professional Review output
          [ ] Interactive HTML review embedded in dashboard (based on proven bible review format)
          [ ] BibleReview → rendered output (HTML + PDF)
          [ ] Review template system
[ ] P6.3  Update Progress app with all changes
```

### Phase 7 — Scale + Polish (Ongoing)

```
[ ] P7.1  PWA service worker for offline access
[ ] P7.2  Multi-language via django.utils.translation (human-verified .po files)
[ ] P7.3  Budget module
[ ] P7.4  Performance optimization for large projects (50+ scenes)
[ ] P7.5  Mobile-responsive refinements
[ ] P7.6  Celery Beat scheduled tasks (backup exports, cleanup)
```

---

## PART 6: DOCUMENTATION REQUIREMENTS

### Mandatory Documentation Files

| File | Contents | Updated When |
|------|----------|-------------|
| `docs/ARCHITECTURE.md` | System map — every app, model, view, URL registered | Every phase completion |
| `docs/FLOWCHART.md` | Visual topology — data flow diagrams, app dependencies | Every phase completion |
| `docs/API-REFERENCE.md` | Every DRF endpoint with request/response examples | Every new endpoint |
| `docs/MODULES.md` | Per-app documentation — purpose, models, services, tests | Every new app |
| `docs/CHANGELOG.md` | What changed, when, why | Every commit |

### Source of Truth

The Progress app (`src/progress/`) is the **primary source of truth** for project state. The `docs/` markdown files are **generated exports**.

**Flow:**
1. Agent updates Progress app (via API or MCP tools)
2. Management command generates markdown exports:
   ```bash
   python manage.py export_progress --type=architecture --output=docs/ARCHITECTURE.md
   python manage.py export_progress --type=changelog --output=docs/CHANGELOG.md
   python manage.py export_progress --type=flowchart --output=docs/FLOWCHART.md
   ```
3. Markdown docs are committed alongside code changes

**Never edit `docs/*.md` directly.** Always update the Progress app first.

### Code Documentation Standards

```python
# Every module: module-level docstring
"""
src.shots.services
~~~~~~~~~~~~~~~~~~

Business logic for shot management.
Handles shot CRUD, reordering, filtering, and export preparation.

Dependencies:
    - src.projects.models.Scene
    - src.shots.models.Shot, Setup
"""

# Every class: class docstring
class ShotService:
    """
    Service layer for Shot operations.

    Responsibilities:
        - Shot CRUD with validation
        - Reorder shots within a scene (maintains `order` field)
        - Filter shots by type, setup, movement
        - Prepare shot data for export

    Usage:
        service = ShotService(scene=scene)
        shots = service.list_shots(shot_type='dialogue')
        service.reorder(shot_ids=['uuid1', 'uuid2', 'uuid3'])
    """

# Every function: function docstring
def reorder(self, shot_ids: list[str]) -> None:
    """
    Reorder shots within the scene.

    Args:
        shot_ids: Ordered list of Shot UUIDs representing desired order.

    Raises:
        ValidationError: If any UUID doesn't belong to this scene.

    Side effects:
        Updates `order` field on all specified Shot instances.
    """
```

### TDD Workflow

For every piece of code:

1. **Write the test first** (`tests/test_*.py`)
2. **Run the test — confirm it fails** (red)
3. **Write the minimum code to pass** (green)
4. **Refactor** (clean)
5. **Document** (docstring + ARCHITECTURE.md entry)

```python
# Example TDD for Shot model
# tests/test_models.py — WRITE THIS FIRST
class TestShotModel:
    def test_create_shot(self, scene_factory):
        """A shot can be created with required fields."""
        scene = scene_factory()
        shot = Shot.objects.create(
            scene=scene,
            number='12.1',
            style='لێدانی ناوەندی',
            shot_type='dialogue',
        )
        assert shot.id is not None
        assert shot.number == '12.1'

    def test_shot_ordering(self, scene_factory):
        """Shots are ordered by the `order` field."""
        scene = scene_factory()
        s2 = Shot.objects.create(scene=scene, number='12.2', order=2, shot_type='visual')
        s1 = Shot.objects.create(scene=scene, number='12.1', order=1, shot_type='dialogue')
        shots = list(scene.shots.all())
        assert shots[0] == s1
        assert shots[1] == s2

    def test_shot_inherits_base_model(self, scene_factory):
        """Shot has UUID pk and timestamps from BaseModel."""
        scene = scene_factory()
        shot = Shot.objects.create(scene=scene, number='12.1', shot_type='visual')
        assert isinstance(shot.id, uuid.UUID)
        assert shot.created_at is not None
        assert shot.updated_at is not None
```

### Test Infrastructure

```python
# tests/conftest.py
import pytest
from tests.factories import StudioFactory, UserFactory, ProjectFactory, SceneFactory

@pytest.fixture
def studio_factory():
    return StudioFactory

@pytest.fixture
def user_factory():
    return UserFactory

@pytest.fixture
def project_factory():
    return ProjectFactory

@pytest.fixture
def scene_factory():
    return SceneFactory
```

```python
# tests/factories.py
import factory
from src.accounts.models import Studio, ProjectMembership
from src.projects.models import Project, Scene

class StudioFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Studio
    name = factory.Sequence(lambda n: f'Studio {n}')
    slug = factory.Sequence(lambda n: f'studio-{n}')

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = 'auth.User'
    username = factory.Sequence(lambda n: f'user{n}')
    email = factory.LazyAttribute(lambda o: f'{o.username}@test.com')

class ProjectFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Project
    studio = factory.SubFactory(StudioFactory)
    title = factory.Sequence(lambda n: f'Film {n}')
    project_type = 'feature'

class SceneFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Scene
    project = factory.SubFactory(ProjectFactory)
    number = factory.Sequence(lambda n: n + 1)
    int_ext = 'INT'
    location_name = 'باغی ماڵ'
    time_of_day = 'ئێوارە'
```

### Requirements Baseline

```
# Platform (clone from HUD2)
Django>=5.0
asgiref
channels
channels-redis
daphne
celery
django-celery-beat
django-celery-results
redis
django-redis
djangorestframework
drf-spectacular
django-filter
dj-database-url
python-decouple
django-allauth
django-htmx
django-split-settings
psycopg2-binary
corsheaders
whitenoise
gunicorn

# Product-specific
anthropic                    # Claude API
Pillow                       # Image handling
weasyprint                   # PDF generation
django-storages[boto3]       # S3/R2 media storage
twilio                       # WhatsApp delivery

# Testing
pytest
pytest-django
factory-boy
pytest-cov

# Development
django-debug-toolbar
ipython
```

---

## PART 7: CRITICAL RULES

1. **`src/` is the package name.** Do not rename.
2. **Clone from `/e/api/hud2/`.** Copy settings, .env, infrastructure. Same machine, same hosts.
3. **django-split-settings.** Never collapse to one settings file.
4. **DRF is mandatory.** Every app gets `api/urls.py` + `api/views.py` + `api/serializers.py` from day one.
5. **Business logic in `services.py`**, not views. Views are thin.
6. **TDD.** Test first, code second. No exceptions.
7. **i18n-first, RTL-ready.** No hardcoded UI text. All strings through `{% trans %}` / `gettext`. Development language is English. Kurdish/Arabic are translation layers. CSS logical properties only. Test RTL continuously.
8. **Floor plans store JSON, not SVG.** Render client-side.
9. **Scene viewer exports work offline.** Zero external dependencies.
10. **No AI Kurdish translation.** Human-verified .po files only.
11. **No JS frameworks.** HTMX + BS5 + vanilla JS.
12. **WebSocket consumers live in `src/realtime/`.** Not scattered across apps.
13. **Settings components for future use stay commented.** Don't delete — activate later.
14. **MCP server readiness.** The AI engine must expose an MCP interface for agent connectivity.
15. **Three review systems are separate.** Inline (contextual), Structured (consultation), Community (sandbox). Never mix their models or UI.
16. **Progress app is mandatory.** Update DB-backed Progress app before moving on. Every task, change, gap, and decision is recorded. Markdown docs are generated exports, not source of truth.
17. **MCP Progress integration.** All agents read project state via MCP progress resources. Write updates via MCP tools or API. No implementation step is complete until reflected in the Progress system.
18. **Git/worktree discipline.** Commit after every completed task. Merge/rebase to main. Report branch, worktree path, commit hash, phase. No long-running detached branches. No continuing to next task with completed work isolated in a branch.
19. **No guessing, no inventions, no silent shortcuts.** If the spec is unclear, a model is missing, a permission gap exists, or a workflow contradicts — STOP and report a GapBlocker in the Progress app. Then move to the next unblocked task.
20. **Project is a workspace.** Dashboard is the lobby. Entering a project switches full navigation context. Clear exit back to dashboard. Deep links auto-load project context.
21. **Subscription scaffolding from day one.** Feature flag `SUBSCRIPTION_ENABLED = False`. Studio has subscription_tier. Soft indicators in UI. No enforcement until billing model is decided.

---

## PART 8: REFERENCE FILES

| File | Location | Purpose |
|------|----------|---------|
| `MASTER-DESIGN.md` | `design/` | THIS FILE — the complete blueprint |
| `HUD2-SKELETON-CLONE-MANUAL.md` | `design/` | Django skeleton clone procedure |
| `design-plan.md` | `design/` | Design plan v0.1 (vision, modules, UI specs) |
| `BACKEND_SPEC.md` | `design/` | Backend spec (URLs, models, HTMX patterns, tokens) |
| `Platform Prototype.html` | `design/` | Visual prototype — design reference only, NOT production code |
| `Platform Preview.html` | `design/` | Earlier visual prototype |
| `RWANGA-VISION.md` | workspace root | Business vision (3 pillars, business model, market) |
| `RWANGA-IMPLEMENTATION-PLAN.md` | workspace root | Supplementary implementation notes |

---

## PART 9: STARTUP COMMANDS

After clone and setup, these commands must all succeed:

```bash
# Django dev server
python manage.py runserver

# Celery worker
celery -A src worker -l info -Q default,ai,scheduling,exports

# Celery beat (scheduled tasks)
celery -A src beat -l info

# ASGI/Daphne (WebSocket)
daphne src.asgi:application -b 0.0.0.0 -p 8001

# Run tests
pytest --cov=src

# Generate API schema
python manage.py spectacular --file docs/schema.yml
```

---

## PART 10: VALIDATION CHECKLIST

After each phase, run this checklist:

```
[ ] Django runserver starts without errors
[ ] ASGI boot succeeds (daphne)
[ ] Celery worker boots and connects to Redis
[ ] Redis connection works (cache + broker + channels)
[ ] PostgreSQL connection works
[ ] All tests pass (pytest --cov)
[ ] DRF browsable API works in debug mode
[ ] WebSocket handshake succeeds
[ ] Progress app updated (tasks, changes, gaps recorded)
[ ] Progress dashboard reflects current state at /progress/
[ ] All work committed to main (no isolated branches)
[ ] docs/ markdown exports regenerated from Progress DB
[ ] No undocumented models, views, or functions
[ ] RTL layout renders correctly in Kurdish
```

---

*Questions? Contact Darya at daryabsb@gmail.com. Do not improvise on the rules in Part 7.*
