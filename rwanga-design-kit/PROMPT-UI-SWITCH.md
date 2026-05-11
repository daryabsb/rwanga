# Paste this into a new Cowork session

---

You are migrating ~55 Django templates from an **outdated UI** to a **new design system** for **Rwanga (ڕوانگە)**, a Kurdish cinema preproduction platform (Django 5 + HTMX + Bootstrap 5 RTL).

## Key distinction:
- `rwanga-design-kit/templates/` — **OLD templates, WRONG UI** — these are what you're rewriting
- `rwanga-design-kit/rwanga-ds/` — **NEW design system** — this is your target

You rewrite every old template to match the new DS. Same Django logic, new markup.

## Load context (read silently, in order):

1. `rwanga-design-kit/HANDOFF-UI-SWITCH.md` — full two-stage brief, template inventory, phased plan, engineering agent prompt
2. `rwanga-design-kit/rwanga-ds/AGENT-PATTERNS.md` — **your migration bible** — 6 page patterns, HTMX patterns, icon SVGs, anti-patterns, copy-paste code
3. `rwanga-design-kit/rwanga-ds/rwanga-ds.css` — the new stylesheet (replaces old rwanga.css)
4. `rwanga-design-kit/templates/base.html` — current OLD shell you're replacing
5. `rwanga-design-kit/specs/CLAUDE.md` — engineering rules

Open `rwanga-design-kit/rwanga-ds/Pattern Library.html` in browser as your visual reference.

## What you're doing:

For each template in `templates/`:
1. Read the OLD template
2. Map it to one of the 6 page patterns (LIST, CARD GRID, SPLIT VIEW, SCENE VIEW, DASHBOARD, FORM/EDIT)
3. Rewrite markup using new DS classes, new rail/topnav shell, new icons
4. **Preserve ALL** Django tags (`{% block %}`, `{% url %}`, `{{ var }}`), HTMX attributes (`hx-get`, `hx-target`), context variables
5. Write the migrated template back to `templates/`

Also: copy `rwanga-ds.css` into `static/css/` replacing `rwanga.css`. Add the landing page from `rwanga-ds/Landing Page.html` as a template.

## Start with Phase 1 (Shell):
Rebuild `base.html` → `_sidebar.html` (→ 56px rail) → `_topnav.html` → shared components → swap CSS reference.

Tell me what's done after each phase so I can verify before you continue.

**Rules:** Backup before overwriting. Don't invent components — only use what's in AGENT-PATTERNS.md. Don't touch Python. Preserve all HTMX wiring. Document changes. Be compact.
