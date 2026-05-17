# Workstream A — Implementation Plan (Phase A1: Windows only)

**Date:** 2026-05-17
**Status:** PLAN ONLY. No code changes, no runtime edits.
**Phase:** A1 — Windows owned chrome. Linux best-effort (Phase A2) and macOS hybrid (Phase A3) follow in later mission turns.
**Source of truth for visual language:** `docs/design-system/` (read only; no new tokens, no new patterns).
**Architecture basis:** `docs/owned-chrome-architecture-report.md` Option B (hybrid).

---

## 0. Recap of the binding decisions

From the authorization on this turn:

1. **Option B (hybrid).** Windows + Linux fully owned; macOS uses hiddenInset + native traffic lights + native global menu bar.
2. **Phase order:** Windows → Linux best-effort → macOS hybrid. Each phase ships independently.
3. **No guard vacuum.** Replacement guards exist before VS1/VS2/VS11 are retired.
4. **Incremental stages.** A1 → A2 → A3 → A4 → A5 → A6, each independently bootable / revertable / testable. No giant merge.
5. **Existing Claude Design system only.** No invented patterns; reads `docs/design-system/` for visual decisions.
6. **Chrome shape: three rows, no more.**
   - Row 1 — Title row: app identity (left) · script identity (middle) · window controls (right)
   - Row 2 — Menu row: File · Edit · View · Script · Tags · Tools · Export · Help
   - Row 3 — Global toolbar (Workstream D — not this report)
7. **Hard stop conditions:** drag breaks · resize breaks · snap breaks · keyboard accelerators break · focus state breaks · accessibility breaks.

This document covers Phase A1 only.

---

## 1. Stage-by-stage implementation plan

Each stage is one commit (occasionally two — see notes). Each stage leaves the app bootable on Windows. Some stages leave the app temporarily reduced in capability (e.g., post-A1 the window has no chrome at all until A2 adds the title bar) — these are verification windows, not daily-use states.

### Stage A0 — Replacement guard suite (PRE-IMPLEMENTATION)

**Goal:** create the new ownership guards BEFORE touching runtime. Old guards (VS1/VS2/VS11) continue passing through this stage.

**Files touched:**
- New: `tests/unit/shell/owned-chrome-windows.test.js`
- New: `tests/unit/shell/owned-chrome-menu-ownership.test.js`
- New: `tests/unit/shell/owned-chrome-window-controls.test.js`
- New: `tests/unit/shell/owned-chrome-drag-region.test.js`
- New: `tests/unit/electron/owned-chrome-main-process.test.js`

**What each guard asserts** (initially uses `if (file does not yet have X) return;` skip patterns so they pass before implementation lands, then fully activate as each stage lands):

| Guard | Stage that activates it | Negative invariant |
|---|---|---|
| **G-OC-1** Main process: Windows path uses `frame: false`; macOS path uses `titleBarStyle: 'hiddenInset'` | A1 | NOT `frame: true` on Win/Linux; NOT `frame: false` on macOS without hiddenInset |
| **G-OC-2** Renderer declares one owned title bar (`#rga-shell-titlebar`) with `-webkit-app-region: drag` declared in CSS | A2 | NOT zero drag region; NOT multiple titlebars |
| **G-OC-3** Renderer declares window-control buttons (`#rga-shell-window-min`, `#rga-shell-window-max`, `#rga-shell-window-close`) wired to existing `window.rwanga.window.*` IPC; each carries `aria-label` and `-webkit-app-region: no-drag` | A3 | NOT a button without IPC routing; NOT a button without ARIA |
| **G-OC-4** Renderer declares an owned menu bar (`#rga-shell-menubar`) with 8 top-level entries in fixed order; each menu item routes through an existing SSOT mutator (no menu item flips DOM directly) | A4 | NOT a menu item without owner routing; NOT a duplicate ownership path |
| **G-OC-5** `electron/menu.js` calls `Menu.setApplicationMenu(null)` on Windows/Linux paths and `Menu.setApplicationMenu(builtMenu)` on macOS path | A4 | NOT a single non-conditional `Menu.setApplicationMenu` call |
| **G-OC-6** Every interactive element inside `#rga-shell-titlebar` declares `-webkit-app-region: no-drag` (drag-island invariant — keeps buttons clickable in the drag region) | A5 | NOT a button without no-drag; NOT a no-drag rule outside the title bar |
| **G-OC-7** Title bar double-click → maximize handler exists in the renderer (or is intentionally absent and documented) | A5 | Just an existence assertion to make sure the handler doesn't quietly disappear later |
| **G-OC-8** Accessibility: every chrome control has either `aria-label` or visible text; tab order through menu bar items is sequential (assert via tab-index attributes) | A4–A5 | Hard non-negotiable per brief |

**Skip pattern for pre-implementation passing:**
```js
// Stage gate — only assert if the target capability has shipped.
if (!html.includes('id="rga-shell-window-close"')) {
  return; // A3 hasn't landed yet
}
```

Each guard is fully activated when its stage lands (the skip predicate becomes false and the assertion runs).

**Acceptance for A0:** all new tests pass (most via skip pattern). Old VS1/VS2/VS11 still pass. Test count goes from 760 → ~780 (new tests present; mostly trivially passing).

**Revert cost:** delete new test files. Single revert.

---

### Stage A1 — Frameless window transport (Windows only)

**Goal:** flip the main process to frameless on Windows. The renderer is untouched. Window has no chrome until A2.

**Files touched:**
- `electron/main.js` — `frame: true` → platform-conditional: Windows + Linux `frame: false`, macOS `titleBarStyle: 'hiddenInset'`.

**Specific change (pseudocode — not the actual diff):**
```js
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isLin = process.platform === 'linux';

new BrowserWindow({
  ...existing,
  frame: !isWin && !isLin,                       // false on Win + Linux
  titleBarStyle: isMac ? 'hiddenInset' : undefined,
  // titleBarOverlay reserved for A5 (Snap Layouts on Win11)
});
```

Phase A1 is Windows-only, but the main-process change is platform-aware up front (Linux + macOS paths are written but not yet verified — they activate when those phases open).

**Post-stage state on Windows:**
- Window opens with NO title bar, NO menu bar, NO window controls.
- Window IS resizable (compositor still manages resize edges).
- App contents render normally.
- User can close via Alt+F4, minimize via Win+M, snap via Win+arrow. Mouse drag does not work yet.
- This is a verification state, not a daily-use state.

**Replacement guard activated:** G-OC-1.

**Old guards status:** all still pass (none of them touch main.js's frame setting).

**Verification:**
- `npm run test:unit` → green.
- Manual smoke on Windows: app boots, window is frameless, contents render, keyboard close/minimize work.
- DO NOT verify drag/maximize-via-double-click/snap-on-drag — those land in A5.

**Stop conditions that halt the workstream here:**
- App fails to boot on Windows.
- Renderer fails to render any content.
- Resize edges don't grab.

**Revert cost:** single-line revert in `electron/main.js`. ~30 seconds.

---

### Stage A2 — Owned title bar

**Goal:** paint the Row 1 chrome (app identity · script identity · empty window-controls slot). Declare the drag region. After A2 the user can drag the window.

**Files touched:**
- `renderer/index.html` — extend the existing `#rga-shell-titlebar` element. Layout per the brief:
  - Left: app identity (Rwanga wordmark or existing title text)
  - Middle: script identity (currently the `#rga-shell-titlebar-title` content)
  - Right: empty slot reserved for window controls (A3 fills it); theme toggle + avatar continue to live here
- `renderer/css/shell.css` — title bar:
  - Height grows from 28px to accommodate the three-row layout (likely 36px for Row 1; Row 2 menu adds 28px in A4; Row 3 toolbar adds 36px in Workstream D).
  - `-webkit-app-region: drag` on the title bar surface (already declared at `shell.css:493` — preserved).
  - Three-zone flex: `[app]` `[script — flex:1]` `[actions]`.
- `renderer/js/shell/title-bar.js` — already reads activeScript from ScriptSession; no logic change needed for A2. May add an explicit "app identity" segment painter if the existing module doesn't carry one.

**Visual language:** reuses the existing `.rga-shell-titlebar-*` class family (already in shell.css ~lines 427–485). No new tokens. No new components. The "app identity" segment uses the same font/color tokens as the existing `.rga-shell-titlebar-title`.

**Post-stage state on Windows:**
- Window has a title bar that paints app/script identity.
- Window IS draggable from the title bar.
- Window controls slot is empty (no buttons yet).
- User can close via Alt+F4, minimize via Win+M, drag freely.

**Replacement guard activated:** G-OC-2.

**Old guards status:** VS1 (no `#menu-bar`) — still passes; A2 only touches the title bar. VS2 (no fake window controls) — still passes; A2 doesn't add controls. VS11 — still passes; main.js unchanged from A1.

**Verification:**
- Tests green.
- Manual: title bar renders, drag works, identity text correct.

**Stop conditions:** drag doesn't work; title bar overflows; click on the title bar doesn't fire (drag declaration eating clicks meant for theme toggle etc.).

**Revert cost:** revert renderer/index.html + renderer/css/shell.css edits + title-bar.js if touched. ~5 minutes.

---

### Stage A3 — Owned window controls

**Goal:** add minimize / maximize / close buttons in the title bar's right slot. Each routes through the existing `window.rwanga.window.*` IPC bridge (already in `electron/preload.js:53-58` and `electron/bridge/window-controls.js`).

**Files touched:**
- `renderer/index.html` — three buttons inside the title bar's right zone:
  ```html
  <button id="rga-shell-window-min"   class="rga-shell-window-control" type="button"
          aria-label="Minimize"   title="Minimize">…</button>
  <button id="rga-shell-window-max"   class="rga-shell-window-control" type="button"
          aria-label="Maximize"   title="Maximize">…</button>
  <button id="rga-shell-window-close" class="rga-shell-window-control rga-shell-window-control--danger" type="button"
          aria-label="Close window" title="Close">…</button>
  ```
- `renderer/css/shell.css` — `.rga-shell-window-control` reuses the existing `.btn-icon` pattern from `docs/design-system/03-rwanga-component-system.md §1.3` (28×28, square, radius-md, `--text-secondary`, hover `--bg-hover` + `--text-primary`). The `--danger` variant on close uses the existing `--accent-error` hover.
- `renderer/css/shell.css` — each button declares `-webkit-app-region: no-drag` (the same rule pattern already in place for `.rga-shell-titlebar-action` at line 517).
- `renderer/js/shell/title-bar.js` OR a small wiring block in `app-shell.js` — three click handlers calling `window.rwanga.window.minimize()`, `.maximize()`, `.close()`. Double-click-to-maximize is reserved for A5.
- Icons: use the existing Lucide icon set (Slice 8 brought Lucide into `icons-lucide.js`). Required glyphs: `minus` (minimize), `square` or `maximize-2` (maximize), `x` (close). No new icon files.

**Visual language:** entirely from the existing design system.

**Post-stage state on Windows:**
- Window has functional min/max/close in the title bar.
- Drag still works.
- Maximize button maximizes; clicking again restores (the existing `window.maximize` IPC handler already implements toggle behaviour at `bridge/window-controls.js:15-19`).
- Theme toggle and avatar continue to render in the title bar.

**Replacement guard activated:** G-OC-3.

**Old guards status:** VS2 (no fake window controls) — **this is the breaking guard.** A3 adds real controls. VS2 still passes its letter (the controls are not fake — they route to real IPC) but its spirit changes. A formal retirement is in A6. Until then, VS2 continues to pass because its assertion is "no `#app-logo` and no fake controls"; the new controls are not fake.

Wait — VS2's exact assertion needs re-reading. Per `tests/unit/shell/visual-stabilization.test.js`, VS2 likely checks for absence of specific old IDs. The new controls use new IDs (`rga-shell-window-*`), so VS2's letter passes. Spirit-level concern flagged for A6.

**Verification:**
- Tests green.
- Manual: click min → minimizes; click max → maximizes (and restores on second click); click close → closes; theme toggle + avatar still clickable; drag still works around the buttons.

**Stop conditions:** click fires drag instead of button action (no-drag missing); buttons not visible; IPC not reaching main; ARIA broken.

**Revert cost:** revert index.html + shell.css + title-bar.js edits. ~5 minutes.

---

### Stage A4 — Owned menu surface

**Goal:** add Row 2 — the 8-entry menu bar (File · Edit · View · Script · Tags · Tools · Export · Help). Each menu item routes via existing SSOT mutators. Suppress the native menu on Windows/Linux via `Menu.setApplicationMenu(null)`.

**Files touched:**
- `renderer/index.html` — new `#rga-shell-menubar` element below the title bar:
  ```html
  <nav id="rga-shell-menubar" class="rga-shell-menubar" aria-label="Application menu">
    <button class="rga-shell-menubar-item" data-menu="file"   type="button">File</button>
    <button class="rga-shell-menubar-item" data-menu="edit"   type="button">Edit</button>
    <button class="rga-shell-menubar-item" data-menu="view"   type="button">View</button>
    <button class="rga-shell-menubar-item" data-menu="script" type="button">Script</button>
    <button class="rga-shell-menubar-item" data-menu="tags"   type="button">Tags</button>
    <button class="rga-shell-menubar-item" data-menu="tools"  type="button">Tools</button>
    <button class="rga-shell-menubar-item" data-menu="export" type="button">Export</button>
    <button class="rga-shell-menubar-item" data-menu="help"   type="button">Help</button>
  </nav>
  ```
- `renderer/css/shell.css` — `.rga-shell-menubar` reuses existing tokens. Item styling mirrors the `.bp-tab` pattern (per `docs/design-system/03-rwanga-component-system.md §3`) — same hover treatment, same text color, same padding. Dropdown styling reuses the existing `.overlay-menu .topmenu-dropdown` rules already in `renderer/css/overlays.css` (the dormant `#topmenu-dropdown` element already exists in index.html line 259 — A4 wires it).
- `renderer/js/app-shell.js` OR a new small block — menu-bar interaction:
  - Click a menu item → open dropdown anchored to that item, populate with the items per the menu placement table from `docs/studio-shell-recovery-plan.md §2 Workstream B`.
  - Click a dropdown item → invoke the SSOT mutator (e.g., `Rga.FileManager.newScript()`, `Rga.ViewMode.set('draft')`, `Rga.Shell.StudioPanel.toggle()`).
  - Click outside → close dropdown.
  - Esc → close dropdown.
  - Existing keyboard registrations remain unchanged (Cmd+J, Cmd+`, etc.); menu items are a parallel surface to keyboard, both calling the same mutators (the established "one owner, many surfaces" pattern).
- `electron/menu.js` — refactored:
  - On macOS: continues to build + set the native menu (per Option B hybrid).
  - On Windows/Linux: calls `Menu.setApplicationMenu(null)` to suppress the default Electron menu (Edit/View/Window/Help with role-bindings).
  - Existing IPC-based menu actions (file.new, view.flow, view.studioPanel, etc.) continue to be sent — they're harmless if no menu is set, and the renderer's menuAction handler is already wired.
- `electron/main.js` — minimal: continues to call `buildMenu(mainWindow)`; the platform branching is inside `menu.js`.

**Menu placement table** — per Workstream B brief, restated here (no future-safe "(coming soon)" items, only working commands plus disabled placeholders without noisy suffixes):

| Menu | Working items | Disabled placeholders |
|---|---|---|
| File | New Script · Open… · Open Folder… · Save · Save As… · Manage Storage… · Close · Quit | Open Recent ▸ (greys until recent.list wires up) |
| Edit | Undo · Redo · Cut · Copy · Paste · Select All | Find in this script · Find and Replace |
| View | Flow · Draft · Print · Toggle Sidebar · Toggle Inspector · Studio Panel · Reload · Toggle DevTools · Zoom +/-/0 · Toggle Fullscreen | — |
| Script | — (all greyed: Insert Scene · Renumber Scenes · Go to Scene · Insert Page Break · Set Page Setup · Set Script Language) | All — Script-level commands not yet exposed |
| Tags | — (all greyed: Open Tag Manager · Add Tag to Selection · Filter by Tag) | All |
| Tools | Command Palette · Toggle Theme · Load Sample Script · Check for Updates | Settings |
| Export | Export to PDF… | Export to DOCX / Fountain / Final Draft |
| Help | Documentation · Report a Bug · About Rwanga | — (Documentation / Bug Report / About may also be greyed if URLs not wired) |

Disabled placeholders render with `disabled` attribute + `aria-disabled="true"`; no noisy "(coming soon)" suffix.

**Visual language:** all from existing design system — `.btn-icon` family, `.bp-tab` hover, `.overlay-menu` dropdown.

**Post-stage state on Windows:**
- Window has title bar (drag) + menu bar.
- Menu items open dropdowns; dropdown items invoke real commands.
- Native Electron menu is suppressed (no second menu bar appearing anywhere).
- Keyboard accelerators on menu items work (registered via existing `KeyboardRegistry` for Win/Linux).

**Replacement guards activated:** G-OC-4 and G-OC-5.

**Old guards status:** VS1 (no `#menu-bar` element) — **passes by letter** (we use `#rga-shell-menubar`, a new ID). VS11 (main.js no Menu.setApplicationMenu) — **passes by letter** (main.js still doesn't call it directly; menu.js does, which is what the guard's letter allows). Both legitimately retire in A6.

**Verification:**
- Tests green (renderer-side menu structure, IPC routing, no duplicate ownership).
- Manual: each menu opens, items invoke commands, native menu not shown.

**Stop conditions:** menu doesn't open; dropdown items don't fire; native menu shows alongside owned menu; keyboard accelerators (Ctrl+S, etc.) stop working; tab navigation through menu items broken; screen reader doesn't announce menu items.

**Revert cost:** revert index.html + shell.css + app-shell.js + menu.js + main.js (small). ~10 minutes. Single set of related file reverts.

---

### Stage A5 — Drag behavior polish

**Goal:** polish drag and snap interactions added incrementally in A2–A4. Cover the no-drag islands for buttons + double-click-to-maximize + verify snap zones.

**Files touched:**
- `renderer/css/shell.css` — add `.rga-shell-window-control { -webkit-app-region: no-drag; }` if not already added in A3. Same for `.rga-shell-menubar-item`. Audit every interactive element inside the title bar / menu bar for no-drag.
- `renderer/js/shell/title-bar.js` — double-click handler on the title bar drag region → call `window.rwanga.window.maximize()` (toggle).
- No new IPC. No new commands.

**What this stage validates:**
- Single-click on any chrome button works (no-drag in place).
- Click-and-drag on the title bar moves the window.
- Click-and-drag on the menu bar (between menu items) ALSO moves the window — menu bar has `-webkit-app-region: drag` declared, items have `-webkit-app-region: no-drag` islands.
- Double-click on the title bar maximizes / restores.
- Drag to screen edge triggers Aero Snap.
- Drag to top edge maximizes.
- Drag from menu bar item area = item click; drag from gap between items = window drag.

**Replacement guards activated:** G-OC-6 and G-OC-7 fully active.

**Old guards status:** unchanged.

**Verification:**
- Tests green (no-drag declared on every interactive chrome element; double-click handler present).
- Manual on Windows: every drag/snap/click affordance works.

**Stop conditions:** any drag / snap / double-click regression triggers the hard-stop list.

**Revert cost:** revert one CSS edit + the double-click handler. ~5 minutes.

---

### Stage A6 — Guard replacement + cleanup

**Goal:** retire VS1, VS2, VS11. New guards (G-OC-1 through G-OC-8) carry the contract.

**Files touched:**
- `tests/unit/shell/visual-stabilization.test.js` — delete the three guards.
- New guard suite (created in A0) is fully active by this point.
- Possibly delete the dormant `#topmenu-dropdown` legacy element if A4 replaced its use with the new menu bar.
- Update `docs/design-system/rwanga-runtime-stabilization-final.md` if any LOCKED text references the V1/T1 native-first decision (the doc is presented as historic; the reversal needs to be footnoted).
- Update memory file `feedback_no_orphaned_files.md` if anything dormant from the native-first era is removed.

**Post-stage state:** Phase A1 complete. Windows ships owned chrome. Replacement guards lock the new contract. Old guards retired.

**Stop conditions:** any new guard fails when old guards are removed (indicates the new guards don't fully cover what the old ones did).

**Revert cost:** restore the three guard tests. ~2 minutes.

---

## 2. Replacement guard plan (consolidated)

Created in A0; activated stage-by-stage.

| Guard | Stage | Replaces | Full assertion |
|---|---|---|---|
| **G-OC-1** | A1 | (none — new) | Main process: Windows + Linux `frame: false`; macOS `titleBarStyle: 'hiddenInset'`. Single source of truth in `electron/main.js`. |
| **G-OC-2** | A2 | (none — new) | Renderer: exactly one `#rga-shell-titlebar` element. Title bar CSS declares `-webkit-app-region: drag`. App-identity, script-identity, and actions zones present. |
| **G-OC-3** | A3 | VS2 (no fake window controls — replaced by real controls) | Windows/Linux: three buttons `#rga-shell-window-{min,max,close}` exist. Each routes to `window.rwanga.window.{minimize,maximize,close}`. Each has `aria-label`. Each declares `-webkit-app-region: no-drag`. Close button has the `--danger` variant class for hover-affordance. |
| **G-OC-4** | A4 | VS1 (no `#menu-bar` — replaced by `#rga-shell-menubar` with new contract) | Renderer: `#rga-shell-menubar` exists. Exactly 8 top-level menu buttons in declared order (File · Edit · View · Script · Tags · Tools · Export · Help). Each top-level item carries `data-menu` attribute. Dropdown items route through existing SSOT mutators — no menu item performs a direct DOM action. |
| **G-OC-5** | A4 | VS11 (no `Menu.setApplicationMenu` in main.js — replaced by platform-conditional setApplicationMenu in menu.js) | `electron/menu.js` calls `Menu.setApplicationMenu(null)` on Windows/Linux paths and `Menu.setApplicationMenu(builtMenu)` on macOS path. The platform branch is explicit and grep-able. |
| **G-OC-6** | A5 | (none — new) | Every interactive descendant of `#rga-shell-titlebar` declares `-webkit-app-region: no-drag` in CSS. Includes window controls, theme toggle, menu items, avatar, future search affordance. No no-drag declarations outside the title bar (catches stray copy-paste). |
| **G-OC-7** | A5 | (none — new) | Double-click handler on the title-bar drag region calls `window.rwanga.window.maximize()`. Existence assertion; behavior is verified manually. |
| **G-OC-8** | A4–A5 | (none — new) | Accessibility invariants: every `.rga-shell-window-control` has `aria-label`; every `.rga-shell-menubar-item` has visible text + role; tab order through menu items is sequential (left-to-right). |

Plus existing guards that **continue to pass unchanged** throughout A1: VS3 / VS4 / VS5 / VS6 / VS7 / VS8 / VS9 / VS10 (visual-stabilization concerns unrelated to chrome ownership).

---

## 3. Commit sequence

**Seven commits total. Tests green at each.**

| # | Commit subject | Files | Tests delta | Revertable independently |
|---|---|---|---|---|
| **A0** | `test(owned-chrome): replacement guard suite for Workstream A (pre-implementation)` | 5 new test files | +20–30 guards (most skip-pattern until stage activation) | Yes — delete the new files |
| **A1** | `feat(electron): Workstream A1 — frameless window transport (Windows + Linux)` | `electron/main.js` | G-OC-1 activates | Yes — one-line revert |
| **A2** | `feat(chrome): Workstream A2 — owned title bar with drag region` | `renderer/index.html` · `renderer/css/shell.css` · maybe `renderer/js/shell/title-bar.js` | G-OC-2 activates | Yes — file-level revert |
| **A3** | `feat(chrome): Workstream A3 — owned window controls (min/max/close → IPC)` | `renderer/index.html` · `renderer/css/shell.css` · button wiring (likely in `renderer/js/shell/title-bar.js` or `renderer/js/app-shell.js`) | G-OC-3 activates | Yes |
| **A4** | `feat(chrome): Workstream A4 — owned menu surface (8-entry menubar, native menu suppressed on Win/Linux)` | `renderer/index.html` · `renderer/css/shell.css` · `renderer/js/app-shell.js` · `electron/menu.js` | G-OC-4 + G-OC-5 activate | Yes |
| **A5** | `feat(chrome): Workstream A5 — drag behavior polish (no-drag islands, double-click maximize)` | `renderer/css/shell.css` · `renderer/js/shell/title-bar.js` | G-OC-6 + G-OC-7 fully active; G-OC-8 finalised | Yes |
| **A6** | `refactor(tests): Workstream A6 — retire VS1/VS2/VS11 (replaced by G-OC suite)` | `tests/unit/shell/visual-stabilization.test.js` | -3 guards (old) | Yes — restore the three guards |

**Each commit independently revertable.** A revert of A4 does NOT require reverting A1–A3 — the app would lose its menu bar but keep title + window controls. A revert of A1 would put the app back to native chrome and leave the rest of the chrome (paint-only, no drag) as harmless overlay.

---

## 4. Stop-point register (consolidated)

Per the brief's hard-stop list, each stage halts and reports if it hits:

| Trigger | Stage(s) most likely | Behaviour |
|---|---|---|
| Drag breaks | A2 / A5 | STOP. Revert to previous stage. |
| Resize breaks | A1 | STOP. Frame setting must be wrong on this platform. |
| Snap breaks | A1 / A5 | STOP. May need `titleBarOverlay` for Win11 Snap Layouts (a Phase A1.5 add). |
| Keyboard accelerators break | A4 | STOP. Either the menu-item accelerator registration is wrong or KeyboardRegistry is being bypassed. |
| Focus state breaks | A2 / A4 | STOP. Add main-process `blur/focus` listeners that toggle a body class. |
| Accessibility breaks | A4 / A5 | STOP (non-negotiable per brief). Restore native chrome. File a11y debt. |

---

## 5. Phase A1 ↔ later phases — what's deferred

- **Phase A2 (Linux)**: same A1–A6 sequence runs on Linux. Risks identified in the architecture report (compositor variance, CSD/SSD, wlroots-Wayland resize gaps) get verified per-distro. Linux is "best-effort" — if any of GNOME / KDE / Wayland breaks badly, that distro ships native fallback.
- **Phase A3 (macOS hybrid)**: macOS-only commit set. Adds `titleBarStyle: 'hiddenInset'` activation, renders the title-bar paint alongside native traffic lights, keeps native menu via `Menu.setApplicationMenu(buildMenu())` for macOS path, conditionally hides `#rga-shell-menubar` on macOS (`process.platform === 'darwin'` check + `body.platform-darwin` class).
- **Workstream B** (menu placement table — full): the 8 menus in A4 ship with the proposed placement table. Workstream B refines it; A4 lands it.
- **Workstream D** (Row 3 — global toolbar): out of A1 scope.
- **Workstream C** (Scene Toolbox dockable): out of A1 scope.

---

## 6. Out of scope for this plan

- No timeline estimate. Honestly 2–3 weeks per the architecture report.
- No commit messages drafted — those land at each stage's commit time.
- No design system additions. The plan exclusively reuses existing patterns.
- No new tokens / colors / icons.
- No new shell modules (`Rga.Shell.WindowControls` etc. would not be needed — the existing `Rga.Shell.TitleBar` extends to cover the new surface).
- No engine / framework / doc-types / schema changes.

---

## 7. Authorization needed before A0 begins

This plan does not yet ask for execution authorization. Before A0 (the replacement guard suite) lands as its own commit, please confirm:

1. **Seven-commit shape acceptable?** A0 → A1 → A2 → A3 → A4 → A5 → A6 as separate commits, each green.
2. **Menu placement table in §1 stage A4 approved as drafted**, or revisions needed before the menus get wired?
3. **Disabled placeholders policy:** `disabled + aria-disabled` only, no `(coming soon)` suffix — confirmed?
4. **Smoke-verification cadence:** after each stage I'll run `npm run test:unit` and report back. Manual Windows verification (drag / snap / minimize / maximize / close / menu open / item click / theme toggle / avatar click / focus state) happens between stages. Who performs the Windows manual smoke — you, or do you want me to add a checklist file per stage that you walk through?

Without these four answers, only A0 is fully scoped. The rest of the plan is shape; the specifics get finalised at each stage's planning gate.

End of plan. No runtime work begins until §7 is answered.
