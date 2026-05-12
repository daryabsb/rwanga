# Rwanga Script Editor — Sub-Project A Design Spec
## File Operations & Editor Finish (v0.1)

**Date:** 2026-05-12
**Status:** Design spec for sub-project A of the Rwanga Script Editor (RSE). Approved through Section 6 in brainstorming session of 2026-05-12. Implementation plan to follow.
**Sub-project series:** A (this doc) → B (Account & Sync) → C (Extensions) → D (MCP Server) → E (Dataset pipeline).
**Builds on:** `rwanga_script_editor_design_kit/library/` (existing ~7,100-line vanilla HTML/CSS/JS prototype), `rwanga_script_editor_design_kit/specs/01-Implementation-Plan.md`, `rwanga_script_editor_design_kit/specs/02-Build-Instructions.md`, `rwanga_script_editor_design_kit/specs/03-Component-Library.md`.
**Supersedes (for scope decisions):** `docs/RWANGA-EDITOR-DESIGN-PROPOSAL.md` (outdated — Electron/Vue/HTMX framing dropped), `rwanga_script_editor_design_kit/uploads/Rwanga_Editor_Implementation_Spec.md` (HTMX-from-server framing dropped).

---

## Preamble — what sub-project A delivers

Sub-project A wraps the existing browser-renderable prototype in an Electron desktop app and adds the file-handling, persistence, and packaging features required to ship a self-contained v0.1 of the Rwanga Script Editor.

After sub-project A ships:
- A user can install the desktop app, write a screenplay using the structured `.rga` format, save and re-open files from disk, export to PDF, and use the app fully offline without ever creating an account.
- The renderer is structured so the same code can later run inside a Rwanga platform web page (sub-project B's web editor) without rewriting renderer logic.
- The `.rga` schema is stable and ready for the platform to parse server-side.

What sub-project A does **not** deliver: sign-in, sync, account-bound projects, AI extensions, MCP server, dataset capture, DOCX/TXT/MD export, multi-window, in-folder search, file-tree CRUD. Each has its own follow-up spec.

---

## Cross-cutting principles (apply to every section)

These come from the brainstorming dialogue and are durable architectural primitives. The implementation plan must honor them.

1. **IDE is a real IDE — files sovereign.** Files live on the user's disk where the user puts them. The IDE never gates features behind sign-in. Works fully offline. (Memory: `project_ide_files_sovereign_principle.md`.)

2. **Save vs. Export.** Save writes only `.rga`. Export is a separate verb producing flat formats. Free tier ships **PDF only** (the only format with non-strippable Rwanga branding). DOCX/TXT/MD are Pro-tier and deferred. Export architecture is pluggable so adding formats later is a registration, not a rewrite. (Memory: `project_ide_save_vs_export.md`.)

3. **Renderer is platform-portable.** The renderer never branches on platform. It calls `window.rwanga.*`. The Electron preload bridge implements this contract today; a Django web bridge will implement the same contract for the platform's in-browser editor. The `.rga` file is pure JSON and must parse natively in Python on the platform side. (Memory: `project_ide_renderer_portable.md`.)

4. **Production-type enum is unified.** `metadata.production_type` in `.rga` and `Project.project_type` on the platform share one canonical set. Adding a value updates both. (Memory: `project_unified_production_types.md`.)

5. **No silent disk bloat.** Every cache the app maintains is inspectable and clearable through a Cache Management UI. Total disk usage is shown. Confirmation prompts on destructive actions. (Memory: `project_ide_no_silent_disk_bloat.md`.)

6. **Auto-update from day one.** The app ships with `electron-updater` wired up. Phase 1 (pre-stable) installs silently on quit, no user prompt. Phase 2 (post-stable) is a config flag flip to prompted updates. (Memory: `project_ide_auto_update_strategy.md`.)

7. **IDE is open source (Apache 2.0).** The full source ships in a public repository under a permissive license. The moat is server-side (Rwanga platform API, auth, AI services, dataset, brand), not in the IDE code. The OSS code may freely include sign-in flows, platform communications, dataset-capture logic, MCP scaffolding, and special features — none of which is useful to a forker without access to Rwanga's servers. Pro-tier features (sub-project B+) are server-gated, not delivered as a closed-source binary fork. (Memory: `project_ide_oss_strategy.md`.)

8. **No CDN.** All fonts, icons, and assets are vendored locally. The prototype currently violates this (Google Fonts in `index.html:9`); sub-project A fixes it. (Memory: `feedback_local_assets_only.md`.)

9. **Single source of truth for shared state.** Theme, language, defaults — one canonical store per concern. No silent dual-state.

10. **No secrets in source.** API keys, signing certs, training-data credentials — loaded from environment variables or fetched per-user at runtime. The OSS repo never contains usable credentials.

---

## Section 1 — Architectural frame

### 1.1 Today vs. after sub-project A

**Today:** The prototype is a static HTML page (`rwanga_script_editor_design_kit/library/index.html`) that runs in any browser. It has a sample script that auto-loads on every refresh. No persistence beyond theme + script-language preferences in `localStorage`. No file I/O. No Electron shell.

**After sub-project A:** An Electron desktop app installable on Windows and macOS. The same renderer code, lightly modified for multi-document support, runs inside a `BrowserWindow`. File operations, OS dialogs, autosave, workspace state, and PDF export are handled by the Electron main process via a cross-platform IPC contract.

### 1.2 Process split

Standard Electron architecture (`nodeIntegration: false`, `contextIsolation: true`):

```
src/rwanga-editor/
├── electron/
│   ├── main.js              ← Main process: window, menu, dialogs, FS, IPC handlers, autosave timer, workspace state
│   ├── preload.js           ← Context-isolated bridge: exposes window.rwanga.* to renderer
│   └── updater.js           ← electron-updater wiring (Phase 1 silent mode)
├── renderer/
│   └── (extends rwanga_script_editor_design_kit/library/)
│       ├── index.html       ← App shell (existing, with Google Fonts CDN removed)
│       ├── css/             ← Existing (tokens, reset, shell, editor, components, overlays)
│       ├── js/              ← Existing + new modules
│       └── fonts/           ← NEW: locally vendored Courier Prime, Noto fonts
├── build/                   ← electron-builder config + artifacts
├── tests/
│   ├── unit/                ← Pure-JS unit suites (node:test)
│   └── integration/         ← Electron integration suites (Playwright)
└── package.json
```

The renderer does **all UI**. The main process does **all I/O**. They communicate via the typed `window.rwanga.*` API. The renderer code never imports Node.js modules.

### 1.3 Repository placement

For sub-project A, the editor source lives in `src/rwanga-editor/` as a subdirectory of the existing `api-rwanga` repository. This avoids the cost of a mid-development repo migration. After sub-project A's implementation is complete, the editor will move to its own repository (`rwanga-editor`); auto-update endpoints will be reconfigured at that point.

GitHub Releases for auto-update artifacts publish to the current repo during sub-project A. Tags use the `editor-vX.Y.Z` prefix to distinguish from platform releases. electron-updater is configured to filter releases by this tag prefix.

### 1.4 The Document abstraction

The renderer thinks in terms of `Document` objects, not file paths.

```
Document {
  docId:        opaque session-local ID (used for autosave/recovery)
  handle:       opaque platform-specific identity (file path on Electron, server ID on web, null for Untitled)
  displayName:  string (e.g., "The Last Light.rga" or "Untitled 1")
  origin:       'disk' | 'untitled' | 'remote'
  body:         { /* the .rga JSON object */ }
  dirty:        boolean
  lastSavedAt:  timestamp or null
}
```

Every tab references a Document. Documents are independent instances with full lifecycles — switching tabs swaps the active document; closing a tab destroys its document. The number of concurrent Documents is bounded only by RAM. The renderer never inspects the shape of `handle` — it is opaque, which is what makes the same renderer drop into the web context unchanged.

### 1.5 Why this shape

- **Electron security.** `nodeIntegration: false` + `contextIsolation: true` is the only safe configuration for an Electron app that opens user files. The preload bridge is the renderer's only path to I/O.
- **Web portability.** Sub-project B will reuse the same renderer inside a Django-served page. Only the bridge swaps. If the renderer branched on platform, this portability would die.
- **Cross-platform `.rga` parsing.** Pure JSON. Python's `json.loads()` reads it directly. No Electron-specific paths or OS-specific values inside the file.
- **Multi-document by design.** The prototype's existing modules (`SceneManager`, `TagSystem`, `Problems`) currently assume a single global editor state. Sub-project A refactors them to be document-scoped — significant surgery but bounded; the algorithms don't change, only the state container.

---

## Section 2 — Components & the cross-platform IO contract

### 2.1 The `window.rwanga.*` API surface

This is the contract every platform implements. Electron implements it today via the preload bridge + main-process IPC; the future Django web bridge implements it via fetch.

All methods are `async` (Promise-returning). All paths/handles are opaque strings. All file contents are passed as JSON strings (for `.rga`) or buffers (for binary like PDF).

#### `window.rwanga.files`

| Method | Returns | Notes |
|---|---|---|
| `pickOpen(filters?)` | `{handle, displayName, content}` or `null` | OS open dialog. `filters: {rga: true, drafts: true}`. |
| `pickFolder()` | `{handle, displayName, tree}` or `null` | OS folder dialog. `tree` is the recursive listing. |
| `read(handle)` | `{displayName, content}` | Read by handle. |
| `save(handle, content)` | `{handle, savedAt}` | Write to existing handle. |
| `pickSaveAs(suggestedName, content)` | `{handle, displayName, savedAt}` or `null` | OS save dialog (filter: `.rga` only) + write. |
| `listFolder(handle)` | `tree` | Re-read folder contents. |
| `stat(handle)` | `{exists, mtime, size}` or `null` | Used for external-mutation detection on Save. |

#### `window.rwanga.recent`

| Method | Returns | Notes |
|---|---|---|
| `list()` | `[{handle, displayName, openedAt}, ...]` | Up to 10 entries. |
| `touch(handle, displayName)` | `void` | Bump or insert; called on every open/save. |
| `clear()` | `void` | User-triggered via Cache Management. |

#### `window.rwanga.autosave`

| Method | Returns | Notes |
|---|---|---|
| `write(docId, content)` | `void` | Side-file backup. |
| `discard(docId)` | `void` | Called on successful explicit Save. |
| `scanOrphans()` | `[{docId, content, lastSeenAt, sourceHandle?, displayName}, ...]` | Boot recovery. |

#### `window.rwanga.workspace`

| Method | Returns | Notes |
|---|---|---|
| `read()` | full workspace object | Boot. |
| `write(state)` | `void` | Full write, debounced 1s. |

#### `window.rwanga.prefs`

| Method | Returns | Notes |
|---|---|---|
| `read()` | full preferences object | |
| `write(partial)` | updated preferences | Merge partial into existing. |

#### `window.rwanga.export`

| Method | Returns | Notes |
|---|---|---|
| `toPDF(content, options)` | `{handle, displayName}` | `options: {watermark: 'rwanga', paperSize: 'Letter' | 'A4'}`. Free tier always includes watermark. |

#### `window.rwanga.storage` (Cache Management)

| Method | Returns | Notes |
|---|---|---|
| `getReport()` | `[{name, location, sizeBytes, entryCount, oldestEntry, newestEntry}, ...]` | All caches. |
| `openDataFolder()` | `void` | Opens OS file browser at `<userData>`. |
| `clearAutosaves(opts?)` | `void` | `opts.olderThanDays?` |
| `clearAutosaveEntry(docId)` | `void` | |
| `clearRecentFiles()` | `void` | |
| `resetWorkspace()` | `void` | |
| `resetPreferences()` | `void` | |
| `clearCorruptBackups(kind)` | `void` | `kind: 'workspace' | 'preferences'` |
| `clearPendingUpdate()` | `void` | Cancels a downloaded but uninstalled update. |

#### `window.rwanga.updates`

| Method | Returns | Notes |
|---|---|---|
| `getStatus()` | `{state, currentVersion, availableVersion?}` | `state: 'idle' | 'checking' | 'downloading' | 'ready'` |
| `checkNow()` | `void` | Manual trigger. |
| `restartAndInstall()` | `void` | For the "restart now" pill. |

#### `window.rwanga.window` (Electron-only; no-ops on web)

| Method | Notes |
|---|---|
| `minimize()` | Wired to existing custom title bar buttons. |
| `maximize()` | |
| `close()` | Triggers dirty-tabs prompt. |
| `setTitle(title)` | "● Script.rga — Rwanga" with dirty indicator. |

### 2.2 Electron main process responsibilities

The main process implements every method above on top of Node:

| Concern | Implementation |
|---|---|
| `files.*` | `fs.promises` + Electron's `dialog` module |
| `recent.*` | JSON file in `app.getPath('userData')` |
| `autosave.*` | Side files in `app.getPath('userData')/autosave/` + manifest.json |
| `workspace.*` | JSON file in `app.getPath('userData')` |
| `prefs.*` | JSON file in `app.getPath('userData')` |
| `export.toPDF` | Hidden `BrowserWindow` loads a print-optimized URL; `webContents.printToPDF()` + watermark composition |
| `storage.*` | Filesystem walk + size aggregation across the caches above |
| `updates.*` | `electron-updater` wrapper |
| `window.*` | Direct BrowserWindow API |

Main process also owns:
- **Application menu** (File / Edit / View / Script / Tags / Export / Help). The prototype's HTML menu bar is decorative; the real OS menu lives here.
- **App lifecycle**: single-instance lock, dirty-tabs prompt on quit, `before-quit` → `autoUpdater.quitAndInstall()` if update pending.
- **File-association handling**: drag-drop `.rga` onto app icon → open in existing window if running, else launch.

### 2.3 Renderer modules — new vs. modified

**New files** (added to `renderer/js/`):

| File | Job |
|---|---|
| `doc.js` | `Document` factory, dirty-tracking, serialization helpers |
| `file-manager.js` | Coordinates `window.rwanga.files.*` with `doc.js` and tab-manager |
| `inspector.js` | Renders Inspector content (tag props / scene meta) on selection |
| `autosave-client.js` | Debounced write loop; orphan recovery flow on boot |
| `workspace.js` | Boot restore + persist on tab/folder/window change |
| `export-client.js` | Renderer-side trigger for PDF export |
| `metadata-strip.js` | Inline header strip with language/production-type/author/genre fields |
| `cache-management.js` | Storage dialog UI |
| `welcome-view.js` | First-launch / empty-workspace landing |
| `update-pill.js` | Status bar indicator when an update is downloaded and pending install |

**Modified files** (under `renderer/js/`):

| File | Change |
|---|---|
| `tab-manager.js` (currently inline as `Rga.Tabs` in `app-shell.js`) | Extract + rewrite: each tab owns a `Document`; switching tabs swaps editor content via display:none preservation |
| `editor-engine.js` | Emit dirty signals on every mutation; expose `loadDocument(doc)` / `exportDocument()` |
| `app-shell.js` (boot block) | New boot sequence (Section 3 Flow G): no auto-load-sample; restore workspace + autosave recovery |
| `scene-manager.js` / `tag-system.js` / `problems.js` | Refactor from global singletons to per-document instances |
| `sample-data.js` | Demote to "Load Sample Script" command palette item and Welcome-view CTA; no longer auto-loads |
| `index.html` | Remove Google Fonts CDN link; reference local `fonts/` |

### 2.4 The Document-scoped refactor

This is the single biggest piece of implementation work in sub-project A. The prototype's `SceneManager`, `TagSystem`, `Problems`, and `SceneNotesConnector` are global singletons holding state for one editor. Multi-tab requires each tab's Document to own its scene list, tag registry, problems, and notes.

The algorithms don't change. Only the state container does:

- **Before:** `Rga.SceneManager.updateNavigator()` reads from `document` (the DOM) and `Rga.SceneManager.scenes` (a module-level array).
- **After:** `Rga.SceneManager.forDoc(doc).updateNavigator()` reads from `doc.body.scenes` and renders into a doc-specific DOM container that's part of the active tab.

Or alternatively (simpler):

- **After (chosen):** Singleton modules accept the active `Document` as an argument. They no longer hold state; the Document holds state. The singletons hold algorithms.

The "algorithms-only singletons + state-on-Document" pattern is the simpler refactor and aligns with the prototype's existing functional style. Implementation plan should pick this path.

---

## Section 3 — Data flow & schema

### 3.1 The four data stores

| Store | Lives at | Owner | Persisted when |
|---|---|---|---|
| `.rga` file | wherever user saves | user | on Save / Save As |
| `preferences.json` | `<userData>/preferences.json` (Electron); user account (web, sub-project B) | app, per-user | on settings change, debounced |
| `workspace.json` | `<userData>/workspace.json` (Electron); user account (web, B) | app, per-user | on tab/folder/window change, debounced 1s |
| `autosave/*.bak` + `manifest.json` | `<userData>/autosave/` (Electron); server backup endpoint (web, B) | app, per-session | on edit, debounced 2s, max 10s between writes during sustained typing |

### 3.2 `.rga` schema v1.1

Building on v1.0 from `01-Implementation-Plan.md` §3.2. Additions only:

```json
{
  "rga_version": "1.1",
  "metadata": {
    "title": "Untitled Script",
    "author": "Writer Name",
    "created": "2026-05-12T10:00:00Z",
    "modified": "2026-05-12T14:30:00Z",
    "version": 1,
    "revision_notes": "",
    "language": "en",
    "production_type": "short",
    "genre": "",
    "logline": ""
  },
  "settings": { "/* unchanged from v1.0 */": null },
  "scenes": [ "/* unchanged from v1.0 */" ],
  "tag_registry": { "/* unchanged from v1.0 */": null },
  "export_settings": { "/* unchanged from v1.0 */": null },
  "runtime": {
    "last_cursor": {
      "scene_id": "scene-uuid-001",
      "element_id": "el-uuid-003",
      "offset": 17
    },
    "ui_state": {
      "inspector_open": true,
      "bottom_panel_tab": "notes",
      "bottom_panel_height": 200,
      "sidebar_panel": "scenes"
    }
  }
}
```

**Additions:**
- `metadata.production_type` — new field, enum below.
- `runtime` block — entire block is new.

**`metadata.production_type` enum** (aligned to current `src/projects/forms.py` PROJECT_TYPE_CHOICES):

| Value | Kurdish label | Notes |
|---|---|---|
| `feature` | فیلمی درێژ | |
| `short` | فیلمی کورت | |
| `episode` | ئەپیۆدی تەلەفزیۆن | |
| `music_video` | ڤیدیۆی گۆرانی | |
| `commercial` | ڕیکلام | |
| `untyped` | (IDE-only fallback) | Default for new docs. Platform treats as "needs classification." |

**`runtime` block lifecycle:**
- Always preserved on Save (re-opening restores cursor + UI state).
- **Stripped at Pro-tier export time** (PDF/DOCX recipients don't need the author's session state).
- **Stripped at platform upload** in sub-project B (server stores the document, not the editor session).
- Django parser ignores it; only reads `metadata` / `settings` / `scenes` / `tag_registry`.

**Version-bump strategy:**
- Minor bumps (1.0 → 1.1) for additive changes.
- Renderer accepts any minor version ≤ current build (forward-compat).
- Renderer accepts older minor versions with backfill (`production_type` → `untyped`, missing `runtime` → none).
- Major bumps (2.0) reserved for breaking changes; not anticipated in sub-project A or B.

### 3.3 `preferences.json` schema

```json
{
  "version": 1,
  "defaults": {
    "language": "en",
    "production_type": "short",
    "author": "Darya Ibrahim",
    "genre": null
  },
  "ui": {
    "theme": "dark",
    "font_size": 12,
    "show_welcome_on_empty": true
  },
  "behavior": {
    "autosave_enabled": true,
    "autosave_debounce_ms": 2000,
    "recent_files_max": 10
  }
}
```

Theme migrates from `localStorage` to here on first boot of v0.1 (one-time migration).

### 3.4 `workspace.json` schema

```json
{
  "version": 1,
  "session_id": "uuid-of-current-session",
  "last_folder": {
    "handle": "/Users/darya/Scripts/SeptemberProject",
    "displayName": "SeptemberProject"
  },
  "open_tabs": [
    {
      "handle": "/Users/darya/Scripts/SeptemberProject/draft-3.rga",
      "displayName": "draft-3.rga",
      "isUntitled": false,
      "isActive": true
    },
    {
      "handle": null,
      "displayName": "Untitled 2",
      "isUntitled": true,
      "isActive": false,
      "untitledDocId": "untitled-session-uuid"
    }
  ],
  "window_bounds": {
    "x": 100, "y": 80, "width": 1440, "height": 900, "maximized": false
  },
  "recent_files": [
    { "handle": "/Users/darya/.../foo.rga", "displayName": "foo.rga", "openedAt": "..." }
  ],
  "flags": {
    "has_seen_welcome": true
  }
}
```

Recent files live here (not in `preferences.json`) because they change on every open/save; separating write streams reduces lock contention.

### 3.5 Autosave manifest

```
<userData>/autosave/
├── manifest.json
├── untitled-session-uuid.bak
├── draft-3-doc-uuid.bak
└── ...
```

```json
{
  "version": 1,
  "session_id": "session-uuid-of-current-process",
  "entries": {
    "untitled-session-uuid": {
      "isUntitled": true,
      "displayName": "Untitled 2",
      "sourceHandle": null,
      "lastWriteAt": "2026-05-12T14:42:18Z"
    },
    "draft-3-doc-uuid": {
      "isUntitled": false,
      "displayName": "draft-3.rga",
      "sourceHandle": "/Users/darya/Scripts/SeptemberProject/draft-3.rga",
      "lastWriteAt": "2026-05-12T14:42:30Z"
    }
  }
}
```

On boot, `scanOrphans()` returns entries with `session_id` different from the current process — those are crash candidates.

### 3.6 Critical flows

**Flow A — Open File**

1. User: `File → Open` or `Ctrl+O`.
2. `window.rwanga.files.pickOpen({rga: true, drafts: true})`.
3. Bridge returns `{handle, displayName, content}` or `null`.
4. Parse `content` as JSON; validate `rga_version` (accept `1.0` / `1.1`).
5. Create `Document(handle, displayName, parsedBody)`; assign a fresh `docId`.
6. Add to tabs list; switch active tab.
7. EditorEngine loads `doc.body.scenes` into the writing surface (constructs DOM blocks).
8. SceneManager / TagSystem / Problems re-bind to the new document.
9. Inspector renders selection (or empty state).
10. If `doc.body.runtime.last_cursor` present, restore cursor.
11. `window.rwanga.recent.touch(handle, displayName)`.
12. Schedule `workspace.write` (debounced).

**Flow B — Edit (per mutation)**

1. EditorEngine emits a mutation event for the active document.
2. `doc.markDirty()`.
3. Tab dirty indicator (●) updates.
4. SceneManager / TagSystem / Problems update incrementally.
5. Inspector refreshes if selection is affected.
6. Autosave-client debounces 2s → on fire: serialize `doc.body` (including `runtime`) → `window.rwanga.autosave.write(doc.docId, json)`.
7. Workspace-write debounces 1s → on fire: persist tabs/folder/window state.

**Flow C — Save**

1. User: `Ctrl+S`.
2. If `doc.handle === null` (Untitled) → redirect to Save As flow.
3. Else: serialize `doc.body` to JSON.
4. `window.rwanga.files.save(doc.handle, json)`.
5. On success: `doc.dirty = false`, `doc.lastSavedAt = response.savedAt`.
6. Tab indicator clears.
7. `window.rwanga.autosave.discard(doc.docId)`.
8. `window.rwanga.window.setTitle(doc.displayName + " — Rwanga")`.

**Flow D — Save As**

1. User: `Ctrl+Shift+S` (or `Ctrl+S` on Untitled).
2. Serialize `doc.body`.
3. `window.rwanga.files.pickSaveAs(doc.displayName, json)` — bridge shows save dialog filtered to `.rga` only.
4. On cancel: no-op.
5. On confirm: bridge writes; returns `{handle, displayName, savedAt}`.
6. Doc rebinds to new handle; tab title updates.
7. Same tail as Flow C (discard autosave, touch recent, set title).

**Flow E — Close Tab**

1. User: ✕ on tab or `Ctrl+W`.
2. If `doc.dirty`: prompt `[Save] [Don't Save] [Cancel]`.
3. Save → Flow C, then continue.
4. Don't Save → `window.rwanga.autosave.discard(doc.docId)`.
5. Cancel → no-op.
6. Remove tab; switch to neighbor; `workspace.write` (debounced).

**Flow F — Quit App**

1. User: `Cmd/Ctrl+Q` or window close.
2. Find all dirty docs.
3. If 0: persist workspace; if a downloaded update is pending → `autoUpdater.quitAndInstall()` else `app.quit()`.
4. If 1: single-tab prompt (Flow E).
5. If 2+: combined prompt `[Save All] [Discard All] [Cancel]` with a disclosure listing the dirty tabs.

**Flow G — Boot**

1. Read `preferences.json` (or seed defaults).
2. Read `workspace.json` (or seed defaults).
3. Apply window bounds (Electron).
4. `orphans = await window.rwanga.autosave.scanOrphans()`.
5. If orphans → recovery dialog (per-entry [Recover] / [Discard]).
6. Restore open tabs from `workspace.open_tabs`: for each, `files.read(handle)`, recreate Document.
7. If 0 tabs after restore AND `flags.has_seen_welcome === false` → show Welcome view.
8. Apply `last_folder` to Explorer panel.
9. Wire commands + shortcuts (existing + new).
10. Status bar init.
11. Kick off `window.rwanga.updates.checkNow()` in background.

**Flow H — Inspector Selection**

1. User clicks tagged text or scene header (or metadata strip — see Flow I).
2. EditorEngine emits selection event `{type, ref}`.
3. Inspector reads from `activeDoc.body.tag_registry` or `activeDoc.body.scenes[i]`.
4. Renders editable form (tag color/name/notes, or scene number/INT-EXT/location/time/notes).
5. User edits → writes back to `doc.body` → `doc.markDirty()` → cascades to Flow B.

**Flow I — Inline metadata header strip**

1. New tab created (Untitled or Open).
2. Header strip renders at top of editor, bound to `doc.body.metadata`.
3. User edits a field (e.g., Language) → `doc.body.metadata.language = "ku"` → `doc.markDirty()`.
4. "Set as default" affordance on each field → `window.rwanga.prefs.write({ defaults: { language: "ku" } })`.
5. Strip can be collapsed to single-line summary (`▾ Untitled Script — Lang: English`).

**Flow J — External mutation detection (Save-time only)**

1. Just before `files.save`, renderer calls `files.stat(handle)` to get current mtime.
2. Compare with `doc.lastSavedAt + tolerance`.
3. If mtime is newer → prompt `[Overwrite] [Reload (lose unsaved)] [Cancel]` with default focus on `[Cancel]`.

**Flow K — Crash recovery**

1. Triggered by Flow G step 4 (orphans found).
2. Recovery dialog lists each orphan: displayName, sourceHandle (or "Untitled"), lastWriteAt, size, [Recover] / [Discard] / [Show content (read-only)].
3. Recover → opens as Untitled tab with the recovered content. Never auto-overwrites source.
4. Discard → delete the `.bak` file and remove from manifest.
5. Bulk: `[Recover All]` / `[Discard All]` shortcuts in dialog footer.

### 3.7 Picked defaults (flag in implementation plan if they need to change)

- `rga_version` accepted range: `1.0`, `1.1` (current); future builds extend upward.
- `runtime` lives inside `.rga` (not a sidecar) for portability across machines.
- `recent_files` lives in `workspace.json` not `preferences.json`.
- Quit-with-multiple-dirty UX: combined Save All / Discard All / Cancel prompt.
- Crash recovery always opens as Untitled (never auto-overwrites source).
- Autosave: debounced 2s after last edit, max 10s between writes during sustained typing.
- Workspace-write: debounced 1s.
- Recent files: capped at 10 entries.

---

## Section 4 — Caching, errors & edge cases

### 4.1 Caching layers

Seven caches exist in sub-project A. Each has a stated invalidation rule.

| # | Cache | Lives | Invalidation rule |
|---|---|---|---|
| 1 | Document in-memory state (per tab) | renderer | Mutated on every edit; written to disk on Save; written to `.bak` on autosave |
| 2 | Editor DOM per tab | renderer | Created on tab open; preserved via `display:none` on tab switch; destroyed on tab close |
| 3 | Derived data (tag occurrences, scene maps, problems list) | renderer, per doc | Invalidated by edits; recomputed on demand. Coarse strategy in v0.1; fine-grained later. |
| 4 | Folder tree (Explorer) | renderer | Read once on Open Folder; explicit Refresh button or `Ctrl+R` to re-read. No filesystem watcher in v0.1. |
| 5 | Recent files list | renderer + `workspace.json` | Mutated on open/save; persisted debounced |
| 6 | Preferences | renderer + `preferences.json` | Mutated on settings change; persisted debounced |
| 7 | Workspace state | renderer + `workspace.json` | Mutated on tab/folder/window change; persisted debounced 1s |

**Non-decisions explicit:**
- No bridge-response cache for `files.read()`. Reads are infrequent; caching across the bridge complicates web-port correctness.
- No memory eviction. Open documents stay resident. Users open and close tabs as they like.

**Cache #2 chosen approach (`display:none` preservation across tab switches):** Memory cost ≈ 1–2 MB per typical tab; instant tab switching. Inactive DOM stays in the tree, hidden. Destroyed only on tab close.

### 4.2 Cache Management UI

**Entry points (v0.1):**
- `File menu → Manage Storage…`
- Command Palette: `Manage Storage`
- Status bar: small `💾 N MB` indicator (visible only when total ≥ 50 MB). Click opens the dialog.

(A user/settings menu doesn't exist in the prototype. It lands in A.1 with the Settings dialog; Cache Management surfaces there too at that point.)

**Dialog layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Storage                                                       [x]   │
├─────────────────────────────────────────────────────────────────────┤
│ Total: 47.3 MB                            [Open Data Folder]        │
│                                                                     │
│ Autosave backups                              42.1 MB    [Manage…]  │
│   12 files · oldest 2026-04-09 · 3 from current session             │
│                                                                     │
│ Recent files list                              <1 KB    [Clear]     │
│   10 entries                                                        │
│                                                                     │
│ Workspace state                                12 KB    [Reset]     │
│   Last folder: SeptemberProject · 2 tabs                            │
│                                                                     │
│ Workspace backups (corrupt-state)            4.8 MB    [Clear all]  │
│   2 backups · oldest 2026-03-22                                     │
│                                                                     │
│ Preferences                                    3 KB    [Reset]      │
│                                                                     │
│ Preferences backups                            <1 KB   [Clear all]  │
│                                                                     │
│ Update binary (pending install)              78 MB    [Clear]       │
│   Rwanga v0.2.1 — downloaded 2026-05-11                             │
│                                                                     │
│                                          [Close]                    │
└─────────────────────────────────────────────────────────────────────┘
```

`Manage…` on Autosave opens a sub-dialog listing every `.bak` with: source path or "Untitled", last write, size, per-row `[Recover]` / `[Delete]`, and footer `[Delete all stale (>30 days)]` / `[Delete all]`.

**Confirmation rules:**
- `Clear all autosaves` → confirm: *"This removes crash recovery for any unsaved work. Sure?"*
- `Reset workspace` → confirm: *"This forgets your open tabs and window position. Sure?"*
- `Reset preferences` → confirm: *"This resets language, theme, and other settings to defaults. Sure?"*
- Per-row autosave deletion: no confirm.

### 4.3 Error handling

**File system errors (Electron side)**

| Failure | Renderer behavior | User experience |
|---|---|---|
| Open: permission denied | Reject promise; show toast | Toast: "Can't open *foo.rga* — permission denied" |
| Open: file doesn't exist (stale recent) | Bridge returns `null`; renderer removes from recent | Toast: "File no longer exists at *path*; removed from Recent" |
| Save: permission denied | Tab stays dirty; modal | Modal: "Can't save *foo.rga* — permission denied. [Save As…] [Cancel]" |
| Save: disk full | Tab stays dirty; autosave keeps trying to .bak | Modal: "Disk full. Free space and retry, or [Save As…] to a different drive" |
| Save: path too long (Windows MAX_PATH) | Bridge raises; tab stays dirty | Modal: "Path too long for Windows. [Save As…] to a shorter path" |
| Autosave: any error | Silent retry 3× with backoff (500ms / 1s / 2s) | Status bar pill on sustained failure: "⚠ Autosave failed — click for details" |

**Bridge / IPC errors**

| Failure | Renderer behavior | User experience |
|---|---|---|
| Main process crashed | Renderer detects via IPC ping timeout; freezes file ops; banner | Top banner: "Critical: app needs to restart. Your last autosave is intact." [Restart] |
| IPC serialization error | Promise rejects with explanation | Toast + recovery suggestion |

**Corrupt or version-mismatched `.rga`**

| Failure | Renderer behavior | User experience |
|---|---|---|
| Invalid JSON | Reject open; offer fallback | Modal: "*foo.rga* is corrupt. [View as plain text (read-only)] [Cancel]" |
| Valid JSON, missing required fields | Reject open; offer best-effort | Modal: "*foo.rga* is missing required fields. [Open in recovery mode] [Cancel]" |
| `rga_version` newer than build supports | Reject open with clear message | Modal: "*foo.rga* was created with a newer Rwanga (v{ver}). Please update Rwanga." |
| `rga_version` `1.0` (current build is 1.1) | Open with backfill | Silent; metadata strip shows defaults |

**External mutation while file is open**

| Scenario | Renderer behavior | User experience |
|---|---|---|
| File mtime changed since we opened (detected on Save) | Prompt before overwrite | Modal: "*foo.rga* changed on disk since you opened it. [Overwrite] [Reload (lose unsaved)] [Cancel]" |
| File on disk deleted while open | Detect on next save attempt | Modal: "*foo.rga* no longer exists at original path. [Save As…] [Cancel]" |

Detection is **Save-time only** in v0.1; live filesystem watching is deferred.

**Stale caches**

| Cache | Stale scenario | Recovery |
|---|---|---|
| Folder tree | Files added/deleted externally | Manual `F5` / Refresh button on Explorer; auto-refresh on Open Folder |
| Recent files | Path no longer exists | On click: detect, remove silently, toast "File no longer at *path*" |
| Workspace tabs (boot) | One tab's file gone | Skip tab; boot toast "Could not restore *foo.rga* (file missing)" |
| Workspace tabs (boot) | One tab's file corrupt | Same as corrupt-`.rga` row above, during boot; user picks skip or recovery-mode |

**Crash recovery edges**

| Scenario | Renderer behavior |
|---|---|
| `.bak` itself corrupt | Skip silently; log; don't offer for this entry |
| `.bak` from session >30 days old | Show in recovery dialog labeled `Stale (30+ days old)`; offer Recover or Discard |
| User Discarded but wants it back | No undo — discarded `.bak`s are deleted |
| `.bak` source file no longer exists | Treat recovered content as Untitled; user must Save As |

**First-launch / no-state**

| Scenario | Renderer behavior |
|---|---|
| No `workspace.json` yet | Seed defaults; Welcome view |
| `workspace.json` corrupt | Backup it to `workspace.json.bad-{timestamp}`; seed fresh; toast |
| `preferences.json` corrupt | Backup it; seed fresh; toast |
| User clicks New Script before boot completes | Block UI until boot completes (loading splash); target <500ms |

### 4.4 Specific edge cases

- Multiple Untitled tabs on quit → combined Save All / Discard All prompt with disclosure listing them.
- Save As to existing path → OS save dialog handles the overwrite prompt natively; no second prompt.
- Large file open (50+ MB `.rga`) → spinner during parse; "still working" indicator if >3s; v0.1 does not paginate scenes.
- Drag-drop `.rga` onto app icon → main process intercepts; opens in existing window if running, else launches.
- Drag-drop `.rga` onto running window → opens as new tab.
- Drag-drop `.txt` / `.md` → draft-import flow.
- Drag-drop multiple files → opens all as tabs; focuses last.
- Drag-drop a folder → same as Open Folder; replaces current folder in Explorer.
- Locale switch mid-edit → UI strings only; doc content untouched; cursor preserved.
- Theme switch mid-edit → pure CSS swap; no risk.
- Inspector during metadata-strip focus → shows empty state (strip is not a scene/tag selection).

### 4.5 Picked defaults

- Cache #2: `display:none` preservation. Memory cost is small; UX much better.
- Filesystem watcher deferred.
- Autosave retry: 3 attempts with backoff (500ms / 1s / 2s) then status bar pill.
- mtime granularity: second-level.
- Recovery always opens as Untitled.
- 30-day-stale `.bak`s labeled in recovery dialog; not auto-purged. Manual `Clear All` available.

---

## Section 5 — Testing & verification

### 5.1 Test scope

| Subject | Test type | Why |
|---|---|---|
| `.rga` serializer + deserializer round-trip | Pure JS unit (node:test) | A round-trip bug corrupts user files silently. |
| Schema migration v1.0 → v1.1 | Pure JS unit | Backward-compat for existing user files. |
| Dirty-flag propagation | Pure JS unit | Wrong dirty flag = data loss. |
| `Document` instance isolation | Pure JS unit | Multi-tab correctness — tab 1 edits must not leak into tab 2. |
| Block-type cycling / Enter context-aware logic | DOM-based unit (jsdom) | Existing core feature; was the prototype's heart. |
| Boot sequence happy path | Electron integration (Playwright) | Full smoke. |
| Save / Save As / Open round-trip | Electron integration | Headline feature of A. |
| Autosave + crash recovery flow | Electron integration | Subtle; users only notice when it fails them. |
| PDF export contains script text + Rwanga watermark | Electron integration (parse output PDF) | Watermark presence is a product-policy invariant. |

5 pure-JS unit suites + 4 Electron integration suites.

### 5.2 Explicitly NOT in A

- Visual regression (no Percy/Chromatic).
- i18n correctness (deferred to A.1 or later).
- Performance benchmarks for large scripts.
- Multi-window.
- Filesystem watcher behavior.
- Web-bridge contract conformance (sub-project B's problem).

### 5.3 Tooling

| Layer | Tool | Reason |
|---|---|---|
| Pure-JS unit | `node:test` + `node:assert` | Zero deps; prototype is vanilla JS, no transpiler. |
| DOM-based unit | `jsdom` + `node:test` | Lightweight DOM simulation. |
| Electron integration | Playwright with Electron driver | De facto choice now Spectron is dead. |
| PDF parsing | `pdf-parse` or similar | Verify script text + watermark. |

### 5.4 Test seams in the code

- `Document` is a plain object factory, not coupled to a global. Tests instantiate freely.
- The serializer is a pure function: `serialize(doc.body) → string`; `deserialize(string) → body`.
- `window.rwanga.*` is injectable. In tests, replace the global with a mock bridge.
- EditorEngine emits events through a small bus, not a global broadcast. Tests subscribe and assert.
- The boot sequence is one function `boot()` that accepts an environment object (bridge, DOM root, initial workspace). Tests pass mocks.

### 5.5 Manual smoke checklist (release gate)

Walk through on Windows and macOS:

```
[ ] First launch on a clean machine shows the Welcome view
[ ] New Script opens a blank Untitled tab with the metadata strip
[ ] Type 10 lines, then Save As → file written to chosen path
[ ] Close app, relaunch → workspace restores, file reopened to last cursor
[ ] Open Folder → Explorer shows tree; click a .rga → opens as tab
[ ] Multi-tab: open 3 files, switch between them — each preserves scroll/cursor
[ ] Edit, wait 3s, kill Electron from Task Manager → relaunch → recovery prompt offers unsaved content
[ ] Export to PDF → file opens in OS PDF viewer; Rwanga watermark visible; screenplay formatting intact
[ ] Cache Management → Storage dialog shows correct totals; clearing autosaves works
[ ] Save As to a read-only folder → friendly error, tab stays dirty
[ ] Open a malformed .rga (hand-edited JSON) → recovery prompt; doesn't crash
[ ] Open a v1.0 .rga (created externally) → opens with backfilled production_type
[ ] Change Language in metadata strip, click "Set as default" → new docs default to that language
[ ] Quit with 2 dirty tabs → combined Save All / Discard All / Cancel prompt
[ ] Auto-update: simulate a newer release on GitHub Releases → app downloads silently; quit → app restarts on new version
```

15 checks. ~30 minutes per platform.

---

## Section 6 — Auto-update, packaging, source location

### 6.1 Auto-update

**Library:** `electron-updater` (from electron-builder ecosystem).

**Update server:** GitHub Releases on the current repo during sub-project A development. Tags follow `editor-vX.Y.Z` prefix; electron-updater filters releases by tag prefix. When the editor moves to its own repo post-A, the endpoint is reconfigured.

**Phase 1 — silent (default for v0.x releases):**

```
1. App launch → main.js initializes updater.js
2. autoUpdater.checkForUpdates() — silent HTTPS check
3. If newer version: autoUpdater.downloadUpdate() — background, no UI
4. On 'update-downloaded': set internal flag; emit IPC to renderer
5. Renderer optionally shows a small "Update v0.x.y ready — restart to apply" pill in status bar (dismissible, not modal)
6. On app quit: if flag set, autoUpdater.quitAndInstall() — installs, relaunches
7. Periodic check while running: every 4 hours
```

**Phase 2 — prompted:** Single config flag flip (`UPDATE_MODE = 'silent' | 'prompted'`). When `prompted`, the renderer pops a modal on `update-downloaded` with `[Install on next quit] [Remind me later] [Skip this version]`. Architecture unchanged.

**Cache Management entry:**
```
Update binary (pending install)              78 MB    [Clear]
   Rwanga v0.2.1 — downloaded 2026-05-11 (will install on next quit)
```
Clearing cancels the pending update; next launch re-downloads.

**Renderer awareness:** `window.rwanga.updates.{getStatus, checkNow, restartAndInstall}` — see Section 2.

### 6.2 Packaging

**Tool:** `electron-builder` (canonical, integrates with `electron-updater`).

**Targets in v0.1:**

| Platform | Format | Notes |
|---|---|---|
| Windows | NSIS installer (`.exe`) | per-user install (`oneClick: true, perMachine: false`) — no admin elevation needed for updates |
| macOS | `.dmg` + `.zip` | both required: `.dmg` for first install, `.zip` for auto-update delta |

**Linux is OUT of v0.1 scope.** AppImage packaging will be added in a later sub-project; v0.1 internal-development releases ship for Windows + macOS only.

**Build outputs hosted on GitHub Releases** with auto-update manifest files (`latest.yml` for Windows, `latest-mac.yml` for macOS) consumed by electron-updater.

### 6.3 Code signing — placeholder configuration

**Decision (user, 2026-05-12):** Defer signing decision; build the configuration scaffold so a real certificate can be plugged in later.

**Sub-project A implementation:**
- `electron-builder` config has signing slots (`win.certificateFile`, `mac.identity`, etc.) populated from environment variables.
- Environment variables are empty in development; builds produce unsigned artifacts.
- Documentation in the repo explains how to plug in a real certificate (Apple Developer ID for macOS, Azure Trusted Signing or traditional CA cert for Windows) without code changes.
- Internal/development builds are unsigned and acceptable for that purpose.
- Public release requires signing — that's a separate gate, not blocked by sub-project A.

**Reference (for when user decides):**
- **macOS** ($99/yr Apple Developer Program) — required at first install, not just auto-update. Gatekeeper rejects unsigned apps; notarization on top.
- **Windows** — multiple options:
  - **SignPath Foundation** ($0, **recommended given OSS status**): FREE EV-level code signing for qualifying open-source projects. Apply after the public repo is established and the project shows activity. Approval can take days to weeks.
  - **Azure Trusted Signing** (~$100/yr Standard for orgs): paid fallback if SignPath approval delays or denies. The user has an Azure admin account that likely qualifies.
  - Traditional CA OV (~$200/yr, slow SmartScreen warm-up) or EV (~$500/yr, instant trust).
- **Linux**: no OS-level signing requirement.
- Auto-update consistency: don't switch between signed and unsigned mid-release-stream.
- See memory: `project_ide_auto_update_strategy.md`.

### 6.4 Source location

Sub-project A's source lives at `src/rwanga-editor/` inside the current `api-rwanga` repository. After implementation completes, the editor moves to its own repository; auto-update endpoints reconfigure at that point.

This avoids the cost of mid-development repo migration while keeping the option open to extract later.

---

## Final scope summary

### What sub-project A v0.1 ships

```
Electron shell
  Main + preload + renderer separation (nodeIntegration: false, contextIsolation: true)
  Cross-platform window.rwanga.* IO contract
  OS-native dialogs (open, save, folder picker)
  OS application menu (File / Edit / View / Script / Tags / Export / Help)
  Single-window only
  Auto-update Phase 1 (silent install on quit, electron-updater + GitHub Releases)
  Drag-drop file/folder handling
  Custom title bar window controls wired to bridge

Documents & multi-tab
  Document = independent per-tab instance, full lifecycle
  Real multi-tab with display:none DOM preservation
  Dirty tracking + per-tab indicators
  Close prompts (Save / Don't Save / Cancel)
  Quit prompts (Save All / Discard All / Cancel for 2+ dirty)

File operations
  Open (.rga native + .txt / .md draft import)
  Open Folder (read once, manual refresh)
  Save / Save As (.rga only; OS file dialog filter enforced)
  New Script → blank Untitled tab + inline metadata header strip (no modal)
  Recent files (10 entries, in workspace.json)

Editor finish
  Inspector content (tag props + scene meta + empty state)
  Vendor fonts locally (kill Google Fonts CDN dependency)
  Sample script offered (Welcome CTA + Command Palette), never auto-loaded
  Welcome view on first launch / empty workspace
  Inline metadata header strip on every tab

.rga schema v1.1
  + metadata.production_type (5 unified values + 'untyped')
  + runtime { last_cursor, ui_state }
  Backward-compat read of v1.0

Resilience
  Side-file autosave (.bak + manifest.json) with debounced writes
  Crash recovery dialog on boot
  External mtime detection on Save
  Recovery always opens as Untitled (never auto-overwrites source)
  Corrupt workspace/preferences → backup-and-reseed

Workspace
  Restore last folder + open tabs + window bounds on launch
  preferences.json (defaults: language, production_type, author, genre)
  Theme migrated from localStorage to preferences.json

Export
  PDF only (Chromium printToPDF + Rwanga watermark composition)
  Pluggable export pipeline (DOCX / TXT / MD slots ready for sub-project B's Pro tier)

Cache Management
  Storage dialog reachable from File menu + Command Palette + status pill (≥50 MB)
  Per-cache: name, location, size, action
  Total disk usage prominent
  Confirmation prompts on destructive actions
  Pending update binary listed

Tests
  5 pure-JS unit suites + 4 Electron integration suites (Playwright)
  Manual smoke checklist (15 items, Windows + macOS)
```

### What sub-project A v0.1 does NOT ship (deferred targets)

| Deferred to | What |
|---|---|
| **A.1** (small follow-up) | DOCX / TXT / MD export (Pro tier hooks); Settings dialog (font size, default lang, autosave toggle); Find / Replace; File-tree CRUD (rename / delete / new); Filesystem watcher; per-folder `.rwanga/` settings; Welcome screen polish |
| **A.2** | Multi-window; i18n (KU / AR locales); RTL bidi correctness work; large-script performance |
| **Sub-project B** | Sign-in / sync; Pro-tier watermark strip; account-bound preferences; "Save to Rwanga" / "Open from Rwanga"; web bridge implementation of `window.rwanga.*`; Rwanga platform's "uploaded scripts" library; Django `.rga` parser endpoint |
| **Sub-project C** | AI extensions framework (install / configure / permission, manifest format, sandbox) |
| **Sub-project D** | MCP server (built-in, Pro) — tools, resources, auth, write-permission gating, multi-script discovery |
| **Sub-project E** | Dataset pipeline (consent UX, anonymization, training corpus upload, opt-out) |
| **Platform-side, separate ticket** | `Project.PROJECT_TYPE_CHOICES` (models.py) form/model alignment to forms.py (currently divergent — see memory `project_unified_production_types.md`) |
| **Public release gate** | Code signing certificates (Apple Developer + Windows signing — Azure Trusted Signing recommended) |
| **Future** | Helper bubble (contextual UX nudges), scene drag-to-reorder, in-editor revision history, plugin/theme system, live collaboration cursors |

---

## External decisions needed

These are not brainstorm questions; they're decisions to make at convenience between spec approval and implementation kickoff. The implementation plan reads from these.

| # | Decision | Status | Blocks |
|---|---|---|---|
| D1 | Linux support in v0.1 | ✅ **OUT** (decided 2026-05-12) | — |
| D2 | Code signing certificates | ⏳ Deferred; placeholder config in sub-project A. SignPath Foundation now the recommended Windows path given OSS status. | Public release only |
| D3 | Confirm `production_type` enum matches platform forms.py | ✅ Aligned (5 values + `untyped`) | — |
| D4 | Source code location | ✅ `src/rwanga-editor/` in current repo (decided 2026-05-12) | — |
| D5 | GitHub Releases org/repo for auto-update artifacts | ✅ Current repo, `editor-vX.Y.Z` tag prefix during A | — |
| D6 | App icon + branding assets | Pending — confirm reuse from platform's existing brand kit | Packaging step |

---

## Risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | Multi-tab refactor of `SceneManager` / `TagSystem` / `Problems` breaks subtle prototype behavior | Medium | Pure-JS unit tests on Document isolation; manual checklist catches the rest |
| R2 | Contenteditable RTL bidi handling regressions with mixed LTR/RTL (English tags in Kurdish action) | Medium-High | Deferred to A.2 but worth a manual canary test in A using a Kurdish sample |
| R3 | electron-updater on Windows per-user install nuances | Low | Standard `oneClick: true, perMachine: false` with electron-builder |
| R4 | PDF watermark stripping by determined users (PDF editing tools exist) | Low impact | Accepted risk. Free-tier protection is "casual stripping is annoying"; Pro tier is the real boundary |
| R5 | 50+ MB autosave folders surprise users | Low | Cache Management UI is the answer; status bar pill at ≥50 MB threshold |
| R6 | Schema drift between renderer (JS) and platform parser (Python, sub-project B) | Medium | Schema lives in a single doc; both consume from the same spec |
| R7 | Internal-only builds being distributed externally during development → users see unsigned-app warnings | Low | Internal builds clearly labeled; not publicly linked until D2 is decided |

---

## Future considerations (post-A, informational only)

- **Helper bubble** — contextual chatbot that points users to existing affordances ("To change language, look at the header of your file"). Post-launch UX layer.
- **Welcome → first-script tutorial** — interactive walkthrough; A.1 polish.
- **Plugin / theme system** — Pro tier or community.
- **Live collaboration cursors** — needs sub-project B's sync foundation.
- **Scene reordering by drag** — currently click-to-navigate only; drag-to-reorder is implementation plan §5.2 (deferred to A.1).
- **In-editor revision history** — diffs between saves; depends on B's version-history sync but useful even locally.

---

## Next steps

1. **User reviews this spec.** Feedback / corrections welcome before locking.
2. Once approved, the writing-plans skill produces a step-by-step implementation plan derived from this spec.
3. The implementation plan goes into a separate session for execution (using the executing-plans or subagent-driven-development skill).
4. Implementation work happens in `src/rwanga-editor/` against this spec.
5. Sub-project A v0.1 ships internally (unsigned) for testing.
6. External decisions D2 (signing) and D6 (branding) resolve before first public release.
7. Sub-project B brainstorming begins after A's implementation lands.

---

*End of sub-project A design spec.*
