# Rwanga Visual Stabilization V1.1 — Open Visual Decisions

Created: 2026-05-17  
Status: OPEN (not blocking)  
Predecessor: `docs/rwanga-visual-stabilization-v1-plan.md`

This document captures visual decisions deferred by V1.1's runtime UX
repair sweep. They are **not** P1 blockers. They are recorded here so
the next planning cycle has the context, and so no future contributor
silently chooses one option by accident.

---

## OD-1 — Menu strategy

### Current state (after V1 + V1.1)

The app ships **only the native Electron application menu** as its
File / Edit / View / Help surface. The Slice 1 titlebar carries
identity (`Rwanga • {script} *`) and the V1.1 theme-toggle action.
No Rwanga-owned app-menu strip exists.

### What the user flagged

The current state is functional but stylistically diverges from
VS Code / Cursor / Sublime / modern code editors, which all ship
their own in-app menu strip that looks consistent across operating
systems. Native menus on Windows / Linux look like Win32 menus;
on macOS they sit in the OS menu bar at the top of the screen. The
Rwanga product surface therefore looks different on each platform.

### Why this is OPEN, not BLOCKED

- **Accessibility is preserved.** Native menus integrate with screen
  readers, OS keyboard navigation (Alt-letter mnemonics on Win/Linux,
  Cmd-shortcuts on macOS), and OS conventions users already know.
- **Shortcuts work.** All OS-default keybindings (Ctrl/Cmd-Q to
  quit, Ctrl/Cmd-N for new, etc.) flow through the native menu and
  are visible to users.
- **No new feature is being blocked.** Every command the legacy menu
  used to expose either exists elsewhere (status bar, command palette,
  keyboard shortcut) or is unimplemented entirely (the legacy `Script`,
  `Tags`, `Export` items were stubs).
- **Reintroducing a custom menu strip is a non-trivial design.** It
  needs: cross-platform glyph + label rhythm, OS-conventional vs
  custom keyboard shortcut overlap, accessibility audit, hamburger-vs-
  menubar choice on small windows, integration with the Slice 1
  titlebar height.

### What the next planning cycle should answer

1. **Should Rwanga ship a custom app-menu strip at all?** Options:
   - **(a) Keep native-only.** Ship as-is forever. Accept the
     cross-OS visual variance. Lowest-risk, lowest-debt.
   - **(b) VS-Code-style custom strip.** Add a Rwanga-owned strip
     that mirrors the native menu's items. Native menu still exists
     for keyboard / accessibility. Visual consistency wins; surface
     duplication risks creep back in if not policed.
   - **(c) Hybrid — custom strip on Win/Linux only, native on macOS.**
     Matches platform conventions. Adds platform-conditional rendering.
2. **If (b) or (c): does the custom strip live in the Slice 1 titlebar
   (merged) or as a separate row?** Titlebar merge keeps the chrome
   thin; a separate row preserves the identity-vs-action split.
3. **What menu items are non-stub today?** Audit before any custom
   strip ships so we don't reintroduce dead entries.

### Decision owner

Shell maintainer. Park until **after** Slice 3 (scene-management) so
the menu items being added are real.

### Acceptance

This OD becomes RESOLVED when one of (a) / (b) / (c) is committed in a
follow-up plan with concrete files-touched + commits + tests.

---

## OD-2 — Reserved (none today)

End of document.
