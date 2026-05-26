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

### 1. `shortcut`

| Field | Value |
|---|---|
| Control type | `shortcut` (RC1 §5.2.8) |
| Affected setting IDs | `kb.commandPalette`, `kb.save`, `kb.saveAs`, `kb.find`, `kb.replace`, `kb.toggleSidebar`, `kb.toggleTheme`, `kb.exportPdf`, `kb.sceneNavigator`, `kb.quickSceneJump` |
| Count | 10 |
| Current fallback | Read-only text rendering of the value string (e.g. `Ctrl+Shift+P`). The row enters the workspace's "is-readonly" branch — no editable input, no key-cap chrome. |
| Why unsupported | The constitution-mandated control (RC1 §5.2.8) requires: (a) per-key-cap rendering, (b) click-to-rebind interaction with a "Press new shortcut…" rebind mode, (c) conflict detection across the full shortcut set, (d) Escape-to-cancel handling. This is a multi-component subsystem, not a single control. Implementing it in H4 would exceed the slicing-discipline rule (one tightly-related setting group per slice). |
| Proposed future slice | **H5** |

### 2. `margins`

| Field | Value |
|---|---|
| Control type | `margins` — referred to as `margin_group` in the constitution (RC1 §5.2.9). The registry uses the shorter `margins` token; both refer to the same control. |
| Affected setting IDs | `pageSetup.margins` |
| Count | 1 |
| Current fallback | Read-only formatted text (e.g. `T 1 · B 1 · L 1.5 · R 1`). The row's value column shows the four numeric fields collapsed into a single readable summary. |
| Why unsupported | The constitution-mandated control (RC1 §5.2.9) requires a 2×2 grid of labeled numeric fields (TOP / RIGHT / BOTTOM / LEFT) with shared container styling, per-field clamping (0–3), and a 0.1 step. Narrow use case (only one entry) so the work is properly paired with other Page Setup wiring rather than shipped in isolation. |
| Proposed future slice | **H6** |

### 3. `color`

| Field | Value |
|---|---|
| Control type | `color` (RC1 §5.2.7) |
| Affected setting IDs | `appearance.editorDeskColor` |
| Count | 1 |
| Current fallback | Read-only text rendering of the hex value (e.g. `#141414`). Note: an applicator was registered for this id in an earlier slice (`shell-applicators.js`); the applicator is currently orphaned because no editable control surfaces the value to the user. |
| Why unsupported | The constitution-mandated control (RC1 §5.2.7) requires a horizontal row of curated-palette swatches with active/hover/scale states. Crucially, the control "MUST always have predefined options" — the registry today carries only a default hex, not a palette array. Wiring requires both a registry shape extension (palette options) and the swatch-row component. |
| Proposed future slice | **H6** |

---

## Shipped Slices

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
| `shortcut` | `kb.*` | 10 | read-only text | (TBD — was H5, slider took H5) |
| `margins` | `pageSetup.margins` | 1 | read-only summary | **H6** |
| `color` | `appearance.editorDeskColor` | 1 | read-only hex | **H6** |
| **Total deferred** | | **12 entries** | | |
| `slider` | `windowZoom` | 1 | — shipped — | **H5** (done) |

---

## Render-Layer Behavior Notes

All four control types share the same workspace fallback today (see `renderer/js/shell/workspaces/settings-workspace.js` `_buildRow`):

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

This is sufficient for H4's "no implementation leakage" rule. Replacing the fallback with the constitution-mandated controls is the responsibility of H5–H7.

---

*End of UNSUPPORTED CONTROL INVENTORY*
*Inventory only — no wiring, no design.*
