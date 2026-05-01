# Template Integration Task — Coding Agent Instructions

**Priority:** CRITICAL — complete this before any other work
**Date:** 2026-04-30

---

## GOLDEN RULE: FILL GAPS ONLY — DO NOT TOUCH EXISTING CODE

Previous agents have already done significant work. Some templates are already copied, some views already exist, some URLs are already wired. **Your job is to fill the gaps — NOT to redo, rewrite, replace, or restructure anything.**

**Before touching ANY file, check if it already exists and already works.** If it does, SKIP IT.

Specifically:
- **DO NOT** overwrite any existing template file that is already in place
- **DO NOT** rewrite any existing view function or class
- **DO NOT** restructure any existing `urls.py` — only ADD missing entries
- **DO NOT** change any existing model, setting, or configuration
- **DO NOT** rename, move, or reorganize any existing file
- **DO NOT** refactor any working code "for consistency"
- **DO NOT** modify `base.html`, `_sidebar.html`, `_topnav.html`, or any component template that is already deployed
- **DO NOT** change `rwanga.css` or `rwanga.js`

If something already works, leave it alone. Period.

---

## Step 0: Audit What Exists, Then Present Your Plan (MANDATORY)

**STOP. Do NOT write any code yet.**

First, audit the current state of the project:

### Audit checklist:
1. List every template file currently in `templates/` and `src/*/templates/`
2. List every URL name that currently resolves (run `python manage.py show_urls` or check each `urls.py`)
3. List every view function/class that currently exists in each app's `views.py`
4. Compare against the "Required" lists below
5. Identify ONLY what is missing

### Then present your execution plan:
For each gap you found, list:
- What is missing (template file? view? URL entry?)
- The exact action you will take (copy file from X to Y, add view function Z, add URL pattern W)
- Files you will modify (and confirm you will ONLY append/add, not rewrite)

**WAIT for approval.** Only proceed after the plan is approved.

---

## Step 1: Copy MISSING Templates Only

The design-kit (`rwanga-design-kit/templates/`) contains 54 production-ready templates. Many may already be copied into the project from previous remediation work.

**For each template below:** check if the destination file already exists. If it does, SKIP IT. Only copy files that are missing.

### Project-level templates → `templates/`

| Source | Destination | Notes |
|--------|-------------|-------|
| `rwanga-design-kit/templates/base.html` | `templates/base.html` | Likely exists — SKIP if present |
| `rwanga-design-kit/templates/stub.html` | `templates/stub.html` | NEW — probably missing |
| `rwanga-design-kit/templates/components/*` | `templates/components/*` | Likely exists — SKIP if present |

### App-specific templates → `src/<app>/templates/<app>/`

| Source | Destination | Phase |
|--------|-------------|-------|
| `accounts/login.html` | `src/accounts/templates/accounts/login.html` | P1 — likely exists |
| `accounts/register.html` | `src/accounts/templates/accounts/register.html` | P1 — probably missing |
| `accounts/profile.html` | `src/accounts/templates/accounts/profile.html` | P1 — probably missing |
| `accounts/settings.html` | `src/accounts/templates/accounts/settings.html` | P1 — probably missing |
| `accounts/team.html` | `src/accounts/templates/accounts/team.html` | P1 — probably missing |
| `accounts/contacts.html` | `src/accounts/templates/accounts/contacts.html` | P1 — probably missing |
| `projects/list.html` | `src/projects/templates/projects/list.html` | P1 — probably missing |
| `projects/dashboard.html` | `src/projects/templates/projects/dashboard.html` | P1 — likely exists |
| `projects/create_wizard.html` | `src/projects/templates/projects/create_wizard.html` | P1 — likely exists |
| `projects/settings.html` | `src/projects/templates/projects/settings.html` | P1 — probably missing |
| `projects/scene_view.html` | `src/projects/templates/projects/scene_view.html` | P1 — likely exists |
| `projects/_scene_list.html` | `src/projects/templates/projects/_scene_list.html` | P1 — probably missing |
| `projects/scenes/tabs/overview.html` | `src/projects/templates/projects/scenes/tabs/overview.html` | P2 — probably missing |
| `projects/scenes/tabs/shots.html` | `src/projects/templates/projects/scenes/tabs/shots.html` | P2 — probably missing |
| `projects/scenes/tabs/floorplan.html` | `src/projects/templates/projects/scenes/tabs/floorplan.html` | P2 — probably missing |
| `projects/scenes/tabs/storyboard.html` | `src/projects/templates/projects/scenes/tabs/storyboard.html` | P3 — probably missing |
| `projects/scenes/tabs/lighting.html` | `src/projects/templates/projects/scenes/tabs/lighting.html` | P3 — probably missing |
| `projects/scenes/tabs/sound.html` | `src/projects/templates/projects/scenes/tabs/sound.html` | P3 — probably missing |
| `projects/scenes/tabs/props.html` | `src/projects/templates/projects/scenes/tabs/props.html` | P3 — probably missing |
| `projects/scenes/tabs/wardrobe.html` | `src/projects/templates/projects/scenes/tabs/wardrobe.html` | P3 — probably missing |
| `projects/scenes/tabs/continuity.html` | `src/projects/templates/projects/scenes/tabs/continuity.html` | P3 — probably missing |
| `projects/scenes/tabs/schedule.html` | `src/projects/templates/projects/scenes/tabs/schedule.html` | P4 — probably missing |
| `scripts/upload.html` | `src/scripts/templates/scripts/upload.html` | P1 — likely exists |
| `scripts/index.html` | `src/scripts/templates/scripts/index.html` | P1 — probably missing |
| `scripts/breakdown.html` | `src/scripts/templates/scripts/breakdown.html` | P1 — probably missing |
| `scripts/docs.html` | `src/scripts/templates/scripts/docs.html` | P1 — probably missing |
| `scripts/elements.html` | `src/scripts/templates/scripts/elements.html` | P1 — probably missing |
| `shots/list.html` | `src/shots/templates/shots/list.html` | P2 — probably missing |
| `shots/storyboards.html` | `src/shots/templates/shots/storyboards.html` | P2 — probably missing |
| `floorplans/list.html` | `src/floorplans/templates/floorplans/list.html` | P2 — probably missing |
| `scheduling/index.html` | `src/scheduling/templates/scheduling/index.html` | P4 — probably missing |
| `scheduling/stripboard.html` | `src/scheduling/templates/scheduling/stripboard.html` | P4 — probably missing |
| `scheduling/call_sheets.html` | `src/scheduling/templates/scheduling/call_sheets.html` | P4 — probably missing |
| `locations/list.html` | `src/locations/templates/locations/list.html` | P4 — probably missing |
| `notifications/panel.html` | `src/notifications/templates/notifications/panel.html` | P4 — probably missing |
| `progress/dashboard.html` | `src/progress/templates/progress/dashboard.html` | P0 — may exist |
| `progress/tasks.html` | `src/progress/templates/progress/tasks.html` | P0 — probably missing |
| `progress/task_detail.html` | `src/progress/templates/progress/task_detail.html` | P0 — probably missing |
| `progress/updates.html` | `src/progress/templates/progress/updates.html` | P0 — probably missing |
| `progress/gaps.html` | `src/progress/templates/progress/gaps.html` | P0 — probably missing |
| `progress/decisions.html` | `src/progress/templates/progress/decisions.html` | P0 — probably missing |
| `progress/agent_reports.html` | `src/progress/templates/progress/agent_reports.html` | P0 — probably missing |
| `progress/changelog.html` | `src/progress/templates/progress/changelog.html` | P0 — probably missing |
| `progress/diagrams.html` | `src/progress/templates/progress/diagrams.html` | P0 — probably missing |
| `progress/docs.html` | `src/progress/templates/progress/docs.html` | P0 — probably missing |

**Create directories as needed** (`mkdir -p`) for app template folders that don't exist yet.

---

## Step 2: Add MISSING Views and URLs Only

For each URL name below: check if it already exists in the app's `urls.py`. If it does, SKIP IT. Only add what's missing.

**DO NOT rewrite existing views.** If a view already exists and works, leave it. If it exists but points to the wrong template, note it in your plan and ask before changing it.

### How to add a stub view for a missing URL

If a URL name is missing and the real backend logic isn't implemented yet, add a minimal view:

```python
# For pages with their own design-kit template:
def view_name(request, project_pk=None, **kwargs):
    context = {}
    if project_pk:
        context['project'] = get_object_or_404(Project, pk=project_pk)
    return render(request, '<app>/<template>.html', context)

# For pages with NO design-kit template (departments, exports, ai_engine):
def stub_view(request, *args, **kwargs):
    return render(request, 'stub.html', {'stub_name': 'Module Name'})
```

### Required URL Names — Check Each One

**accounts (namespace `accounts`):**
- `accounts:login`
- `accounts:logout`
- `accounts:register`
- `accounts:magic_link`
- `accounts:profile`
- `accounts:settings`
- `accounts:team`
- `accounts:contacts` (takes `project_pk`)

**projects (namespace `projects`):**
- `projects:list`
- `projects:dashboard` (takes `project_pk`)
- `projects:settings` (takes `project_pk`)
- `projects:scene` (takes `project_pk`, `scene_pk`)
- `projects:scene_list_partial` (takes `project_pk`)
- `projects:scene_tab` (takes `project_pk`, `scene_pk`, `tab_id`)

**scripts (namespace `scripts`):**
- `scripts:index` (takes `project_pk`)
- `scripts:upload` (takes `project_pk`)
- `scripts:docs` (takes `project_pk`)
- `scripts:breakdown` (takes `project_pk`)
- `scripts:elements` (takes `project_pk`)

**shots (namespace `shots`):**
- `shots:list` (takes `project_pk`)
- `shots:storyboards` (takes `project_pk`)

**floorplans (namespace `floorplans`):**
- `floorplans:list` (takes `project_pk`)

**scheduling (namespace `scheduling`):**
- `scheduling:index` (takes `project_pk`)
- `scheduling:stripboard` (takes `project_pk`)
- `scheduling:call_sheets` (takes `project_pk`)

**departments (namespace `departments`):**
- `departments:lighting` (takes `project_pk`) — use `stub.html`
- `departments:sound` (takes `project_pk`) — use `stub.html`
- `departments:wardrobe` (takes `project_pk`) — use `stub.html`
- `departments:continuity` (takes `project_pk`) — use `stub.html`

**locations (namespace `locations`):**
- `locations:list`

**notifications (namespace `notifications`):**
- `notifications:panel`

**exports (namespace `exports`):**
- `exports:scene_viewer` (takes `scene_pk`) — use `stub.html`

**ai_engine (namespace `ai_engine`):**
- `ai_engine:generate_scene` (takes `scene_pk`) — use `stub.html`

**progress (namespace `progress`):**
- `progress:dashboard`
- `progress:tasks`
- `progress:task_detail` (takes `task_id`)
- `progress:updates`
- `progress:gaps`
- `progress:decisions`
- `progress:agent_reports`
- `progress:changelog`
- `progress:diagrams`
- `progress:docs`

### Root URL entries to verify (not add if present):
```python
path('', RedirectView.as_view(url='/projects/', permanent=False))  # root redirect
```
`LOGIN_REDIRECT_URL = '/projects/'` in settings.

---

## Step 3: Validate

Run this checklist ONLY after completing Steps 1-2:

```
[ ] Django runserver starts without errors
[ ] / redirects to /projects/
[ ] /projects/ renders (projects/list.html)
[ ] /accounts/login/ renders (accounts/login.html)
[ ] /progress/ renders (progress/dashboard.html)
[ ] Login redirects to /projects/
[ ] Opening a project renders dashboard (projects/dashboard.html)
[ ] Scene view loads with tab bar
[ ] No TemplateDoesNotExist errors on any route
[ ] All URL names in the list above resolve
```

---

## Step 4: Update Progress App

Create a ProgressTask and ProgressUpdate recording:
- Which templates were copied (list only the NEW ones you added)
- Which views were created (list only the NEW ones)
- Which URL entries were added (list only the NEW ones)
- Validation results

---

## Step 5: Commit

```
feat(templates): integrate missing design-kit templates and wire URL stubs

- Copy [N] new templates from design-kit to runtime locations
- Add [N] new views for template rendering
- Add [N] new URL entries
- All existing code left untouched
```

Replace [N] with actual counts of what you added.

---

## What NOT To Do (Explicit Prohibitions)

1. **DO NOT** run `rm`, `mv`, or delete any existing file
2. **DO NOT** modify any existing view that already works
3. **DO NOT** change the structure of any existing `urls.py` — only append new patterns
4. **DO NOT** modify `base.html`, component templates, `rwanga.css`, or `rwanga.js`
5. **DO NOT** change any model, migration, setting, or configuration
6. **DO NOT** refactor anything "while you're at it"
7. **DO NOT** replace a working template with the design-kit version if both exist (even if different — flag it in your plan instead)
8. **DO NOT** proceed without presenting your plan first

---

## Reference Files

| File | Purpose |
|------|---------|
| `rwanga-design-kit/AGENT-REMEDIATION.md` | Original remediation instructions |
| `rwanga-design-kit/TEMPLATE-COMPLETION-SPEC.md` | Full spec with context variables and layouts |
| `CLAUDE.md` | Agent rules (especially Rule 15b) |
| `MASTER-DESIGN.md` | System blueprint — URL patterns in Part 3.4, app specs in Part 4 |
