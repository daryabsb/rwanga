# Rwanga Delivery Report (Phase 0 to Current)

Date: 2026-04-29
Repo: `e:\api\rwanga`
Branch: `main`

## 1) Delivery Timeline (Commits)

- `d088c2fc` Initial project bootstrap start.
- `f76cb912` Initial project structure and dependencies.
- `0da87087` `feat(core): bootstrap rwanga foundation`
- `5dda0f86` `feat(progress): add db-backed project tracking app`
- `67f0386f` `feat(accounts): implement phase1 accounts slice`
- `4b7a95b3` `feat(projects): enforce service-layer CRUD flow`
- `18a3319c` `feat(p1): complete accounts and projects foundation`
- `85fd0a5f` `fix(ui): align phase1 project shell to design kit`
- `2ff782a3` `fix(accounts): restore path import for URLConf loading`
- `d2a79442` `fix(templates): guard topnav user controls for anonymous access`
- `ac6067ce` `feat(ui): align design-kit routes and template scaffolding`

## 2) Delivered Scope (By Area)

### Phase 0 Foundation

- Django project setup and modular settings.
- Core app foundations and base patterns.
- Progress app (DB-backed) with task/update tracking models and dashboard/API surface.

### Accounts + Projects Foundations

- Accounts domain models and integration with custom auth model.
- Projects domain models and service-oriented view/API foundations.
- Progress tracking records for major milestones and blockers.

### Frontend Integration Work

- Design-kit template and static asset syncing into runtime project.
- URL namespace expansion to satisfy template route references.
- Scene-shell and module route compatibility scaffolding.

## 3) Confirmed Drift / Gaps

The following drift happened and is confirmed:

- Drift A: Auth flow diverged from expected HUD2/allauth behavior in runtime (`POST /accounts/login/` returned `405`).
- Drift B: Bootstrap was loaded via CDN instead of project-local BS5 assets.
- Drift C: Large Django `{% comment %} ... {% endcomment %}` comment blocks caused visible leakage in UI in some rendering paths.
- Drift D: Multiple invented placeholder templates/views were added where strict design-kit-first reuse was expected.
- Drift E: Static serving path resolution was broken in dev runtime for `/static/...` due settings/include path behavior.

## 4) Corrective Work Applied Today

- Auth: Added POST handling for `/accounts/login/` through allauth `LoginForm` flow with `next` redirect handling.
- BS5: Replaced Bootstrap CDN references in base/login templates with local static vendor paths.
- Static assets: Added local Bootstrap files at:
  - `static/vendor/bootstrap/css/bootstrap.min.css`
  - `static/vendor/bootstrap/js/bootstrap.bundle.min.js`
- Comment leakage: Removed large decorative template comment headers from key templates.
- Static serving: Fixed dev static/media URL serving path behavior in `src/urls.py`.
- Settings pathing: Corrected split-settings path resolution in `src/settings/components/paths.py` so runtime points to project-local:
  - templates: `e:\api\rwanga\templates`
  - static: `e:\api\rwanga\static`

## 5) Runtime Verification Snapshot

- `python manage.py check` passes.
- `/accounts/login/` now allows `GET, POST, HEAD, OPTIONS` (no longer method-limited to GET).
- Static files now resolve in dev:
  - `/static/css/rwanga.css` -> `200`
  - `/static/vendor/bootstrap/css/bootstrap.min.css` -> `200`

## 6) Root Cause Summary

- Mixed execution between strict design-kit reuse and compatibility scaffolding introduced unintended invention.
- split-settings include behavior around `__file__` in included files caused path drift for static/template roots.
- Incremental fixes addressed immediate breakages, but strict template reuse discipline was not fully maintained.

## 7) Recovery Plan (Strict)

- Step 1: Keep backend accounts/settings stability intact.
- Step 2: Replace invented templates/views with direct design-kit template usage wherever provided.
- Step 3: Keep only minimal compatibility glue required for URL/context continuity.
- Step 4: Validate every rendered page against `rwanga-design-kit/templates` before commit.
- Step 5: Log each corrective step in Progress app and commit in small increments.

