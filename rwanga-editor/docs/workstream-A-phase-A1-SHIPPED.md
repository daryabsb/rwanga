# Workstream A — Phase A1 (Windows) — SHIPPED

**Status:** **SHIPPED 2026-05-17.**
**Scope shipped:** Windows owned chrome. Linux best-effort (Phase A2) and macOS hybrid (Phase A3) follow in later mission turns. The macOS hiddenInset + Linux frame:false code paths are wired in A1 but not yet phase-verified.
**Commit range:** `a0226983` (A0 guards) → `4bf4d9b0` (A1) → `59dc2a92` (A2) → `d28c6b51` (A3) → `e19ef643` (A4) → `e22e3371` (A4.1 accelerator correction) → `2ef40715` (A5) → THIS COMMIT (A6 cleanup).

---

## 1. Guard replacement matrix

| Retired guard | Why retired | Replacement guard | Replacement file |
|---|---|---|---|
| **VS1** — *index.html contains no `#menu-bar` element* | Native-first lock that motivated the deletion was reversed by mission authorization. The new owned menu surface uses a different element id (`#rga-shell-menubar`), so VS1's letter was already trivially satisfied; its spirit is replaced by a constructive contract. | **G-OC-4** — *`#rga-shell-menubar` exists with exactly 8 entries in declared order; each is a `<button>` with `data-menu`; nav carries `aria-label`* | `tests/unit/shell/owned-chrome-menu-ownership.test.js` |
| **VS2** — *no fake window controls and no `#app-logo`* | The "fake" qualifier was the entire point — VS2 protected against visual stand-ins for missing IPC. A3 wired real controls (`#rga-shell-window-{min,max,close}`) to the pre-existing `window.rwanga.window.*` IPC bridge. | **G-OC-3** — *three controls exist, each routes to real IPC, each carries `aria-label`, each declares `-webkit-app-region: no-drag`, close has `--danger` variant* | `tests/unit/shell/owned-chrome-window-controls.test.js` |
| **VS11** — *main process does not call `Menu.setApplicationMenu`* | A4 introduced platform-conditional menu suppression: `setApplicationMenu(null)` on Win/Linux, `setApplicationMenu(builtMenu)` on macOS (HIG-required global menu). | **G-OC-5** — *electron/menu.js calls `setApplicationMenu(null)` on Win/Linux and `setApplicationMenu(builtMenu)` on macOS; platform branch is explicit and grep-able* | `tests/unit/shell/owned-chrome-menu-ownership.test.js` |

VS3 through VS10 remain active — they protect concerns unrelated to chrome ownership (status-bar background, tokens, scene-navigator grid, scene-toolbox sticky avoidance, bp-tab indicator, inspector header casing).

---

## 2. Owned Chrome — permanent guard suite

| Guard | Concern | Source file | Stage that activated it |
|---|---|---|---|
| **G-OC-1** | Main process: Windows + Linux `frame: false`; macOS `titleBarStyle: 'hiddenInset'`. No `frame: true` literal in real code. | `tests/unit/electron/owned-chrome-main-process.test.js` | A1 |
| **G-OC-2** | Renderer: exactly one `#rga-shell-titlebar` with `-webkit-app-region: drag`; 3-zone layout (`-app` / `-title` / `-actions`). | `tests/unit/shell/owned-chrome-windows.test.js` | A2 |
| **G-OC-3** | Three window-control buttons exist, route to existing IPC, carry `aria-label`, declare `no-drag`, close has `--danger` variant. | `tests/unit/shell/owned-chrome-window-controls.test.js` | A3 |
| **G-OC-4** | `#rga-shell-menubar` with exactly 8 entries (File · Edit · View · Script · Tags · Tools · Export · Help) as `<button>` with `data-menu`. | `tests/unit/shell/owned-chrome-menu-ownership.test.js` | A4 |
| **G-OC-5** | `electron/menu.js` platform-conditional `setApplicationMenu` (Win/Linux null, macOS built). | `tests/unit/shell/owned-chrome-menu-ownership.test.js` | A4 |
| **G-OC-6** | Every interactive title-bar element declares `-webkit-app-region: no-drag`. No `no-drag` declarations outside chrome elements. | `tests/unit/shell/owned-chrome-drag-region.test.js` | A3 / A5 |
| **G-OC-7** | Double-click handler on the title-bar drag region calls `window.rwanga.window.maximize()`. | `tests/unit/shell/owned-chrome-drag-region.test.js` | A5 |
| **G-OC-8** | Accessibility — every chrome control has `aria-label` or visible text; menubar items are keyboard-focusable. | `tests/unit/shell/owned-chrome-drag-region.test.js` | A4 / A5 |
| **G-OC-A4.1-1 … 5** | Accelerator ownership: one command → one owner → one accelerator. Audit, file.saveAs / panel.sceneNavigator binding, no hardcoded accelerator strings in MENU_DEFS, no dangling command refs, formatter sanity. | `tests/unit/shell/owned-chrome-A4.1-accelerator-ownership.test.js` | A4.1 |

A6 removed every transitional `isXLanded` skip-gate. All guards now assert unconditionally; CI fails on any regression.

---

## 3. Compatibility inventory

Surfaces that gained or changed contracts during Phase A1:

| Item | Before | After |
|---|---|---|
| Window frame (Win/Linux) | OS-managed (`frame: true`) | App-owned (`frame: false`); Rwanga paints title + menu + controls |
| Window frame (macOS) | OS-managed (`frame: true`) | `titleBarStyle: 'hiddenInset'` (native traffic lights preserved; Rwanga paints title content beside them) |
| Title bar surface | 28px strip stacked below the OS title bar (redundant) | Three-zone owned strip — `app · script · actions` — IS the only title bar |
| Window controls (Win/Linux) | OS native | `#rga-shell-window-{min,max,close}` → `window.rwanga.window.*` IPC |
| Window controls (macOS) | OS native (in OS title bar) | OS native (in hiddenInset title bar — preserved per HIG) |
| Menu surface (Win/Linux) | Native Electron menu | `#rga-shell-menubar` owned 8-entry dropdown bar; native menu suppressed via `Menu.setApplicationMenu(null)` |
| Menu surface (macOS) | Native Electron menu (global Mac menu) | Native Electron menu (global Mac menu) — preserved per HIG |
| Menu accelerators | Bound on native menu items | Bound in `Rga.KeyboardRegistry` via `registerCommand` (the §A4.1 SSOT). Menu items reference command IDs; accelerator labels resolved by `commandAccelerator(id)`. |
| Save As accelerator | Ctrl+Shift+S via native menu (lost when native menu suppressed) | Ctrl+Shift+S via KR (restored §A4.1). |
| Scene Navigator accelerator | Ctrl+Shift+S (panel toggle — pre-empted by Save As) | Ctrl+Shift+1 (moved §A4.1 to free the universal Save As combo) |
| Drag region | OS title bar | `-webkit-app-region: drag` on `#rga-shell-titlebar` + `#rga-shell-menubar` |
| Drag islands | OS-managed | Every interactive child declares `-webkit-app-region: no-drag`; G-OC-6 enforces |
| Double-click maximize | OS-managed | Renderer-side handler in `title-bar.js` calling `window.rwanga.window.maximize()`; G-OC-7 enforces existence |
| `Rga.KeyboardRegistry` API | `init / register / _all / _reset` | + `registerCommand / commandAccelerator / invokeCommand / audit` (§A4.1) |
| `window.rwanga.window.*` IPC | Existed but unused | Consumed by the owned window controls + double-click maximize |

External (pre-§A) APIs that still work the same:

- `window.rwanga.files.*` / `recent.*` / `autosave.*` / `workspace.*` / `prefs.*` / `export.*` / `storage.*` / `updates.*` — unchanged.
- `Rga.FileManager.*` / `Rga.ViewMode.*` / `Rga.Shell.StudioPanel.*` / `Rga.Theme.*` / `Rga.CommandPalette.*` — unchanged signatures; menu now invokes them via `KR.invokeCommand` instead of direct calls.
- All editor / engine APIs — untouched (mission rule).

---

## 4. Transitional assertions removed

The §A0–§A5 guards used `isXLanded` skip-predicates so they could exist before their target capability shipped (the brief's "no guard vacuum" rule). A6 removed them:

| File | Removed predicate(s) |
|---|---|
| `owned-chrome-main-process.test.js` | `isA1Landed` |
| `owned-chrome-windows.test.js` | `isA2Landed` |
| `owned-chrome-window-controls.test.js` | `isA3Landed` |
| `owned-chrome-menu-ownership.test.js` | `isA4Landed`, `isA4MenuJsLanded` |
| `owned-chrome-drag-region.test.js` | `isA3OrLaterLanded`, `isA5Landed`, the ad-hoc `id="rga-shell-menubar"` gate |

Every G-OC-* assertion now runs unconditionally; a runtime regression that returns the chrome to native fails CI immediately.

---

## 5. Final Phase A1 status

| Concern | Status |
|---|---|
| Windows owned chrome | ✅ SHIPPED (A0 → A6) |
| Linux best-effort | DEFERRED — Phase A2 (per mission authorization) |
| macOS hybrid | DEFERRED — Phase A3 (code paths preemptively wired in A1) |
| Replacement guards | ✅ Active, no skip-gates |
| Legacy guards retired | ✅ VS1, VS2, VS11 |
| Manual smoke checklist | `docs/workstream-A-windows-smoke-checklist.md` — A6 line item: "no runtime change; checklist for A5 still valid" |
| Test count delta | 760 (pre-mission) → 785 (post-A6). Net +25 tests across the mission, with 8 G-OC + 7 G-OC-A4.1 guards permanently locking the new contract. |
| Mission risk before phase | 75 / 100 (per architecture report) |
| Mission risk now (Phase A1 only) | Verification cycle outstanding on Windows; Linux + macOS still ahead |

Phase A1 closes. The mission's biggest reversal — native-first → owned chrome — is now in the codebase and CI-enforced on Windows.

End of report.
