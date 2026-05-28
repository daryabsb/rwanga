# Editor Viewport / Platform Boundary Contract

> **Filmustageation Phase 1A — Slice F1A.1.**
> Created: 2026-05-28 · Owner: Rwanga Editor · Status: contract.
> Companion docs: `RWANGA_EDITOR_CORE_PLUGIN_PLATFORM_DOCTRINE.md`, `FILMUSTAGEATION_PHASE1A_SHELL_AUDIT.md`.

This contract codifies the boundary between the Rwanga Editor renderer (the viewport) and any future platform host that may embed it. It exists **before** any platform integration ships, by design. The boundary is preventive — its job is to make accidental contamination cost obvious during code review.

The contract is binding on:
- the editor renderer (everything under `rwanga-editor/renderer/`),
- the Electron host (`rwanga-editor/electron/`),
- any future platform wrapper (the Rwanga Preproduction Platform, web embeds, third-party hosts).

---

## 1. The two surfaces

| Surface | Scope | Who owns it |
|---|---|---|
| **Editor viewport** | The DOM subtree rooted at `#app`. The `window.Rga.*` JS namespace. The `document.title`. The body/html `data-*` attributes the shell writes (Settings applicators, layout state). | **CORE.** Owned by the renderer. |
| **Platform host** | Everything outside `#app` (in a future web embed) or the OS chrome (in Electron today). The optional `window.rwanga.platform.*` JS namespace. | **Platform.** Owned by whichever product wraps the editor. |

These two surfaces communicate through one bridge: `window.rwanga` (the preload). The bridge is one-way at design time — the platform provides; the editor reads (optionally).

---

## 2. Protected DOM regions (editor-owned)

The following selectors are **CORE-owned**. A platform host MUST NOT mutate them, inject children into them, or replace them at any time after `DOMContentLoaded`.

| Selector | Owner | Description |
|---|---|---|
| `#app` | CORE | The application root. The platform host may render siblings of `#app` (in a future web embed) but must never reach inside. |
| `#rga-shell-titlebar` | CORE | Title bar (Row 1). Includes window controls; replaced by OS chrome in non-Electron hosts. |
| `#rga-shell-menubar` | CORE | Menu bar (Row 2). Includes File / Edit / View / Script / Tags / Tools / Export / Help. |
| `#rga-shell-toolbar` | CORE | Writing instruments (Row 3). Plugin-contributed groups land here via the toolbar contribution API (future F1A.6). |
| `#workspace` | CORE | Activity rail + sidebar + center column + inspector grid container. |
| `#activity-bar` | CORE | Activity rail. Plugin rail items register via `Rga.Shell.Sidebar.registerPanel`. |
| `#rga-shell-sidebar-host` | CORE frame, plugin contents | Sidebar mount target. Frame is CORE; the active panel's mount renders inside. |
| `#editor-container`, `#editor`, `.rga-page-row`, `.flow-line-gutter`, `#tab-content-host` | CORE | Editor mount and its chrome (gutter, page row, tab host). |
| `#bottom-panel`, `.bp-tab`, `.bp-content` | CORE | Studio Panel (Scene / Notes / Flags / Problems / Breakdown). |
| `#inspector-panel`, `#inspector-toggle`, `.inspector-header`, `.inspector-body` | CORE frame, future plugin contents | Inspector panel. Frame is CORE; selection-driven content (future F1A.3/F1A.5) will register here. |
| `#status-bar` | CORE | Status bar. Segments are contributed via the status-bar contribution API (future F1A.4). |
| `#topmenu-dropdown`, `#context-menu`, `#command-palette`, `#format-color-popover`, `#format-link-dialog`, `#format-annotation-dialog`, `#draft-exit`, `#draft-mode-footer` | CORE | Overlays. Platform code never opens, closes, or styles these. |

A platform that needs to surface information **adjacent** to any of these regions does so by rendering OUTSIDE `#app` (siblings in a web embed; the OS title bar in Electron) — never inside.

---

## 3. CORE-owned JS surfaces

The following globals are CORE-owned. The platform host MUST NOT define, replace, or modify properties of:

- `window.Rga` — the renderer's namespace root. All editor modules live here.
- `window.RgaProseMirror` — the ProseMirror bundle.
- `window.__setCalls` and other test instrumentation that already exists for unit/Playwright coverage.
- The shell's owned `document.body` classes and `data-*` attributes (full enumeration tracked by the drift guard in `ownership-stab-slice2.test.js`).
- The Settings registry, Store, and applicator pipeline.

A platform integration that needs to react to editor state subscribes via the documented public APIs (e.g., `Rga.ScriptSession.subscribe`, `Rga.Settings.Store.subscribe`). It does not poll, monkey-patch, or read private state.

---

## 4. The `window.rwanga.platform` namespace

The bridge `window.rwanga` (Electron preload — see `rwanga-editor/electron/preload.js`) currently exposes these IO namespaces: `files`, `recent`, `autosave`, `workspace`, `prefs`, `export`, `storage`, `updates`, `window`, `lifecycle`, `menu`, `on`, `shell`. These are **CORE host services**, not platform integration — they ship in every Electron build.

The slot `window.rwanga.platform` is **reserved** for platform-host integration. It is governed by these rules:

### 4.1 Optionality

- `window.rwanga.platform` is **always optional**. In standalone Electron (today's only build) it is `undefined`. In a future web embed under the Rwanga Preproduction Platform, it may be present.
- The editor MUST boot, mount the editor, open / edit / save `.rga` files, and run plugin AI (with the user's own key) **without any property of `window.rwanga.platform` being present**. This is the OSS-safe minimum.
- A platform-only feature is an *additive* capability, never a runtime dependency.

### 4.2 Absence behaviour

When `window.rwanga.platform` is `undefined`:
- The editor renderer must not log a warning, must not show a degraded-mode banner, must not change visible chrome.
- Any consumer that would call a platform method short-circuits silently (the consumer is responsible for the guard).
- Settings, ScriptSession, Sidebar, ActivityRail, Inspector, StudioPanel, StatusBar, TitleBar, TabManager — all initialize the same as they do today.

### 4.3 Consumer guard pattern

Editor code that **optionally** consumes a platform feature uses one of these two patterns:

```js
// Pattern A — single feature probe.
if (window.rwanga && window.rwanga.platform &&
    typeof window.rwanga.platform.shareScript === 'function') {
  window.rwanga.platform.shareScript(doc);
}

// Pattern B — via the Rga.Platform helper (renderer/js/platform.js).
if (Rga.Platform.has('shareScript')) {
  Rga.Platform.invoke('shareScript', doc);
}
```

No editor module imports anything from `window.rwanga.platform` at module top level. Probes happen at call sites, after the user takes an action.

### 4.4 No editor → platform dependencies

The editor MUST NOT:
- Assume any auth state.
- Assume any user identity.
- Assume any cloud sync is happening.
- Assume any collaboration session is active.
- Assume any project/asset linking exists.

If a feature requires any of those, it is a **platform-layer feature** and lives outside the editor renderer.

### 4.5 Forward compatibility

The shape of `window.rwanga.platform` is not specified here. When a platform integration ships, that platform documents its own shape under `docs/filmustageation/PLATFORM_*.md`. Editor consumers add probes against documented method names; absence remains the default.

---

## 5. Allowed integration points

The only allowed channels between the editor and a future platform host are:

1. **`window.rwanga.platform.*`** — opaque object the platform provides. One-way read by the editor.
2. **`window.rwanga.on.*`** event subscriptions — the preload already exposes a small event surface (see `electron/preload.js`'s `on:` block). A future platform may publish additional events; consumers guard for presence as in §4.3.
3. **CORE public APIs** — `Rga.ScriptSession.subscribe`, `Rga.Settings.Store.subscribe`, `Rga.Shell.Sidebar.onChange`, etc. The platform reads from these; the editor never reads platform state through them.
4. **Future per-feature DOM injection points** — only the contribution APIs the editor publishes (sidebar `registerPanel`, status bar `registerSegment` (F1A.4), toolbar `registerGroup` (F1A.6), inspector `registerPanel` (F1A.3)). Each contribution API documents the slot's shape; the platform never bypasses them.

No other channel is permitted. In particular:
- The platform does not `document.querySelector` into CORE DOM regions.
- The platform does not assign to or mutate `window.Rga.*`.
- The platform does not register listeners on CORE-owned DOM elements directly.

---

## 6. Enforcement

| Layer | Mechanism | Where |
|---|---|---|
| Documentation | This contract | `docs/filmustageation/EDITOR_VIEWPORT_PLATFORM_BOUNDARY_CONTRACT.md` |
| Code review | A change that violates §2–§5 is rejected | reviewer checklist |
| Runtime smoke | Standalone boot succeeds with no platform globals | `tests/e2e/platform-boundary/no-platform-globals.spec.js` |
| API hint | A single, consistent helper for consumer guards | `renderer/js/platform.js` (`Rga.Platform`) |

The smoke spec asserts:
- `window.rwanga.platform === undefined` at boot in Electron.
- The shell modules (Layout, Sidebar, ActivityRail, StudioPanel, TitleBar, StatusBar, ScriptSession, Settings.Store, Settings.Applicators) all initialize without error.
- No console error references a missing platform global.
- `Rga.Platform.has(...)` returns `false` for any probe in standalone mode.
- The editor remains interactive (editor mount succeeded, Settings UI opens) without any platform global being defined.

Heavier enforcement (lint rules forbidding `window.rwanga.platform.` outside guarded probes; import-graph tests) is deferred. The contract + smoke pair is sufficient at v1 with no live platform consumer.

---

## 7. Existing-code audit (2026-05-28)

A repo-wide grep for `window\.rwanga\.platform` returned **zero matches** before this contract landed. No editor code reads or writes `window.rwanga.platform`; no existing module violates the boundary.

The boundary lands clean.

---

## 8. What this contract is NOT

- It is not a platform implementation. No platform exists today.
- It is not an iframe / sandbox specification. Future web embeds may use any DOM containment strategy; this contract only specifies the **logical** boundary.
- It is not a permissions model. CORE trusts its own modules; platform trust is established when a platform ships.
- It is not a security boundary against malicious code. Both surfaces run in the same renderer process; the contract is a clarity device, not a sandbox.

The boundary will mature when the first real platform integration ships. Until then, this contract names the seam so it does not erode by accretion.

---

# STOP

This is the F1A.1 boundary contract. No implementation logic depends on the platform host. The smoke spec at `tests/e2e/platform-boundary/no-platform-globals.spec.js` is the runtime guard; `renderer/js/platform.js` is the single consumer helper. Both are minimal by design.
