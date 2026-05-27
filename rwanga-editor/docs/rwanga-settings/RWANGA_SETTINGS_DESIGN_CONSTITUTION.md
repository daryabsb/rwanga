# RWANGA SETTINGS DESIGN CONSTITUTION
### Version 1.0 RC1 — May 2026
### Status: MANDATORY — All engineers must follow this document.

---

## How to Read This Document

Every statement in this document is a rule unless explicitly marked as a note.

Words used:

- **MUST** — non-negotiable requirement
- **MUST NOT** — forbidden
- **SHALL** — required in current implementation
- **MAY** — permitted when rules are followed

No section is optional. No rule is advisory.

---

# SECTION 1 — SETTINGS PHILOSOPHY

## 1.1 What Settings Is

Settings is a **system configuration surface**.

Settings may render visually inside tabs, but rendering does not define ownership. Settings is not a document artifact.

Settings is NOT:

- a workspace (it does not contain creative work)
- a debug panel (it does not expose system internals)
- a developer console (it does not accept commands)
- a dashboard (it does not summarize or report)
- a document artifact (it exists independent of any open script)

Settings IS:

- the single authoritative surface where a writer configures their environment and output preferences
- the contract between the application and the user about what the application will do
- the visible face of the Settings Store (see Section 1A)

## 1.2 What Settings Feels Like

Settings MUST feel:

- **Calm.** No animation, no motion, no urgency. Static surfaces. Quiet transitions on hover only.
- **Paper-like.** Clean rows. High legibility. Generous whitespace. Text-first hierarchy.
- **Trustworthy.** Every control does what it says. Every label is human-readable. Every state is visible.
- **Professional.** Comparable to VS Code Settings, macOS System Preferences, or a well-designed screenplay formatting dialog. Not comparable to a game settings screen, SaaS dashboard, or marketing page.

Settings MUST NOT feel:

- Dense or cramped (this is not a spreadsheet)
- Colorful or attention-grabbing (this is not a dashboard)
- Developer-facing (no JSON labels, no enum values, no internal identifiers visible)
- Playful (no emoji, no illustrations, no gamification)

## 1.3 Design Doctrine

Three principles govern all Settings decisions:

1. **Flow View is a writing comfort surface.** Settings that affect Flow View control how the writer experiences the editor — fonts, spacing, chrome visibility, autocomplete. These are personal preferences.
2. **Print Preview owns page truth.** Settings that affect Print control the physical page — margins, paper size, page numbers, scene numbering position. These have industry-standard defaults.
3. **Export follows Print Preview, not Flow.** Export settings control output format, branding, and revision marks. Export always renders from Print truth, never from Flow comfort.

Every setting belongs to exactly one scope. The scope badge tells the user which surface their change affects.

---

# SECTION 1A — SETTINGS OWNERSHIP

## 1A.1 Settings Store

The Settings Store is the **single source of truth** for all configuration state.

Every value displayed in the Settings UI, and every value consumed by application behavior, MUST read from and write to the Settings Store.

## 1A.2 Ownership Rule

Any action originating from:

- Toolbar buttons
- Status bar controls
- Keyboard shortcuts
- Command palette commands
- Startup initialization
- Plugins
- Application menus

that changes a configuration value MUST request the change through the Settings Store.

No component, service, or UI surface may bypass the Settings Store.

## 1A.3 Forbidden Outside Owner Services

The following are forbidden outside the Settings Store and its registered Applicators:

- Direct `localStorage` writes for configuration values
- Direct DOM mutations for configuration state (e.g., `document.documentElement.setAttribute('data-theme', ...)`)
- Direct calls to `Theme.apply()` or equivalent
- Direct `data-theme` attribute writes
- Direct CSS variable overrides for configuration-owned tokens

## 1A.4 Configuration Change Flow

All configuration changes MUST follow this flow:

```
UI Action (toolbar, menu, shortcut, command palette, Settings UI)
  → Settings Store (validate, persist)
    → Applicator (registered handler for this setting)
      → Owner Service (theme service, editor service, export service, etc.)
        → DOM / Behavior Change
```

No step may be skipped. No shortcut paths are permitted.

## 1A.5 Applicator Registration

Each setting MUST have a registered Applicator that:

1. Receives the new value from the Settings Store
2. Applies it through the correct Owner Service
3. Confirms application success

Settings without registered Applicators are PERSISTS_ONLY (see Section 8.1.2).

## 1A.6 Categorical Exemptions (added in S12)

Section 1A.3 forbids `localStorage` writes for **configuration values**. Two narrow categories of state are NOT configuration and are exempt by category — not by individual key. Drift guard enforcement uses owner-file enumeration, so renaming a key cannot bypass the rule.

### Category 1 — UI Session State

Transient per-session state about which surface the user is looking at right now. Not a preference. Not configurable in the Settings UI. Lost on signout / cleared cache is acceptable.

| Owner file | Key | Why it qualifies |
|---|---|---|
| `renderer/js/view-mode.js` | `rga-view-mode` | Active view (Flow / Print / Draft) for this session |
| `renderer/js/shell/workspace-state.js` | `rga-workspace-layout` (+ legacy keys) | Sidebar/panel visibility per session |
| `renderer/js/tab-manager.js` | `rga-session-tabs` | Which tabs were open per session |

### Category 2 — Recent / History Data

Data records, not preferences. Bounded list of past artifacts.

| Owner file | Key | Why it qualifies |
|---|---|---|
| `renderer/js/file-manager.js` | `recent-files-list` | History of opened files; not configurable as "what should appear here" |

### Forbidden

**Any configuration value.** A configuration value is anything a writer would expect to set in the Settings UI: theme, font, language, units, script language, page setup, autosave behavior, keyboard shortcuts, etc. Configuration values MUST go through `Settings.Store`. If a value sits in `localStorage` outside the four allowed owner files above, S12 either promotes it to the registry or proves it belongs to one of the two ALLOWED categories.

### Drift guard

`tests/unit/shell/ownership-stab-slice2.test.js` enforces these exemptions by owner-file enumeration. Adding a new key in a new file requires either:
1. Declaring the new file as a Category 1 or Category 2 owner in this section (and in the drift guard's enumerated list), or
2. Routing the value through `Settings.Store`.

### Read-only roles (separately allowed)

The legacy `localStorage` **read** in `renderer/js/shell/settings-migrations.js` (one-shot import of pre-S12 `rga-theme`) is allowed by category as well: it has no write side and is idempotent after first run.

---

# SECTION 2 — SETTINGS INFORMATION ARCHITECTURE

## 2.1 Complete Hierarchy

Settings contains exactly these top-level sections, in this order:

| Order | ID | Label (EN) | Label (KU) | Purpose |
|---|---|---|---|---|
| 1 | `general` | General | گشتی | App-wide: language, theme, zoom, session |
| 2 | `editor` | Editor | دەستکاریکەر | Writing surface: font, spacing, wrap, spellcheck |
| 3 | `screenplay` | Screenplay | شانۆنامە | Format profiles, scene numbering, CONT'D rules |
| 4 | `pageSetup` | Page Setup | ڕێکخستنی پەڕە | Paper, margins, headers, footers |
| 5 | `printExport` | Print / Export | چاپ / ناردن | Output format, branding, watermarks, color mode |
| 6 | `autosave` | Autosave & Files | خۆپاشەکەوتکردن | Save intervals, version history, file locations |
| 7 | `appearance` | Appearance | دەرکەوتن | Sidebar, status bar, minimap, page shadow, desk color |
| 8 | `shortcuts` | Keyboard Shortcuts | کلیلی کورتبڕ | All rebindable shortcuts |
| 9 | `advanced` | Advanced | پێشکەوتوو | Debug, experimental flags, log level |

## 2.2 Hierarchy Rules

- **Maximum depth: 2 levels.** Top-level sections contain settings rows. No subsections. No nested groups. No accordions within sections.
- **Section ordering is fixed.** The order above is the canonical order. Engineers MUST NOT reorder sections.
- **Adding a new section** requires design approval. New sections MUST be added at positions 8 or earlier (before Advanced). Advanced and Keyboard Shortcuts MUST remain last.
- **Sections MUST NOT collapse.** The left navigation shows all sections at all times. No expand/collapse. No progressive disclosure in the nav.
- **Each section has a description line** below its title in the content area. This description is exactly one sentence. It tells the user what this section controls.
- **Settings within a section** are ordered by importance: most commonly changed first, least commonly changed last.
- **Future additions:** When adding a setting, place it in the existing section that matches its scope. If no section matches, request a design review.

## 2.3 Section Descriptions (Canonical)

| Section | Description |
|---|---|
| General | Application-wide preferences that affect your overall experience. |
| Editor | Writing surface configuration — fonts, spacing, and editing behavior. |
| Screenplay | Industry formatting standards, scene numbering, and page break rules. |
| Page Setup | Paper dimensions, margins, headers and footers for printed output. |
| Print / Export | Export formats, branding, and output options for PDF and DOCX. |
| Autosave & Files | Automatic save intervals, version history, and file management. |
| Appearance | UI chrome, layout options, and visual preferences for the workspace. |
| Keyboard Shortcuts | Keyboard shortcuts for common actions. Click a binding to rebind. |
| Advanced | Developer tools, debug overlays, and experimental features. |

---

# SECTION 3 — SETTINGS SHELL ANATOMY

## 3.1 Shell Structure

Settings opens as a tab within the Rwanga IDE editor tab bar. It is NOT a modal. It is NOT a separate window.

```
┌──────────────────────────────────────────────────────────────────────┐
│ TAB BAR                                                              │
│  [The Last Light.rga]  [⚙ Settings •3]                              │
├────────────┬─────────────────────────────────────────────────────────┤
│            │                                                         │
│  SETTINGS  │  CONTENT AREA                                           │
│  NAV       │                                                         │
│            │  Section Title                                          │
│  ┌──────┐  │  Description                                            │
│  │Search│  │                                                         │
│  └──────┘  │  ┌─────────────────────────────────┬──────────┐         │
│            │  │ Setting Label        [badge]     │ [control]│         │
│  General   │  │ Helper text                      │          │         │
│  Editor    │  ├─────────────────────────────────┼──────────┤         │
│  Screen…   │  │ Setting Label        [badge]     │ [control]│         │
│  Page…     │  │ Helper text                      │          │         │
│  Print…    │  ├─────────────────────────────────┼──────────┤         │
│  Autosave  │  │ ...                              │          │         │
│  Appear…   │  └─────────────────────────────────┴──────────┘         │
│  Keyboard  │                                                         │
│  Advanced  │                                                         │
│            │                                                         │
│  [Reset All]                                                         │
├────────────┴─────────────────────────────────────────────────────────┤
│ STATUS BAR   Settings   3 modified                Rwanga Script Editor│
└──────────────────────────────────────────────────────────────────────┘
```

## 3.2 Top Area — Tab Bar

- Settings appears as a tab in the existing editor tab bar
- Tab label: `⚙ Settings`
- When settings have been modified, a count badge appears on the tab: `⚙ Settings •3`
- Badge uses `--accent-primary` background, white text, `10px` font, pill shape
- The tab bar follows existing Rwanga IDE tab bar rules — no custom styling

## 3.3 Left Side — Navigation

- **Width:** 220px fixed
- **Background:** `var(--bg-secondary)`
- **Border:** 1px solid `var(--border-secondary)` on the right edge
- **Collapse rules:** Navigation MUST NOT collapse. It is always visible at widths ≥ 768px. Below 768px, navigation stacks above content (see Section 11).

### Navigation Header
- Contains the ⚙ gear icon (20×20) and the word "Settings" at `--font-size-lg`, weight 600
- Separated from search by `1px solid --border-secondary`

### Search Field
- Positioned below header, 8px horizontal padding, 12px vertical padding
- Full-width input
- Placeholder: `Search settings...`
- Background: `var(--bg-primary)`, border: `1px solid var(--border-primary)`, radius: `var(--radius-md)`
- Font: `var(--font-size-sm)`

### Navigation Items
- Each item: 8px vertical padding, 16px horizontal padding
- Icon (18×18) + label + settings count badge
- Active state: `var(--bg-active)` background, `2px solid var(--accent-primary)` left border, `var(--text-primary)` color, weight 500
- Hover state: `var(--bg-hover)` background
- Default state: `var(--text-secondary)` color, weight 400
- Count badge: `10px` font, `var(--bg-quaternary)` background, `var(--text-tertiary)` color, pill shape

### Bottom Actions
- Separated by `1px solid --border-secondary` top border
- **One button: Reset All** (ghost style — `--bg-tertiary` background, `--text-secondary` color, `1px solid --border-primary`, `--radius-md`)
- Padding: 12px 16px
- **No Save button.** Settings uses immediate-apply doctrine (see §1A.4 — every UI change flows through Settings.Store → Applicator → Owner immediately). A Save button with no pending state would be fake interaction → fake ownership → trust damage. (Amended in S10, 2026-05-26.)

## 3.4 Center — Content Area

- **Width:** Flexible, fills remaining space
- **Max content width:** 680px
- **Padding:** 24px 32px (comfortable), 16px 24px (compact)
- **Background:** `var(--bg-primary)`
- **Overflow:** Vertical scroll only

### Content Layout
- Section title at top: `--font-size-lg`, weight 600
- Description below title: `--font-size-sm`, `var(--text-secondary)`
- Settings rows below description

### Special: Page Setup Section
When the Page Setup section is active, the content area splits:
- Left: settings rows (flex 1)
- Right: live page preview panel (240px fixed width, `--bg-secondary`, border-left)

## 3.5 Right Side — Reserved

The right side of the Settings shell is reserved for future use (e.g., contextual preview). No panel occupies this space in the production build.

> **Developer Diagnostic Surface:** The JSON Preview Panel, Tweaks Panel, and density testing controls are engineering tools. They are NOT part of the Settings product surface. They MUST NOT appear in production builds. They are documented separately in the Developer Diagnostic Surface specification and MUST be loaded only when a debug flag is active (`advanced.debugMode === true`). They are excluded from this constitution.

## 3.6 Bottom — Status Bar

- Height: 24px
- Background: `var(--statusbar-bg)`
- Left: section label "Settings" + modified count in `--accent-warning` color
- Right: "Rwanga Script Editor" label
- Font: 11px, `--statusbar-fg` color

---

# SECTION 4 — SETTINGS ROW ANATOMY

## 4.1 Row Structure

Every settings row follows this exact grid layout:

```
┌─────────────────────────────────────────────────┬──────────────────┐
│                                                 │                  │
│  Label Text                      [Scope Badge]  │   [Control] [↺]  │
│  Helper description text                        │                  │
│                                                 │                  │
└─────────────────────────────────────────────────┴──────────────────┘
```

### Grid Definition
- **Grid:** `grid-template-columns: 1fr auto`
- **Gap:** 8px between columns
- **Alignment:** `align-items: start` (top-aligned)

### Left Column (Label + Description)
- **Label row:** flex container with label text + scope badge, 3px bottom margin
  - Label: `var(--font-size-base)` (13px), weight 500, `var(--text-primary)`
  - Scope badge: inline, immediately after label, 8px gap
- **Helper text:** `var(--font-size-sm)` (11px), `var(--text-secondary)`, max-width 480px, line-height 1.4

### Right Column (Control + Reset)
- **Flex container:** `align-items: center`, `gap: 6px`, `justify-content: flex-end`
- **Control:** varies by type (see Section 5)
- **Reset button:** `↺` glyph, 11px, `var(--text-tertiary)`, appears only when value differs from default (opacity transition)

## 4.2 Row Dimensions

| Density | Vertical padding | Row border |
|---|---|---|
| Comfortable | 14px top and bottom | 1px solid `var(--border-secondary)` bottom |
| Compact | 10px top and bottom | 1px solid `var(--border-secondary)` bottom |

## 4.3 Row Variations

There is exactly **one** row structure. No variations. No alternate layouts. No inline rows. No stacked rows. No card rows. One grid. Two columns.

The only exception: the Margins control in Page Setup uses a `MARGIN_GROUP` control type that is taller than other controls. The row structure remains the same — only the control's internal layout differs.

## 4.4 Row Rules

- Every row MUST have a label
- Every row MUST have helper text
- Every row MUST have a scope badge
- Every row MUST have a control
- The reset button appears ONLY when the current value differs from the default
- Label text MUST be human-readable (see Section 6)
- Helper text MUST be one sentence describing what the setting does, written for a screenplay writer, not an engineer
- No row may contain more than one control
- No row may contain nested rows
- No row may contain a collapsible section
- No row may contain a link to another section

---

# SECTION 5 — CONTROL SYSTEM

## 5.1 Control Inventory

Settings uses exactly these control types. No others are permitted.

| Control | Internal ID | When to Use |
|---|---|---|
| Toggle | `toggle` | Boolean on/off choices |
| Radio (segmented) | `radio` | 2–3 mutually exclusive options with short labels |
| Select (dropdown) | `select` | 4+ mutually exclusive options, or options with long labels |
| Number | `number` | Integer or float values with min/max bounds |
| Slider | `slider` | Numeric ranges where relative position matters (zoom, scale) |
| Text | `text` | Free-form string input (headers, footers, watermarks) |
| Color | `color` | Selection from a fixed palette of color swatches |
| Shortcut | `shortcut` | Keyboard binding display with rebind-on-click |
| Margin Group | `margin_group` | Four related numeric fields (top/right/bottom/left) |
| Read-only | `readonly` | Display-only value, no interaction (system info) |

## 5.2 Control Specifications

### 5.2.1 Toggle

**Appearance:** Track (36×20px) with circular thumb (16×16px).

| State | Track | Thumb | Cursor |
|---|---|---|---|
| Off | `var(--bg-quaternary)` | `#fff`, left position (2px from left) | pointer |
| On | `var(--accent-primary)` | `#fff`, right position (18px from left) | pointer |
| Hover | No change to track | No change | pointer |
| Focus | `1px solid var(--accent-primary)` outline, -1px offset | — | — |
| Disabled | `var(--bg-tertiary)`, 40% opacity | 40% opacity | not-allowed |

**Transition:** `left var(--transition-normal)` on thumb, `background var(--transition-normal)` on track.

**Keyboard:** Space toggles. Enter toggles. Tab focuses.

**When to use:** Always for boolean choices. Never use checkboxes. Never use Yes/No dropdowns.

### 5.2.2 Radio (Segmented Control)

**Appearance:** Horizontal button group with shared border.

| State | Background | Text | Border |
|---|---|---|---|
| Active option | `var(--accent-primary)` | `#fff`, weight 600 | `1px solid var(--border-primary)` outer |
| Inactive option | `var(--bg-primary)` | `var(--text-secondary)`, weight 400 | `1px solid var(--border-primary)` between |
| Hover (inactive) | `var(--bg-hover)` | `var(--text-primary)` | — |
| Focus | `1px solid var(--accent-primary)` outline | — | — |
| Disabled | 40% opacity on entire group | — | — |

**Dimensions:** Padding `5px 12px` per option, `var(--font-size-base)`, radius `var(--radius-md)` on outer edges.

**When to use:** 2–3 mutually exclusive choices where each label is ≤ 10 characters. Examples: Dark/Light/System, Left/Right, Portrait/Landscape.

**When NOT to use:** 4+ options (use Select). Labels longer than 10 characters (use Select).

### 5.2.3 Select (Dropdown)

**Appearance:** Native `<select>` element with custom styling.

| State | Background | Border | Text |
|---|---|---|---|
| Default | `var(--bg-primary)` | `1px solid var(--border-primary)` | `var(--text-primary)` |
| Hover | `var(--bg-primary)` | `1px solid var(--border-primary)` | — |
| Focus | — | `1px solid var(--border-focus)` | — |
| Disabled | `var(--bg-secondary)` | `1px solid var(--border-secondary)` | `var(--text-disabled)` |

**Dimensions:** Padding `5px 28px 5px 8px`, min-width 160px, max-width 240px. Custom chevron SVG at right 8px center.

**When to use:** Mutually exclusive choices with 4+ options or long option labels. Examples: Language, Export Format, Line Height, Paper Size.

### 5.2.4 Number

**Appearance:** Input field with decrement/increment buttons.

```
┌─────────────────────────────────┐
│  [−]    56    pt   [+]          │
└─────────────────────────────────┘
```

| State | Background | Border | Text |
|---|---|---|---|
| Default | `var(--bg-primary)` | `1px solid var(--border-primary)` | `var(--text-primary)`, centered |
| Focus | — | `1px solid var(--border-focus)` | — |
| Disabled | `var(--bg-secondary)` | `1px solid var(--border-secondary)` | `var(--text-disabled)` |
| Invalid (out of range) | — | `1px solid var(--accent-error)` | `var(--accent-error)` |

**Dimensions:** Input width 56px, text centered. Button padding `4px 6px`. Unit label: `--font-size-sm`, `var(--text-tertiary)`, right-padded.

**Buttons:** `−` and `+` glyphs, `var(--text-secondary)`, 14px font. Hover: `var(--text-primary)`.

**Keyboard:** Up/Down arrows increment/decrement. Direct typing allowed. Values are clamped to min/max on blur.

**When to use:** Numeric values with defined bounds. Examples: Font Size (8–24), Autosave Interval (5–300), Recent Files Limit (5–50).

### 5.2.5 Slider

**Appearance:** Horizontal track with circular thumb and value label.

```
──────────●──────────  100%
```

| Element | Style |
|---|---|
| Track | 4px height, `var(--bg-quaternary)`, radius 2px |
| Thumb | 14px diameter, `var(--accent-primary)`, 2px `var(--bg-primary)` border |
| Value label | `var(--font-size-base)`, `var(--text-primary)`, right of track, min-width 40px, end-aligned |

**Dimensions:** Track width 120px.

**Disabled:** Track and thumb at 40% opacity, cursor not-allowed.

**When to use:** Numeric ranges where the relative position conveys meaning. Examples: Window Zoom (50%–200%).

**When NOT to use:** Precise values where the user needs to type a specific number (use Number).

### 5.2.6 Text

**Appearance:** Standard text input.

| State | Background | Border |
|---|---|---|
| Default | `var(--bg-primary)` | `1px solid var(--border-primary)` |
| Focus | — | `1px solid var(--border-focus)` |
| Disabled | `var(--bg-secondary)` | `1px solid var(--border-secondary)` |

**Dimensions:** Padding `5px 8px`, min-width 200px, max-width 280px, radius `var(--radius-md)`.

**Placeholder:** `var(--text-tertiary)`, descriptive example (e.g., "e.g. CONFIDENTIAL DRAFT").

**When to use:** Free-form strings. Examples: Header Text, Footer Text, Watermark, Default Save Location.

### 5.2.7 Color

**Appearance:** Horizontal row of circular color swatches.

| State | Border | Scale |
|---|---|---|
| Default swatch | `2px solid transparent` | 1.0 |
| Active swatch | `2px solid var(--text-primary)` | 1.1 |
| Hover swatch | — | 1.05 |

**Dimensions:** 24px diameter per swatch, 6px gap between swatches.

**When to use:** Selection from a curated palette. MUST always have predefined options. MUST NOT use a free-form color picker.

**When NOT to use:** Arbitrary colors (not supported — all color choices are from predefined palettes).

### 5.2.8 Shortcut

**Appearance:** Sequence of keyboard key caps.

```
 Ctrl  +  Shift  +  P
```

| Element | Style |
|---|---|
| Key cap | `var(--bg-tertiary)` background, `1px solid var(--border-primary)`, radius 3px, padding `2px 6px`, min-width 22px height 22px, `11px` weight 500 |
| Separator | `+` glyph, `var(--text-tertiary)`, 11px |

**Interaction:** Click the shortcut row to enter rebind mode. Rebind mode is defined separately in the Keyboard Shortcuts section behavior specification.

**Disabled:** 40% opacity on all key caps.

### 5.2.9 Margin Group

**Appearance:** 2×2 grid of labeled numeric fields.

```
┌──────────────────────┐
│  TOP   [1.0] in      │
│  RIGHT [1.0] in      │
│  BOTTOM[1.0] in      │
│  LEFT  [1.5] in      │
└──────────────────────┘
```

| Element | Style |
|---|---|
| Container | `var(--bg-primary)` background, `1px solid var(--border-primary)`, radius `var(--radius-md)`, padding `6px 8px`, min-width 160px |
| Field label | 10px, `var(--text-tertiary)`, uppercase, 0.04em letter-spacing, 32px min-width |
| Input | 48px wide, `var(--bg-secondary)` background, `1px solid var(--border-secondary)`, centered text, 12px font |
| Unit | `10px`, `var(--text-tertiary)`, "in" |

**Grid:** `grid-template-columns: 1fr 1fr`, 4px gap.

**When to use:** Only for the Page Setup margins setting. This control type is not generic — do not use it for other settings.

### 5.2.10 Read-only

**Appearance:** Dash glyph `—` in `var(--text-tertiary)`, 12px.

**When to use:** Settings that display computed or system values that the user cannot change.

## 5.3 Control Selection Rules

| Question | Answer → Control |
|---|---|
| Is it on/off? | Toggle |
| Is it one-of-few with short labels (2–3)? | Radio |
| Is it one-of-many or long labels (4+)? | Select |
| Is it a number with bounds? | Number |
| Is it a number where position matters? | Slider |
| Is it free text? | Text |
| Is it a color from a palette? | Color |
| Is it a key binding? | Shortcut |
| Is it four related margins? | Margin Group |
| Is it read-only? | Read-only |

Engineers MUST use this table to select controls. Engineers MUST NOT invent new control types.

---

# SECTION 6 — HUMAN LANGUAGE RULES

## 6.1 Core Rule

**Users MUST never see implementation language.**

The Settings UI speaks to screenplay writers. Not to engineers. Not to the codebase.

## 6.2 Label Rules

| Rule | Bad Example | Good Example |
|---|---|---|
| No control-type words | `SELECT language` | `Interface Language` |
| No enum values | `TOGGLE spellcheck` | `Spellcheck` |
| No internal identifiers | `editor.fontSize` | `Editor Font Size` |
| No abbreviations | `Max vers.` | `Local Version History` |
| No technical jargon | `ContentEditable wrap mode` | `Word Wrap` |
| No instructions in labels | `Click to change save format` | `Default Save Format` |
| Title case for labels | `default export format` | `Default Export Format` |

## 6.3 Helper Text Rules

- Every setting MUST have helper text
- Helper text MUST be one sentence
- Helper text MUST describe what the setting does, not how it works
- Helper text MUST be written for a screenplay writer, not an engineer
- Helper text MUST NOT reference internal APIs, function names, or data models
- Helper text MUST start with a verb or noun, not with "This setting"

| Bad | Good |
|---|---|
| "This setting controls the editor.fontSize property." | "Font size for the writing surface. Standard screenplay is 12pt." |
| "Toggles the spellcheck boolean." | "Enable browser spellcheck in the editor surface." |
| "Sets the HTMX autosave interval in ms." | "How often the script is automatically saved, in seconds." |

## 6.4 Option Label Rules

- Option labels MUST be human-readable
- Option labels MUST NOT expose internal values
- Option labels MAY include clarifying context in parentheses

| Bad | Good |
|---|---|
| `1.0` | `1.0 — Single` |
| `standard_us` | `US Standard (Letter)` |
| `top_right` | `Top Right` |
| `pdf` | `PDF` |
| `fountain` | `Fountain (.fountain)` |

## 6.5 Kurdish Language Rules

- Every label MUST have both English (`label`) and Kurdish (`labelKu`) defined in the schema
- Kurdish labels follow the same human-readability rules
- The UI language toggle switches all visible labels
- Kurdish text renders in Noto Naskh Arabic / Cairo (per the design system)
- RTL layout applies automatically when Kurdish is active

---

# SECTION 7 — BADGES & STATUS SYSTEM

## 7.1 Scope Badges

Scope badges indicate which surface a setting affects. Every setting row displays exactly one scope badge.

### Allowed Scope Badges

| Badge | Label | Color | Background | Description |
|---|---|---|---|---|
| Flow | `Flow` | `#FFC107` | `#FFC10718` (8% alpha) | Affects writing comfort in Flow View |
| Print | `Print` | `#007acc` | `#007acc18` | Affects printed page geometry |
| Export | `Export` | `#4EC9B0` | `#4EC9B018` | Affects exported PDF/DOCX output |
| All | `All` | `#9e9e9e` | `#9e9e9e18` | Affects all modes |

### Badge Anatomy

```
  ● Flow
```

- **Dot:** 6px diameter circle, same color as label
- **Label:** 10px, weight 600, letter-spacing 0.04em
- **Container:** padding `2px 7px`, radius 3px, background at 8% alpha of the badge color
- **Gap between dot and label:** 4px

### Badge Rules

- Every row displays exactly **one** scope badge
- The badge appears immediately after the label text, inline, with 8px gap
- Badge placement MUST NOT vary — always in the label row, never in the control column, never below the helper text
- Engineers MUST NOT invent new scope badge types
- If a new scope is needed, it requires design approval and must be added to this document first

## 7.2 Status Badges

Status badges indicate operational state of a setting. They are separate from scope badges and appear in addition to the scope badge.

### Allowed Status Badges

| Badge | Label | Visual | When to Show |
|---|---|---|---|
| Restart Required | `Restart Required` | `var(--accent-warning)` text, `var(--accent-warning)18` background | Setting takes effect only after app restart |
| Experimental | `Experimental` | `var(--accent-error)` text, `var(--accent-error)18` background | Feature is unstable or in development |
| Pro Required | `Pro` | `var(--accent-primary)` text, `var(--accent-primary)18` background | Feature requires Pro plan |

### Status Badge Anatomy

- Same visual structure as scope badges (dot + label)
- Font: 10px, weight 600, letter-spacing 0.04em
- Container: padding `2px 7px`, radius 3px
- Appears in the label row, after the scope badge, with 6px gap

### Badge Count Rules

- **Maximum badges per row: 2** (one scope badge + one status badge)
- Scope badge is always first, status badge second
- If no status badge applies, only the scope badge appears
- Engineers MUST NOT add more than one status badge per row
- Engineers MUST NOT invent new badge types

## 7.3 Forbidden Badge Patterns

The following patterns are explicitly forbidden:

- ❌ Badges that expose internal state names (`PERSISTS_ONLY`, `DEFERRED`, `WIRED`)
- ❌ Badges that duplicate the section name (`Editor`, `General`)
- ❌ Badges showing control types (`Toggle`, `Select`, `Radio`)
- ❌ Badges showing technical state (`JSON`, `API`, `Electron`)
- ❌ Multiple scope badges on one row
- ❌ Badges in the control column
- ❌ Badges below the helper text
- ❌ Badges with icons (text-only, except the leading dot)

---

# SECTION 8 — DISABLED STATE DESIGN

## 8.1 Disabled State Categories

Settings can be disabled for three reasons. Each has a distinct visual treatment.

### 8.1.0 Operational classification rule (added in S10, 2026-05-26)

The four disabled-state categories below are **operationally classifiable** — engineers can answer "which state does this row belong to?" without subjective debate. The rule is:

| State | Test | Visual category |
|---|---|---|
| REAL | An applicator is registered for the entry. | Full opacity, interactive. |
| PERSISTS_ONLY | No applicator AND a named follow-up slice within **≤ the next 2 slices** of the active plan will wire it. | §8.1.2 |
| DEFERRED | No applicator AND **no follow-up slice** named within the next 2 slices. Implementation horizon unknown or later milestone. | §8.1.1 |
| CONDITIONAL_DISABLED | Applicator registered AND a dependency declared in `entry.dependencies` is currently unmet. | §8.1.3 |

**Registry signaling:**

Each registry entry without an applicator MUST carry an explicit `state` field:
- `state: 'persists-only'` — set by the slice author when the next-2-slices wiring is named.
- `state: 'deferred'` — set when no near-term wiring is named.

**Default behavior:** a no-applicator entry that omits the `state` field renders as DEFERRED. The conservative default — when in doubt, the answer to "when will this be wired?" is "we don't know" — protects users from being shown rows that look mid-wiring when no wiring is actually planned.

**PERSISTS_ONLY is transient.** The state moves with the plan: an entry tagged `persists-only` while a wiring slice is queued transitions to REAL when the slice ships. If the slice is removed from the plan, the entry must be retagged DEFERRED. A registry-level unit test (introduced in S9.2) asserts every no-applicator entry has an explicit `state` field; PRs that add a no-applicator entry without tagging fail the check.

### 8.1.1 NOT YET IMPLEMENTED (DEFERRED)

The setting exists in the schema but the behavior is not wired.

**Visual treatment:**
- Entire row at **40% opacity**
- Control is non-interactive (pointer-events: none)
- Helper text appended with: `"This feature is coming soon."`
- No special badge (the lower opacity is sufficient signal)

**Rule:** DEFERRED settings MUST remain in the schema and visible in the UI at reduced opacity. They MUST NOT be hidden entirely. They serve as a roadmap signal to the user.

### 8.1.2 PERSISTS ONLY

The setting saves its value but does not yet affect application behavior. The setting has no registered Applicator (see Section 1A.5) AND a named follow-up slice within the next 2 slices will wire it (see §8.1.0). The control is non-interactive — the user cannot change the value until behavior is wired.

**Visual treatment (canonicalized in S10, 2026-05-26 — H3A doctrine):**

- **Row retains full visual fidelity.** No row-level opacity fade. Label, helper text, padding, spacing, hierarchy, and typography are visually identical to a REAL row.
- **Control is disabled / non-interactive.** The native `disabled` attribute on the control surfaces the browser's standard disabled treatment (greyed-out, `cursor: not-allowed`). `pointer-events: none` is applied to the row's value column to prevent accidental click-through, NOT to the row container.
- **Helper text** is appended with the literal string `"Behavior not wired yet."`.
- **No row-level opacity fade.** (Distinguishes PERSISTS_ONLY from DEFERRED — see §8.1.1.)
- **No badges, no chips, no labels.** The disabled control plus the appended helper text are the only signals.
- **No lock icons.**
- **No tooltip-only explanations.** The "Behavior not wired yet." signal is always visible inline.

**History:** RC1 v1.0 originally specified a 60% row-level opacity. The H3 slice applied that literally and the result visually damaged the UI — labels and hierarchy collapsed together at 60%. The H3A correction (slice authored 2026-05-26) moved the disabled signal to the interaction layer only. S10 (this slice) canonicalizes H3A as the doctrine and amends the prior 60% rule. The `tests/e2e/settings/persists-only-visual-contract.spec.js` test (renamed from `visual-contract-h3a.spec.js` in S10) is the binding regression guard against the four named drifts: row-level opacity drift, helper opacity drift, label-helper hierarchy collapse, and row spacing collapse.

**Rule:** PERSISTS_ONLY settings MUST retain their default value. They MUST NOT allow user interaction. Row-level opacity MUST stay at 1.0. Once an Applicator is registered and behavior is confirmed, remove the appended `"Behavior not wired yet."` text and the row transitions to REAL.

### 8.1.3 CONDITIONALLY DISABLED

The setting is real and wired, but currently disabled due to another setting's state. Example: "Scene Number Position" is disabled when "Scene Numbering" is off.

**Visual treatment:**
- Row at **40% opacity**
- Control is non-interactive (pointer-events: none)
- Helper text unchanged (no appended text)
- No badge
- When the dependency changes, the row transitions to full opacity with `var(--transition-normal)`

**Rule:** Conditionally disabled settings MUST become active immediately when their dependency changes. No page reload.

## 8.2 Disabled Control Rendering

All control types share the same disabled behavior:

- Opacity reduction applied at the **row level** (not per-control)
- `pointer-events: none` on the control
- `cursor: not-allowed` on the row
- No color changes — just opacity
- The reset button is hidden (opacity 0) on disabled rows regardless of modification state

## 8.3 Absolute Prohibition

- ❌ Lock icons on disabled rows
- ❌ "Coming soon" badges (use helper text instead)
- ❌ Tooltip-only explanations (must be visible inline)
- ❌ Greyed-out text that differs from the opacity approach
- ❌ Hidden disabled rows (always show them)
- ❌ Strikethrough text on disabled labels

---

# SECTION 9 — SEARCH BEHAVIOR

## 9.1 Search UX

Settings search is a **live filter** that operates across all sections simultaneously.

### Behavior

1. User types in the search input
2. After each keystroke, all sections are filtered
3. Matching settings are shown; non-matching settings are hidden
4. When search is active, **all matching sections** are shown, not just the active nav section
5. A results count appears above the settings list: `"12 results for 'font'"`
6. When search is cleared, the view returns to the previously active section

### Match Logic

Search matches against:
- Setting label (case-insensitive)
- Setting helper text (case-insensitive)
- Setting ID (case-insensitive)
- Scope badge label (case-insensitive)

Search does NOT match against:
- Option values
- Kurdish labels (unless the UI language is Kurdish)
- Badge status text

### Highlight

- Matched text is NOT highlighted within the results. The filter is sufficient.
- This is a deliberate simplicity decision. Highlighting adds visual noise.

### Empty State

When search returns zero results:

```
        No settings match your search.
```

- Centered text, `var(--text-tertiary)`, `var(--font-size-base)`, 48px top padding

### Keyboard Behavior

- **Ctrl+F / Cmd+F** — focuses the search input (when Settings tab is active)
- **Escape** — clears search and returns to section view
- **Tab** — moves focus from search to first visible setting control
- **Arrow keys** — no special behavior in search (standard browser behavior)

## 9.2 Search Performance Rules

- Search MUST be instant (no debounce beyond browser rendering)
- Search operates on the in-memory settings schema — no server round trip
- Section counts in navigation update to show filtered counts during search

---

# SECTION 10 — SETTINGS VS DOCUMENT SETTINGS

## 10.1 Scope Distinction

Settings contains two categories of preferences:

### Application Preferences (persist per-user)
- Theme, language, window zoom
- Editor font, autocomplete, spellcheck
- Sidebar position, status bar visibility
- Keyboard shortcuts
- Autosave interval
- Debug mode, experimental features

**Storage:** User profile. Persisted across all documents. Synced to cloud if logged in.

### Document Preferences (persist per-document)
- Screenplay profile (US Standard, A4, BBC)
- Page setup (paper size, margins, headers/footers)
- Scene numbering style
- Export branding and watermark

**Storage:** Document metadata. Saved with the `.rga` file. Different documents can have different values.

## 10.2 Visual Distinction

Document preferences and application preferences MUST be visually distinguishable:

- **Application preferences:** appear in sections General, Editor, Appearance, Keyboard Shortcuts, Autosave & Files, Advanced
- **Document preferences:** appear in sections Screenplay, Page Setup, Print / Export
- The section description for document-scoped sections MUST include the phrase **"for this document"** or **"for the current script"**

| Section | Scope |
|---|---|
| General | Application |
| Editor | Application |
| Screenplay | Document |
| Page Setup | Document |
| Print / Export | Document |
| Autosave & Files | Application |
| Appearance | Application |
| Keyboard Shortcuts | Application |
| Advanced | Application |

## 10.3 Engineer Implementation Rules

- Application preferences MUST read from and write to the user preferences store
- Document preferences MUST read from and write to the active document's metadata
- If no document is open, document-scoped sections MUST display their default values
- If no document is open, document-scoped controls MUST be interactable (changes affect the default template)
- Engineers MUST NOT mix application storage with document storage
- Engineers MUST NOT create settings that write to both stores from a single control

---

# SECTION 11 — RESPONSIVE RULES

## 11.1 Breakpoint Definitions

| Breakpoint | Width | Name |
|---|---|---|
| Large desktop | ≥ 1200px | Full layout |
| Medium desktop | 992px – 1199px | Collapsed JSON panel |
| Narrow desktop | 768px – 991px | No JSON panel, compact nav |
| Tablet | 600px – 767px | Stacked layout |
| Mobile | < 600px | Single column |

## 11.2 Layout Rules per Breakpoint

### Large Desktop (≥ 1200px)
- Nav: 220px, visible
- Content: flex 1, max-width 680px
- JSON panel: 320px (if enabled via tweaks)
- Page preview: 240px (when on Page Setup)
- Status bar: visible

### Medium Desktop (992px – 1199px)
- Nav: 220px, visible
- Content: flex 1, max-width 680px
- JSON panel: hidden
- Page preview: 240px
- Status bar: visible

### Narrow Desktop (768px – 991px)
- Nav: 180px (reduced width), visible
- Content: flex 1
- JSON panel: hidden
- Page preview: hidden (settings only)
- Status bar: visible
- Nav item count badges: hidden

### Tablet (600px – 767px)
- Nav: hidden. Section selector becomes a horizontal scrolling tab bar at top of content area
- Content: full width, 16px horizontal padding
- JSON panel: hidden
- Page preview: hidden
- Status bar: hidden
- Search: moves to top of content area, above section tabs

### Mobile (< 600px)
- Nav: hidden. Dropdown section selector at top
- Content: full width, 12px horizontal padding
- All controls: minimum touch target 44px height
- Status bar: hidden
- Bottom action (Reset All only): sticky at bottom of scroll

## 11.3 Responsive Rules

- Settings MUST remain fully usable at all breakpoints
- No settings may be hidden at any breakpoint
- Control min-width values may be reduced on tablet/mobile (select: 120px, text: 160px)
- Row grid switches to single column (stacked) below 600px: label above, control below
- Touch targets MUST be at least 44px on touch devices

---

# SECTION 12 — DESIGN TOKENS

## 12.1 Spacing

| Token | Value | Usage |
|---|---|---|
| Row padding (comfortable) | 14px 0 | Vertical padding on each settings row |
| Row padding (compact) | 10px 0 | Vertical padding in compact density |
| Content padding (comfortable) | 24px 32px | Outer padding of the content area |
| Content padding (compact) | 16px 24px | Outer padding in compact density |
| Label-to-helper gap | 3px | Space between label row and helper text |
| Label-to-badge gap | 8px | Space between label text and scope badge |
| Badge-to-badge gap | 6px | Space between scope and status badges |
| Control-to-reset gap | 6px | Space between control and reset button |
| Section bottom margin (comfortable) | 28px | Space after each section block |
| Section bottom margin (compact) | 20px | Space after each section in compact |
| Section title to description | 4px–8px | Gap between section title and description |
| Section description to rows | 12px–16px | Gap between description and first row |

## 12.2 Typography

| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| Section title | `var(--font-ui)` | `var(--font-size-lg)` (16px) | 600 | `var(--text-primary)` |
| Section description | `var(--font-ui)` | `var(--font-size-sm)` (11px) | 400 | `var(--text-secondary)` |
| Setting label | `var(--font-ui)` | `var(--font-size-base)` (13px) | 500 | `var(--text-primary)` |
| Helper text | `var(--font-ui)` | `var(--font-size-sm)` (11px) | 400 | `var(--text-secondary)` |
| Badge label | `var(--font-ui)` | 10px | 600 | Badge color |
| Control text | `var(--font-ui)` | `var(--font-size-base)` (13px) | 400 | `var(--text-primary)` |
| Reset button | `var(--font-ui)` | 11px | 400 | `var(--text-tertiary)` |
| Nav item | `var(--font-ui)` | `var(--font-size-base)` (13px) | 400/500 | `var(--text-secondary/primary)` |
| Nav title | `var(--font-ui)` | `var(--font-size-lg)` (16px) | 600 | `var(--text-primary)` |
| Search input | `var(--font-ui)` | `var(--font-size-sm)` (11px) | 400 | `var(--text-primary)` |
| Status bar | `var(--font-ui)` | 11px | 400 | `var(--statusbar-fg)` |
| Key cap (shortcut) | `var(--font-ui)` | 11px | 500 | `var(--text-primary)` |

## 12.3 Density

Settings supports two density modes:

| Property | Comfortable | Compact |
|---|---|---|
| Row vertical padding | 14px | 10px |
| Content outer padding | 24px 32px | 16px 24px |
| Section bottom margin | 28px | 20px |
| Section title-to-description | 8px | 4px |
| Description-to-rows | 16px | 12px |

Density is controlled by a Tweaks toggle. Default is Comfortable.

## 12.4 Radius

| Element | Radius |
|---|---|
| Input fields | `var(--radius-md)` (4px) |
| Buttons | `var(--radius-md)` (4px) |
| Badges | 3px |
| Toggle track | 10px (pill) |
| Toggle thumb | 50% (circle) |
| Color swatch | 50% (circle) |
| Nav count pill | 8px |
| Key cap | 3px |

## 12.5 Borders

| Element | Border |
|---|---|
| Row separator | `1px solid var(--border-secondary)` bottom |
| Nav right edge | `1px solid var(--border-secondary)` |
| Input fields | `1px solid var(--border-primary)` |
| Input fields (focus) | `1px solid var(--border-focus)` |
| Radio group outer | `1px solid var(--border-primary)` |
| Radio separator | `1px solid var(--border-primary)` between options |
| Margin group container | `1px solid var(--border-primary)` |
| Margin group inputs | `1px solid var(--border-secondary)` |
| Page preview panel | `1px solid var(--border-secondary)` left |

## 12.6 Shadows

Settings uses NO shadows except:
- Page Setup preview page: `0 4px 16px rgba(0,0,0,0.4)` (simulating a physical page)
- Toggle thumb: `0 1px 2px rgba(0,0,0,0.3)`

No other shadows are permitted in Settings.

## 12.7 Animation & Timing

| Element | Property | Timing |
|---|---|---|
| Toggle thumb position | `left` | `var(--transition-normal)` (0.2s ease) |
| Toggle track color | `background` | `var(--transition-normal)` |
| Nav item hover | `background, color` | `var(--transition-fast)` (0.1s ease) |
| Radio selection | `background, color` | `var(--transition-fast)` |
| Color swatch scale | `transform` | `var(--transition-fast)` |
| Reset button appear | `opacity` | `var(--transition-fast)` |
| Disabled row opacity | `opacity` | `var(--transition-normal)` |

Settings MUST NOT use:
- Entrance animations
- Exit animations
- Loading spinners (settings load instantly from memory)
- Scroll animations
- Parallax effects
- Spring physics

---

# SECTION 13 — ACCESSIBILITY

## 13.1 Keyboard Navigation

| Key | Behavior |
|---|---|
| Tab | Move focus forward through: search → nav items → settings controls → action buttons |
| Shift+Tab | Move focus backward |
| Enter | Activate focused button/control. Toggle focused toggle. |
| Space | Toggle focused toggle. Activate focused button. |
| Arrow Up/Down | Navigate nav items when nav is focused. Increment/decrement number inputs. |
| Arrow Left/Right | Navigate radio options. Navigate slider. |
| Escape | Clear search. Exit shortcut rebind mode. |
| Ctrl+F / Cmd+F | Focus search input |

## 13.2 Focus Order

1. Search input
2. Navigation items (top to bottom)
3. Navigation action button (Reset All)
4. Settings rows in content area (top to bottom, each row: control then reset)
5. JSON panel copy button (if visible)

## 13.3 ARIA Requirements

| Element | ARIA |
|---|---|
| Toggle | `role="switch"`, `aria-checked="true/false"` |
| Radio group | `role="radiogroup"`, each option `role="radio"`, `aria-checked` |
| Select | Native `<select>` — inherits semantics |
| Number input | `role="spinbutton"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` |
| Slider | Native `<input type="range">` — inherits semantics |
| Search input | `role="search"` on container, `aria-label="Search settings"` |
| Nav | `<nav>` element with `aria-label="Settings sections"` |
| Scope badge | `title` attribute with description (e.g., "Affects writing comfort in Flow View") |
| Disabled row | `aria-disabled="true"` on the row container |

## 13.4 Contrast

- All text MUST meet WCAG 2.1 AA contrast requirements (4.5:1 for normal text, 3:1 for large text)
- Interactive controls MUST have at least 3:1 contrast against their background
- Focus indicators MUST be visible (1px solid `var(--accent-primary)`)
- Both dark and light themes MUST independently meet contrast requirements

## 13.5 Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- All transitions set to `0s` (instant)
- Toggle thumb moves instantly (no slide)
- Color swatch scale change is instant
- No other motion exists in Settings to disable

## 13.6 Screen Reader Announcements

- When a setting value changes, the new value MUST be announced (use `aria-live="polite"` on the control region or rely on native input semantics)
- When search filters results, the results count MUST be announced (`aria-live="polite"` on the results count element)
- When a section changes via nav, the section title MUST be announced (focus management on section title)

---

# SECTION 14 — ENGINEER IMPLEMENTATION CONTRACT

## 14.1 What Engineers MUST Do

- Implement behavior for settings as defined in the schema
- Wire controls to read from and write to the correct store (user prefs or document metadata)
- Create Playwright tests proving each setting is functional
- Follow the row structure defined in Section 4 exactly
- Use the control types defined in Section 5 exactly
- Use the labels and helper text defined in the schema exactly
- Apply scope badges as defined in the schema
- Follow disabled state rules from Section 8

## 14.2 What Engineers MUST NOT Do

| Forbidden Action | Why |
|---|---|
| Invent new control types | All controls are defined in Section 5 |
| Invent new badge types | All badges are defined in Section 7 |
| Invent new row layouts | The row is defined in Section 4 |
| Change spacing values | Spacing is defined in Section 12 |
| Change font sizes or weights | Typography is defined in Section 12 |
| Add borders not specified here | Borders are defined in Section 12 |
| Add shadows | Shadows are restricted per Section 12.6 |
| Add animations | Animations are restricted per Section 12.7 |
| Change disabled state appearance | Disabled states are defined in Section 8 |
| Expose internal identifiers in the UI | Language rules are defined in Section 6 |
| Add settings without schema entry | Every setting requires a schema definition first |
| Reorder sections | Section order is defined in Section 2 |
| Merge or split sections | Section structure is defined in Section 2 |
| Add inline help links | Not part of the Settings design |
| Add icons to setting labels | Labels are text-only (badges use dots, not icons) |

## 14.3 Decision Escalation

If an engineer encounters a situation not covered by this document:

1. **STOP** implementation of the visual aspect
2. File a design request describing the situation
3. Wait for an update to this constitution before implementing
4. Do NOT improvise a visual solution

This applies to:

- New control types needed
- New badge types needed
- New section structures needed
- New responsive behaviors needed
- New disabled state categories needed
- Any visual decision not documented here

## 14.4 Testing Contract

Every setting MUST have the following Playwright assertions:

1. **Render test:** Setting row appears in the correct section with correct label, helper text, scope badge, and control type
2. **Interaction test:** Control accepts input and updates internal state
3. **Persistence test:** Changed value survives a settings reload
4. **Reset test:** Reset button restores the default value
5. **Scope test:** Document-scoped settings read from and write to document metadata; app-scoped settings read from and write to user preferences

---

# SECTION 15 — IMPLEMENTATION EXAMPLES

## 15.1 Theme Setting (Radio Control)

**Section:** General
**Setting ID:** `theme`
**Label:** `Theme`
**Label (KU):** `ڕووکار`
**Helper:** `Switch between dark and light appearance.`
**Scope:** All
**Control:** Radio (segmented)
**Options:** Dark | Light | System
**Default:** Dark

**Row rendering:**
```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  Theme                                 ● All    │ [Dark|Light|System]  │
│  Switch between dark and light appearance.      │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules:**
- Changing theme MUST immediately update `document.documentElement.setAttribute('data-theme', value)`
- "System" MUST read `prefers-color-scheme` and respond to changes
- Value persists to user preferences (app-scoped)

---

## 15.2 Interface Language Setting (Select Control)

**Section:** General
**Setting ID:** `language`
**Label:** `Interface Language`
**Label (KU):** `زمانی ڕووکار`
**Helper:** `Controls UI text direction and translations. Editor content language is separate.`
**Scope:** All
**Control:** Select
**Options:** English, کوردی (Sorani), العربية
**Default:** en

**Row rendering:**
```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  Interface Language                    ● All    │ [English        ▾]   │
│  Controls UI text direction and translations.   │                      │
│  Editor content language is separate.           │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules:**
- Changing language MUST trigger a full UI relabel (all visible text switches)
- Changing to Kurdish or Arabic MUST set `dir="rtl"` on the root element
- This is an app-scoped preference

---

## 15.3 Autosave Setting (Toggle + Number)

**Section:** Autosave & Files
**Setting ID (toggle):** `autosave.enabled`
**Label:** `Autosave`
**Helper:** `Automatically save the current script at regular intervals.`
**Scope:** All
**Control:** Toggle
**Default:** true

**Setting ID (interval):** `autosave.interval`
**Label:** `Autosave Interval`
**Helper:** `How often the script is automatically saved, in seconds.`
**Scope:** All
**Control:** Number (min: 5, max: 300, unit: s)
**Default:** 30

**Row rendering (two separate rows):**
```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  Autosave                              ● All    │           [●━━━━━]   │
│  Automatically save the current script at       │                      │
│  regular intervals.                             │                      │
├─────────────────────────────────────────────────┼──────────────────────┤
│  Autosave Interval                     ● All    │  [−] 30 s [+]        │
│  How often the script is automatically saved,   │                      │
│  in seconds.                                    │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules:**
- When `autosave.enabled` is false, `autosave.interval` MUST be conditionally disabled (Section 8.1.3)
- The interval row appears at 40% opacity when autosave is off
- Values are app-scoped

---

## 15.4 Page Setup Margins (Margin Group Control)

**Section:** Page Setup
**Setting ID:** `pageSetup.margins`
**Label:** `Margins`
**Helper:** `Page margins in inches. Standard screenplay: 1.5" left, 1" top/right/bottom.`
**Scope:** Print
**Control:** Margin Group
**Default:** `{ top: 1, bottom: 1, left: 1.5, right: 1 }`

**Row rendering:**
```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  Margins                             ● Print    │ ┌────────────────┐   │
│  Page margins in inches. Standard screenplay:   │ │ TOP  [1.0] in  │   │
│  1.5" left, 1" top/right/bottom.                │ │ RIGHT[1.0] in  │   │
│                                                 │ │ BOTM [1.0] in  │   │
│                                                 │ │ LEFT [1.5] in  │   │
│                                                 │ └────────────────┘   │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules:**
- Margin values update the Page Preview live (when visible)
- Values are document-scoped (per-script)
- Min: 0, Max: 3, Step: 0.1

---

## 15.5 Keyboard Shortcut (Shortcut Control)

**Section:** Keyboard Shortcuts
**Setting ID:** `kb.commandPalette`
**Label:** `Command Palette`
**Helper:** `Open the command palette overlay.`
**Scope:** All
**Control:** Shortcut
**Default:** `Ctrl+Shift+P`

**Row rendering:**
```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  Command Palette                       ● All    │  [Ctrl]+[Shift]+[P]  │
│  Open the command palette overlay.              │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules:**
- Click on the shortcut activates rebind mode
- In rebind mode, the control shows "Press new shortcut..." in `var(--accent-primary)` color
- Pressing Escape cancels rebind mode
- Pressing a new key combination saves immediately
- Conflicts with existing shortcuts MUST be detected and warned
- Values are app-scoped

---

## 15.6 Experimental Feature (Toggle + Status Badge)

**Section:** Advanced
**Setting ID:** `advanced.enableExperimental`
**Label:** `Experimental Features`
**Helper:** `Enable features still in development. May be unstable.`
**Scope:** All
**Control:** Toggle
**Default:** false
**Status Badge:** Experimental

**Row rendering:**
```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  Experimental Features   ● All  ● Experimental  │           [━━━━━●]   │
│  Enable features still in development.          │                      │
│  May be unstable.                               │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules:**
- Toggle enables/disables all experimental features globally
- Individual experimental features are NOT listed in Settings — they are controlled by this single master toggle
- Changing this setting MAY require restart (add Restart Required status badge if so)

---

## 15.7 DEFERRED Setting Example

**Section:** Editor
**Setting ID:** `editor.aiAssist`
**Label:** `AI Writing Assist`
**Helper:** `Get AI suggestions while writing. This feature is coming soon.`
**Scope:** Flow
**Control:** Toggle
**Default:** false
**State:** DEFERRED

**Row rendering:**
```
┌─────────────────────────────────────────────────┬──────────────────────┐  ← 40% opacity
│  AI Writing Assist                   ● Flow     │           [━━━━━●]   │
│  Get AI suggestions while writing.              │                      │
│  This feature is coming soon.                   │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules:**
- Row renders at 40% opacity
- Control is non-interactive
- Value does not persist (no save on DEFERRED settings)
- Once implemented, remove DEFERRED status and update helper text

---

## 15.8 PERSISTS_ONLY Setting Example

**Section:** Appearance
**Setting ID:** `appearance.minimap`
**Label:** `Minimap`
**Helper:** `Show a miniature overview of the script on the right edge. Behavior not wired yet.`
**Scope:** Flow
**Control:** Toggle
**Default:** false
**State:** PERSISTS_ONLY

**Row rendering:**
```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  Minimap                             ● Flow     │           [━━━━━●]   │  ← control disabled
│  Show a miniature overview of the script on     │                      │
│  the right edge. Behavior not wired yet.        │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules (S10 canonical — H3A doctrine):**
- Row renders at **full (1.0) opacity** — NO row-level fade
- Control surfaces its own disabled state via the native `disabled` attribute
- `pointer-events: none` on the row's value column only, NOT on the row container
- Helper text is appended with the literal `"Behavior not wired yet."`
- Value remains at default until an Applicator is registered
- Once behavior is wired: remove appended text and register the Applicator — row transitions to REAL

---

## 15.9 Desk Color Setting (Color Control)

**Section:** Appearance
**Setting ID:** `appearance.editorDeskColor`
**Label:** `Desk Color`
**Helper:** `Background color behind the page surface.`
**Scope:** Flow
**Control:** Color
**Options:** Charcoal (#141414), Midnight (#1a1a2e), True Dark (#1c1c1c), Warm (#2d2520)
**Default:** #141414

**Row rendering:**
```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  Desk Color                          ● Flow     │  (●) (○) (○) (○)    │
│  Background color behind the page surface.      │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules:**
- Changing desk color MUST update the editor background immediately
- Only predefined colors are allowed — no free-form picker
- Values are app-scoped

---

## 15.10 Export Branding (Select + Conditional)

**Section:** Print / Export
**Setting ID:** `export.branding`
**Label:** `Branding`
**Helper:** `Controls Rwanga logo placement on exported documents. Pro plan required for custom or no branding.`
**Scope:** Export
**Control:** Select
**Options:** Rwanga Logo, Custom Letterhead (Pro), No Branding (Pro)
**Default:** rwanga
**Status Badge:** Pro Required (on "Custom Letterhead" and "No Branding" options — shown when those options are selected)

**Row rendering:**
```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  Branding                          ● Export     │ [Rwanga Logo    ▾]   │
│  Controls Rwanga logo placement on exported     │                      │
│  documents. Pro plan required for custom or     │                      │
│  no branding.                                   │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

**Engineer rules:**
- When a Pro-only option is selected by a free-tier user, show inline upsell (not a badge — handled by the option label)
- Value is document-scoped
- The "(Pro)" suffix in option labels is the only upsell indicator — no badges, no modals, no blocking

---

*End of RWANGA SETTINGS DESIGN CONSTITUTION v1.0 RC1*
*This document is mandatory. All settings implementation must conform to these rules.*
*Any undefined situation requires design escalation before implementation.*
