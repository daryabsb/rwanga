# Rwanga — Owned Chrome Architecture Report

**Date:** 2026-05-17
**Status:** INVESTIGATION + ARCHITECTURE ONLY. No code changes, no runtime edits, no experimentation.
**Scope:** Workstream A of the Studio Shell Recovery Mission. Identity-level chrome reversal: title bar, menu bar, window controls, drag regions, platform behaviour.
**Authorization basis:** the strategic reversal of VS1 / VS2 / VS11 has been approved in principle this session; this report is the architectural prerequisite before any commit lands.

**Cross-reference:**
- `docs/studio-shell-recovery-plan.md` — mission plan, §0 lock collision narrative.
- `docs/editor-recovery-checkpoint-review.md` — perception vs technical-correctness asymmetry.

---

## 1. Current ownership map

### 1.1 Today (native-first)

```
OS
  ↓ owns: title bar text, window controls (min/max/close),
          drag region, menu bar (macOS global / Win+Linux in-window),
          resize edges, focus state, theme of native chrome
Electron
  ↓ delegates: title bar text (window.setTitle), menu definition
              (Menu.setApplicationMenu), keyboard accelerators bound
              to menu items
Rwanga
  ↓ owns: a redundant 28px #rga-shell-titlebar strip below the
          OS title bar — shows "Rwanga · {script}" + theme toggle +
          avatar placeholder. Lives in renderer; cannot host menu
          dropdowns; not draggable.
```

Result: the user sees **two stacked title bars** on Windows and Linux. The OS bar (Windows blue strip, or Linux WM decoration) is the dominant chrome. The Rwanga strip below it reads as an extra row of UI that doesn't belong to anything.

### 1.2 Target (Rwanga-owned chrome on Win/Linux; hybrid on macOS)

```
OS
  ↓ owns: window-level events (focus, blur, resize edges, snap-to-
          screen-edge), accessibility tree base, font rendering
Electron transport layer
  ↓ owns: frame flag, titleBarStyle hint, IPC bridge for window
          actions, native menu hosting (macOS path), DevTools
Rwanga chrome ownership
  ↓ owns: title bar visual + content, menu bar visual + dropdowns
          (Win/Linux), window control visual + click → IPC,
          drag region declaration, theme styling, focus rings on
          custom controls, ARIA labels, keyboard navigation through
          owned menu
```

### 1.3 Per-concern ownership table

| Concern | Today | Target Windows | Target Linux | Target macOS |
|---|---|---|---|---|
| Title text | OS (via window.setTitle) | Rwanga | Rwanga | Rwanga (painted in hiddenInset strip) |
| Title drag | OS (whole native bar) | Rwanga (`-webkit-app-region: drag`) | Rwanga (`-webkit-app-region: drag`) | Rwanga (`-webkit-app-region: drag` on hiddenInset strip) |
| Window controls (min/max/close) | OS | Rwanga buttons → IPC → native action | Rwanga buttons → IPC → native action | OS (native traffic lights, top-left, preserved by hiddenInset) |
| Menu bar visual | OS (Win/Linux) / OS-global (macOS) | Rwanga in-window menu dropdowns | Rwanga in-window menu dropdowns | OS-global Mac menu bar (cannot be moved) |
| Menu definition | Electron's Menu.setApplicationMenu | Rwanga renderer registry (no native menu) | Rwanga renderer registry (no native menu) | Electron's Menu.setApplicationMenu (definition only; presentation is OS) |
| Menu accelerators | Native accelerator binding | Rwanga keyboard registry routes to same mutators | Rwanga keyboard registry routes to same mutators | Native accelerators (Cmd+Q, Cmd+W, etc. — OS expects these) |
| Drag region | Implicit (whole native bar) | Explicit via `-webkit-app-region: drag` on owned strip | Explicit via `-webkit-app-region: drag` | Explicit via `-webkit-app-region: drag` (on owned strip beside traffic lights) |
| Resize edges | OS (whole window) | OS (still managed by frameless window; Aero Snap, resize cursors still work) | OS (compositor-dependent — see §2) | OS (unchanged from native) |
| Minimize action | OS-native (decoration click) | Rwanga button → `window.rwanga.window.minimize` → IPC | Same | OS-native (traffic light) |
| Maximize action | OS-native | Rwanga button → IPC (with double-click-to-maximize on title bar reimplemented) | Same | OS-native |
| Close action | OS-native | Rwanga button → IPC | Same | OS-native (red traffic light) |
| Focus state visual | OS (active/inactive native chrome shading) | Rwanga (custom active/inactive theming on the owned strip) | Same | OS shades traffic lights, Rwanga shades the rest |
| Accessibility tree | OS exposes native chrome correctly | Rwanga must add ARIA labels + roles on every owned control | Same | Native traffic lights still announce correctly; Rwanga-owned content needs ARIA |
| Keyboard nav into menu bar | F10 (Win) / Alt | F10 / Alt → Rwanga focus into menu bar | F10 / Alt → Rwanga focus into menu bar | Native (Cmd+Shift+/ to focus help menu) |
| Theme of chrome | OS (mostly ignores app theme on Windows) | Fully Rwanga (matches app theme on every paint) | Fully Rwanga | Vibrancy + Rwanga overlays |
| Platform conventions visible | Native chrome IS the convention | Discord/Slack/VS-Code pattern (well-trodden) | GNOME CSD-like vs KDE SSD (variable) | hiddenInset is HIG-compliant |

---

## 2. Platform matrix

### 2.1 Windows

| Field | Detail |
|---|---|
| **Allowed** | `frame: false`; custom title bar with `-webkit-app-region: drag`; custom menu bar; custom window controls (min/max/close) on the right side; theme-aware chrome; Aero Snap (drag to edge); Snap Layouts (Win11) if `titleBarOverlay` is configured |
| **Restricted** | Snap Layouts require specific button geometry to be reported via `titleBarOverlay` — not insurmountable but adds work; double-click-on-title-to-maximize must be reimplemented in renderer; shake-to-minimize-others (Aero Shake) is OS-level, unaffected |
| **Native requirements** | None hard — Windows accepts fully custom chrome. Most major Electron apps (Discord, VS Code optional mode, GitHub Desktop, Slack) ship this way on Windows |
| **Risk level** | **MEDIUM**. Well-trodden path. Failure modes are visible immediately and easy to revert |
| **Hybrid handling** | None needed — fully owned on Windows is the recommended end state |

### 2.2 Linux

| Field | Detail |
|---|---|
| **Allowed** | `frame: false`; custom title bar; custom menu bar; custom window controls; drag region; resize edges still managed by compositor |
| **Restricted** | Resize-edge gap on some wlroots-based Wayland compositors (Sway, river) — Electron's frameless mode can leave invisible resize handles that don't always grab; Server-Side Decoration (KDE default) vs Client-Side Decoration (GNOME default) means the visual experience differs across desktops; no standard "snap" convention across distros |
| **Native requirements** | None hard, but users expect their desktop's conventions to hold. GNOME users may dislike Windows-style top-right controls; KDE users may dislike the absence of titlebar buttons they configured |
| **Risk level** | **MEDIUM-HIGH**. Compositor variance is the wildcard. Testing requires X11 + Wayland + GNOME + KDE coverage to be confident |
| **Hybrid handling** | Acceptable to ship "best-effort" Linux experience on first pass — most Electron apps don't perfectly match every Linux desktop convention, and users tolerate this |

### 2.3 macOS

| Field | Detail |
|---|---|
| **Allowed** | `titleBarStyle: 'hiddenInset'` (custom title-bar content alongside preserved native traffic lights); custom menu definition (presented in the OS-global menu bar at the top of the screen); vibrancy effects; full-screen mode toggle |
| **Restricted** | Menu bar **cannot be moved into the window** — Apple's global menu bar is a system-wide chrome surface; window controls (traffic lights) **must stay in the top-left** in the standard position with standard spacing — moving them or replacing them is an HIG violation; `frame: false` alone (without hiddenInset) loses traffic lights entirely and is considered broken UX; certain keyboard accelerators (Cmd+Q, Cmd+W, Cmd+H, Cmd+M, Cmd+,) are user-expected and must be bound at the OS menu level |
| **Native requirements** | Traffic lights in top-left at native size and spacing; global menu bar populated with Rwanga's commands; standard Cmd accelerators on standard menu items; window minimize/zoom/close handled by traffic lights, not by custom buttons |
| **Risk level** | **LOW for hybrid path**; **VERY HIGH for fully-owned path** (fully owned on macOS = broken Mac experience) |
| **Hybrid handling** | hiddenInset is the well-known correct path. The custom title-bar content paints beside the traffic lights. The OS global menu bar continues to host Rwanga's menu commands. The renderer detects `process.platform === 'darwin'` and conditionally renders or hides the in-window menu bar |

### 2.4 Summary

| Platform | Path | Effort | Visual identity gain |
|---|---|---|---|
| Windows | Fully owned (`frame: false` + everything) | High | Very high — looks like a real desktop app, not an Electron port |
| Linux | Fully owned, best-effort | High | High — varies by compositor |
| macOS | Hybrid (hiddenInset + native menu + native traffic lights + owned title content) | Medium | Medium — but doesn't fight Apple |

The mission's "macOS native menu may remain where platform requires it" authorization explicitly accepts this fork.

---

## 3. Architecture options

### Option A — Fully owned frameless on all three platforms

**Benefits:**
- One code path, no platform fork.
- Maximum perceived identity ownership.

**Risks:**
- **macOS is broken.** Traffic lights gone or in the wrong place; menu bar painted inside the window collides with macOS expectations (some users won't even see it because they're looking at the global menu bar at the top of the screen); Apple HIG violations across the board.
- Discord and Slack — the most-cited examples of "Electron app that feels native" — do NOT do this on macOS. They both use the hybrid path.
- Real risk of one-star Mac App Store reviews (we don't ship to MAS, but the perception applies wherever Mac users land the binary).
- 3+ weeks of macOS-specific debugging just to get a half-broken experience.

**Complexity:** Very high.

**Recommendation:** **REJECT.** Mac users will judge the app harshly. Not worth it.

### Option B — Hybrid: fully owned on Windows/Linux; hiddenInset + native menu on macOS

**Benefits:**
- Wins where it matters most (Windows is the largest user base for screenwriting tools that aren't Final Draft).
- Doesn't fight Apple — Mac users get a Mac-feeling app.
- Industry-precedented (Discord, Slack, VS Code, GitHub Desktop, Atom, Notion all do variants of this).
- Two clean code paths — one platform conditional (`process.platform === 'darwin'`) at three or four well-defined places.
- Rollback per platform is feasible (e.g., revert Linux to native if compositor variance bites).

**Risks:**
- Two paths to maintain forever. The Mac path can drift if the team is Windows-focused.
- Linux variance still a wildcard.
- Initial bring-up requires testing across at least Windows + macOS (Linux can be best-effort).
- VS11 guard reversal + VS1 + VS2 deletions are real changes to the suite.

**Complexity:** Medium-high.

**Recommendation:** **ACCEPT.** This is the right answer.

### Option C — Current (native-first, status quo)

**Benefits:**
- Zero work.
- Zero risk.
- Already in production.

**Risks:**
- Does not solve the perception problem that started the mission.
- The screenshot disappointment that triggered Bundle 2 + this mission remains unresolved.
- The redundant `#rga-shell-titlebar` strip below the OS title bar continues to read as "wasted UI row".
- User remains in the "I opened an Electron project" perception state.

**Complexity:** None.

**Recommendation:** **REJECT.** The user has already rejected this in the mission authorization. The reasoning is sound: a screenplay studio cannot earn its identity wearing OS chrome.

---

## 4. Recovery strategy

The biggest unknown in Option B is whether the Windows/Linux frameless path lands cleanly. The recovery strategy below assumes Workstream A commits land one capability at a time (frame flag → custom title → custom controls → custom menu → drag region cleanup), each independently revertable.

### 4.1 If frameless causes resize bugs

- Bugs: resize cursor doesn't appear at edges; resize doesn't grab; window jumps when starting to resize.
- Rollback: single-commit revert of the frame-flag change. Application returns to native chrome. Custom title bar content remains visible alongside OS chrome (degraded but functional — looks like the current pre-mission state).
- Decision point: if the bug is Linux-only, ship Windows owned + Linux native and document the conditional. If Windows too, revert globally and re-investigate.

### 4.2 If focus bugs surface

- Bugs: window doesn't visually indicate inactive state; focus ring disappears; alt-tabbing leaves stale chrome.
- Rollback: revert the custom title bar styling. Re-enable native chrome (revert frame flag too).
- Mitigation before rollback: add explicit `window.on('blur'/'focus')` listeners in main process that toggle a body class for renderer styling. Most focus bugs are caught at this layer.

### 4.3 If keyboard / menu issues surface

- Bugs: F10 doesn't focus menu bar; Alt+letter accelerators don't fire; menu items announced incorrectly by screen readers.
- Rollback: revert the custom menu commit. Re-enable native menu via `Menu.setApplicationMenu` (the deleted call). Application returns to the current menu state (the post-Bundle-1-§A native menu with view radios).
- Mitigation: native menu accelerators continue to work even alongside an owned menu bar UI (we can ship both in parallel during stabilization — the owned UI is visual, the native menu accelerators provide the keyboard contract).

### 4.4 If accessibility regresses

- Bugs: screen readers announce wrong labels; tab navigation skips owned controls; high-contrast mode breaks owned chrome.
- Rollback: full revert of Workstream A. Native chrome restored. File an accessibility-debt issue. Ship without the perception gain. **Accessibility regressions are non-negotiable.**

### 4.5 If drag region issues surface

- Bugs: drag from owned title bar doesn't move window; buttons inside the title bar swallow drag (forgot `no-drag`); double-click to maximize doesn't work.
- Rollback: revert the drag region commit. The window becomes movable only via OS-default behaviour (likely loses moveability if frame:false stays — in which case revert frame flag too).
- Mitigation: drag region is the most-easily-tested capability. Smoke-test on each platform after the commit lands; rollback immediately if drag breaks.

### 4.6 Rollback shape

Workstream A lands as **at least five separable commits**:

| Commit | What it changes | Revert cost |
|---|---|---|
| A.1 | `frame: false` (Win/Linux) + `titleBarStyle: 'hiddenInset'` (macOS) in main.js | Single-file revert |
| A.2 | Custom title bar content + drag region in renderer | Single-file revert |
| A.3 | Custom window controls in renderer + IPC wiring (already exists in preload — just renderer DOM) | Single-file revert |
| A.4 | Custom menu bar in renderer (Win/Linux); macOS still uses native menu | Single-file revert |
| A.5 | Delete / invert VS1, VS2, VS11 guards (authorized this session); add replacement guards | Guard-replacement revert |

Any single rollback returns the app to a known-good intermediate state. Workstream A does NOT land as one all-or-nothing commit.

---

## 5. Visual ownership map

The mission's "do not redesign, do not invent components" rule applies. This map identifies WHO OWNS WHICH SURFACE — not what it looks like.

### 5.1 Target chrome stack (top to bottom)

```
┌────────────────────────────────────────────────────────────────────┐
│ Title row                                            [_] [□] [×]   │  ← Win/Linux: owned by Rwanga
│ (Rwanga · {script name})                                           │     macOS: hiddenInset, native traffic lights top-left
├────────────────────────────────────────────────────────────────────┤
│ Menu row                                                            │  ← Win/Linux: owned by Rwanga
│ File · Edit · View · Script · Tags · Export · Tools · Help          │     macOS: HIDDEN (global Mac menu carries it)
├────────────────────────────────────────────────────────────────────┤
│ Toolbar row                                                         │  ← OWNED BY RWANGA (Workstream D — not this report)
│ (formatting / screenplay-mode toolbar)                              │
├────────────────────────────────────────────────────────────────────┤
│ Workspace zone (sidebar | editor | inspector)                       │  ← OWNED BY RWANGA (already)
├────────────────────────────────────────────────────────────────────┤
│ Status row                                                          │  ← OWNED BY RWANGA (Workstream F — landed bdb96be6)
│ offline · scene  |  blockType · page  |  words · view · lang · theme│
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 Per-surface ownership

| Surface | Owner | Subsidiary owners | Notes |
|---|---|---|---|
| **Title row text** | Rwanga | Rga.Shell.TitleBar (existing module) | Already paints "Rwanga · {script}" in `#rga-shell-titlebar`. Expand to be the only title bar shown |
| **Title row drag** | Rwanga | CSS `-webkit-app-region: drag` declaration | Existing declaration at `renderer/css/shell.css:493`. Keep it; Win/Linux frameless mode means this region IS the OS drag region |
| **Title row no-drag islands** | Rwanga | CSS `-webkit-app-region: no-drag` on every button | Existing on theme toggle + avatar (lines 517, 538). Extended to cover window controls and menu items |
| **Window controls (Win/Linux)** | Rwanga visual + click | `window.rwanga.window.minimize / maximize / close` (existing IPC bridge at `electron/preload.js:53-58`) | Bridge is ready. Just need the buttons + click handlers |
| **Window controls (macOS)** | OS | hiddenInset preserves traffic lights | Renderer does NOT paint custom controls on macOS |
| **Menu row dropdowns (Win/Linux)** | Rwanga | New menu-dropdown DOM + opener logic | `#topmenu-dropdown` element already exists in index.html (line 259, currently dormant). Wire it up |
| **Menu row (macOS)** | OS-global | Electron's `Menu.setApplicationMenu(definition)` | Renderer's menu row is hidden on macOS; native menu carries the commands |
| **Menu accelerators** | KeyboardRegistry (renderer) + Electron menu accelerators (macOS) | Single SSOT mutators per action (e.g., `Rga.ViewMode.set`, `Rga.Shell.StudioPanel.toggle`) | Win/Linux: registered in `Rga.KeyboardRegistry`. macOS: native accelerator bindings on menu items, which route via IPC to the same SSOT mutators (same pattern as Workstream F's view-mode IPC) |
| **Toolbar row** | Rwanga | Rga.FormatToolbar (existing) | Workstream D moves this to global chrome — NOT this report |
| **Status row** | Rwanga | Rga.Shell.StatusBar (existing, three-section after `bdb96be6`) | Already owned. No change |
| **Avatar (existing placeholder)** | Rwanga | `#rga-shell-titlebar-avatar-placeholder` | Existing in title bar. Becomes a real element in a later iteration; ownership here doesn't change |
| **Search affordance** | Rwanga | Sidebar Search panel + future global-search command | NOT chrome. Lives in sidebar (already owned). Optional title-bar Search button is a future surface — NOT in this report's scope |
| **Future command-palette entry** | Rwanga | Rga.CommandPalette (existing) | Already exists. Title-bar entry point (a Search-shaped affordance) is a Workstream-B item, not chrome ownership |

### 5.3 Surfaces explicitly NOT owned by Rwanga

| Surface | Owner | Why |
|---|---|---|
| Native macOS traffic lights | OS | hiddenInset preserves them; Apple HIG |
| Native macOS menu bar | OS | Global Mac menu bar is OS-level; cannot be moved |
| Resize edges | OS / compositor | Always OS-managed; frameless mode delegates resize to the compositor |
| Window-level events (focus / blur / resize / move) | OS via Electron | Rwanga subscribes; doesn't own |
| Native Cmd+Q / Cmd+W / Cmd+H / Cmd+M on macOS | OS via native menu | User-expected; must remain on native menu items |
| DevTools chrome | Electron | Devtools are dev-only; out of chrome ownership scope |

---

## 6. Final recommendation

**Rwanga should adopt OPTION B — hybrid owned chrome.**

**One-line justification:** fully-owned on Windows + Linux delivers the identity gain the mission demands; hybrid on macOS respects platform conventions that Apple users will judge harshly if violated. This is the same path Discord, Slack, VS Code, GitHub Desktop, and Notion all chose for the same reason. No other major Electron product ships fully-owned chrome on macOS.

**Why not Option A:** macOS users will perceive a fully-owned Mac app as broken on first launch (missing traffic lights or traffic lights in the wrong place, menu bar painted inside the window while the global Mac menu sits empty up top, Cmd+Q behaving unfamiliarly). The perception cost on macOS exceeds the perception gain on Windows/Linux.

**Why not Option C:** the mission was authorized precisely because Option C does not earn the application its identity. Native-first chrome was a reasonable temporary stabilization decision; it is not a product-direction choice.

**Confidence in Option B:** 75 / 100. Breakdown:
- Windows owned-chrome path: 85% (Discord-pattern, well-trodden).
- Linux owned-chrome path: 65% (compositor variance is the wildcard; acceptable to ship best-effort).
- macOS hybrid path: 85% (hiddenInset is HIG-compliant and widely adopted).
- Whole-mission risk including guard reversal + multi-commit landing: 75%.

The 25% reservation is not "this approach might be wrong" — it's "the first-pass implementation will have bugs that need a verification cycle, and Linux specifically may need a second pass."

---

## 7. What this report does not commit to

- No timeline. Workstream A is honestly 2–3 weeks of focused work; not estimating tighter than that.
- No specific UI design for the owned chrome — that comes from the existing Claude Design system (per mission rules: "use existing Claude Design system; do not invent new UI language").
- No commit to which platform ships first. Recommended order: Windows (largest user base, cleanest path) → macOS (hybrid, well-precedented) → Linux (best-effort).
- No commit to deleting VS1 / VS2 / VS11 in this session — those deletions happen in Workstream A's implementation commits, gated on per-platform smoke tests passing.

End of report. Standing by for authorization to open Workstream A implementation, or for any clarifications.
