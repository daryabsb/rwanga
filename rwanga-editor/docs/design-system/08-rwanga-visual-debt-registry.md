# Rwanga — Visual Debt Registry

Status: **FORENSIC EXTRACTION** — 2026-05-17
Source: Cross-referencing all CSS, JS, and existing debt/stabilization docs.

Each item is tagged with provenance:
- **EXISTING** — was in the original debt report, still present
- **NEW** — discovered during this forensic pass
- **RESOLVED** — was debt, fixed by V1/V1.1

---

## Resolved Items (V1 Visual Stabilization)

| # | Item | Resolution |
|---|---|---|
| R1 | Four competing header strips | V1 T1: deleted `#menu-bar`, native-first 3-strip |
| R2 | Bright blue status bar | V1 T2: `--statusbar-bg` calm grey tokens |
| R3 | Scene Navigator mashed rendering | V1 T3: grid row layout, ellipsis, page badges |
| R4 | Scene toolbox clipped off right edge | V1 T4: absolute positioning, reserved padding |
| R5 | Inspector ALL-CAPS header | V1 T5: title-case, calm empty state |
| R6 | Bottom panel accent twinning | V1 T6: `--tab-active-indicator`, disabled empty state |

---

## Active Debt — P1 (Product Embarrassment)

### D1 — Activity rail emoji icons — **EXISTING, governed by doctrine**

Rail items still render as emoji glyphs. Full-colour green tree (🌳) breaks monochrome pattern. OS-dependent rendering. No visible active indicator against the rail background.

**Governed by:** `rwanga-activity-rail-doctrine.md` (LOCKED 2026-05-17). Blocked on OD-A (icon family choice).

**Provenance:** Original debt report item #4. Upgraded from P2 to doctrine-governed.

### D2 — Dead `--menu-bar-height` token — **NEW**

`tokens.css` still defines `--menu-bar-height: 32px`. The `#menu-bar` element was deleted in V1 T1. The `#app` grid now uses `auto` for the titlebar track. Token has zero consumers.

**Risk:** Future contributor references it thinking it's active.
**Action:** Remove from tokens.css.

### D3 — Three independent primary button patterns — **NEW**

`.btn-primary`, `.modal-btn.primary`, `.empty-state-btn--primary` all express the same semantic (primary action) with different padding, radius, font-size, hover treatments.

**Risk:** Inconsistent affordances across the product.
**Action:** Consolidate to one primary button pattern with size variants.

---

## Active Debt — P2 (Polish)

### D4 — `--text-muted` referenced but undefined — **NEW**

`.rga-shell-titlebar` uses `var(--text-muted, #9a9a9a)`. Token never defined in `tokens.css`. Falls back to hardcoded colour.

**Action:** Define `--text-muted` or alias to `--text-secondary` in both theme blocks.

### D5 — `--editor-font-size` referenced but undefined — **NEW**

`.ProseMirror` uses `var(--editor-font-size, 12pt)`. Not in tokens.css. Page Setup dialog writes it inline but there's no default declaration.

**Action:** Add `--editor-font-size: 12pt` to tokens.css `:root` block.

### D6 — Tag fallback colour mismatches in editor-prosemirror.css — **NEW**

ProseMirror mark styles define different fallback colours than tokens.css for:
- `.rga-tag-vfx`: fallback `#C586C0` (matches wardrobe!) vs token `#FF79C6`
- `.rga-tag-vehicle`: fallback `#DCDCAA` vs token `#56B6C2`
- `.rga-tag-animal`: fallback `#B5CEA8` vs token `#D19A66`

**Risk:** If tokens fail to load, tag colours are wrong. Misleading code.
**Action:** Align fallbacks to match tokens.css values.

### D7 — Two context menu systems — **NEW**

Legacy `.overlay-menu` (overlays.css) and v3 `.rga-context-menu` (editor-prosemirror.css) coexist with different markup, class names, z-indices, and hover treatments.

**Risk:** Visual inconsistency; z-index collisions; maintenance burden.
**Action:** Migrate to single context menu system when legacy app-shell code is retired.

### D8 — Two scene list patterns — **NEW**

`.scene-item` (components.css, legacy) and `.rga-shell-scene-navigator-row` (shell.css, Slice 1+) are both scene-list row patterns. Navigator uses the new one; old one is dead CSS.

**Action:** Remove `.scene-item` / `.scene-item-number` / `.scene-item-text` / `.scene-item-summary` from components.css.

### D9 — Three tag-item patterns — **NEW**

`.tag-item` (components.css), `.tag-entity-row` (editor-prosemirror.css), and `.tag-group-header` (components.css, duplicated in editor-prosemirror.css) represent tags in sidebar.

**Action:** Consolidate when the Tags panel is rebuilt.

### D10 — Duplicate keyboard shortcut bindings — **NEW**

`Ctrl+B` registered in both `Rga.Keyboard` (legacy) and Shell `_onKeydown`. Both toggle sidebar via different code paths. Risk of double-toggle.

**Action:** Remove legacy `Rga.Keyboard.register('b', {ctrl:true}...)` after Shell owns the binding.

### D11 — Legacy `#gutter` element — **NEW**

`editor.css` still has `#gutter` styles. ProseMirror pages use `.flow-line-gutter` (editor-prosemirror.css, 44px width). The legacy gutter HTML may still exist in index.html but is visually hidden/empty.

**Action:** Remove `#gutter` from index.html and editor.css.

### D12 — Force-repaint hack in Theme.toggle() — **EXISTING**

`Rga.Theme.apply()` sets `body.style.display = 'none'` then reads `offsetHeight` to force reflow. Unnecessary in modern Chromium/Electron.

**Action:** Remove the hack; CSS custom property changes trigger repaints automatically.

### D13 — Screenplay layout variables in wrong file — **NEW**

`--dialogue-side-margin` and `--parenthetical-side-margin` are defined in a `:root` block inside `editor-prosemirror.css` instead of `tokens.css`.

**Action:** Move to tokens.css alongside other layout dimensions.

### D14 — Status bar sync dot hardcoded colour — **EXISTING**

`.status-sync-dot.synced` uses `#73e0a2` instead of `var(--accent-success)`.

**Action:** Replace with token reference.

### D15 — Editor page paper feel still weak — **EXISTING (original debt #8)**

Flat rectangle on grey desk. Shadow token exists (`--editor-page-shadow`) but the visual treatment is minimal. Title/heading blocks read as unstyled HTML headings with inconsistent typography.

**Action:** P2 polish — enhance paper shadow, tighten treatment typography.

---

## Active Debt — P3 (Later)

### D16 — Format toolbar browser-button aesthetic — **EXISTING (#10c)**
Reads as engine debug chrome, not product UI.

### D17 — `+` new-tab button low-contrast — **EXISTING (#10d)**
Same colour as tab bar background.

### D18 — 👤 emoji avatar placeholder in titlebar — **EXISTING (#10b)**
Literal emoji glyph as account placeholder.

### D19 — No responsive layout — **NEW**
Fixed desktop viewport assumption. No media queries for width/height.

### D20 — No `prefers-reduced-motion` beyond rail — **NEW**
Toast animations, swatch hover scales, and annotation flash all ignore `prefers-reduced-motion`.

### D21 — No focus management between zones — **NEW**
Keyboard-only users cannot navigate editor → sidebar → bottom panel. No `tabindex` strategy.

### D22 — Legacy app-shell.js bloat — **NEW**
1043 lines containing Theme, Resize, Sidebar, Tabs, Keyboard, StatusBar, CommandPalette, BottomPanel, Inspector, Toast, FileTree, SceneNotesConnector, ScriptLanguage — many of which are partially or fully superseded by Shell modules.

**Action:** Incremental extraction to Shell modules. Track via compatibility inventory.

### D23 — Two dialog systems — **NEW**
`.dialog-backdrop` + `.dialog` (overlays.css) and `.modal-overlay` + `.modal-dialog` (components.css) are structurally identical modal patterns with different class names.

**Action:** Consolidate to one modal pattern.

### D24 — `--font-sans` and `--font-mono` referenced but undefined — **NEW**
Used in titlebar and editor-prosemirror.css fallbacks. Not in tokens.css.

**Action:** Define or alias in tokens.css.

---

## Summary

| Severity | Count | Trend |
|---|---|---|
| Resolved (V1) | 6 | ✅ |
| P1 (active) | 3 | D1 (doctrine-governed), D2–D3 (new finds) |
| P2 (active) | 12 | Mix of legacy and new architectural debt |
| P3 (active) | 9 | Mostly polish and accessibility |
| **Total active** | **24** | |

End of visual debt registry.
