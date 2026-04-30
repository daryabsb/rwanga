# Remediation Execution Plan (Pre-Code Confirmation)

Date: 2026-04-29  
Scope Source: `e:\api\rwanga\docs\AGENT-REMEDIATION.md`  
Status: Planning only (no additional feature coding in this step)

## Objective

Apply the remediation exactly as written:

1. Treat `rwanga-design-kit` as the source of truth.
2. Copy finished templates/static into the runtime project locations.
3. Remove invented UI templates.
4. Keep URL compatibility via stub views and one shared stub template only.
5. Fix login redirect flow and root redirect.
6. Load complete Progress task/update/blocker history for P0/P1.
7. Validate using the provided checklist before any next feature work.

## Rules I Will Follow

- No inventing UI.
- No new page templates except one shared `templates/stub.html` allowed by remediation file.
- If a URL is missing, add/adjust a view/URL stub, not a custom template.
- Keep backend in `src/`; design-kit remains external source files to copy from.
- Update Progress app during each remediation step.
- Stop and ask if any ambiguity appears.

## Implementation Plan (Mapped to Fix File)

## Fix 1: Copy Templates/Static and Remove Invented Templates

1. Copy design-kit templates exactly to required runtime locations:
   - `rwanga-design-kit/templates/base.html` -> `templates/base.html`
   - `rwanga-design-kit/templates/components/*` -> `templates/components/*`
   - `rwanga-design-kit/templates/accounts/login.html` -> `src/accounts/templates/accounts/login.html`
   - `rwanga-design-kit/templates/projects/{dashboard,create_wizard,scene_view}.html` -> `src/projects/templates/projects/`
   - `rwanga-design-kit/templates/scripts/upload.html` -> `src/scripts/templates/scripts/upload.html`
2. Copy static assets exactly:
   - `rwanga-design-kit/static/css/rwanga.css` -> `static/css/rwanga.css`
   - `rwanga-design-kit/static/js/rwanga.js` -> `static/js/rwanga.js`
3. Delete invented/duplicate templates that conflict with copied design-kit files.
4. Keep runtime template lookup clean and deterministic.

## Fix 2: Login Redirect + Root Redirect

1. Ensure `LOGIN_REDIRECT_URL = '/projects/'` in settings (common/allauth component).
2. Ensure `/accounts/login/` POST follows allauth behavior and respects `next`.
3. Add root URL redirect:
   - `path('', RedirectView.as_view(url='/projects/', permanent=False))`
4. Verify successful login redirects to `next` when provided, else `/projects/`.

## Fix 3: URL Stubs for Template References

1. Create exactly one shared stub template:
   - `templates/stub.html` (per remediation doc content).
2. For missing template URL names, create/adjust stub views returning `stub.html`.
3. Ensure all listed URL names resolve for accounts/projects/scripts/shots/floorplans/scheduling/departments/locations/notifications/exports/ai_engine.
4. Do not add new module templates for stubs.

## Fix 4: Progress App Data Recovery

1. Load full P0 checklist tasks (12 items) and mark completed where appropriate.
2. Load full P1 checklist tasks (11 items) and mark actual status.
3. For each task, add `ProgressUpdate` entries:
   - done work
   - files affected
   - tests run and result
   - blockers/gaps
4. Add GapBlockers for Drift A-E exactly as listed in remediation.

## Fix 5: Bootstrap Consistency Choice

Remediation allows either:
- Option A: CDN Bootstrap
- Option B: local Bootstrap files

Planned default: **Option B (local)** for consistency with current static policy, unless you instruct Option A before execution.
No mixed mode allowed.

## Validation Plan (Exact Checklist Enforcement)

After applying fixes, validate each item in remediation checklist:

- base/layout structure matches design-kit shell.
- login page exact expected content and forms.
- login redirect behavior.
- `/` -> `/projects/`.
- dashboard/list/sidebar/topnav/theming/RTL correctness.
- rwanga.css token load check.
- URL resolution for all referenced names.
- Progress dashboard shows expanded real tasks (20+).
- no invented templates remain.

## Deliverables You Will Receive After Execution

1. Git commit sequence for each remediation block.
2. Diff summary by fix number.
3. Validation checklist report with pass/fail per item.
4. Progress app update summary (tasks, updates, blockers created/closed).
5. Final blocker list (if any) with explicit next action requests.

## Stop Conditions

- If design-kit and runtime file mapping is ambiguous.
- If a URL/view contract conflicts with existing backend behavior and no explicit instruction exists.
- If any remediation step would require inventing UI beyond allowed stub template.

