# Remediation Validation Report

Date: 2026-04-29

Scope:
- `docs/AGENT-REMEDIATION.md`
- `docs/REMEDIATION_EXECUTION_PLAN.md`

## Targeted Error Pattern Fix (Login `next`)

- Runtime login template uses safe access:
  - `src/accounts/templates/accounts/login.html`
  - Hidden `next` fields use `{{ request.GET.next|default:'' }}`
- No unsafe `request.POST.next` pattern remains in runtime templates.
- No Django template comment blocks remain in runtime templates (`templates/**/*.html`, `src/**/templates/**/*.html`).

## Additional Template/Route Alignment Fix

- Added URL alias for design-kit dashboard link compatibility:
  - `src/projects/urls.py`
  - Added `projects:workspace` route mapped to `ProjectDashboardView`
- Replaced `projects/dashboard.html` with design-kit dashboard structure and module grid.
- Removed blank-page behavior from key endpoints:
  - `src/projects/views.py`
    - `ProjectListView` now routes to a real page (project dashboard or wizard)
    - `ProjectCreateStepView` returns wizard step view instead of empty response
    - `ProjectSceneListPartialView` returns scene list markup instead of empty response
    - `ProjectSceneTabView` returns non-empty tab placeholder content
  - `src/exports/views.py`
    - `SceneViewerView` renders shared `stub.html` instead of empty response
  - `src/scripts/views.py`
    - `ScriptUploadView.post` no longer returns an empty page for non-HTMX requests

## Validation Checklist Status

- [x] base shell is design-kit structure (`rw-app`, rail, main, topnav includes)
- [x] login template includes design-kit forms and Kurdish branding
- [x] login redirect default is configured (`LOGIN_REDIRECT_URL = "/projects/"`)
- [x] `/` redirects to `/projects/` via root URLconf
- [x] `/projects/` no longer renders "coming soon"; routes to a real page
- [x] sidebar/topnav components are in shared templates and included by base layout
- [x] Bootstrap local vendor assets are used consistently in `base.html` and login template
- [x] referenced URL names in copied templates are present, including `projects:workspace`
- [x] Progress app task volume is expanded (`ProgressTask` count > 20)
- [x] no runtime Django template comments are present
- [x] major previously blank routes now return rendered content or non-empty partials

- [ ] visual parity assertions requiring manual browser verification:
  - dark theme toggle behavior
  - RTL placement fidelity
  - token rendering in dev tools
  - module color fidelity

## Commands/Checks Executed

- `python manage.py check` -> pass
- template pattern scans:
  - `request.GET/POST` access in templates
  - Django template comments
- code-level verification of URL/view/template mappings
- endpoint behavior verification by view inspection for previously empty responses

## Notes

- The reported `VariableDoesNotExist` pattern for `next` is resolved in runtime login template.
- If the same exception reappears, collect the fresh traceback path and template loader chain to confirm whether any non-runtime template source is being rendered unexpectedly.
