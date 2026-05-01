# FULL DEVELOPMENT TASK — Rwanga Remaining Implementation

> **Mode: NON-STOP.** Do not pause for confirmation between phases. Do not ask questions unless you hit a real blocker (missing dependency, server won't start, test infrastructure broken). If you hit a blocker, create a GapBlocker in the Progress app, skip to the next unblocked task, and keep going. Only stop and report when ALL work is done or when a critical blocker prevents ANY further progress.

## Before You Start

Read these files IN ORDER — do not skip any:

1. `rwanga-design-kit/CLAUDE.md` — your operating rules (19 rules, all non-negotiable)
2. `rwanga-design-kit/MASTER-DESIGN.md` — complete system blueprint (models, phases, specs)
3. `rwanga-design-kit/BACKEND_SPEC.md` — URL structure, HTMX patterns, template context variables
4. `rwanga-design-kit/design-plan.md` — UI/UX design spec

## What's Already Done

- **P0 (Infrastructure):** COMPLETE. Core app, progress app, skeleton, settings, all working.
- **P1 (Partial):** accounts, base.html, rwanga.css, projects (CRUD wizard, dashboard, scenes), scene_view.html shell — all done.
- **P1 NOT done:** reviews app, InlineComment, scripts app (partial), project-as-workspace UX (partial).
- **P2–P5:** All apps exist as HTMX view/url STUBS ONLY — no models, no services, no API, no tests. They render "coming soon" pages. That is unacceptable.

## What You Must Build

Complete everything below. Follow the build order. For EVERY app, follow the standard structure from CLAUDE.md:

```
src/<app>/
├── models.py          ← inherit BaseModel
├── admin.py           ← register all models
├── services.py        ← ALL business logic
├── forms.py           ← Django forms
├── urls.py            ← HTMX routes
├── views.py           ← thin views calling services
├── api/
│   ├── urls.py        ← DRF router
│   ├── views.py       ← ViewSets
│   └── serializers.py ← ModelSerializers
├── tests/
│   ├── test_models.py
│   ├── test_services.py
│   ├── test_views.py
│   └── test_api.py
```

### TEMPLATE RULE (CRITICAL)

Templates are FINISHED in `rwanga-design-kit/templates/`. **COPY them, don't create new ones.**

```bash
# Example for shots:
cp rwanga-design-kit/templates/shots/list.html src/shots/templates/shots/list.html
cp rwanga-design-kit/templates/shots/storyboards.html src/shots/templates/shots/storyboards.html
```

If a design-kit template references a URL name or context variable that doesn't exist yet, create the view/URL to match. Do NOT modify the template — build the backend to serve what the template expects.

If a page has NO design-kit template, then you may create one — but it must extend `base.html` and use rwanga.css design tokens.

### Phase 1 — Finish Remaining

#### P1.6: Reviews App (`src/reviews/`)
Models from MASTER-DESIGN.md Part 4 → "App: reviews":
- `InlineComment` — GenericFK, author, body, parent (threads), visibility, resolved
- `BibleReview` — project FK, author FK→ConsultantProfile, status, version, content (JSON)
- `SceneEvaluation` — bible_review FK, scene FK, analysis, tension_score, notes, recommendations
- `ReviewDecision` — bible_review FK, scene (nullable), topic, decision_text, status, proposed_by, locked_by, rejected_by

Authority rules (enforce in services.py):
- Propose decisions: Consultant only
- Lock decisions: Consultant OR Director
- Reject decisions: Director only

DRF endpoints per BACKEND_SPEC.md. Copy NO template for reviews — there is none in design-kit, create minimal ones extending base.html.

#### P1.7: Wire InlineComment into scene view
Add inline comment support to scene_view.html tabs. Use HTMX Pattern 1 (inline edit).

#### P1.8: Project-as-workspace UX
Dashboard = lobby, project = workspace, exit flow. Complete the context-switch and exit behavior.

#### P1.9: Scripts App (`src/scripts/`)
Models: Script, ScriptElement, Breakdown. Templates exist in design-kit:
- `scripts/index.html`
- `scripts/upload.html`
- `scripts/breakdown.html`
- `scripts/elements.html`
- `scripts/docs.html`

Copy all 5 templates. Build models, services, API, views, tests.

### Phase 2 — Shot List + Floor Plan + Export

#### P2.1: Shots App (`src/shots/`)
Models from MASTER-DESIGN.md:
- `Shot` — scene FK, shot_number, shot_type, description, lens, movement, duration, order
- `Setup` — shot FK, setup_letter, description
- `StoryboardFrame` — shot FK, image, order

Templates from design-kit:
- `shots/list.html`
- `shots/storyboards.html`

DRF endpoints. Inline edit via HTMX Pattern 1.

#### P2.2: Floorplans App (`src/floorplans/`)
Model from MASTER-DESIGN.md:
- `FloorPlan` — scene FK, name, room_width, room_height, furniture (JSON), cameras (JSON), paths (JSON), ai_generated

**JSON storage, NOT SVG** (Rule 12). Template: `floorplans/list.html` from design-kit.

#### P2.3: Exports App (`src/exports/`)
Scene viewer export — self-contained HTML, zero external deps, works offline (Rule 13).
Call sheet PDF via WeasyPrint.
DRF endpoints per BACKEND_SPEC.md.

#### P2.4: Wire Sortable.js for shot reorder
Drag-and-drop reorder in shots list. HTMX POST on drop.

### Phase 3 — Department Modules

#### P3.1: Departments App (`src/departments/`)
Five sub-modules, ONE Django app. Models from MASTER-DESIGN.md:
- `LightingNote` — shot FK, note, color_temp, equipment
- `SoundNote` — shot FK, note, sound_type
- `Prop` — project FK + M2M scene, name, category (A/B/C), status, notes, image
- `WardrobeItem` — character FK + scene FK, outfit_name, description, notes, image
- `ContinuityItem` — scene FK, direction (in/out), description, checked

#### P3.2: Scene tab templates
Copy from design-kit (these are the tab partials for scene_view.html):
- `projects/scenes/tabs/lighting.html`
- `projects/scenes/tabs/sound.html`
- `projects/scenes/tabs/props.html`
- `projects/scenes/tabs/wardrobe.html`
- `projects/scenes/tabs/continuity.html`
- `projects/scenes/tabs/shots.html`
- `projects/scenes/tabs/storyboard.html`
- `projects/scenes/tabs/floorplan.html`
- `projects/scenes/tabs/schedule.html`
- `projects/scenes/tabs/overview.html`

Build the views that serve these tabs. Each tab is an HTMX partial loaded via Pattern 2.

### Phase 4 — Scheduling + Locations + Notifications

#### P4.1: Scheduling App (`src/scheduling/`)
Models:
- `ShootDay` — project FK, date, day_number, notes
- `ScheduleBlock` — shoot_day FK, scene FK, order, time_start, duration, block_type, title, shots M2M, notes
- `CallSheet` — shoot_day 1-to-1, general_call, location FK, weather_data (JSON), sent_at, pdf

Templates from design-kit:
- `scheduling/index.html` (stripboard)
- `scheduling/call_sheets.html`
- `scheduling/stripboard.html`

#### P4.2: Call sheet PDF generation
WeasyPrint PDF generation. Twilio WhatsApp delivery task (create the Celery task structure, even if Twilio creds aren't configured — use settings stubs).

#### P4.3: Locations App (`src/locations/`)
Model: `Location` — BaseModel fields + name, address, gps_lat, gps_lng, notes, images
Template: `locations/list.html` from design-kit.

#### P4.4: Notifications App (`src/notifications/`)
Model: `Notification` — user FK, message, notification_type, read, created_at
Template: `notifications/panel.html` from design-kit (HTMX partial).

### Phase 5 — AI Engine + Realtime

#### P5.1: AI Engine App (`src/ai_engine/`)
Model: `AIJob` — project FK, type (breakdown/storyboard/floorplan/schedule), status, progress, step, result (JSON), error
Celery task structure (task stubs that update job status — actual AI integration can be stubbed but the pipeline must work).

#### P5.2–P5.4: AI task stubs
Create Celery task files for script breakdown, floor plan generation, schedule optimization. They should update AIJob progress via WebSocket. The actual AI logic can be placeholder, but the task→progress→WebSocket pipeline must be functional.

#### P5.5: Realtime App (`src/realtime/`)
WebSocket consumers from MASTER-DESIGN.md:
- `AIJobConsumer` — streams job progress to project group
- `NotificationConsumer` — pushes notifications to user

Wire into `src/realtime/routing.py` and `src/asgi.py`.

### Phase 6 — Community Reviews

#### P6: Community App (`src/community/`)
Models from MASTER-DESIGN.md → "App: community":
- `ReviewSession` — project FK, title, session_type, status, created_by, visibility
- `SessionContent` — session FK, content_type, content_data (JSON snapshot), label, order, version
- `ReviewSessionParticipant` — user FK, session FK, role, invited_by, invited_at, accepted_at, is_active
- `SessionComment` — session_content FK, author FK, anchor_type, anchor_ref, body, parent (threads)
- `SessionReaction` — comment FK, author FK, reaction_type

**CRITICAL ISOLATION:** SessionContent stores frozen JSON snapshots. No live FK to production objects. External reviewers see ONLY session data, never project workspace.

DRF endpoints per MASTER-DESIGN.md.

## For EVERY App You Build

1. **TDD** — write test first, watch it fail, implement, watch it pass (Rule 1)
2. **Docstrings** — every module, class, function (Rule 2)
3. **Services layer** — business logic in services.py, views are thin (Rule 4)
4. **Dual routes** — HTMX urls.py + DRF api/urls.py (Rule 5)
5. **BaseModel** — all models inherit from src.core.models.BaseModel (Rule 6)
6. **Register in admin.py** — every model
7. **Register in LOCAL_APPS** — add to settings
8. **Wire URLs** — add to src/urls.py (both HTMX and API)
9. **Run migrations** — `python manage.py makemigrations <app> && python manage.py migrate`
10. **Update Progress app** — update task status, create ProgressUpdate, create ChangeRecords (Rule 16)
11. **Commit** — after each app is complete (Rule 18)

## Register All Apps in Settings

Add each new app to `LOCAL_APPS` in the appropriate settings component:
```python
LOCAL_APPS = [
    'src.core',
    'src.accounts',
    'src.projects',
    'src.progress',
    'src.scripts',
    'src.reviews',
    'src.shots',
    'src.floorplans',
    'src.departments',
    'src.scheduling',
    'src.locations',
    'src.notifications',
    'src.ai_engine',
    'src.realtime',
    'src.exports',
    'src.community',
]
```

## Wire All URLs in src/urls.py

```python
urlpatterns = [
    # ... existing ...
    path('scripts/<uuid:project_pk>/', include('src.scripts.urls')),
    path('shots/<uuid:project_pk>/', include('src.shots.urls')),
    path('floorplans/<uuid:project_pk>/', include('src.floorplans.urls')),
    path('departments/<uuid:project_pk>/', include('src.departments.urls')),
    path('scheduling/<uuid:project_pk>/', include('src.scheduling.urls')),
    path('locations/', include('src.locations.urls')),
    path('notifications/', include('src.notifications.urls')),
    path('ai/', include('src.ai_engine.urls')),
    path('exports/', include('src.exports.urls')),
    path('community/', include('src.community.urls')),
]

# API URLs
urlpatterns += [
    path('api/v1/scripts/', include('src.scripts.api.urls')),
    path('api/v1/shots/', include('src.shots.api.urls')),
    path('api/v1/floorplans/', include('src.floorplans.api.urls')),
    path('api/v1/departments/', include('src.departments.api.urls')),
    path('api/v1/scheduling/', include('src.scheduling.api.urls')),
    path('api/v1/locations/', include('src.locations.api.urls')),
    path('api/v1/notifications/', include('src.notifications.api.urls')),
    path('api/v1/ai/', include('src.ai_engine.api.urls')),
    path('api/v1/exports/', include('src.exports.api.urls')),
    path('api/v1/community/', include('src.community.api.urls')),
    path('api/v1/reviews/', include('src.reviews.api.urls')),
]
```

## Final Validation

After ALL phases are complete, run:
```bash
python manage.py check
python manage.py makemigrations --check  # should say "No changes detected"
pytest --cov -x
python manage.py runserver 0.0.0.0:8020  # must start clean
```

Then update all Progress tasks to their final status and create an AgentReport for the completed work.

## Summary

You are building 12 Django apps (reviews, scripts, shots, floorplans, departments, scheduling, locations, notifications, ai_engine, realtime, exports, community). Each needs models, admin, services, forms, views, API, tests, and templates (copied from design-kit where available). Follow TDD. Follow the rules in CLAUDE.md. Do not stop. Do not ask. Build.
