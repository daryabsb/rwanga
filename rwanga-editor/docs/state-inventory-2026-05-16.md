# Rwanga Script Editor — State Inventory
**Date:** 2026-05-16
**Purpose:** Complete current-state inventory for safe architecture decisions. Describes reality only — no redesign, no fixes, no speculation.

---

## 1. Project Overview

**Name:** Rwanga Script Editor
**License:** Apache 2.0
**Version:** `0.1.0-alpha.0` (per `package.json`)
**Maturity:** Sub-project A v0.1 alpha — early-stage prototype; not yet shipped to users.

**Mission (from README + package.json):** A professional, structured screenplay editor purpose-built for Kurdish and Arabic cinema. Open-source. Targets a region (MENA) where screenplay standardization has been missing.

**Platforms:**
- Electron desktop app for Windows + macOS (current focus).
- Web version planned via a "Rwanga platform" backend (sub-project B); the renderer is structured to be platform-portable via a `window.rwanga.*` bridge contract.
- iOS/Android not in scope at this stage.

**Main current goals:**
- VS Code-style desktop editing experience.
- Persisted to a structured `.rga` JSON format.
- File-sovereign workflow (files live on disk; no required sign-in).
- Real screenplay typography (Courier 12pt, industry margins).
- Multi-language support (English LTR; Kurdish, Arabic RTL — schema and constants ready, runtime UI mostly English).

**Out of scope at this stage:** sync to a cloud platform, sign-in, AI-assisted writing, real-time collaboration, PDF export (planned for a later phase), iOS/Android.

---

## 2. Tech Stack

### Runtime
- **Electron 31.x** desktop shell.
- **Node.js 20+** required for build/dev.

### Editor engine
- **ProseMirror** as the content model (NOT a pre-built editor framework like Tiptap or Lexical). Direct PM usage:
  - `prosemirror-state` 1.4.3
  - `prosemirror-view` 1.32.7
  - `prosemirror-model` 1.19.4
  - `prosemirror-keymap` 1.2.2
  - `prosemirror-commands` 1.5.2
  - `prosemirror-history` 1.3.2
  - `prosemirror-inputrules` 1.4.0
  - `prosemirror-schema-basic` 1.2.2
  - `prosemirror-schema-list` 1.3.0
- ProseMirror is bundled via esbuild into `renderer/js/editor/bundle.js` and exposed as `window.RgaProseMirror.*`.

### Build tooling
- **esbuild 0.28.0** for bundling the PM dependencies into the renderer.
- **node --test** for unit tests (no Jest/Mocha).
- **jsdom 24.0.0** for DOM-dependent unit tests.
- **Playwright 1.45.0** for end-to-end tests (configured, currently no tests in `tests/integration/`).
- **electron-builder 25.0.0** for packaging Windows NSIS + macOS dmg/zip.
- **pdf-parse 1.1.1** as a devDependency (not currently used at runtime).

### Frontend
- **Vanilla HTML/CSS/JS prototype** — no React/Vue/Svelte. The renderer is plain `index.html` + plain script files loaded in dependency order via `<script>` tags.
- **State management:** no library. Plain module-level state in IIFEs attached to `window.Rga.*`.
- **Cross-platform bridge:** `window.rwanga.*` namespace. Currently implemented by Electron preload (`electron/preload.js`); a future web bridge will implement the same contract.

### Storage
- Files written as JSON (`.rga` files) to local disk via Electron's `fs`.
- No database.
- LocalStorage used for: session restoration (open tabs), recent-files list.

### Packaging
- `electron-builder` configured via `electron-builder.yml`.
- Targets: Windows x64 NSIS, macOS dmg+zip.

### Auto-update
- `electron-updater 6.2.0` dependency present. Strategy documented in memory (`project-ide-auto-update-strategy.md`); not yet wired in code.

### No third-party UI library
- No Bootstrap, Tailwind, MUI, etc. All styling is hand-written CSS.
- Icons: custom SVG sprite (`renderer/js/icons.js`).

---

## 3. Repository Structure

```
rwanga-editor/
├── package.json
├── electron-builder.yml
├── README.md
├── LICENSE
├── docs/                                 # Project docs (this report, prior reports, deferred-settings spec)
├── electron/
│   ├── main.js                           # Main process entry
│   ├── preload.js                        # Bridge implementation (window.rwanga.*)
│   ├── menu.js                           # OS menu (File, Edit, View, etc.)
│   ├── bridge/
│   │   ├── files.js                      # File I/O IPC handlers
│   │   └── window-controls.js            # Min/max/close handlers
│   └── lib/
│       ├── json-file.js                  # Atomic JSON read/write
│       └── paths.js                      # Workspace path resolution
├── i18n/
│   └── vocabulary.xlsx                   # (user-managed translation source — untracked)
├── renderer/
│   ├── index.html                        # Single-page shell; loads all scripts + inits
│   ├── fonts/                            # Courier Prime + Noto Sans Arabic (vendored)
│   ├── css/
│   │   ├── tokens.css                    # Theme tokens (dark + [data-theme="light"])
│   │   ├── reset.css                     # CSS reset
│   │   ├── shell.css                     # App shell layout (sidebar / tabs / panels)
│   │   ├── components.css                # Buttons, menus, dialogs, badges
│   │   ├── overlays.css                  # Modals, popovers, palettes
│   │   ├── editor.css                    # Editor container chrome
│   │   └── editor-prosemirror.css        # ProseMirror surface + screenplay node styles (LARGEST file)
│   └── js/
│       ├── constants.js                  # Rga.Constants (paper sizes, languages, vocab defaults)
│       ├── doc.js                        # Rga.Doc — in-memory doc model + serialize/deserialize/migrate
│       ├── file-manager.js               # Rga.FileManager — save / save-as / open
│       ├── tab-manager.js                # Rga.TabManager — open docs + active tab + session restore
│       ├── app-shell.js                  # Sidebar, bottom panel, menu, keyboard registry, status bar
│       ├── view-mode.js                  # Flow / Print / Draft mode toggle
│       ├── units.js                      # in/cm/mm/px conversion + format
│       ├── flow-chrome.js                # Line gutter, character tinting, doc-title CSS var
│       ├── format-toolbar.js             # Format toolbar + Scene toolbox
│       ├── icons.js                      # SVG icon injection
│       ├── utils.js                      # Generic helpers
│       ├── editor/
│       │   ├── bundle-entry.js           # esbuild input; re-exports PM as window.RgaProseMirror
│       │   ├── bundle.js                 # built PM bundle (13k+ lines, generated)
│       │   ├── mount.js                  # PM EditorView mount, outer schema, plugin wiring
│       │   ├── page-surface.js           # Inline page-size styles from doc.settings.pageSetup
│       │   ├── page-setup-dialog.js      # Page Setup modal
│       │   └── shortcuts.js              # Editor keyboard shortcuts
│       ├── framework/
│       │   ├── doc-type-registry.js      # Rga.DocTypes.register/get/has
│       │   └── base-outer-marks.js       # Shared marks across doc-types (bold/italic/.../annotation/tag/revisionFlag)
│       └── doc-types/
│           └── screenplay/
│               ├── index.js              # Registers the screenplay doc-type config
│               ├── outer-schema-additions.js   # sceneFrame atom node
│               ├── scene-frame-placeholder.js  # v1 NodeView (vanilla contenteditable per block)
│               ├── scene-frame-pm.js           # v2 NodeView (nested ProseMirror per block) ←ACTIVE on playground
│               ├── scene-frame-node-view.js    # F2 attempted alt NodeView (kept on disk, not loaded)
│               ├── inner-schema.js             # F2 inner schema (on disk, not used)
│               ├── inner-keymap.js             # F2 inner keymap (on disk, not used)
│               ├── inner-scene-line-node-view.js # F2 slug NodeView (on disk, not used)
│               ├── inner-zone-key-plugin.js    # F2 zone-key plugin (on disk, not used)
│               ├── plugins/
│               │   ├── context-menu.js         # Right-click custom menu
│               │   ├── annotations.js          # Annotation mark + click popup
│               │   ├── annotation-notes.js     # Notes panel (bottom panel)
│               │   ├── tags.js                 # Tag mark + tag popup + tag registry ops
│               │   ├── revision-flags.js       # Flag mark + flag popup + flags panel
│               │   └── paginator-renderer.js   # Stupid PageMap consumer (current paginator)
│               ├── layout/
│               │   ├── profiles.js             # LayoutProfile builders (Letter, A4, fromPageSetup)
│               │   ├── wrap.js                 # wrapText(text, columnWidth) → line count
│               │   ├── normalizer.js           # PM doc → NormalizedBlock[]
│               │   └── engine.js               # NormalizedBlock[] + profile → PageMap
│               └── archived/
│                   ├── page-breaks-v1.js       # Estimate engine (archived)
│                   └── paginator-v2-measurement.js   # Measurement engine (archived)
├── scripts/
│   └── build-renderer.js                       # esbuild driver
└── tests/
    ├── fixtures/                               # .rga sample files (sample-the-last-light + playground + v1/v2.x test fixtures)
    └── unit/                                   # 192 unit tests across schema, doc, layout, plugins, etc.
```

### Code volume (lines)
- **PM bundle (generated):** 13,669 lines
- **CSS (handwritten):** ~3,300 lines (editor-prosemirror.css is largest at 1,784)
- **JS app shell + frameworks (handwritten):** ~3,800 lines
- **Screenplay doc-type code:** ~4,856 lines
- **Total handwritten:** ~22,000 lines
- **Unit tests:** 192 passing (24 test files)

### Module responsibilities summary
- `electron/` — main process (file I/O, OS integration, menu, packaging)
- `renderer/css/` — all styling; theme tokens drive light/dark
- `renderer/js/` (top level) — app shell + non-screenplay-specific runtime
- `renderer/js/editor/` — PM mount + outer schema + supporting editor chrome
- `renderer/js/framework/` — doc-type registry + base marks (shared across doc-types)
- `renderer/js/doc-types/screenplay/` — everything screenplay-specific
  - top level: outer schema additions + NodeViews
  - `plugins/` — PM plugins for marks, menus, panels, pagination renderer
  - `layout/` — pure-function layout engine (no DOM)
  - `archived/` — replaced code kept for reference

---

## 4. Document Architecture

### Outer ProseMirror schema (from `editor/mount.js` baseOuterNodes + `framework/base-outer-marks.js` + `doc-types/screenplay/outer-schema-additions.js`)

```
doc
├── titleStrip?    (optional, content: text*, attrs: { removable })
└── body           (content: block*)
```

**Outer block group (any can appear in `body`):**
- `paragraph` (content: `inline*`) — treatment paragraphs
- `heading` (attrs: `level: 1|2|3`) — treatment headings
- `blockquote` (content: `inline*`)
- `bulletList` / `orderedList` / `listItem`
- `horizontalRule`
- `pageBreak` (attrs: `manual`) — manually inserted page break (not used by current paginator)
- `sceneFrame` (atom, attrs: `id`, `number`, `headingStyle`, `innerDoc`) — defined in `outer-schema-additions.js`

**Inline group:** `text`

**Marks (12 total, from `base-outer-marks.js`):**
- `bold`, `italic`, `underline`, `strikethrough` — pure toggle marks
- `color` (attrs: `value`) — foreground color
- `highlight` (attrs: `value`) — background color
- `fontFamily` / `fontSize` (attrs: `value`)
- `link` (attrs: `href`, `title`)
- `annotation` (attrs: `id`, `text`, `color`, `createdAt`, `author`, `status`) — note mark
- `tag` (attrs: `tagType`, `entityId`) — production breakdown tag
- `revisionFlag` (attrs: `id`, `reason`, `color`, `createdAt`, `status`) — revision flag

Mark exclusion rules: `annotation` excludes `tag` and `revisionFlag`; `tag` excludes `annotation` and `revisionFlag`; `revisionFlag` excludes `annotation` and `tag` (they are mutually exclusive on the same range).

### sceneFrame (atom) — the screenplay unit

Each scene is an atom node in the outer PM doc. Its `attrs.innerDoc` stores the scene's content as a serialized JSON tree (not parsed as PM by the outer schema). Structure:

```js
{
  type: 'doc',
  attrs: { notes: '', revisionFlag: null },
  content: [
    { type: 'sceneLine', attrs: { setting, time }, content: [{type:'text', text:LOCATION}] },
    { type: 'action', content: [...] },
    { type: 'character', content: [...] },
    { type: 'dialogue', content: [...] },
    { type: 'parenthetical', content: [...] },
    { type: 'shot', content: [...] },
    { type: 'transition', content: [...] }
  ]
}
```

Inner block types: `sceneLine` (slug), `action`, `character`, `dialogue`, `parenthetical`, `shot`, `transition`, `inlineFreeText`.

### Doc-level model (from `doc.js`)

```js
{
  // System (not persisted)
  docId, handle, displayName, origin, dirty, lastSavedAt,
  // Persisted
  rgaVersion: '2.0',
  documentType: 'screenplay',
  metadata: {
    title, author, created, modified, version, revision_notes,
    language: 'en|ku|ar',
    production_type: 'feature|short|episode|music_video|commercial|untyped',
    genre, logline,
    useV2SceneFrame: <bool>           // OPT-IN flag for v2 NodeView (currently only set on playground fixture)
  },
  settings: {
    theme, font_size, font_family, show_scene_numbers, page_size,
    pageSetup: { paperSize: 'Letter|A4|Legal', margins: { top, right, bottom, left } },
    vocabulary: { settings: [...], times: [...], sceneWord },
    sceneHeadingStyle: 'twoLine|inline',
    units: 'in|cm|mm|px'
  },
  tagRegistry: {
    characters: [{ id, name, color }],
    props, wardrobe, locations, sfx, vfx, vehicles, animals, custom
  },
  flagLog: [{ id, flaggedText, color, hint, reason, resolvedAt }],
  exportSettings: { branding, letterhead_url, include_scene_numbers, include_revision_marks },
  runtime: { last_cursor, active_scene_id, ui_state },
  body: <PM Node>                     // set by tab-manager from emptyDoc() or nodeFromJSON()
}
```

File format = `JSON.stringify(fileObj, null, 2)`. Persisted fields use snake_case (`rga_version`, `document_type`, `tag_registry`, `flag_log`, `export_settings`); in-memory uses camelCase.

### Versioning + migration
- Current version: `2.0`
- Supported on load: `1.0`, `1.1`, `2.0`
- `doc.js` has migration paths: `_migrateScenesToFrames` (1.x → 2.0) and `_migrateSceneLineLocations`

---

## 5. Editor Architecture

### EditorView inventory
- **One outer ProseMirror EditorView** mounted once at app boot into `#editor` (the `.rga-page` div). Created by `Rga.Editor.mount(container, opts)` in `mount.js:159`.
- **Per-block inner ProseMirror EditorViews** mounted by `scene-frame-pm.js` inside each scene's NodeView. **Eager mount on first paint**: every `.rga-scene-block` div has its own inner EditorView. For the 5-scene playground, ~25–30 inner editors are alive simultaneously.
- Inner editor schema: `doc → paragraph+ → text` plus the 10 lifted marks (bold, italic, underline, strikethrough, color, highlight, link, annotation, tag, revisionFlag).

### NodeViews

| Schema node | NodeView | Status |
|---|---|---|
| `sceneFrame` | `scene-frame-placeholder.js` (v1) | LOCKED at commit `64e49140`; ACTIVE on every doc that doesn't opt into v2 (i.e., everything except `playground-the-last-light.rga`) |
| `sceneFrame` | `scene-frame-pm.js` (v2) | ACTIVE on docs with `metadata.useV2SceneFrame: true` (currently only the playground fixture) |
| `sceneFrame` | `scene-frame-node-view.js` (F2 alt) | NOT LOADED — kept on disk for reference; failed smoke test 2026-05-15 |
| All other outer nodes | (no NodeView — default rendering) | n/a |

The routing between v1 and v2 happens in `doc-types/screenplay/index.js` (`routeSceneFrameNodeView`) — checks `Rga.TabManager.activeDoc().metadata.useV2SceneFrame` per NodeView construction.

### Plugins (registered in `mount.js:189-217`)
- `prosemirror-history` (outer)
- `prosemirror-keymap` × 2: custom outer keymap (Mod-Z/Y, Mod-B/I, Mod-Enter for insertSceneFrame) + `baseKeymap`
- `contextMenuPlugin` — right-click menu (Cut/Copy/Paste, Add note, Tag as, Flag for revision)
- `annotationsPlugin` — handleClickOn for annotation marks (info popup)
- `tagsPlugin` — handleClickOn for tag marks
- `revisionFlagsPlugin` — handleClickOn for revisionFlag marks
- `paginatorRendererPlugin` — consumes PageMap from layout engine; emits Decoration.widget breaks

Inner-editor plugins (per inner view, from `scene-frame-pm.js`):
- `prosemirror-history` (per-block; scoped Ctrl+Z)
- `prosemirror-keymap`: Mod-Z/Y (with fallback to outer on inner-history-empty), Mod-B/I/U/Shift-X, Tab (FORWARD_TAB), Shift-Tab (BACKWARD_TAB), Enter (ENTER_NEXT + spawn-next-scene escalation), Mod-Enter (spawn next scene), Backspace (remove empty block + jump-to-prev)
- `baseKeymap`
- `contextMenuPlugin`, `annotationsPlugin`, `tagsPlugin`, `revisionFlagsPlugin` (same plugins as outer)
- character-cue autocomplete plugin (built inline; ArrowRight to confirm; reads `doc.tagRegistry.characters`)

### Commands
- `insertSceneFrame(schema)` — Mod-Enter in outer editor; creates new sceneFrame at cursor with `attrs.innerDoc: null`
- `toggleMark(...)` for each format mark
- `PM.undo` / `PM.redo`
- v2 NodeView prototype methods: `_changeBlockType`, `_insertBlockAfter`, `_removeBlock`, `_spawnNextScene`, `_dispatchInner`

### Menus / toolbars
- **Format toolbar** (`#format-toolbar`, app-level, above editor): Undo, Redo, Bold, Italic, Underline, Strikethrough, Color (popover), Highlight (popover), Link (dialog), Clear formatting. Hidden in Draft view.
- **Scene Toolbox** (`#scene-toolbox`, script-level, sticky to right of editor): Block-type dropdown (action/character/dialogue/...), ✎ Note button, ⚑ Flag button, Tag dropdown (character/prop/wardrobe/...). Disabled when focus isn't inside a scene frame.
- **Bottom panel** tabs: Scene (notes for current scene), Notes (annotation panel), Flags (revision-flag panel), Problems, Breakdown (tag registry table).
- **Inspector panel** (right side): placeholder — currently just shows "Select a tag or scene header to view details".
- **Status bar**: sync status, Scene N/N, Problems count, word count, page count, block-type indicator, view-mode pill (Flow/Print/Draft), units pill (in/cm/mm/px).
- **OS menu** (Electron): File (New/Open/Save/Save As/Recent), Edit, View (View mode, theme, dev tools), Window, Help.

### Keyboard system
- Two layers:
  - **`Rga.Keyboard`** in `app-shell.js` (lines 357+) — non-PM shortcuts registered via `K.register(key, mods, fn)`. Examples: Ctrl+Shift+P (palette), Ctrl+B (sidebar toggle), Ctrl+J (bottom panel toggle), Ctrl+Shift+T (theme), Ctrl+Shift+I (inspector), Ctrl+Shift+V (cycle view mode).
  - **PM keymaps** in each EditorView — Mod-Z/Y, Mod-B/I/U, Mod-Enter (outer), Enter/Tab/Backspace (inner).
- OS menu accelerators (CommandOrControl+S, etc.) come from `electron/menu.js`.

### Selection model
- Outer editor has its own PM selection (used for outer-only operations like Ctrl+Enter scene insertion, treatment-text editing).
- Each inner editor has its own PM selection.
- **Format toolbar's `_view()`** routes to the focused EditorView (outer OR currently-focused inner), via `_lastSceneBlock` cache populated by a global focusin listener. So selecting text in an inner editor and clicking Bold on the outer toolbar correctly bolds the inner content.

---

## 6. Feature Inventory

### Document lifecycle
| Feature | Status | Notes |
|---|---|---|
| New script | Done | File menu / Ctrl+N |
| Open from dialog | Done | File menu / Ctrl+O |
| Save (existing handle) | Done | Ctrl+S (via Electron menu accelerator) |
| Save As (pick new path) | Done | Ctrl+Shift+S |
| Recent files | Done | Stored in localStorage, surfaced in empty state + menu |
| Session restore (reopen prior tabs) | Done | localStorage `rga-session-tabs`, restored by `TabManager.bootSession` |
| Dirty indicator on tab | Done | ● prefix on tab name |
| Unsaved-changes prompt on close | Done | `Rga.Modal.showUnsaved` |
| Atomic JSON write | Done | `electron/lib/json-file.js` (temp-file pattern) |
| Migration v1.x → 2.0 | Done | `_migrateScenesToFrames`, `_migrateSceneLineLocations` |

### Editor surface — view modes
| Feature | Status | Notes |
|---|---|---|
| Flow view (continuous column) | Done — locked at commit `501a4b00` | 8.5in column, dark-pink slug underline, per-visual-line gutter |
| Print view (paper feel) | Partial / Broken | Page-break visual breaks scenes wrong (current critical problem — see §8) |
| Draft view (chrome hidden) | Done — locked at commit `6cb69e15` | All chrome stripped; Esc/X exits |
| Theme: dark / light toggle | Done | Ctrl+Shift+T; light mode CSS recently fixed for popups + panels |
| RTL support (Kurdish/Arabic) | Partial | Schema + constants support it; rendering CSS has `[dir="rtl"]` overrides; no runtime UI to toggle yet |

### Screenplay editing
| Feature | Status | Notes |
|---|---|---|
| sceneFrame v1 placeholder | Done — LOCKED at `64e49140` | Vanilla contenteditable per block; ACTIVE everywhere except playground |
| sceneFrame v2 nested PM | Done | Per-block PM editor; ACTIVE on `playground-the-last-light.rga` only |
| Slug picker (setting/time/location) | Done | Form controls in NodeView chrome |
| Block-type cycle (Tab/Shift-Tab) | Done | action ↔ character ↔ dialogue ↔ shot |
| Block-type dropdown (scene toolbox) | Done | Changes active block's type via NodeView ref |
| Enter creates next block per ENTER_NEXT | Done in v2 | Empty trailing block → spawns next scene (Mod-Enter or double-Enter) |
| Backspace at start of empty block | Done in v2 | Removes block, focuses prev |
| Trailing-empty pruning on blur | Done in v1; NOT in v2 | v2 still keeps empty trailing blocks |
| Scene number ("SCENE N") chrome | Done | Updated on doc changes |
| Transition picker (CUT/MIX/...) | Done | Bottom of every scene |
| Spawn next scene (Mod-Enter) | Done in v2 | New scene appears below current |
| Spawn-next-scene undo (Ctrl+Z from inner editor) | Done | Inner history first, falls through to outer history if empty |
| Seed empty action block on new scene | Done | Freshly spawned scene shows typeable action block (fixed today) |

### Formatting
| Feature | Status | Notes |
|---|---|---|
| Bold / Italic / Underline / Strikethrough | Done | Toolbar + Ctrl+B/I/U/Shift-X; works in outer + v2 inner |
| Color (popover) | Done | Toolbar; works in outer + v2 inner |
| Highlight (popover) | Done | Toolbar; works in outer + v2 inner |
| Link (dialog) | Done | Toolbar; works in outer + v2 inner |
| Clear formatting | Done | Toolbar button |
| Mark serialization through save/reload | Done | After today's read-path fix |

### Notes (annotations)
| Feature | Status | Notes |
|---|---|---|
| Add note from toolbar ✎ button | Done | Opens dialog; applies annotation mark |
| Add note from right-click menu | Done | `addNoteFromMenu` |
| Notes panel card list | Done | Bottom panel; lists notes from outer + every sceneFrame's innerDoc JSON |
| Click card preview → navigate to mark | Done | Scrolls to mark; brief blue flash |
| Resolve note → mark stays, highlight goes | Done | Adds RESOLVED badge to card; no strikethrough on text |
| Restore resolved note | Done | ↺ button on resolved card |
| Remove note entirely | Done | × button (panel + click popup) |
| Panel survives file close + reopen | Done | Walks attrs.innerDoc JSON to find marks |
| Orphan cards on file close | Done — fixed today | TabManager.closeTab fires editor.tabActivated for last tab |

### Tags (production breakdown)
| Feature | Status | Notes |
|---|---|---|
| Tag selection from Tag dropdown | Done | Adds tag mark + adds entity to tagRegistry |
| Tag from right-click menu | Done | Submenu per tag type |
| Character-cue autocomplete (ghost text → ArrowRight) | Done | Reads tagRegistry.characters; 2-char prefix; appends " →" hint |
| Auto-tag on blur if exact match | Done | "Tag as NALI?" popup near the typed name |
| Single tag color for character | Done | Replaced rainbow per-character tint with one tag-character color |
| Tagged-entity list in sidebar | NOT IMPLEMENTED | Deferred (memory: `project-inspector-tag-list-deferred`) |
| Breakdown panel | Partial | Table exists in HTML; population via tagRegistry not fully implemented |

### Revision flags
| Feature | Status | Notes |
|---|---|---|
| Flag selection from toolbar ⚑ button | Done | Opens rich popup (3 severities: Red/Yellow/Green + reason) |
| Flag from right-click menu | Done | Same rich popup |
| Flags panel card list | Done | Bottom panel; scans outer + innerDoc JSON |
| ✓ Accept (resolve, keep in log) | Done | Moves to "Resolved (N)" section below |
| × Remove (delete entirely) | Done | No log entry |
| Click flag in editor → info popup | Done | Edit/Remove buttons |

### Right-click context menu
| Feature | Status | Notes |
|---|---|---|
| Custom menu (replaces browser default) | Done | Cut/Copy/Paste + Add note / Tag as ▶ / Flag for revision + Open inspector |
| Works in outer editor (title/treatment) | Done |  |
| Works inside scene blocks (v2) | Done | contextMenuPlugin added to inner editors |
| Tag submenu | Done | Lists all tag types |

### Pagination / Print
| Feature | Status | Notes |
|---|---|---|
| V1 estimate engine | ARCHIVED | `archived/page-breaks-v1.js` — masked content via overlays |
| V2 measurement engine | ARCHIVED | `archived/paginator-v2-measurement.js` — wrong measurements, pages too short |
| V3 layout-engine + renderer | Partial / Broken | Engine is pure & 100% tested; renderer wired today; visual feels "doesn't respect page height" per user |
| Page Setup dialog | Done | `page-setup-dialog.js`; can change paper size + margins |
| Page surface inline styles | Done | `page-surface.js` writes width/min-height/padding from pageSetup |
| PDF export | NOT IMPLEMENTED | Planned for later phase |

### Toolbar / panels infrastructure
| Feature | Status | Notes |
|---|---|---|
| Tab bar (multi-tab) | Done | Tab close, drag-reorder NOT implemented |
| Sidebar | Done | Collapse via Ctrl+B |
| Bottom panel (Scene/Notes/Flags/Problems/Breakdown) | Done | Collapse via Ctrl+J |
| Inspector panel | Placeholder | Right side; renders generic "select a tag…" message |
| Command palette (Ctrl+Shift+P) | Done | `Rga.CommandPalette` |
| Status bar | Done | Per-segment items wired |

### Cross-platform / bundling
| Feature | Status | Notes |
|---|---|---|
| `window.rwanga.*` bridge contract | Done | Implemented in Electron preload |
| Web-platform bridge | NOT IMPLEMENTED | Planned for sub-project B |
| Auto-update via electron-updater | Dependency present; NOT WIRED | Strategy documented in memory |
| Code signing | NOT IMPLEMENTED | SignPath prep tracked in memory |

### Tests
| Suite | Count | Status |
|---|---|---|
| Unit tests (`node --test`) | 192 passing across 24 files | Green |
| E2E (`playwright`) | 0 tests in `tests/integration/` | Configured but empty |

---

## 7. Screenplay-Specific Rules

### Formatting rules (industry / from `layout/profiles.js`)
- Font: Courier Prime 12pt
- Letter: 8.5" × 11" page; 1" top/right/bottom margin; 1.5" left margin
- A4: 8.27" × 11.69"
- Line height: 6 lines per inch (Courier 12pt convention)

### Line-width rules (from `layout/profiles.js` widths — chars per line)
| Block type | Letter | A4 |
|---|---|---|
| action | 60 | 57 |
| dialogue | 35 | 35 |
| parenthetical | 28 | 28 |
| character (cue) | 30 | 30 |
| transition | 15 | 15 |
| sceneHeading | 60 | 57 |
| shot | 60 | 57 |
| treatmentParagraph | 60 | 57 |
| treatmentHeading | 60 | 57 |
| titleStrip | 60 | 57 |

### Page line budget
- Letter: 54 lines per page (= 9" usable × 6 lpi)
- A4: 58 lines per page (= 9.69" usable × 6 lpi)

### Scene rules
- Scene heading (slug) format: `SETTING LOCATION — TIME` (e.g., `INT. KAREN BEDROOM — DAY`)
- Setting picker options (configurable per doc.settings.vocabulary.settings): `INT.`, `EXT.`, `INT./EXT.`, `EXT./INT.`
- Time picker options: `DAY`, `NIGHT`, `CONTINUOUS`, `DUSK`, `DAWN`
- Transition options: `CUT`, `MIX`, `FADE IN`, `FADE OUT`, `DISSOLVE`, `MATCH CUT`, `SMASH CUT`, `JUMP CUT`
- Default transition: `CUT`
- "Scene" word configurable per doc (defaults: `SCENE`; doc.settings.vocabulary.sceneWord)

### Block-type cycle (Tab forward, Shift-Tab backward, defined in `scene-frame-pm.js` and `scene-frame-placeholder.js`)
```
action → character → dialogue → shot → action (wraps)
```
Transition is NOT in the cycle (it's structural at the bottom).

### Enter rules (ENTER_NEXT, defined in `scene-frame-pm.js`)
- `action → action`
- `character → dialogue`
- `dialogue → dialogue` (continued speech)
- `shot → action`
- `parenthetical → dialogue`
- `inlineFreeText → inlineFreeText`

### Empty-trailing-block escalation
- Press Enter on an empty trailing block (with at least one block above it) → spawn next scene.

### Keep-with-next
- `sceneHeading` (slug) keeps with the next block — engine pulls the pair together if the slug would otherwise orphan at page bottom.

### Runtime / page assumptions
- Industry convention: 1 page ≈ 1 minute of screen time.
- Engine treats each block's wrapped-line count as its page-budget cost.
- Blank line between blocks: 1 line cost (configurable in profile).
- v1 limitation: a single block longer than the page budget gets its own page and overflows the bottom (no `(MORE)` / `(CONT'D)` splitting yet — `split: false` always).

### Export rules
- PDF export: NOT IMPLEMENTED.
- The same layout engine + PageMap is intended to drive PDF export when it lands.
- Export settings exist (`doc.exportSettings`): branding, letterhead_url, include_scene_numbers, include_revision_marks — none of these are consumed yet.

---

## 8. Current Problems

### Problem 1 — Pagination doesn't visually respect page height (CURRENT, OPEN)

**Symptoms (user report 2026-05-16):**
- "the page is not treated as fixed heights, it feels fake"
- "on adding new text it resizes and on backspace it shrinks"
- "doesn't recognize page height, calculates space, whenever it sees space, it trims it and move to the next page"
- Earlier symptom report (V2 measurement era): each "page" held only one short scene (~250px); A4/Letter should hold ~864px.
- After V3 layout-engine landed: pages still don't visually behave like fixed paper sheets.

**Suspected causes (unconfirmed):**
- The `.rga-page` div has `min-height: 11in` but is a single continuous DOM element. Page boundaries are inserted as `Decoration.widget` flow elements (16px desk-strip), so content above and below them is part of the same physical column. The visual "page" therefore expands/shrinks with content; it's not a fixed-height paper sheet.
- The layout engine produces a deterministic PageMap (192/192 tests pass on the engine), but the renderer's output is just a `Decoration.widget` between blocks — there's no concept of "this section IS one page" enforced at the layout level.
- Net effect: the engine knows correct break positions, but the visualisation makes those breaks look like dividers within one tall sheet, not boundaries between separate sheets of paper.

**Failed attempts:**
1. **V1 estimate engine** (`archived/page-breaks-v1.js`): position-absolute overlay strips at fixed-pixel offsets. Masked content. Discarded.
2. **V2 measurement engine** (`archived/paginator-v2-measurement.js`): walked DOM after render, measured `getBoundingClientRect`, inserted flow-positioned breaks where cumulative height exceeded usable page area. Produced wrong page sizes (each scene → one page). Discarded after consultant review.
3. **V3 layout-engine + stupid renderer** (current): pure-function PageMap from screenplay structure (line counts per block type), renderer emits decoration widgets at the computed PM positions. Engine is correct; visual still doesn't read as "real pages" because the editor surface is still one tall column.

### Problem 2 — V2 NodeView not the default (not really a problem, more a state note)

The new v2 NodeView is opt-in via `metadata.useV2SceneFrame: true` and currently only the `playground-the-last-light.rga` fixture has the flag set. Every other doc (including `sample-the-last-light.rga`) still uses the v1 placeholder. Migration to v2-default is intentionally deferred until the layout/pagination is resolved.

### Problem 3 — Trailing-empty pruning not ported to v2

V1 had `_pruneTrailingEmpties` that ran on blur to remove empty trailing blocks. V2 doesn't have this; empty trailing blocks accumulate (especially after "spawn next scene" leaves an empty action behind).

### Problem 4 — Scene-toolbox dropdown for tags only shows categories (no entity list)

The dropdown shows the categories (Character / Prop / Location / etc.) but doesn't surface the actual tagged entities anywhere in the UI. The Inspector panel right side currently just says "Select a tag or scene header to view details." (Tracked in memory: `project-inspector-tag-list-deferred`.)

### Problem 5 — Format toolbar absent for v2 cross-block selections

The toolbar's `_view()` routes to the focused inner editor. Selecting text across two blocks (e.g., two adjacent dialogue blocks in the same scene) is impossible — each block is a separate PM EditorView with its own selection. Cross-block selection is a feature gap inherent to the per-block editor architecture.

### Problem 6 — Page navigation / table of pages

There is no per-page navigation (go to page 5). PageMap has the data; no UI consumes it yet.

---

## 9. Performance Inventory

### Editor count
- Outer: 1 ProseMirror EditorView per app boot.
- Inner: 1 EditorView per `.rga-scene-block` div, eagerly mounted on NodeView build (v2 only).
- For the 5-scene playground: ~25–30 inner editors simultaneously alive.
- For a hypothetical 80-scene feature script: ~400–500 inner editors if v2 is used throughout — untested at this scale.

### Render count
- Per keystroke in an inner editor: one inner-editor PM update + one outer-editor `setNodeMarkup` dispatch (the propagation path in `_dispatchInner`). Both fire NodeView updates.
- Per outer-editor change: `paginatorRendererPlugin` schedules a recompute (debounced 120ms). Recompute: `normalize(doc)` + `computePageMap(blocks, profile)` + DecorationSet diff.
- `Rga.FlowChrome.refresh` (line gutter + character tinting) debounced 120ms; observes the editor DOM via MutationObserver (childList/subtree/characterData only).

### Known bottlenecks
- **Eager inner-editor mount.** Currently OK at playground scale (~25 editors). Scaling concern at 80+ scenes is documented in `scene-frame-pm.js`'s comments — viewport-scoped mount/unmount (Step 4e) was the next planned mitigation; not implemented.
- **Pagination recompute on every doc change.** The engine is pure and fast (single-pass over the normalized block list); even for 100 scenes it should be sub-millisecond. Unverified at scale.
- **Save serialization.** `Rga.Doc.serialize` does a `JSON.stringify(fileObj, null, 2)`. For large scripts, the indentation adds bytes but cost is acceptable.
- **PM bundle size.** `bundle.js` is 13,669 lines (~370KB minified-equivalent before further minification). Loaded synchronously.

### Memory footprint
- Not profiled.
- Each inner editor holds: own state, own history, own plugin state, own DOM subtree. Not measured.
- Tag registry + flagLog grow with use; no size limits.

---

## 10. Architecture Decisions Already Locked

### Locked in memory + commit history

- **Screenplay framework** (slug Enter-flow, Tab cycle, Enter rules, transition picker, double-Enter scoping) — LOCKED at commit `64e49140` (v1 placeholder). The user has agreed to extend / replace this in v2; v2 NodeView mirrors all the same rules.
- **Flow view typography + chrome** — LOCKED at commit `501a4b00`. 8.5in column, dark-pink slug underline, Courier Prime 12pt, line-height 1.3, per-visual-line gutter, character tinting via tagRegistry (recently retired from rainbow → single tag color).
- **Print + Draft views** — LOCKED at commit `6cb69e15`. Print: paper feel, soft shadow, page-break gap visual; Draft: all chrome hidden, Esc/X exits.
- **F2 NO-GO** — Eager nested-EditorView attempt failed smoke test 2026-05-15. Next attempt (v2 nested-PM in `scene-frame-pm.js`) succeeded; that's the current v2.

### Locked principles (per memory)

- **IDE files sovereign:** files live on disk; offline-first; sync is backup, not storage.
- **Save vs export:** Save is `.rga` only. Export to PDF/DOCX/TXT/MD is a separate verb, always carries Rwanga branding.
- **Renderer is platform-portable:** same renderer runs in Electron desktop AND a future Rwanga web editor. `.rga` must parse server-side too.
- **production_type unified** across IDE `.rga` metadata + Platform Project model.
- **No silent disk bloat:** cache management UI required for autosave/workspace/prefs.
- **OSS / fence at network boundary:** runtime never sign-in-gated.
- **AI assists, never authors:** no "write the story for me"; only options/critiques/alternatives.

### Under discussion (not yet committed in code)

- Pagination architecture — three approaches tried; current V3 doesn't visually satisfy "real pages" requirement; rethink in progress.
- V2 NodeView default — when to flip the playground-only flag to global default.
- Viewport-scoped inner-editor mount — design notional, not implemented.
- (MORE) / (CONT'D) split logic — placeholder field `split: false` exists in PageMap; logic deferred.

---

## 11. Screenshots

*This section needs the user to attach screenshots. Suggested set:*

- Flow mode (with a multi-scene playground doc open, character tinting visible)
- Print mode (current state showing the page-break visual issue)
- Draft mode (all chrome hidden)
- Scene editing (cursor inside an inner editor with the format toolbar visible)
- Notes panel (with one open + one resolved annotation card)
- Flags panel (with at least one accepted flag in the log)
- Tag autocomplete (the " →" ghost text in a character cue block)
- "Tag as NALI?" popup (positioned next to a typed character name)
- Scene-toolbox vertical palette (with the block-type dropdown showing)
- File menu / OS menu (showing the Save / Save As accelerators)
- Empty state (no document open)

---

*End of inventory. Last commit at time of writing: `d1c5f915` (fix: seed empty action block on freshly spawned scenes). 192/192 unit tests pass.*
