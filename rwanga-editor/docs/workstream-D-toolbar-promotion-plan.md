# Workstream D — Global Toolbar Promotion — Investigation & Plan

**Date:** 2026-05-17
**Status:** PLAN ONLY. No runtime edits. No design invention.
**Source of truth for visual language:** `docs/design-system/` (read-only).
**Mission goal:** Formatting stops feeling like editor controls and starts feeling like writing instruments.

---

## 1. Current ownership map

### 1.1 Surfaces that hold formatting / writing controls today

| Surface | DOM root | Module | What it owns | Where it lives in the layout |
|---|---|---|---|---|
| Format Toolbar | `#format-toolbar` (`renderer/index.html:153-170`) | `Rga.FormatToolbar` (`renderer/js/format-toolbar.js`) | undo · redo · sep · bold · italic · underline · strikethrough · sep · color · highlight · sep · link · sep · clear-formatting (11 buttons in a thin horizontal strip) | INSIDE `#editor-area`, between `#tab-bar` and `#editor-container` |
| Scene Toolbox | `#scene-toolbox` (`renderer/index.html:197-220`) | `Rga.FormatToolbar` (same module) | block-type select (action/character/dialogue/parenthetical/shot/transition) · note · flag · tag-dropdown (4 controls in a vertical strip) | Absolute-positioned to `#editor-area`'s right edge, anchored to `.rga-page`'s right edge after Bundle 1 §C |
| Menu Bar | `#rga-shell-menubar` (post-A4) | Boot-script `wireMenubar` + `Rga.KeyboardRegistry.registerCommand` | 8 dropdowns including Edit (undo/redo), View (flow/draft/print/sidebar/inspector/studio-panel), Tools (palette/theme) | Row 2 of `#app` grid |
| Status Bar | `#status-bar` | `Rga.Shell.StatusBar` | viewMode dropdown (post-Bundle 1 §A), theme instrument (post-Workstream F) | Row 4 of `#app` grid |
| Keyboard | document.keydown via `Rga.KeyboardRegistry` | `KR.registerCommand` (post-§A4.1) | every accelerator — see §A4.1 inventory | global |

### 1.2 Formatting commands and where they're invoked

| Command | Implementation | Surfaces that invoke it today |
|---|---|---|
| **bold** / **italic** / **underline** / **strikethrough** | `PM.toggleMark(markType)` in `format-toolbar.js:60-69` | format-toolbar button; PM keymap (Ctrl+B / Ctrl+I etc. via `editor/mount.js:140-145`) |
| **color** (text color) | `applyMarkAttrs('color', {color})` in `format-toolbar.js:72-95` (popover) | format-toolbar `format-btn--color` button |
| **highlight** | same `applyMarkAttrs` pattern | format-toolbar `format-btn--highlight` button |
| **link** | mark-toggle with attr | format-toolbar `format-btn--link` button |
| **clear formatting** | `clearAllFormatting` in `format-toolbar.js:375-388` removes every mark in range | format-toolbar `format-btn-clear` button |
| **undo** / **redo** | `PM.undo / PM.redo` (prosemirror-history) | format-toolbar undo/redo buttons; PM keymap (Ctrl+Z / Ctrl+Y); edit menu items (post-§A4.1) |
| **annotation** (add note to selection) | opens annotation dialog via `openAnnotationDialog` in `format-toolbar.js:300+`; saves via mark plugin | scene-toolbox `Note` button (`format-btn-annotation`); right-click context menu |
| **flag** (revision flag) | `Rga.RevisionFlags.showRevisionEditor` (`format-toolbar.js:362-369`) | scene-toolbox `Flag` button (`format-btn-flag`); right-click context menu |
| **tag selection** | `applyTagFromSelection` in `format-toolbar.js` | scene-toolbox `Tag…` dropdown (`scene-tb-tag`); right-click context menu |
| **block-type change** (action → character → dialogue …) | `PM.setBlockType(nodeType)` in `format-toolbar.js:422-437`; ALSO `Rga.DocTypes.screenplay.v3Commands.cycleBlockType(direction)` via `v3-keymap.js:31-32` | scene-toolbox `format-block-type` select; Tab / Shift-Tab keys via v3 keymap |

### 1.3 Screenplay-structural commands (engine-side, available but not surfaced in chrome)

| Command | Implementation | Surfaces today |
|---|---|---|
| **insertSceneAtEnd** | `renderer/js/doc-types/screenplay/v3-commands.js:101` | None (engine API only) |
| **insertSceneAfter(refPos)** | `v3-commands.js:126` | None |
| **insertSceneSmart** | `v3-commands.js:150` — context-aware (inserts after current scene or at end) | Likely wired to a keybinding inside v3-keymap (verify on implementation; engine is off-limits to modify but available to call) |
| **cycleBlockType(direction)** | `v3-commands.js:161` | Tab / Shift-Tab via v3 keymap |
| **insertPageBreak** | (verify — likely exists as a PM node-insert pattern in v3 schema) | None |
| **insertTransition** | (no dedicated command — transitions are a block-type via cycleBlockType) | format-block-type dropdown |

### 1.4 View / mode controls (already chrome-owned)

| Command | Owner | Surfaces |
|---|---|---|
| Flow / Draft / Print switch | `Rga.ViewMode.set(mode)` | View menu items (post-A4), status-bar viewMode dropdown (post-Bundle 1 §A) |
| Toggle Sidebar | `Layout.set({sidebar: {visible}})` via `view.toggleSidebar` command | View menu, Ctrl+B (post-§A4.1) |
| Toggle Inspector | `Rga.Inspector.toggle()` via `view.toggleInspector` command | View menu, Ctrl+Shift+I (post-§A4.1) |
| Studio Panel toggle | `Rga.Shell.StudioPanel.toggle()` via `view.studioPanel` | View menu, Ctrl+J, Ctrl+\` (post-§A4.1) |
| Toggle Theme | `Rga.Theme.toggle()` via `tools.toggleTheme` | Tools menu, status-bar theme instrument, Ctrl+Shift+T |

### 1.5 Command ownership chain (post-§A4.1)

```
KeyboardRegistry.registerCommand(spec)
  └─ commandId is the public name
  └─ handler is the SINGLE owner of the action
  └─ accelerator (key + mods) is optional
  └─ KR.commandAccelerator(id) is the SSOT for label rendering
  └─ KR.invokeCommand(id) is the SSOT for dispatch
  └─ Menu UI, status-bar dropdowns, keyboard, command palette
     all invoke via KR (never direct calls to FileManager / ViewMode / etc.)
```

The §A4.1 contract gives Workstream D a clean integration point: every new toolbar button references a `commandId`, the button's accelerator label comes from `KR.commandAccelerator(id)`, the button's click handler calls `KR.invokeCommand(id)`. No new owner needed.

### 1.6 Keyboard ownership (post-§A4.1 inventory — 23 commands)

See `docs/workstream-A-phase-A1-SHIPPED.md` §A4.1 inventory. Every accelerator has a registered command. No raw `KR.register` calls remain in user-facing source (only the legacy compatibility shim in `app-shell.js`).

### 1.7 Where the symptom lives

The user's verification observation was: *"format toolbar floats above the page with no visual relationship to either page or app chrome — feels like a stranded ribbon."*

Root cause from the ownership map: the format toolbar lives INSIDE `#editor-area` between the tab-bar and the editor container. It is owned by the editor, not by the app. The tab-bar separates it from the title-bar above; the editor surface starts immediately below it. The toolbar belongs visually to neither.

The Workstream A4 menu bar (Row 2) created an obvious destination — there is now a clean "global chrome" zone where a global toolbar would belong. Workstream D's job is to move the format toolbar (and add screenplay-structural buttons) into that zone.

---

## 2. Toolbar architecture proposal

### 2.1 Row-ownership target

```
Row 1   #rga-shell-titlebar     (app · script · actions)        [Owned chrome]
Row 2   #rga-shell-menubar      (File · Edit · View · …)        [Owned chrome]
Row 3   #rga-shell-toolbar      (writing instruments)           [Owned chrome — NEW in §D]
        ───────────────────────────────────────────────────────
        #workspace              (sidebar | editor | inspector)  [App surface]
        #status-bar             (instruments)                   [Owned chrome]
```

Row 3 becomes a permanent `auto` track in the `#app` grid (`auto auto auto 1fr STATUS`). The CSS layout guard (post-A4) will require a 5th known child id (`rga-shell-toolbar`) and the grid template grows one track.

### 2.2 What disappears from the editor area

The current `#format-toolbar` (inside `#editor-area`) **moves out** to become `#rga-shell-toolbar` (Row 3). The `#scene-toolbox` (right-side vertical strip) **stays where it is** for now — its anchoring was Bundle 1 §C work and its dockable behaviour is Workstream C's scope, not §D's.

### 2.3 Module ownership

| Concern | Proposed owner |
|---|---|
| Row 3 DOM declaration | `renderer/index.html` |
| Row 3 styling | `renderer/css/shell.css` — `.rga-shell-toolbar` class family, mirroring `.rga-shell-menubar` voice |
| Row 3 wiring (mode toggle + per-button handlers) | `renderer/js/format-toolbar.js` (extend existing module; do not split) |
| Per-button commands | `Rga.KeyboardRegistry.registerCommand` — same §A4.1 SSOT |
| Mode state ("Screenplay" vs "Text" — see §3.2) | `Rga.Shell.Layout.toolbar.mode` (new field, three-state-style migration like §E's studioPanel.state) |

No new shell module. No new ownership owner. Format-toolbar module grows; everything else routes through KR.

### 2.4 Why not the Scene Toolbox

The Scene Toolbox already covers scene-level structural controls (block type · note · flag · tag). Workstream D is NOT about absorbing it — the brief is global toolbar promotion, meaning lifting formatting + writing controls into chrome. Scene Toolbox remains scene-local (it answers "what can I do to this scene right now"); the new global toolbar answers "what writing instruments are always available".

The two surfaces have a defensible boundary:

| Surface | Scope | Anchor |
|---|---|---|
| **Row 3 toolbar** (NEW) | document-level + selection-level writing instruments | global app chrome |
| **Scene Toolbox** (existing) | scene-cursor-context controls (block type for cursor's block, note/flag/tag for selection within the active scene) | the page's right edge, follows the editor surface |

If, after Workstream D ships, the user finds the Scene Toolbox redundant, **Workstream C** retires/redocks it. §D does not remove it.

---

## 3. Placement proposal — what goes in Row 3

### 3.1 Four logical groups (left → right)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Text tools]      [Scene tools]      [Writing tools]    [View tools]  │
└──────────────────────────────────────────────────────────────────────┘
```

| Group | Members | Source commands | Notes |
|---|---|---|---|
| **Text tools** | Bold · Italic · Underline · Strike · Color · Highlight · Link · Clear formatting | Today's format-toolbar buttons (text marks). Each gets a registered command (`text.bold` / `text.italic` / etc.) routing through `PM.toggleMark`. | These are the only mark-toggle controls; selection-aware (disabled when no selection or selection has no text) |
| **Scene tools** | Block type ▾ (action / character / dialogue / parenthetical / shot / transition) · Insert Scene · Insert Page Break | Block-type already in format-toolbar.js (dropdown). Insert Scene maps to `Rga.DocTypes.screenplay.v3Commands.insertSceneSmart`. Insert Page Break — verify command exists in v3; if not, defer until engine work. | These are structural — they act on the doc, not on the selection |
| **Writing tools** | Note (annotation) · Flag (revision) · Tag ▾ · Undo · Redo | All exist today in format-toolbar.js / scene-toolbox. Move undo/redo here (the menu's Edit > Undo/Redo + Ctrl+Z/Y stay; toolbar is a third surface). | "Writing" = craft acts that ARE NOT prose changes — they annotate, flag, tag the writer's draft |
| **View tools** | View ▾ (Flow / Draft / Print) · Toggle Inspector | Already registered commands (`view.flow` etc., `view.toggleInspector`) — toolbar is a third surface alongside menu + status-bar dropdown. | Optional fourth group; the status-bar already has the view dropdown. If we omit this group, that's defensible (the view picker has a home already) |

### 3.2 Mode toggle — Screenplay vs Text

A small mode switcher at the toolbar's left edge:

```
[ Screenplay ▾ ] | Text tools  Scene tools  Writing tools  View tools
```

Two modes:

- **Screenplay mode** (default): full toolbar as above. All four groups visible.
- **Text mode** (less ambitious — for raw notes / outlines / non-script docs): Text tools + Undo/Redo only. Scene tools and structural commands hidden.

The mode persists per-document via `doc.settings` (or via a Layout-scoped default if per-doc is overkill at first). The §A4.1 command registry doesn't need to change — commands stay registered; their toolbar visibility is the only state.

**Open question for the user (G-D-1 stop-point):** is "Text mode" in scope for §D's first ship, or is it a later iteration? Defaults: yes-include-mode-toggle (single binary state, low complexity), no-text-mode-content (just hide Scene + Writing groups in Text mode; don't add any new commands). Awaiting confirmation.

### 3.3 Hierarchy + spacing — reuse existing Claude Design patterns

Visual treatment for Row 3 reads from `docs/design-system/03-rwanga-component-system.md`:

| Concern | Source pattern |
|---|---|
| Toolbar row chrome | Mirror `.rga-shell-menubar` (`shell.css` post-A4): 28px row, `--bg-secondary`, `--border-subtle` bottom edge, `-webkit-app-region: drag` (so the row IS still a drag surface, with `no-drag` islands on each button) |
| Group separators | Existing `.format-btn-sep` (`editor-prosemirror.css`) — small vertical 1px rule with subtle color |
| Per-button shape | `.btn-icon` 28×28 (component-system §1.3) — same pattern as Bundle 1 §C window controls |
| Dropdowns (block type, View ▾) | Same `.rga-shell-menubar-dropdown` pattern A4 introduced — overlay opens beneath the trigger, uses `--bg-secondary` + `--border-subtle` + 4px radius |
| Icons | Existing inline-SVG vocabulary (`Rga.Icons` in `renderer/js/icons.js`) for B / I / U / S / undo / redo / etc. For Insert Scene / Insert Page Break / Note / Flag / Tag — likely need to verify which glyphs are already vendored. Per Bundle 1 §A precedent ("no new icons unless already vendored"), any missing glyph either uses a text label or gets deferred until vendored |
| Mode toggle visual | Reuse Bundle 1 §A's labelled-dropdown pattern (`View: Flow ▾` from the status bar) — `Mode: Screenplay ▾` at the toolbar's left edge. Same visual voice |
| Disabled state | Same `disabled + aria-disabled="true"` policy A4 set for menu placeholders. No "(coming soon)" |
| Cursor / no-drag islands | Same G-OC-6 rules — every interactive element declares `cursor: pointer` + `-webkit-app-region: no-drag` |

No new visual language. Every brushstroke comes from a pattern already documented in `docs/design-system/`.

---

## 4. Docking behaviour proposal

### 4.1 Three docking states

```
DOCKED-CHROME    Row 3 sits in the app grid (default; current proposal)
HIDDEN           Row 3 is collapsed; toolbar not visible (View → Toggle Toolbar)
DRAFT-AUTO-HIDE  Row 3 is hidden when body.view-draft-active (existing behaviour
                 for the current #format-toolbar — preserved automatically by
                 reusing the existing hide rule)
```

No "floating" state. No "moveable" state. The mission brief is identity through ownership, not chrome-as-windowing. Floating toolbars are a 2005-era Word pattern and would re-introduce the very feeling §D is meant to fix.

### 4.2 State management

| State | Where it lives | How it changes |
|---|---|---|
| Visibility (DOCKED-CHROME / HIDDEN) | `Rga.Shell.Layout.toolbar.visible` (new field) | View menu → Toggle Toolbar (new command); reload restores via WorkspaceState |
| Mode (Screenplay / Text) | `Rga.Shell.Layout.toolbar.mode` (new field) OR per-document `doc.settings.toolbarMode` | Mode dropdown at toolbar's left edge |
| Draft auto-hide | CSS rule `body.view-draft-active #rga-shell-toolbar { display: none; }` — same pattern as the existing `#format-toolbar` Draft hide | Automatic; no state |

Adding `toolbar` to `Layout.studioPanel`-style schema is a minor extension of `renderer/js/shell/layout.js`. The `_normalizeStudioPanel`-style migration pattern is already proven (§E). New `_normalizeToolbar` mirrors it.

### 4.3 Print Preview interaction

Print Preview hides `#workspace` entirely (per existing `body.view-print-preview-active` rule). The new Row 3 toolbar lives ABOVE `#workspace` and would still be visible during print preview unless explicitly hidden. Proposal: extend the existing print-preview hide group to also hide `#rga-shell-toolbar`. Same single-CSS-line change as the studio-panel hide rule.

---

## 5. Interaction examples

Six prototypical writer interactions, mapped to the proposed toolbar:

### 5.1 Bolding a word

1. Writer selects "engine" in the action line.
2. Toolbar's **B** button reads selection-aware state: bold mark NOT active → button shows un-pressed.
3. Writer clicks **B** (or presses Ctrl+B).
4. `text.bold` command invoked (via `KR.invokeCommand('text.bold')`).
5. `PM.toggleMark(schema.marks.bold)` runs.
6. Toolbar re-renders selection state: button shows pressed.
7. Same accelerator label (`Ctrl+B`) appears on the button's tooltip, sourced from `KR.commandAccelerator('text.bold')`.

### 5.2 Changing a block from Action to Character

1. Cursor in an action block.
2. Toolbar's **Block type** dropdown shows "Action" (current type, derived from `ScriptMetrics.currentBlockType`).
3. Writer clicks the dropdown → selects "Character".
4. `scene.setBlockType.character` command invoked.
5. `PM.setBlockType(schema.nodes.character)` runs.
6. Editor cursor's block changes; cue text formatting applies.
7. Dropdown re-renders to "Character".

This is the SAME action that Tab cycles through — single command, two surfaces (toolbar + keymap).

### 5.3 Inserting a new scene at the end

1. Writer clicks toolbar's **Insert Scene** button (no keyboard accelerator yet — could be `Ctrl+Shift+N` in a later iteration).
2. `scene.insert` command invoked.
3. `Rga.DocTypes.screenplay.v3Commands.insertSceneSmart` runs.
4. New scene node appended; cursor lands in the new slug line.
5. Status bar updates: Scene S{N+1}, Page becomes whatever the paginator says.
6. Sidebar Scene Navigator gains a row.

### 5.4 Toggling mode

1. Writer clicks **Mode** dropdown at toolbar's left edge → "Text".
2. `toolbar.setMode('text')` command invoked.
3. `Layout.set({toolbar: {mode: 'text'}})`.
4. Toolbar re-renders: Scene tools + Writing tools groups hidden. Text tools + Undo/Redo remain.
5. Setting persists; next launch reopens in Text mode.
6. Writer switches back to Screenplay → groups reappear.

### 5.5 Hiding the toolbar entirely

1. Writer opens View menu → clicks **Toggle Toolbar**.
2. `view.toggleToolbar` command invoked.
3. `Layout.set({toolbar: {visible: !visible}})`.
4. Row 3 collapses; editor area gains the vertical space.
5. Setting persists; reload restores.

### 5.6 Entering Draft view

1. Writer presses Ctrl+Shift+V (cycle view) or selects View → Draft.
2. ViewMode flips to Draft; `body.view-draft-active` applies.
3. CSS hides Row 3 (existing hide rule pattern; new line in shell.css covering `#rga-shell-toolbar`).
4. Distraction-free Draft view stays distraction-free.
5. Exiting Draft restores Row 3 automatically.

---

## 6. Out of scope for §D

- **Scene Toolbox docking** — Workstream C.
- **New screenplay-structural engine commands** (e.g., `insertCharacterBeat`, `insertSlugWizard`) — none added.
- **Per-document toolbar customisation** — not in this mission.
- **Drag-to-reorder buttons within the toolbar** — chrome-as-windowing rejected in §4.1.
- **Touch / gesture interactions** — desktop-first.
- **AI-assisted writing buttons** — IDE v01 spec says AI lives in Notes-to-Rwanga storage, not in the toolbar (per project memory).
- **Print Preview toolbar adjustment** — see §4.3; one CSS line, no new state.

---

## 7. Stop-point register

Implementation requires user input on these gates before any commit lands:

| Gate | Question |
|---|---|
| **G-D-1** | Include the **Screenplay / Text mode** toggle in §D's first ship, or defer to §D.2? |
| **G-D-2** | Include **View tools group** (View ▾ + Inspector toggle) in the toolbar, or omit because the status bar already carries the view dropdown? |
| **G-D-3** | **Insert Scene** wiring — is the engine command path `Rga.DocTypes.screenplay.v3Commands.insertSceneSmart` the correct invocation, or should we expose it through a thinner shell wrapper? (Engine is off-limits per mission rules; we can only CALL existing commands.) |
| **G-D-4** | **Insert Page Break** — does v3 currently expose a command for this, or is it cycleBlockType-only? If absent, deferred. |
| **G-D-5** | **Toolbar visibility default** — DOCKED-CHROME on first install (matches user request), or HIDDEN on first install (less surface, lower bar to enter)? |
| **G-D-6** | **Toolbar icon vocabulary** — confirm we reuse `Rga.Icons.{bold,italic,underline,strikethrough,close,plus,…}` (already vendored); for Insert Scene + Insert Page Break + Note + Flag + Tag, accept text labels (e.g. "+ Scene", "Note", "Flag") where icons aren't vendored, OR defer until icons land? |

---

## 8. Risk + complexity summary

| Risk | Mitigation |
|---|---|
| Row 3 pushes the editor down; on small screens the workspace gets cramped | Toolbar visibility toggle via View menu (HIDDEN state); preserves user choice |
| Mode toggle adds state-shape complexity to Layout | Mirrors §E's three-state-with-migration pattern; well-trodden in this codebase |
| Existing `#format-toolbar` is referenced by tests / format-toolbar.js wiring / Draft hide rule | DOM id renamed to `#rga-shell-toolbar`; affected tests + CSS rule updated in the same commit (3–5 file changes total) |
| Selection-aware button state requires PM state subscription | `format-toolbar.js` already subscribes to `editor.selectionChanged` for the existing buttons; pattern extends to new buttons trivially |
| New `Layout.toolbar` schema needs backward-compat for stored workspaces | `_normalizeToolbar` mirror of `_normalizeStudioPanel`; defaults applied silently for pre-§D workspaces |
| Engine command access from chrome (insertSceneSmart) | We CALL the existing exported command — no engine modification; falls under mission's "call but don't change" boundary |
| Visual hierarchy: 3 rows of chrome may dominate visually | Each row is small (28–36px); chrome total ~96px vs editor area's ~600+px on a 720px window; manageable. Confirmation requires actual smoke after the implementation ships |

**Honest size estimate:** 1 week of focused work for §D's first ship, plus a manual Windows smoke session. Comparable to Bundle 1 §A in scope (single workstream, one row of chrome, mostly CSS + a small JS extension + ~10 test guards).

---

## 9. What I will not do without authorization

- Open implementation. §D is plan-only this turn.
- Add new commands beyond what's listed in §3.1 / §5.
- Modify any engine / framework / doc-types / schema file.
- Reuse the existing `#format-toolbar` ID (the rename to `#rga-shell-toolbar` is a deliberate signal — old toolbar lives inside the editor area; new toolbar lives in app chrome).
- Touch the Scene Toolbox.
- Add icons that aren't already in `Rga.Icons`.
- Re-organize the menu placement table — that's Workstream B.

---

## 10. Recommended next step

Answer the six G-D gates in §7, then authorize Workstream D implementation. The first implementation commit would be a small "Row 3 surface + Text-tools group only" slice — same incremental pattern that worked for Workstream A (A1 → A6). Subsequent commits add Scene tools, Writing tools, Mode toggle, and finally the View tools group (or omit it per G-D-2).

End of plan. No runtime work begins without §7 answers.
