# Rwanga — Design Foundation

Status: **FORENSIC EXTRACTION** — 2026-05-17
Source: `daryabsb/rwanga@main` — `rwanga-editor/renderer/`

---

## 1. Product Identity

Rwanga Script Editor is a **professional screenplay authoring tool** modeled after VS Code's shell paradigm but purpose-built for directors and screenwriters. It runs as an Electron desktop app.

**Core analogy (EXISTING):** VS Code is to programming what RSE is to screenplay format.

**Visual feeling target (PROMOTED — from Activity Rail Doctrine, now generalized):**
> VS Code's restraint + creative-tool calm + screenplay paper warmth.

Three explicit anti-references (EXISTING — locked in doctrine):
- ❌ Discord (rounded coloured tiles, animated transitions, bright accent fills)
- ❌ AI playground / chatbot UI (neon accents, gradient pills, "magic" glow)
- ❌ Random Electron app (default-looking flat icons, no curation)

---

## 2. Design Heritage

The codebase carries DNA from **three distinct eras**:

| Era | Evidence | Status |
|---|---|---|
| **Design Kit (prototype)** | `rwanga_script_editor_design_kit/` — contentEditable, `Rga.Editor`, `Rga.SceneManager`, inline icon system, sample-data.js | **DEPRECATED** — superseded by ProseMirror engine |
| **Slice 1–2 Shell** | `Rga.Shell.*` modules (Layout, Sidebar, ActivityRail, StatusBar, TitleBar, ScriptSession), panel registration pattern, three-group rail layout | **EXISTING — LOCKED** |
| **v3 ProseMirror Engine** | `schema-v3.js`, `v3-node-views.js`, `v3-commands.js`, `v3-keymap.js`, nav-index, pagemap-engine, layout-profile, print-renderer, render-model, annotations/tags/revision-flags plugins | **EXISTING — LOCKED** (engine frozen since Phase 9) |

---

## 3. Architectural Principles (Extracted)

### 3.1 Three Truth Layers (EXISTING — Slice 1 plan §2.5)

| Layer | Owner | Scope |
|---|---|---|
| **Document truth** | ProseMirror EditorState | Content, marks, schema |
| **Shell truth** | `Rga.Shell.Layout` | Zone visibility, widths, active panels |
| **Writer-context** | `Rga.ScriptSession` | Current scene, page, block type, word count |

### 3.2 Native-First Chrome (PROMOTED — from V1 T1)

The app ships **native OS title bar + native Electron menu** as the authoritative menu surface. The renderer owns exactly ONE identity strip (`.rga-shell-titlebar`). No renderer-owned application menu. All advanced actions route through a future command palette, not custom menus.

### 3.3 Engine Isolation (EXISTING — locked)

CSS and shell code **never** touch:
- `renderer/js/framework/*`
- `renderer/js/doc-types/*`
- `renderer/js/editor/*`

Design changes live in CSS and shell JS. Engine changes require a separate slice.

### 3.4 Token-Driven Theming (EXISTING)

All visual values flow through CSS custom properties on `:root` / `[data-theme="light"]`. No hardcoded colours in component CSS (with known exceptions catalogued in the debt registry).

### 3.5 Panel Registration Pattern (EXISTING)

Sidebar panels self-register via IIFE at load time. The ActivityRail renders from the registry. No central manifest — the rail discovers what panels exist.

---

## 4. Design Hierarchy

```
Foundation (this document)
  ↓
Tokens (02-rwanga-design-tokens.md)
  ↓
Components (03-rwanga-component-system.md)
  ↓
Layout (04-rwanga-layout-system.md)
  ↓
Interactions (05-rwanga-interaction-system.md)
  ↓
Screenplay Patterns (06-rwanga-screenplay-patterns.md)
  ↓
Agent/UI Skills (07-rwanga-agent-ui-skills.md)
  ↓
Implementation
```

Each layer only references layers above it. Tokens don't know about components. Components don't know about screenplay patterns.

---

## 5. Font Strategy

| Role | Family | Source | Status |
|---|---|---|---|
| UI chrome (LTR) | System stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`) | OS-provided | **EXISTING** |
| UI chrome (RTL) | `Noto Sans Arabic` | Vendored woff2 (4 weights) | **EXISTING** |
| Editor surface (LTR) | `Courier Prime` | Vendored woff2 (Regular, Bold, Italic, BoldItalic) | **EXISTING** |
| Editor surface (RTL) | `Noto Naskh Arabic` | Vendored woff2 (4 weights) | **EXISTING** |
| Monospace UI (line gutters) | `ui-monospace, Menlo, Consolas, monospace` | OS-provided | **EXISTING** |

All fonts are **vendored locally** — no CDN. `@font-face` declarations live in `tokens.css`.

---

## 6. Colour Philosophy

**Dark-first.** The default theme is dark. Light theme is a complete override, not an afterthought.

**Accent strategy:**
- `--accent-primary` (#007acc) — interaction accent (links, focus rings, selection). VS Code heritage. **Never used as a surface fill** (V1 correction).
- `--accent-gold` (#FFC107) — screenplay/scene accent. Domain-specific warmth.
- `--accent-rwanga` (#C2185B dark / #AD1457 light) — brand identifier. Used for scene heading underlines, the slug border. **NEW — introduced in v3 engine.**

**Chrome surfaces use dedicated tokens**, not accent tokens:
- `--statusbar-bg`, `--statusbar-fg`, `--statusbar-fg-hover`, `--statusbar-segment-hover-bg`
- `--tab-active-indicator`

This separation is a **PROMOTED** principle from V1 Visual Stabilization.

---

## 7. RTL Strategy (EXISTING)

- Editor surface direction is per-script, set via `doc.metadata.screenplayProfile.language`
- CSS uses logical properties (`padding-inline-start`, `text-align: start`, `inset-inline-start`)
- Scene toolbox mirrors position in RTL: `[dir="rtl"] #scene-toolbox { right: auto; left: 16px; }`
- Page row flexes in reverse: `[dir="rtl"] .rga-page-row { flex-direction: row-reverse; }`
- Three languages supported: English (LTR), Kurdish/Sorani (RTL), Arabic (RTL)
- i18n vocabulary lives in `i18n/vocabulary.csv` and `vocabulary-CONFIRMED.csv`

---

## 8. Binding Documents

| Document | Status | Scope |
|---|---|---|
| `rwanga-activity-rail-doctrine.md` | **LOCKED** 2026-05-17 | 5 rules governing rail visual treatment |
| `rwanga-visual-stabilization-v1-plan.md` | **IMPLEMENTED** | 6 P1 fixes, native-first chrome, calm grey status bar |
| `rwanga-visual-stabilization-v1-1-open-decisions.md` | **OPEN** | Menu strategy (OD-1) |
| `rwanga-shell-visual-debt-after-slice2.md` | **REVISED** | 10 debt items, 6 were P1 (resolved by V1) |
| `phase0-final-schema-contract.md` | **LOCKED** | v3 schema corrections (A, 1, 2, 3) |
| `rwanga-shell-slice-1-plan.md` | **IMPLEMENTED** | Shell architecture, panel registration |
| `rwanga-shell-slice-2-plan.md` | **IMPLEMENTED** | Status bar, title bar, scene navigator |

End of foundation.
