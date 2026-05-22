# Rwanga — Component System

Status: **FORENSIC EXTRACTION** — 2026-05-17
Source: `renderer/css/components.css`, `editor-prosemirror.css`, `overlays.css`, `shell.css`

---

## 1. Buttons

### 1.1 btn-primary (EXISTING)
`background: --accent-primary`, white text, 6px 14px padding, radius-md.
Hover: `--accent-primary-hover`. Light theme forces `color: #ffffff`.

### 1.2 btn-secondary (EXISTING)
Transparent bg, `--border-primary` border, radius-md. Hover: `--bg-hover` + tertiary border.

### 1.3 btn-icon (EXISTING)
28×28px square, radius-md, `--text-secondary`. Hover: `--bg-hover`, `--text-primary`.

### 1.4 sidebar-btn-full (EXISTING)
Full-width dashed border button for sidebar CTAs. "+" create actions.

### 1.5 modal-btn (NEW)
Introduced for unsaved-changes dialog. 6px 14px, radius 4px, `--bg-primary` fill.
`.modal-btn.primary` uses `--accent-primary` fill. **Duplicates** btn-primary semantics.

### 1.6 empty-state-btn (NEW)
Editor empty-state buttons. `--bg-secondary` fill, `--border-secondary` border.
`.empty-state-btn--primary` uses `--accent-primary`. **Third variant** of primary button.

### 1.7 format-btn (NEW)
Format toolbar buttons. 28×28, no border, transparent bg. `.active` uses `--accent-primary` fill.

### 1.8 scene-tb-btn (NEW)
Scene toolbox buttons. Full-width, 26px height, transparent bg with border on hover.

### 1.9 rga-popup-btn (NEW)
Mark popup buttons (annotations, tags, revision flags). 4px 10px, radius 4px.
`.primary` and `.danger` variants.

| Component | Status | Ownership |
|---|---|---|
| `.btn-primary` | EXISTING | Shared — used in sidebar panels, dialogs |
| `.btn-secondary` | EXISTING | Shared |
| `.btn-icon` | EXISTING | Shared |
| `.modal-btn` | NEW | Shell — unsaved dialog |
| `.empty-state-btn` | NEW | Shell — empty editor state |
| `.format-btn` | NEW | Engine chrome — format toolbar |
| `.scene-tb-btn` | NEW | Engine chrome — scene toolbox |
| `.rga-popup-btn` | NEW | Engine — mark popups |

### Contradiction
**Three independent primary-button patterns** exist: `.btn-primary`, `.modal-btn.primary`, `.empty-state-btn--primary`. All use `--accent-primary` but with different padding, radius, font-size, and hover treatments. Should consolidate.

---

## 2. Badges (EXISTING)

| Class | Use |
|---|---|
| `.badge` | Default (accent-primary bg) |
| `.badge.warning` | Warning (gold bg, dark text) |
| `.badge.error` | Error (red bg, white text) |
| `.badge.muted` | Quiet (quaternary bg, secondary text) |
| `.pro-badge` | Gradient gold→red, uppercase, 9px |

---

## 3. Tab Bar (EXISTING)

`#tab-bar` — horizontal flex, `--tab-bar-height` (36px), `--bg-tertiary`.
`.tab` — 120–200px width, close button appears on hover.
`.tab.active` — bg-primary, bottom edge cover via `::after`.
`#tab-new` — 36px "+" button.
**Tab close opacity** changed from design kit `0` to `0.5` in production.

---

## 4. Sidebar Components

### 4.1 Section Header (EXISTING)
`.sidebar-section-header` — flex, uppercase xs text, 0.08em tracking.

### 4.2 Search Input (EXISTING)
`.sidebar-search input` — bg-primary fill, border-primary, radius-md.

### 4.3 Scene List Items (EXISTING — components.css)
`.scene-item` — flex row, gold monospace number + ellipsised heading.
**Note:** The shell's scene navigator uses a DIFFERENT pattern:
`.rga-shell-scene-navigator-row` — CSS grid (4 columns), distinct class namespace.
**Two coexisting scene-list patterns.**

### 4.4 Tag Groups (EXISTING)
`.tag-group-header` — collapsible, colour dot + label + count badge.
`.tag-item` — indented item with dot + name + count.
**Also:** `editor-prosemirror.css` defines `.tag-entity-row` — a THIRD tag-item pattern for the Tags panel entity cards.

### 4.5 File Tree (EXISTING)
`.tree-item` — flex row with indent, chevron, icon, label.

### 4.6 Extension Cards (EXISTING)
`.extension-card` — flex, 36px icon, name + description. `.locked` at 0.55 opacity.

### 4.7 Sync Panel (EXISTING)
`.sync-login`, `.sync-status`, `.version-list`, `.sync-actions`.

---

## 5. Bottom Panel (EXISTING, MODIFIED)

### 5.1 Tab Bar
`#bottom-panel-tabs` — 32px height, `--bg-tertiary`.
`.bp-tab` — V1 modification: inactive tabs now `--text-tertiary` (was `--text-secondary`).
`.bp-tab.active` — underline uses `--tab-active-indicator` (was `--accent-primary`). **V1 fix.**

### 5.2 Notes (MODIFIED)
`.notes-textarea[disabled]` hides via `display: none`. Sibling `.notes-empty-state` shows instead. **V1 T6 fix.**

### 5.3 Problems List (EXISTING)
`.problem-item` — severity dot (14px circle) + message + location.

### 5.4 Breakdown Table (EXISTING)
`.breakdown-table` — standard table with uppercase headers.

### 5.5 Annotation Notes (NEW)
`.annotation-notes-list`, `.annot-card` — cards with 3px left border, preview + textarea.
`.annot-card-resolved` — reduced opacity + RESOLVED badge.

### 5.6 Revision Flags (NEW)
`.revision-flags-list`, `.flag-card` — similar card pattern with resolve/remove buttons.

---

## 6. Inspector Panel (MODIFIED)

### Header
V1 change: dropped `text-transform: uppercase`, reduced weight to 500, uses `--border-subtle`. **Title-case, calm.**

### Empty State (NEW)
`.inspector-empty` — centred column, muted icon + title + help text.

### Fields (EXISTING)
`.inspector-field label` — uppercase xs, 0.06em tracking.
`.inspector-input`, `.inspector-textarea` — bg-primary fill, border-primary.

### Color Swatches (EXISTING)
`.swatch` — 24px circles, scale(1.15) on hover.

---

## 7. Overlays

### 7.1 Context Menu — TWO SYSTEMS

**Legacy** (overlays.css): `.overlay-menu`, `.menu-option` — fixed position, `--menu-bg`, radius-lg.
**v3 Engine** (editor-prosemirror.css): `.rga-context-menu`, `.ctx-item`, `.ctx-submenu` — different class names, different structure (uses `<ul>`/`<li>`), different hover treatment.

**Contradiction:** Two independent context menu systems with different styling.

### 7.2 Command Palette (EXISTING)
`.overlay-palette`, `.palette-dialog` — 540px wide, fuzzy search, `mark` highlight.

### 7.3 Tag Highlights (EXISTING)
`.tag-highlight[data-tag-type="X"]` — inline bg + 2px bottom border. 10 types + custom.

### 7.4 Mark Info Popups (NEW)
`.rga-mark-info-popup` — 260px fixed popup with colour dot + label + action buttons.
`.rga-annotation-popup`, `.rga-tag-popup`, `.rga-revision-popup` — 240px fixed popups with form fields.

### 7.5 Toasts (EXISTING)
`.toast-container` — fixed bottom-right, reverse column. Slide-in/out animations.

### 7.6 Dialogs (EXISTING + NEW)
`.dialog-backdrop` + `.dialog` — custom tag dialog (380px).
`.modal-overlay` + `.modal-dialog` — unsaved changes, page setup. **Separate system from `.dialog`.**

### 7.7 Find Bar (EXISTING — CSS only)
`.find-bar` — absolute top-right of editor. No JS implementation found.

### 7.8 Color Popover (NEW)
`.format-color-popover` — fixed, 4×N grid of swatches. Used by format toolbar.

### 7.9 Top Menu Dropdown (NEW)
`.topmenu-dropdown` — fixed, grid-based items with check + label + shortcut columns.

---

## 8. Format Toolbar (NEW)

`#format-toolbar` — 36px strip above editor. Buttons: B, I, U, S, Color, Highlight, Link, Clear, block-type dropdown. Hidden in Draft view.

---

## 9. Scene Toolbox (NEW, MODIFIED)

`#scene-toolbox.scene-toolbox-vertical` — 88px wide, absolute-positioned (V1 T4 fix, was sticky). Anchored to editor-area's top-right. Contains block-type select + action buttons (Note, Flag, Tag). `.disabled` state at 0.35 opacity. Mirrors in RTL.

---

## 10. Page Surface (NEW)

`.rga-page` — the paper sheet. 8.5in × 11in default, `--editor-page-bg` fill, `--editor-page-shadow`. Width/height/padding set inline by `page-surface.js` from `doc.settings.pageSetup`.

`.rga-page-break` — desk-strip between pages (16px in Print, 1px dashed in Flow).

---

## 11. Empty States

| Location | Class | Content | Status |
|---|---|---|---|
| Editor (no doc) | `.editor-empty-state` | Icon + title + New/Open buttons + recent files | NEW |
| Inspector | `.inspector-empty` | Icon + title + help line | NEW (V1) |
| Notes panel (no scene) | `.notes-empty-state` | "Select a scene to add notes." | NEW (V1) |
| Scene Navigator | `.rga-shell-scene-navigator-empty` | Centred muted text | NEW (V1) |
| Annotations list | `.annot-empty` | Italic muted text | NEW |
| Revision flags list | `.flags-empty` | Italic muted text | NEW |

### Contradiction
Empty states use **four different layout patterns**: centred flex column (inspector, editor), hidden-textarea sibling (notes), inline text (annotations, flags), padded block (navigator). Should consolidate to one or two patterns.

---

## 12. V3 Scene Chrome (NEW)

`.rga-scene-v3` — left border `--accent-rwanga` (3px), left padding 0.75in.
`.rga-scene-v3-num` — non-editable badge, uppercase, secondary text.
`.rga-scene-heading-v3` — flex row with setting picker + em-dash + time picker + slash + location content. Bottom border `--accent-rwanga` (2px).
Pickers blend into text (transparent bg, border only on hover/focus).

---

## 13. Print Sheet (NEW)

`.rga-page-sheet` — 8.5in × 11in, white bg, `color: #111`, Courier New 12pt, 1.0 line-height. Fixed dimensions (Rule 6 — never content-recalculated). Sheet numbers, headers via absolute-positioned pseudo-elements.

End of component audit.
