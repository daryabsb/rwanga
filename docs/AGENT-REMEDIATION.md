# AGENT REMEDIATION — Immediate Fixes Required

**Priority:** CRITICAL — do these before any new feature work.
**Rule:** Do NOT invent, do NOT create new templates, do NOT scaffold. The templates are FINISHED. Copy them.

---

## Fix 1: Copy Templates from Design Kit (NOT route to them)

The `rwanga-design-kit/templates/` folder contains **finished, production-ready Django templates**. They are NOT references or specs. They are the actual files your app must use.

### Step 1: Copy ALL templates into the Django project

```bash
# From the rwanga repo root:

# Base template + components → project-level templates/
cp rwanga-design-kit/templates/base.html         templates/base.html
cp -r rwanga-design-kit/templates/components/     templates/components/

# App-specific templates → app template folders
cp rwanga-design-kit/templates/accounts/login.html   src/accounts/templates/accounts/login.html

cp rwanga-design-kit/templates/projects/dashboard.html     src/projects/templates/projects/dashboard.html
cp rwanga-design-kit/templates/projects/create_wizard.html src/projects/templates/projects/create_wizard.html
cp rwanga-design-kit/templates/projects/scene_view.html    src/projects/templates/projects/scene_view.html

cp rwanga-design-kit/templates/scripts/upload.html         src/scripts/templates/scripts/upload.html
```

### Step 2: Copy static assets

```bash
cp rwanga-design-kit/static/css/rwanga.css   static/css/rwanga.css
cp rwanga-design-kit/static/js/rwanga.js     static/js/rwanga.js
```

### Step 3: DELETE any invented templates

Delete any template files you created that duplicate or replace the design-kit templates. The design-kit templates are the only source of truth for UI.

### Step 4: Verify

After copying, every page must render using the design-kit templates. If a template references a URL name that doesn't exist yet, create a **stub view** that returns an empty 200 — do NOT create a new template for it.

---

## Fix 2: Login Redirect

The login form must redirect to the `next` URL parameter after successful authentication.

### Problem
Currently, successful login redirects to `/` which has nothing to serve.

### Fix
In `src/settings/components/common.py` (or `allauth.py`), set:

```python
LOGIN_REDIRECT_URL = '/projects/'
```

The login form already passes `next` via the form action. Make sure allauth respects it. The `accounts/login.html` template in the design kit already has `action="{% url 'accounts:login' %}"` — allauth handles `next` automatically when configured correctly.

Also add to the root `src/urls.py`:

```python
# Root URL — redirect to projects dashboard
path('', RedirectView.as_view(url='/projects/', permanent=False)),
```

Import `RedirectView` from `django.views.generic`.

---

## Fix 3: URL Stubs for Template References

The design-kit templates reference URL names that may not have views yet. For EACH missing URL name, create a **stub view** that returns an empty page extending `base.html`. Do NOT create new template files — use a single shared stub template.

Create ONE stub template:

```html
{% comment %} templates/stub.html {% endcomment %}
{% extends "base.html" %}
{% block content %}
<div id="rw-content" style="padding:var(--rw-pad-lg)">
  <p style="color:var(--rw-text-2)">{{ stub_name }} — coming soon</p>
</div>
{% endblock %}
```

Then for each missing URL, create a stub view:

```python
# In the relevant app's views.py
def stub_view(request, *args, **kwargs):
    return render(request, 'stub.html', {'stub_name': 'Module Name'})
```

### URL names referenced by design-kit templates

These URL names MUST exist (even as stubs):

**accounts app:**
- `accounts:login`
- `accounts:logout`
- `accounts:register`
- `accounts:magic_link`
- `accounts:profile`
- `accounts:settings`
- `accounts:team`
- `accounts:contacts` (takes project_pk)

**projects app:**
- `projects:list`
- `projects:dashboard` (takes project_pk)
- `projects:settings` (takes project_pk)

**scripts app:**
- `scripts:index` (takes project_pk)
- `scripts:upload` (takes project_pk)
- `scripts:docs` (takes project_pk)
- `scripts:breakdown` (takes project_pk)
- `scripts:elements` (takes project_pk)

**shots app:**
- `shots:list` (takes project_pk)
- `shots:storyboards` (takes project_pk)

**floorplans app:**
- `floorplans:list` (takes project_pk)

**scheduling app:**
- `scheduling:index` (takes project_pk)
- `scheduling:stripboard` (takes project_pk)
- `scheduling:call_sheets` (takes project_pk)

**departments app:**
- `departments:lighting` (takes project_pk)
- `departments:sound` (takes project_pk)
- `departments:wardrobe` (takes project_pk)
- `departments:continuity` (takes project_pk)

**locations app:**
- `locations:list`

**notifications app:**
- `notifications:panel`

**exports app:**
- `exports:scene_viewer` (takes scene_pk)

**ai_engine app:**
- `ai_engine:generate_scene` (takes scene_pk)

---

## Fix 4: Update Progress App with Real Task Data

The Progress app currently has 6 tasks. That is not enough. Load the full Phase 0 + Phase 1 checklists from MASTER-DESIGN.md Part 5.

### Required: Create these ProgressTask entries

**Phase 0 tasks (should all be completed):**
1. P0.1 Clone HUD2 skeleton
2. P0.2 Strip HUD2 domain apps
3. P0.3 Create .env
4. P0.4 Add rwanga.py settings component
5. P0.5 Create core app
6. P0.6 Write core tests
7. P0.7 Create progress app
8. P0.8 Write progress tests
9. P0.9 Verify progress dashboard
10. P0.10 Infrastructure validation (Django, ASGI, Celery, Redis, DRF, WebSocket)
11. P0.11 Record all P0 work in Progress app
12. P0.12 Create initial SystemDiagram

**Phase 1 tasks (mark actual status):**
1. P1.1 Create accounts app (models, DRF, views)
2. P1.2 Create base.html (design-kit template — COPY, not create)
3. P1.3 Create rwanga.css (design-kit static — COPY, not create)
4. P1.4 Create projects app (models, DRF, views)
5. P1.5 Create scene_view.html shell (design-kit template — COPY)
6. P1.6 Create reviews app (InlineComment, BibleReview shell, ReviewDecision)
7. P1.7 Wire InlineComment into scene view
8. P1.8 Project-as-workspace UX (dashboard=lobby, project=workspace, exit flow)
9. P1.9 Scripts app (models, upload view)
10. P1.10 TV-first validation at 1920×1080
11. P1.11 Update Progress app

### For each task, also create a ProgressUpdate recording:
- What was done
- Files affected
- Tests run (pass/fail counts)
- Any gaps or blockers found

### Record these known GapBlockers:
1. Gap: Auth flow diverged from allauth expected behavior (Drift A from delivery report)
2. Gap: Bootstrap was CDN instead of local (Drift B — now fixed)
3. Gap: Template comment leakage in UI (Drift C — now fixed)
4. Gap: Invented templates instead of using design-kit (Drift D — fixing now)
5. Gap: Static path resolution broken (Drift E — now fixed)

---

## Fix 5: Bootstrap Local vs CDN

The design-kit templates use CDN links for Bootstrap. This is acceptable for development. The delivery report says you already added local Bootstrap files — that's fine, but make sure the templates match. Either:

**Option A:** Keep CDN links in templates (simpler, works in dev)
**Option B:** Use local files (requires updating base.html and login.html `href` attributes)

Pick one and be consistent. Do NOT mix CDN and local.

---

## Validation Checklist (Run After All Fixes)

```
[ ] base.html is the design-kit version (check for rw-app, rw-rail, rw-main structure)
[ ] Login page shows Kurdish brand text, magic link form, email/password form
[ ] Login redirects to /projects/ after success
[ ] / redirects to /projects/
[ ] /projects/ shows the projects list page
[ ] Projects dashboard shows module grid with color-coded sections
[ ] Sidebar rail shows on all pages (dark background, 68px wide)
[ ] Top navigation shows project name and section tabs when inside a project
[ ] Dark theme is default, theme toggle works
[ ] RTL layout is correct (sidebar on right, text right-aligned)
[ ] rwanga.css design tokens are loading (check --rw-bg: #0F0F12 in dev tools)
[ ] All URL names referenced by templates resolve (even if to stub views)
[ ] Progress dashboard at /progress/ shows 20+ tasks with real status data
[ ] No invented templates remain — all UI comes from design-kit files
```

---

## Process Rule (Going Forward)

1. **NEVER create a new template file** unless the design-kit doesn't have one for that page
2. If a template references a URL that doesn't exist, create a **stub view**, not a new template
3. Before committing: visually compare your rendered page against the Platform Prototype.html
4. Update the Progress app BEFORE moving to the next task
5. If anything is unclear: create a GapBlocker in the Progress app and STOP
