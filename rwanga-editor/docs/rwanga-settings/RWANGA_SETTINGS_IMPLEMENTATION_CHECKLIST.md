# RWANGA SETTINGS IMPLEMENTATION CHECKLIST
### Companion to: RWANGA_SETTINGS_DESIGN_CONSTITUTION.md v1.0 RC1
### Use: Before merging any Settings PR, every item must be checked.

---

## How to Use This Checklist

Copy the relevant sections into your PR description. Mark each item ✅ or ❌.
Any ❌ item blocks merge. No exceptions.

---

## CHECKLIST A — New Setting Added

Use when adding a new setting to the schema.

```
### Schema
- [ ] Setting has a unique `id` that follows dot-notation for namespacing (e.g., `editor.fontSize`)
- [ ] Setting belongs to an existing section (no new sections without design approval)
- [ ] Setting has `label` (English, Title Case, human-readable)
- [ ] Setting has `labelKu` (Kurdish, human-readable)
- [ ] Setting has `helper` (one sentence, for writers not engineers)
- [ ] Setting has `scope` (exactly one of: flow, print, export, all)
- [ ] Setting has `ctrl` (exactly one of: toggle, select, number, text, slider, radio, color, shortcut, margin_group, readonly)
- [ ] Setting has `default` value defined
- [ ] Control type matches the selection rules in Constitution Section 5.3
- [ ] If Select: has `options` array with `value` + human-readable `label` for each
- [ ] If Number: has `min`, `max`, and optionally `unit` and `step`
- [ ] If Slider: has `min`, `max`, `step`, and `unit`
- [ ] If Radio: has 2–3 options, each label ≤ 10 characters
- [ ] If Color: has `options` array with predefined swatches (no free picker)

### Visual
- [ ] Label does not contain control-type words (SELECT, TOGGLE, RADIO, NUMBER)
- [ ] Label does not expose internal identifiers (editor.fontSize, autosave_interval)
- [ ] Helper text does not reference APIs, function names, or data models
- [ ] Helper text starts with a verb or noun, not "This setting"
- [ ] Option labels are human-readable (not enum values)
- [ ] Scope badge renders correctly (dot + label, correct color)
- [ ] Row follows the two-column grid layout (label+helper left, control right)
- [ ] No extra visual elements added (no icons on labels, no custom badges)

### Behavior
- [ ] Control is interactive and updates state on change
- [ ] Value persists correctly (app-scoped → user prefs, document-scoped → document metadata)
- [ ] Setting change flows through Settings Store → Applicator → Owner Service (no direct DOM/localStorage writes)
- [ ] Reset button appears when value differs from default
- [ ] Reset button restores the default value
- [ ] If conditionally disabled: row shows at 40% opacity when dependency is unmet
- [ ] If conditionally disabled: row transitions to full opacity when dependency is met

### Testing
- [ ] Playwright render test: row appears in correct section with correct label, helper, badge, control
- [ ] Playwright interaction test: control accepts input and updates state
- [ ] Playwright persistence test: value survives settings reload
- [ ] Playwright reset test: reset button restores default
- [ ] Playwright scope test: writes to correct store (user prefs or document metadata)
```

---

## CHECKLIST B — Setting Behavior Wired

Use when wiring an existing PERSISTS_ONLY or DEFERRED setting to real behavior.

```
### Status Change
- [ ] If was DEFERRED: setting is now fully interactive (row at 100% opacity)
- [ ] If was DEFERRED: helper text no longer contains "This feature is coming soon."
- [ ] If was PERSISTS_ONLY: setting is now fully active (row at 100% opacity)
- [ ] If was PERSISTS_ONLY: helper text no longer contains "Behavior not wired yet."
- [ ] If was PERSISTS_ONLY: Applicator is now registered in Settings Store
- [ ] Control now affects the application/document as described in the helper text

### Behavior Verification
- [ ] Changing the setting produces the described effect immediately (or after restart, if Restart Required)
- [ ] If Restart Required: status badge "Restart Required" is added
- [ ] Effect is reversible (changing back undoes the change)
- [ ] Default value produces the historically expected behavior (no regression)

### Testing
- [ ] Playwright behavior test: changing the setting produces the described effect
- [ ] Playwright revert test: reverting the setting undoes the effect
- [ ] If Restart Required: test confirms change takes effect after restart
```

---

## CHECKLIST C — Visual Audit

Use for periodic visual audits of the Settings UI, or before a release.

```
### Shell
- [ ] Tab bar shows "⚙ Settings" with correct icon
- [ ] Modified count badge appears when settings are changed
- [ ] Nav panel is 220px wide with correct background (--bg-secondary)
- [ ] Nav has search input with "Search settings..." placeholder
- [ ] Nav shows all 9 sections in correct order (General through Advanced)
- [ ] Each nav item has icon + label + count badge
- [ ] Active nav item has blue left border and --bg-active background
- [ ] Bottom of nav has Reset All + Save buttons
- [ ] Status bar shows "Settings" and modified count

### Rows
- [ ] Every row follows the two-column grid (1fr auto)
- [ ] Every row has label, helper text, scope badge, and control
- [ ] No rows have more than one control
- [ ] No rows have more than 2 badges (1 scope + 1 status maximum)
- [ ] Labels are Title Case and human-readable
- [ ] Helper text is one sentence per setting
- [ ] Scope badges use correct colors (Flow=gold, Print=blue, Export=teal, All=grey)
- [ ] Reset buttons only appear on modified settings
- [ ] Row separators are 1px solid --border-secondary

### Controls
- [ ] Toggles: 36×20px track, 16×16px thumb, correct colors
- [ ] Radios: horizontal button group, active option uses --accent-primary
- [ ] Selects: custom-styled with chevron, 160–240px width
- [ ] Numbers: ± buttons + centered input + unit label
- [ ] Sliders: 4px track, 14px thumb, value label right-aligned
- [ ] Text inputs: 200–280px width, placeholder text in --text-tertiary
- [ ] Color swatches: 24px circles, active has --text-primary border
- [ ] Shortcuts: key caps with correct styling
- [ ] Margin group: 2×2 grid in bordered container

### Disabled States
- [ ] DEFERRED settings render at 40% opacity with "coming soon" helper text
- [ ] PERSISTS_ONLY settings render at 60% opacity with "Behavior not wired yet." helper text
- [ ] PERSISTS_ONLY controls are non-interactive (pointer-events: none)
- [ ] Conditionally disabled settings render at 40% opacity
- [ ] All disabled controls have pointer-events: none
- [ ] No disabled rows show lock icons, strikethrough, or special badges

### Density
- [ ] Comfortable mode: 14px row padding, 24px 32px content padding
- [ ] Compact mode: 10px row padding, 16px 24px content padding
- [ ] Switching density updates all spacing consistently

### Themes
- [ ] Dark theme: all tokens resolve correctly
- [ ] Light theme: all tokens resolve correctly, all text meets contrast requirements
- [ ] Theme switch updates Settings UI immediately

### Responsive
- [ ] ≥1200px: full layout with nav + content + optional JSON panel
- [ ] 992–1199px: nav + content, no JSON panel
- [ ] 768–991px: narrower nav (180px), no preview panel
- [ ] 600–767px: horizontal section tabs replace nav
- [ ] <600px: dropdown section selector, stacked row layout, 44px touch targets
```

---

## CHECKLIST D — Search Functionality

```
- [ ] Search input is in the nav panel
- [ ] Typing filters settings across all sections in real-time
- [ ] Results count shows above content: "N results for 'query'"
- [ ] Clearing search returns to the previously active section
- [ ] Search matches label text (case-insensitive)
- [ ] Search matches helper text (case-insensitive)
- [ ] Search matches setting ID (case-insensitive)
- [ ] Search matches scope badge label (case-insensitive)
- [ ] Empty results show "No settings match your search." centered
- [ ] Escape key clears search
- [ ] Ctrl+F / Cmd+F focuses search input
```

---

## CHECKLIST E — Accessibility

```
### Keyboard
- [ ] Tab moves through search → nav → content controls → action buttons
- [ ] Shift+Tab reverses
- [ ] Enter/Space activates buttons and toggles
- [ ] Arrow keys navigate radio options and adjust sliders/numbers
- [ ] Escape clears search / exits rebind mode
- [ ] All interactive elements are reachable by keyboard alone

### ARIA
- [ ] Toggles have role="switch" and aria-checked
- [ ] Radio groups have role="radiogroup" with aria-checked on options
- [ ] Number inputs have aria-valuemin, aria-valuemax, aria-valuenow
- [ ] Search container has role="search"
- [ ] Nav element has aria-label="Settings sections"
- [ ] Scope badges have descriptive title attributes
- [ ] Disabled rows have aria-disabled="true"

### Contrast
- [ ] All text meets WCAG 2.1 AA (4.5:1 normal, 3:1 large)
- [ ] All interactive controls have 3:1 contrast against background
- [ ] Focus indicators are visible (1px solid --accent-primary)
- [ ] Verified in both dark and light themes

### Screen Reader
- [ ] Setting value changes are announced (aria-live or native semantics)
- [ ] Search result count is announced (aria-live="polite")
- [ ] Section navigation announces the new section title

### Motion
- [ ] prefers-reduced-motion: reduce disables all transitions
```

---

## CHECKLIST F — Forbidden Patterns

Use as a final gate. If any item is ✅, the PR is blocked.

```
### These must all be ❌ (NOT present):
- [ ] Custom control types not in the constitution
- [ ] Custom badge types not in the constitution
- [ ] Row layouts that differ from the standard two-column grid
- [ ] Spacing values that differ from Section 12
- [ ] Shadows not listed in Section 12.6
- [ ] Animations not listed in Section 12.7
- [ ] Internal identifiers visible in the UI (setting IDs, enum values)
- [ ] Control-type words visible in labels (SELECT, TOGGLE, RADIO)
- [ ] Lock icons on disabled settings
- [ ] "Coming soon" badges (should be helper text only)
- [ ] Collapsible sections within Settings
- [ ] Nested subsections
- [ ] Emoji in labels or badges
- [ ] Developer-facing JSON visible to users in production
- [ ] JsonPreviewPanel, TweaksPanel, or density controls visible in production build
- [ ] Direct localStorage writes for configuration values (must go through Settings Store)
- [ ] Direct DOM mutations for configuration state (must go through Applicator → Owner Service)
- [ ] Links between settings sections
- [ ] Inline help modals or popovers
- [ ] Multiple controls in a single row
- [ ] Settings hidden at any breakpoint
```

---

*End of RWANGA SETTINGS IMPLEMENTATION CHECKLIST v1.0 RC1*
