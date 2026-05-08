# Rwanga UI Migration — Design Spec

**Date:** 2026-05-08
**Goal:** Migrate the Django app's UI from the legacy template/CSS system to the new Rwanga Design System v1.0, using the design-kit's pre-migrated templates as a starting point. Verified visually by the user, phase by phase.

---

## Context

Two prior agents attempted this migration and broke the system. The user reverted everything. Symptoms before revert: pages loaded but the layout rendered wrong (shell/components mismatched, CSS likely not loading cleanly). Root cause: blind copy + regex-based URL fixes, no per-phase verification.

Three artifacts are in play:

- **`rwanga-design-kit/rwanga-ds/`** — the design system reference (`rwanga-ds.css` + `AGENT-PATTERNS.md`)
- **`rwanga-design-kit/templates/`** — 72 templates the design agent migrated from old → new system. Treated as a *starting point*, not gospel.
- **`E:\api\rwanga\templates\` + `src\<app>\templates\<app>\`** — the 127 live templates that actually run. ~68 will be replaced by design-kit versions; ~16 are live-only and need restyling against AGENT-PATTERNS.md (departments tabs, review sub-partials, modal partials, etc.).

The platform is local-only, not live. No external users to protect. Backend routing is stable; the migration is template + CSS only, plus one new view for the landing page.

---

## Strategy: Audit-and-deploy phased migration on `main`

### Working model

- All work happens on `main`. No feature branch, no worktree. The user can only see `main` in their dev server.
- Per phase: **audit → patch (uncommitted edits to working tree) → user verifies → commit + cleanup**. No uncommitted state between phases. No scratch files or `.bak` clutter left behind.
- Rollback for an in-progress phase = `git checkout -- <files>`. Rollback for a committed phase = `git revert <commit>`.
- Nothing pushed to remote until the user explicitly says so.

### The 8-point per-template audit (mandatory before deploy)

For every template in a phase, check:

1. **Comment hygiene** — `{# short single-line phrase #}` is fine. ANY multi-line `{# ... #}` block (especially decorative `═`/`─`/`━` headers) MUST be converted to `{% comment %}...{% endcomment %}`. Multi-line `{# #}` blocks leak literal text into the rendered UI.
2. **URL refs** — every `{% url 'x' %}` must resolve against live `urls.py`. Broken refs are classified: typo → fix; missing-but-stub-able → add stub view + URL; missing-and-not-worth-stubbing → safe form `{% url 'x' as u %}{{ u|default:'#' }}`. Never silent-replace with raw `#` (loses semantic info).
3. **Includes / extends** — every `{% include %}` and `{% extends %}` target must exist on disk.
4. **Context variables** — every `{{ var }}` / `{% if var %}` / `{% for x in var %}` is cross-checked against the rendering view's context. Missing vars: add to view (load-bearing) or wrap in `{% if %}` (decorative).
5. **Static refs** — every `{% static '...' %}` target file must exist.
6. **HTMX endpoints** — `hx-get` / `hx-post` / `hx-put` / `hx-delete` URLs must resolve AND endpoints must return a partial, not a full page.
7. **Block names** — template's `{% block %}` names must match the blocks defined in `base.html`.
8. **No legacy UI references** — no template should reference the legacy `rwanga.css` via `{% static 'css/rwanga.css' %}`, no `<link>` to legacy stylesheets, no legacy class names that the new `rwanga-ds.css` doesn't define. The new system serves *only* the new design; legacy must not co-exist after its phase is replaced.

A small Python audit script (~50 LOC) automates checks 1, 2, 3, 5, 6, 7, 8. Check 4 (context vars) requires manual view inspection.

### "Hit a wall" escape hatch

Before patching, count issues. Threshold: a single template with >10 broken refs, OR a phase where total issues exceed total templates → STOP. Tell the user: "*Phase N has hit the wall. Recommend rebuilding from `rwanga-ds/` + AGENT-PATTERNS.md instead of patching.*" User decides. If rebuild → that phase ignores design-kit, every template is written fresh with full knowledge of live URLs/views/context. Other phases continue with audit-and-replace.

### Live-only restyle

~16 templates exist live but have no design-kit counterpart. They get rewritten using `AGENT-PATTERNS.md` as the spec. List:

- `templates/components/_rail_inner.html`
- `accounts/_invite_row.html`
- `community/_create_modal.html`
- `notifications/list.html`, `_panel.html`
- `locations/_add_modal.html`, `_add_success_oob.html`, `_location_list.html`
- `reviews/_bible_tab.html`, `_comments.html`, `_comments_list.html`, `_decisions_list.html`, `partials/decision_locked_card.html`, `partials/decision_rejected_card.html`
- `scripts/_elements_body.html`
- `departments/{continuity,lighting,props,sound,wardrobe}.html` + 5 partials in `departments/partials/`

These follow the LIST / SPLIT VIEW / SCENE-VIEW patterns from AGENT-PATTERNS.md, matching whatever pattern the surrounding domain uses.

---

## Phase plan

| # | Phase | Files | Risk | Verification |
|---|-------|-------|------|------|
| 0 | Branch safety + workspace prep | none — clean working tree, deal with `_rail_inner.html` untracked | none | confirm clean status |
| 1 | Foundation: CSS + Landing | `static/css/rwanga-ds.css` (new), `templates/landing.html` (new), `src/urls.py` (landing view + URL) | zero | visit `/` → landing renders correctly with new CSS |
| 2 | Shell | `templates/base.html`, `templates/components/*.html` (8 files), restyle `_rail_inner.html` | **highest** | visit login, projects list, scene view → shell looks right; theme toggle, modals, RTL all correct |
| 3 | Accounts | 6 design-kit files + restyle `_invite_row.html` | low | login, register, profile, settings, team |
| 4 | Notifications + Locations + Floorplans | 3 design-kit + 5 live-only partials restyled | low | each module's main page |
| 5 | Scripts + Shots + Scheduling | 10 design-kit + 1 live-only partial; many missing scheduling URLs to handle | medium | each module's pages + HTMX flows |
| 6 | Projects (the heart) | 6 page templates + 10 scene tabs | high | project dashboard, scene view, all 10 tabs |
| 7 | Reviews + Community | 11 design-kit + 6 live-only review partials + 1 live-only community partial | high | review workbench, chain viewer, community list |
| 8 | Progress + Departments | 10 progress + 5 dept tabs + 5 dept partials (most live-only restyle work) | medium | progress dashboard, departments tabs in scene view |
| 9 | Final QA + legacy purge | smoke-test full flow, **delete `static/css/rwanga.css`**, delete any `.bak`, grep-confirm zero references to legacy CSS or legacy class names anywhere in the repo | none | full user flow works end-to-end with only the new design alive |

**Why this order:**
- Phase 1 first validates the CSS pipeline + design system rendering on a *new* page before anything live can break.
- Phase 2 (shell) is highest risk; tackle it second with full attention rather than discover problems three phases in.
- Phases 3–8 are content swaps that depend on the shell being correct.
- Progress + Departments last because progress has the most missing URLs and departments has the largest restyle surface.

Each phase = one commit on `main`. One commit per phase, full stop. Atomic units, easy to revert.

---

## Per-phase rhythm

```
1. Audit
   → Run audit script over phase's templates
   → Manual context-var check on rendering views
   → Produce written audit report (in chat, not committed)

2. Wall check
   → If issue count exceeds threshold, halt and offer rebuild

3. Patch
   → Apply fixes per audit (template fixes + any backend stubs)
   → Edits go to working tree, uncommitted

4. User verify
   → User runs dev server on main, visits affected pages
   → Confirms layout / behavior / no regressions

5. Commit + cleanup
   → On approval: git add the phase's files, single commit
   → Delete any scratch scripts / temp files
   → git status must be clean for migration scope

6. Done → next phase
```

Session sweep at end of each working session: `git status` clean for migration scope, no leftover scratch files in repo root. If user calls it a night mid-phase, we either finish-and-commit or discard-and-restart-fresh — no overnight uncommitted state.

---

## Out of scope

- The 12 `exports/` templates (inline-CSS PDF/print templates). Reskin separately later.
- Pushing to remote. All commits stay local until user says push.
- Backend feature additions beyond stub views needed to satisfy template URL refs.
- React / SPA conversion. HTMX stays as the interaction layer.
- The legacy `rwanga.css` is replaced by `rwanga-ds.css`. Held as `.bak` only as a transient safety net during phase rollouts; **deleted in Phase 9**. No legacy CSS, no legacy class names, no legacy templates may remain after Phase 9 — the system serves only the new design with the glowing icons.

---

## Success criteria

- All 9 phases committed on `main` with the user's visual approval at each checkpoint.
- `python manage.py runserver` starts cleanly with no `TemplateDoesNotExist` / `NoReverseMatch` / `TemplateSyntaxError` on the smoke-test paths.
- Smoke test: login → project list → project dashboard → scene view → switch through all 10 tabs → workbench → community — all render correctly with new design system.
- No raw `{# ... #}` text leaks visible anywhere in rendered UI.
- No raw `#` placeholders for URLs that should have stubs.
- **Legacy UI fully purged:** `static/css/rwanga.css` deleted; no `.bak` left; `grep -r` shows zero references to legacy CSS path or legacy class names; only `rwanga-ds.css` is loaded by any template.
- Working tree clean at end.

---

## Open decisions (not blocking design approval, will resolve as phases proceed)

- **Bootstrap version match.** Design-kit assumes Bootstrap 5; need to confirm live `base.html` uses BS5 (will surface in Phase 2 audit). If mismatch → that's a Phase 2 wall trigger.
- **Stub-view threshold.** When a missing URL is "worth a stub" vs "not worth it" — judgment call per phase. Default heuristic: if the missing URL is referenced by a primary navigation element (sidebar, topnav tab, dashboard module card), stub it; if it's a deep-page modal trigger or a not-yet-built feature, safe-form it.
- **Departments visual pattern.** Departments are scene-view tabs; safest match is the existing scene-tab pattern from `projects/scenes/tabs/*.html`. Will confirm in Phase 8.
