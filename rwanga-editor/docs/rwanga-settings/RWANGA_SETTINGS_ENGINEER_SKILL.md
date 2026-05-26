# RWANGA SETTINGS ENGINEER SKILL
### Quick-Reference Sheet for Engineers
### Read time: 5 minutes
### Full reference: RWANGA_SETTINGS_DESIGN_CONSTITUTION.md v1.0 RC1

---

## The One Rule

**You implement behavior. You do not invent visuals.**

If the constitution does not specify how something should look, STOP and request a design update.

**All configuration changes go through Settings Store.**

No direct `localStorage` writes. No direct DOM mutations. No direct `Theme.apply()` calls.

```
UI Action → Settings Store → Applicator → Owner Service → DOM
```

No step may be skipped.

---

## Adding a New Setting — Step by Step

### Step 1: Add to schema in `settings-data.jsx`

Find the correct section in `SETTINGS_SECTIONS`. Add your setting object:

```js
{
  id: 'editor.newSetting',        // dot-notation, namespaced to section
  label: 'Setting Name',          // Title Case, human words, NO "TOGGLE", "SELECT" etc.
  labelKu: 'ناوی ڕێکخستن',        // Kurdish equivalent
  helper: 'One sentence for a screenplay writer, not an engineer.',
  scope: SCOPE.FLOW,              // FLOW | PRINT | EXPORT | ALL — pick exactly one
  ctrl: CTRL.TOGGLE,              // see control selection table below
  default: false                  // required
}
```

### Step 2: Pick the right control

| Your data shape | Control | Extra props needed |
|---|---|---|
| `true` / `false` | `CTRL.TOGGLE` | — |
| One of 2–3 short labels | `CTRL.RADIO` | `options: [{value, label}]` |
| One of 4+ choices | `CTRL.SELECT` | `options: [{value, label}]` |
| Integer or float with bounds | `CTRL.NUMBER` | `min`, `max`, optional `unit`, `step` |
| Range where position matters | `CTRL.SLIDER` | `min`, `max`, `step`, `unit` |
| Free text | `CTRL.TEXT` | optional `placeholder` |
| Color from palette | `CTRL.COLOR` | `options: [{value, label}]` |
| Key binding | `CTRL.SHORTCUT` | — |

That is the complete list. Do not invent others.

### Step 3: Pick the right scope

| Question | Scope |
|---|---|
| Does it affect only the writing surface? | `SCOPE.FLOW` |
| Does it affect printed page geometry? | `SCOPE.PRINT` |
| Does it affect exported files? | `SCOPE.EXPORT` |
| Does it affect everything? | `SCOPE.ALL` |

### Step 4: Pick the right store

| Sections | Storage |
|---|---|
| General, Editor, Appearance, Keyboard Shortcuts, Autosave & Files, Advanced | **User preferences** (app-scoped) |
| Screenplay, Page Setup, Print / Export | **Document metadata** (per-script) |

Never write to both stores from one control.

### Step 5: Write Playwright tests

Every setting needs 5 tests:

1. **Render** — row appears with correct label, helper, badge, control type
2. **Interact** — control accepts input, state updates
3. **Persist** — value survives reload
4. **Reset** — reset button restores default
5. **Scope** — writes to correct store

---

## Setting Labels — Cheat Sheet

### DO

```
Interface Language
Editor Font Size
Bold Scene Headers
Default Export Format
Autosave Interval
Window Zoom
```

### DON'T

```
SELECT language              ← control-type word
editor.fontSize              ← internal identifier
TOGGLE bold headers          ← control-type word
exportFormat                 ← camelCase internal name
Autosave interval (ms)       ← implementation detail (ms)
Click to change zoom level   ← instruction, not label
```

---

## Helper Text — Cheat Sheet

### DO

```
"Font size for the writing surface. Standard screenplay is 12pt."
"How often the script is automatically saved, in seconds."
"Enable browser spellcheck in the editor surface."
```

### DON'T

```
"This setting controls the editor.fontSize property."    ← references code
"Toggles the spellcheck boolean."                        ← implementation language
"Sets the HTMX autosave interval in ms."                 ← exposes tech stack
"This setting..."                                        ← never start with "This setting"
```

---

## Disabled States — Quick Reference

| State | Opacity | Interactive? | Helper text change |
|---|---|---|---|
| **DEFERRED** (not implemented) | 40% | No | Append: `"This feature is coming soon."` |
| **PERSISTS_ONLY** (no Applicator registered) | 60% | No | Append: `"Behavior not wired yet."` |
| **Conditionally disabled** (dependency unmet) | 40% | No | No change |
| **Fully live** | 100% | Yes | No change |

Apply opacity at the ROW level. Never use lock icons, strikethrough, or special badges.

PERSISTS_ONLY means: no Applicator registered → control locked → user cannot interact.

---

## Badges — Quick Reference

### Scope Badges (exactly one per row, always)

| Badge | Color | Meaning |
|---|---|---|
| ● Flow | `#FFC107` (gold) | Affects Flow View writing surface |
| ● Print | `#007acc` (blue) | Affects printed page |
| ● Export | `#4EC9B0` (teal) | Affects exported documents |
| ● All | `#9e9e9e` (grey) | Affects everything |

### Status Badges (zero or one per row, after scope badge)

| Badge | Color | When |
|---|---|---|
| ● Restart Required | `var(--accent-warning)` | Change needs app restart |
| ● Experimental | `var(--accent-error)` | Unstable feature |
| ● Pro | `var(--accent-primary)` | Requires Pro plan |

**Maximum badges per row: 2** (1 scope + 1 status)

Do not invent new badge types.

---

## Row Layout — The Only Layout

```
┌──────────────────────────────────────┬──────────────┐
│  Label                    [● Badge]  │ [Control] [↺] │
│  Helper text                         │               │
└──────────────────────────────────────┴──────────────┘
```

- Grid: `1fr auto`
- Padding: `14px 0` (comfortable) or `10px 0` (compact)
- Border: `1px solid var(--border-secondary)` bottom
- One control per row. No exceptions.

Do not invent alternate layouts.

---

## Section Order — Fixed

1. General
2. Editor
3. Screenplay
4. Page Setup
5. Print / Export
6. Autosave & Files
7. Appearance
8. Keyboard Shortcuts
9. Advanced

Do not reorder. Do not merge. Do not split. New sections require design approval.

---

## Forbidden Actions

You MUST NOT:

| Action | Why |
|---|---|
| Invent new control types | All 10 controls are defined |
| Invent new badge types | All 7 badges are defined |
| Change row layout | One layout exists |
| Change spacing, font sizes, or colors | Tokens are defined |
| Add shadows | Only 2 shadows are permitted (page preview, toggle thumb) |
| Add animations | Only specified transitions are permitted |
| Expose internal identifiers in UI | Labels must be human-readable |
| Add icons to setting labels | Labels are text-only |
| Add inline help links or popovers | Not part of the design |
| Hide settings at any breakpoint | All settings visible always |
| Add collapsible sections | Flat structure only |
| Add emoji | Never in Settings |
| Bypass Settings Store | All config changes go through the Store |
| Write directly to localStorage for config | Must go through Settings Store |
| Write directly to DOM for config state | Must go through Applicator → Owner Service |
| Ship JsonPreviewPanel / TweaksPanel in production | Developer Diagnostic Surface only |

---

## Decision Escalation

If you encounter something not covered:

1. **STOP** the visual aspect
2. File a design request
3. Wait for constitution update
4. Do NOT improvise

This includes:
- Need a new control type
- Need a new badge type
- Need a new section
- Need a new responsive behavior
- Need a new disabled state category
- Any visual decision not in the constitution

---

## File Map

| File | Contains |
|---|---|
| `settings-data.jsx` | Schema: sections, settings, scopes, control types, defaults |
| `settings-controls.jsx` | Row component, all 10 control components, scope badge |
| `settings-nav.jsx` | Left navigation, search, nav items, action buttons |
| `settings-page-setup.jsx` | Page Setup live preview |
| `settings-json.jsx` | JSON preview panel (dev only) |
| `settings-app.jsx` | Root app component, state management, composition |
| `tweaks-panel.jsx` | Tweaks UI (density, theme toggle) |
| `Settings UI.html` | Entry point, tokens, script loading |

---

## Token Quick Reference

### Spacing
| Usage | Value |
|---|---|
| Row padding (comfortable) | `14px 0` |
| Row padding (compact) | `10px 0` |
| Content padding (comfortable) | `24px 32px` |
| Content padding (compact) | `16px 24px` |
| Label → badge gap | `8px` |
| Control → reset gap | `6px` |
| Section bottom margin | `28px` / `20px` |

### Typography
| Element | Size | Weight |
|---|---|---|
| Section title | 16px | 600 |
| Setting label | 13px | 500 |
| Helper text | 11px | 400 |
| Badge | 10px | 600 |
| Control text | 13px | 400 |

### Key Colors
| Token | Dark | Light |
|---|---|---|
| `--bg-primary` | `#1e1e1e` | `#ffffff` |
| `--bg-secondary` | `#252526` | `#f3f3f3` |
| `--text-primary` | `#cccccc` | `#333333` |
| `--text-secondary` | `#9e9e9e` | `#616161` |
| `--accent-primary` | `#007acc` | `#0066bf` |
| `--border-primary` | `#3c3c3c` | `#d4d4d4` |
| `--border-secondary` | `#2b2b2b` | `#e8e8e8` |

---

## Playwright Test Template

```js
test('setting: {id} renders correctly', async ({ page }) => {
  await page.goto('/settings');
  await page.click('[data-section="{sectionId}"]');
  
  const row = page.locator('[data-setting="{settingId}"]');
  
  // 1. Render
  await expect(row.locator('.setting-label')).toHaveText('{label}');
  await expect(row.locator('.scope-badge')).toHaveText('{scope}');
  await expect(row.locator('.setting-helper')).toContainText('{helper fragment}');
  await expect(row.locator('{control selector}')).toBeVisible();
  
  // 2. Interact
  await row.locator('{control selector}').click(); // or .fill(), .selectOption(), etc.
  // assert state changed
  
  // 3. Persist
  await page.reload();
  await page.click('[data-section="{sectionId}"]');
  // assert value survived
  
  // 4. Reset
  await row.locator('.reset-button').click();
  // assert value equals default
  
  // 5. Scope
  // assert correct storage was written
});
```

---

*End of RWANGA SETTINGS ENGINEER SKILL v1.0 RC1*
*Full reference: RWANGA_SETTINGS_DESIGN_CONSTITUTION.md v1.0 RC1*
*Checklist: RWANGA_SETTINGS_IMPLEMENTATION_CHECKLIST.md v1.0 RC1*
*Components: RWANGA_SETTINGS_COMPONENT_LIBRARY.md v1.0 RC1*
