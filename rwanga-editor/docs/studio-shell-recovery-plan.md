# Rwanga — Studio Shell Recovery Mission — Investigation & Plan

**Date:** 2026-05-17
**Status:** INVESTIGATION + PLAN ONLY. No code changes. Awaiting authorization on the lock-collision in §0 before any workstream opens.

**Mission summary (from the brief):** "Make the shell become the shell from Claude Design." Six workstreams (A–F). Final read should be **Screenplay Studio**, not **Electron app with screenplay support**.

---

## 0. Lock collision — must be resolved before Workstream A

**The mission's Workstream A reverses a locked architectural decision.**

The 2026-05-17 T1 correction (Visual Stabilization V1) explicitly chose **native-first chrome**:
- The custom in-app `#menu-bar` was deleted (`VS1` guard).
- Fake window controls + `#app-logo` were removed (`VS2` guard).
- Native Electron menu became the source of truth (`VS11` guard at `tests/unit/shell/visual-stabilization.test.js:213`, enforcing no `Menu.setApplicationMenu` in `main.js`).
- User-stored direction: *"native-first"* — File / Edit / View / Help live in the native OS application menu; the OS owns title bar and window controls.

Workstream A's required outcome is **the opposite of that**: Rwanga fully owns title bar, menu bar, and window controls. The legacy custom menu (deleted under VS1) comes back, just re-shaped. The native menu (locked under VS11) goes away.

**This is a legitimate strategic reversal** — the user has seen the result of native-first and decided the visual identity cost is too high. But it is a real reversal and the existing guards encode the older decision. Proceeding requires:

1. **Explicit authorization to delete or invert VS1, VS2, VS11 guards.** Otherwise Workstream A cannot proceed without breaking the suite.
2. **A platform exception for macOS.** Apple HIG and macOS technical reality forbid a fully app-owned menu bar — the menu bar lives at the top of the screen and is owned by the OS. The most "owned" macOS chrome you can ship is `titleBarStyle: 'hiddenInset'` (custom title bar with native traffic lights preserved) + a native menu bar with Rwanga-defined commands. The brief's "Rwanga fully owns the menu bar" is achievable on Windows/Linux only.
3. **A choice on Linux WM-decoration variance.** Frameless windows on Linux look meaningfully different across GNOME / KDE / wlroots. Owned chrome on Linux is best-effort, not pixel-identical.

**Until §0 is resolved, the rest of this plan is conditional.** Workstreams D / E / F can land without it. A / B / C depend on it.

---

## 1. Current ground truth (per surface)

### A — Native chrome
- `electron/main.js:21` — `frame: true`. Uses native OS window chrome (title bar, traffic lights / window controls, drag region all OS-owned).
- `electron/preload.js` already exposes `window.rwanga.window.minimize / maximize / close` — these IPC handlers exist (`electron/bridge/window-controls.js`). The wiring is ready; the UI for them isn't there.
- `electron/menu.js` defines the native Electron menu with File / Edit / View / Help + Rwanga-named items, called from `main.js → buildMenu(mainWindow)`. `Menu.setApplicationMenu(menu)` lives inside `menu.js`, not `main.js` — so the VS11 guard (which checks main.js only) passes. The native menu is the only menu surface currently shipping.
- `index.html` has a `#rga-shell-titlebar` strip showing "Rwanga • {script}" + theme toggle + avatar placeholder — but it's a SECOND row below the OS title bar (per the `<header>` element at line 34). On platforms that show the OS title bar, the user sees Rwanga's strip + the OS strip — two title-bar-shaped strips.

### B — Menu system
- Current native menu (`electron/menu.js`): File / Edit / View / Help. Items today:
  - File: New Script, Open…, Open Folder…, Save, Save As…, Export to PDF…, Manage Storage…, close/quit.
  - Edit: undo/redo/cut/copy/paste/selectAll (native roles).
  - View: Flow / Draft / Print (radio, added in Bundle 1 §A), reload/devtools/zoom/fullscreen (native roles).
  - Help: Load Sample Script, Check for Updates….
- Renderer's menu-action switch handles: `file.new`, `file.open`, `file.save`, `file.saveAs`, `view.flow`, `view.draft`, `view.print`. Other items either route via `role:` (native) or are unwired.
- **Commands not in the menu today:** theme toggle, format-toolbar commands (B/I/U/S/color/highlight/link/clear), panel-visibility toggles (sidebar, inspector, studio), scene toolbox visibility, settings panel, format insert (block-type change), tag actions, scene jump, command palette open.

### C — Scene Toolbox
- `index.html:134` — `<aside id="scene-toolbox" class="scene-toolbox-vertical disabled">` inside `#editor-area`.
- Absolute-positioned, anchored to the centered page's right edge (Bundle 1 §C), 88px wide vertical column.
- Contents: select dropdown (block type) + Note / Flag / Tag actions.
- Hidden when Draft is active. Disabled when cursor not in a scene (engine-side wiring in v3 plugins).
- No "move", "dock", "close", or "reopen" mechanism today. No state for docking position. No visibility toggle from any menu/keyboard.
- Visually: small popup-feeling box; "feels temporary" per user verification.

### D — Format toolbar
- `renderer/js/format-toolbar.js` — initialized via `Rga.FormatToolbar.init()` in boot.
- Mounted into `#format-toolbar` (the inline DOM strip in `index.html:89-107`, between tab-bar and the editor container).
- 11 buttons: undo / redo / sep / bold / italic / underline / strikethrough / sep / color / highlight / sep / link / sep / clear.
- Hidden in Draft view (`body.view-draft-active #format-toolbar { display: none }`).
- Currently lives **inside the editor area** — that's why it reads as "detached from writing surface" in the user verification: it has no relationship to the global chrome above it (the tab-bar separates it from the title-bar), and no visible attachment to the page below it.

### E — Studio Panel
- `Rga.Shell.StudioPanel` (Slice 9 consolidation) owns Bottom Panel + Inspector + SceneNotes.
- Visibility lives in `Rga.Shell.Layout.studioPanel.visible` (single SSOT).
- Active tab persisted via `Layout.studioPanel.activeTab` (Slice 5 §B fix).
- Toggle paths today:
  - Cmd/Ctrl+J (registered in keyboard-registry)
  - Cmd/Ctrl+` (registered in shell/index.js:151-156)
  - Close button on the bottom panel itself
  - Command palette entry
- All four paths converge on `Rga.BottomPanel.toggleCollapse()` → `Rga.Shell.StudioPanel.toggle()` → `Layout.studioPanel.visible` flip.
- **No "View → Studio Panel" menu entry today.** That's the recovery gap — if the user closes via the X and forgets the keyboard shortcut, the menu doesn't offer a path back.
- Visibility persists via WorkspaceState, so reload restores last state.

### F — Status bar
- 7 segments today (`renderer/js/shell/status-bar.js:42-49`), all left-aligned in a single flex row:
  - scene · page · blockType · wordCount · viewMode (Bundle 1 §A dropdown) · language · offline.
- Border-left separator added at viewMode / language / offline (`shell.css:362-366`) to visually group "writer-context" vs "tool-context" — but it's still one left-aligned strip.
- Information is correct; grouping is flat.

---

## 2. Per-workstream plan

For each: scope, files touched, risks, stop-points, honest size estimate.

### A — Native Chrome Ownership

**Conditional on §0 resolution.** Cannot proceed without it.

**Scope (Windows + Linux):**
- `electron/main.js`: `frame: false` (or `frame: true, titleBarStyle: 'hidden'` per platform).
- Owned title-bar element extended: takes drag region (`-webkit-app-region: drag`), holds menu bar entries + window-controls trio (min / max / close) on the right.
- New custom menu bar in the renderer that opens dropdowns on click — uses existing `topmenu-dropdown` element scaffold (already in `index.html:259`, currently dormant).
- Window controls UI: three buttons that call `window.rwanga.window.minimize / maximize / close` (preload bridge already exists, untouched).
- Tests: VS1 / VS2 / VS11 guards either deleted or inverted (must be authorized per §0).

**Scope (macOS):**
- `titleBarStyle: 'hiddenInset'` — keeps native traffic lights, lets us paint our own title bar content alongside them.
- Native menu bar stays (Apple HIG; menu lives on the global Mac menu bar at the top of the screen).
- The renderer's custom menu bar **is not rendered on macOS** — the platform-conditional decision is "native menu on Mac, owned menu on Windows/Linux".

**Files touched (estimate):**
- `electron/main.js`
- `electron/preload.js` (no — bridge already done)
- `electron/menu.js` (continues to define menu — used on macOS only post-mission)
- `renderer/index.html` (extended titlebar with owned menu + window controls)
- `renderer/css/shell.css` (titlebar styling; menu dropdown styling already partially exists)
- `renderer/js/app-shell.js` or new wiring (window-control button handlers, menu open/close logic)
- `tests/unit/shell/visual-stabilization.test.js` (VS1 / VS2 / VS11 either deleted or rewritten — requires §0 authorization)
- New guard file: `tests/unit/electron/owned-chrome.test.js` (asserts frame:false on Win/Linux paths, asserts hiddenInset on macOS path, asserts window-control IPC wiring, asserts drag region exists).

**Risks:**
- **macOS HIG compliance.** Custom title bars on macOS are tolerated when implemented correctly; broken implementations fail App Store review. We won't ship to App Store, but the user-perceived correctness matters.
- **Drag region holes.** Buttons inside the title bar need `-webkit-app-region: no-drag` or they swallow drag. Easy to get wrong.
- **Double-click-to-maximize on Windows.** Native title bars do this; owned title bars must reimplement it.
- **Aero Snap on Windows.** Edge-snap zones depend on the OS knowing where the title bar is. Frameless windows need to declare `-webkit-app-region: drag` correctly to keep snap behaviour. Mostly works out-of-the-box if drag is declared, but worth verifying.
- **Linux WM variance.** GNOME's CSD (Client-Side Decoration) protocol differs from KDE. Owned chrome on Linux is best-effort.
- **Existing `#rga-shell-titlebar` redundancy.** That strip already exists as a SECOND row below the OS chrome — the new owned chrome must REPLACE it, not add a third row.
- **Test-guard inversion risk.** Deleting VS1 / VS2 invites future drift back into the pre-V1 confused state. Replacement guards must be in place by the same commit.

**Stop-points:**
- **G-A0:** §0 unresolved → STOP. Workstream A cannot proceed.
- **G-A1:** if macOS testing reveals the owned chrome breaks traffic-light interactions → STOP, revert macOS path to fully native chrome, ship Windows/Linux only on first pass.
- **G-A2:** if any window action (maximize, minimize, snap, restore from minimize) breaks → STOP, revert frame setting, report.
- **G-A3:** if accessibility (keyboard navigation through the menu bar, screen-reader announcement of window controls) regresses → STOP, do not ship.

**Honest size estimate:** 2–3 weeks of focused work. Two thirds of that is per-platform verification.

---

### B — Rwanga Menu System

**Conditional on Workstream A** (the menu has to live somewhere — either in the new owned chrome from A, or in the native menu via macOS path).

**Scope:**
- New top-level: File / Edit / View / **Script** / **Tags** / **Export** / **Tools** / Help.
- Item placement (proposed — needs your sign-off):

  | Menu | Items |
  |---|---|
  | File | New Script · Open… · Open Folder… · Open Recent ▸ · Save · Save As… · Manage Storage… · Close · Quit |
  | Edit | Undo · Redo · Cut · Copy · Paste · Select All · Find in this script… · Find and Replace… |
  | View | Flow · Draft · Print (radio) · — · Toggle Sidebar · Toggle Inspector · Toggle Studio Panel · Toggle Scene Toolbox · — · Toggle Theme · — · Reload · Toggle Developer Tools (dev only) · Zoom In / Out / Reset · Toggle Fullscreen |
  | Script | Insert Scene · Renumber Scenes · Go to Scene… · Insert Page Break · Set Page Setup… · Set Script Language… |
  | Tags | Open Tag Manager · Add Tag to Selection · Filter by Tag… |
  | Export | Export to PDF… · Export to DOCX… (future-safe) · Export to Fountain (future-safe) · Export to Final Draft (future-safe) |
  | Tools | Command Palette · Settings · Check for Updates… · Load Sample Script |
  | Help | Documentation · Report a Bug · About Rwanga |

- Many items are unwired today (Find / Replace, Insert Scene, Renumber Scenes, Tag Manager, Settings, Documentation). Mission says "future-safe placeholders" — they go in greyed-out / disabled so the structure ships even if behaviour follows later.

**Files touched:**
- The menu definition file (location depends on Workstream A): either `electron/menu.js` (macOS path) or a new renderer-side menu controller (Win/Linux path).
- `renderer/index.html` boot-script menu action switch — extended with all the new menu actions that route to existing commands.
- New: `tests/unit/shell/bundle-A-menu-structure.test.js` (asserts top-level order, items per menu, wiring routes).

**Risks:**
- **Command ownership duplication.** Several actions are currently bound to multiple paths (Cmd+J / Cmd+` / palette / close button → studio panel toggle). The mission says "one command ownership path" — clarifying: I read this as "each menu item routes to ONE owner (Rga.Shell.StudioPanel.toggle, Rga.ViewMode.set, etc.)", not "remove the other paths". Keyboard shortcuts + command palette continue to work; menu becomes a third surface that calls the same owners.
- **Future-safe placeholders are footguns.** A greyed-out "Find and Replace" with no behaviour invites tickets. Better to mark them clearly: trailing "(coming soon)" suffix, or omit until ready.
- **Open Recent ▸ requires the recent-files list to be live.** Today `recent.list` IPC exists but `editor-empty-state-recent` reserves the DOM with no content wired — there's an existing T2 from the forensic report. Open Recent would surface that gap.

**Stop-points:**
- **G-B1:** if the proposed placement conflicts with established Rwanga vocabulary (e.g., "Tags" might mean Tag Registry or might mean Tag Marks — needs your call) → STOP, clarify.
- **G-B2:** if placeholder items (Find, Replace, Settings, etc.) need to be omitted rather than greyed → STOP, get the cull list before shipping.

**Honest size estimate:** 1–2 weeks. Most of the work is item placement decisions + per-item wiring verification. Once Workstream A is settled, the menu itself is mostly structural.

---

### C — Scene Toolbox Recovery

**Independent of A** (toolbox lives in the editor area, not chrome).

**Scope:**
- **Movable:** drag-handle on the toolbox header. New module: `Rga.Shell.SceneToolbox` (owns position state). Position persisted via WorkspaceState.
- **Dockable:** snap zones at left rail, right rail, floating (current position). Per-dock-zone CSS class on the toolbox + a small docking indicator while dragging.
- **Closable:** X button in toolbox header → hides via Layout (`Rga.Shell.Layout.sceneToolbox.visible = false`).
- **Reopenable from View → Toggle Scene Toolbox** (depends on Workstream B menu).
- **Manageable:** state lives in `Layout.sceneToolbox` (visible, position, dock).
- **Visual changes:** thin rail-like surface (the current 88px wide vertical column is already close); larger action icons; help text below each action (small tooltip-like label); the block-type `<select>` becomes a labelled dropdown.

**Files touched:**
- New module: `renderer/js/shell/scene-toolbox.js` (state owner, drag/dock logic).
- `renderer/index.html` (toolbox header gets drag handle + close button).
- `renderer/css/editor-prosemirror.css` (toolbox styling, dock-zone styles).
- `renderer/js/shell/layout.js` (extend Layout with `sceneToolbox` field).
- `renderer/js/shell/workspace-state.js` (persist new field).
- Tests: dragging, docking, close, reopen, persistence across reload.

**Risks:**
- **Phase 3 / Bundle 1 "no new shell module" guard.** This requires a new shell module. Either the guard's whitelist is extended, or the toolbox controller lives in an existing module (probably StudioPanel-adjacent in shell-controllers).
- **Phase 3 §C "preserve disabled state behaviour"** — engine-side `disabled` class wiring in v3 plugins must remain untouched. New positioning/visibility wraps around the existing engine hook.
- **Movable adds a real interaction surface.** Pointer events, drag listeners, dock snapping — non-trivial logic. New test guards must cover the state machine.
- **Floating-browser-extension feel** is the symptom. The rule "no floating-browser-extension feeling" means the floating state must be clearly anchored when dragged (visible drop zones, ghost preview, snap feedback) — not just "drag it anywhere".

**Stop-points:**
- **G-C1:** if movable requires touching v3 plugin code → STOP. Engine is off-limits per mission rules.
- **G-C2:** if the user wants drag-anywhere-floating instead of snap-to-dock-zones → STOP, re-scope.

**Honest size estimate:** 1.5–2 weeks. Movable + dockable is the most novel piece.

---

### D — Global Toolbar Recovery

**Independent of A** (can ship without owned chrome), but **better with A** (the toolbar's "first-class" feeling depends on it sitting in the global chrome area, not the editor area).

**Scope:**
- Move `#format-toolbar` out of `#editor-area` into the global chrome zone, sitting beneath the title bar (or beneath the owned menu bar after A lands).
- Toolbar becomes "screenplay mode" vs "text mode" via a mode toggle:
  - **Screenplay mode** (default): shows block-type insert / scene insert / page-break insert / transition insert. (These are PM commands; need new buttons.)
  - **Text mode**: current B/I/U/S/color/highlight/link/clear buttons.
- Toggle between modes via a small switcher at the toolbar's left edge.
- Toolbar visibility tied to Layout (`Layout.formatToolbar.visible`); can be hidden via View menu (depends on B).
- Hidden in Draft (continues — Draft strips all chrome).

**Files touched:**
- `renderer/index.html` (move `#format-toolbar` to global chrome zone; possibly rename to `#rga-toolbar`).
- `renderer/js/format-toolbar.js` (extend with mode switcher + new screenplay-mode buttons).
- `renderer/css/editor-prosemirror.css` (move toolbar styles out of editor-area-scoped rules; possibly relocate to shell.css).
- `renderer/css/shell.css` (toolbar styling as global chrome).
- Tests: toolbar mounts in global chrome, mode switch works, hide rule applies in Draft.

**Risks:**
- **"do not duplicate commands" rule.** New screenplay-mode buttons (Insert Scene, Insert Page Break, etc.) might overlap with Workstream B's Script menu entries. Single ownership chain: both menu and toolbar route to the same engine commands. No duplication of LOGIC, just two access surfaces.
- **"no editor mutation shortcuts" rule** — I read this as: toolbar must not register new keyboard shortcuts beyond what already exists. Existing Ctrl+B / Ctrl+I etc. continue to work; toolbar buttons fire the same handlers.
- **Per-script-language toolbar variants** are not in scope but the structure needs to allow it later (Kurdish / Arabic scripts may want different toolbar contents).

**Stop-points:**
- **G-D1:** if "screenplay mode" buttons require new engine commands not currently exposed → STOP. Define the command set before building UI.
- **G-D2:** if relocating the toolbar breaks the existing Draft hide rule → STOP, fix hide rule before continuing.

**Honest size estimate:** 1 week. Mostly DOM/CSS move + adding mode toggle + adding new screenplay-mode buttons (the buttons themselves are command wiring, not new logic).

---

### E — Studio Panel Recovery

**Independent of all other workstreams.** Cheapest workstream in the mission.

**Scope:**
- Verify all four close/reopen paths still work (Cmd+J, Cmd+`, close button, palette).
- Add **"View → Studio Panel" menu entry** that toggles visibility (depends on Workstream B menu).
- Clarify minimize vs close:
  - **Minimize** = collapse to the panel's tab bar only (keep ~32px of header visible so user can click to restore).
  - **Close** = hide entirely (`Layout.studioPanel.visible = false`); reopen from menu/keyboard/palette.
- Today there's only one "collapse" state. The mission asks for a three-state model: visible / minimized / closed.
- Add minimize button next to the existing close button in the panel header.

**Files touched:**
- `renderer/js/shell/studio-panel.js` (extend state model from boolean visibility to enum: 'open' | 'minimized' | 'closed').
- `renderer/js/shell/layout.js` (extend `studioPanel.visible` boolean → `studioPanel.state` enum; preserve backward compat for stored workspace state).
- `renderer/css/components.css` or shell.css (add `.bottom-panel-minimized` CSS class — only header visible).
- `renderer/index.html` (minimize button in panel header).
- Menu entry depends on B.
- Tests: three-state transitions, persistence across reload, recovery paths.

**Risks:**
- **Backward compat for stored Layout.** Existing users have `studioPanel: { visible: true }` in their workspace state. Need migration logic (true → 'open', false → 'closed').
- **State model change touches Layout** — Layout is part of the locked shell ownership. Extending Layout's shape may collide with G4–G7 storage ownership guards. Need to check.

**Stop-points:**
- **G-E1:** if extending Layout's shape collides with G4–G7 (storage ownership) guards → STOP, decide whether to extend the guard whitelist or use a different state location.

**Honest size estimate:** 2–3 days. Smallest workstream.

---

### F — Status Bar Recovery

**Independent of all other workstreams.** Pure CSS + small DOM grouping change.

**Scope:**
- Regroup the 7 existing segments into three flex sections:
  - **Left:** scene · issues · sync
  - **Center:** document context (current block type + page X / Y — "writer's current location" context)
  - **Right:** wordCount · language · viewMode · theme · (settings action?)
- "issues" segment doesn't exist today — needs new derivation source. If "issues" maps to validation problems (Problems tab in studio panel), this is a real new SSOT. **Stop-point: if "issues" is meant to be new, scope it as a tiny new derivation; if it's mis-named for "sync", clarify.**
- "actions" on the right side — buttons or icons? Today the status bar is text-only. Mission says "instruments" (still text/light icons), not "buttons" (interactive). Clarify.
- The existing viewMode dropdown (Bundle 1 §A) stays — moves to the right group.
- "theme" segment is new — shows current theme name, click-to-toggle. Today theme toggle lives in titlebar; mission may want it duplicated here (consistent with "right side: actions").

**Files touched:**
- `renderer/js/shell/status-bar.js` (segment definitions: add `cls` for section, group rendering into three containers).
- `renderer/css/shell.css` (3-section flex grid).
- Tests: update existing status-bar guards for new structure; new tests for sectioning.

**Risks:**
- **Existing tests assert "7 segments in this order".** All those tests need updates to assert the new 3-section structure with the same 7 segments grouped.
- **"issues" segment**: not in current data flow. If real, need a new source.

**Stop-points:**
- **G-F1:** if "issues" is meant to be new (vs renamed "sync") → STOP, clarify whether scope includes a new validation-issues source.

**Honest size estimate:** 2–3 days.

---

## 3. Sequencing recommendation

**Cannot avoid §0 first.** Workstreams A, B, C, D all benefit from §0 being resolved.

**Recommended order (after §0 is resolved):**

1. **F — Status Bar** (2–3 days, independent, lowest risk, finishes a noticeable surface).
2. **E — Studio Panel** (2–3 days, independent, lowest risk after F).
3. **A — Owned Chrome** (2–3 weeks, hardest, unlocks B + D).
4. **B — Menu System** (1–2 weeks after A).
5. **D — Toolbar Recovery** (1 week after A + B).
6. **C — Scene Toolbox Recovery** (1.5–2 weeks, independent of A; can run in parallel with B/D if a second hand is available).

**Total honest estimate: 6–10 weeks of focused work** for the whole mission. Not 6–10 weeks of elapsed time — focused engineering time. Elapsed will be longer because of verification cycles and user-feedback loops.

**Tests-green-per-commit acceptance:** every workstream lands as one or more commits, each green. Bundle 1 / Bundle 2 cadence applies. Some workstreams (A, C) will need multiple commits because the surface area is too large for one.

---

## 4. Stop-point register (consolidated)

| Gate | Trigger | What to ask |
|---|---|---|
| **G-0** | Workstream A reverses VS1 / VS2 / VS11 locks | "Authorize deleting / inverting these guards? They encode the older native-first direction. Yes = proceed with owned chrome. No = mission cannot complete §A." |
| **G-0-mac** | Apple HIG forbids fully-owned macOS chrome | "Accept hybrid macOS path (hiddenInset + native menu)? Or skip macOS in §A?" |
| **G-A1–G-A3** | macOS behaviour / window action / accessibility regression | Stop, revert, report. |
| **G-B1** | Item placement vocabulary unclear (Tags / Tools / Script meaning) | Pause for sign-off on the placement table. |
| **G-B2** | Future-safe placeholders should be omitted, not greyed | Get the cull list before shipping. |
| **G-C1** | Movable requires v3 plugin changes | Stop. Engine off-limits. |
| **G-C2** | Drag-anywhere vs snap-to-dock unclear | Stop, re-scope. |
| **G-D1** | Screenplay-mode toolbar buttons need new engine commands | Define command set first. |
| **G-D2** | Toolbar move breaks Draft hide rule | Fix before continuing. |
| **G-E1** | Layout shape extension collides with G4–G7 storage ownership | Decide guard whitelist extension OR alternate state location. |
| **G-F1** | "issues" segment scope unclear | Clarify whether new validation source is required. |
| **G-engine** | Any workstream requires `framework/` / `doc-types/` / `editor/` / schema changes | STOP. Engine off-limits per mission rules. |

---

## 5. Open questions blocking implementation

Before any commit, the following need answers:

1. **§0 — Authorize the lock reversal?** Yes or no.
2. **§0-mac — Hybrid macOS path acceptable, or Windows/Linux only on first pass?** Pick one.
3. **§B — Approve the menu item placement table** (or send a revised one).
4. **§B — Greyed-out placeholders vs omit-until-ready?** Pick the policy.
5. **§C — Drag-anywhere vs snap-to-dock-zones?** Pick the interaction model.
6. **§F — "issues" segment**: new source, or renamed "sync"?
7. **§F — Right-side "actions"**: text/light-icons (instruments) or interactive buttons?

These are the blockers. Everything else (file targets, approach, risk mitigation) is decided.

---

## 6. Confidence

**On the mission as specified, given current information: 55 / 100.**

The breakdown:
- F and E will land cleanly. ~95% confidence on those alone.
- A is the wildcard. Cross-platform owned chrome that doesn't break things on day one of public download is genuinely hard. ~50% confidence on hitting the bar in one pass.
- B is straightforward once A lands. ~85% confidence.
- C is novel surface but bounded. ~70% confidence.
- D depends on A. ~80% confidence after A.

The 55 is dominated by A. If §0 is resolved and we accept hybrid macOS, A becomes ~70%, and the mission overall climbs to ~75%. If the user authorizes Windows/Linux-only ownership on first pass (skipping mac entirely), A climbs higher still.

The shell becoming what the design shows is achievable. It is **not** a small lift, and it does require reversing one of the strongest locks in the codebase.

---

## 7. What I will NOT do without authorization

- Delete VS1 / VS2 / VS11 guards.
- Set `frame: false` on `electron/main.js`.
- Hide the native menu bar on macOS.
- Move format-toolbar out of editor-area while Draft hide rule is still scoped to editor-area only.
- Extend `Rga.Shell.Layout` schema (G4–G7 storage guards apply).
- Add new shell modules in `renderer/js/shell/` (Phase 3 ownership guard applies — would need extension).

Each of these has a guard behind it. The guards were written by previous sessions for specific reasons. Crossing them is a real decision, not a side-effect.

---

## 8. Recommended decision path

1. **Right now:** answer questions §5.1, §5.2 (the §0 questions). Without these, A cannot start.
2. **After §0:** answer §5.3 through §5.7 in batch. They're small.
3. **Then:** open Workstream F first (smallest, most reversible, validates the per-workstream commit cadence on this mission).
4. **Then E.**
5. **Then A.** This is when the project shape changes.
6. **B → D → C** afterward.

End of plan. No code changes. Awaiting §5 answers.
