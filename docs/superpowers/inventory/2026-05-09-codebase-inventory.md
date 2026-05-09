# Rwanga Django Project — Codebase Inventory
**Generated:** 2026-05-09  
**Purpose:** Complete structural overview for post-UI-migration controller to plan correction + design-system application pass.

---

## PROJECT LAYOUT

```
E:/api/rwanga/
├── src/                    # Django app source code (all apps listed below)
├── templates/              # Root-level HTML templates (shared components, base.html)
├── static/                 # CSS, JS, vendor assets (Bootstrap, HTMX, custom)
├── locale/                 # Internationalization files (Kurdish, Arabic, English)
├── manage.py               # Django management entry point
├── manage.py               # Development/production runner
├── docs/                   # Documentation (design specs, plans, decisions, inventory)
├── docs/superpowers/       # Superpowers documentation folder
├── Projects/               # Secondary design workspace (archived specs)
├── rwanga-design-kit/      # FROZEN design-system workspace (DO NOT MODIFY)
├── staticfiles/            # Collected static files (production)
└── [config files]          # setup.py, requirements.txt, .env, docker, etc.
```

---

## SETTINGS CONFIGURATION

All settings assembled via split_settings from `src/settings/__init__.py`:

### Common Settings (`components/common.py`)
**INSTALLED_APPS (14 Django + 9 third-party + 12 local):**
- Django: daphne, admin, auth, contenttypes, sessions, messages, staticfiles, sites
- Third-party: channels, rest_framework, rest_framework.authtoken, drf_spectacular, django_filters, django_htmx, django_celery_beat, django_celery_results, allauth, allauth.account, corsheaders
- Local: core, accounts, projects, reviews, scripts, shots, floorplans, scheduling, departments, ai_engine, realtime, exports, locations, notifications, progress, community

**MIDDLEWARE (in order):**
1. SecurityMiddleware
2. WhiteNoiseMiddleware
3. CorsMiddleware
4. SessionMiddleware
5. CommonMiddleware
6. CsrfViewMiddleware
7. AuthenticationMiddleware
8. AllAuth AccountMiddleware
9. DjangoHTMX HtmxMiddleware
10. MessagesMiddleware
11. XFrameOptionsMiddleware
12. StudioContextMiddleware (custom)

**Auth & URLs:**
- AUTH_USER_MODEL: accounts.User (email-based, no username)
- LOGIN_URL: /accounts/login/
- LOGIN_REDIRECT_URL: /projects/
- AUTHENTICATION_BACKENDS: Django ModelBackend + AllAuth EmailBackend

**Localization:**
- LANGUAGE_CODE: ckb (Kurdish Sorani, default)
- LANGUAGES: ckb, ku, ar, en
- USE_I18N: True, USE_L10N: True, USE_TZ: True
- TIME_ZONE: Asia/Baghdad

**Template Context Processors:**
- studio_context (active_studio, RWANGA_THEME from middleware)
- navigation_context (nav_mode, pending_decisions_count, active_sessions_count)

### AllAuth Configuration (`components/allauth.py`)
- EMAIL_VERIFICATION: optional
- SIGNUP_FIELDS: email, password1, password2
- LOGIN_ON_EMAIL_CONFIRMATION: True

### Rwanga Feature Flags (`components/rwanga.py`)
- MAX_SCENES_FREE: 10, MAX_PROJECTS_FREE: 1
- AI_ENABLED: False, COMMUNITY_ENABLED: False
- EXPORT_OFFLINE: True, WHATSAPP_ENABLED: False
- DEFAULT_THEME: dark, DEFAULT_LANGUAGE: ckb

### Other Components
- **db.py:** PostgreSQL database config
- **redis.py:** Redis caching & session backend
- **cache.py:** Redis-backed cache
- **celery.py:** Async task queue config
- **email.py:** Email backend config
- **restframework.py:** DRF permissions, pagination, filtering
- **cors.py:** CORS origin allowlisting
- **cloudflare.py:** Cloudflare integration settings
- **integrations.py:** External service configs (AI providers, webhooks)
- **ai_engine.py:** AI engine-specific settings
- **secrets.py:** Environment secrets loading

---

## ROOT URL CONFIGURATION (`src/urls.py`)

**Landing & Admin:**
- `/` → landing_view (redirects authenticated users to /projects/, renders landing.html for anonymous)
- `/admin/` → Django admin site

**API & Docs:**
- `/api/schema/` → SpectacularAPIView (OpenAPI schema)
- `/api/docs/` → SpectacularSwaggerView (Swagger UI)
- `/api/v1/health/` → HealthAPIView (status check)

**API Routes:**
- `/api/v1/accounts/` → accounts API routes
- `/api/v1/projects/` → projects API routes
- `/api/v1/progress/` → progress tracking API

**HTML Routes (app-level includes):**
- `/accounts/` → accounts URLs + allauth URLs
- `/projects/` → projects workspace (dashboard, scenes, reviews)
- `/scripts/` → script management & breakdown
- `/shots/` → shot list & storyboarding
- `/floorplans/` → floor plan editor & list
- `/scheduling/` → shoot day & call sheet planning
- `/locations/` → location database & mapping
- `/departments/` → lighting, sound, wardrobe, props, continuity
- `/reviews/` → bible reviews, decisions, workbench
- `/ai/` → AI job management
- `/exports/` → document export (call sheets, scene lists)
- `/notifications/` → notification panel
- `/community/` → community review sessions
- `/progress/` → project progress tracking

---

## CORE INFRASTRUCTURE (`src/core/`)

### Models (`src/core/models.py`)
- **BaseModel** (abstract): UUID primary key, created_at, updated_at timestamps
- **SoftDeleteManager**: Custom manager filtering is_deleted=False by default
- **SoftDeleteModel** (abstract): Extends BaseModel, adds is_deleted flag, deleted_at timestamp, soft_delete() method, exposes all_objects for unfiltered queries

### Middleware (`src/core/middleware.py`)
- **StudioContextMiddleware**: Attaches request.studio=None, request.theme from rwanga_theme cookie (default "dark")

### Context Processors (`src/core/context_processors.py`)
- **studio_context**: Exports active_studio, RWANGA_THEME to templates
- **navigation_context**: For authenticated users, computes nav_mode (reviews|community|None), pending_decisions_count, active_sessions_count; requires access to ReviewDecision & ReviewSession models

### Tests (`src/core/tests/`)
- test_models.py: Tests BaseModel and SoftDeleteModel behavior

---

## APP INVENTORY

### ACCOUNTS

**Models** (`models.py`):
- **User** (AbstractBaseUser, PermissionsMixin): Custom auth user with email as USERNAME_FIELD
  - email (unique), name, terms (bool), image, pin, is_active, is_staff, must_change_password_on_first_login
  - UserManager: create_user, create_superuser
  
- **Studio** (BaseModel): Workspace/organization container
  - name, slug (unique), logo, language (default ckb), timezone, plan, subscription_tier
  - Meta: ordering=["name"]
  
- **ProjectMembership** (BaseModel): Links users to projects with roles
  - user → User, project → projects.Project, role (production_team|reviewer|community|full_access)
  - role_type (crew|internal_reviewer), department_role (director|dp|ad|art|sound|editor)
  - review_scope, is_active, invited_by → User, invited_at, accepted_at
  
- **ConsultantProfile** (BaseModel): Marks users as consultants for reviews
  - user (1:1) → User, is_active, specialization
  
- **ProjectConsultantAssignment** (BaseModel): Assigns consultants to projects
  - project → projects.Project, consultant → ConsultantProfile, assigned_by → User
  - status (active|completed)
  
- **SignupProfile** (BaseModel): Onboarding data
  - user (1:1) → User, nickname, gender (male|female|other)

**Managers** (`managers.py`):
- UserManager.create_user(email, password, name, terms, **extra_fields)
- UserManager.create_superuser(email, password, **extra_fields)

**Services** (`services.py`):
- [Not fully inventoried; see test files for patterns]

**Views** (`views.py` & `urls.py`):
- LoginView: AllAuth-based email login → accounts/login.html
- RegisterView: Renders login.html
- profile(): accounts/profile.html
- settings(): accounts/settings.html
- team(): accounts/_team_table.html (HTMX) or accounts/team.html (full)
- contacts(project_id): accounts/contacts.html
- Various modals/actions: invite_row, invite_modal, edit_member_modal, resend_invite, cancel_invite, delete_account (mostly stubs returning HttpResponse)

**API** (`api/`):
- Routers: users, studios, memberships, consultants, consultant-assignments, signup-profiles (all DefaultRouter viewsets)

**Admin** (`admin.py`):
- Not explicitly listed; uses default ModelAdmin registration for models

**Migrations:**
- 0001_initial, 0002_alter_studio_options, 0003_user_remove_projectconsultantassignment, 0004_projectconsultantassignment_project, 0005_ensure_terms_column, 0006_user_is_shared_mailbox, 0007_remove_user_is_shared_mailbox, 0008_projectmembership_role

**Tests:**
- test_user_manager.py, test_services.py, test_models.py, test_integration_projects_fk.py, test_api.py

---

### PROJECTS

**Models** (`models.py`):
- **Project** (BaseModel): Top-level media project
  - studio → accounts.Studio, owner → User, title, slug (unique), synopsis
  - status (draft|...), canonical_bible (JSONField), bible_version (int), bible_status (empty|draft|in_review|final)
  - bible_finalized_at (datetime), bible_finalized_by → User
  - Meta: ordering=["title"], db_table="rwanga_projects_project"
  
- **Scene** (BaseModel): Script scene with production details
  - project → Project, number (int), title, summary, script_text, ordering, estimated_minutes
  - complexity_score, draft_status, location_type (int|ext), day_night, weather, crowd_level, vfx_complexity
  - language (default ckb), last_exported_at, metadata (JSONField)
  - Meta: ordering=["project", "number", "ordering"], unique_together=(project, number)
  
- **Character** (BaseModel): Named character in project
  - project → Project, name, bio
  - Meta: ordering=["name"]
  
- **Location** (BaseModel): Narrative location (internal; confusingly named—see locations.models.Location for shooting locations)
  - project → Project, name, description
  - Meta: ordering=["name"]

**Services** (`services.py`):
- ProjectsService (static methods): list_projects, get_project, create_project, update_project, delete_project
- ProjectsService: list_scenes, get_scene, create_scene, update_scene, delete_scene
- ProjectsService: list_characters, get_character, create_character, update_character, delete_character
- [Locations also in this service]

**Views** (`views.py`):
- ProjectListView: GET /projects/ → projects/list.html (owned, member, invited projects)
- ProjectCreateWizardView: GET/POST /projects/create/ → wizard flow with 4 steps (basics, script, modules, team)
- ProjectCreateStepView: Step-by-step handler
- ProjectDashboardView: GET /projects/<uuid>/ → projects/dashboard.html (workspace)
- ProjectSceneListPartialView: GET /projects/<uuid>/scenes/ → projects/_scene_list.html (HTMX partial)
- ProjectSceneView: GET /projects/<uuid>/scenes/<scene_uuid>/ → projects/scene_view.html
- ProjectSceneTabView: GET /projects/<uuid>/scenes/<scene_uuid>/<tab>/ (tabs: overview, scripts, shots, storyboard, floorplan, lighting, sound, wardrobe, props, continuity, schedule)
- ProjectSettingsView: GET /projects/<uuid>/settings/ → projects/settings.html

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: ProjectViewSet, SceneViewSet, CharacterViewSet, LocationViewSet (DefaultRouter)
- Additional views:
  - ProjectBibleView (GET): Retrieve project's canonical bible
  - FinalizeBibleView (POST): Finalize bible, lock for further reviews
- Nested routes: /projects/<uuid>/scenes/, /projects/<uuid>/characters/, /projects/<uuid>/locations/
- Serializers: ProjectSerializer (custom create/update logic), others implied

**Forms** (`forms.py`):
- ProjectBasicsForm: title, title_latin, project_type, director_name, logline
- ScriptUploadForm: project_id (hidden), script_file, skip (bool)
- ModuleSelectionForm: project_id (hidden), modules (multi-select: scripts, shots, floorplans, scheduling, departments, ai_engine)
- TeamInviteForm: project_id (hidden)

**Templates:**
- projects/list.html: Project listing page
- projects/dashboard.html: Project workspace hub
- projects/create_wizard.html: Onboarding wizard
- projects/scene_view.html: Scene detail container
- projects/settings.html: Project settings page
- projects/_scene_list.html: Sidebar scene list (HTMX partial)
- projects/scenes/tabs/overview.html, scripts.html, shots.html, storyboard.html, floorplan.html, lighting.html, sound.html, wardrobe.html, props.html, continuity.html, schedule.html

**Admin** (`admin.py`):
- Registers: Project, Scene, Character, Location (default ModelAdmin)

**Tests:**
- test_models.py, test_services.py, test_views.py, test_api.py, test_api_nested.py, test_wizard.py

**Migrations:**
- 0001_initial, 0002_alter_character_table_alter_location_table, 0003_create_rwanga_tables, 0004_drop_rwanga_shadow_projects_tables, 0005_project_bible_finalized_at

---

### REVIEWS

**Models** (`models.py`):
- **InlineComment** (BaseModel): Generic comment on any object
  - content_type (ForeignKey to ContentType), object_id, content_object (GenericForeignKey)
  - author → User, body, parent (self-referential for threads), visibility (team|consultant), resolved (bool)
  
- **BibleReview** (BaseModel): Consultant's full review of project bible
  - project → projects.Project, author → accounts.ConsultantProfile, status (draft|in_review|delivered)
  - version (int), bible_snapshot_version (int), content (JSONField)
  
- **SceneEvaluation** (BaseModel): Analyst commentary on one scene
  - bible_review → BibleReview, scene → projects.Scene, analysis, tension_score, notes, recommendations
  
- **ReviewDecision** (BaseModel): Proposed change to bible text
  - bible_review → BibleReview, scene → projects.Scene (nullable), topic, decision_text
  - status (proposed|locked|rejected), proposed_by → User, locked_by → User, locked_at
  - rejected_by → User, rejected_at, lock_comment, reject_reason, reproposed_from (self-ref)
  - **Chain fields (new):** expression_type (emotional|behavioral|artistic|memory|broken), intensity (low|medium|peak|collapse)
  - function_label, transition_label, chain_id (letter), chain_name, chain_order (int)

**Services** (`services.py`):
- ReviewService._is_consultant(user), _is_director(user, project): Permission checks
- ReviewService.create_review(project, author): Create new BibleReview, set bible_status to in_review
- ReviewService.propose_decision(bible_review, scene, topic, decision_text, user): Create ReviewDecision
- ReviewService.lock_decision(decision, user, comment): Lock decision, validate permissions
- ReviewService.repropose_decision(original_decision, user, new_topic, new_text): Create new decision from rejected one
- ReviewService.deliver_review(review, delivered_by): Update project.canonical_bible, increment version, set status to draft
- ReviewService.finalize_bible(project, finalized_by): Lock bible, prevent further reviews

**Views** (`views.py`):
- ReviewsIndexView: List reviews for project or all
- ReviewCreateView: Initiate new review
- ReviewDetailView: View review with tabs
- ReviewDecisionsTabView, ReviewEvaluationsTabView, ReviewCommentsTabView, ReviewBibleTabView: Tab partials
- ReviewDecisionCreateView, SceneEvaluationCreateView: Add decision/evaluation
- ReviewWorkbenchView: Full workbench interface for reviewing
- ChainViewerView: Visualize decision chain for a specific chain_id
- ReviewSummaryView: Summary view of review decisions
- ReviewSummaryPDFView: PDF export of summary
- LockDecisionView, RejectDecisionView: Decision action handlers (HTMX)

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: InlineCommentViewSet, BibleReviewViewSet, SceneEvaluationViewSet, ReviewDecisionViewSet
- Custom views:
  - BibleReviewByProjectAPIView: GET all reviews for a project
  - BibleReviewDetailByProjectAPIView: GET/PUT one review in a project
  - ReviewDecisionByReviewAPIView: GET decisions for a review
  - ReviewDecisionDetailByReviewAPIView: GET/PUT one decision
  - SceneEvaluationByReviewAPIView: GET evaluations for a review

**Forms** (`forms.py`):
- ReviewDecisionForm, SceneEvaluationForm: [Content not fully inventoried]

**Admin** (`admin.py`):
- Registers: BibleReview, ReviewDecision (default ModelAdmin)

**Tests:**
- test_models.py, test_services.py, test_views.py, test_api.py

**Migrations:**
- 0001_initial, 0002_reviewdecision_locked_at_reviewdecision_rejected_at, 0003_reviewdecision_lock_comment, 0004_biblereview_bible_snapshot_version, 0005_reviewdecision_chain_id_chain_name (chain visualization fields)

**URL Routes** (`urls.py`):
- /reviews/ → ReviewsIndexView (GET)
- /reviews/create/ → ReviewCreateView (GET/POST)
- /reviews/<uuid>/ → ReviewDetailView (GET)
- /reviews/<uuid>/<tab>/ → ReviewDetailView with tab
- /reviews/<uuid>/decisions/create/ → ReviewDecisionCreateView
- /reviews/<uuid>/evaluations/create/ → SceneEvaluationCreateView
- /reviews/<uuid>/status/<status>/ → ReviewSetStatusView
- /reviews/decisions/<uuid>/<action>/ → ReviewDecisionStatusView (lock|reject|repropose)
- /reviews/decisions/<uuid>/comment/ → ReviewDecisionCommentView
- /reviews/<project_uuid>/scenes/<scene_uuid>/comments/ → SceneCommentsPartialView
- /reviews/projects/<project_uuid>/reviews/<review_uuid>/workbench/ → ReviewWorkbenchView
- /reviews/projects/<project_uuid>/reviews/<review_uuid>/chain/<chain_id>/ → ChainViewerView
- /reviews/projects/<project_uuid>/reviews/<review_uuid>/summary/ → ReviewSummaryView
- /reviews/projects/<project_uuid>/reviews/<review_uuid>/summary/pdf/ → ReviewSummaryPDFView

---

### SCRIPTS

**Models** (`models.py`):
- **Script** (BaseModel): A screenplay or script document
  - project → projects.Project, title, content (text), file (FileField), script_format (plain|...)
  - Meta: ordering=["-created_at"]
  
- **ScriptElement** (BaseModel): Granular script component (action, dialogue, heading, etc.)
  - script → Script, scene → projects.Scene (nullable), character → projects.Character (nullable)
  - element_type (action|dialogue|heading|character|transition|parenthetical), content, order (int)
  - Meta: ordering=["order", "created_at"]
  
- **Breakdown** (BaseModel): Production breakdown item from script
  - script → Script, category, item_name, details (JSONField)

**Views** (`views.py`):
- ScriptIndexView: List scripts for project
- ScriptUploadView: Upload script file
- ScriptElementsView: Display parsed elements
- ScriptBreakdownView: Production breakdown UI
- ScriptDocsView: Script documentation/notes

**API** (`api/views.py`, `api/urls.py`, `api/serializers.py`):
- [Assumed ViewSets for Script, ScriptElement, Breakdown; not fully inventoried]

**Forms** (`forms.py`):
- [Not fully inventoried; see projects/forms.py for ScriptUploadForm]

**Tests:**
- test_api.py

**URL Routes** (`urls.py`):
- /scripts/ → ScriptIndexView
- /scripts/upload/ → ScriptUploadView
- /scripts/elements/ → ScriptElementsView
- /scripts/breakdown/ → ScriptBreakdownView
- /scripts/docs/ → ScriptDocsView

**Migrations:**
- 0001_initial, 0002_breakdown.py

---

### SHOTS

**Models** (`models.py`):
- **Shot** (BaseModel): Individual camera shot within a scene
  - scene → projects.Scene, shot_number, shot_type (dialogue|visual|insert)
  - description, lens, movement, duration, order (int)
  - Meta: ordering=["scene", "order", "shot_number"]
  - Properties: number, style
  
- **Setup** (BaseModel): Equipment/camera setup for a shot
  - shot → Shot, setup_letter, description
  - Meta: ordering=["setup_letter"]
  - Property: letter
  
- **StoryboardFrame** (BaseModel): Image/artwork for a shot
  - shot → Shot, image (ImageField), order (int), ai_generated (bool)
  - Meta: ordering=["shot", "order"]

**Views** (`views.py`):
- [Not fully inventoried; likely list, detail, upload views]

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: Assumed for Shot, Setup, StoryboardFrame

**Forms** (`forms.py`):
- [Not inventoried]

**Admin** (`admin.py`):
- [Not inventoried]

**Tests:**
- test_models.py, test_views.py, test_services.py, test_api.py

**Services** (`services.py`):
- [Assumed shot management service; not fully inventoried]

**Migrations:**
- 0001_initial.py

---

### FLOORPLANS

**Models** (`models.py`):
- **FloorPlan** (BaseModel): 2D spatial layout for a scene
  - scene → projects.Scene, name (default "Primary"), room_width (float), room_height (float)
  - furniture (JSONField), cameras (JSONField), paths (JSONField), ai_generated (bool)
  - Meta: ordering=["scene", "name"]

**Views** (`views.py`):
- FloorPlanListView, FloorPlanEditorView: Display & edit floor plans

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSet: FloorPlanViewSet (assumed)

**Forms** (`forms.py`):
- [Not inventoried]

**Services** (`services.py`):
- [Assumed service; not fully inventoried]

**Templates:**
- floorplans/list.html: Floor plan listing

**Tests:**
- test_models.py, test_views.py, test_services.py, test_api.py

**Migrations:**
- 0001_initial.py

---

### SCHEDULING

**Models** (`models.py`):
- **ShootDay** (BaseModel): Single day of production
  - project → projects.Project, date (DateField), day_number (int), notes
  
- **ScheduleBlock** (BaseModel): Time slot on a shoot day
  - shoot_day → ShootDay, scene → projects.Scene (nullable), order (int)
  - time_start (TimeField, nullable), duration (DurationField, nullable), block_type (shoot|...)
  - title, shots (M2M to shots.Shot), notes
  
- **CallSheet** (BaseModel): Daily call sheet for production
  - shoot_day (1:1) → ShootDay, general_call (TimeField, nullable)
  - location → locations.Location (nullable), weather_data (JSONField), sent_at, pdf (FileField)

**Views** (`views.py`):
- SchedulingIndexView, StripboardView, CallSheetsView, SchedulingOptimizeView

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: ShootDayViewSet, ScheduleBlockViewSet, CallSheetViewSet
- Serializers: ShootDaySerializer, ScheduleBlockSerializer, CallSheetSerializer

**Forms** (`forms.py`):
- [Likely shoot day & call sheet forms; not fully inventoried]

**Admin** (`admin.py`):
- Registers: ShootDay, ScheduleBlock, CallSheet

**Templates:**
- scheduling/index.html, scheduling/stripboard.html, scheduling/call_sheets.html

**Tests:**
- test_api.py

**URL Routes** (`urls.py`):
- /scheduling/ → SchedulingIndexView
- /scheduling/stripboard/ → StripboardView
- /scheduling/call_sheets/ → CallSheetsView
- /scheduling/optimize/ → SchedulingOptimizeView

**Migrations:**
- 0001_initial.py, 0002_initial.py

---

### DEPARTMENTS

**Models** (`models.py`):
- **LightingNote** (BaseModel): Lighting setup for a shot
  - shot → shots.Shot, note, color_temp, equipment
  
- **SoundNote** (BaseModel): Audio direction for a shot
  - shot → shots.Shot, note, sound_type
  
- **Prop** (BaseModel): Production prop/object
  - project → projects.Project, scenes (M2M to projects.Scene), name, category, status (needed|...)
  - notes, image (ImageField)
  
- **WardrobeItem** (BaseModel): Costume piece
  - character → projects.Character, scene → projects.Scene, outfit_name
  - description, notes, image (ImageField)
  
- **ContinuityItem** (BaseModel): Continuity tracking
  - scene → projects.Scene, direction (in|out), description, checked (bool)

**Views** (`views.py`):
- LightingView, SoundView, PropsView, WardrobeView, ContinuityView: Department-specific UIs

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: Assumed for all models

**Forms** (`forms.py`):
- [Not fully inventoried]

**Admin** (`admin.py`):
- Registers: LightingNote, SoundNote, Prop, WardrobeItem, ContinuityItem

**Templates:**
- departments/lighting.html, departments/sound.html, departments/props.html, departments/wardrobe.html, departments/continuity.html
- departments/partials/lighting_list.html, sound_list.html, props_list.html, wardrobe_list.html, continuity_list.html

**Tests:**
- test_views.py

**URL Routes** (`urls.py`):
- /departments/lighting/ → LightingView
- /departments/sound/ → SoundView
- /departments/props/ → PropsView
- /departments/wardrobe/ → WardrobeView
- /departments/continuity/ → ContinuityView

**Migrations:**
- 0001_initial.py, 0002_initial.py

---

### AI_ENGINE

**Models** (`models.py`):
- **AIJob** (BaseModel): Async AI task tracker
  - project → projects.Project, type (breakdown|floorplan|schedule), status (queued|running|done|error)
  - progress (0-100), step (current stage string), result (JSONField), error (text)

**Tasks** (`tasks.py`):
- Celery tasks for async job processing (not fully inventoried)

**Providers** (`providers/`):
- base.py: BaseProvider class interface
- ollama.py: Local Ollama LLM integration
- nllb.py: Meta NLLB translation model
- stable_diffusion.py: Image generation

**MCP Server** (`mcp/`):
- server.py, __main__.py: Model Context Protocol server
- resources.py, prompts.py, tools.py: MCP resources, prompts, and tools definitions

**Views** (`views.py`):
- GenerateSceneView, JobStatusView, JobResultView, RerunBreakdownView

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: Assumed for AIJob
- Serializers: Assumed

**WebSocket Consumer** (`consumers.py`):
- Real-time job status updates via Django Channels

**Tests:**
- test_providers.py, test_tasks.py, test_ollama.py

**Admin** (`admin.py`):
- Registers: AIJob

**URL Routes** (`urls.py`):
- /ai/generate-scene/ → GenerateSceneView
- /ai/jobs/<uuid>/status/ → JobStatusView
- /ai/jobs/<uuid>/result/ → JobResultView
- /ai/jobs/<uuid>/rerun/ → RerunBreakdownView

**Migrations:**
- 0001_initial.py

---

### LOCATIONS (Shooting Locations)

**Models** (`models.py`):
- **Location** (BaseModel): Real-world shooting location
  - name, description, address, int_ext (INT|EXT), time_of_day (DAY|NIGHT|DAWN|DUSK)
  - gps_lat, gps_lng (DecimalField, nullable), notes, images (JSONField)
  - Meta: ordering=["name"]
  - Properties: latitude, longitude, projects_count

**Views** (`views.py`):
- [Not fully inventoried; likely list & detail views]

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: LocationViewSet
- Serializers: LocationSerializer

**Forms** (`forms.py`):
- LocationCreateForm

**Services** (`services.py`):
- LocationService (not fully inventoried)

**Admin** (`admin.py`):
- Registers: Location

**Tests:**
- test_api.py

**URL Routes** (`urls.py`):
- /locations/ → location list view
- [Nested under projects in API]

**Migrations:**
- 0001_initial.py, 0002_location_description_location_int_ext

---

### NOTIFICATIONS

**Models** (`models.py`):
- **Notification** (BaseModel): User notification
  - user → User, message, notification_type (info|...), read (bool)
  - Meta: ordering=["-created_at"]
  - Properties: notif_type, is_read, action_url

**Views** (`views.py`):
- [Not fully inventoried]

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: Assumed for Notification
- Serializers: NotificationSerializer

**Admin** (`admin.py`):
- Registers: Notification

**Templates:**
- notifications/panel.html: Notification dropdown/panel

**Tests:**
- test_api.py

**Services** (`services.py`):
- NotificationService (not fully inventoried)

**Migrations:**
- 0001_initial.py

---

### PROGRESS (Project Planning & Tracking)

**Models** (`models.py`):
- **ProgressTask** (BaseModel): Work item for development/planning
  - title, description, task_type (implementation|design|infrastructure|documentation|testing)
  - phase, app_name, status (pending|in_progress|completed|blocked)
  - priority (critical|high|normal|low), assigned_to, blocked_by (M2M self)
  
- **ProgressUpdate** (BaseModel): Status update on a task
  - task → ProgressTask (nullable), author, update_type (status_change|implementation|fix|note|question)
  - body, files_affected (JSONField), tests_run (JSONField)
  
- **DesignDecision** (BaseModel): Architectural/design decision record
  - title, context, decision, alternatives_considered, decided_by, phase, app_name
  - status (proposed|approved|superseded), superseded_by (self-ref)
  
- **GapBlocker** (BaseModel): Issue/blocker tracking
  - title, description, gap_type (design_gap|spec_unclear|dependency_missing|technical_blocker|question_for_owner)
  - severity (critical|major|minor), related_task → ProgressTask (nullable), related_app, phase
  - status (open|resolved|deferred), resolution, resolved_at
  
- **AgentReport** (BaseModel): Agent summary report
  - agent_name, session_id, report_type (phase_completion|blocker|progress|handoff), phase, summary
  - tasks_completed (M2M), tasks_blocked (M2M), gaps_found (M2M)
  
- **ChangeRecord** (BaseModel): Record of code/config changes
  - task → ProgressTask (nullable), change_type (model_added|model_modified|view_added|url_added|test_added|config_changed|migration_run|dependency_added)
  - app_name, description, files_changed (JSONField), diff_summary, commit_hash
  
- **SystemDiagram** (BaseModel): Architecture diagram storage
  - title, diagram_type (architecture|topology|dependency_graph|data_model|flow)
  - phase, content, render_format (mermaid|svg), is_current, notes
  
- **DocumentVersion** (BaseModel): Documentation version history
  - document_name, version, content, changed_by, change_summary, phase

**Views** (`views.py`):
- ProgressDashboardView: Main progress tracking dashboard

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: ProgressTaskViewSet, ProgressUpdateViewSet, GapBlockerViewSet, AgentReportViewSet, ChangeRecordViewSet, DesignDecisionViewSet, SystemDiagramViewSet

**Services** (`services.py`):
- [Not fully inventoried]

**Templates:**
- [Not inventoried; assumed progress dashboard templates]

**Tests:**
- test_models.py, test_services.py, test_api.py

**Migrations:**
- 0001_initial.py

---

### COMMUNITY (Public Review Sessions)

**Models** (`models.py`):
- **ReviewSession** (BaseModel): Public screening/review event
  - project → projects.Project, title, session_type (screenplay|bible|scene_selection)
  - status (draft|open|closed), created_by → User, visibility (invite_only|public)
  
- **SessionContent** (BaseModel): Content piece in a session (scene, excerpt, etc.)
  - session → ReviewSession, content_type, content_data (JSONField), label, order, version
  
- **ReviewSessionParticipant** (BaseModel): Session attendee
  - user → User, session → ReviewSession, role, invited_by → User (nullable)
  - invited_at, accepted_at, is_active
  
- **SessionComment** (BaseModel): Comment on session content
  - session_content → SessionContent, author → User, anchor_type, anchor_ref
  - body, parent (self-ref for threads)
  
- **SessionReaction** (BaseModel): Emoji-style reaction to a comment
  - comment → SessionComment, author → User, reaction_type (agree|disagree|question)

**Views** (`views.py`):
- CommunityIndexView: List sessions for project/user
- CommunityCreateView: Create new session
- CommunitySessionDetailView: View session & participate
- CommunityAddNoteView: Add comment/note
- CommunityAddContentView: Add content to session
- CommunityInviteView: Invite participants
- CommunityStatusView: Toggle session status (open|closed)
- CommunityReactView: Add reaction or reply to comment

**API** (`api/urls.py`, `api/views.py`, `api/serializers.py`):
- ViewSets: Assumed for ReviewSession, SessionContent, SessionComment, SessionReaction
- Serializers: Assumed

**Services** (`services.py`):
- CommunityService (not fully inventoried)

**Forms** (`forms.py`):
- [Not fully inventoried]

**Admin** (`admin.py`):
- Registers: ReviewSession, SessionContent, SessionComment, SessionReaction

**Templates:**
- community/_create_modal.html: Modal to create new session

**Tests:**
- test_models.py, test_views.py, test_services.py, test_api.py

**URL Routes** (`urls.py`):
- /community/ → CommunityIndexView (GET all)
- /community/create/ → CommunityCreateView (GET/POST)
- /community/<project_uuid>/ → CommunityIndexView (GET project sessions)
- /community/sessions/<uuid>/ → CommunitySessionDetailView
- /community/sessions/<uuid>/notes/ → CommunityAddNoteView
- /community/sessions/<uuid>/content/ → CommunityAddContentView
- /community/sessions/<uuid>/invite/ → CommunityInviteView
- /community/sessions/<uuid>/status/<action>/ → CommunityStatusView
- /community/sessions/<uuid>/toggle-status/ → CommunityStatusView (toggle)
- /community/comments/<uuid>/reply/ → CommunityReactView
- /community/comments/<uuid>/react/ → CommunityReactView

**Migrations:**
- 0001_initial.py, 0002_alter_reviewsession_session_type

---

### EXPORTS

**Models:**
- [Likely none; export functionality via services]

**Views** (`views.py`):
- CallSheetExportView, SceneViewerView: Export/render production documents

**API** (`api/urls.py`, `api/views.py`):
- [Assumed viewsets or custom views for export operations]

**Services** (`services.py`):
- ExportService: PDF/document generation (not fully inventoried)

**Templates:**
- exports/call_sheet_template.html, exports/scene_viewer_export.html, exports/shot_list_template.html

**Tests:**
- test_services.py

**URL Routes** (`urls.py`):
- /exports/call_sheet/ → CallSheetExportView
- /exports/scene-viewer/ → SceneViewerView

---

### REALTIME (WebSocket/Channels)

**Consumers** (`consumers.py`):
- [Real-time communication handlers; not fully inventoried]

**Routing** (`routing.py`):
- WebSocket URL patterns for Django Channels (referenced in src/routing.py)

**Apps** (`apps.py`):
- RealtimeConfig

---

### NOTIFICATIONS (continued)

**Template Tags** (`progress/templatetags/`):
- progress_filters.py, progress_extras.py: Custom template filters/tags

---

## SHARED INFRASTRUCTURE

### Root Templates (`templates/`)
- **base.html:** Master layout (extends all pages)
- **landing.html:** Anonymous landing page (redirects authenticated users)
- **stub.html:** Placeholder stub
- **components/_sidebar.html:** Left sidebar navigation
- **components/_topnav.html:** Top navigation bar
- **components/_modal.html:** Generic modal wrapper
- **components/_toast.html:** Toast notification display
- **components/_breadcrumb.html:** Breadcrumb trail
- **components/_empty_state.html:** Empty content placeholder
- **components/_ai_progress.html:** AI job progress indicator
- **components/_rail_inner.html:** Inner rail/sidebar component (newly added)

### Static Assets (`static/`)
- **vendor/bootstrap/:** Bootstrap 4 CSS + RTL variant (css/, js/)
- **vendor/bootstrap/bootstrap.bundle.min.js:** Bootstrap JS bundle
- **htmx/:** HTMX library + extensions (ws.js, event-header.js, debug.js, class-tools.js, hyperscript)
- **js/rwanga.js:** Custom project JS
- **css/rwanga-ds.css:** Custom design-system CSS
- **css/rwanga.css:** Additional custom CSS

---

## MIGRATION SUMMARY

| App | Count | Notable Migrations |
|-----|-------|-------------------|
| accounts | 8 | 0001_initial, 0003_user_remove, 0004_projectconsultantassignment_project, 0008_projectmembership_role |
| projects | 5 | 0001_initial, 0003_create_rwanga_tables, 0005_project_bible_finalized_at |
| reviews | 5 | 0001_initial, 0004_biblereview_bible_snapshot_version, 0005_reviewdecision_chain_id_chain_name (NEW) |
| scripts | 2 | 0001_initial, 0002_breakdown |
| shots | 1 | 0001_initial |
| floorplans | 1 | 0001_initial |
| scheduling | 2 | 0001_initial, 0002_initial |
| departments | 2 | 0001_initial, 0002_initial |
| ai_engine | 1 | 0001_initial |
| notifications | 1 | 0001_initial |
| locations | 2 | 0001_initial, 0002_location_description_location_int_ext |
| community | 2 | 0001_initial, 0002_alter_reviewsession_session_type |
| progress | 1 | 0001_initial |
| core | 0 | (abstract models, no migrations) |
| realtime | 0 | (channels app, no migrations) |
| exports | 0 | (service app, no migrations) |

**Total:** 33 migrations across 12 apps with models.

---

## EXTERNAL INTEGRATIONS

### AI/ML Providers
- **Ollama:** Local LLM inference (src/ai_engine/providers/ollama.py)
- **NLLB:** Meta translation model (src/ai_engine/providers/nllb.py)
- **Stable Diffusion:** Image generation (src/ai_engine/providers/stable_diffusion.py)
- **MCP Server:** Model Context Protocol remote interface (src/ai_engine/mcp/)

### Cloud Services
- **Cloudflare:** CDN/DDoS protection (src/settings/components/cloudflare.py)

### Async Task Queue
- **Celery:** Task distribution (src/celery.py, settings/components/celery.py)

### Cache & Sessions
- **Redis:** Caching, session backend (src/settings/components/redis.py)

### Database
- **PostgreSQL:** Primary data store (src/settings/components/db.py)

### Email
- [Configured in src/settings/components/email.py, backend not specified]

---

## CROSS-APP DEPENDENCY GRAPH

### Core Dependencies
- **core** → (no imports from other apps; base models & infrastructure)

### Navigation & Auth
- **accounts** → (no inter-app imports except projects in models)
- **projects** ← accounts (ProjectMembership), reviews, scripts, shots, floorplans, scheduling, departments, ai_engine, exports, community

### Review Workflow
- **reviews** → accounts (ConsultantProfile, ProjectMembership), projects (Project, Scene)
- **community** → reviews (BibleReview), projects (Project, Scene), accounts (ConsultantProfile)

### Production Assets
- **scripts** → projects (Project)
- **shots** → projects (Scene)
- **floorplans** → projects (Scene)
- **locations** → [standalone; referenced by scheduling (CallSheet)]
- **scheduling** → projects (Project, Scene), shots (Shot), locations (Location)
- **departments** → projects (Character, Scene), shots (Shot)

### Analysis & Export
- **ai_engine** → projects (Project)
- **exports** → projects (Project, Scene), shots (Shot)
- **notifications** → accounts (User), reviews (ReviewDecision), community (ReviewSession)

### Progress Tracking
- **progress** → [standalone; references arbitrary app_names]

### Real-time
- **realtime** → (WebSocket routing, supports ai_engine consumer)

### Settings & Middleware
- **context_processors** (in core) → community (ReviewSession), reviews (ReviewDecision)
- **middleware** (in core) → (request-level injection of studio, theme)

---

## TEMPLATETAGS & FILTERS

**Progress App Templates:**
- `progress/templatetags/progress_filters.py`: Custom filters for progress rendering
- `progress/templatetags/progress_extras.py`: Extra template tags
- `projects/templatetags/project_filters.py`: Project-specific filters

---

## KEY DESIGN PATTERNS

### URL Routing
- **App-level organization:** Each app defines its own `urls.py` and (for APIs) `api/urls.py`
- **Nested routes:** Projects have nested scenes, reviews have nested decisions; API routes use DefaultRouter
- **HTMX awareness:** Some views check `request.htmx` to return partials vs full templates

### Models
- **UUID PKs:** All models inherit from BaseModel with UUID primary key
- **Soft deletes:** SoftDeleteModel provides is_deleted + deleted_at; filters by default, exposes all_objects
- **Generic foreign keys:** InlineComment uses Django's ContentType + GFK for polymorphic commenting
- **Metadata JSONField:** Projects, Scenes store arbitrary metadata

### API
- **DRF Spectacular:** OpenAPI schema generation at /api/schema/, Swagger UI at /api/docs/
- **DefaultRouter:** Auto-generates list/create, retrieve/update/destroy endpoints
- **Nested routes:** Custom URL patterns for project-scoped resources

### Views
- **Class-based views:** All views are CBV subclasses (View, TemplateView, etc.)
- **HTMX support:** Views conditionally render full templates or partials based on request.htmx
- **Context providers:** Templates access nav_mode, pending_decisions_count from context processors

### Authentication
- **Email-based:** Custom User model uses email as USERNAME_FIELD
- **AllAuth:** Pluggable authentication (email verification optional, magic links supported)
- **Role-based:** ProjectMembership.role_type, department_role define granular permissions

### Localization
- **4 languages:** Kurdish Sorani (ckb, default), Kurmanji (ku), Arabic (ar), English (en)
- **RTL support:** Bootstrap RTL CSS loaded; theme picker stores preference in rwanga_theme cookie

### Styling
- **Bootstrap 4:** Grid, components, utilities
- **Custom CSS:** rwanga-ds.css (design system), rwanga.css (additional styling)
- **Theme toggle:** Dark/light theme (stored in cookie, available in request.theme, templates as RWANGA_THEME)

---

## FEATURES & CAPABILITIES

### Project Management
- Create projects (wizard: basics → script → modules → team)
- Organize scripts, scenes, characters, locations
- Scene-level metadata: complexity, location type, VFX, weather, etc.

### Review Workflow
- Consultants create bible reviews (snapshots of canonical bible)
- Team proposes decisions on specific topics/scenes
- Directors lock decisions or reviewers reject
- Chain visualization: link decisions into narrative arcs (emotional → behavioral → artistic, etc.)
- Deliver review to update canonical bible

### Community Engagement
- Public/invite-only review sessions
- Session content (scenes, excerpts)
- Threaded comments with reactions (agree/disagree/question)
- Participant management & invitations

### Production Planning
- Scripts & breakdowns (production items: cast, locations, props)
- Shots & setups with storyboard frames (AI-generated or uploaded)
- Floor plans (2D room layouts with furniture, cameras, paths)
- Shooting schedule: shoot days, call sheets, stripboard
- Department tracking: lighting, sound, wardrobe, props, continuity

### Exports
- Call sheets (PDF)
- Scene viewer (formatted scripts)
- Shot lists

### AI Features (currently disabled)
- AI job queueing (breakdown, floorplan, schedule generation)
- MCP server for remote integration
- Integration with local Ollama, NLLB (translation), Stable Diffusion

### Admin
- Standard Django admin for all models
- Custom displays/filters not inventoried

---

## KNOWN ISSUES & NOTES

- **Location model ambiguity:** projects.Location (narrative locations) vs locations.Location (shooting locations) — may cause confusion
- **[unclear: Exact role-based permission enforcement logic]** — ReviewService checks are present; full RBAC coverage unknown
- **[unclear: Celery tasks definitions]** — src/ai_engine/tasks.py exists but not fully read
- **[unclear: Full ExportService implementation]** — templates present, service not fully inventoried
- **rwanga-design-kit is frozen:** Do NOT modify; contains old templates & design specs
- **Projects/design folder:** Secondary design workspace (review templates not current implementation)

---

## FILE SUMMARY

- **Total Python files:** ~176 across all apps
- **Total HTML templates:** ~50+ in src/*/templates/, templates/
- **Migrations:** 33 across 12 apps
- **Tests:** 48 test files (test_*.py)
- **Static assets:** Bootstrap, HTMX, custom CSS/JS
- **Lines of code:** Not counted (approximate 10k+ lines of Python + Django ORM)

---

**End of Inventory**
