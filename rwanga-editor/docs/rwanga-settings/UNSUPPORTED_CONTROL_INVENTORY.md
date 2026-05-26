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

### 1. `margins`

| Field | Value |
|---|---|
| Control type | `margins` — referred to as `margin_group` in the constitution (RC1 §5.2.9). The registry uses the shorter `margins` token; both refer to the same control. |
| Affected setting IDs | `pageSetup.margins` |
| Count | 1 |
| Current fallback | Read-only formatted text (e.g. `T 1 · B 1 · L 1.5 · R 1`). The row's value column shows the four numeric fields collapsed into a single readable summary. |
| Why unsupported | The constitution-mandated control (RC1 §5.2.9) requires a 2×2 grid of labeled numeric fields (TOP / RIGHT / BOTTOM / LEFT) with shared container styling, per-field clamping (0–3), and a 0.1 step. Narrow use case (only one entry) so the work is properly paired with other Page Setup wiring rather than shipped in isolation. |
| Proposed future slice | **H7** |

### 2. `color`

| Field | Value |
|---|---|
| Control type | `color` (RC1 §5.2.7) |
| Affected setting IDs | `appearance.editorDeskColor` |
| Count | 1 |
| Current fallback | Read-only text rendering of the hex value (e.g. `#141414`). Note: an applicator was registered for this id in an earlier slice (`shell-applicators.js`); the applicator is currently orphaned because no editable control surfaces the value to the user. |
| Why unsupported | The constitution-mandated control (RC1 §5.2.7) requires a horizontal row of curated-palette swatches with active/hover/scale states. Crucially, the control "MUST always have predefined options" — the registry today carries only a default hex, not a palette array. Wiring requires both a registry shape extension (palette options) and the swatch-row component. |
| Proposed future slice | **H7** |

---

## Shipped Slices

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

| Type | Affected IDs | Count | Fallback | Future slice |
|---|---|---|---|---|
| `margins` | `pageSetup.margins` | 1 | read-only summary | **H7** |
| `color` | `appearance.editorDeskColor` | 1 | read-only hex | **H7** |
| **Total deferred** | | **2 entries** | | |
| `slider` | `windowZoom` | 1 | — shipped — | **H5** (done) |
| `shortcut` | `kb.*` | 10 | — shipped — | **H6** (done) |

---

## Render-Layer Behavior Notes

The two remaining unsupported types share the same workspace fallback (see `renderer/js/shell/workspaces/settings-workspace.js` `_buildRow`):

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

This is sufficient for H4's "no implementation leakage" rule. Replacing the fallback with the constitution-mandated controls was completed across H5 (slider), H6 (shortcut), and is owed by H7 (margins + color).

---

*End of UNSUPPORTED CONTROL INVENTORY*
*Inventory only — no wiring, no design.*
