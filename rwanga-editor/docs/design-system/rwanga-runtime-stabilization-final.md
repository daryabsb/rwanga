# Rwanga — Runtime Ownership Stabilization (FINAL)

**Status: LOCKED 2026-05-17.**  
Workstream closed by user approval at the end of Slice 9. This
document is the canonical retrospective and reference for the
shell-side ownership architecture that the nine slices produced.
The architecture is **frozen**; further refinement requires opening
a new workstream with explicit justification.

---

## 1. Final architecture summary

The Rwanga renderer is organised as a layered shell sitting on top of
a locked editor engine. The shell consists of:

- A small **`app-shell.js`** (201 LOC, down from 1080) holding only
  `Rga.Theme` and four delegating shims (`Rga.Keyboard`, `Rga.Sidebar`,
  `Rga.BottomPanel`, `Rga.Inspector`) — each shim exists only because
  off-limits engine code calls it.
- **15 single-purpose modules** under `renderer/js/shell/`:
  `activity-rail`, `command-palette`, `icons-lucide`, `index`,
  `keyboard-registry`, `layout`, `modal`, `resize`, `script-language`,
  `script-metrics`, `script-session`, `session-boundary`, `sidebar`,
  `status-bar`, `studio-panel`, `title-bar`, `toast`,
  `workspace-state`, plus the panel modules under `panels/`.
- **One canonical manifest** (`Rga.SessionBoundary`) declaring which
  session-side fields belong to which owner. Drift guards mirror it
  and fail CI on divergence.
- **Engine** (`renderer/js/framework/*`, `doc-types/*`, `editor/*`)
  is untouched. Engine consumers reach into the shell through the
  four legacy shims; the shell never reaches into the engine.

### Layered ownership

```
┌──────────────────────────────────────────────────────────────────┐
│                         Engine (LOCKED)                          │
│  renderer/js/framework/  +  doc-types/  +  editor/               │
│  - Rga.ViewManager       (active view + body-class side effect)  │
│  - Rga.PrintPreview      (registers printPreview view)           │
│  - Rga.Nav               (NavigationIndex / Outline / PageMap)   │
│  - Rga.RuntimeProfile    (runtime modes)                         │
└─────────────────────▲────────────────────▲───────────────────────┘
                      │                    │
       reads via      │                    │   writes via shim
       direct API     │                    │   (Rga.BottomPanel /
                      │                    │    Rga.Inspector /
                      │                    │    Rga.Sidebar /
                      │                    │    Rga.Keyboard)
                      │                    │
┌─────────────────────┴────────────────────┴───────────────────────┐
│                       Shell (Rga.Shell.*)                        │
│  - Rga.Shell.Layout         (sidebar / studioPanel / inspector / │
│                              titleBar / statusBar — in-memory)   │
│  - Rga.WorkspaceState       (persists Layout to rga-workspace-   │
│                              layout)                             │
│  - Rga.Shell.Sidebar        (panel registry + runtime active id) │
│  - Rga.Shell.StudioPanel    (bottom panel + inspector + scene-   │
│                              notes routing)                      │
│  - Rga.Shell.StatusBar      (renderer only — read-only consumer) │
│  - Rga.Shell.TitleBar       (renderer only — read-only consumer) │
│  - Rga.Shell.ActivityRail   (renderer only — read-only consumer) │
│  - Rga.KeyboardRegistry     (single document.keydown listener)   │
│  - Rga.ScriptSession        (writer-context derivation, 7 fields)│
│  - Rga.ScriptMetrics        (analytics derivation, 6 fields)     │
│  - Rga.SessionBoundary      (canonical field-ownership manifest) │
│  - Rga.ViewMode             (UX layer reacting to ViewManager)   │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │
              ┌───────────────┴────────────┐
              │                            │
        renders DOM             writes to localStorage
              │                            │
              ▼                            ▼
   document.documentElement      rga-workspace-layout, rga-theme,
   + workspace zones             rga-view-mode, rga-script-lang,
                                 rga-session-tabs
```

---

## 2. Ownership graph

The four "session-side" owners and the fields each owns (per
`Rga.SessionBoundary._MANIFEST`):

| Owner | Semantic | Fields |
|---|---|---|
| `Rga.ScriptSession` | writer-context | `activeScript`, `currentScene`, `currentPage`, `currentView`, `currentSelection`, `openPanels`, `activePanel` |
| `Rga.ScriptMetrics` | derived-analytics | `wordCount`, `currentBlockType`, `dialogueWords`*, `actionWords`*, `sceneCount`*, `estimatedRuntime`* |
| `Rga.ViewManager` | view-mode | `current` (active view id) |
| `Rga.WorkspaceState` | workspace-persistence | Layout zones: `sidebar`, `studioPanel`, `inspector`, `titleBar`, `statusBar` |

*Reserved-future analytics fields — always null today; computed by a
later slice.

The four "shell-state" owners (separate concern from session-side
fields):

| Owner | Concern | SSOT |
|---|---|---|
| `Rga.Shell.Layout` | sidebar / studio / inspector / titleBar / statusBar visibility + sizes + active selections | in-memory `_current` map; persisted by WorkspaceState |
| `Rga.Shell.Sidebar` | active panel id + panel registry | `_currentId` (private); mirrored to `Layout.sidebar.activePanel` for persistence |
| `Rga.Shell.StudioPanel` | bottom-panel routing + inspector routing + scene-notes routing | `Layout.studioPanel.{visible,activeTab,height}` + `inspector-hidden` DOM class |
| `Rga.KeyboardRegistry` | global shortcut dispatch | single `Map<combo, entry>` + one document.keydown listener |
| `Rga.Theme` | dark / light mode | `Rga.Theme.current` + `data-theme` attr + `localStorage['rga-theme']` |

---

## 3. Closed items

The nine slices that produced this state, in chronological order:

| Slice | Section | What closed |
|---|---|---|
| 1 | A | Bottom Panel ownership (close + reopen reversibly through Layout SSOT) |
| 1 | B | Draft mode body-class hygiene (no orphan classes) |
| 1 | C | Scene Navigator click → scroll + focus chain |
| 1 | D | Ownership matrix (`docs/design-system/rwanga-ownership-matrix.md`) |
| 2 | A | Keyboard consolidation (`Rga.KeyboardRegistry`) — OI-1 RESOLVED |
| 2 | B | Theme `onChange` event surface — OI-2 RESOLVED |
| 2 | C | Matrix updates for Keyboard + Theme |
| 3 | A | Legacy extraction Stage 1 — deleted `Rga.Tabs` + `Rga.FileTree` (-23%) |
| 3 | B | G1–G4 drift guards |
| 3 | C | Runtime audit (`docs/design-system/rwanga-runtime-audit.md`) |
| 4 | A | `Rga.WorkspaceState` — OI-3 RESOLVED; Layout-wide persistence |
| 4 | B | Storage-ownership doc (`docs/design-system/rwanga-storage-ownership.md`) |
| 4 | C | G5/G6/G7 drift guards (storage ownership) |
| 5 | A | StatusBar split-source confirmation; `Rga.ScriptMetrics` introduced as delegating layer |
| 5 | B | Sidebar `_syncLayoutMirror` — fixed activePanel-not-persisted bug from Slice 4 |
| 6 | A | ViewManager body-class ownership; view-mode.js fallback removed |
| 6 | B | G3 tightened — view-* classes are framework-only |
| 7 | A | `Rga.SessionBoundary` manifest; ScriptMetrics independent derivation; ScriptSession snapshot locked to 7 writer-context fields — Compatibility Inventory #6 RESOLVED |
| 7 | B | G8/G9/G10 drift guards (boundary enforcement) |
| 8 | A | Extracted 5 modules from app-shell.js (Toast / Modal / CommandPalette / Resize / ScriptLanguage) |
| 8 | B | G11 drift guards (app-shell.js allow-list + size ceiling + path-existence) |
| 9 | A | `Rga.Shell.StudioPanel` consolidates BottomPanel + Inspector + SceneNotes; deleted dead `Rga.SceneNotesConnector` — Compatibility Inventory #5 RESOLVED-WITH-SHIM |
| 9 | B | G12 drift guards (StudioPanel ownership lock) |

### Compatibility Inventory closures

| Entry | Status |
|---|---|
| #1 — Legacy `Rga.StatusBar` | RESOLVED (original shell migration Slice 2) |
| #2 — Legacy `Rga.Sidebar` shim | RESOLVED-WITH-SHIM (BLOCKED on `editor/*` touchability) |
| #3 — `#sidebar-header` DOM | RESOLVED (Slice 2) |
| #4 — Conditional shell-status-bar adapter | RESOLVED (Slice 2) |
| #5 — `#bottom-panel` Studio Panel ownership | RESOLVED-WITH-SHIM (Slice 9 §A) |
| #6 — ScriptSession analytics misplacement | RESOLVED (Slice 7 §A) |

### Final app-shell.js trajectory

| Milestone | LOC | Δ |
|---|---|---|
| Pre-Slice-3 baseline | 1080 | — |
| Slice 3 §A | 829 | -23% |
| Slice 8 §A | 397 | -64% cumulative |
| **Slice 9 §A (final)** | **201** | **-81% cumulative** |
| Theoretical floor (post-engine-touchability) | ~80 | LOCKED — not pursuing |

---

## 4. Deferred items

These were considered during the workstream and explicitly NOT done.
Each is recorded with the gate that would unlock it.

| Deferred item | Reason | Gate |
|---|---|---|
| Outline panel migrating to `Rga.ScriptMetrics` for `wordCount` | Outline doesn't currently read wordCount from anywhere — it reads `Rga.Nav.getOutline().statistics.words` directly. No migration needed | n/a (non-issue confirmed in Slice 7) |
| Layout zone-field validation (typo guard for `'studio_panel'` etc.) | Forward-compat tolerance is the current design | A future "Layout schema lock" slice if a typo bug appears |
| Sidebar.deactivate clearing `Layout.sidebar.activePanel` | Preserving "user's logical choice" across a hide → reopen restores the same panel | n/a — design decision documented |
| Reserved-future analytics fields (`dialogueWords`, `actionWords`, `sceneCount`, `estimatedRuntime`) derivation | Listed in the snapshot shape but always null | Future "story analytics" slice |
| Custom App Menu strip (VSCode-style) | OD-1 from V1.1 plan — native menu kept as source of truth | Future "Menu strategy" decision (user-driven) |
| Frameless window | OD-1 — preserves native title bar + native menu | n/a — design decision documented |
| Activity Rail icon family decision migration to a different family | Locked on Lucide per Activity Rail Doctrine | A future doctrine amendment, only if Lucide proves inadequate |

---

## 5. Remaining shims

The four legacy `Rga.*` modules that remain in `app-shell.js`. All are
**delegating shims** preserved because off-limits engine code calls
them. Each is gated on the same single decision: when `editor/*` /
`doc-types/*` become touchable, the engine consumers migrate to the
canonical APIs and the shims delete.

| Shim | LOC | Engine consumer | Delegates to | Removal gate |
|---|---|---|---|---|
| `Rga.Keyboard` | 12 | `editor/page-setup-dialog.js` calls `Rga.Keyboard.register(...)` | `Rga.KeyboardRegistry.register` | Migrate the engine call to `Rga.KeyboardRegistry.register` directly |
| `Rga.Sidebar` | 5 | `doc-types/screenplay/plugins/tags.js:206` calls `Rga.Sidebar.switchTo('tags')` (currently a no-op) | nothing (intentional no-op) | Migrate the engine call to `Rga.Shell.Sidebar.activate('characters')` when the Characters panel content exists |
| `Rga.BottomPanel` | ~20 | `annotations.js`, `revision-flags.js` call `switchTo('notes')` / `('flags')` | `Rga.Shell.StudioPanel` | Migrate engine calls to `Rga.Shell.StudioPanel.switchTo(...)` |
| `Rga.Inspector` | ~10 | `context-menu.js` calls `Rga.Inspector.open()` | `Rga.Shell.StudioPanel` | Migrate engine call to `Rga.Shell.StudioPanel.openInspector()` |

**Total shim cost: ~47 LOC.** Plus `Rga.Theme` (~80 LOC, single-owner
SSOT, no removal planned). Final app-shell.js floor: ~127 LOC of
which ~47 is shim and ~80 is Theme.

---

## 6. G1–G12 drift guard inventory

All twelve drift guards live in
`tests/unit/shell/ownership-drift-guards.test.js` and run on every
CI invocation of `npm run test:unit`. Together they enforce the
architecture at build time.

| Guard | Concern | Catches |
|---|---|---|
| G1 | Keyboard listeners | Any shell-js file attaching `document.keydown` outside `keyboard-registry.js` (plus an HTML-init variant) |
| G2 | Visibility-setter ownership | Unauthorised writers of `Layout.studioPanel`, `Layout.sidebar.visible`, `Layout.sidebar.activePanel` |
| G3 | Shell-state DOM classes | Unauthorised writers of `bottom-collapsed`, `sidebar-collapsed`, `view-{draft,print,print-preview}-active`, `inspector-hidden` |
| G4 | Storage writes | `localStorage.setItem(key, ...)` by any module not in `STORAGE_OWNERS[key].writers`; legacy keys flagged with migration pointer |
| G4 read-side | Storage reads | `rga-session-tabs` reads outside `tab-manager.js`; `rga-workspace-layout` reads outside `workspace-state.js` |
| G5 | Single-writer per key | The `STORAGE_OWNERS` registry must declare exactly one writer per key |
| G6 | Unregistered keys | Any localStorage key touched but not in `STORAGE_OWNERS` or `LEGACY_KEYS` |
| G7 | Restore-path existence | Every owned key's `restoreIn` module must contain a `getItem` call + the key literal |
| G8 | ScriptSession shape | `EMPTY_SNAPSHOT` field set must equal `SessionBoundary.ScriptSession.fields` exactly |
| G9 | ScriptMetrics shape | `get()` snapshot literal + `RESERVED` union must equal `SessionBoundary.ScriptMetrics.fields` exactly |
| G10 | Wrong-owner consumption | No shell-js consumer reads an analytics field from `ScriptSession.get()`; no consumer reads a writer-context field from `ScriptMetrics.get()` |
| G11 | app-shell.js surface | Allow-list of permitted top-level `Rga.*` modules; deny-list of extracted/deleted names; soft 450-LOC ceiling; ownership-doc path-existence |
| G12 | StudioPanel ownership | `Rga.BottomPanel` + `Rga.Inspector` shims must delegate (counts call sites, forbids direct Layout/DOM writes); `SceneNotesConnector` cannot return; `inspector-hidden` writer is `studio-panel.js`-only |

---

## 7. Lessons / anti-patterns discovered

Things the workstream uncovered that are worth remembering:

1. **Defensive guards mask broken APIs.** `context-menu.js` had been
   calling `Rga.Inspector.open()` for months guarded by
   `if (Rga.Inspector && Rga.Inspector.open)`. The method didn't
   exist; the call was a silent no-op. Defensive guards make
   undocumented breakage invisible. **Lesson:** type/method
   existence checks at runtime hide design errors. Either fail loud
   or document the optional-method contract.
2. **DOM state isn't a SSOT.** Pre-Slice-1, `Rga.BottomPanel`'s
   visibility lived in a `bottom-collapsed` class. The close button
   worked; the keyboard reopen didn't. **Lesson:** never use a CSS
   class as a state-of-truth source; make it a SIDE EFFECT of a
   real state SSOT.
3. **`Layout.set` no-ops on same value.** When persisted state
   matched Layout's default, the subscriber never fired, leaving
   DOM out of sync. **Lesson:** explicit-sync-on-init is required
   alongside reactive subscriptions whenever the initial state
   could match the default.
4. **Multiple listeners → invisible duplicates.** Pre-Slice-2,
   `Ctrl+J` was registered twice. No collision was visible at
   runtime, but adding a NEW Ctrl+J binding would silently
   overwrite both. **Lesson:** central registries with
   duplicate-detection warnings beat ad-hoc multi-listener
   registration.
5. **Per-app preference ≠ per-workspace state.** WorkspaceState
   deliberately does NOT subsume `rga-theme`, `rga-view-mode`,
   `rga-script-lang`. **Lesson:** lifetime decides scope. Don't
   fold all localStorage into one blob just because it's tidier.
6. **Mirror fields drift if not synced.** Pre-Slice-5,
   `Layout.sidebar.activePanel` was a mirror nobody wrote, so
   WorkspaceState persisted boot defaults forever. **Lesson:** a
   mirror field that's only written by some code paths but read by
   all is a latent bug. Mirrors need explicit sync points (e.g.
   `_syncLayoutMirror` inside `Sidebar.activate`).
7. **"Optional" Layout zones cost more than they save.**
   Layout's `set()` accepts unknown zones for forward-compat,
   which means typos silently store on the wrong field. **Lesson:**
   forward-compat tolerance and validation are opposites; pick one.
8. **Aspirational doc paths fail strict guards.** G11's
   path-existence guard caught a legitimate
   "renderer/js/shell/panels/notes-connector.js" reference that
   was a planned future destination. **Lesson:** doctrine docs
   need a whitelist for aspirational paths or a clear naming
   convention.
9. **Test setup mirrors production load order.** Each time we
   moved a module, several tests broke not because the module
   changed but because the test boot didn't load the new file.
   **Lesson:** test boots that don't mirror the production load
   order are brittle to extraction work. A shared test-harness
   factory would have caught this earlier.
10. **Comments are not state.** Source audits that scan for
    string patterns will trigger on illustrative literals in
    comments. Every drift guard now strips comments before
    matching. **Lesson:** code-pattern audits must distinguish
    declarations from documentation.

---

## 8. Never repeat

Behaviours that this workstream made structurally impossible and
which **must not return**:

- **Multiple modules writing the same `Rga.Shell.Layout` field.**
  G2 enforces a per-field writer whitelist. Adding a new writer
  requires editing the whitelist with justification — visible in
  PR review.
- **DOM classes as the source of truth for shell state.** G3
  enforces single-writer per shell-state class
  (`bottom-collapsed` / `view-*-active` / `inspector-hidden`).
- **localStorage keys without a documented owner.** G4 / G5 / G6 /
  G7 enforce the storage-ownership registry. A new
  `localStorage.setItem('newkey', ...)` fails CI with a
  "register it" message.
- **Analytics fields appearing on `ScriptSession`'s snapshot.**
  G8 + G9 + G10 enforce the SessionBoundary manifest. Cross-owner
  field appearance fails.
- **Multiple `document.keydown` listeners.** G1 enforces
  registry-only. Adding a new shortcut means
  `Rga.KeyboardRegistry.register(...)`, not
  `document.addEventListener`.
- **app-shell.js re-growing.** G11 caps it via allow-list + soft
  size ceiling + deny-list of extracted/deleted names.
- **`Rga.BottomPanel` or `Rga.Inspector` shims becoming
  re-implementations.** G12 counts delegate calls + forbids
  direct Layout/DOM writes inside the shim bodies.

If a future contributor proposes work that would require relaxing
any of G1–G12, that's not a contribution — it's a doctrine
amendment, and it needs explicit re-opening of this workstream.

---

## 9. Cross-references

- Ownership matrix — `docs/design-system/rwanga-ownership-matrix.md`
- Runtime audit — `docs/design-system/rwanga-runtime-audit.md`
- Legacy extraction roadmap —
  `docs/design-system/rwanga-legacy-extraction-roadmap.md`
- Storage ownership — `docs/design-system/rwanga-storage-ownership.md`
- Compatibility inventory —
  `docs/rwanga-shell-compatibility-inventory.md`
- Activity Rail Doctrine —
  `docs/rwanga-activity-rail-doctrine.md`
- Drift guards (G1–G12) —
  `tests/unit/shell/ownership-drift-guards.test.js`
- Per-slice behavioural tests —
  `tests/unit/shell/ownership-stab-slice{1,2,4,5,6,7,9}.test.js`

---

**STATUS: LOCKED 2026-05-17.** Do not extend this workstream
without explicit re-opening and a written justification for
relaxing a closed guard.
