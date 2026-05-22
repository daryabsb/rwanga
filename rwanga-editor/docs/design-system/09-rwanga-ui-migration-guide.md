# Rwanga — UI Migration Guide

Status: **FORENSIC EXTRACTION** — 2026-05-17
Source: Design kit → Production delta analysis

This document maps what changed between the design kit (`rwanga_script_editor_design_kit/`) and the production codebase (`rwanga-editor/renderer/`), what's next, and what risks lie ahead.

---

## 1. What Changed: Design Kit → Production

### 1.1 Editor Engine — Total Replacement

| Aspect | Design Kit | Production |
|---|---|---|
| Editor core | `contentEditable="true"` + custom block management | **ProseMirror** with v3 schema |
| Block model | `<div class="editor-block" data-block-type="action">` | PM nodes: `scene > sceneHeading + sceneBody+` |
| Scene headers | Inline form widget (`contentEditable="false"`) | PM NodeView with contentDOM (pickers are chrome, location is PM inline content) |
| Tab cycling | `Rga.Editor._onTab()` in editor-engine.js | `v3-keymap.js` PM keymap plugin |
| Context-aware Enter | `Rga.Editor._onEnter()` | `v3-commands.js` PM commands |
| Paste sanitization | `document.execCommand('insertText')` | PM paste handler |
| Gutter | `#gutter` div synced via scroll transform | `.flow-line-gutter` in page-row flex (Flow view) + NavigationIndex |
| Tag system | `Rga.TagSystem` with `span.tag-highlight` wrapping | PM `tag` mark via `plugins/tags.js` |
| Problems engine | `Rga.Problems` scanning DOM | **Not migrated** — validation deferred |

### 1.2 Shell Architecture — Slice 1/2 Overhaul

| Aspect | Design Kit | Production |
|---|---|---|
| State management | Direct DOM manipulation | Three truth layers (document / shell / writer-context) |
| Sidebar | `Rga.Sidebar.switchTo(panelName)` with hardcoded panel map | `Rga.Shell.Sidebar` with dynamic registration |
| Activity bar | Icons injected by `injectIcons()` from `Rga.Icons` map | `Rga.Shell.ActivityRail` rendering from registry, three-group doctrine |
| Status bar | `Rga.StatusBar.update()` polling DOM for word count | `Rga.Shell.StatusBar` subscribing to `ScriptSession` snapshots |
| Titlebar | Part of `#menu-bar` (logo + menu items) | Dedicated `.rga-shell-titlebar` strip (identity-only) |
| Menu bar | Custom `#menu-bar` with 7 menu items + fake window controls | **Deleted.** Native Electron menu only. |
| Layout state | CSS classes toggled directly | `Rga.Shell.Layout` with `get()`/`set()`/`subscribe()` |

### 1.3 Visual Changes

| Aspect | Design Kit | Production |
|---|---|---|
| Status bar colour | `--accent-primary` (#007acc blue) surface fill | `--statusbar-bg` (calm grey) |
| Scene heading accent | `--accent-gold` (#FFC107) | `--accent-rwanga` (#C2185B dark pink) |
| Editor background model | Single `--editor-bg` surface | Desk (`--editor-bg`) + paper (`--editor-page-bg`) + shadow (`--editor-page-shadow`) |
| Bottom panel tab indicator | `--accent-primary` underline | `--tab-active-indicator` (text-primary) |
| Inspector header | `INSPECTOR` (uppercase, bold) | `Inspector` (title-case, medium weight, calm) |
| Block type CSS | Left-margin indentation (industry standard) | **Centered layout** (character/dialogue/parenthetical use `text-align: center` + `max-width`) |
| Scene header border | Gold left border | Rwanga pink left border + bottom underline |

### 1.4 New Capabilities Not in Design Kit

| Feature | Production Status |
|---|---|
| Three view modes (Flow / Draft / Print Preview) | **Implemented** |
| Page Setup dialog | **Implemented** |
| Format toolbar (B/I/U/S/Color/Highlight/Link) | **Implemented** |
| Annotation marks + notes panel | **Implemented** |
| Revision flag marks + flags panel | **Implemented** |
| Character autocomplete ghost text | **Implemented** |
| Tag suggestion popup | **Implemented** |
| v1→v2→v3 migration chain | **Implemented** |
| Print preview renderer | **Implemented** |
| Page-break decorations (v2 paginator) | **Implemented** |
| Document outline framework | **Implemented** |
| Script workspace panel | **Implemented** |
| Electron file bridge (open/save/recent) | **Implemented** |
| Vendored fonts (no CDN) | **Implemented** |

---

## 2. What's Next: Planned but Not Implemented

### 2.1 Immediate (Blocked by Decisions)

| Item | Blocker | When |
|---|---|---|
| Activity rail icon implementation | OD-A icon family choice | After doctrine sign-off |
| Scene drag-reorder | Reserved slot in NodeView (`chrome-right`) | Phase 8+ |
| Scene delete button | Same reserved slot | Phase 8+ |
| Command palette rebuild | Legacy code still functional | When legacy app-shell is retired |

### 2.2 Near-Term (No Blocker, Just Priority)

| Item | Current State |
|---|---|
| PDF export | Print preview exists; PDF generation not wired |
| DOCX export | Not started |
| i18n runtime (`t()` function) | Vocabulary CSV exists; no runtime loader |
| Workspace persistence (layout state to disk) | `toJSON()`/`fromJSON()` ready; disk wiring deferred to Slice 4 |
| Autosave | Constants defined (`AUTOSAVE_DEBOUNCE_MS`); wiring partial |
| Custom tag type creation | Dialog CSS exists; PM mark support exists; no creation flow wired |

### 2.3 Long-Term (Requires Backend)

| Item | Notes |
|---|---|
| Rwanga Sync | Placeholder sidebar panel; no backend API |
| Extensions / MCP | Placeholder cards; no runtime |
| Collaboration | Spec'd for Max tier; no implementation |
| Account / Pro tier gating | UI placeholder (Pro badges); no auth |

---

## 3. Migration Risks

### R1 — Legacy / Shell Code Overlap (HIGH)

`app-shell.js` (1043 lines) contains modules that overlap with Shell:
- `Rga.Sidebar` vs `Rga.Shell.Sidebar`
- `Rga.StatusBar` vs `Rga.Shell.StatusBar`
- `Rga.Keyboard` vs Shell `_onKeydown`
- `Rga.BottomPanel` vs Shell Layout `studioPanel`

Both systems are live. No single source of truth for some operations. The compatibility inventory (`rwanga-shell-compatibility-inventory.md`) tracks this, but several entries remain open.

**Mitigation:** Incremental extraction. Each legacy module gets a compatibility adapter, then the adapter gets removed.

### R2 — CSS Namespace Collision (MEDIUM)

Three class-naming conventions coexist:
- **Legacy:** bare names (`.tab`, `.badge`, `.scene-item`, `.btn-primary`)
- **Shell Slice 1+:** prefixed `.rga-shell-*`
- **Engine/v3:** prefixed `.rga-*` (`.rga-scene-v3`, `.rga-block-action`, `.rga-tag-*`)

Legacy names risk collision with any future CSS library. Shell and engine prefixes are safe.

**Mitigation:** When legacy components are rebuilt, migrate to `rga-` prefix.

### R3 — Dead CSS Accumulation (MEDIUM)

Components.css and overlays.css contain ~400 lines of rules for legacy patterns that may have no DOM consumers:
- `.scene-item-*` (replaced by `.rga-shell-scene-navigator-*`)
- `#gutter` + `.gutter-line` (replaced by `.flow-line-gutter`)
- `.scene-header` + `.sh-*` (replaced by `.rga-scene-v3` + `.rga-scene-heading-v3`)
- `#menu-bar` + `.menu-*` selectors in components.css (deleted from shell.css but some component rules may remain)

**Mitigation:** Audit selectors against actual DOM. Remove dead rules.

### R4 — Token System Incompleteness (LOW)

Undefined tokens referenced via fallbacks (see Debt Registry D4, D5, D24). Works at runtime because fallbacks are correct values, but the token system is incomplete as a specification.

**Mitigation:** Define all referenced tokens in tokens.css.

### R5 — Accessibility Gap (MEDIUM)

- No `tabindex` strategy for zone navigation
- No `aria-*` attributes on most interactive elements (except inspector and rail)
- No keyboard mechanism to move focus between editor / sidebar / bottom panel without Cmd+Shift shortcuts
- `prefers-reduced-motion` only respected by rail

**Mitigation:** Accessibility pass needed before any public release.

---

## 4. Design Hierarchy (Final Report)

```
Foundation
  ↓
Tokens ←── 13 undefined-but-referenced tokens (D4, D5, D24)
  ↓          1 dead token (D2 --menu-bar-height)
Components ←── 3 duplicate button patterns (D3)
  ↓              2 context menu systems (D7)
  ↓              2 dialog systems (D23)
  ↓              3 tag-item patterns (D9)
Patterns ←── screenplay block rules stable ✅
  ↓           v3 scene chrome stable ✅
  ↓           migration chain stable ✅
Skills ←── 14 functional capabilities
  ↓          6 not-yet-implemented (sync, export, i18n, extensions, collab, MCP)
Implementation
  ↓
CONTRADICTIONS:
  • Legacy app-shell.js vs Shell modules (15+ overlapping concerns)
  • Design kit indentation model vs production centered model
  • Layout state default vs CSS default for bottom panel visibility
  • Two keyboard registries with duplicate bindings
  • Tag colour fallbacks misaligned between tokens.css and editor-prosemirror.css

MISSING SYSTEMS:
  • Spacing scale (no --space-xs/sm/md/lg tokens)
  • Line-height tokens
  • Font-weight tokens
  • Animation/motion system (only toast + annotation flash)
  • Loading/skeleton states
  • Error states beyond toasts
  • Responsive layout
  • Accessibility foundation

DANGEROUS OWNERSHIP COLLISIONS:
  • Rga.Sidebar ↔ Rga.Shell.Sidebar (both manipulate sidebar visibility)
  • Rga.Keyboard ↔ Shell _onKeydown (both capture Ctrl+B)
  • Rga.BottomPanel ↔ Rga.Shell.Layout.studioPanel (both own bottom panel state)
  • Rga.StatusBar ↔ Rga.Shell.StatusBar (legacy module may still be instantiated)

FUTURE RISKS:
  • Web-app deployment breaks every fixed-viewport assumption
  • Legacy CSS names will collide with external libraries
  • Dead CSS will grow if not pruned after each legacy module extraction
  • i18n vocabulary exists but has no runtime — RTL works visually but strings are hardcoded English
```

---

End of migration guide. This document, combined with the 8 preceding documents, constitutes the complete design system archaeology for the Rwanga Script Editor as of 2026-05-17.
