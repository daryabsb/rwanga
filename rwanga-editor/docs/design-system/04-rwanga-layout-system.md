# Rwanga — Layout System

Status: **FORENSIC EXTRACTION** — 2026-05-17
Source: `renderer/css/shell.css`, `editor-prosemirror.css`, `renderer/js/shell/layout.js`

---

## 1. App Root Grid (EXISTING, MODIFIED)

```
#app {
  display: grid;
  grid-template-rows: auto 1fr var(--status-bar-height);
  height: 100vh;
}
```

Three rows (top → bottom):
1. **Titlebar** (`.rga-shell-titlebar`, 28px) — `auto` track, height owned by the element.
2. **Workspace** (`#workspace`) — `1fr`, takes all remaining space.
3. **Status bar** (`#status-bar`) — fixed `--status-bar-height` (24px).

### History
- **Design kit:** 3 rows: `menu-bar-height / 1fr / status-bar-height`
- **Slice 1:** 4 rows added titlebar above menu-bar
- **V1 T1:** Deleted `#menu-bar`, contracted back to 3 rows with `auto` first track

### Guard
`tests/unit/shell/css-layout.test.js` asserts track count ≥ child count of `#app`. If a new chrome row is added without expanding the grid template, `#workspace` collapses.

---

## 2. Workspace Grid (EXISTING)

```
#workspace {
  display: grid;
  grid-template-columns:
    var(--activity-bar-width)     /* 48px — activity rail */
    var(--sidebar-width)          /* 260px — sidebar */
    4px                           /* resize handle */
    1fr                           /* center column */
    4px                           /* resize handle */
    var(--inspector-width, 0px);  /* 280px — inspector */
}
```

Six columns. Collapsed states via CSS classes:

| State | Class | Effect |
|---|---|---|
| Sidebar collapsed | `#workspace.sidebar-collapsed` | Columns 2+3 → 0px, sidebar + handle hidden |
| Inspector hidden | `#workspace.inspector-hidden` | Columns 5+6 → 0px, inspector + handle hidden |

---

## 3. Center Column (EXISTING)

```
#center-column {
  display: grid;
  grid-template-rows: 1fr 4px var(--bottom-panel-height);
}
```

Three rows:
1. **Editor area** — `1fr`
2. **Resize handle** — 4px
3. **Bottom panel** — `--bottom-panel-height` (200px)

`.bottom-collapsed` class collapses rows 2+3 to 0.

---

## 4. Editor Area (EXISTING, MODIFIED)

```
#editor-area {
  display: grid;
  grid-template-rows: var(--tab-bar-height) 1fr;
  position: relative;   /* V1.1 — anchor for scene toolbox */
}
```

Two rows:
1. **Tab bar** — `--tab-bar-height` (36px)
2. **Editor container** — `1fr`

**Format toolbar** (`#format-toolbar`, 36px) sits as a child between tab-bar and editor-container rows. When present, the grid auto-inserts a row.

---

## 5. Editor Container (MODIFIED — significant)

**Design kit version:**
```css
display: grid;
grid-template-columns: var(--gutter-width) 1fr;
overflow-y: auto;
```

**Production version:**
```css
display: flex;
justify-content: center;
align-items: flex-start;
overflow-y: auto;
overflow-x: auto;
background: var(--editor-bg);
padding: 32px 120px 32px 32px;  /* right padding reserves toolbox space */
```

Key differences:
- **No gutter column** — legacy gutter is a dead element. ProseMirror manages its own line numbering via `.flow-line-gutter`.
- **Flex centered** — the `.rga-page` floats centered on the "desk" background.
- **Right padding** reserves space for the scene toolbox (V1.1 fix 5). RTL mirrors to left.

---

## 6. Page Surface Architecture (NEW)

```
#editor-container
  └── .rga-page-row (flex, centered)
      ├── .flow-line-gutter (44px, Flow view only)
      └── .rga-page (8.5in × 11in paper)
          └── .ProseMirror (content root)
              ├── .rga-title-strip (optional)
              └── .rga-body
                  ├── .rga-scene-v3
                  │   ├── .rga-scene-v3-num (chrome)
                  │   ├── .rga-scene-heading-v3 (pickers + location)
                  │   └── .rga-scene-v3-content
                  │       ├── .rga-block-action
                  │       ├── .rga-block-character
                  │       ├── .rga-block-dialogue
                  │       └── ...
                  └── paragraph / heading (treatment blocks)
```

Page dimensions are set inline by `page-surface.js` from `doc.settings.pageSetup`. CSS provides fallbacks: 8.5in × 11in, padding 1in 1in 1in 1.5in.

---

## 7. Three View Modes (NEW)

Classes on `#editor-container`:

| Mode | Class | Page Treatment | Chrome |
|---|---|---|---|
| **Print** | `.view-print` | Paper with shadow, page breaks as desk strips | Full shell visible |
| **Flow** | `.view-flow` | Transparent page, no shadow, dashed page markers | Full shell visible |
| **Draft** | `.view-draft` | Transparent page, no shadow | ALL chrome hidden (activity bar, sidebar, tabs, bottom panel, inspector, status bar, format toolbar, scene toolbox). Only editor + draft-exit button visible. |

Draft mode additionally sets `body.view-draft-active` to hide shell elements via `display: none !important`.

Print Preview (`body.view-print-preview-active`) is a fourth mode that overlays `#rga-print-preview-root` as a fixed full-viewport scroll of `.rga-page-sheet` elements. All shell chrome hidden.

---

## 8. Shell Truth — Layout State (EXISTING)

`Rga.Shell.Layout` manages zone visibility as an in-memory state container:

```js
DEFAULTS = {
  sidebar:     { visible: true,  width: 280, activePanel: 'sceneNavigator' },
  studioPanel: { visible: false, height: 200, activeTab: null },
  titleBar:    { visible: true },
  statusBar:   { visible: true }
}
```

API: `get()`, `set(partial)`, `subscribe(fn)`, `toJSON()`, `fromJSON(snap)`.
Per-zone shallow merge: `set({sidebar: {visible: false}})` preserves `sidebar.width`.

### Contradiction
- Layout state says `studioPanel.visible: false` by default, but the bottom panel is visible on load in the HTML. The CSS default (`grid-template-rows: 1fr 4px 200px`) shows it. The Layout state and CSS default disagree. Resolution: CSS is the visual truth; Layout state controls toggle after boot.

---

## 9. Resize Handles (EXISTING)

`.resize-handle` — 4px wide/tall strips between zones. Cursor changes on hover.
`.resize-handle.dragging` — `--accent-primary` background.
`data-resize` attribute targets: `sidebar`, `inspector`, `bottom-panel`.

Resize JS lives in legacy `app-shell.js` (`Rga.Resize`). Updates CSS custom properties on `:root`.

---

## 10. Scene Toolbox Positioning (MODIFIED — V1 T4)

**Before V1:** `position: sticky` inside editor-container flex flow → clipped by inspector.
**After V1:** `position: absolute` relative to `#editor-area` (which has `position: relative`).

```css
#scene-toolbox.scene-toolbox-vertical {
  position: absolute;
  top: 32px;
  right: 16px;
  width: 88px;
  z-index: 10;
}
```

RTL mirrors via `[dir="rtl"]` selector: `right: auto; left: 16px`.

---

## 11. Responsive Behavior

**None.** The app assumes a fixed desktop viewport (Electron window). No media queries for width/height breakpoints. Only `@media (prefers-reduced-motion: reduce)` exists (for rail transitions).

### Risk
If the app ever ships as a web app, every layout assumption breaks. The grid is rigid — no column collapsing at narrow widths, no stacking.

---

## 12. Layout Ownership Map

| Zone | CSS Owner | JS Owner | State Owner |
|---|---|---|---|
| App grid | `shell.css` | — | — |
| Titlebar | `shell.css` (.rga-shell-titlebar) | `shell/title-bar.js` | `Rga.Shell.Layout.titleBar` |
| Activity rail | `shell.css` (.rga-shell-rail-*) | `shell/activity-rail.js` | Derived from Sidebar |
| Sidebar | `shell.css` (#sidebar) | `shell/sidebar.js` | `Rga.Shell.Layout.sidebar` |
| Editor container | `shell.css` + `editor-prosemirror.css` | `editor/mount.js` | — |
| Page surface | `editor-prosemirror.css` | `editor/page-surface.js` | `doc.settings.pageSetup` |
| Bottom panel | `components.css` | Legacy `app-shell.js` (Rga.BottomPanel) | `Rga.Shell.Layout.studioPanel` |
| Inspector | `components.css` (#inspector-panel) | Legacy `app-shell.js` (Rga.Inspector) | — |
| Status bar | `shell.css` (#status-bar) | `shell/status-bar.js` | Derived from ScriptSession |
| Scene toolbox | `editor-prosemirror.css` | `flow-chrome.js` | — |
| Format toolbar | `editor-prosemirror.css` | `format-toolbar.js` | — |

End of layout audit.
