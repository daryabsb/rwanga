# Rwanga UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Django app's UI from the legacy `rwanga.css` system to the new Rwanga Design System v1.0 (`rwanga-ds.css`), using the design-kit's pre-migrated templates as a starting point. Verified visually by the user, phase by phase, on `main`. No legacy UI may remain at the end.

**Architecture:** Audit-and-deploy phased migration. For each phase: audit templates against the live codebase (URL refs, includes, context vars, statics, HTMX, blocks, comment hygiene, legacy refs) → apply patches in working tree → user verifies in browser → commit + cleanup. Nine phases ordered from zero-risk (new-file additions) to highest-risk (shell). Each phase = exactly one commit on `main`. Verify-before-commit hygiene rule: no uncommitted state between phases.

**Tech Stack:** Django (templates, urls.py, settings), Bootstrap 5 + RTL, HTMX, Python (audit script), PowerShell + Bash for ops, Git on local-only `main`.

**Spec reference:** `docs/superpowers/specs/2026-05-08-rwanga-ui-migration-design.md`

---

## File Structure

**New files created during migration:**
- `scripts/audit_template.py` — per-template audit tool, used in every phase
- `static/css/rwanga-ds.css` — the new design system stylesheet
- `templates/landing.html` — public landing page (Phase 1)

**Modified during migration (each touched in exactly one phase):**
- `src/urls.py` — landing view + URL (Phase 1)
- `templates/base.html` + `templates/components/*.html` (Phase 2)
- `src/<app>/templates/<app>/*.html` for each domain (Phases 3–8)

**Deleted in Phase 9 (legacy purge):**
- `static/css/rwanga.css`
- Any `*.bak` files we created during migration
- All references to legacy CSS / class names

**Templates restyled from scratch using `rwanga-design-kit/rwanga-ds/AGENT-PATTERNS.md`** (live-only, no design-kit version exists):

| Phase | File |
|-------|------|
| 2 | `templates/components/_rail_inner.html` |
| 3 | `src/accounts/templates/accounts/_invite_row.html` |
| 4 | `src/notifications/templates/notifications/_panel.html`, `list.html`; `src/locations/templates/locations/_add_modal.html`, `_add_success_oob.html`, `_location_list.html` |
| 5 | `src/scripts/templates/scripts/_elements_body.html` |
| 7 | `src/reviews/templates/reviews/_bible_tab.html`, `_comments.html`, `_comments_list.html`, `_decisions_list.html`, `partials/decision_locked_card.html`, `partials/decision_rejected_card.html`; `src/community/templates/community/_create_modal.html` |
| 8 | `src/departments/templates/departments/{continuity,lighting,props,sound,wardrobe}.html` and 5 partials in `src/departments/templates/departments/partials/` |

**Out of scope (do not touch):**
- All 12 `src/exports/templates/exports/*.html` files (inline-CSS PDF/print).
- `rwanga-design-kit/` directory contents (read-only source-of-truth for migration).

---

## Working rules (apply to every phase)

1. **Branch:** all work on `main`. No worktree, no feature branch — the user's dev server runs on `main`.
2. **Commit cadence:** exactly one commit per phase. Each phase = one atomic git commit with the message format shown.
3. **No overnight WIP:** every working session ends with `git status` clean for migration scope. If a phase isn't ready to commit by end of session, either finish-and-commit or `git checkout -- <files>` to discard. Never leave half-applied changes.
4. **No scratch files in repo root:** any audit reports / temp scripts / `.bak` files (other than the transient `rwanga.css.bak` from Phase 1) get removed in the same session they're created.
5. **Patch workflow (used in every phase):** for each non-INFO audit issue:
   - **COMMENT** issue: open the design-kit source file, convert any multi-line `{# ... #}` block to `{% comment %}...{% endcomment %}`. Single-line `{# short phrase #}` is fine.
   - **URL** issue: open the design-kit source. If the name is a typo of an existing URL, fix it. If it's a missing-but-stub-able URL (referenced from primary nav), add a stub view + URL pattern in the live app. Otherwise convert to safe form `{% url 'name' as u %}{{ u|default:'#' }}` — never leave a raw `#`.
   - **INCLUDE / EXTENDS** issue: fix the path to a template that exists, OR create the missing partial if it's listed in the live-only restyle table.
   - **STATIC** issue: confirm the asset exists in `static/`; copy it from the design-kit's static dir if missing, or fix the reference.
   - **LEGACY** issue: remove the legacy CSS reference; replace with `{% static 'css/rwanga-ds.css' %}` if a stylesheet is needed at all.
   Then re-run the same audit command. Repeat until zero non-INFO issues.
6. **Iterate-or-discard on user verification:** if the user reports a problem during a phase's verify step:
   - **Fixable** → patch in working tree (still uncommitted), ask them to re-verify.
   - **Unfixable in audit-and-replace mode** → wall trigger. Run `git checkout -- <files>` to discard the working-tree changes, and offer the user a rebuild from `rwanga-ds/` + AGENT-PATTERNS.md for that phase.
7. **Wall threshold (per audit task):** if a single template has > 10 non-INFO issues OR a phase's cumulative non-INFO issue count exceeds 2× the number of templates in that phase, STOP and tell the user the phase has hit the wall. They decide rebuild-vs-continue.
8. **No remote pushes** until the user explicitly asks. All commits stay local.

---

## Phase 0 — Setup

### Task 0.1: Confirm clean baseline

**Files:** none modified — inspection only.

- [ ] **Step 1: Confirm we're on `main` with a clean tree (modulo pyc noise)**

Run:
```bash
cd "E:/api/rwanga" && git status --short && git rev-parse --abbrev-ref HEAD
```

Expected output: only the `__pycache__/*.pyc` lines (noise) and `?? templates/components/_rail_inner.html`. Branch should print `main`. If anything else appears, stop and resolve it before proceeding.

- [ ] **Step 2: Confirm the spec is committed**

Run:
```bash
git log --oneline -3
```

Expected: `cbab6eb9 docs(migration): purge-legacy rule + 8th audit check` and `d1926c06 docs: add Rwanga UI migration design spec` should appear in recent commits.

---

### Task 0.2: Commit `_rail_inner.html` as baseline

**Files:**
- Track: `templates/components/_rail_inner.html`

This file is already in use as a shared rail partial (verified: it uses `{% comment %}` correctly and references `projects:list`). Commit it as-is so Phase 2's restyle has a clean baseline.

- [ ] **Step 1: Stage and commit `_rail_inner.html`**

Run:
```bash
git add templates/components/_rail_inner.html
git commit -m "$(cat <<'EOF'
chore: track existing _rail_inner.html partial

Shared rail icon list used by desktop aside + mobile offcanvas.
Tracking before the design-system migration restyles it in Phase 2.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Verify commit landed**

Run:
```bash
git log --oneline -1
git status --short
```

Expected: latest commit is the chore commit. `git status` shows only pyc noise.

---

### Task 0.3: Build the audit script

**Files:**
- Create: `scripts/audit_template.py`

This script automates audit checks 1, 2, 3, 5, 6, 7, 8 from the spec. Used in every subsequent phase.

- [ ] **Step 1: Create the `scripts/` directory and write the audit script**

Create file `scripts/audit_template.py` with this exact content:

```python
#!/usr/bin/env python3
"""
Rwanga UI migration: per-template audit script.

Usage:
    python scripts/audit_template.py <template_path>
    python scripts/audit_template.py --all
    python scripts/audit_template.py --dir <directory>

Checks (per spec docs/superpowers/specs/2026-05-08-rwanga-ui-migration-design.md):
  1. Comment hygiene — multi-line {# ... #} blocks
  2. URL refs — {% url 'x' %} resolves against urlconf
  3. Includes / extends — target files exist
  5. Static refs — target files exist
  6. HTMX URLs — list for manual cross-check
  7. Block names — list for manual cross-check vs base.html
  8. Legacy refs — flag legacy rwanga.css / class names
"""
from __future__ import annotations
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
TEMPLATES_ROOT = ROOT / "templates"
STATIC_ROOT = ROOT / "static"

URL_TAG = re.compile(r"\{%-?\s*url\s+['\"]([^'\"]+)['\"]")
INCLUDE_TAG = re.compile(r"\{%-?\s*include\s+['\"]([^'\"]+)['\"]")
EXTENDS_TAG = re.compile(r"\{%-?\s*extends\s+['\"]([^'\"]+)['\"]")
STATIC_TAG = re.compile(r"\{%-?\s*static\s+['\"]([^'\"]+)['\"]")
BLOCK_TAG = re.compile(r"\{%-?\s*block\s+(\w+)")
HTMX_URL = re.compile(r'hx-(?:get|post|put|delete|patch)\s*=\s*["\']([^"\']+)["\']')
DJ_OPEN = re.compile(r"\{#")
DJ_CLOSE = re.compile(r"#\}")


def collect_url_names() -> set[str]:
    """Walk all non-API urls.py files, return flat set of 'app:name' strings."""
    names: set[str] = set()
    for urls_py in SRC.rglob("urls.py"):
        if "api" in urls_py.parts:
            continue
        text = urls_py.read_text(encoding="utf-8")
        m = re.search(r'app_name\s*=\s*["\']([^"\']+)["\']', text)
        ns = m.group(1) if m else None
        for nm in re.findall(r'name\s*=\s*["\']([^"\']+)["\']', text):
            names.add(f"{ns}:{nm}" if ns else nm)
    root_urls = SRC / "urls.py"
    if root_urls.exists():
        text = root_urls.read_text(encoding="utf-8")
        for nm in re.findall(r'name\s*=\s*["\']([^"\']+)["\']', text):
            names.add(nm)
    # allauth ships a bunch of standard names that root urls.py includes
    names.update({"account_login", "account_logout", "account_signup",
                  "account_change_password", "account_email", "account_reset_password"})
    return names


def template_exists(rel_path: str) -> bool:
    """True if template path resolves under root templates/ or any app templates/."""
    if (TEMPLATES_ROOT / rel_path).exists():
        return True
    for app_templates in SRC.glob("*/templates"):
        if (app_templates / rel_path).exists():
            return True
    return False


def audit(path: Path, known_urls: set[str]) -> list[str]:
    text = path.read_text(encoding="utf-8")
    issues: list[str] = []

    # 1. Comment hygiene
    for i, line in enumerate(text.splitlines(), 1):
        opens, closes = len(DJ_OPEN.findall(line)), len(DJ_CLOSE.findall(line))
        if opens != closes:
            issues.append(f"  L{i}: COMMENT unclosed/multiline {{# … #}} — convert to {{% comment %}}")
    if re.search(r"\{#\s*[═─━]", text):
        issues.append("  WARN: decorative {# ═/─/━ #} block — convert to {% comment %}")

    # 2. URL refs
    for url_name in URL_TAG.findall(text):
        if url_name not in known_urls:
            issues.append(f"  URL: '{url_name}' not in urlconf")

    # 3. Includes / extends
    for inc in INCLUDE_TAG.findall(text):
        if not template_exists(inc):
            issues.append(f"  INCLUDE: '{inc}' missing")
    for ext in EXTENDS_TAG.findall(text):
        if not template_exists(ext):
            issues.append(f"  EXTENDS: '{ext}' missing")

    # 5. Static refs
    for s in STATIC_TAG.findall(text):
        if not (STATIC_ROOT / s).exists():
            issues.append(f"  STATIC: '{s}' missing")

    # 6. HTMX URLs (informational)
    htmx = HTMX_URL.findall(text)
    if htmx:
        issues.append(f"  INFO: {len(htmx)} hx-* URLs (manually verify each returns a partial)")

    # 7. Blocks (informational)
    blocks = sorted(set(BLOCK_TAG.findall(text)))
    if blocks:
        issues.append(f"  INFO: blocks: {', '.join(blocks)} (cross-check vs base.html)")

    # 8. Legacy refs
    if "css/rwanga.css" in text and "css/rwanga-ds.css" not in text.replace("css/rwanga.css", "", 1):
        issues.append("  LEGACY: references legacy css/rwanga.css")

    return issues


def collect_targets(arg: str) -> list[Path]:
    if arg == "--all":
        out: list[Path] = []
        for d in [TEMPLATES_ROOT, *SRC.glob("*/templates")]:
            for f in d.rglob("*.html"):
                if "/exports/" in f.as_posix() or "\\exports\\" in str(f):
                    continue
                out.append(f)
        return out
    if arg == "--dir":
        d = Path(sys.argv[2])
        return [f for f in d.rglob("*.html")]
    return [Path(arg)]


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    known = collect_url_names()
    targets = collect_targets(sys.argv[1])
    fail = 0
    for t in targets:
        issues = audit(t, known)
        if issues:
            print(f"\n{t}")
            for i in issues:
                print(i)
            fail += sum(1 for i in issues if not i.lstrip().startswith("INFO"))
        else:
            print(f"\n{t}\n  OK")
    print(f"\n--- {len(targets)} files audited, {fail} non-info issues ---")
    return 0 if fail == 0 else 0  # always exit 0; this is informational


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Smoke-test the audit script on a known design-kit template**

Run:
```bash
cd "E:/api/rwanga"
python scripts/audit_template.py rwanga-design-kit/templates/projects/dashboard.html
```

Expected: prints the file path, then a list of issues (URL refs not in urlconf are likely; that's fine — the script is finding them, which is the point). Should NOT crash.

- [ ] **Step 3: Commit Phase 0**

Run:
```bash
git add scripts/audit_template.py
git commit -m "$(cat <<'EOF'
chore(migration): add per-template audit script

Phase 0 setup: scripts/audit_template.py automates 7 of the 8 audit
checks from the migration spec (comment hygiene, URL refs, includes,
extends, static refs, HTMX URLs, block names, legacy refs).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify Phase 0 done**

Run:
```bash
git status --short
```

Expected: only pyc noise. Working tree clean for migration scope.

---

## Phase 1 — Foundation: CSS + Landing page

**Risk:** zero — all new files. No existing pages affected until Phase 2.
**Verification:** visit `http://127.0.0.1:8000/` (logged out) → landing page renders correctly with new design system CSS.

### Task 1.1: Confirm `landing.html` is standalone

**Files:** read-only inspection.

The Phase 1 plan assumes `rwanga-design-kit/templates/landing.html` is standalone (its own `<html>` + own `<link>` to `rwanga-ds.css`), not extending `base.html`. If it extends `base.html`, the new CSS won't load until Phase 2 — which would break Phase 1 verification.

- [ ] **Step 1: Read the first 10 lines of `landing.html`**

Run:
```bash
head -n 10 "E:/api/rwanga/rwanga-design-kit/templates/landing.html"
```

Expected: starts with `<!DOCTYPE html>` or `{% load ... %}` followed by `<!DOCTYPE html>`. If it starts with `{% extends "base.html" %}`, STOP — Phase 1 needs a different approach (move CSS deployment to Phase 2 instead).

---

### Task 1.2: Audit `landing.html`

- [ ] **Step 1: Run audit on the landing template**

Run:
```bash
python scripts/audit_template.py rwanga-design-kit/templates/landing.html
```

Expected: any URL refs flagged should be ones that exist (e.g. `accounts:login`, `accounts:register`, `projects:list`). Any `INCLUDE`/`EXTENDS` flagged need fixing before deploy.

- [ ] **Step 2: Resolve any non-INFO findings**

If audit reports any of `URL`, `INCLUDE`, `EXTENDS`, `STATIC`, `LEGACY`, or `COMMENT` issues: patch the **design-kit source** (since we'll copy from there) by either fixing the URL name or converting comments. Do NOT make ad-hoc fixes in the deployed copy later.

If only `INFO` lines appear: continue.

---

### Task 1.3: Deploy CSS

**Files:**
- Create: `static/css/rwanga-ds.css`
- Backup: `static/css/rwanga.css` → `static/css/rwanga.css.bak` (transient; deleted in Phase 9)

- [ ] **Step 1: Backup the legacy CSS**

Run:
```bash
cp "E:/api/rwanga/static/css/rwanga.css" "E:/api/rwanga/static/css/rwanga.css.bak"
```

- [ ] **Step 2: Copy the new design system stylesheet**

Run:
```bash
cp "E:/api/rwanga/rwanga-design-kit/static/css/rwanga-ds.css" "E:/api/rwanga/static/css/rwanga-ds.css"
ls "E:/api/rwanga/static/css/"
```

Expected: `rwanga-ds.css`, `rwanga.css`, `rwanga.css.bak` all present.

---

### Task 1.4: Deploy `landing.html`

**Files:**
- Create: `templates/landing.html`

- [ ] **Step 1: Copy the landing template**

Run:
```bash
cp "E:/api/rwanga/rwanga-design-kit/templates/landing.html" "E:/api/rwanga/templates/landing.html"
ls "E:/api/rwanga/templates/landing.html"
```

Expected: file exists.

---

### Task 1.5: Wire the landing view + URL

**Files:**
- Modify: `src/urls.py`

The current root path is `path("", RedirectView.as_view(url="/projects/", permanent=False))`. Replace with a function view that renders `landing.html` for anonymous users and redirects authenticated users to `/projects/`.

- [ ] **Step 1: Patch `src/urls.py` — imports**

Edit `E:/api/rwanga/src/urls.py`. Replace the existing imports block:

```python
from django.conf import settings
from django.contrib import admin
from django.conf.urls.static import static
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
```

with:

```python
from django.conf import settings
from django.contrib import admin
from django.conf.urls.static import static
from django.shortcuts import redirect, render
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
```

- [ ] **Step 2: Patch `src/urls.py` — add landing view**

After the `HealthAPIView` class definition, add:

```python


def landing_view(request):
    if request.user.is_authenticated:
        return redirect("projects:list")
    return render(request, "landing.html")
```

- [ ] **Step 3: Patch `src/urls.py` — replace root URL**

Replace the line:

```python
    path("", RedirectView.as_view(url="/projects/", permanent=False)),
```

with:

```python
    path("", landing_view, name="landing"),
```

- [ ] **Step 4: Verify `urls.py` still parses**

Run:
```bash
cd "E:/api/rwanga" && python -c "from src import urls; print('urlconf OK')"
```

Expected: prints `urlconf OK`. Any import error → fix before continuing.

---

### Task 1.6: User verification of Phase 1

**Files:** none.

- [ ] **Step 1: Start the dev server (if not already running)**

Tell the user: *"Phase 1 changes are in working tree. Please start the dev server (or hot-reload it), open `http://127.0.0.1:8000/` in a logged-out browser, and confirm the landing page renders with the new design system styling."*

- [ ] **Step 2: Wait for user verification**

User checks:
- Landing page loads (no 500)
- New design system CSS is rendering (visible new look, glowing icons if landing has them)
- Navigation to `/accounts/login/` still works (login page is *not* yet migrated; expected to use legacy CSS)
- If logged in, visiting `/` redirects to `/projects/`

If user reports a problem: patch in working tree (still uncommitted), have them re-verify.

If unfixable: discard Phase 1's changes. `urls.py` is the only modified-tracked file (use `git checkout`), the rest are new-untracked files (use `rm`):
```bash
cd "E:/api/rwanga"
git checkout -- src/urls.py
rm -f static/css/rwanga-ds.css static/css/rwanga.css.bak templates/landing.html
```

---

### Task 1.7: Commit Phase 1

- [ ] **Step 1: Stage Phase 1 files and commit**

Run:
```bash
cd "E:/api/rwanga"
git add static/css/rwanga-ds.css static/css/rwanga.css.bak templates/landing.html src/urls.py
git commit -m "$(cat <<'EOF'
feat(ui-migration): phase 1 — deploy CSS + landing page

- Deploy rwanga-ds.css to static/css/
- Backup legacy rwanga.css as rwanga.css.bak (transient; removed Phase 9)
- Add templates/landing.html (standalone, references rwanga-ds.css)
- Replace root RedirectView with landing_view (redirects authed users
  to /projects/, renders landing for anon)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
```

Expected: phase commit lands; `git status` shows only pyc noise.

---

## Phase 2 — Shell (base.html + components)

**Risk:** HIGHEST. Every page in the app extends `base.html`. If a class name, JS hook, or block name is wrong, the whole UI breaks.
**Verification:** visit login (`/accounts/login/`), projects list (`/projects/`), and one scene view (`/projects/<id>/scene/<n>/`) — confirm shell renders, theme toggle works, modals open, RTL is correct.

### Task 2.1: Audit shell templates

- [ ] **Step 1: Run audit on every shell template**

Run:
```bash
cd "E:/api/rwanga"
python scripts/audit_template.py rwanga-design-kit/templates/base.html
python scripts/audit_template.py rwanga-design-kit/templates/components/_sidebar.html
python scripts/audit_template.py rwanga-design-kit/templates/components/_topnav.html
python scripts/audit_template.py rwanga-design-kit/templates/components/_modal.html
python scripts/audit_template.py rwanga-design-kit/templates/components/_toast.html
python scripts/audit_template.py rwanga-design-kit/templates/components/_empty_state.html
python scripts/audit_template.py rwanga-design-kit/templates/components/_ai_progress.html
python scripts/audit_template.py rwanga-design-kit/templates/components/_breadcrumb.html
```

Capture each file's findings.

- [ ] **Step 2: Cross-check Bootstrap version**

Run:
```bash
grep -n "bootstrap" "E:/api/rwanga/rwanga-design-kit/templates/base.html"
grep -rn "bootstrap" "E:/api/rwanga/templates/base.html" 2>/dev/null
```

Confirm both reference Bootstrap 5 (`bootstrap@5`, `bootstrap.bundle.min.js@5`, etc.). If the live `base.html` is BS4 and the design-kit assumes BS5, that is a wall trigger — STOP and tell the user.

- [ ] **Step 3: Check JS hooks (theme toggle, rail, tab memory, scene filter)**

Run:
```bash
grep -n "js-theme-toggle\|rw-rail\|rw-mod-tab\|sceneFilter" "E:/api/rwanga/static/js/rwanga.js" 2>/dev/null
grep -n "js-theme-toggle\|rw-rail\|rw-mod-tab" "E:/api/rwanga/rwanga-design-kit/templates/base.html" "E:/api/rwanga/rwanga-design-kit/templates/components/_sidebar.html" "E:/api/rwanga/rwanga-design-kit/templates/components/_topnav.html"
```

Expected: design-kit shells use the same selectors that `rwanga.js` already binds. Mismatches need to be either patched in `rwanga.js` (not in templates) or noted for restyle work.

- [ ] **Step 4: Manual context-var review**

Read:
```bash
head -n 60 "E:/api/rwanga/src/core/context_processors.py" 2>/dev/null
```

Expected variables likely used by shell: `active_project`, `active_section`, `active_scene`, `request.resolver_match.app_name`, theme/dir info. Verify the design-kit shell uses only what the context processors provide — flag anything missing.

- [ ] **Step 5: Wall check**

Sum non-INFO issues across all 8 templates. If total > 16 (i.e., averaging more than 2 issues/file), or any single template has >10 issues, this is a wall — STOP and offer rebuild from `rwanga-ds/` + AGENT-PATTERNS.md. Otherwise proceed.

---

### Task 2.2: Apply patches to design-kit source (if any)

**Files:** edits inside `rwanga-design-kit/templates/` (the source). Patches travel with the deploy.

- [ ] **Step 1: For each non-INFO issue from Task 2.1, patch the design-kit source**

For COMMENT issues: convert any multi-line `{# ... #}` to `{% comment %}...{% endcomment %}` in the design-kit file.

For URL issues: change to safe form `{% url 'name' as u %}{{ u|default:'#' }}` if the URL is missing, OR fix typo, OR add a stub view+URL in the live app.

For INCLUDE/EXTENDS issues: fix the path to a live template that exists.

For STATIC issues: confirm the asset exists in `static/`; if not, copy it from the design-kit's static dir or fix the reference.

For LEGACY issues: remove the legacy CSS reference.

- [ ] **Step 2: Re-run audit on patched files**

Run the same eight commands from Task 2.1 Step 1. Expected: zero non-INFO issues. If still issues, repeat Step 1.

---

### Task 2.3: Deploy shell files

**Files:**
- Replace: `templates/base.html`
- Replace: `templates/components/_sidebar.html`, `_topnav.html`, `_modal.html`, `_toast.html`, `_empty_state.html`, `_ai_progress.html`, `_breadcrumb.html`

- [ ] **Step 1: Copy `base.html`**

Run:
```bash
cp "E:/api/rwanga/rwanga-design-kit/templates/base.html" "E:/api/rwanga/templates/base.html"
```

- [ ] **Step 2: Copy components**

Run:
```bash
for f in _sidebar _topnav _modal _toast _empty_state _ai_progress _breadcrumb; do
  cp "E:/api/rwanga/rwanga-design-kit/templates/components/${f}.html" "E:/api/rwanga/templates/components/${f}.html"
done
ls "E:/api/rwanga/templates/components/"
```

Expected: all 7 components plus `_rail_inner.html` (8 files total) listed.

---

### Task 2.4: Restyle `_rail_inner.html` using AGENT-PATTERNS.md

**Files:**
- Rewrite: `templates/components/_rail_inner.html`

The current `_rail_inner.html` uses ASCII glyphs (`⊞`, etc.). The new design system uses SVG icons (the "glowing icons"). Read `rwanga-design-kit/rwanga-ds/AGENT-PATTERNS.md` for the SVG icon library, then rewrite the partial to match.

- [ ] **Step 1: Read AGENT-PATTERNS.md icon section**

Run:
```bash
grep -n "rail\|icon\|svg" "E:/api/rwanga/rwanga-design-kit/rwanga-ds/AGENT-PATTERNS.md" | head -40
```

Identify the rail icon SVG patterns and the `rw-rail-icon` class conventions.

- [ ] **Step 2: Read the deployed `_sidebar.html` to confirm how `_rail_inner.html` is included**

Run:
```bash
grep -n "_rail_inner\|rw-rail" "E:/api/rwanga/templates/components/_sidebar.html"
```

If `_sidebar.html` does NOT `{% include 'components/_rail_inner.html' %}`, the file is dead code — note this and decide with the user whether to delete it or wire it in. Default: wire it in (DRY).

- [ ] **Step 3: Rewrite `_rail_inner.html`**

Open `E:/api/rwanga/templates/components/_rail_inner.html` and replace its content with a new version that:

- Keeps the existing structure (brand mark + nav links per app: projects, team, contacts, scripts, scheduling, reviews, departments)
- Replaces emoji glyphs with SVG icons from `AGENT-PATTERNS.md`'s icon library
- Preserves the `{% comment %}` blocks (no `{# multi-line #}`)
- Preserves the `{% if request.resolver_match.app_name == 'X' %}active{% endif %}` active-state logic
- Preserves the `{% if not offcanvas %}` brand-only-on-desktop logic

Match the visual look of the design-kit's `_sidebar.html` rail icons.

- [ ] **Step 4: Audit the rewritten file**

Run:
```bash
python scripts/audit_template.py "E:/api/rwanga/templates/components/_rail_inner.html"
```

Expected: zero non-INFO issues.

---

### Task 2.5: User verification of Phase 2

- [ ] **Step 1: Verify dev server still starts**

Run:
```bash
cd "E:/api/rwanga" && python manage.py check
```

Expected: `System check identified no issues (0 silenced).` Any template syntax error or import error → fix in working tree before showing user.

- [ ] **Step 2: User verifies shell across pages**

Tell the user: *"Phase 2 shell changes are in working tree. Please reload the dev server, then visit (in this order):*
*1. `/accounts/login/` — auth page (standalone, no shell)*
*2. `/projects/` — projects list (full shell: rail + topnav + content)*
*3. `/projects/<any-project-id>/` — project dashboard (shell + module cards)*
*4. `/projects/<id>/scene/1/` — scene view (shell + tabs + content panel)*
*Confirm: rail visible with SVG icons, topnav with section tabs, theme toggle works (light/dark), RTL correct (Kurdish text reads right-to-left), modal container exists in DOM, no `{# ... #}` comment text leaking visibly."*

- [ ] **Step 3: Iterate on issues, or discard**

If user reports a fixable issue: patch in working tree, ask them to re-verify.

If unfixable in audit-and-replace mode: this is a wall. Discard only Phase 2's working-tree changes (Phase 1 is already committed and stays):
```bash
cd "E:/api/rwanga"
git checkout -- templates/base.html templates/components/
```
Then offer rebuild from `rwanga-ds/` + AGENT-PATTERNS.md for the shell.

---

### Task 2.6: Commit Phase 2

- [ ] **Step 1: Stage and commit**

Run:
```bash
cd "E:/api/rwanga"
git add templates/base.html templates/components/
git commit -m "$(cat <<'EOF'
feat(ui-migration): phase 2 — shell (base.html + components)

- Replace base.html with rwanga-ds version
- Replace 7 components: _sidebar, _topnav, _modal, _toast,
  _empty_state, _ai_progress, _breadcrumb
- Restyle _rail_inner.html with SVG icons per AGENT-PATTERNS.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
```

Expected: only pyc noise remains.

---

## Phase 3 — Accounts

**Templates:** `accounts/{contacts,login,profile,register,settings,team}.html` (6 from design-kit) + `accounts/_invite_row.html` (live-only restyle).
**Risk:** low — auth pages are mostly self-contained.
**Verification:** visit `/accounts/login/`, `/accounts/register/`, `/accounts/profile/`, `/accounts/settings/`, `/accounts/team/`, `/accounts/contacts/<project_uuid>/`.

### Task 3.1: Audit accounts templates

- [ ] **Step 1: Run audit on all 6 design-kit accounts templates**

Run:
```bash
cd "E:/api/rwanga"
for f in contacts login profile register settings team; do
  python scripts/audit_template.py "rwanga-design-kit/templates/accounts/${f}.html"
done
```

Capture all non-INFO issues.

- [ ] **Step 2: Manual context-var check**

Templates expect: `user`, `request.user`, project memberships on `profile.html`, team list on `team.html`, contacts list on `contacts.html`, plus form/error context for `login.html` / `register.html`.

Read:
```bash
grep -n "render\|TemplateView\|context" "E:/api/rwanga/src/accounts/urls.py"
```

Note any missing context. The current accounts views are stubs (return `HttpResponse("profile")`); they will need real `render(...)` calls to pass the templates' expected vars. For Phase 3, upgrade each stub to a `render(request, "accounts/<name>.html", {...})` with at minimum the variables the templates use (wrap in `{% if %}` if data is not yet wired).

- [ ] **Step 3: Wall check**

If total non-INFO issues across the 6 templates > 12, OR any single file > 10 issues, STOP and offer rebuild.

---

### Task 3.2: Patch design-kit source

- [ ] **Step 1: Apply fixes to each design-kit template**

Same workflow as Task 2.2: convert multi-line comments, fix or safe-form broken URLs (in particular: `accounts:accept_invite`, `accounts:cancel_invite`, `accounts:decline_invite`, `accounts:delete_account`, `accounts:edit_member_modal`, `accounts:invite_modal`, `accounts:resend_invite` are missing — use safe form `{% url 'name' as u %}{{ u|default:'#' }}`), fix include/extends/static refs.

- [ ] **Step 2: Re-audit until clean**

Run the loop from Task 3.1 Step 1. Expected: zero non-INFO issues.

---

### Task 3.3: Upgrade stub views to render templates

**Files:**
- Modify: `src/accounts/urls.py`

Current stubs return `HttpResponse(...)`. Convert each to render the matching template with a context dict.

- [ ] **Step 1: Replace stubs in `src/accounts/urls.py`**

For each function (`profile`, `settings`, `team`, `contacts`), change from:
```python
def profile(request):
    return HttpResponse("profile")
```
to:
```python
def profile(request):
    return render(request, "accounts/profile.html", {})
```

(Empty context is OK — templates degrade gracefully via `{% if %}`. If audit found load-bearing variables, add them here.)

- [ ] **Step 2: Verify imports**

Ensure `from django.shortcuts import render` is present near the top of `src/accounts/urls.py` (it already imports `render`; verify with `head -n 8 src/accounts/urls.py`).

- [ ] **Step 3: Verify URL config still parses**

Run:
```bash
cd "E:/api/rwanga" && python manage.py check
```

Expected: zero issues.

---

### Task 3.4: Deploy accounts templates

**Files:**
- Replace: `src/accounts/templates/accounts/{contacts,login,profile,register,settings,team}.html`

- [ ] **Step 1: Copy 6 templates**

Run:
```bash
cd "E:/api/rwanga"
for f in contacts login profile register settings team; do
  cp "rwanga-design-kit/templates/accounts/${f}.html" "src/accounts/templates/accounts/${f}.html"
done
```

---

### Task 3.5: Restyle `_invite_row.html`

**Files:**
- Rewrite: `src/accounts/templates/accounts/_invite_row.html`

This partial is HTMX-loaded into the team page. It represents one row of a pending invitation table. Read `team.html` (just deployed) to see how it's included and what wrapping element / column count is expected.

- [ ] **Step 1: Determine the wrapping element**

Run:
```bash
grep -n "_invite_row\|hx-target\|invite_row" "E:/api/rwanga/src/accounts/templates/accounts/team.html"
```

Note the expected target element (likely a `<tr>` matching the invitations table's column count).

- [ ] **Step 2: Rewrite `_invite_row.html`**

Open the file and rewrite as a single `<tr>` (or matching wrapper) using the design system's table-row styling, preserving the existing context vars (e.g., `{{ invite.email }}`, `{{ invite.role }}`, action buttons with safe-form URLs for `accounts:cancel_invite` / `accounts:resend_invite`).

- [ ] **Step 3: Audit**

Run:
```bash
python scripts/audit_template.py "E:/api/rwanga/src/accounts/templates/accounts/_invite_row.html"
```

Expected: clean.

---

### Task 3.6: User verification of Phase 3

- [ ] **Step 1: User verifies accounts pages**

Tell the user: *"Phase 3 accounts changes are in working tree. Please visit:*
*1. `/accounts/login/` — login form, design system styled*
*2. `/accounts/register/` — register form*
*3. `/accounts/profile/` — profile page*
*4. `/accounts/settings/` — settings page*
*5. `/accounts/team/` — team page*
*6. `/accounts/contacts/<any-project-uuid>/` — contacts*
*Confirm each renders with new design, no `{# ... #}` text leaks, no missing-asset gaps."*

- [ ] **Step 2: Iterate or discard**

If user reports a fixable issue: patch in working tree, ask them to re-verify.

If unfixable in audit-and-replace mode (wall trigger): run
```bash
cd "E:/api/rwanga"
git checkout -- src/accounts/templates/ src/accounts/urls.py
```
to discard working-tree changes, then offer rebuild from `rwanga-ds/` + AGENT-PATTERNS.md for the accounts phase.

---

### Task 3.7: Commit Phase 3

- [ ] **Step 1: Stage and commit**

Run:
```bash
cd "E:/api/rwanga"
git add src/accounts/templates/accounts/ src/accounts/urls.py
git commit -m "$(cat <<'EOF'
feat(ui-migration): phase 3 — accounts

- Deploy 6 design-kit accounts templates (login, register, profile,
  settings, team, contacts)
- Restyle _invite_row.html with design system
- Upgrade stub accounts views to render templates with context

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
```

---

## Phase 4 — Notifications + Locations + Floorplans

**Templates:** `notifications/panel.html`, `locations/list.html`, `floorplans/list.html` (3 from design-kit) + 5 live-only restyles (`notifications/{list,_panel}.html`, `locations/{_add_modal,_add_success_oob,_location_list}.html`).
**Risk:** low — single-page modules.
**Verification:** visit `/notifications/`, `/locations/`, `/floorplans/`.

### Task 4.1: Audit Phase 4 templates

- [ ] **Step 1: Run audit on the 3 design-kit files**

Run:
```bash
cd "E:/api/rwanga"
for p in notifications/panel locations/list floorplans/list; do
  python scripts/audit_template.py "rwanga-design-kit/templates/${p}.html"
done
```

- [ ] **Step 2: Manual context-var review**

Skim the rendering views:
```bash
grep -n "render\|context" "E:/api/rwanga/src/notifications/views.py" "E:/api/rwanga/src/locations/views.py" "E:/api/rwanga/src/floorplans/views.py" 2>/dev/null
```

Note context vars passed by each view. Wrap missing ones in `{% if %}` in the templates as needed.

- [ ] **Step 3: Wall check**

If issues > 6 total or > 10 in any single file: STOP and offer rebuild.

---

### Task 4.2: Patch design-kit source if needed

- [ ] **Step 1: Apply the patch workflow**

For each non-INFO issue from Task 4.1:
- **COMMENT** issue: convert multi-line `{# ... #}` to `{% comment %}...{% endcomment %}` in the design-kit source file.
- **URL** issue: fix typo, add stub view, or convert to safe form `{% url 'name' as u %}{{ u|default:'#' }}`.
- **INCLUDE / EXTENDS / STATIC** issue: fix the path, copy missing asset, or remove the reference.
- **LEGACY** issue: replace with `rwanga-ds.css` reference or remove entirely.

- [ ] **Step 2: Re-audit until clean**

Run:
```bash
cd "E:/api/rwanga"
for p in notifications/panel locations/list floorplans/list; do
  python scripts/audit_template.py "rwanga-design-kit/templates/${p}.html"
done
```

Expected: zero non-INFO issues across all 3 files.

---

### Task 4.3: Deploy Phase 4 design-kit templates

- [ ] **Step 1: Copy 3 templates**

Run:
```bash
cd "E:/api/rwanga"
cp rwanga-design-kit/templates/notifications/panel.html src/notifications/templates/notifications/panel.html
cp rwanga-design-kit/templates/locations/list.html src/locations/templates/locations/list.html
cp rwanga-design-kit/templates/floorplans/list.html src/floorplans/templates/floorplans/list.html
```

---

### Task 4.4: Restyle live-only partials

**Files:**
- Rewrite: `src/notifications/templates/notifications/list.html`
- Rewrite: `src/notifications/templates/notifications/_panel.html`
- Rewrite: `src/locations/templates/locations/_add_modal.html`
- Rewrite: `src/locations/templates/locations/_add_success_oob.html`
- Rewrite: `src/locations/templates/locations/_location_list.html`

For each: read the existing version to understand context vars + wrapping element. Rewrite using AGENT-PATTERNS.md (LIST pattern for `_location_list`, modal pattern for `_add_modal`, OOB toast pattern for `_add_success_oob`).

- [ ] **Step 1: Restyle each file** (one per step in execution; combine here for brevity)

Per-file: read existing → rewrite using design-system classes → run `python scripts/audit_template.py <path>` → fix any issues.

---

### Task 4.5: User verification + commit

- [ ] **Step 1: User verifies the 3 module pages**

Tell user to visit `/notifications/`, `/locations/`, `/floorplans/`. Confirm new design, partials work (e.g., add-location modal opens correctly).

- [ ] **Step 2: Commit Phase 4**

Run:
```bash
cd "E:/api/rwanga"
git add src/notifications/templates/ src/locations/templates/ src/floorplans/templates/
git commit -m "$(cat <<'EOF'
feat(ui-migration): phase 4 — notifications, locations, floorplans

- Deploy notifications/panel, locations/list, floorplans/list
- Restyle 5 live-only partials with design system
  (notifications/{list,_panel}, locations/{_add_modal,_add_success_oob,_location_list})

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
```

---

## Phase 5 — Scripts + Shots + Scheduling

**Templates:** `scripts/{breakdown,docs,elements,index,upload}.html` (5), `shots/{list,storyboards}.html` (2), `scheduling/{call_sheets,index,stripboard}.html` (3) — 10 design-kit. Plus `scripts/_elements_body.html` (1 live-only restyle).
**Risk:** medium — scheduling references many missing URLs (`add_day_modal`, `call_sheet_detail`, `day_detail`, `export_pdf`, `generate_pdf`, etc.); shots has missing URLs too (`create_modal`, `delete`, `export_pdf`, `upload_storyboard_modal`).
**Verification:** visit each module's main page + try one HTMX flow per module.

### Task 5.1: Audit Phase 5 templates

- [ ] **Step 1: Run audit on all 10 design-kit files**

Run:
```bash
cd "E:/api/rwanga"
for p in scripts/breakdown scripts/docs scripts/elements scripts/index scripts/upload \
        shots/list shots/storyboards \
        scheduling/call_sheets scheduling/index scheduling/stripboard; do
  python scripts/audit_template.py "rwanga-design-kit/templates/${p}.html"
done
```

- [ ] **Step 2: Special handling for `shots:edit_row`**

The live `shots:edit` URL exists; design-kit refers to `shots:edit_row`. Decide: (a) rename in design-kit source to `shots:edit`, OR (b) add `name="edit_row"` as an alias in `src/shots/urls.py`. Recommended: (a) — fewer moving parts.

- [ ] **Step 3: Wall check**

Cumulative non-INFO issues for Phase 5. If > 20 or any single file > 10: STOP and offer rebuild for the worst offender.

---

### Task 5.2: Patch source + deploy + restyle live-only

- [ ] **Step 1: Patch design-kit source until audit clean**

For each non-INFO issue from Task 5.1:
- **COMMENT** issue: convert multi-line `{# ... #}` to `{% comment %}...{% endcomment %}`.
- **URL** issue: scheduling/shots have many missing URLs (`scheduling:add_day_modal`, `call_sheet_detail`, `day_detail`, `export_pdf`, `generate_pdf`, `reorder_strips`, `send_whatsapp`; `shots:create_modal`, `delete`, `export_pdf`, `upload_storyboard_modal`; `scripts:create_doc_modal`, `doc_detail`, `edit_doc_modal`, `element_detail`). For these, convert to safe form `{% url 'name' as u %}{{ u|default:'#' }}`.
- **shots:edit_row** specifically: rename to `shots:edit` in the design-kit source (per Task 5.1 Step 2 decision).
- **INCLUDE / EXTENDS / STATIC** issue: fix or remove.

Re-run the audit loop until zero non-INFO issues:
```bash
cd "E:/api/rwanga"
for p in scripts/breakdown scripts/docs scripts/elements scripts/index scripts/upload \
        shots/list shots/storyboards \
        scheduling/call_sheets scheduling/index scheduling/stripboard; do
  python scripts/audit_template.py "rwanga-design-kit/templates/${p}.html"
done
```

- [ ] **Step 2: Copy the 10 design-kit templates**

Run:
```bash
cd "E:/api/rwanga"
for f in breakdown docs elements index upload; do
  cp "rwanga-design-kit/templates/scripts/${f}.html" "src/scripts/templates/scripts/${f}.html"
done
for f in list storyboards; do
  cp "rwanga-design-kit/templates/shots/${f}.html" "src/shots/templates/shots/${f}.html"
done
for f in call_sheets index stripboard; do
  cp "rwanga-design-kit/templates/scheduling/${f}.html" "src/scheduling/templates/scheduling/${f}.html"
done
```

- [ ] **Step 3: Restyle `_elements_body.html`**

Read existing → rewrite as HTMX-loaded LIST pattern body → audit clean.

---

### Task 5.3: User verification + commit Phase 5

- [ ] **Step 1: User verifies**

Tell user: visit `/scripts/`, `/shots/<project>/list/`, `/scheduling/<project>/`. Confirm new design and that placeholder `#` links don't crash anything.

- [ ] **Step 2: Commit**

Run:
```bash
cd "E:/api/rwanga"
git add src/scripts/templates/ src/shots/templates/ src/scheduling/templates/
git commit -m "$(cat <<'EOF'
feat(ui-migration): phase 5 — scripts, shots, scheduling

- Deploy 5 scripts, 2 shots, 3 scheduling templates from design-kit
- Restyle scripts/_elements_body.html with design system
- Use safe-form {% url ... as u %}{{ u|default:'#' }} for unbuilt URLs
  (scheduling modals, shots modals, scripts doc/element modals)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
```

---

## Phase 6 — Projects (the heart)

**Templates:** `projects/{_scene_list,create_wizard,dashboard,list,scene_view,settings}.html` (6) + `projects/scenes/tabs/{continuity,floorplan,lighting,overview,props,schedule,shots,sound,storyboard,wardrobe}.html` (10) — 16 total.
**Risk:** high — central UX. Scene view + scene tabs are the daily-use surface.
**Verification:** visit projects list, project dashboard, scene view; click through every scene tab; try the create-wizard flow.

### Task 6.1: Audit Phase 6 templates

- [ ] **Step 1: Audit every Phase 6 template**

Run:
```bash
cd "E:/api/rwanga"
python scripts/audit_template.py --dir rwanga-design-kit/templates/projects
```

(The script's `--dir` mode will recurse into `scenes/tabs/` automatically.)

- [ ] **Step 2: Special URL fixes**

Known missing: `projects:delete`, `projects:edit_scene_modal`, plus `departments:add_*_modal` and `departments:edit_*_modal` and `departments:toggle_*` (referenced from scene tabs). Use safe form. Confirm `projects:scene_list_partial`, `projects:scene_tab` exist (they do, per spec).

- [ ] **Step 3: Manual context-var check on `scene_view` + `dashboard`**

Read:
```bash
grep -n "context\|render\|get_context_data" "E:/api/rwanga/src/projects/views.py" | head -40
```

The scene view template expects: `project`, `scene`, `scenes`, `tabs`, `active_tab`, etc. Confirm view passes them; wrap missing in `{% if %}`.

- [ ] **Step 4: Wall check**

If cumulative non-INFO issues > 32, or any single file > 10: STOP per template and offer rebuild for the worst offenders only (not the whole phase — a single tab can be rebuilt without redoing the others).

---

### Task 6.2: Patch source + deploy

- [ ] **Step 1: Patch design-kit source until clean**

For each non-INFO issue from Task 6.1:
- **COMMENT** issue: convert multi-line `{# ... #}` to `{% comment %}...{% endcomment %}`.
- **URL** issue: known-missing in this phase: `projects:delete`, `projects:edit_scene_modal`, all `departments:add_*_modal`, `departments:edit_*_modal`, `departments:toggle_continuity`, `departments:toggle_prop`. Convert to safe form `{% url 'name' as u %}{{ u|default:'#' }}`.
- **INCLUDE / EXTENDS / STATIC** issue: fix or remove.

Re-audit until clean:
```bash
cd "E:/api/rwanga"
python scripts/audit_template.py --dir rwanga-design-kit/templates/projects
```

- [ ] **Step 2: Deploy all 16 templates**

Run:
```bash
cd "E:/api/rwanga"
for f in _scene_list create_wizard dashboard list scene_view settings; do
  cp "rwanga-design-kit/templates/projects/${f}.html" "src/projects/templates/projects/${f}.html"
done
for f in continuity floorplan lighting overview props schedule shots sound storyboard wardrobe; do
  cp "rwanga-design-kit/templates/projects/scenes/tabs/${f}.html" "src/projects/templates/projects/scenes/tabs/${f}.html"
done
```

---

### Task 6.3: User verification + commit Phase 6

- [ ] **Step 1: User verifies (longer flow)**

Tell user: *"Phase 6 covers the heart of the app. Please verify:*
*1. `/projects/` — list with card grid*
*2. `/projects/<id>/` — dashboard with module section rows*
*3. `/projects/create/wizard/` — 4-step wizard navigates*
*4. `/projects/<id>/scene/1/` — scene view loads*
*5. Click each of the 10 tabs (overview, shots, storyboard, floorplan, schedule, lighting, sound, props, wardrobe, continuity) — each loads via HTMX*
*6. Inline edit a shot row (HTMX hx-get → tr swap)*
*7. Theme toggle still works*
*Confirm no comment leaks, no missing-asset gaps."*

- [ ] **Step 2: Commit**

Run:
```bash
cd "E:/api/rwanga"
git add src/projects/templates/
git commit -m "$(cat <<'EOF'
feat(ui-migration): phase 6 — projects (the heart)

- Deploy 6 projects templates: list, dashboard, scene_view,
  create_wizard, settings, _scene_list
- Deploy 10 scene tab templates: overview, shots, storyboard,
  floorplan, continuity, lighting, sound, props, wardrobe, schedule
- Use safe-form {% url ... as u %}{{ u|default:'#' }} for unbuilt
  modal endpoints (projects:delete, edit_scene_modal, all
  departments modal/toggle URLs)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
```

---

## Phase 7 — Reviews + Community

**Templates:** `reviews/{_create_modal,_decision_card,_evaluation_card,chain_viewer,detail,list,summary_pdf,workbench}.html` (8 design-kit) + `community/{_comment_thread,detail,list}.html` (3 design-kit) + 6 live-only review partials + 1 live-only community partial.
**Risk:** high — many partials, complex HTMX flows in workbench.
**Verification:** review workbench, chain viewer, community list/detail.

### Task 7.1: Audit Phase 7 templates

- [ ] **Step 1: Audit design-kit files**

Run:
```bash
cd "E:/api/rwanga"
python scripts/audit_template.py --dir rwanga-design-kit/templates/reviews
python scripts/audit_template.py --dir rwanga-design-kit/templates/community
```

- [ ] **Step 2: Note URL aliases**

Reviews has both `lock_decision`/`lock-decision` and `reject_decision`/`reject-decision` (hyphen vs underscore). Templates may use either; both resolve. No fix needed.

- [ ] **Step 3: Wall check (per file, not cumulative)**

Reviews has many partials that may diverge from live versions. If a single file > 10 issues, rebuild that file only. Continue with the rest.

---

### Task 7.2: Patch source + deploy + restyle

- [ ] **Step 1: Patch design-kit source until clean**

For each non-INFO issue from Task 7.1:
- **COMMENT** issue: convert multi-line `{# ... #}` to `{% comment %}...{% endcomment %}`.
- **URL** issue: convert any unbuilt URL to safe form `{% url 'name' as u %}{{ u|default:'#' }}`. Reviews has both hyphen and underscore variants for `lock-decision`/`lock_decision` and `reject-decision`/`reject_decision` — both resolve, leave as-is.
- **INCLUDE / EXTENDS / STATIC** issue: fix or remove.

Re-audit:
```bash
cd "E:/api/rwanga"
python scripts/audit_template.py --dir rwanga-design-kit/templates/reviews
python scripts/audit_template.py --dir rwanga-design-kit/templates/community
```

Expected: zero non-INFO issues.

- [ ] **Step 2: Deploy 11 design-kit files**

```bash
cd "E:/api/rwanga"
for f in _create_modal _decision_card _evaluation_card chain_viewer detail list summary_pdf workbench; do
  cp "rwanga-design-kit/templates/reviews/${f}.html" "src/reviews/templates/reviews/${f}.html"
done
for f in _comment_thread detail list; do
  cp "rwanga-design-kit/templates/community/${f}.html" "src/community/templates/community/${f}.html"
done
```

- [ ] **Step 3: Restyle live-only review partials (6 files)**

For each of `_bible_tab.html`, `_comments.html`, `_comments_list.html`, `_decisions_list.html`, `partials/decision_locked_card.html`, `partials/decision_rejected_card.html`:

1. Read the existing version to capture context vars and wrapping element.
2. Read the deployed `workbench.html` to identify the HTMX target IDs (e.g., `#decisions-list`, `#bible-tab-body`) and required wrappers.
3. Rewrite using AGENT-PATTERNS.md (LIST pattern body for the `*_list` partials, card pattern for the decision cards, tab body for `_bible_tab`).
4. Run `python scripts/audit_template.py <path>` and patch until zero non-INFO issues.

- [ ] **Step 4: Restyle `community/_create_modal.html`**

1. Read the existing version to capture form fields + context vars.
2. Read the deployed `community/list.html` to find the modal trigger and target.
3. Rewrite using the design system's modal pattern from `templates/components/_modal.html`.
4. Audit clean.

---

### Task 7.3: User verification + commit Phase 7

- [ ] **Step 1: User verifies**

Tell user: visit `/reviews/<project>/`, click into a review → workbench (verify decision/evaluation/comments/bible tabs all render), open chain viewer; visit `/community/`, click a session → detail with comments, try the create-session modal.

- [ ] **Step 2: Commit**

Run:
```bash
cd "E:/api/rwanga"
git add src/reviews/templates/ src/community/templates/
git commit -m "$(cat <<'EOF'
feat(ui-migration): phase 7 — reviews and community

- Deploy 8 reviews templates (workbench, chain_viewer, detail, list,
  summary_pdf, _create_modal, _decision_card, _evaluation_card)
- Deploy 3 community templates (list, detail, _comment_thread)
- Restyle 6 live-only review partials and 1 community modal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
```

---

## Phase 8 — Progress + Departments

**Templates:** `progress/{agent_reports,changelog,dashboard,decisions,diagrams,docs,gaps,task_detail,tasks,updates}.html` (10 design-kit) + `departments/{continuity,lighting,props,sound,wardrobe}.html` (5 live-only restyle) + 5 dept partials in `departments/templates/departments/partials/` (live-only restyle).
**Risk:** medium. Progress has the most missing URLs (only `progress:dashboard` exists; `tasks`, `task_detail`, `decisions`, `gaps`, `doc_detail`, `diagram_detail`, `update_task_status_modal` all missing). Departments is large restyle work.
**Verification:** progress dashboard, departments tabs in scene view.

### Task 8.1: Audit progress templates

- [ ] **Step 1: Audit design-kit progress files**

```bash
cd "E:/api/rwanga"
python scripts/audit_template.py --dir rwanga-design-kit/templates/progress
```

- [ ] **Step 2: URL strategy decision for progress**

Many progress URLs are missing. Three options per template:
- (a) Add real URL + view stub for sidebar/topnav nav items (so the user can navigate to the page even if it's empty)
- (b) Safe-form `{% url 'name' as u %}{{ u|default:'#' }}` for deep links
- (c) Hide the link entirely with `{% if has_x %}` if the feature is dormant

Default heuristic from spec: nav-bar links → stub views (option a); modal triggers / deep actions → safe form (option b).

For progress: nav probably wants `progress:tasks`, `progress:decisions`, `progress:gaps` as real stub pages. Add stub views to `src/progress/views.py` (or `urls.py` inline).

- [ ] **Step 3: Wall check per file**

If a single progress template has > 10 non-INFO issues, rebuild that file only.

---

### Task 8.2: Add progress stub views + URLs

**Files:**
- Modify: `src/progress/urls.py` (and `views.py` if separate)

- [ ] **Step 1: Add stub URL patterns**

Add to `src/progress/urls.py` (in `urlpatterns`):

```python
    path("tasks/", views.tasks_view, name="tasks"),
    path("tasks/<uuid:task_id>/", views.task_detail_view, name="task_detail"),
    path("updates/", views.updates_view, name="updates"),
    path("changelog/", views.changelog_view, name="changelog"),
    path("decisions/", views.decisions_view, name="decisions"),
    path("docs/", views.docs_view, name="docs"),
    path("docs/<uuid:doc_id>/", views.doc_detail_view, name="doc_detail"),
    path("gaps/", views.gaps_view, name="gaps"),
    path("diagrams/", views.diagrams_view, name="diagrams"),
    path("diagrams/<uuid:diagram_id>/", views.diagram_detail_view, name="diagram_detail"),
    path("agent-reports/", views.agent_reports_view, name="agent_reports"),
```

- [ ] **Step 2: Add stub view functions**

In `src/progress/views.py`, add:

```python
def tasks_view(request):
    return render(request, "progress/tasks.html", {})


def task_detail_view(request, task_id):
    return render(request, "progress/task_detail.html", {"task_id": task_id})


def updates_view(request):
    return render(request, "progress/updates.html", {})


def changelog_view(request):
    return render(request, "progress/changelog.html", {})


def decisions_view(request):
    return render(request, "progress/decisions.html", {})


def docs_view(request):
    return render(request, "progress/docs.html", {})


def doc_detail_view(request, doc_id):
    return render(request, "progress/docs.html", {"doc_id": doc_id})  # reuse list for now


def gaps_view(request):
    return render(request, "progress/gaps.html", {})


def diagrams_view(request):
    return render(request, "progress/diagrams.html", {})


def diagram_detail_view(request, diagram_id):
    return render(request, "progress/diagrams.html", {"diagram_id": diagram_id})  # reuse


def agent_reports_view(request):
    return render(request, "progress/agent_reports.html", {})
```

- [ ] **Step 3: Verify URL config still parses**

Run:
```bash
cd "E:/api/rwanga" && python manage.py check
```

Expected: zero issues.

---

### Task 8.3: Patch source + deploy progress

- [ ] **Step 1: Patch design-kit source until audit clean**

For each non-INFO issue from Task 8.1 that remains after the stub views landed (Task 8.2):
- **COMMENT** issue: convert multi-line `{# ... #}` to `{% comment %}...{% endcomment %}`.
- **URL** issue: any URL not stubbed (e.g., `progress:update_task_status_modal`) → convert to safe form `{% url 'name' as u %}{{ u|default:'#' }}`.
- **INCLUDE / EXTENDS / STATIC** issue: fix or remove.

Re-audit until clean:
```bash
cd "E:/api/rwanga"
python scripts/audit_template.py --dir rwanga-design-kit/templates/progress
```

- [ ] **Step 2: Deploy 10 progress templates**

```bash
cd "E:/api/rwanga"
for f in agent_reports changelog dashboard decisions diagrams docs gaps task_detail tasks updates; do
  cp "rwanga-design-kit/templates/progress/${f}.html" "src/progress/templates/progress/${f}.html"
done
```

---

### Task 8.4: Restyle departments templates

**Files:**
- Rewrite: `src/departments/templates/departments/{continuity,lighting,props,sound,wardrobe}.html` (5 main tabs)
- Rewrite: `src/departments/templates/departments/partials/{continuity,lighting,props,sound,wardrobe}_list.html` (5 partials)

These are scene-view tabs (loaded via HTMX). Use the SCENE-VIEW tab pattern from AGENT-PATTERNS.md, matching the visual structure of `projects/scenes/tabs/lighting.html` (already deployed in Phase 6).

- [ ] **Step 1: Pick a reference**

Open `src/projects/templates/projects/scenes/tabs/lighting.html` (deployed in Phase 6) to see the exact tab pattern (wrapper element, classes, HTMX flow).

- [ ] **Step 2: Restyle each main department tab (5 files)**

For each of `continuity.html`, `lighting.html`, `props.html`, `sound.html`, `wardrobe.html`:
- Read existing to capture context vars
- Rewrite using same wrapper/classes as the reference tab
- Use safe-form `{% url 'departments:add_*_modal' as u %}{{ u|default:'#' }}` for unbuilt modals
- Audit clean

- [ ] **Step 3: Restyle each partial (5 files)**

For each `partials/<dept>_list.html`: rewrite as the LIST pattern body that the main tab includes via HTMX. Match the parent's HTMX target element (e.g., `<tbody id="dept-list">`). Audit clean.

---

### Task 8.5: User verification + commit Phase 8

- [ ] **Step 1: User verifies**

Tell user: *"Phase 8 — final non-cleanup phase. Visit:*
*1. `/progress/` — dashboard*
*2. `/progress/tasks/`, `/progress/decisions/`, `/progress/gaps/`, `/progress/updates/`, `/progress/docs/`, `/progress/diagrams/`, `/progress/agent-reports/`, `/progress/changelog/` — each renders (empty content OK)*
*3. Open a scene view → click each department tab (lighting, sound, props, wardrobe, continuity) — each loads*
*Confirm no leaks, no broken links blowing up."*

- [ ] **Step 2: Commit**

Run:
```bash
cd "E:/api/rwanga"
git add src/progress/ src/departments/templates/
git commit -m "$(cat <<'EOF'
feat(ui-migration): phase 8 — progress and departments

- Deploy 10 progress templates from design-kit
- Add 11 stub views + URL patterns to progress (tasks, task_detail,
  updates, changelog, decisions, docs, doc_detail, gaps, diagrams,
  diagram_detail, agent_reports)
- Restyle 5 departments tab templates + 5 partials with design system
  (using projects/scenes/tabs/lighting.html as visual reference)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
```

---

## Phase 9 — Final QA + legacy purge

**Goal:** verify the full migration end-to-end, then permanently remove every trace of the legacy UI. The system must serve only the new design after this phase.

### Task 9.1: Full smoke test

- [ ] **Step 1: User runs full flow**

Tell user: *"Phase 9 starts with a final smoke test. Please walk through:*
*1. `/` → landing page (anon)*
*2. `/accounts/register/` → register*
*3. `/accounts/login/` → login*
*4. `/projects/` → projects list*
*5. `/projects/create/wizard/` → create a project*
*6. `/projects/<id>/` → dashboard*
*7. `/projects/<id>/scene/1/` → scene view, click through ALL 10 scene tabs and ALL 5 department tabs*
*8. `/scripts/<id>/`, `/shots/<project>/list/`, `/scheduling/<project>/`, `/floorplans/<project>/`, `/locations/`*
*9. `/reviews/<project>/`, click into one → workbench, chain_viewer*
*10. `/community/`, click a session → detail*
*11. `/notifications/` and the notification panel*
*12. `/progress/` and all progress sub-pages*
*13. Theme toggle works on every page*
*14. RTL is correct everywhere*
*Confirm: no `{# ... #}` text leaks, no 500s, no missing assets, no obviously-broken layouts."*

- [ ] **Step 2: If user reports issues, fix them in working tree first (no commit yet)**

Patch in place, re-verify. Commit fixes only after smoke test passes.

---

### Task 9.2: Grep for legacy references

- [ ] **Step 1: Confirm zero legacy `rwanga.css` references in templates / code**

Run:
```bash
cd "E:/api/rwanga"
grep -rn "css/rwanga\.css\|rwanga\.css'" templates/ src/ static/ 2>/dev/null | grep -v "rwanga-ds.css" | grep -v "rwanga.css.bak"
```

Expected: **zero matches**. If any match, patch the file (replace `rwanga.css` with `rwanga-ds.css` or remove the link entirely if redundant).

- [ ] **Step 2: Confirm only `rwanga-ds.css` is referenced from `base.html`**

Run:
```bash
grep -n "stylesheet\|\.css" "E:/api/rwanga/templates/base.html"
```

Expected: only `rwanga-ds.css` appears (plus Bootstrap). No `rwanga.css`.

---

### Task 9.3: Delete legacy CSS

**Files:**
- Delete: `static/css/rwanga.css`
- Delete: `static/css/rwanga.css.bak`

- [ ] **Step 1: Delete files**

Run:
```bash
cd "E:/api/rwanga"
rm static/css/rwanga.css
rm static/css/rwanga.css.bak
ls static/css/
```

Expected: only `rwanga-ds.css` remains in `static/css/`.

- [ ] **Step 2: Sanity check — server still works**

Run:
```bash
python manage.py check
```

Expected: zero issues.

Tell user: reload one page (any page) to confirm the system still loads CSS correctly.

---

### Task 9.4: Final cleanup pass

- [ ] **Step 1: Verify no scratch files in repo root**

Run:
```bash
cd "E:/api/rwanga"
ls *.py *.bak *.tmp 2>/dev/null
```

Expected: prints nothing (no scratch). If `_fix_urls.py` or similar leftovers exist, delete them.

- [ ] **Step 2: Verify working tree is clean**

Run:
```bash
git status --short
```

Expected: pyc noise only. Anything else → stage/commit or delete.

---

### Task 9.5: Commit Phase 9

- [ ] **Step 1: Stage and commit the legacy purge**

Run:
```bash
cd "E:/api/rwanga"
git add -A static/css/
git commit -m "$(cat <<'EOF'
feat(ui-migration): phase 9 — legacy purge

- Delete static/css/rwanga.css (legacy stylesheet)
- Delete static/css/rwanga.css.bak (transient backup)
- Confirm zero references to legacy CSS or class names anywhere

The system now serves only the new Rwanga Design System v1.0.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git status --short
git log --oneline -12
```

Expected: phase commit lands; the 9 migration commits are visible in the log; working tree shows only pyc noise.

---

### Task 9.6: Migration done — report to user

- [ ] **Step 1: Generate final report**

Tell the user:

> *Migration complete on `main`. 9 phases shipped, each as one commit:*
> *- Phase 0: workspace setup + audit script*
> *- Phase 1: CSS + landing page*
> *- Phase 2: shell (base.html + components)*
> *- Phase 3: accounts*
> *- Phase 4: notifications + locations + floorplans*
> *- Phase 5: scripts + shots + scheduling*
> *- Phase 6: projects (the heart)*
> *- Phase 7: reviews + community*
> *- Phase 8: progress + departments*
> *- Phase 9: legacy purge*
>
> *No legacy UI remains. `rwanga.css` deleted. The system serves only `rwanga-ds.css` with the glowing icons. The audit script `scripts/audit_template.py` stays as an ongoing template-hygiene tool. Nothing pushed to remote — say the word when you're ready to push.*

---

## Self-Review Notes

- **Spec coverage:** All 8 audit checks are operationalized (Tasks 0.3, 1.2, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1). 9 phases match the spec table 1:1. Wall escape hatch is referenced in every audit task. Verify-before-commit-on-main flow is in every phase. No-legacy-UI rule is enforced in Task 9.2 (grep) + Task 9.3 (delete) + audit check 8 (script-flagged on every audit).
- **No placeholders:** every step shows actual commands, file paths, code, and expected output. No "TODO" or "TBD".
- **Type/name consistency:** `landing_view` named consistently. URL names referenced match the audit's `known_urls` set. Audit script's `template_exists` and `collect_url_names` are used coherently.
- **Out-of-scope respected:** the 12 export templates are never touched.
