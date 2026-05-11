# Rwanga UI Switch — Two-Stage Handoff

> **Date:** 8 May 2026
> **Owner:** Darya Ibrahim (daryabsb@gmail.com)
> **Scope:** Migrate all outdated Django templates to the new Rwanga Design System, then deploy to production.

---

## The Situation

Rwanga has two things:

1. **`templates/`** — ~55 Django HTML templates built on an OLD prototype-grade UI. **These are outdated and wrong.** They use the old `rwanga.css`, old sidebar, old component markup.

2. **`rwanga-ds/`** — A brand new design system created by Claude Design. Complete stylesheet, 6 page patterns, icon system, agent guide. **This is the target.**

The templates need to be **migrated** to match the new design system. Then the migrated templates get **deployed** to the production Django project.

---

## Stage 1 — Cowork Agent (this app)

**Who:** A new Cowork session in the Rwanga project
**What:** Migrate every template in `templates/` to use the `rwanga-ds/` design system

### The process:

1. Read `rwanga-ds/AGENT-PATTERNS.md` — this is the migration bible. It has 6 page patterns with copy-paste Django template code.
2. Read `rwanga-ds/rwanga-ds.css` — the new stylesheet that replaces `rwanga.css`.
3. Open `rwanga-ds/Pattern Library.html` in browser for visual reference.
4. For each template in `templates/`:
   - Read the OLD template
   - Identify which of the 6 page patterns it maps to (LIST, CARD GRID, SPLIT VIEW, SCENE VIEW, DASHBOARD, FORM/EDIT)
   - Rewrite the markup using the new pattern, new CSS classes, new icon system
   - **Preserve ALL Django template tags** (`{% block %}`, `{% include %}`, `{% url %}`, `{{ variable }}`, `{% if %}`, `{% for %}`)
   - **Preserve ALL HTMX attributes** (`hx-get`, `hx-post`, `hx-target`, `hx-swap`, `hx-trigger`)
   - Write the migrated template back to `templates/`

### Migration order:

**Phase 1 — Shell (do first, everything depends on it):**
- `base.html` → new shell (56px rail + topnav + `{% block content %}`)
- `components/_sidebar.html` → becomes the rail (cinema glyphs, bottom tab bar on mobile)
- `components/_topnav.html` → new topnav (breadcrumb + section indicator + search + avatar)
- `components/_modal.html`, `_toast.html`, `_empty_state.html`, `_ai_progress.html`, `_breadcrumb.html`
- Swap CSS reference: `rwanga.css` → `rwanga-ds.css`

**Phase 2 — High-traffic pages:**
- `projects/list.html` → CARD GRID
- `projects/dashboard.html` → DASHBOARD
- `projects/scene_view.html` + 10 tab partials → SCENE VIEW
- `projects/_scene_list.html` → LIST
- `projects/create_wizard.html` → FORM/EDIT (4-step wizard)
- `projects/settings.html` → FORM/EDIT

**Phase 3 — Remaining app pages:**
- `scripts/` (5 pages) — LIST, FORM, SPLIT VIEW patterns
- `shots/`, `floorplans/`, `locations/` — LIST / CARD GRID
- `scheduling/` (3 pages) — LIST + stripboard
- `reviews/` (workbench, chain_viewer, summary_pdf) — complex, use SPLIT VIEW + custom
- `accounts/` (login, register, profile, settings, team, contacts) — auth pages (no rail) + FORM/EDIT
- `notifications/panel.html` — HTMX partial
- `progress/` (9 pages) — DASHBOARD / LIST

**Phase 4 — Cleanup:**
- Eliminate `stub.html` and all "coming soon" references
- Copy `rwanga-ds.css` into `static/css/` (replacing `rwanga.css`)
- Update `rwanga.js` if rail/topnav class names changed
- Verify dark/light toggle, RTL, mobile responsive
- Add `Landing Page.html` from `rwanga-ds/` as the new unauthenticated landing page template

### What NOT to change:
- No Python (views, URLs, models — untouched)
- No HTMX wiring logic
- No context variable names
- Export templates (`exports/`) have inline CSS — reskin separately or skip for now

---

## Stage 2 — Engineering Agent Prompt

After Stage 1 is done, Darya gives this prompt to the engineering agent (Claude Code or similar, working on `E:\api\rwanga\src\`):

### Prompt for engineering agent:

```
## UI Template Deployment — Rwanga Design System v1.0

The Rwanga design system migration is complete. All Django templates in 
`rwanga-design-kit/templates/` have been rewritten to use the new design 
system (`rwanga-ds/`). Your job is to deploy them to the production Django project.

### What to do:

1. **Backup current templates**
   Copy `E:\api\rwanga\Projects\design\templates\` → `E:\api\rwanga\Projects\design\templates-backup-YYYYMMDD\`

2. **Copy migrated templates**
   Replace all files in `E:\api\rwanga\Projects\design\templates\` with the 
   migrated templates from `rwanga-design-kit/templates/`.

3. **Copy new CSS**
   Replace `rwanga.css` with `rwanga-ds.css` in the static files directory.
   Update any `{% static %}` references in `base.html` if the filename changed.

4. **Add landing page**
   - Copy `rwanga-design-kit/rwanga-ds/Landing Page.html` as the new 
     unauthenticated landing page template (e.g., `templates/landing.html`)
   - Add a view + URL route for `/` that serves this page for unauthenticated users
   - Currently `/` redirects to `/projects/` — change it to:
     - Unauthenticated → render landing page
     - Authenticated → redirect to `/projects/` (existing behavior)
   - This is the ONE backend change: a new view + URL entry for the landing page.

5. **Update rwanga.js if needed**
   If the rail/topnav class names changed during migration, update any JS that 
   references old class names (sidebar toggle, theme switcher, mobile menu).

6. **Test checklist**
   - [ ] All pages render without 500 errors
   - [ ] Dark/light theme toggle works
   - [ ] RTL layout correct on all pages
   - [ ] Mobile: rail becomes bottom tab bar at <768px
   - [ ] HTMX interactions still work (scene list filter, inline edit, modal load)
   - [ ] Bootstrap modals, dropdowns, tooltips functional
   - [ ] Landing page shows for logged-out users
   - [ ] `/` redirects to `/projects/` for logged-in users

### Files involved:
- Source templates: `rwanga-design-kit/templates/` (migrated)
- Source CSS: `rwanga-design-kit/rwanga-ds/rwanga-ds.css`  
- Target templates: `E:\api\rwanga\Projects\design\templates\`
- Target static: wherever rwanga.css currently lives in the Django static pipeline
- Landing page source: `rwanga-design-kit/rwanga-ds/Landing Page.html`

### Rules:
- Backup before replacing ANYTHING
- Don't modify the migrated templates — deploy as-is
- The only Python change is the landing page view + URL
- Document what you deployed in a changelog
```

---

## Design System Key Facts (quick reference)

**Tokens (dark-first):** bg `#0F0F12`, surface `#17171C`, text `#EDEAD8`, amber `#D4A574`, CTA `#F72585`
**5 sections:** Write `#FF6B35`, Breakdown `#2D5BE3`, Visualize `#00A896`, Plan `#7C3AED`, Shoot `#F72585`
**Layout:** Bootstrap 5 RTL utilities ONLY. CSS has zero layout rules.
**Rail:** Always dark, 56px, bottom tab bar on mobile.
**Typography:** Noto Sans Arabic + Cairo (Kurdish), Inter (English)
**Radius:** 2px. **Shadows:** none. **Transitions:** 0.12s ease.
**Icons:** B+E hybrid — cinema SVG glyphs for domain, neon stroke for utility.

---

## Critical Warnings

1. **Never delete templates without backup.** A previous agent wiped all templates.
2. **RTL is non-negotiable.** Kurdish is RTL. CSS logical properties. Test both directions.
3. **HTMX wiring must survive.** Every `hx-*` attribute in the old template must appear in the new one.
4. **Don't invent components.** Use only what's in AGENT-PATTERNS.md.
5. **Bootstrap 5 RTL utilities only for layout.** Zero custom flex/grid in CSS.
6. **The old templates are the source of truth for LOGIC.** The new DS is the source of truth for MARKUP.
