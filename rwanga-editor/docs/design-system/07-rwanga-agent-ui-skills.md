# Rwanga — Agent / UI Skills

Status: **FORENSIC EXTRACTION** — 2026-05-17
Source: `renderer/js/shell/`, `renderer/js/framework/`, `renderer/js/app-shell.js`

"Skills" = what the shell and framework know how to do as autonomous subsystems.
Each skill is a self-contained capability with a defined API and state ownership.

---

## 1. Panel Registration & Switching (EXISTING — Slice 1)

**Owner:** `Rga.Shell.Sidebar`

Panels self-register at load time via IIFE. The sidebar maintains an ordered registry. The ActivityRail renders from this registry.

### Registered Panels

| Panel ID | Label | Group | Icon (Lucide) | Shortcut | File |
|---|---|---|---|---|---|
| `sceneNavigator` | Scene Navigator | Top | `list-tree` (TBD) | `Cmd+Shift+S` | `panels/scene-navigator.js` |
| `scriptWorkspace` | Script Workspace | Top | `folder-open` (TBD) | `Cmd+Shift+E` | `panels/script-workspace.js` |
| `outline` | Outline | Top | `align-left` (TBD) | `Cmd+Shift+O` | `panels/outline.js` |
| `search` | Search | Top | `search` (TBD) | `Cmd+Shift+F` | `panels/search.js` |
| `characters` | Characters | Middle | `users` (TBD) | `Cmd+Shift+C` | `panels/characters.js` |
| `revisions` | Revisions | Middle | `history` (TBD) | `Cmd+Shift+R` | `panels/revisions.js` |
| `settings` | Settings | Bottom | `settings` (TBD) | `Cmd+,` | `panels/settings.js` |

**Icon family not yet chosen** — governed by Activity Rail Doctrine OD-A. Currently using Lucide SVGs via `Rga.Icons.Lucide`.

### API
```js
Rga.Shell.Sidebar.register(controller)  // { id, label, icon, mount(el), unmount(), shortcut? }
Rga.Shell.Sidebar.activate(id)
Rga.Shell.Sidebar.deactivate()
Rga.Shell.Sidebar.current()             // → active panel id or null
Rga.Shell.Sidebar.registered()          // → ordered array of ids
Rga.Shell.Sidebar.getController(id)
Rga.Shell.Sidebar.onChange(fn)          // → unsubscribe()
```

---

## 2. Writer-Context Aggregation (EXISTING — Slice 2)

**Owner:** `Rga.ScriptSession`

Aggregates derived state from the editor into a single snapshot for shell consumers (status bar, title bar, panels).

### Snapshot Shape
```js
{
  currentScene: { sceneNumber, heading, sceneId },
  currentPage:  { number, total },
  currentBlockType: 'action' | 'character' | 'dialogue' | ...,
  currentView: 'flow' | 'draft' | 'printPreview',
  wordCount: Number,
  activeScript: { title, path, dirty }
}
```

### API
```js
Rga.ScriptSession.init()
Rga.ScriptSession.get()        // → snapshot
Rga.ScriptSession.subscribe(fn) // → unsubscribe()
```

---

## 3. Shell Layout State (EXISTING — Slice 1)

**Owner:** `Rga.Shell.Layout`

See Layout System doc §8. Single in-memory container for zone visibility/dimensions.

### Skill: Layout Persistence
`toJSON()` / `fromJSON(snap)` support serialization for workspace file. Disk wiring deferred to Slice 4.

---

## 4. Scene Navigation (EXISTING — multiple owners)

### Scene Navigator Panel
`panels/scene-navigator.js` — subscribes to ScriptSession, renders grid rows from NavigationIndex data.

### NavigationIndex (Framework)
`framework/nav-index.js` (20KB) — pure doc-state derived index. Computes scene numbers, page assignments, headings. Emits PM decorations consumed by NodeViews. Builds the index plugin that hands scene numbers to SceneNodeView.

### API
```js
Rga.Nav.buildIndexPlugin()           // → PM Plugin
Rga.Nav.readNumberFromDecorations(d) // → number | null
```

---

## 5. Document Outline (EXISTING)

**Owner:** `framework/document-outline.js`

Builds a hierarchical outline from the PM doc structure. Consumed by the Outline panel.

---

## 6. View Mode Management (EXISTING)

**Owner:** `Rga.ViewManager` (referenced in status-bar.js and editor-prosemirror.css)

### Modes
| Mode | Trigger | Body Class | Container Class |
|---|---|---|---|
| Flow | Default / cycle | — | `.view-flow` |
| Draft | Cycle / shortcut | `body.view-draft-active` | `.view-draft` |
| Print Preview | Cycle | `body.view-print-preview-active` | — |

### API
```js
Rga.ViewManager.current()      // → 'flow' | 'draft' | 'printPreview'
Rga.ViewManager.activate(mode) // applies classes, triggers re-render
```

---

## 7. Pagination Engine (EXISTING — Framework)

**Owner:** `framework/pagemap-engine.js` + `framework/layout-profile.js`

Computes page boundaries from document structure without DOM measurement. Emits page-break decorations and page-marker widgets.

### Pipeline
```
PM Doc → Normalizer → LayoutProfile → PageMap → RenderModel → (decorations | PrintRenderer)
```

### Related Files
- `framework/screenplay-normalizer.js` — normalizes doc for pagination
- `framework/render-model.js` — transforms PageMap into renderable chunks
- `framework/print-renderer.js` — paints `.rga-page-sheet` elements
- `framework/print-preview.js` — orchestrates print preview overlay

---

## 8. Theme Management (EXISTING — Legacy)

**Owner:** `Rga.Theme` in `app-shell.js`

```js
Rga.Theme.init()    // reads localStorage, applies
Rga.Theme.toggle()  // dark ↔ light
Rga.Theme.apply(t)  // sets data-theme, persists
```

V1.1 added a titlebar action button that calls `Rga.Theme.toggle()`.

---

## 9. File Operations (EXISTING — Electron Bridge)

**Owner:** `renderer/js/file-manager.js` + `electron/bridge/files.js`

### Capabilities
- New document (blank v3 template)
- Open `.rga` file (triggers migration if v1/v2)
- Save / Save As
- Recent files list
- Autosave (debounced: 2s default, 10s max interval)

### Electron IPC
```js
window.rgaBridge.files.showOpenDialog()
window.rgaBridge.files.showSaveDialog(defaultName)
window.rgaBridge.files.readFile(path)
window.rgaBridge.files.writeFile(path, content)
window.rgaBridge.files.getRecentFiles()
```

---

## 10. Format Toolbar (EXISTING)

**Owner:** `renderer/js/format-toolbar.js` (18KB)

Builds the `#format-toolbar` strip. Buttons for: block-type dropdown, B, I, U, S, text colour, highlight, link, clear formatting, annotation, revision flag.

Dispatches PM transactions for mark toggle/application. Color popover for text/highlight colours.

---

## 11. Toast Notifications (EXISTING — Legacy)

**Owner:** `Rga.Toast` in `app-shell.js`

```js
Rga.Toast.show(message, type, duration)
// type: 'success' | 'error' | 'warning' | 'info'
// duration: ms (default 3000)
```

Creates `.toast` elements in `.toast-container` (fixed bottom-right). Auto-dismiss with slide-out animation.

---

## 12. Command Palette (EXISTING — Legacy)

**Owner:** `Rga.CommandPalette` in `app-shell.js`

Triggered by `Ctrl+Shift+P`. Fuzzy-search across registered commands. Arrow key navigation. Enter to execute.

---

## 13. Tab Management (EXISTING — Legacy + evolving)

**Owner:** `Rga.Tabs` (legacy) / `Rga.TabManager` (newer, referenced by status-bar)

Manages editor tabs: create, switch, close. Dirty state tracking. Per-tab editor state serialization.

`Rga.TabManager.activeDoc()` returns the current document object (consumed by status bar for language, by NodeViews for vocabulary).

---

## 14. Skills NOT YET Implemented (from design kit / specs)

| Skill | Design Kit Status | Production Status |
|---|---|---|
| **Rwanga Sync** | Sidebar panel with login UI | **Placeholder only** — no backend |
| **Extensions** | Sidebar panel with Pro badges | **Placeholder only** — no runtime |
| **Export PDF** | Spec'd in implementation plan | **Not implemented** — print-preview exists but no PDF generation |
| **Export DOCX** | Spec'd | **Not implemented** |
| **i18n runtime** | `t()` function, locale loading | **Not implemented** — vocabulary CSV exists, no `t()` function |
| **MCP Server** | Extension card | **Not implemented** |
| **Collaboration** | Spec'd for Max tier | **Not implemented** |

---

## 15. Skill Dependency Graph

```
Rga.Shell.Layout ← Rga.Shell.Sidebar ← Rga.Shell.ActivityRail
                 ← Rga.Shell.StatusBar
                 ← Rga.Shell.TitleBar

Rga.ScriptSession ← Rga.Shell.StatusBar (scene, page, blockType, words)
                   ← Rga.Shell.TitleBar (script name, dirty)
                   ← Scene Navigator panel

Rga.TabManager ← File Manager
               ← Shell StatusBar (language)
               ← Editor Mount

Rga.Nav (NavigationIndex) ← Scene NodeView (decorations)
                          ← Scene Navigator panel
                          ← Pagemap Engine

Rga.ViewManager ← Shell StatusBar (view mode)
                ← Format Toolbar (visibility)
                ← Scene Toolbox (visibility)
                ← Print Preview
```

End of agent/UI skills audit.
