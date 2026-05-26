# RWANGA SETTINGS — UNSUPPORTED CONTROL INVENTORY
### Companion to: RWANGA_SETTINGS_DESIGN_CONSTITUTION.md v1.0 RC1
### Status: Inventory only. No behavior wiring. No control creation.
### Created: H4 (2026-05-26)

---

## Purpose

Track every registry entry whose control type is declared in the design constitution but is **not yet implemented** in the renderer. Each row captures:

- the control type
- the affected setting IDs
- what the renderer shows today (the fallback)
- why the control is not implemented
- which future slice will add it

This inventory is **read-only**. Engineers MUST NOT use it as a wiring backlog without explicit design authorization for the named slice. Adding new control types or redesigning fallbacks requires constitution amendment first.

---

## Inventory

*No remaining unsupported control types.* H5 (slider), H6 (shortcut), and H7 (margins + color) have shipped every constitution-declared control. Future settings whose registry shape declares one of these types render the real control with no inventory entry required.

---

## Shipped Slices

### `margins` — closed by H7 (2026-05-26)

The margin group control is implemented. `pageSetup.margins` is now
live: the `_makeMargins` factory in
`renderer/js/shell/workspaces/settings-workspace.js` renders the
constitution-mandated 2×2 grid of labeled numeric fields (TOP /
RIGHT / BOTTOM / LEFT) with min=0, max=3, step=0.1, unit "in" per
RC1 §5.2.9 + Component Library §12. Every field commits the
complete `{top, right, bottom, left}` object back to
`Settings.Store` on change, with clamping handled in the control
itself so the visible value and the stored value never disagree.

The new `pageSetup.margins` applicator (`owner: 'pageSetup'`) in
`shell-applicators.js` mirrors the user's choice into four CSS
custom properties on `documentElement`
(`--page-margin-top/right/bottom/left`). Today the existing
paper-view / manuscript-geometry chain still reads margins from
`doc.settings.pageSetup.margins` (the legacy doc-scoped path), so
these variables do not yet drive a visible surface — page-preview
work is explicitly out of scope per the H7 brief. The applicator
exists to satisfy the constitution's "registered applicator =
wired" contract and to provide a forward-compatible hook for
future paper-view consumers.

### `color` — closed by H7 (2026-05-26)

The color swatch control is implemented. `appearance.editorDeskColor`
is now live: the registry entry gained a curated `options` palette
(Charcoal `#141414`, Midnight `#1a1a2e`, True Dark `#1c1c1c`, Warm
`#2d2520`) plus a `labels` map for human names per RC1 §15.9. The
`_makeColor` factory in
`renderer/js/shell/workspaces/settings-workspace.js` renders the
horizontal row of 24px circular swatches with active/hover/scale
states per RC1 §5.2.7 + Component Library §10. The control is a
`role="radiogroup"` with each swatch as a `role="radio"` button;
keyboard focus shows the accent outline.

Free-form picker is forbidden — selection writes through Store
with one of the palette hex values, validated by the existing
6-digit-hex `color` validator. The existing
`appearance.editorDeskColor` applicator in `shell-applicators.js`
(previously orphaned per the H4 inventory) now drives the visible
effect: the `--editor-bg` custom property on `documentElement`
updates immediately on selection, and the editor desk repaints
without restart.

### `shortcut` — closed by H6 (2026-05-26)

The shortcut control is implemented. All 10 `kb.*` rows are now live:
the `_makeShortcut` factory in
`renderer/js/shell/workspaces/settings-workspace.js` renders each
shortcut as a sequence of key caps (RC1 §5.2.8 + Component Library
§11), click-to-rebind enters the "Press new shortcut..."
accent-coloured prompt, Escape cancels, and a successful capture
writes through `Settings.Store`. The new applicator block at the end
of `renderer/js/shell/shell-applicators.js` registers a per-id
applicator (`owner: 'shortcuts'`) for every `kb.*` setting — each
parses the Store value into a `KeyboardEvent.key`-style key + modifier
mask and installs the binding against `Rga.KeyboardRegistry`. KR's
last-wins semantics mean the registry-driven combo replaces any
hardcoded pre-Settings binding (e.g. `view.toggleSidebar` on Ctrl+B);
rebinds take effect immediately with no restart.

Conflict policy (RC1 §15.5): the shortcut control checks every
captured combo against the current effective value of every OTHER
`kb.*` entry. On collision the control surfaces a toast and leaves
the setting unchanged — no silent overwrite. Broader system-wide
conflict detection (against ad-hoc engine bindings outside the
`kb.*` registry) is a future-slice concern.

For `kb.*` ids whose target command does not yet exist in
`KeyboardRegistry` (`kb.commandPalette`, `kb.save`, etc. — many slices
away from being wired), the applicator still installs the binding but
the handler's `invokeCommand` call is a graceful no-op. When the
underlying command does land, it starts firing through the
user-chosen combo with no further wiring.

### `slider` — closed by H5 (2026-05-26)

The slider control is implemented. `windowZoom` is now live: the
registry carries `min: 50, max: 200, step: 10, unit: '%'`; the
`_makeSlider` factory in `renderer/js/shell/workspaces/settings-workspace.js`
renders the constitution-mandated 120px track + 14px thumb + value
label per RC1 §5.2.5; and the `windowZoom` applicator in
`renderer/js/shell/shell-applicators.js` bridges Store → `webFrame.setZoomFactor`
(routed through `electron/preload.js` because the renderer runs with
`contextIsolation: true`).

The slider row is no longer in the deferred set above. The slice
brief renamed H5 from the inventory's original "shortcut" assignment
to "slider/windowZoom" — the shortcut row remains H5-tagged in the
deferred section for historical continuity but is now expected to
ship in a later slice.

---

## Summary Table

| Type | Affected IDs | Count | Fallback | Slice |
|---|---|---|---|---|
| `slider` | `windowZoom` | 1 | — shipped — | **H5** (done) |
| `shortcut` | `kb.*` | 10 | — shipped — | **H6** (done) |
| `margins` | `pageSetup.margins` | 1 | — shipped — | **H7** (done) |
| `color` | `appearance.editorDeskColor` | 1 | — shipped — | **H7** (done) |
| **Total deferred** | | **0 entries** | | |

---

## Render-Layer Behavior Notes

The read-only fallback in `renderer/js/shell/workspaces/settings-workspace.js` `_buildRow` is now reserved purely as a safety net for unknown / future control types — every type that the registry declares today (`toggle`, `select`, `radio`, `number`, `text`, `slider`, `shortcut`, `margins`, `color`) ships its own editable control. The fallback path remains in place so a future malformed registry entry degrades gracefully instead of crashing the workspace.

```js
// Read-only fallback (unsupported types + safety net).
valueSlot.classList.add('is-readonly');
valueSlot.textContent = _formatValue(entry, _currentValue(entry));
```

`_formatValue` returns a stringified rendering of the current value:
- numbers → `String(value)` (e.g. `100`)
- text → `String(value)` or `(empty)` if blank
- margins → `T 1 · B 1 · L 1.5 · R 1`
- everything else → `String(value)`

The fallback never exposes:
- Internal setting IDs (`editor.fontSize`, `windowZoom`, `pageSetup.margins`)
- Control-type words (`slider`, `color`, `shortcut`, `margins`)
- Enum identifiers (the values it displays are user-meaningful units, not engineer tokens)

This was H4's "no implementation leakage" rule. Replacing the fallback with the constitution-mandated controls was completed across H5 (slider), H6 (shortcut), and H7 (margins + color).

---

*End of UNSUPPORTED CONTROL INVENTORY*
*Inventory only — no wiring, no design.*
