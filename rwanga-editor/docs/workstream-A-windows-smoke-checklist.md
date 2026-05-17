# Workstream A — Windows Manual Smoke Checklist

**Purpose:** stage-by-stage manual verification to run on Windows between each commit of Phase A1. Unit tests run automatically and are reported on each turn; this checklist is the thing only you can do.

**How to use:** after each stage's commit, launch the app on Windows (`npm start`), walk through that stage's checks, mark each ☐ → ☑ as you go. If any check fails — STOP, report which one, and we revert that stage before continuing.

**Hard stop conditions (apply at every stage):** drag · resize · snap · keyboard accelerators · focus state · accessibility. If any of these regress, STOP immediately.

---

## Stage A0 — Replacement guard suite (no runtime change)

A0 adds only new test files. The app should look and behave identically to the post-Bundle-2 state.

- ☐ App launches without errors in the console.
- ☐ Window opens with the native OS title bar present (unchanged from today).
- ☐ Editor opens a sample script and contents render.
- ☐ Status bar at the bottom is in its three-section layout (post-§F).
- ☐ Studio panel can be minimized / closed / reopened (post-§E).
- ☐ Native menu bar (File · Edit · View · Help) still works.
- ☐ Ctrl+S saves; Ctrl+J toggles the studio panel; Ctrl+\` toggles the studio panel.

If all 7 pass → proceed to A1. If any fail → A0 is innocent of behaviour change; investigate as a separate concern.

---

## Stage A1 — Frameless window transport (Windows)

A1 sets `frame: false` on Windows. The window loses all chrome. This is a deliberate verification state, not a daily-use state.

- ☐ App launches without errors.
- ☐ Window opens with NO native title bar (no Windows blue strip).
- ☐ Window opens with NO native window controls (no min/max/close trio).
- ☐ Editor contents render normally inside the (now-larger) viewport.
- ☐ Window IS still resizable from all four edges and four corners.
- ☐ Win+Down minimizes the window.
- ☐ Win+Up maximizes the window.
- ☐ Win+Left / Win+Right snap the window to half-screen.
- ☐ Alt+F4 closes the window.
- ☐ Status bar and sidebar still render in their normal positions.
- ☐ No console errors related to window state.

**Expected NOT to work in A1 (these land in A2 and A5):**
- Mouse drag from the top of the window — drag region not yet declared.
- Double-click to maximize — handler not yet wired.
- Visible app/script identity at the top — Row 1 not yet painted.

If any "expected to work" check fails → STOP. Revert A1 (one-line revert in `electron/main.js`).

---

## Stage A2 — Owned title bar

A2 paints Row 1 (app identity · script identity · empty actions slot) and declares the drag region.

- ☐ App launches without errors.
- ☐ Title bar is visible at the top of the window.
- ☐ "Rwanga" (or wordmark) appears on the LEFT of the title bar.
- ☐ Current script name appears in the MIDDLE of the title bar.
- ☐ Right side of the title bar is intentionally empty for now (theme toggle and avatar continue to render where they were).
- ☐ Mouse drag from any part of the title bar moves the window.
- ☐ Theme toggle button (◐) still responds to click.
- ☐ Avatar placeholder is still visible.
- ☐ Resize edges still grab.
- ☐ Win+arrow snap still works.
- ☐ Status bar at the bottom unchanged.
- ☐ Editor area unchanged.
- ☐ No console errors.

**Expected NOT to work in A2:**
- Mouse min/max/close — no buttons yet (A3).
- Double-click on title bar to maximize — handler not yet wired (A5).
- Menu bar — not yet present (A4).

If drag doesn't work → STOP. Revert A2.
If the title bar paints but the OS title bar ALSO appears above it → STOP (A1's frame setting didn't apply; investigate).

---

## Stage A3 — Owned window controls (min/max/close)

A3 adds the three buttons in the title bar's right slot, each routed to the existing IPC bridge.

- ☐ App launches without errors.
- ☐ Title bar shows three buttons on the right: minimize · maximize · close.
- ☐ Close button is the rightmost.
- ☐ Hovering any of the three buttons shows a hover state (background tint).
- ☐ Hovering the close button shows a danger-tinted background.
- ☐ Clicking minimize minimizes the window.
- ☐ Clicking maximize maximizes the window.
- ☐ Clicking maximize again restores the window.
- ☐ Clicking close closes the window.
- ☐ Mouse drag still works on the title bar AROUND the buttons (buttons themselves don't initiate drag).
- ☐ Tab key navigates through the buttons in order: minimize → maximize → close (or as expected per platform).
- ☐ Screen reader (if available) announces "Minimize", "Maximize", "Close window".
- ☐ Theme toggle and avatar still work.
- ☐ No console errors.

**Expected NOT to work in A3:**
- Double-click on title bar — A5.
- Menu bar — A4.

If clicking a button starts a drag instead → STOP. The no-drag class is missing.
If a button doesn't fire its action → STOP. The IPC wiring is broken.
If accessibility is broken (no ARIA, no tab order) → STOP immediately. Non-negotiable.

---

## Stage A4 — Owned menu surface

A4 adds Row 2 (the 8-entry menu bar) and suppresses the native Electron menu on Windows.

- ☐ App launches without errors.
- ☐ Row 2 (menu bar) is visible directly under the title bar.
- ☐ Eight menu items in this exact order: File · Edit · View · Script · Tags · Tools · Export · Help.
- ☐ The native Windows menu bar is NOT visible (no second menu somewhere else).
- ☐ Clicking File opens a dropdown.
- ☐ File → New Script creates a new tab.
- ☐ File → Open… opens the file dialog.
- ☐ File → Save and File → Save As… work.
- ☐ Edit → Undo / Redo / Cut / Copy / Paste work on selected editor text.
- ☐ View → Flow / Draft / Print switch view mode; checkmark moves with the current view.
- ☐ View → Toggle Sidebar hides/shows the sidebar.
- ☐ View → Toggle Inspector hides/shows the inspector.
- ☐ View → Studio Panel toggles the studio panel (same as Ctrl+J).
- ☐ View → Reload reloads the window.
- ☐ Tools → Command Palette opens the palette.
- ☐ Tools → Toggle Theme switches dark/light theme.
- ☐ Tools → Load Sample Script opens the sample.
- ☐ Export → Export to PDF… opens the export dialog.
- ☐ Help → About Rwanga shows an about pane (or is greyed out if not yet wired).
- ☐ Disabled items (Script ▸ all, Tags ▸ all, etc.) render visibly disabled with no "(coming soon)" suffix.
- ☐ Clicking outside an open dropdown closes it.
- ☐ Esc closes an open dropdown.
- ☐ Ctrl+S still saves (keyboard accelerator preserved).
- ☐ Ctrl+J / Ctrl+\` still toggle the studio panel.
- ☐ Ctrl+N / Ctrl+O / Ctrl+Shift+S still work.
- ☐ Tab navigation through menu items is sequential (File → Edit → View → …).
- ☐ Window drag still works in the gaps between menu items.
- ☐ Window controls (min/max/close) still work.
- ☐ Title bar drag still works.
- ☐ No console errors.

**Expected NOT to work in A4:**
- Double-click on title bar to maximize — A5.

If any keyboard accelerator breaks → STOP.
If the native menu appears alongside the owned menu → STOP.
If a dropdown item doesn't fire its command → STOP.
If tab navigation through menu items is broken → STOP (accessibility).

---

## Stage A5 — Drag behavior polish

A5 adds no-drag islands on every interactive title-bar / menu-bar element and a double-click-to-maximize handler.

- ☐ App launches without errors.
- ☐ Clicking ANY interactive element in the title bar (theme toggle, avatar, window controls, menu items) registers as a click (not a drag attempt).
- ☐ Mouse drag on the title bar's empty space moves the window.
- ☐ Mouse drag on the menu bar's empty space (between items) ALSO moves the window.
- ☐ Double-click on the title bar's empty space maximizes the window.
- ☐ Double-click on an already-maximized title bar restores the window.
- ☐ Drag to the top edge of the screen maximizes (Aero Snap).
- ☐ Drag to the left/right edge snaps to half-screen.
- ☐ Drag to a corner snaps to a quarter-screen (Win11; verify if on Win11).
- ☐ Drag away from a snapped position restores the window.
- ☐ All Stage A4 menu interactions still work.
- ☐ All Stage A3 window control interactions still work.
- ☐ All keyboard accelerators still work.
- ☐ Focus state: window is visually different when active vs inactive (look for a subtle chrome change when clicking another app's window).
- ☐ No console errors.

If any drag/snap regression → STOP. Revert A5.

---

## Stage A6 — Guard cleanup

A6 retires VS1/VS2/VS11. No runtime change.

- ☐ App launches identically to A5.
- ☐ All A5 smoke checks still pass.
- ☐ No new visual or behavioural differences from A5.

A6 is purely a test-suite refactor. If anything changes visually, A6 has accidentally touched runtime — STOP.

---

## Phase A1 acceptance (all stages combined)

After A6 lands and all checks above pass:

- ☐ Window has a clean owned chrome stack (title bar · menu bar · global toolbar — though the toolbar row remains Workstream D's concern).
- ☐ No native Windows chrome visible anywhere.
- ☐ Every existing keyboard shortcut still works.
- ☐ Every existing menu command is reachable via the new menu bar.
- ☐ The window drags / resizes / minimizes / maximizes / closes / snaps correctly.
- ☐ Focus state communicates active vs inactive.
- ☐ Tab order through chrome is sensible and complete.
- ☐ The app is daily-usable on Windows without falling back to keyboard for window operations.
- ☐ The visible identity reads "Screenplay Studio", not "Electron app with screenplay support".

When all of the above are ☑, Phase A1 ships. Phase A2 (Linux best-effort) opens next.

---

## Smoke session log

Use this section to record what you verified on each stage. Helpful for future debugging.

| Stage | Date | Result | Notes |
|---|---|---|---|
| A0 | | | |
| A1 | | | |
| A2 | | | |
| A3 | | | |
| A4 | | | |
| A5 | | | |
| A6 | | | |
