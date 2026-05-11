# UI Template Deployment — Rwanga Design System v1.0

> **Date:** 8 May 2026  
> **From:** Cowork Design Agent  
> **To:** Engineering Agent (working on `E:\api\rwanga\src\`)  
> **Status:** All templates migrated. Ready for deployment.

---

## What happened

The entire `rwanga-design-kit/templates/` directory has been rewritten to use the new Rwanga Design System (`rwanga-ds/`). 58 templates migrated. 12 export templates intentionally skipped (they use inline CSS for offline rendering).

**This is a one-shot replacement.** Every non-export template has been migrated. Do not cherry-pick — deploy them all at once.

---

## What to do

### Step 1 — Backup current production templates

```bash
TIMESTAMP=$(date +%Y%m%d)
cp -r E:/api/rwanga/Projects/design/templates E:/api/rwanga/Projects/design/templates-backup-$TIMESTAMP
```

### Step 2 — Copy migrated templates

Replace all files in the production templates directory with the migrated templates from `rwanga-design-kit/templates/`.

**Source:** `rwanga-design-kit/templates/`  
**Target:** `E:\api\rwanga\Projects\design\templates\`

```bash
# Replace all non-export templates
rsync -av --exclude='exports/' rwanga-design-kit/templates/ E:/api/rwanga/Projects/design/templates/
```

For exports: leave existing production export templates in place. The design-kit exports were NOT migrated (they use inline CSS for WeasyPrint/offline rendering — separate reskin later).

### Step 3 — Deploy new CSS

```bash
# Backup old CSS
cp E:/api/rwanga/Projects/design/static/css/rwanga.css E:/api/rwanga/Projects/design/static/css/rwanga.css.bak

# Copy new DS stylesheet
cp rwanga-design-kit/static/css/rwanga-ds.css E:/api/rwanga/Projects/design/static/css/rwanga-ds.css
```

In `base.html`, the CSS reference is already updated:
```html
<link rel="stylesheet" href="{% static 'css/rwanga-ds.css' %}">
```

The old `rwanga.css` can remain as `.bak` — do NOT delete it yet.

### Step 4 — Add landing page

The landing page template has been added as `templates/landing.html`. You need to:

1. Create a view for the landing page:

```python
# E:/api/rwanga/src/core/views.py (or wherever the root view lives)
from django.shortcuts import redirect, render

def landing_view(request):
    if request.user.is_authenticated:
        return redirect('projects:list')
    return render(request, 'landing.html')
```

2. Update root URL:

```python
# E:/api/rwanga/src/urls.py (root urlconf)
from src.core.views import landing_view

urlpatterns = [
    path('', landing_view, name='landing'),
    # ... existing patterns
]
```

**This is the ONE backend change:** a new view + URL entry. Currently `/` redirects to `/projects/` — change it to serve the landing page for unauthenticated users, redirect to `/projects/` for authenticated users.

### Step 5 — Update rwanga.js if needed

Check if the following JS references still work with the new class names:
- Theme toggle: looks for `.js-theme-toggle` (preserved in new templates)
- Rail: uses `.rw-rail` (unchanged)
- Tab memory: uses `.rw-mod-tab` (unchanged)
- Scene filter: uses `RW.sceneFilter()` (function name preserved)

If any class names changed, update `rwanga.js` accordingly.

### Step 6 — Run test checklist

After deployment, verify:

- [ ] `python manage.py runserver` — no template errors
- [ ] All pages render without 500 errors
- [ ] Dark/light theme toggle works (`.js-theme-toggle` + `data-theme` attribute)
- [ ] RTL layout correct on all pages (Kurdish text, logical properties)
- [ ] Mobile: rail becomes bottom tab bar at <768px
- [ ] HTMX interactions still work:
  - [ ] Scene list filter (oninput search)
  - [ ] Scene tab switching (hx-get → #rw-tab-content)
  - [ ] Shot inline edit (hx-get → closest tr)
  - [ ] Modal load (hx-get → #rw-modal-container)
  - [ ] Toast OOB swap (hx-swap-oob → #rw-toast-container)
  - [ ] Filter strip buttons (hx-get → list body)
- [ ] Bootstrap dropdowns, modals functional
- [ ] Landing page shows for logged-out users
- [ ] `/` redirects to `/projects/` for logged-in users
- [ ] `collectstatic` picks up `rwanga-ds.css`

---

## File manifest

### Migrated templates (58 files)

**Shell (8):**
- `base.html` — App shell: rail + topnav + content slot. CSS ref → `rwanga-ds.css`
- `components/_sidebar.html` — Rail content: 8 cinema SVG glyphs
- `components/_topnav.html` — Project identity + section tabs + avatar dropdown
- `components/_modal.html` — HTMX-loaded modal with `rw-modal-*` classes
- `components/_toast.html` — OOB toast with `rw-toast-*` classes
- `components/_empty_state.html` — Empty state with SVG icon support
- `components/_ai_progress.html` — HTMX polling AI progress with `rw-ai-thinking-*`
- `components/_breadcrumb.html` — Breadcrumb bar with `rw-crumb-*` classes

**Projects (16):**
- `projects/list.html` — CARD GRID (project cards with auto-fill grid)
- `projects/dashboard.html` — DASHBOARD (5 section rows with SVG module cards)
- `projects/scene_view.html` — SCENE VIEW (panel + tabs)
- `projects/_scene_list.html` — HTMX partial (scene panel list)
- `projects/create_wizard.html` — FORM/EDIT wizard (4-step)
- `projects/settings.html` — FORM/EDIT
- `projects/scenes/tabs/` — 10 tab partials (overview, shots, storyboard, floorplan, schedule, lighting, sound, props, wardrobe, continuity)

**Scripts (5):**
- `scripts/index.html` — LIST
- `scripts/breakdown.html` — LIST + card grid sections
- `scripts/upload.html` — FORM/EDIT (file upload)
- `scripts/docs.html` — LIST
- `scripts/elements.html` — LIST + card grid

**Shots (2):**
- `shots/list.html` — LIST (inline edit rows)
- `shots/storyboards.html` — CARD GRID (`rw-sb-*`)

**Floorplans (1):**
- `floorplans/list.html` — CARD GRID

**Locations (1):**
- `locations/list.html` — SPLIT VIEW

**Scheduling (3):**
- `scheduling/index.html` — SPLIT VIEW (day panel + main)
- `scheduling/stripboard.html` — LIST (color-coded strip rows)
- `scheduling/call_sheets.html` — LIST

**Reviews (3):**
- `reviews/workbench.html` — SPLIT VIEW (complex, custom CSS in extra_css block)
- `reviews/chain_viewer.html` — SPLIT VIEW
- `reviews/summary_pdf.html` — Standalone WeasyPrint template (uses `--pdf-*` tokens)

**Accounts (6):**
- `accounts/login.html` — AUTH PAGE (standalone, no base.html, `rw-auth-*`)
- `accounts/register.html` — AUTH PAGE (standalone, no base.html, `rw-auth-*`)
- `accounts/profile.html` — FORM/EDIT
- `accounts/settings.html` — FORM/EDIT
- `accounts/team.html` — LIST
- `accounts/contacts.html` — LIST + CARD GRID sections

**Progress (10):**
- `progress/dashboard.html` — DASHBOARD (stats + alert cards)
- `progress/tasks.html` — LIST
- `progress/task_detail.html` — DETAIL (two-column)
- `progress/updates.html` — LIST
- `progress/changelog.html` — LIST
- `progress/gaps.html` — LIST
- `progress/decisions.html` — LIST + accordion
- `progress/diagrams.html` — SPLIT VIEW
- `progress/docs.html` — LIST
- `progress/agent_reports.html` — LIST + accordion

**Notifications (1):**
- `notifications/panel.html` — HTMX partial (loaded into modal container)

**Other (2):**
- `stub.html` — Placeholder (DS empty state, Kurdish "coming soon")
- `landing.html` — Unauthenticated landing page (copied from `rwanga-ds/Landing Page.html`)

### NOT migrated — intentionally skipped (12 export files)

These have inline CSS for offline/print rendering. They do NOT extend `base.html`. Reskin separately or skip for now.

- `exports/call_sheet_preview.html`
- `exports/call_sheet_template.html`
- `exports/chain_viewer_preview.html`
- `exports/preview.html`
- `exports/preview-ku.html`
- `exports/review_preview.html`
- `exports/review_summary_preview.html`
- `exports/review_workbench_preview.html`
- `exports/scene_viewer_export.html`
- `exports/scene_viewer_preview.html`
- `exports/shot_list_preview.html`
- `exports/shot_list_template.html`

### CSS files

- `static/css/rwanga-ds.css` — NEW design system stylesheet (deploy this)
- `static/css/rwanga.css` — OLD stylesheet (keep as `.bak`, do not delete)

---

## What you must report back

After deployment, create a report listing:

1. **Successfully deployed templates** — confirm each file was placed correctly
2. **Missing templates** — any template referenced by a `{% url %}` or `{% include %}` that doesn't exist in the Django project (e.g., department templates like `departments/lighting.html` that are referenced in dashboard.html but may not have views yet)
3. **Broken URL names** — any `{% url '...' %}` in the templates that don't match existing URL patterns (these should become stub views)
4. **CSS issues** — any missing static file references or `collectstatic` problems
5. **HTMX failures** — any HTMX endpoint that returns errors after the template swap
6. **JS issues** — any `rwanga.js` functions that reference old class names

---

## Rules

1. **Backup before replacing ANYTHING**
2. **Don't modify the migrated templates** — deploy as-is. If something is wrong, report it back to the design agent
3. **The only Python changes are:** landing page view + URL entry
4. **Do not touch export templates** — they are unchanged
5. **Document what you deployed** in a changelog entry
6. **Report all missing/broken references** — the design agent needs this to close gaps
