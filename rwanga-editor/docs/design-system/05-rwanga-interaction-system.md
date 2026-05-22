# Rwanga — Interaction System

Status: **FORENSIC EXTRACTION** — 2026-05-17
Source: `renderer/js/shell/`, `renderer/js/editor/`, `renderer/css/`

---

## 1. State Model — Four-State Standard

The Activity Rail Doctrine (Rule 4) defines a four-state interaction model. This is **PROMOTED** as the general standard for all interactive elements:

| State | Visual Treatment | Trigger |
|---|---|---|
| **Idle** | Muted colour, no background | Default |
| **Hover** | Brighter colour + subtle background pill | Mouse-over |
| **Selected / Active** | Full primary colour + background + accent indicator | Clicked / current |
| **Current** | Superset of selected with stronger accent | Context-specific "you are here" |

### Where it's implemented

| Component | Idle | Hover | Selected | Current |
|---|---|---|---|---|
| Rail items | `--text-tertiary`, transparent | `--text-secondary`, 4% pill | `--text-primary`, 7% pill, left bar | Reserved (`.rga-shell-rail-item-current`) |
| Scene nav rows | `--text-secondary` | `--bg-hover` | `--bg-active` (keyboard) | Left border `--text-primary` (cursor) |
| Sidebar items | `--text-primary` | `--bg-hover` | `--bg-selected` | N/A |
| Tab bar | `--text-secondary`, `--bg-tertiary` | `--bg-hover` | `--bg-primary`, bottom edge cover | N/A |
| Bottom panel tabs | `--text-tertiary` | `--text-primary` | `--text-primary`, `--tab-active-indicator` underline | N/A |

### Contradiction
- **Sidebar items** (scene list, tag items, tree items) still use a **two-state** model (idle + hover). Selected uses `--bg-selected` but there's no four-state treatment. The old components predate the doctrine.
- **Format toolbar buttons** use a binary `.active` state (accent-primary fill) with no hover-to-active progression.

---

## 2. Transitions & Motion

### Doctrine Constraints
- **Rail:** max 120ms, `ease` timing. No overshoot/bounce. (Rail Doctrine Rule 5)
- **General:** Three token tiers — `--transition-fast` (100ms), `--transition-normal` (200ms), `--transition-slow` (300ms). All use `ease`.
- **`prefers-reduced-motion: reduce`** — respected for rail items (transitions set to `none`). Not applied elsewhere.

### Existing Animations
| Animation | Duration | Easing | Where |
|---|---|---|---|
| `toast-slide-in` | 250ms | ease-out | Notification toasts |
| `toast-slide-out` | 200ms | ease-in | Toast dismissal |
| Annotation focus flash | 1.4s | ease-out | `background-color` + `box-shadow` fade |
| Swatch hover scale | `--transition-fast` | ease | `transform: scale(1.15)` |

### Missing
- No enter/exit animations for panels, overlays, or dialogs.
- No page-transition animation between view modes.
- No skeleton/loading states.

---

## 3. Keyboard Shortcuts

### Shell Shortcuts (EXISTING — shell/index.js)

| Combo | Action | Owner |
|---|---|---|
| `Cmd+Shift+S` | Toggle Scene Navigator | Shell |
| `Cmd+Shift+E` | Toggle Script Workspace | Shell |
| `Cmd+Shift+O` | Toggle Outline | Shell |
| `Cmd+Shift+C` | Toggle Characters | Shell |
| `Cmd+Shift+F` | Toggle Search | Shell |
| `Cmd+Shift+R` | Toggle Revisions | Shell |
| `Cmd+,` | Toggle Settings | Shell |
| `Cmd+B` | Toggle sidebar visibility | Shell |
| `` Cmd+` `` | Toggle Studio Panel (bottom) | Shell |

### Legacy Shortcuts (EXISTING — app-shell.js Rga.Keyboard)

| Combo | Action | Owner |
|---|---|---|
| `Ctrl+Shift+P` | Command palette | Legacy app-shell |
| `Ctrl+Shift+T` | Toggle theme | Legacy app-shell |
| `Ctrl+Shift+I` | Toggle inspector | Legacy app-shell |
| `Ctrl+J` | Toggle bottom panel | Legacy app-shell |
| `Ctrl+B` | Toggle sidebar | Legacy app-shell |

### Engine Shortcuts (EXISTING — v3-keymap.js + editor/shortcuts.js)

| Key | Action | Context |
|---|---|---|
| `Tab` | Cycle block type forward | Inside editor |
| `Shift+Tab` | Cycle block type backward | Inside editor |
| `Enter` | Context-aware new block | Inside editor |
| `Mod+Enter` | Engine-specific (TBD per keymap) | Inside editor |
| `Backspace` | Merge/type-change at block start | Inside editor |

### Contradiction — Duplicate Bindings
- `Ctrl+B` / `Cmd+B` is registered by **both** legacy `Rga.Keyboard` and the Shell `_onKeydown`. The shell handler runs first (it's on `document`), legacy handler also fires. Both toggle sidebar. Double-toggle risk.
- `Ctrl+J` is registered by legacy but `` Cmd+` `` is the shell equivalent. Two different shortcuts for the same action, targeting different code paths.

---

## 4. Resize Interactions (EXISTING)

`Rga.Resize` in `app-shell.js` handles panel divider dragging:

| Target | Direction | Property | Min Size | Collapse Threshold |
|---|---|---|---|---|
| Sidebar | Horizontal | `--sidebar-width` | 180px | 60px → collapse to 0 |
| Inspector | Horizontal (reverse) | `--inspector-width` | 180px | 60px → collapse to 0 |
| Bottom panel | Vertical | `--bottom-panel-height` | 100px | 60px → collapse to 0 |

Drag feedback: `.resize-handle.dragging` shows `--accent-primary` bar.
Body gets `cursor: col-resize/row-resize` + `user-select: none` during drag.

---

## 5. Panel Toggle Semantics (EXISTING)

Two toggle patterns exist:

### Shell Pattern (Slice 1+)
Rail click on active panel → `Sidebar.deactivate()` + `Layout.set({sidebar: {visible: false}})`.
Rail click on inactive panel → `Sidebar.activate(id)` + `Layout.set({sidebar: {visible: true}})`.
Same panel + visible = toggle off. Different panel = switch + ensure visible.

### Legacy Pattern
`Rga.Inspector.toggle()` → class toggle on `#workspace`.
`Rga.BottomPanel.toggleCollapse()` → class toggle on `#center-column`.
`Rga.Sidebar.toggleCollapse()` → class toggle on `#workspace`.

### Conflict
Shell Layout state and legacy class toggles can desync. If legacy `Rga.Sidebar.toggleCollapse()` hides the sidebar by adding `.sidebar-collapsed`, Shell Layout state still says `sidebar.visible: true`. No reconciliation mechanism exists.

---

## 6. Context Menu (TWO SYSTEMS)

### Legacy (overlays.css + tag-system.js pattern)
`Rga.ContextMenu.show(items, x, y)` → builds `.overlay-menu` with `.menu-option` children. Supports submenus via `mouseenter`. Click outside or Escape closes.

### v3 Engine (editor-prosemirror.css + context-menu.js plugin)
`showContextMenu(items, x, y)` → builds `.rga-context-menu` with `<ul class="ctx-list">` / `<li class="ctx-item">`. Submenu via `.ctx-has-submenu:hover .ctx-submenu`. Different z-index (9000 vs 1000).

### Risk
Both systems can coexist on screen if a user right-clicks in the editor (engine menu) then right-clicks in the sidebar (legacy menu). Z-index layering is inconsistent.

---

## 7. Theme Toggle (EXISTING)

`Rga.Theme.toggle()` in `app-shell.js`:
- Flips `data-theme` attribute on `<html>` between `dark` and `light`.
- Persists to `localStorage('rga-theme')`.
- **Force-repaint hack:** `body.style.display = 'none'` + `offsetHeight` + restore. Still present.

V1.1 added a theme toggle button in the titlebar (`.rga-shell-titlebar-action`).

---

## 8. View Mode Cycling (NEW)

Status bar viewMode segment is clickable → cycles through: `flow` → `draft` → `printPreview` → `flow`.

Calls `Rga.ViewManager.activate(mode)`. ViewManager owns the mode state and applies body/container classes.

Draft mode adds a floating exit button (`.draft-exit-btn`, fixed top-right, z-index 1400).

---

## 9. Scroll Behavior

### Editor scrolling
`#editor-container` scrolls vertically and horizontally. No `scrollIntoView` — position is calculated manually via `scrollTo({ top, behavior: 'smooth' })`.

### Scene navigation scroll
Scene Navigator panel click → scrolls editor-container to target scene. Flash highlight (box-shadow pulse, 1.2s) confirms navigation.

### Gutter sync (LEGACY — may be dead)
Legacy `app-shell.js` syncs `#gutter` transform with editor scroll. But the ProseMirror page surface doesn't use the legacy gutter. The sync code may be running against a hidden/empty element.

---

## 10. Drag & Drop

### Scene reorder (LEGACY — design kit only)
`Rga.SceneManager._startDrag()` existed in the design kit. In v3 ProseMirror, scene reorder is **not implemented** — the NodeView has a reserved `.rga-scene-v3-chrome-right` slot for future drag handle (memory: `project-scene-header-actions-deferred`).

### Resize handles
Panel resize via mousedown → mousemove → mouseup. See §4.

### No other drag targets.

---

## 11. Focus Management

### Editor focus
ProseMirror manages cursor and selection internally. Clicking outside the `.ProseMirror` div does not blur — `outline: none` on the root.

### Panel focus
No explicit focus management between shell panels. Tab key inside the editor is captured by the block-type cycling keymap. There is no keyboard mechanism to move focus from editor → sidebar → bottom panel.

### Risk
Accessibility gap: keyboard-only users cannot navigate between zones without using the shell shortcuts (Cmd+Shift+X combos). No `tabindex` strategy exists.

End of interaction audit.
