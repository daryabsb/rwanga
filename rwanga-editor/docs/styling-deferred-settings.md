# Deferred Settings & Customization Roadmap

Living document. Every item here is **a styling/behavior knob that's hardcoded today** but will become **user-customizable** later. Implementing each requires a Settings UI surface (Preferences dialog, Page Setup dialog, Reference panel, etc.) plus the data plumbing described below.

## Scope model — Defaults → User → Project

Following the VSCode pattern. Every setting has three layers:

```
Default (in code)
   ↓ overridden by
User scope (per-app, in localStorage — applies to every doc the user opens)
   ↓ overridden by
Project / Document scope (in doc.settings — saved with the .rga file; travels with the script)
```

Resolution order at read time: **Project → User → Default**. The first defined value wins.

| Layer | Storage | Identifier | When it wins |
|-------|---------|------------|--------------|
| Default | Source code constants | `DEFAULT_*` | Always fallback. Never edited at runtime. |
| User | `localStorage` keys with `rga-user-*` prefix | `Rga.UserPrefs` (planned) | Applies app-wide, across all documents. |
| Project | `doc.settings.*` in the .rga file | `Rga.Doc.settings` | Applies to one document only. Travels with the file. |

A future `Rga.Preferences` module will provide:
- `Rga.Preferences.get(path, fallback)` — resolves through the three layers.
- `Rga.Preferences.setUser(path, value)` — writes to localStorage.
- `Rga.Preferences.setProject(path, value)` — writes to `doc.settings` and marks the doc dirty.
- `Rga.Preferences.onChange(path, fn)` — listener for live UI updates.

---

## Settings deferred to a future Preferences / Page-Setup dialog

### Page setup

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `pageSetup.paperSize` | `'Letter'` | ✅ | ✅ | `'Letter' \| 'A4' \| 'Legal'`. Already in `doc.settings.pageSetup`. |
| `pageSetup.margins.top` | `1` (inch) | ✅ | ✅ | Inches in storage. Display converts via `Rga.Units`. |
| `pageSetup.margins.right` | `1` | ✅ | ✅ | |
| `pageSetup.margins.bottom` | `1` | ✅ | ✅ | |
| `pageSetup.margins.left` | `1.5` | ✅ | ✅ | Wider for binding. |
| `units` | `'in'` | ✅ | ✅ | `'in' \| 'cm' \| 'mm' \| 'px'`. Already in `doc.settings.units`. UI: status-bar pill (live). |
| `font_family` | `'Courier Prime'` | ✅ | ✅ | Already in `doc.settings.font_family`. |
| `font_size` | `12` (pt) | ✅ | ✅ | Already in `doc.settings.font_size`. |

### Slug line

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `slug.order` | `'setting-time-location'` | ✅ | ✅ | Per user 2026-05-15: time and location are paired; setting separated by major separator. Other orders: `'setting-location-time'`, `'setting-time'` (no location), etc. |
| `slug.majorSeparator` | `' — '` (em-dash) | ✅ | ✅ | Between setting and the time/location pair. Could also be `' - '` or `': '`. |
| `slug.pairSeparator` | `' / '` | ✅ | ✅ | Between time and location. Common alternatives: `' - '`, `'.'`. |
| `slug.identifierColor` | `--accent-rwanga` (`#C2185B`) | ✅ | ✅ | The bottom underline color on the slug line. |
| `slug.case` | `'upper'` | ✅ | ✅ | `'upper' \| 'title' \| 'sentence'`. Industry default upper. |
| `slug.vocabulary.settings` | `['INT.','EXT.','INT./EXT.','EXT./INT.']` | ✅ | ✅ | Already in `doc.settings.vocabulary.settings`. |
| `slug.vocabulary.times` | `['DAY','NIGHT','CONTINUOUS','DUSK','DAWN']` | ✅ | ✅ | Already in `doc.settings.vocabulary.times`. |
| `slug.vocabulary.sceneWord` | `'SCENE'` | ✅ | ✅ | i18n — Kurdish/Arabic users override. Already in `doc.settings.vocabulary.sceneWord`. |
| `slug.headingStyle` | `'twoLine'` | ✅ | ✅ | `'oneLine' \| 'twoLine'`. Whether SCENE-N is above the slug or on the same line. |

### Block typography

The visual treatment of each block type. Industry-standard defaults plus a few rwanga-specific overrides (centered character/dialogue per user 2026-05-15).

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `blocks.action.align` | `'start'` | ✅ | ✅ | `'start' \| 'center' \| 'end'`. |
| `blocks.action.case` | `'sentence'` | ✅ | ✅ | |
| `blocks.character.align` | `'center'` | ✅ | ✅ | User override of industry-2.2in-indent. |
| `blocks.character.case` | `'upper'` | ✅ | ✅ | |
| `blocks.character.colorFromTagRegistry` | `true` | ✅ | ✅ | If true, character block gets the per-character color from `doc.tagRegistry.characters[].color`. |
| `blocks.dialogue.align` | `'center'` | ✅ | ✅ | User override. |
| `blocks.dialogue.sideMargin` | `'1in'` | ✅ | ✅ | Margin on each side of the centered dialogue block. **Custom-value-by-design** per user 2026-05-15. |
| `blocks.parenthetical.align` | `'center'` | ✅ | ✅ | |
| `blocks.parenthetical.sideMargin` | `'1.6in'` | ✅ | ✅ | |
| `blocks.parenthetical.style` | `'italic'` | ✅ | ✅ | |
| `blocks.transition.align` | `'end'` | ✅ | ✅ | Right in LTR, left in RTL (logical). |
| `blocks.transition.case` | `'upper'` | ✅ | ✅ | |
| `blocks.shot.align` | `'start'` | ✅ | ✅ | |
| `blocks.shot.case` | `'upper'` | ✅ | ✅ | |
| `blocks.inlineFreeText.style` | `'italic muted'` | ✅ | ✅ | |
| `blocks.spacing.lineHeight` | `1.15` | ✅ | ✅ | |
| `blocks.spacing.betweenSameType` | `'0.3em'` | ✅ | ✅ | |
| `blocks.spacing.beforeCharacter` | `'1em'` | ✅ | ✅ | |
| `blocks.spacing.beforeTransition` | `'1em'` | ✅ | ✅ | |
| `transition.defaultValue` | `'CUT'` | ✅ | ✅ | What new scenes seed their transition picker with. |
| `transition.vocabulary` | `['CUT','MIX','FADE IN','FADE OUT','DISSOLVE','MATCH CUT','SMASH CUT','JUMP CUT']` | ✅ | ✅ | Editable list. |

### Tab cycle order

The order Tab cycles through inside a scene block. Director-specific preference.

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `cycle.forward` | `['action','character','dialogue','shot']` | ✅ | ✅ | The user's locked order. Other valid orders exist (industry sometimes places parenthetical in the cycle). |
| `cycle.enterNext` | `{action:'action',character:'dialogue',dialogue:'dialogue',shot:'action'}` | ✅ | ✅ | The "Enter creates which type next" table. |

### View modes

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `view.defaultMode` | `'flow'` | ❌ | ✅ | Already in `localStorage 'rga-view-mode'`. App-level only. |
| `view.flow.columnWidth` | `'8.5in'` | ❌ | ✅ | Currently hardcoded in CSS. Could be a slider in Preferences. |
| `view.flow.showLineNumbers` | `true` | ❌ | ✅ | Always-on for now. Future toggle in View menu. |
| `view.flow.showPageMarkers` | `true` | ❌ | ✅ | Same. |
| `view.print.paperBackground` | `--editor-page-bg` | ❌ | ✅ | The page color in Print view. Theme-tied; could override per user. |
| `view.draft.maxWidth` | `'8.5in'` | ❌ | ✅ | Mirrors Flow for now. |
| `view.draft.hideChromeElements` | `[menubar,sidebar,activity,tabs,bottom,inspector,status,resize-handles]` | ❌ | ✅ | What Draft hides. Could be configurable. |

### Theme

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `theme` | `'dark'` | ❌ | ✅ | Already wired via `Rga.Theme`. App-level via `data-theme` attr. |

### Language / direction

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `metadata.language` | `'en'` | ✅ | ❌ | `'en' \| 'ku' \| 'ar'`. Drives LTR/RTL, gutter side, transition alignment. Already in `doc.metadata.language`. |

### Tag registry styling

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `tags.character.color` (per-entity) | one of `[cyan, amber, mint, ...]` | ✅ | ❌ | Per-character color in `doc.tagRegistry.characters[].color`. Already settable; UI Tag Manager exists. |
| `tags.defaultColor.character` | `--tag-character` | ✅ | ✅ | When user adds a new character via auto-tag, the seed color. |
| (same pattern for props, wardrobe, locations, sfx, vfx, vehicles, animals, custom) | per-token | ✅ | ✅ | |

### Revision flags

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `revision.openColor` | `--accent-error` (red) | ✅ | ✅ | Color of open-status revision flag underline. |
| `revision.resolvedColor` | `--accent-success` | ✅ | ✅ | |
| `revision.style` | `'underline'` | ✅ | ✅ | `'underline' \| 'background' \| 'gutter-mark'`. |

### Pagination (V2)

True pagination replaces the current estimated-line-count engine in V2.

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `pagination.engine` | `'estimated'` | ❌ | ❌ | Hardcoded. `'estimated' \| 'true'` in V2. |
| `pagination.linesPerPage` | `55` | ✅ | ✅ | Estimated engine — used to compute page breaks. |
| `pagination.pageNumberFormat` | `'Page {n}'` | ✅ | ✅ | i18n-aware. |
| `pagination.showPageNumberAt` | `'top-right'` | ✅ | ✅ | Position of Page-N label in Flow view. |

### Export

| Key | Default | Project? | User? | Notes |
|-----|---------|----------|-------|-------|
| `export.branding` | `'rwanga'` | ✅ | ✅ | Free tier embeds Rwanga branding on exports. Pro tier overrides. Already in `doc.exportSettings.branding`. |
| `export.letterheadUrl` | `null` | ✅ | ✅ | Already in `doc.exportSettings.letterhead_url`. |
| `export.includeSceneNumbers` | `true` | ✅ | ✅ | |
| `export.includeRevisionMarks` | `false` | ✅ | ✅ | |

---

## UI surfaces planned

- **Preferences dialog** (Ctrl+,) — user-scope. All `User?` ✅ rows above. Tabs: Editor, View, Pagination, Tags, Export, Theme, Language, Shortcuts.
- **Page Setup dialog** (already partially built) — paper, margins, units, vocabulary. Project-scope by default; "Save as default for new scripts" button writes to user-scope too.
- **Reference panel** (right inspector tab) — read-only view of all resolved settings for the current document, useful for debugging "why does this look this way?"
- **Status bar pills** — quick toggles for the most-used settings: theme, language, units, view mode. (Already done for theme/language/units/view.)
- **Tag Manager** (sidebar tab) — per-tag-entity editing of name, color, notes.

---

## Migration notes when implementing

- Every new `doc.settings.*` field needs a backfill in `Rga.Doc.deserialize()` so older .rga files load with sane defaults. Pattern: `if (!settings.<key>) settings.<key> = <default>;`.
- Every CSS-driven setting needs a CSS variable applied to the `:root` or the editor container, plus a JS subscriber that updates that variable when the value changes.
- User-scope settings live under one prefix in localStorage: `rga-user-<key>`. Don't sprinkle keys around.
- Project-scope settings are saved in the .rga file via `Rga.Doc.serialize()` — already automatic since the serializer dumps the full `doc.settings` object.

---

## Open questions (to resolve before implementing each section)

- Should the Preferences dialog be a separate window (Electron) or an in-app overlay? Industry tools do both.
- The Reference panel: read-only view, or live-editable inline?
- When project-scope overrides user-scope, should we visually flag the field in the dialog so the user knows "this is set by the file, not by you globally"? VSCode does this with a small dot indicator.
- For non-screenplay doc-types (novel, theatre — when those land), how much of this list applies? Most of the slug/transition/cycle settings are screenplay-specific.
