# RWANGA SETTINGS COMPONENT LIBRARY
### Companion to: RWANGA_SETTINGS_DESIGN_CONSTITUTION.md v1.0 RC1
### Purpose: Complete inventory of every component in Settings, with exact specifications.

---

## Component Index

| # | Component | File | Exports |
|---|---|---|---|
| 1 | ScopeBadge | `settings-controls.jsx` | `ScopeBadge` |
| 2 | SettingRow | `settings-controls.jsx` | `SettingRow` |
| 3 | SettingControl | `settings-controls.jsx` | `SettingControl` |
| 4 | ToggleControl | `settings-controls.jsx` | (internal) |
| 5 | SelectControl | `settings-controls.jsx` | (internal) |
| 6 | NumberControl | `settings-controls.jsx` | (internal) |
| 7 | TextControl | `settings-controls.jsx` | (internal) |
| 8 | SliderControl | `settings-controls.jsx` | (internal) |
| 9 | RadioControl | `settings-controls.jsx` | (internal) |
| 10 | ColorControl | `settings-controls.jsx` | (internal) |
| 11 | ShortcutControl | `settings-controls.jsx` | (internal) |
| 12 | MarginGroupControl | `settings-controls.jsx` | (internal) |
| 13 | SettingsNav | `settings-nav.jsx` | `SettingsNav` |
| 14 | NavItem | `settings-nav.jsx` | (internal) |
| 15 | PageSetupPreview | `settings-page-setup.jsx` | `PageSetupPreview` |
| 16 | JsonPreviewPanel | `settings-json.jsx` | `JsonPreviewPanel` | **Dev Diagnostic only** |
| 17 | SettingsSection | `settings-app.jsx` | (internal) |
| 18 | SettingsApp | `settings-app.jsx` | `SettingsApp` |

> **Note:** JsonPreviewPanel (#16) and TweaksPanel are Developer Diagnostic Surface components. They MUST NOT appear in production builds. They are included here for completeness but are excluded from the production Settings constitution. They load only when `advanced.debugMode === true`.

---

## 1. ScopeBadge

**Purpose:** Displays the scope indicator (Flow, Print, Export, All) on each settings row.

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `scope` | `string` | Yes | One of: `'flow'`, `'print'`, `'export'`, `'all'` |

**Visual Specification:**

```
Container:
  display: inline-flex
  align-items: center
  gap: 4px
  padding: 2px 7px
  border-radius: 3px
  font-size: 10px
  font-weight: 600
  letter-spacing: 0.04em
  line-height: 16px
  background: {scope-color} at 8% alpha
  color: {scope-color}
  white-space: nowrap
  user-select: none
  flex-shrink: 0

Dot:
  width: 6px
  height: 6px
  border-radius: 50%
  background: {scope-color}
  flex-shrink: 0
```

**Scope Color Map:**

| Scope | Color | Label |
|---|---|---|
| `flow` | `#FFC107` | Flow |
| `print` | `#007acc` | Print |
| `export` | `#4EC9B0` | Export |
| `all` | `#9e9e9e` | All |

**Rules:**
- Renders from `SCOPE_META` lookup — no inline color definitions
- Returns `null` if scope is unrecognized
- Has `title` attribute with scope description for accessibility

---

## 2. SettingRow

**Purpose:** Standard row wrapper for every setting. Two-column grid containing label+description on the left, control+reset on the right.

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `setting` | `object` | Yes | Setting schema object from `SETTINGS_SECTIONS` |
| `value` | `any` | Yes | Current value |
| `onChange` | `function` | Yes | `(newValue) => void` |
| `isModified` | `boolean` | Yes | Whether current value differs from default |
| `onReset` | `function` | Yes | `() => void` — restores default |
| `compact` | `boolean` | No | Use compact density (default: false) |

**Visual Specification:**

```
Row Container (grid):
  grid-template-columns: 1fr auto
  gap: 8px
  padding: {14px|10px} 0    ← comfortable|compact
  border-bottom: 1px solid var(--border-secondary)
  align-items: start

Left Column:
  Label Row (flex):
    display: flex
    align-items: center
    gap: 8px
    margin-bottom: 3px
    
    Label Text:
      font-size: var(--font-size-base)    ← 13px
      font-weight: 500
      color: var(--text-primary)
      line-height: 1.3
    
    ScopeBadge:
      (see component #1)

  Helper Text:
    font-size: var(--font-size-sm)         ← 11px
    color: var(--text-secondary)
    line-height: 1.4
    max-width: 480px

Right Column (flex):
  display: flex
  align-items: center
  gap: 6px
  justify-content: flex-end
  padding-top: 2px
  
  Control:
    (dispatched by SettingControl)
  
  Reset Button:
    background: none
    border: none
    color: var(--text-tertiary)
    font-size: 11px
    cursor: pointer
    padding: 2px 4px
    border-radius: var(--radius-sm)
    opacity: {1|0}         ← visible only when isModified
    pointer-events: {auto|none}
    transition: opacity var(--transition-fast)
    content: "↺"
    title: "Reset to default"
```

**Rules:**
- Row structure is immutable — no variants, no overrides
- Reset button visibility is controlled solely by `isModified` prop
- Compact mode only changes padding — no structural changes

---

## 3. SettingControl

**Purpose:** Dispatcher that renders the correct control component based on `setting.ctrl` type.

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `setting` | `object` | Yes | Setting schema object |
| `value` | `any` | Yes | Current value |
| `onChange` | `function` | Yes | `(newValue) => void` |

**Dispatch Table:**

| `setting.ctrl` | Renders | Props Forwarded |
|---|---|---|
| `toggle` | `ToggleControl` | `value`, `onChange` |
| `select` | `SelectControl` | `options`, `value`, `onChange` |
| `number` | `NumberControl` | `value`, `onChange`, `min`, `max`, `unit` |
| `text` | `TextControl` | `value`, `onChange`, `placeholder` |
| `slider` | `SliderControl` | `value`, `onChange`, `min`, `max`, `step`, `unit` |
| `radio` | `RadioControl` | `options`, `value`, `onChange` |
| `color` | `ColorControl` | `options`, `value`, `onChange` |
| `shortcut` | `ShortcutControl` | `value`, `onChange` |
| `margin_group` | `MarginGroupControl` | `value`, `onChange` |
| `readonly` | `—` glyph | (none) |

**Rules:**
- Unrecognized `ctrl` types render a `—` dash in `var(--text-tertiary)`, 12px
- No fallback to a "generic" control — every control must be explicitly handled
- Engineers MUST NOT add cases to this switch without adding the control type to the constitution

---

## 4. ToggleControl

**Purpose:** Boolean on/off switch.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `value` | `boolean` | Yes |
| `onChange` | `function` | Yes |

**Specification:**

```
Track (button):
  width: 36px
  height: 20px
  border-radius: 10px
  cursor: pointer
  background: {on: var(--accent-primary) | off: var(--bg-quaternary)}
  position: relative
  transition: background var(--transition-normal)
  flex-shrink: 0
  border: none
  role: "switch"
  aria-checked: {value}

Thumb (span):
  position: absolute
  top: 2px
  left: {on: 18px | off: 2px}
  width: 16px
  height: 16px
  border-radius: 50%
  background: #fff
  transition: left var(--transition-normal)
  box-shadow: 0 1px 2px rgba(0,0,0,0.3)
```

---

## 5. SelectControl

**Purpose:** Dropdown for mutually exclusive choices (4+ options or long labels).

**Props:**

| Prop | Type | Required |
|---|---|---|
| `options` | `array` | Yes |
| `value` | `string` | Yes |
| `onChange` | `function` | Yes |

**Specification:**

```
Select (native <select>):
  background: var(--bg-primary)
  color: var(--text-primary)
  border: 1px solid var(--border-primary)
  border-radius: var(--radius-md)
  padding: 5px 28px 5px 8px
  font-size: var(--font-size-base)
  cursor: pointer
  min-width: 160px
  max-width: 240px
  appearance: none
  background-image: chevron SVG (10×6, #9e9e9e stroke)
  background-repeat: no-repeat
  background-position: right 8px center
```

**Options format:** `[{ value: string, label: string }, ...]`

---

## 6. NumberControl

**Purpose:** Numeric input with increment/decrement buttons.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `value` | `number` | Yes |
| `onChange` | `function` | Yes |
| `min` | `number` | No |
| `max` | `number` | No |
| `unit` | `string` | No |

**Specification:**

```
Wrapper (div):
  display: flex
  align-items: center
  gap: 4px
  background: var(--bg-primary)
  border: 1px solid var(--border-primary)
  border-radius: var(--radius-md)
  padding: 0 2px
  overflow: hidden

Decrement Button: content "−", padding 4px 6px, font-size 14px
Input: width 56px, text-align center, padding 5px 4px, type="number"
Unit Label: font-size var(--font-size-sm), color var(--text-tertiary), padding-right 6px
Increment Button: content "+", padding 4px 6px, font-size 14px
```

**Behavior:**
- Values clamped to `[min, max]` on blur and on button click
- Direct typing is allowed; clamping happens on blur
- Buttons use `var(--text-secondary)`, no background

---

## 7. TextControl

**Purpose:** Free-form text input.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `value` | `string` | Yes |
| `onChange` | `function` | Yes |
| `placeholder` | `string` | No |

**Specification:**

```
Input:
  background: var(--bg-primary)
  color: var(--text-primary)
  border: 1px solid var(--border-primary)
  border-radius: var(--radius-md)
  padding: 5px 8px
  font-size: var(--font-size-base)
  min-width: 200px
  max-width: 280px
```

---

## 8. SliderControl

**Purpose:** Range slider for values where relative position matters.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `value` | `number` | Yes |
| `onChange` | `function` | Yes |
| `min` | `number` | Yes |
| `max` | `number` | Yes |
| `step` | `number` | Yes |
| `unit` | `string` | No |

**Specification:**

```
Wrapper: display flex, align-items center, gap 8px

Range Input:
  width: 120px
  height: 4px (track)
  background: var(--bg-quaternary)
  border-radius: 2px
  Thumb: 14px diameter, var(--accent-primary), 2px var(--bg-primary) border

Value Label:
  font-size: var(--font-size-base)
  color: var(--text-primary)
  min-width: 40px
  text-align: end
  user-select: none
  Content: "{value}{unit}"
```

---

## 9. RadioControl

**Purpose:** Segmented control for 2–3 mutually exclusive short-label choices.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `options` | `array` | Yes |
| `value` | `string` | Yes |
| `onChange` | `function` | Yes |

**Specification:**

```
Wrapper:
  display: flex
  border-radius: var(--radius-md)
  overflow: hidden
  border: 1px solid var(--border-primary)

Each Option Button:
  padding: 5px 12px
  font-size: var(--font-size-base)
  border: none
  cursor: pointer
  transition: background var(--transition-fast), color var(--transition-fast)
  
  Active:
    background: var(--accent-primary)
    color: #fff
    font-weight: 600
  
  Inactive:
    background: var(--bg-primary)
    color: var(--text-secondary)
    font-weight: 400
  
  Separator: border-right 1px solid var(--border-primary) (except last)
```

---

## 10. ColorControl

**Purpose:** Selection from a fixed palette of color swatches.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `options` | `array` | Yes |
| `value` | `string` | Yes |
| `onChange` | `function` | Yes |

**Specification:**

```
Wrapper: display flex, gap 6px, align-items center

Each Swatch (button):
  width: 24px
  height: 24px
  border-radius: 50%
  background: {option.value}
  cursor: pointer
  transition: border-color var(--transition-fast), transform var(--transition-fast)
  
  Active:
    border: 2px solid var(--text-primary)
    transform: scale(1.1)
  
  Inactive:
    border: 2px solid transparent
    transform: scale(1)
```

---

## 11. ShortcutControl

**Purpose:** Displays a keyboard shortcut as key cap sequence.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `value` | `string` | Yes |
| `onChange` | `function` | Yes |

**Specification:**

```
Wrapper: display flex, align-items center, gap 3px, cursor pointer

Each Key Cap (span):
  display: inline-flex
  align-items: center
  justify-content: center
  padding: 2px 6px
  min-width: 22px
  height: 22px
  background: var(--bg-tertiary)
  border: 1px solid var(--border-primary)
  border-radius: 3px
  font-size: 11px
  font-weight: 500
  color: var(--text-primary)
  font-family: var(--font-ui)

Separator (span between keys):
  content: "+"
  color: var(--text-tertiary)
  font-size: 11px
```

**Value format:** Keys joined by `+` (e.g., `"Ctrl+Shift+P"`)

---

## 12. MarginGroupControl

**Purpose:** Four related numeric fields for page margins.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `value` | `object` | Yes |
| `onChange` | `function` | Yes |

**Value shape:** `{ top: number, right: number, bottom: number, left: number }`

**Specification:**

```
Container:
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 4px
  background: var(--bg-primary)
  border: 1px solid var(--border-primary)
  border-radius: var(--radius-md)
  padding: 6px 8px
  min-width: 160px

Each Field (div):
  display: flex
  align-items: center
  gap: 4px
  
  Label: 10px, var(--text-tertiary), uppercase, 0.04em, min-width 32px
  Input: 48px wide, var(--bg-secondary), 1px solid var(--border-secondary),
         border-radius var(--radius-sm), 12px font, centered, step=0.1, min=0, max=3
  Unit: 10px, var(--text-tertiary), "in"

Field order: top, right, bottom, left
```

---

## 13. SettingsNav

**Purpose:** Left sidebar navigation with search, section list, and action buttons.

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `sections` | `array` | Yes | `SETTINGS_SECTIONS` array |
| `activeId` | `string` | Yes | Currently active section ID |
| `onSelect` | `function` | Yes | `(sectionId) => void` |
| `searchQuery` | `string` | Yes | Current search text |
| `onSearchChange` | `function` | Yes | `(query) => void` |

**Specification:**

```
Nav Container:
  width: 220px
  min-width: 220px
  flex-shrink: 0
  background: var(--bg-secondary)
  border-right: 1px solid var(--border-secondary)
  display: flex
  flex-direction: column
  height: 100%
  overflow: hidden

Header:
  padding: 16px 16px 12px
  display: flex, align-items center, gap 8px
  border-bottom: 1px solid var(--border-secondary)
  Content: ⚙ icon (20×20) + "Settings" (--font-size-lg, weight 600)

Search:
  padding: 8px 12px
  Input: full width, --bg-primary, 1px solid --border-primary, radius --radius-md,
         padding 6px 10px, --font-size-sm, placeholder "Search settings..."

Section List:
  flex: 1
  overflow-y: auto
  padding: 4px 0
  Each item: NavItem component

Bottom Actions:
  padding: 12px 16px
  border-top: 1px solid var(--border-secondary)
  One button (Reset All only — Save removed in S10):
    Reset All: --bg-tertiary bg, --text-secondary color, 1px solid --border-primary, --radius-md
    (no Save button — Settings uses immediate-apply per RC1 §3.3 amended; a Save button
    with no pending state is fake interaction and is forbidden)
```

---

## 14. NavItem

**Purpose:** Individual navigation item in the settings sidebar.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `section` | `object` | Yes |
| `active` | `boolean` | Yes |
| `onClick` | `function` | Yes |

**Specification:**

```
Container:
  display: flex
  align-items: center
  gap: 10px
  padding: 8px 16px
  cursor: pointer
  user-select: none
  transition: background var(--transition-fast), color var(--transition-fast)
  
  Active:
    background: var(--bg-active)
    color: var(--text-primary)
    font-weight: 500
    border-left: 2px solid var(--accent-primary)
  
  Hover:
    background: var(--bg-hover)
  
  Default:
    color: var(--text-secondary)
    font-weight: 400
    border-left: 2px solid transparent

Icon: 18×18px, color matches text state
Count Badge: 10px, --bg-quaternary bg, --text-tertiary color, padding 1px 6px, radius 8px
```

---

## 15. PageSetupPreview

**Purpose:** Live miniature page preview that responds to margin/paper/orientation changes.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `values` | `object` | Yes |

**Reads from values:**
- `pageSetup.paperSize` → page dimensions
- `pageSetup.orientation` → portrait/landscape
- `pageSetup.margins` → margin overlay positions
- `pageSetup.pageNumbers` → show/hide page number
- `pageSetup.pageNumberPosition` → page number placement
- `pageSetup.headerText` → header text display
- `pageSetup.footerText` → footer text display

**Specification:**

```
Container:
  flex-direction: column
  align-items: center
  gap: 12px
  padding: 16px

Title: 11px, weight 600, var(--text-secondary), uppercase, 0.06em

Page:
  Scaled to max 200px wide
  background: #ffffff
  border-radius: 2px
  box-shadow: 0 4px 16px rgba(0,0,0,0.4)
  
  Margin Overlay: 1px dashed rgba(0,120,204,0.35)
  Faux Text Lines: #e0e0e0 (bold) and #ececec (thin)
  Page Number: 6px serif, #999
  Header/Footer: 5px sans-serif, #bbb
  Margin Annotations: 5px, rgba(0,120,204,0.5)

Dimension Label: 11px, var(--text-tertiary)
  Format: "{size} · {orientation}\n{w}" × {h}""
```

---

## 16. JsonPreviewPanel (Developer Diagnostic Surface Only)

**Purpose:** Development-only panel showing live JSON of settings state. NOT part of the production Settings surface.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `values` | `object` | Yes |
| `visible` | `boolean` | Yes |

**Specification:**

```
Panel:
  width: 320px
  min-width: 320px
  background: var(--bg-secondary)
  border-left: 1px solid var(--border-secondary)

Header:
  Title: "JSON PREVIEW", 11px uppercase, weight 600, var(--text-secondary)
  Badge: "Read-only", 10px, --bg-quaternary bg, --text-tertiary

Code Area:
  flex: 1, overflow auto
  font-family: monospace
  font-size: 11px
  Syntax highlighting:
    Keys: var(--tag-character)
    Strings: var(--accent-success)
    Booleans: var(--accent-warning)
    Numbers: var(--tag-music)

Footer:
  "Copy JSON" button, full width, --bg-tertiary, --text-secondary
```

**Rules:**
- Returns `null` when `visible` is false
- This panel is a Developer Diagnostic Surface component
- It MUST NOT appear in production builds
- It loads only when `advanced.debugMode === true`

---

## 17. SettingsSection

**Purpose:** Renders a section header + description + list of SettingRow components.

**Props:**

| Prop | Type | Required |
|---|---|---|
| `section` | `object` | Yes |
| `values` | `object` | Yes |
| `onChange` | `function` | Yes |
| `onReset` | `function` | Yes |
| `isModified` | `function` | Yes |
| `compact` | `boolean` | No |
| `description` | `string` | No |

**Specification:**

```
Container: margin-bottom {28px|20px} (comfortable|compact)

Section Title:
  font-size: var(--font-size-lg)
  font-weight: 600
  color: var(--text-primary)
  margin-bottom: 4px
  Content: section.label

Description (if provided):
  font-size: var(--font-size-sm)
  color: var(--text-secondary)
  margin-bottom: {12px|8px} (comfortable|compact)
  line-height: 1.5

Settings List:
  Each setting → SettingRow component
```

---

## 18. SettingsApp

**Purpose:** Root component that composes the entire Settings UI.

**State:**

| State | Type | Purpose |
|---|---|---|
| `tweaks` | `object` | Density, JSON panel, page preview, theme |
| `values` | `object` | All current setting values |
| `activeSection` | `string` | Currently selected nav section |
| `searchQuery` | `string` | Current search filter |
| `theme` | `string` | Active theme for live switching |
| `defaults` | `object` | Computed defaults (memoized) |

**Composition:**

```
SettingsApp
├── Tab Bar (simulated editor tab)
├── Body (flex row)
│   ├── SettingsNav
│   ├── Content Area
│   │   ├── Doctrine Banner (General section only)
│   │   ├── Search Results Count (when searching)
│   │   └── SettingsSection(s)
│   │       └── SettingRow(s)
│   │           ├── ScopeBadge
│   │           └── SettingControl
│   │               └── {ToggleControl|SelectControl|...}
│   ├── PageSetupPreview (Page Setup section only, when enabled)
│   └── JsonPreviewPanel (when enabled)
├── Status Bar
└── TweaksPanel
```

---

## Data Schema Components

### SCOPE (Constants)

```
SCOPE.FLOW   = 'flow'
SCOPE.PRINT  = 'print'
SCOPE.EXPORT = 'export'
SCOPE.ALL    = 'all'
```

### CTRL (Constants)

```
CTRL.TOGGLE       = 'toggle'
CTRL.SELECT       = 'select'
CTRL.NUMBER       = 'number'
CTRL.TEXT          = 'text'
CTRL.SLIDER       = 'slider'
CTRL.COLOR        = 'color'
CTRL.SHORTCUT     = 'shortcut'
CTRL.READONLY     = 'readonly'
CTRL.MARGIN_GROUP = 'margin_group'
CTRL.RADIO        = 'radio'
```

### Setting Schema Shape

```
{
  id: string,           // Unique identifier, dot-notation for namespacing
  label: string,        // Human-readable English label (Title Case)
  labelKu: string,      // Human-readable Kurdish label
  helper: string,       // One-sentence description for writers
  scope: SCOPE,         // Which surface this setting affects
  ctrl: CTRL,           // Control type to render
  options?: array,      // For select/radio/color: [{value, label}, ...]
  min?: number,         // For number/slider
  max?: number,         // For number/slider
  step?: number,        // For slider
  unit?: string,        // For number/slider (e.g., "pt", "s", "%")
  placeholder?: string, // For text inputs
  default: any          // Default value
}
```

### Helper Functions

| Function | Signature | Purpose |
|---|---|---|
| `buildDefaults()` | `() → object` | Builds flat `{id: default}` map from schema |
| `buildSettingsJson(values)` | `(object) → object` | Builds grouped JSON from flat values |

---

*End of RWANGA SETTINGS COMPONENT LIBRARY v1.0 RC1*
