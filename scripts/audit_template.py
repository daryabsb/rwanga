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
    names.update({"account_login", "account_logout", "account_signup",
                  "account_change_password", "account_email", "account_reset_password"})
    return names


def template_exists(rel_path: str) -> bool:
    if (TEMPLATES_ROOT / rel_path).exists():
        return True
    for app_templates in SRC.glob("*/templates"):
        if (app_templates / rel_path).exists():
            return True
    return False


def audit(path: Path, known_urls: set[str]) -> list[str]:
    text = path.read_text(encoding="utf-8")
    issues: list[str] = []

    for i, line in enumerate(text.splitlines(), 1):
        opens, closes = len(DJ_OPEN.findall(line)), len(DJ_CLOSE.findall(line))
        if opens != closes:
            issues.append(f"  L{i}: COMMENT unclosed/multiline {{# … #}} — convert to {{% comment %}}")
    if re.search(r"\{#\s*[═─━]", text):
        issues.append("  WARN: decorative {# ═/─/━ #} block — convert to {% comment %}")

    for url_name in URL_TAG.findall(text):
        if url_name not in known_urls:
            issues.append(f"  URL: '{url_name}' not in urlconf")

    for inc in INCLUDE_TAG.findall(text):
        if not template_exists(inc):
            issues.append(f"  INCLUDE: '{inc}' missing")
    for ext in EXTENDS_TAG.findall(text):
        if not template_exists(ext):
            issues.append(f"  EXTENDS: '{ext}' missing")

    for s in STATIC_TAG.findall(text):
        if not (STATIC_ROOT / s).exists():
            issues.append(f"  STATIC: '{s}' missing")

    htmx = HTMX_URL.findall(text)
    if htmx:
        issues.append(f"  INFO: {len(htmx)} hx-* URLs (manually verify each returns a partial)")

    blocks = sorted(set(BLOCK_TAG.findall(text)))
    if blocks:
        issues.append(f"  INFO: blocks: {', '.join(blocks)} (cross-check vs base.html)")

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
    # Ensure Unicode output works on Windows consoles (cp1252 → utf-8)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
