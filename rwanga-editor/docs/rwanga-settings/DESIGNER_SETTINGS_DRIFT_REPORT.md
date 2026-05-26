# DESIGNER SETTINGS DRIFT REPORT
### Forensic Investigation — May 2026
### Author: Designer (creator of Settings prototype & constitution)
### Status: INVESTIGATION ONLY — No code changes. No redesign.

---

## Executive Verdict

**My prototype was not used as the build target. The implementation is a parallel renderer.**

I delivered 1,894 lines of executable React source across 7 JSX files plus a full design constitution (1,457 lines), a component library (870 lines), an engineer skill sheet (343 lines), and a PR checklist (244 lines). Together these files define every pixel of the Settings UI — shell, nav, rows, controls, badges, disabled states, page preview, density, responsive breakpoints.

The engineering team copied these files into `docs/rwanga-settings/` in the repo. They then built `renderer/js/shell/workspaces/settings-workspace.js` — a 1,071-line imperative DOM renderer that re-derives a Settings UI from registry data. **None of my JSX components were ported or referenced as acceptance criteria.** The two implementations agree on control types and registry shape. They diverge on everything that makes Settings feel like Rwanga.

The H8 forensic report (written by engineering) confirms this independently and reaches the same conclusion. My investigation below adds the **designer's perspective** — what was intended, what was lost, and what the user actually experiences.

**Bottom line:** The Settings surface works mechanically in narrow places. It does not look, feel, or behave like the product I designed. The user's complaint is justified.

---

## 1. Was the Prototype Meant as Source/Acceptance Material?

**YES. Unambiguously.**

The prototype files are not sketches. They are:

| File | Lines | Purpose |
|---|---|---|
| `settings-app.jsx` | 333 | Root composition — shell, tab bar, content area, status bar, doctrine banner, section rendering, tweaks integration |
| `settings-controls.jsx` | 317 | Every control component (Toggle, Select, Number, Text, Slider, Radio, Color, Shortcut, MarginGroup) + ScopeBadge + SettingRow |
| `settings-nav.jsx` | 167 | Left nav with header, search, icons, count badges, active state, Reset All + Save buttons |
| `settings-page-setup.jsx` | 129 | Live page preview (responds to margins, paper size, orientation, headers/footers) |
| `settings-json.jsx` | 80 | Dev-only JSON preview panel |
| `settings-data.jsx` | 238 | Complete schema with Kurdish labels (`labelKu`), all 62 settings |
| `tweaks-panel.jsx` | 530 | Density toggle, theme, dev controls |

These files render a fully interactive Settings UI when loaded in a browser. They are the **visual contract**. The constitution references them. The component library documents their exact specifications. The engineer skill sheet maps them to implementation files.

The design handoff was not "here's a picture, go build something like it." It was "here is the executable source. Port it. Match it. Test against it."

**It was ignored.**

---

## 2. Design Drift List

Each drift is classified by type:

- **VISUAL** — looks wrong
- **STRUCTURAL** — built wrong (architecture/composition)
- **OWNERSHIP** — wrong system controls the value
- **UX TRUST** — damages user confidence in the product

### BLOCKER Drifts

| # | Drift | Design Rule | Current Implementation | Type | Severity | Responsible File |
|---|---|---|---|---|---|---|
| D1 | **Scope badges absent** | RC1 §7.1 — every row MUST show exactly one scope badge (Flow/Print/Export/All) with colored dot + label | No scope badges anywhere. Zero hits for scope-badge rendering in `settings-workspace.js` | VISUAL + UX TRUST | BLOCKER | `settings-workspace.js` `_buildRow()` |
| D2 | **Per-row reset button absent** | RC1 §4.1 — ↺ glyph appears when value ≠ default, opacity transition | No reset button code. Zero hits for `reset`, `↺`, or `isModified` in workspace | VISUAL + UX TRUST | BLOCKER | `settings-workspace.js` `_buildRow()` |
| D3 | **Page Setup is a two-track architecture** | RC1 §1A.2 — all changes go through Settings Store | `page-setup-dialog.js` writes `doc.settings.pageSetup` directly. `layout-profile.js` reads only from doc. Settings Store writes CSS vars no consumer reads. Two writers, two readers, zero merge rule | OWNERSHIP | BLOCKER | `page-setup-dialog.js`, `settings-store.js`, `layout-profile.js` |
| D4 | **Document-scope settings stored in user tier** | RC1 §10.3 — Document prefs MUST write to document metadata | `pageSetup.*`, `screenplay.*`, `export.*` all route to user-tier prefs via `Store.set` defaulting to `tier: 'user'` | OWNERSHIP | BLOCKER | `settings-store.js`, `settings-workspace.js` `_wireControl()` |
| D5 | **Tests pass while product is wrong** | Tests should prove user-visible behavior | H5 never measures visible zoom. H6 never presses the rebound key. H7 margins write orphan CSS vars. All verify wire path only | UX TRUST | BLOCKER | `tests/e2e/settings/*.spec.js` |

### MAJOR Drifts

| # | Drift | Design Rule | Current Implementation | Type | Severity | Responsible File |
|---|---|---|---|---|---|---|
| D6 | **Toggle is native checkbox, not custom track** | RC1 §5.2.1 — 36×20 track, 16×16 thumb, accent-primary when on | Native `<input type="checkbox">` at 16×16 with accent-color | VISUAL | MAJOR | `settings-workspace.js` `_makeToggle()`, `settings-workspace.css` |
| D7 | **Radio is native radio buttons, not segmented control** | RC1 §5.2.2 — horizontal button group with shared border, active=accent-primary bg | Native `<input type="radio">` + label in flex row | VISUAL | MAJOR | `settings-workspace.js` `_makeRadio()`, `settings-workspace.css` |
| D8 | **Number input lacks ±  buttons** | RC1 §5.2.4 — decrement/increment buttons flanking a 56px centered input | Plain `<input type="number">` at 100px, no buttons | VISUAL | MAJOR | `settings-workspace.js` `_makeNumber()`, `settings-workspace.css` |
| D9 | **Nav has no header** | RC1 §3.3 — gear icon (20×20) + "Settings" title at font-size-lg, weight 600 | Nav opens directly with section buttons, no header | STRUCTURAL | MAJOR | `settings-workspace.js` `_buildSkeleton()` |
| D10 | **Nav items have no icons or count badges** | RC1 §3.3 — icon (18×18) + label + settings count badge per item | Label-only buttons | VISUAL | MAJOR | `settings-workspace.js` `_buildSkeleton()` |
| D11 | **Nav has no footer (Reset All + Save)** | RC1 §3.3 — bottom section with Reset All (ghost) + Save (primary) buttons | Absent entirely | STRUCTURAL + UX TRUST | MAJOR | `settings-workspace.js` `_buildSkeleton()` |
| D12 | **Page Setup live preview absent** | RC1 §3.4 — 240px right panel with miniature page responding to margins/paper/orientation | No `PageSetupPreview` component. No side panel | STRUCTURAL | MAJOR | `settings-workspace.js` |
| D13 | **Status bar absent** | RC1 §3.6 — 24px bar showing "Settings" + modified count + "Rwanga Script Editor" | Inherits editor's status bar instead of Settings-specific bar | STRUCTURAL | MAJOR | `settings-workspace.js` |
| D14 | **Tab shows no ⚙ icon or modified count** | RC1 §3.2 — "⚙ Settings" + "•3" pill badge when modified | Plain "Settings" text label only | VISUAL + UX TRUST | MAJOR | `settings-workspace.js` workspace registration |
| D15 | **Row uses flex layout, not CSS Grid** | RC1 §4.1 — `grid-template-columns: 1fr auto`, gap 8px | `article` with flex children, card-style with background + border + radius | STRUCTURAL | MAJOR | `settings-workspace.css` `.rga-settings-row` |
| D16 | **Rows styled as cards, not flat separators** | RC1 §4.2 — 1px solid `--border-secondary` bottom border, no background, no radius | Each row has `background`, `1px solid --border-subtle` border, `4px` radius — reads as a card grid, not a clean settings list | VISUAL | MAJOR | `settings-workspace.css` |
| D17 | **Content area has no max-width** | RC1 §3.4 — max content width 680px | No max-width set, rows stretch full width | VISUAL | MAJOR | `settings-workspace.css` |
| D18 | **Section title is 22px, should be 16px** | RC1 §12.2 — section title at `--font-size-lg` (16px), weight 600 | Implementation uses 22px | VISUAL | MAJOR | `settings-workspace.css` `.rga-settings-content-title` |
| D19 | **Helper text is 12px, should be 11px** | RC1 §12.2 — helper at `--font-size-sm` (11px) | Implementation uses 12px | VISUAL | MINOR | `settings-workspace.css` `.rga-settings-row-description` |
| D20 | **Label weight is 600, should be 500** | RC1 §12.2 — label weight 500 | Implementation uses 600 | VISUAL | MINOR | `settings-workspace.css` `.rga-settings-row-label` |
| D21 | **Kurdish labels (`labelKu`) absent from registry** | RC1 §6.5 — every label MUST have `labelKu` | `settings-registry.js` has no `labelKu` field, `REQUIRED_FIELDS` list doesn't include it | STRUCTURAL | MAJOR | `settings-registry.js` |
| D22 | **Conditional disabled state not enforced** | RC1 §8.1.3 — 40% opacity when dependency unmet, transition on satisfy | `entry.dependencies` declared but never read at render time | STRUCTURAL | MAJOR | `settings-workspace.js` `_buildRow()` |
| D23 | **Document-scope section descriptions missing "for this document"** | RC1 §10.2 — Screenplay, Page Setup, Print/Export descriptions MUST include "for this document" or "for the current script" | Generic descriptions only | UX TRUST | MAJOR | `settings-layout.js` |
| D24 | **No responsive breakpoints** | RC1 §11 — 5 breakpoints from tablet to large desktop, nav collapse at 768px, stacked at 600px | Single fixed layout, no media queries | STRUCTURAL | MAJOR | `settings-workspace.css` |
| D25 | **5 parallel persistence paths bypass Store** | RC1 §1A.3 — all config through Store | `units.js`, `view-mode.js`, `script-language.js`, `workspace-state.js`, `app-shell.js` all write localStorage directly | OWNERSHIP | MAJOR | Multiple files |
| D26 | **No density toggle** | RC1 §12.3 — comfortable/compact modes | Single density only, no toggle | VISUAL | MAJOR | `settings-workspace.js` |

### MINOR Drifts

| # | Drift | Type | Note |
|---|---|---|---|
| D27 | Search placeholder says "Search settings" not "Search settings..." | VISUAL | Missing ellipsis |
| D28 | Nav width is 240px, should be 220px | VISUAL | Off by 20px |
| D29 | Content padding is `0 40px 32px`, should be `24px 32px` | VISUAL | Different vertical structure |
| D30 | Nav active state uses `--surface-selected`, not `--bg-active` | VISUAL | Token mismatch |
| D31 | Row separator uses `--border-subtle`, not `--border-secondary` | VISUAL | Token mismatch |
| D32 | Select padding is `6px 10px`, should be `5px 28px 5px 8px` | VISUAL | No custom chevron |

---

## 3. Prototype vs Implementation Map

| Prototype Component | File | Lines | Implemented? | How? | Faithful? |
|---|---|---|---|---|---|
| `SettingsApp` (root) | `settings-app.jsx` | 333 | Partially | Rewritten as `_buildSkeleton()` in `settings-workspace.js` | ❌ Missing: tab bar chrome, doctrine banner, status bar, page preview panel, density, modified count |
| `SettingsNav` | `settings-nav.jsx` | 167 | Partially | Rewritten as nav buttons in `_buildSkeleton()` | ❌ Missing: header, icons, count badges, Reset All, Save, search placement |
| `SettingRow` | `settings-controls.jsx` | ~60 | Partially | Rewritten as `_buildRow()` | ❌ Missing: CSS Grid layout, scope badge, reset button |
| `ScopeBadge` | `settings-controls.jsx` | 20 | **NO** | Not implemented at all | ❌ |
| `ToggleControl` | `settings-controls.jsx` | ~20 | Partially | Rewritten as `_makeToggle()` | ❌ Native checkbox, not custom 36×20 track |
| `RadioControl` | `settings-controls.jsx` | ~25 | Partially | Rewritten as `_makeRadio()` | ❌ Native radio buttons, not segmented control |
| `NumberControl` | `settings-controls.jsx` | ~25 | Partially | Rewritten as `_makeNumber()` | ❌ Plain number input, no ± buttons |
| `SelectControl` | `settings-controls.jsx` | ~20 | YES | Rewritten as `_makeSelect()` | ⚠ Close but padding/sizing differs |
| `TextControl` | `settings-controls.jsx` | ~15 | YES | Rewritten as `_makeText()` | ⚠ Close but sizing differs |
| `SliderControl` | `settings-controls.jsx` | ~20 | YES | `_makeSlider()` added in H5 | ✅ Matches spec |
| `ColorControl` | `settings-controls.jsx` | ~20 | YES | `_makeColor()` added in H7 | ✅ Matches spec |
| `ShortcutControl` | `settings-controls.jsx` | ~30 | YES | `_makeShortcut()` added in H6 | ✅ Matches spec |
| `MarginGroupControl` | `settings-controls.jsx` | ~30 | YES | `_makeMargins()` added in H7 | ✅ Matches spec |
| `PageSetupPreview` | `settings-page-setup.jsx` | 129 | **NO** | Not implemented at all | ❌ |
| `JsonPreviewPanel` | `settings-json.jsx` | 80 | **NO** | Not implemented (correctly — dev-only) | ✅ Correct omission |
| `SettingsSection` | `settings-app.jsx` | ~30 | Partially | Inline in `_renderForState()` | ⚠ Functional but missing section-bottom-margin tokens |
| Schema with `labelKu` | `settings-data.jsx` | 238 | Partially | `settings-registry.js` covers ids but no Kurdish labels | ❌ |
| Design tokens (CSS) | `Settings UI.html` | ~80 | Partially | `settings-workspace.css` defines some but deviates on sizes, weights, paddings | ⚠ Inconsistent |

**Summary: 4 components correctly implemented (Slider, Color, Shortcut, Margins — all added in H5-H7). 2 correctly omitted (JSON panel, Tweaks). 12 either missing or unfaithfully rebuilt.**

---

## 4. Missing Mandatory UI Pieces

These elements exist in my prototype and are required by the constitution. They are **completely absent** from the implementation:

1. **Scope badges** — the single most important visual signal telling users which surface a setting affects (Flow View, Print, Export, All). Without them, every row looks identical in significance.

2. **Per-row reset buttons (↺)** — the user has NO way to restore a single setting to its default. The only way to undo is to know the default value and manually type it back.

3. **Nav header** — the ⚙ gear icon + "Settings" title that anchors the left panel and tells the user where they are.

4. **Nav icons** — 18×18 icons per section that provide visual wayfinding. Without them the nav is a wall of text.

5. **Nav count badges** — tell the user how many settings are in each section before they click.

6. **Nav footer (Reset All + Save)** — the user has NO explicit Save action and NO global reset. Changes are implicit, which breaks the trust model.

7. **Page Setup live preview** — the 240px side panel that shows a miniature page responding to margin/paper changes in real-time. This is the single most important UX element for Page Setup — it makes abstract numbers tangible.

8. **Settings status bar** — "Settings • 3 modified" tells the user they have unsaved changes. Without it, modification state is invisible.

9. **Tab modified-count badge** — "⚙ Settings •3" on the tab itself, visible even when the user is in another tab.

10. **Doctrine banner** — the brief contextual message at the top of the General section explaining the three-scope model (Flow/Print/Export).

---

## 5. Wrongly Implemented UI Pieces

These elements exist in both prototype and implementation but are built incorrectly:

1. **Toggle control** — Should be a custom 36×20px track with a sliding 16×16px thumb. Instead it's a native checkbox. This is the most-used control type in Settings and it reads as "unfinished browser form" instead of "professional IDE settings."

2. **Radio control** — Should be a segmented button group (like macOS or VS Code) where the active option has `--accent-primary` background. Instead it's native radio inputs with labels. This makes Dark/Light/System theme selection look like a survey question.

3. **Number control** — Should have explicit − and + increment buttons flanking a centered 56px input with a unit label. Instead it's a bare `<input type="number">` at 100px with no visual structure.

4. **Row layout** — Should be `grid-template-columns: 1fr auto` with flat `1px solid --border-secondary` separators. Instead each row is a card with background color, full border, and 4px border-radius. This turns the settings list into a card grid, which fights the "calm, paper-like" feel mandated in §1.2.

5. **Row label weight** — Should be 500 (medium). Is 600 (semibold). Tiny but cumulative — every label screams slightly louder than intended.

6. **Section title size** — Should be 16px. Is 22px. The section headers dominate the content area instead of quietly introducing it.

7. **PERSISTS_ONLY visual treatment** — RC1 says 60% opacity. H3A pivot says full opacity. The constitution was never updated. The two are in direct conflict and the test suite enforces the H3A pivot, not the constitution.

---

## 6. Frozen Settings UX Verdict

### The numbers

| Section | Total | Working | Frozen | % Frozen |
|---|---|---|---|---|
| General | 6 | 2 | 4 | 67% |
| Editor | 8 | 5 | 3 | 38% |
| Screenplay | 7 | 0 | 7 | **100%** |
| Page Setup | 7 | 1* | 6 | 86% |
| Print / Export | 7 | 0 | 7 | **100%** |
| Autosave & Files | 5 | 0 | 5 | **100%** |
| Appearance | 7 | 3 | 4 | 57% |
| Keyboard Shortcuts | 10 | 10† | 0 | 0% |
| Advanced | 4 | 0 | 4 | **100%** |
| **TOTAL** | **62** | **21** | **41** | **66%** |

*\* Page Setup margins has an applicator but it writes orphan CSS variables — effectively non-functional.*
*† Keyboard Shortcuts has applicators but 7/10 target commands that don't exist yet — bindings installed but inert.*

### What the user experiences

A user opens Settings and browses through sections. In **four entire sections** (Screenplay, Print/Export, Autosave, Advanced), every single control is greyed out with "Behavior not wired yet." appended to the helper text. In two more sections (General, Page Setup), the majority of controls are frozen.

The phrase **"Behavior not wired yet."** appears **41 times** in the Settings UI.

### Does this damage trust?

**Yes, severely.** The current state reads as a half-finished demo, not a shipping product. The user sees:

- A frozen checkbox next to "Spellcheck" — a basic feature
- "Behavior not wired yet." next to "Autosave" — a critical feature
- An entire Screenplay section with zero working controls — for a screenplay editor
- "Page Setup" where changing margins does nothing visible

The H3A decision to keep frozen rows at full opacity was correct in isolation (60% opacity looked muddy). But at **66% saturation**, full-opacity disabled controls with tiny helper text are worse — they look like bugs, not roadmap items.

### My recommendation

**Option A (preferred): Aggressively reduce PERSISTS_ONLY count.** Wire the easy ones (spellcheck, word wrap, autocomplete, line numbers, show page shadow, autosave.enabled) — these are boolean toggles with straightforward behavior. Get frozen count below 30% before the next user test.

**Option B: Group frozen settings behind a "Show upcoming features" toggle** at the bottom of each section. Default: hidden. This requires a constitution amendment (new UI pattern not in RC1), but it's better than 41 instances of "not wired yet."

**Option C (least preferred): Reinstate 60% opacity** per RC1 §8.1.2 to at least visually separate working from non-working. Combined with reducing the frozen count, this becomes acceptable.

**What must NOT happen:** Leaving 66% of Settings frozen with no visual or structural treatment. That is the current state and it is not shippable.

---

## 7. Page Setup Design Ownership Verdict

### What should Page Setup control?

Page Setup is the **document-level page geometry surface**. It controls:

- Paper size (Letter, A4, etc.)
- Orientation (Portrait/Landscape)
- Margins (top, right, bottom, left)
- Page numbers (on/off, position)
- Header text
- Footer text

These are all **document-scoped** settings per RC1 §10.1. Different scripts can have different page setups.

### Should Page Setup live inside Settings, Print Preview, or both?

**Settings is the canonical surface.** Page Setup is Section 4 of 9 in the Settings navigation. It is where the user configures page geometry.

**Print Preview may show a read-only summary** or a quick-edit shortcut, but it must not be an independent writer. Print Preview *consumes* page truth — it does not *define* it.

**The legacy `page-setup-dialog.js` (Ctrl+Shift+G) must be retired** or rewired to write through Settings Store. Today it is a completely independent writer that bypasses the Store, writes directly to `doc.settings.pageSetup`, and is the ONLY path that actually affects page geometry. The Settings UI's Page Setup section is theatrical — it writes values that nothing reads.

### Should Page Setup have a live page preview?

**YES.** This was explicitly designed in my prototype:

- `settings-page-setup.jsx` (129 lines) renders a miniature page
- It responds live to margin, paper size, orientation, header/footer, and page number changes
- It shows margin annotations and faux text lines
- It shows the dimension label ("US Letter · Portrait / 8.5" × 11"")
- It appears as a 240px panel to the right of the settings rows when the Page Setup section is active

This is **the most important missing piece** for Page Setup usability. Without it, margin numbers are abstract. With it, the user sees their page change shape as they adjust values.

### Which source owns page truth?

**Settings Store, `tier: 'script'`** is the designed owner. Per RC1 §10.3:

- Document preferences MUST read from and write to document metadata
- `pageSetup.*` entries in the registry declare `persistsTo: 'script'`

Currently, page truth is owned by `doc.settings.pageSetup` (written by `page-setup-dialog.js`) and read by `layout-profile.js`. The Settings Store writes a parallel value to user-tier prefs that nothing reads. **This is the exact same two-track problem the team already paid to fix for Theme (H2B).**

### What is the correct user flow?

```
User opens Settings → navigates to Page Setup →
  sees current values from active document →
  adjusts margins (live preview updates) →
  adjusts paper size (live preview updates) →
  clicks Save (or values auto-persist to document metadata) →
  returns to editor → page geometry has updated
```

The flow MUST NOT involve:
- A separate modal dialog (legacy `page-setup-dialog.js`)
- Writing to user-tier prefs (current Store behavior)
- CSS variables that no consumer reads (current applicator)
- Two independent paths that don't merge

---

## 8. Drift Root Causes (Designer's Perspective)

### 1. My prototype was treated as documentation, not source

This is the root of everything. The 7 JSX files are not wireframes or sketches. They are executable components that render the exact UI I specified. They should have been:
- Ported into the renderer (adapted from React to vanilla DOM if needed)
- Used as visual acceptance criteria in tests (screenshot comparison)
- Referenced line-by-line during implementation

Instead they sit in `docs/` untouched while `settings-workspace.js` reimplements the same surface from scratch, losing 12 of 18 components in translation.

### 2. The shell was built before the controls, then never reconciled

The engineering slices went: skeleton (5A) → read-only rows (5B) → editable controls (5C) → label cleanup (H3/H4) → slider (H5) → shortcuts (H6) → margins+color (H7). Each slice added one feature to the existing shell without ever auditing the shell against my prototype. The result: H5/H6/H7 controls are faithful (they were built per the component library), but the shell they sit inside is wrong.

### 3. No visual test baseline from the prototype

There is no test that renders my prototype and compares it against the implementation. The test suite verifies wire paths (Store.set called, CSS var set, KR.register fired) but never asks "does this look like the designer intended?" Screenshot diff against the prototype HTML would have caught every drift in Section 2 on the first PR.

### 4. The H3A pivot was never reconciled with the constitution

I specified 60% opacity for PERSISTS_ONLY rows in RC1 §8.1.2. The H3A correction changed this to full opacity at the interaction layer only. This was a reasonable UX correction — but the constitution was never updated. Now the test suite enforces H3A while the constitution says 60%. Engineers can't know which to follow. **Constitutional pivots must amend the constitution.**

---

## 9. Recommended Next Slices (Surgical Only)

No mega rewrite. Each slice is independently shippable and testable.

### Slice S1 — Scope Badges (BLOCKER FIX)
**Add `ScopeBadge` component to `_buildRow()`.** Port directly from `settings-controls.jsx:7-27`. 20 lines of code. Renders the colored dot + label per `SCOPE_META` lookup. Test: every row has exactly one scope badge matching its registry `scope`.

*Estimate: 1 hour. Zero risk.*

### Slice S2 — Per-Row Reset Button (BLOCKER FIX)
**Add reset button (↺) to `_buildRow()`.** Compare current value to default; show button when they differ. On click, `Store.set(id, default)`. Test: button appears on modified rows, disappears on reset.

*Estimate: 2 hours. Zero risk.*

### Slice S3 — Toggle, Radio, Number Control Fidelity
**Replace native checkbox with custom 36×20 track.** Replace native radio with segmented button group. Add ± buttons to number input. Port from `settings-controls.jsx`. CSS changes only to the control internals — no shell changes.

*Estimate: 4 hours. Low risk.*

### Slice S4 — Row Layout (Grid + Flat Separators)
**Change rows from flex cards to `grid-template-columns: 1fr auto`.** Remove card background, border-radius, and per-row border. Add `1px solid --border-secondary` bottom separator. Match RC1 §4.1.

*Estimate: 2 hours. Low risk (CSS only).*

### Slice S5 — Nav Chrome (Header + Icons + Count + Footer)
**Add nav header** (⚙ + "Settings"), **nav item icons** (18×18), **count badges**, and **footer** (Reset All + Save). Port from `settings-nav.jsx:97-164`.

*Estimate: 4 hours. Low risk.*

### Slice S6 — Content Max-Width + Typography Corrections
**Set `max-width: 680px`** on content area. Fix section title to 16px, helper text to 11px, label weight to 500. Fix padding to `24px 32px`.

*Estimate: 1 hour. CSS only.*

### Slice S7 — Page Setup Store Tier Fix (BLOCKER FIX)
**Auto-route `Store.set` based on `entry.persistsTo`.** When registry says `persistsTo: 'script'`, write to document metadata, not user prefs. Retire or rewire `page-setup-dialog.js` to call `Store.set` with `tier: 'script'`.

*Estimate: 4 hours. Medium risk (touches Store internals).*

### Slice S8 — Page Setup Live Preview
**Port `PageSetupPreview` from `settings-page-setup.jsx`.** Render 240px panel when Page Setup section is active. Wire to current values.

*Estimate: 4 hours. Low risk.*

### Slice S9 — Reduce PERSISTS_ONLY Count
**Wire 10 easy settings:** `editor.spellcheck`, `editor.wordWrap`, `editor.autocomplete`, `editor.showLineNumbers`, `appearance.editorPageShadow`, `autosave.enabled`, `autosave.interval`, `appearance.sidebarPosition`, `appearance.activityBar`, `appearance.formatToolbar`. Each is a boolean toggle or simple value with an obvious DOM/behavior target.

*Estimate: 8 hours. Low risk per setting.*

### Slice S10 — Amend Constitution for H3A
**Update RC1 §8.1.2** to reflect the H3A decision. Document the new rule: PERSISTS_ONLY rows render at full opacity; disabled state is at the control level only. Remove the conflict between constitution and test suite.

*Estimate: 30 minutes. Zero risk.*

---

## 10. What Engineers Must NOT Touch Without Design Approval

| Area | Rule |
|---|---|
| Row layout | Do not change `grid-template-columns`, gap, padding, or separator style without matching RC1 §4.1 |
| Scope badge design | Do not invent new scope types, colors, or badge shapes |
| Control types | Do not add control types not in RC1 §5.1 inventory |
| Section order | Do not reorder, merge, or split sections (RC1 §2.2) |
| Badge types | Do not invent new badge types (RC1 §7.3) |
| Disabled state visuals | Do not change opacity, cursor, or pointer-events rules without resolving the H3A/RC1 conflict first |
| Nav structure | Do not add collapsible sections, nested groups, or accordion patterns |
| Page Setup ownership | Do not add a second Page Setup surface (modal, toolbar, or inline) — fix the existing one |
| Typography tokens | Do not change font sizes, weights, or colors from RC1 §12.2 values |
| Shadows | Do not add shadows beyond the two permitted in RC1 §12.6 (page preview + toggle thumb) |
| Animation | Do not add entrance/exit animations, loading spinners, or scroll effects (RC1 §12.7) |
| Production builds | Do not ship JsonPreviewPanel, TweaksPanel, or density debug controls to production |

---

## 11. Summary

The Settings implementation is mechanically functional in narrow areas (21/62 settings respond to changes). But it is not the product I designed. The shell is wrong. The rows are wrong. The badges are missing. The reset is missing. The page preview is missing. The nav chrome is missing. The tier routing is wrong. The typography is wrong. The layout pattern is wrong.

The good news: the registry, store, applicator, and search systems are architecturally sound. The H5/H6/H7 control implementations (slider, shortcut, margins, color) are faithful to the component library. The foundation is there.

The fix is not a rewrite. It is 10 surgical slices, prioritized by severity, each independently testable. Slices S1-S2 (scope badges + reset buttons) fix the two visual BLOCKERs in under 3 hours. Slice S7 (tier routing) fixes the ownership BLOCKER. The rest bring the shell into alignment with the prototype.

**The prototype exists. It works. It renders. Port it.**

---

*End of DESIGNER SETTINGS DRIFT REPORT*
*Investigation only — no code changes made.*
