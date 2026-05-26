# Settings Recovery Execution Plan

**Date:** 2026-05-26
**Status:** Plan only. No implementation. No code changes. No CSS changes.
**Baseline HEAD:** `328fb726` (post-H7 + H8 report)

**Inputs:**
- `H8_SETTINGS_FORENSIC_REPORT.md` (engineering)
- `DESIGNER_SETTINGS_DRIFT_REPORT.md` (designer)
- `RWANGA_SETTINGS_DESIGN_CONSTITUTION.md` (RC1)
- `settings-*.jsx` prototype source (1,894 lines, executable)
- Memory: H3A doctrine (user-locked: H3A wins; amend RC1; reduce count)

**Both forensic reports independently reached the same conclusions:** prototype was ignored, parallel renderer exists, Page Setup ownership is broken, frozen saturation damages trust, tests prove wiring not product truth. This plan corrects all five.

---

## Executive Summary

**13 slices in 4 phases, plus 2 staged-retirement sub-slices.**

| Phase | Slice IDs | Theme | Why this order |
|---|---|---|---|
| 0 — Doctrinal clear | S10 | Amend RC1 §8.1.2 (H3A), §3.3 (no Save), §8.1 (operational PERSISTS_ONLY/DEFERRED rule); rename H3A test as the new persists-only-visual-contract regression guard | Removes constitution↔test contradiction, locks state classification rule, locks Save removal decision before any code |
| 1 — Ownership correction | S7 → S12 → S8 | Truth first | Visual fidelity built on incorrect truth would need re-doing |
| 2 — Visual fidelity | S4 → S6 → S1 → S2 → S3 → S5 | Shape next | Visual work lands on stable, correct ownership |
| 3 — Saturation reduction | S9.1 → S9.2 → S9.3 | Expansion | Final layer; safe to wire only once truth + shape are stable |
| 4 — Modal retirement completion | S7B → S7C | Staged retirement tail | After bake-in; not blocking the plan |

**Doctrine:** truth → shape → expansion. Not shape → truth → expansion.

---

## 1. Recovery Order Rationale

### Why truth before shape

Both forensic reports show that:
- `pageSetup.margins` writes orphan CSS variables; nothing reads them. The Settings UI for margins is theatrical.
- `Settings.Store.set` defaults to `tier:'user'` for entries whose registry says `persistsTo:'script'`. Document-scope settings persist per-user.
- Five parallel persistence paths bypass the Store entirely (Theme legacy localStorage, `units`, `view-mode`, `script-language`, `workspace-state`).
- `page-setup-dialog.js` is the only path that affects real page geometry.

If we ship visual fidelity (scope badges, reset buttons, nav chrome) **before** correcting these, every visual gain sits on top of a surface that lies about what it does. Users would see scope badges saying "Print" next to controls that don't affect print. We'd be repainting a billboard on a foundation that needs digging up.

Truth first, then shape. Then expansion (saturation reduction). The visual fidelity work in Phase 2 is cheap (8 hours total estimated) and unblocked once Phase 1 lands. The downside of delaying it by 14 hours of Phase 1 work is small. The downside of building it on broken ownership is significant.

### Why S10 (constitution amendment) comes first

S10 lands three RC1 amendments in one documentation slice:

1. **§8.1.2 ↔ H3A reconciliation.** The H3A doctrine ("PERSISTS_ONLY = full opacity, control-disabled-only") was locked into user memory and into the H3A visual-contract test. Pre-S10, RC1 §8.1.2 still specified "60% opacity" — the two were in direct conflict. S10 (shipped) amended §8.1.2 to canonicalize H3A and **renamed** `visual-contract-h3a.spec.js` → `persists-only-visual-contract.spec.js` (kept, not deleted; broadened scope as a regression guard against row-level opacity drift, helper opacity drift, label-helper hierarchy collapse, and row spacing collapse).
2. **§3.3 Save button removal.** RC1 §3.3 currently mandates "Reset All + Save" in the nav footer. Settings uses immediate-apply; a Save button with no pending state is fake interaction → fake ownership → trust damage. S10 amends §3.3 to specify Reset All only.
3. **§8.1 operational classification rule.** S10 adds the operational PERSISTS_ONLY/DEFERRED rule (≤ next 2 slices → PERSISTS_ONLY; else DEFERRED) so engineers have a checkable answer instead of "engine in progress" debates.

Engineers attempting any visual fidelity slice would otherwise have to choose between contradictory rules. S10 is a one-hour documentation slice with zero implementation risk; it unblocks every subsequent slice's design decisions.

### Why S12 (legacy paths) goes inside the ownership phase

S12 is the engineering-only addition (designer's S1-S10 list omitted it). The five parallel paths are constitutionally identical to the Page Setup two-track problem — same shape of `§1A.3` violation. Cleaning them up while we have the ownership lens active prevents future drift in the same direction. After S12, the drift guard knows about every parallel path; the guard becomes a real wall.

### Why S8 (Page Setup preview) closes Phase 1, not Phase 2

The preview is the **visible proof** that S7's ownership correction worked. If margins write to the document and the preview re-renders, the user sees that the new path is alive. Without the preview, the user has no way to confirm Page Setup actually changes anything. S8 ships immediately after S7 + S12 to make Phase 1 visibly successful.

Note: S8 ships before S4 (the row grid layout). That's intentional. The preview is a **side panel**, not a row. Its layout doesn't depend on the row grid.

### Why S4 leads Phase 2

Scope badges (S1) and reset buttons (S2) render *inside* the row layout. If we ship them on the current `article` + flex layout and then migrate to `grid-template-columns: 1fr auto` in S4, we re-do their CSS twice. S4 first, then S1/S2 land cleanly into the grid slots.

### Why S5 (nav chrome) comes last in Phase 2

The nav has per-section count badges. Counts only become useful when sections have known counts of REAL vs DEFERRED vs PERSISTS_ONLY. After Phase 3 (saturation reduction), the counts mean something. So S5 ships last in the visual phase but its per-section counts get more honest after Phase 3. S5 also drops the Save button per the S10 RC1 §3.3 amendment — the nav footer ships with Reset All only.

### Why Phase 3 (saturation reduction) is last

Wiring 16 entries is the largest time investment (one applicator per setting + one Playwright test per setting). It's also the most parallelizable — each setting is independent. Doing it last means:
- We're not building applicators on top of an in-flux Store (S7 changes Store internals).
- The DEFERRED-state factory + registry `state` field (introduced in S9.2) is built on a stable shell.
- Per-slice progress is measurable: "13 entries wired, X DEFERRED, Y to go".
- The operational PERSISTS_ONLY/DEFERRED rule (locked in S10) gives every entry an unambiguous tag at any moment during Phase 3. At the end of S9.3, **no entry can defensibly carry PERSISTS_ONLY** (no slice ≤ 2 ahead exists), so all non-REAL entries land as DEFERRED. Final saturation: 0% PERSISTS_ONLY, 40% DEFERRED, 60% REAL.

### Why Phase 4 (modal stages 2–3) is a tail, not blocking

The user-mandated staged retirement of `page-setup-dialog.js`:
- **Stage 1 (in S7):** Modal still exists, still bound to Ctrl+Shift+G. Modal internals rewired so every write goes through `Settings.Store.set` with `tier:'script'`. Muscle memory preserved.
- **Stage 2 (S7B):** Ctrl+Shift+G repoints to "open Settings → Page Setup section". Modal still exists but has no entry point. Triggerable via debug API only.
- **Stage 3 (S7C):** Modal deleted, CSS removed, DOM injection removed.

Stages 2 and 3 don't block any other work and give users a chance to surface any UX regressions before the modal is gone for good. Stage 2 ships when Phase 2 visual fidelity is complete (so the Settings UI Page Setup section is a proper successor). Stage 3 ships after a bake period.

---

## 2. Dependency Graph

### Per-slice dependencies

| Slice | Depends on | Blocks | Risk | Estimated time |
|---|---|---|---|---|
| **S10** Amend RC1 §8.1.2 + §3.3 + §8.1 (operational rule) + rename + broaden persists-only-visual-contract test | — | S4, S3 (define disabled state), S5 (Save button removal), S9.2 (operational `state` field) | Zero — documentation + test-file rename + fixture-attr prep | 1 hr |
| **S7** Store auto-route + modal Stage 1 | S10 | S12, S8, S9.x, S7B | Medium — touches Store internals + migrates 2 readers + rewires legacy modal | 6 hours |
| **S12** Legacy paths cleanup | S7 (Store auto-route lets `units`/`script-language` migrate cleanly) | S7B (drift guard must allow Settings-UI-driven Page Setup writes) | Medium — touches 5 files | 6 hours |
| **S8** Page Setup live preview | S7 (LayoutProfile reads Store with correct tier; preview will call LayoutProfile, not Store directly) | S7B (preview must work before muscle-memory binding moves) | Low | 4 hours |
| **S4** Row grid layout | S10 | S1, S2 (they render into row slots) | Low — CSS only | 2 hours |
| **S6** Typography + max-width + content padding | — | S5 (nav typography consistent with content) | Zero — CSS only | 1 hour |
| **S1** Scope badges | S4 | — | Low — port from prototype | 1 hour |
| **S2** Per-row reset button | S4 | — | Low | 2 hours |
| **S3** Toggle/Radio/Number control fidelity | S10 | — | Low — CSS + light DOM port | 4 hours |
| **S5** Nav chrome (header + icons + counts + footer) | S6 | — | Low | 4 hours |
| **S9.1** Wire 10 easy boolean toggles | S7 | S9.2 | Medium — one applicator per setting; impacts many surfaces | 6 hours |
| **S9.2** Wire 6 more + introduce DEFERRED state factory | S9.1 | S9.3 | Low (per setting) + Low (factory) | 6 hours |
| **S9.3** Mark 10 settings as DEFERRED | S9.2 (factory exists) | — | Zero — declarative | 1 hour |
| **S7B** Ctrl+Shift+G repoints to Settings | S8 + Phase 2 complete | S7C | Zero — keybinding swap | 30 min |
| **S7C** Delete modal | S7B + bake period (≥ 1 release cycle, no Settings-UI Page Setup bug reports) | — | Zero — delete legacy file | 30 min |

### Dependency chains (visual)

```
                                          ┌────────────────┐
                                          │   S10 (doctrine)│
                                          └───┬──────┬─────┘
                                              │      │
                          ┌───────────────────┘      └────────────────┐
                          ▼                                            ▼
                ┌──────────────────┐                          ┌──────────────────┐
                │  S7 (Store +     │                          │  S4 (row grid)   │
                │  modal stage 1)  │                          └────┬────┬────────┘
                └──┬───────┬───────┘                               │    │
                   │       │                                       ▼    ▼
                   ▼       ▼                                   ┌──────┐ ┌──────┐
              ┌───────┐ ┌─────┐                                │ S1   │ │ S2   │
              │ S12   │ │ S8  │                                │badges│ │reset │
              │legacy │ │prev │                                └──────┘ └──────┘
              └───┬───┘ └──┬──┘
                  │        │                            ┌──── S6 (typo) ──── S5 (nav)
                  │        │                            │
                  │        └───────► S7B ───► S7C       └──── S3 (controls)
                  │
                  └────────► S9.1 ───► S9.2 ───► S9.3
```

### Risk classification

- **Medium risk:** S7, S12, S9.1 — touch Store internals, multiple files, or many surfaces. Require fidelity tests + ownership tests + drift guard updates.
- **Low risk:** S4, S6, S1, S2, S3, S5, S8, S9.2 — CSS / DOM / single-surface work with clear scope.
- **Zero risk:** S10, S9.3, S7B, S7C — documentation, declarative changes, or single-line keybinding swaps.

### Parallelism rules

- Within Phase 1, slices are strictly sequential (S7 → S12 → S8).
- Within Phase 2, sequential is recommended but S6 and S3 can ship in parallel with the S4 → S1 → S2 chain if reviewer bandwidth allows.
- Phase 3 slices are strictly sequential (S9.2 requires the factory introduced mid-S9.2 to exist before S9.3 can declare anything as DEFERRED).
- S7B and S7C are tail-end; their timing is governed by stop conditions, not dependencies.

---

## 3. Prototype-Port Strategy

For each file in `docs/rwanga-settings/`:

| File | Lines | Strategy | Notes |
|---|---|---|---|
| `settings-app.jsx` | 333 | **ADAPT** | Port composition (shell, tab bar, content area, status bar, doctrine banner, side-by-side Page Setup layout) to vanilla JS to match current renderer architecture. React state → module-local state. Lands across S4, S5, S6, S8. |
| `settings-controls.jsx` | 317 | **PORT (selective)** | `Slider`/`Color`/`Shortcut`/`MarginGroup` already faithfully ported (H5/H6/H7) — no work. `Toggle`/`Radio`/`Number` need full port (S3). `ScopeBadge` is new port (S1). `SettingRow` reset button is new port (S2). |
| `settings-nav.jsx` | 167 | **ADAPT** | Header + search + items + footer composition ports cleanly. `NAV_ICONS` SVG strings can be reused directly as innerHTML. **Deviation from prototype: drop the Save button** (RC1 §3.3 amended in S10; Settings uses immediate-apply doctrine, a Save button with no pending state is fake interaction → fake ownership → trust damage). Keep Reset All button only. Lands in S5. |
| `settings-page-setup.jsx` | 129 | **PORT (with truth rerouting)** | Vanilla JS port preserves the geometry logic (paper dimensions, scaling, margin overlay, page numbers, headers/footers). **Deviation from prototype:** the prototype reads its inputs from a React `values` prop (effectively Store state). The port MUST instead call `Rga.Framework.LayoutProfile.compose(doc)` and render from the resolved page rect — single-resolver truth rule (S8 stop condition). PageSetupPreview and Print Preview share one geometry source. Lands in S8. |
| `settings-data.jsx` | 238 | **REUSE (indirectly)** | Schema is already in `settings-registry.js`. Only `labelKu` field needs back-porting. Lands as a sub-task in S9.2 (alongside DEFERRED state factory). |
| `settings-json.jsx` | 80 | **RETIRE** | Dev-only per RC1 §3.5. Correctly already omitted. Keep file in `docs/` as reference. |
| `tweaks-panel.jsx` | 530 | **RETIRE** | Dev-only per RC1 §3.5. Keep file in `docs/` as reference. |
| `Settings UI.html` | 268 | **REUSE as test fixture** | Loaded by Playwright in a second context for visual-truth comparison. Never shipped to production. Lands as part of Visual Truth Strategy (Section 4). |

### Port direction rule

Vanilla JS port, **not** React adoption. The current renderer architecture (`renderer/js/shell/workspaces/settings-workspace.js`) is vanilla DOM + IIFE modules. Adopting React for one workspace would add a build-step requirement and break the established pattern. The prototype's value is its **specification of geometry, typography, and composition**, not its runtime framework.

### What "port" means concretely

For each prototype component:
1. Read the JSX file's `style` objects and JSX tree.
2. In the corresponding vanilla JS factory, emit equivalent DOM elements with classnames mapping to a single CSS rule per visual property.
3. Where the prototype uses inline styles via React's `style={...}` (most styling is inline in the prototype), the port writes the same values into `settings-workspace.css` against semantic classnames.
4. The visual-truth test (Section 4) asserts the resulting computed styles match the prototype's within tolerance.

---

## 4. Visual Truth Strategy

### Pattern: prototype-comparison test, embedded per visual slice

Each visual fidelity slice ships **two** Playwright tests:

1. **Behavior test** — proves the wire path works (existing pattern from H5/H6/H7).
2. **Fidelity test** — opens both the prototype (`Settings UI.html`) and the implementation, asserts key visual properties match.

### Fidelity test mechanics

```js
// Pattern — every visual slice's fidelity test
const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

test('S1 — scope badge visual fidelity', async ({ browser }) => {
  // 1. Load prototype in a regular browser context.
  const protoCtx = await browser.newContext();
  const protoPage = await protoCtx.newPage();
  await protoPage.goto('file://' + path.resolve(__dirname,
    '../../../docs/rwanga-settings/Settings UI.html'));

  const protoBadge = protoPage.locator('[data-test-scope="flow"]').first();
  const protoMetrics = await protoBadge.evaluate(el => ({
    fontSize:    getComputedStyle(el).fontSize,
    fontWeight:  getComputedStyle(el).fontWeight,
    color:       getComputedStyle(el).color,
    background:  getComputedStyle(el).background,
    padding:     getComputedStyle(el).padding,
    borderRadius:getComputedStyle(el).borderRadius,
    width:       el.getBoundingClientRect().width,
    height:      el.getBoundingClientRect().height
  }));

  // 2. Launch Electron, open Settings, find equivalent badge.
  const app = await electron.launch({ args: [APP_ROOT] });
  const implPage = await app.firstWindow();
  await implPage.evaluate(() => window.Rga.SettingsWorkspace.open());
  const implBadge = implPage.locator(
    '.rga-settings-row[data-setting-id="theme"] .rga-settings-row-scope-badge').first();
  const implMetrics = await implBadge.evaluate(el => ({/* same shape */}));

  // 3. Assert with tolerance.
  expect(implMetrics.fontSize).toBe(protoMetrics.fontSize);
  expect(implMetrics.fontWeight).toBe(protoMetrics.fontWeight);
  expect(implMetrics.color).toBe(protoMetrics.color);
  expect(implMetrics.borderRadius).toBe(protoMetrics.borderRadius);
  expect(Math.abs(implMetrics.height - protoMetrics.height)).toBeLessThan(1);

  await protoCtx.close();
  await app.close();
});
```

### Properties asserted

Per visual slice, the fidelity test asserts at minimum:

- **Typography:** font-family, font-size, font-weight, line-height, color, letter-spacing
- **Box model:** width, height, padding, margin, border (style + width + color)
- **Border radius**
- **Background** (color or gradient string)
- **Display + alignment:** display, align-items, justify-content (where applicable)

### Tolerance

- **Exact string match** for color, font, weight (CSS-resolved values are deterministic).
- **±1px** on bounding-rect width/height (browser sub-pixel rendering varies).
- **No tolerance** on font-size, padding strings (computed CSS is exact).

### What this strategy catches

- Token mismatches (`--border-subtle` vs `--border-secondary`).
- Font-size drift (22px vs 16px section titles).
- Weight drift (600 vs 500 labels).
- Padding drift (`0 40px 32px` vs `24px 32px` content padding).
- Layout drift (flex card vs grid + bottom separator).
- Missing elements (badge or reset button absent → locator throws).

### What it doesn't catch

- Aesthetic intent (the fidelity test confirms numbers match, not that the result looks good — designer review still required at slice merge time).
- Cross-theme drift (Light vs Dark). Fidelity tests run against dark theme only; light-theme verification is a separate concern that the existing token system handles.
- Responsive breakpoints. S4 + S5 may need supplementary breakpoint tests; this strategy covers desktop only.

### Where the prototype lives at test time

`Settings UI.html` is loaded via `file://` in Playwright's regular browser context. No network. No CDN. The file already loads React + Babel via `unpkg.com` (lines 236-238 of the HTML), which violates the "local assets only" memory rule — but **only for the test fixture**, never for the shipped app. The test fixture's CDN dependency is acceptable per RC1 §3.5's "Developer Diagnostic Surface" carve-out, applied here to test-only material.

### Per-slice required fidelity assertions

| Slice | Prototype anchor element(s) | Properties asserted |
|---|---|---|
| S4 row layout | `.proto-row` (synthesized data-test attr in fixture) | display=grid, grid-template-columns=1fr auto, gap=8px, border-bottom=1px solid `--border-secondary`, no border-radius, no background |
| S6 typography | `.proto-section-title`, `.proto-row-label`, `.proto-row-helper` | font-size, font-weight, color |
| S1 scope badges | `[data-test-scope]` per scope value | dot size, label font, container padding, background alpha, color |
| S2 reset button | `[data-test-reset]` | font-size 11px, color `--text-tertiary`, opacity transitions on hover |
| S3 toggle / radio / number | `[data-test-toggle]`, `[data-test-radio]`, `[data-test-number]` | toggle 36×20 track + 16×16 thumb; radio segmented active=`--accent-primary`; number ±buttons |
| S5 nav chrome | `[data-test-nav-header]`, `[data-test-nav-item]`, `[data-test-nav-footer]` | header height, icon size, count pill, footer buttons |
| S8 page preview | `[data-test-page-preview]` | preview width 240px, page miniature dimensions, margin overlay positions |

(The `data-test-*` attributes do not yet exist in the prototype HTML — they need to be added as a one-time fixture preparation in S10 alongside the constitution amendment, since both are documentation-layer changes.)

---

## 5. Ownership Correction Strategy

### S7 — Store auto-route by `persistsTo` + modal Stage 1

**Goal:** make `Settings.Store` the single source of truth for document-scope settings (`pageSetup.*`, `screenplay.*`, `export.*`). Stop the parallel-write architecture without breaking the existing Ctrl+Shift+G muscle memory.

**Changes in `settings-store.js`:**

```
function set(id, value, opts) {
  opts = opts || {};
  const entry = Rga.Settings.Registry.get(id);
  if (!entry) return false;

  // NEW: auto-route by entry.persistsTo when opts.tier is not given.
  let tier = opts.tier;
  if (!tier) {
    tier = entry.persistsTo || 'user';
  }
  // (rest of validation + write logic unchanged)
}
```

**Changes in `settings-workspace.js _wireControl`:**

```
// BEFORE: const ok = Store.set(entry.id, newValue);
// AFTER:  same call — auto-routing kicks in inside Store.
```

**Reader migration:**

| File | Function | Before | After |
|---|---|---|---|
| `framework/layout-profile.js` | `_resolveMargins(settings)` | reads `settings.pageSetup.margins` | reads `Rga.Settings.Store.effective('pageSetup.margins')` |
| `framework/layout-profile.js` | `_resolvePageSize(settings)` | reads `settings.pageSetup.paperSize` | reads `Rga.Settings.Store.effective('pageSetup.paperSize')` |
| `framework/manuscript-geometry.js` | `applyPreset(doc, preset)` | writes `doc.settings.pageSetup.margins = ...` | calls `Rga.Settings.Store.set('pageSetup.margins', ...)` with auto-routing |

**Modal Stage 1 (`editor/page-setup-dialog.js`):**

```
// BEFORE:
function _applyValues(doc, paper, top, right, bottom, left) {
  doc.settings.pageSetup.paperSize = paper;
  doc.settings.pageSetup.margins = { top, right, bottom, left };
  // ...
}

// AFTER:
function _applyValues(paper, top, right, bottom, left) {
  Rga.Settings.Store.set('pageSetup.paperSize', paper);
  Rga.Settings.Store.set('pageSetup.margins', { top, right, bottom, left });
  // ... (Store auto-routes to tier:'script')
}
```

The modal keeps its Ctrl+Shift+G binding. Inputs still look the same. The only difference: writes go through Store, which auto-routes to `doc.settings` via the script tier, which fires the registered applicator + notifies all subscribers (including the Settings UI's Page Setup row, which now updates live when the modal applies).

**Side effect:** the orphan `--page-margin-*` CSS variable writes in the H7 applicator are retired in S8. Under the single-resolver truth rule, **no consumer is allowed to read those CSS variables**: PageSetupPreview reads via `Rga.Framework.LayoutProfile.compose(doc)`, not via CSS custom properties. The H7 applicator's CSS-variable writes are deleted as part of S8 to eliminate the orphan path entirely. (Future paper-view code that needs margin geometry MUST also call LayoutProfile, not read CSS vars.)

**Playwright proof for S7:**

```
1. Open script. Open Settings → Page Setup. Read current margin value via Store.effective.
2. Open Ctrl+Shift+G modal. Change top margin to 2. Click Apply.
3. Verify Settings UI's Page Setup row top margin field shows 2.
4. Verify Store.effective('pageSetup.margins').top === 2.
5. Verify doc.settings.pageSetup.margins.top === 2 (script-tier write).
6. Verify LayoutProfile._resolveMargins returns 2 (reader migrated).
7. Switch to a different script. Verify margins are per-document.
8. Reload. Verify margins persist via doc metadata, not user prefs.
```

### S12 — Legacy paths cleanup

**Settings Ownership Exemptions — constitutional classification**

S12 introduces a **categorical** classification (not a flat allow-list) for `localStorage` writes outside `Settings.Store`. Future random keys cannot become "exempt" — they must fit one of the named categories below or be moved into the Store.

#### ALLOWED categories

**Category 1: UI Session State** — transient per-session state about which surface the user is looking at right now. Not a preference. Not configurable in the Settings UI.

| Path | Key | Reason it qualifies |
|---|---|---|
| `view-mode.js` | `rga-view-mode` | "which view (Flow/Print/Draft) am I in right now" — per-session, not "default view" |
| `workspace-state.js` | `rga-workspace-layout` + legacy keys | sidebar/panel visibility per-session, not "default layout" |
| `tab-manager.js` | session-tabs key | which tabs were open, per-session |

**Category 2: Recent / History Data** — data records, not preferences. Bounded list of past artifacts.

| Path | Key | Reason it qualifies |
|---|---|---|
| `file-manager.js` | `recent-files-list` | history of opened files; not configurable as "what should appear here" |

#### FORBIDDEN

**Any configuration value.** A configuration value is anything a writer would expect to set in the Settings UI: theme, font, language, units, script language, page setup, autosave behavior, keyboard shortcuts, etc. Configuration values MUST go through `Settings.Store`. If a value sits in `localStorage` outside the four allowed paths above, S12 either promotes it to the registry or proves it belongs to one of the two ALLOWED categories.

#### Decision matrix for each currently-violating path

| Path | Decision | Action |
|---|---|---|
| `app-shell.js:33` `setAttribute('data-theme', ...)` | **REMOVE BYPASS** (configuration — forbidden) | The DOM mutation must happen *only* inside `Rga.Theme.apply` (the theme owner). Reorder `Rga.Theme.apply` to be applicator-only; replace `app-shell.js:33` direct call with a deferred `Store.set` after init. |
| `app-shell.js:25, 34` `localStorage('rga-theme')` | **MIGRATE then REMOVE** (configuration — forbidden) | `settings-migrations.js:27` already imports legacy at boot. Make it a one-shot, then delete the write side from `Rga.Theme.apply`. After S12: theme persists only via `window.rwanga.prefs` through Store's user tier. |
| `units.js` `localStorage('rga-default-units')` + `doc.settings.units` writes | **PROMOTE to registry** (configuration — forbidden in localStorage) | Add `units` entry (user-tier, default `'in'`) and `pageSetup.units` (script-tier). Register applicators, retire localStorage path, migrate readers. |
| `script-language.js` `localStorage('rga-script-lang')` | **PROMOTE to registry** (configuration — forbidden in localStorage) | Add `editor.scriptLanguage` entry (script-tier), register applicator, retire localStorage, migrate readers. |
| `view-mode.js` `localStorage('rga-view-mode')` | **ALLOWED — Category 1 (UI Session State)** | Document in RC1 §1A as Category 1 exemption. Drift guard recognizes by category, not by individual key. |
| `workspace-state.js` `localStorage('rga-workspace-layout')` + legacy keys | **ALLOWED — Category 1 (UI Session State)** | Document in RC1 §1A as Category 1 exemption. |
| `file-manager.js` `localStorage('recent-files-list')` | **ALLOWED — Category 2 (Recent / History Data)** | Already implicit; now categorical. |
| `tab-manager.js` session-tabs key | **ALLOWED — Category 1 (UI Session State)** | Already implicit; now categorical. |

**Drift guard expansion (`tests/unit/shell/ownership-stab-slice2.test.js`) — categorical enforcement:**

```
1. Enumerate every `localStorage.setItem(...)` call in renderer code.
   For each, classify by source file:
     - Inside Settings.Store user-tier write path (settings-store.js) → ALLOWED
     - Inside one of the four named Category 1 / Category 2 owners:
         * view-mode.js          (Category 1 — UI Session State)
         * workspace-state.js    (Category 1)
         * tab-manager.js        (Category 1)
         * file-manager.js       (Category 2 — Recent / History Data)
       → ALLOWED
     - Inside settings-migrations.js (one-shot legacy import) → ALLOWED (read-only role)
     - Anything else → FAIL.

   Adding a NEW localStorage key in a NEW file requires either:
     (a) declaring the new file as Category 1 or Category 2 owner
         (test enumerates owner files, not keys), or
     (b) routing through Settings.Store.

   The test fails on unrecognized owner files. This is stricter than
   a key allow-list because category membership cannot be silently
   bypassed by renaming a key.

2. Assert `setAttribute('data-theme', ...)` happens ONLY inside
   Rga.Theme.apply (the owner service for the theme DOM token).
   The only callers of Rga.Theme.apply must be:
     - shell-applicators.js:221  (the theme applicator)
     - shell-applicators.js:163  (system-media inverse-sync)
     - shell-applicators.js:217  (the H2B SettingsTheme.toggle helper)
   After S12, app-shell.js no longer calls setAttribute('data-theme')
   directly.

3. Assert `documentElement.style.setProperty` for any configuration-
   owned CSS variable (--editor-bg, --page-margin-*, --editor-font-*,
   --editor-line-height, --status-bar-height) happens ONLY inside
   the relevant applicator file.
```

### Modal staged retirement (S7 → S7B → S7C)

Per the user's correction: preserve comfort surfaces while changing truth underneath.

**Stage 1 (in S7):** Modal exists. Modal triggered by Ctrl+Shift+G. Modal Apply button calls `Settings.Store.set(...)` with auto-routing to `tier:'script'`. **No direct `doc.settings.pageSetup` writes anywhere in the modal.** Modal inputs continue to read from `doc.settings.pageSetup` for now (they need a current-value source; via `_activeDoc().settings.pageSetup` is fine since that's what `Store.effective(id, 'script')` returns).

**Acceptance:** S7's Playwright proof (step 2 above — modal write reflects in Settings UI live) is the gate.

**Stage 2 (S7B):** Independent slice. Ships *after* Phase 2 visual fidelity is complete (so the Settings UI Page Setup section is a proper UX successor). One-line change: the keyboard accelerator binding for Ctrl+Shift+G repoints from `_openModal()` to `Rga.SettingsWorkspace.open({ section: 'pageSetup' })`. The modal code stays in place; it's just no longer reachable from the keyboard or menus.

**Acceptance for S7B:**
- Ctrl+Shift+G opens Settings, navigates to Page Setup section (not the modal).
- The modal can still be triggered via a debug API (`window.Rga.Shell._legacyPageSetupModal()`) for QA/regression purposes.
- A small in-Settings notice appears the first time Ctrl+Shift+G is pressed post-upgrade: "Page Setup has moved to Settings → Page Setup. (Press OK to continue.)" — purely transitional UX, retired in S7C.

**Stage 3 (S7C):** Final deletion. Ships after a bake period of ≥ 1 release cycle with no Settings-UI Page Setup bug reports. The bake period gives users time to flag any UX regressions in the migrated surface.

**Acceptance for S7C:**
- `renderer/js/editor/page-setup-dialog.js` is deleted.
- Its CSS in (wherever the modal CSS lives) is deleted.
- The debug API `_legacyPageSetupModal` is deleted.
- The transitional notice from S7B is deleted.
- Code search for `page-setup-dialog` returns zero hits outside git history.

---

## 6. Frozen Saturation Reduction Strategy

### Operational classification — PERSISTS_ONLY vs DEFERRED

**Rule (added to RC1 §8.1 in S10):**

A registry entry without a registered applicator is classified by **implementation timing**, not by subjective "engine status" judgement. The rule is operational and answerable without debate.

| State | Definition (operational) | Visual treatment |
|---|---|---|
| **REAL** | Applicator registered; behavior wired. | Full opacity. Interactive. No helper-text suffix. |
| **PERSISTS_ONLY** | No applicator AND a named follow-up slice within **≤ next 2 slices** will wire it. | Full opacity. Interactive control disabled (H3A doctrine). Helper text appended `Behavior not wired yet.` |
| **DEFERRED** | No applicator AND **no follow-up slice named within ≤ next 2 slices** — implementation horizon unknown or later milestone. | 40% opacity (RC1 §8.1.1 verbatim). Control non-interactive. Helper text appended `This feature is coming soon.` |
| **CONDITIONAL_DISABLED** | Applicator registered but `entry.dependencies` is unmet. | 40% opacity per RC1 §8.1.3. Transitions to full when dependency is satisfied. |

**Why operational.** The previous distinction ("engine in progress" vs "engine absent") was subjective — engineers disagreed on which engines counted as "in progress". The new rule is checkable: read the plan; if a slice named ≤ 2 from the current slice will wire the entry, it is PERSISTS_ONLY; else it is DEFERRED.

**Registry shape change (in S9.2, ratified in S10):**

An explicit `state` field is added to registry entries:
- `state: 'real'` — implicit default for entries that HAVE an applicator.
- `state: 'persists-only'` — explicit; set when the plan names a follow-up wiring slice ≤ 2 ahead.
- `state: 'deferred'` — explicit; set when no near-term wiring is named.
- `state: 'conditional-disabled'` — set by `entry.dependencies` machinery.

**Default for a no-applicator entry without `state`: DEFERRED** (the most conservative answer to "when will this be wired?": "we don't know"). This means a sloppy slice that adds a no-applicator entry without tagging it visibly renders as DEFERRED — the cost of forgetting is visible roadmap honesty, not a "looks broken" frozen row.

**PERSISTS_ONLY is transient.** At the close of every plan, the rolling answer to "is wiring imminent?" determines the state. A future plan can re-tag DEFERRED → PERSISTS_ONLY when its own slices name wiring for those entries.

### Target

Drop visible "frozen-looking" PERSISTS_ONLY saturation from **66% (current)** down to **0% at this plan's close** — well under the user-mandated <25%.

Current state: 41 of 62 entries are no-applicator (66%); all currently render as PERSISTS_ONLY (the H3A treatment). User experiences this as "broken-looking".

State at plan close:

| State | Count | % of registry | What the user sees |
|---|---|---|---|
| REAL | 37 (21 existing + 16 wired in S9.1 + S9.2) | 60% | Live, interactive |
| DEFERRED | 25 (all remaining no-applicator entries) | 40% | 40% opacity + "This feature is coming soon." — reads as roadmap, not bug |
| **PERSISTS_ONLY** (frozen-looking) | **0** | **0%** | None visible at plan close |

**The previously-proposed "15-entry PERSISTS_ONLY parking lot" is eliminated.** Under the operational rule, every entry not actively in the wiring queue (S9.1 or S9.2 targets) is DEFERRED at plan close. A future plan that adds an S9.4 / S9.5 can re-tag selected DEFERRED entries as PERSISTS_ONLY at the start of that plan's wiring slice — that is the new mechanism for "in-flight" markers.

### Rolling state during this plan

The operational rule produces a moving classification as slices ship:

| Moment | PERSISTS_ONLY entries (≤ 2 slices ahead) | DEFERRED entries | REAL entries |
|---|---|---|---|
| Start of S9.1 | S9.1 targets (10) + S9.2 targets (6) = 16 | 25 (the rest, including S9.3's named targets which are explicit DEFERRED at intent) | 21 |
| End of S9.1 | S9.2 targets (6) + S9.3 boundary | tracking | 31 |
| End of S9.2 | S9.3 boundary only | tracking | 37 |
| End of S9.3 | 0 — no further slices named | 25 | 37 |

The 10 settings in S9.3's "intent to mark DEFERRED" list are tagged `state: 'deferred'` at S9.3 start, not earlier — their intent is "no engine", not "wiring soon".

### S9.1 — Wire 10 easy boolean toggles + simple values

Each is a single applicator + a single behavior test + a single fidelity test.

| Setting | Wire to | Risk |
|---|---|---|
| `editor.wordWrap` | CSS column-mode switcher on `#editor` (page / viewport / off → max-width or no max-width) | Low |
| `editor.autocomplete` | Stub flag in `Rga.Autocomplete` (engine doesn't exist yet — flag is wired even if the engine is no-op) | Low |
| `editor.showLineNumbers` | Toggle a CSS class on `#editor` that shows/hides the gutter | Low |
| `appearance.editorPageShadow` | Toggle a CSS class on `.rga-editor-page` that adds / removes the drop shadow | Low |
| `appearance.sidebarPosition` | Apply a class on shell root that swaps grid-template-columns (Left/Right) | Medium — touches responsive shell |
| `appearance.activityBar` | Toggle a class on shell root that hides the activity rail | Medium — same as above |
| `appearance.formatToolbar` | Toggle a class on `.rga-format-toolbar` (if visible in current view) | Low |
| `autosave.enabled` | Wire to existing `Rga.Autosave.setEnabled(value)` (engine exists) | Low |
| `autosave.interval` | Wire to existing `Rga.Autosave.setInterval(value)` (engine exists) | Low |
| `confirmBeforeClose` | Conditional `event.preventDefault()` in `window.beforeunload` handler | Low |

### S9.2 — Wire 6 more + introduce DEFERRED state factory

**Settings wired:**

| Setting | Wire to | Risk |
|---|---|---|
| `autosave.maxVersions` | File-cleanup hook in `Rga.Autosave` | Low |
| `files.defaultSaveFormat` | Used at save time in `Rga.FileManager.save` | Low |
| `files.backupOnOpen` | Used at open time in `Rga.FileManager.open` | Low |
| `files.defaultDirectory` | Used at save time as `defaultPath` for `pickSaveAs` | Low |
| `recentFilesLimit` | Recent list trim on every recent-files write | Low |
| `screenplay.boldSceneHeaders` | Toggle a CSS class on `#editor` that targets `.scene-heading { font-weight: bold }` | Low |

**Registry `state` field + DEFERRED factory** (introduced in this slice, ratified in S10):

S9.2 introduces the explicit `state` field defined in the operational classification above:
- `state: 'real'` — default when applicator is present.
- `state: 'persists-only'` — explicitly set by the slice author when a follow-up slice within ≤ 2 ahead will wire this entry. Renders per H3A: full opacity + control disabled + " Behavior not wired yet."
- `state: 'deferred'` — explicitly set when no near-term wiring is named. Renders per RC1 §8.1.1: 40% opacity + control disabled + " This feature is coming soon."
- `state: 'conditional-disabled'` — set when `entry.dependencies` is unmet.

`_buildRow` consults `entry.state` (with the no-applicator-no-state → DEFERRED default rule) to drive visual treatment. The renderer no longer guesses from "has applicator?" alone.

The classification is operationally testable: a registry-level unit test asserts every no-applicator entry has an explicit `state` field, and that the field matches the operational rule given the current plan's slice list.

### S9.3 — Mark all remaining no-applicator entries as DEFERRED

Under the operational rule, S9.3 sweeps **every remaining no-applicator entry** into `state: 'deferred'`. At plan close there is no S9.4 named — so no entry can defensibly carry `state: 'persists-only'` past S9.3.

Total deferred at S9.3 close: **25 entries** (= 62 − 37 REAL = 25). This includes the 10 originally listed "engine genuinely doesn't exist" entries plus the 15 previously-parked "PERSISTS_ONLY parking lot" entries. All 25 render at 40% opacity with " This feature is coming soon." — honest roadmap, not "broken-looking" frozen rows.

**Concrete list (25 entries marked DEFERRED in S9.3):**

| Setting | Implementation horizon |
|---|---|
| `screenplay.profile` | Formatting engine — multi-quarter |
| `screenplay.sceneNumbering` | Gutter rendering engine for scene numbers |
| `screenplay.sceneNumberPosition` | Depends on `screenplay.sceneNumbering` |
| `screenplay.dialogueContinued` | Page-break engine for CONT'D |
| `screenplay.moreAndContinued` | Same engine |
| `screenplay.underlineSceneHeaders` | Style hook ships with the formatting engine |
| `export.defaultFormat` | Export engine |
| `export.includeSceneNumbers` | Export engine |
| `export.includeTitlePage` | Export engine |
| `export.revisionMarks` | Revision-marks engine |
| `export.branding` | Export engine + Pro gating |
| `export.watermark` | Export engine |
| `export.colorMode` | Export engine |
| `language` | i18n engine + RTL routing |
| `restoreLastSession` | Boot-time orchestration; out of scope for this plan |
| `appearance.minimap` | Overview engine |
| `appearance.editorPageShadow` | If not wired in S9.1 (it is) — N/A |
| `advanced.debugMode` | Dev overlay engine |
| `advanced.showPageMap` | PageMap exists; toggle not yet exposed |
| `advanced.enableExperimental` | Master switch for experimental engines that don't exist |
| `advanced.logLevel` | Logger config not yet exposed |
| `editor.highlightCurrentLine` | REAL — should NOT appear here (verify at slice time) |
| Plus any remaining no-applicator entries from a final registry audit | TBD at slice time |

**S9.3 deliverables:**
1. Every no-applicator entry in the registry carries an explicit `state: 'deferred'` field.
2. Registry-level unit test asserts: count of `state: 'persists-only'` entries = 0 (no rolling-forward markers at plan close); count of `state: 'deferred'` entries = 25 (or whatever the audit count is, ≥ 22).
3. The persists-only-visual-contract test (renamed in S10) still has fixtures for forward-looking regression coverage — but no current rows exercise it. That is acceptable. The test guards future PERSISTS_ONLY rows.

### Why zero PERSISTS_ONLY at plan close?

Under the operational rule, PERSISTS_ONLY means "wiring is imminent". When the plan ends, nothing is imminent — there is no S9.4 named. Tagging entries as PERSISTS_ONLY would be a false promise. Marking them DEFERRED is the honest classification.

Future plans re-open the PERSISTS_ONLY state legitimately: a plan that introduces S15.1 and names it as the wiring slice for `screenplay.profile` would re-tag that entry as `state: 'persists-only'` at S15.1 start. The state cycle (DEFERRED → PERSISTS_ONLY → REAL) is normal across multi-plan timelines.

---

## 7. Stop Conditions

### Per-slice stop conditions

| Slice | Stop when |
|---|---|
| **S10** | (1) RC1 §8.1.2 amended to match H3A (PERSISTS_ONLY rows render at full opacity; only the interactive control is disabled). (2) RC1 §3.3 amended to remove the Save button (immediate-apply doctrine — see Section 5 / S5). (3) RC1 §8.1 augmented with the **operational PERSISTS_ONLY vs DEFERRED rule** (see Section 6). (4) `visual-contract-h3a.spec.js` **renamed (NOT deleted)** to `persists-only-visual-contract.spec.js`; its purpose is documented as a regression guard against four specific drifts: **row-level opacity drift, helper-text opacity drift, label-helper hierarchy collapse, row spacing collapse**. (5) Memory updated removing the "in conflict with RC1" caveat. (6) `data-test-*` attributes added to prototype HTML (`Settings UI.html`) for downstream fidelity tests in Phase 2. |
| **S7** | Playwright proof passes: modal edit reflects in Settings UI live; `LayoutProfile._resolveMargins` reads via Store; `manuscript-geometry.applyPreset` writes via Store; `doc.settings.pageSetup` is written *only* via Store auto-routing. |
| **S12** | Drift guard passes new asserts: localStorage allow-list enforced; `setAttribute('data-theme')` constrained; no new `rga-*` localStorage keys allowed. `units` + `editor.scriptLanguage` are in the registry with applicators. Theme bypass in `app-shell.js:33` removed. |
| **S8** | (1) PageSetupPreview renders as a 240px side panel when the Page Setup section is active. (2) Live updates within 100ms of a Settings change. (3) **Single-resolver truth rule (BLOCKER):** PageSetupPreview and Print Preview MUST derive geometry from the **same source** — `Rga.Framework.LayoutProfile.compose(doc)`. The preview MUST NOT read `Rga.Settings.Store.effective(...)` directly for geometry. The preview MUST NOT compute its own paper/margin/orientation math. Print Preview, when it ships, MUST also read via LayoutProfile (not from its own defaults). (4) Forbidden: Preview→Store path. Forbidden: Print→LayoutProfile-defaults path while Preview→Store. (5) Allowed: Preview→LayoutProfile, Print→LayoutProfile. (6) Playwright proof: edit a margin in the Settings UI → both `Rga.Framework.LayoutProfile.compose(activeDoc).margins` and the preview's rendered overlay-rect snap to the new value within 100ms. (7) Margin overlay positions, page numbers, header/footer all render correctly relative to the LayoutProfile-derived page rect. |
| **S4** | Row uses `grid-template-columns: 1fr auto`, 8px gap, no row background, no row border, 1px solid `--border-secondary` bottom separator. Fidelity test passes. |
| **S6** | Section title = 16px / 600. Helper text = 11px / 400. Label = 13px / 500. Content padding = 24px 32px. Max-width = 680px. Fidelity test passes. |
| **S1** | Every row in every section renders exactly one scope badge with correct color (Flow/Print/Export/All) and dot + label structure. Fidelity test passes. |
| **S2** | Reset button (`↺`) appears when row value differs from registry default. Opacity transition on appear. Clicking calls `Store.set(id, Registry.getDefault(id))`. Fidelity test passes. |
| **S3** | Toggle = 36×20 track + 16×16 thumb. Radio = segmented button group. Number = ±buttons + 56px centered input + unit label. Fidelity tests pass for all three. |
| **S5** | Nav has header (`⚙` + "Settings"), per-item icons (18×18), per-item count badge, footer with **Reset All button only** (NO Save button — see Section 5 / S5 scope below; Save removed by S10 RC1 §3.3 amendment, immediate-apply doctrine). Settings tab shows `⚙ Settings` + modified-count pill. Settings status bar shows "Settings • N modified". Fidelity test passes — the test EXPECTS the Save button to be ABSENT (a fidelity test that finds a Save button must fail). |
| **S9.1** | 10 entries transitioned to REAL. S9.2 + S9.3 targets carry explicit `state: 'persists-only'` field per operational rule. Per-setting behavior tests pass. |
| **S9.2** | 6 more entries to REAL. Registry `state` field + DEFERRED factory ship. `_buildRow` consults `entry.state` (default for no-applicator-no-state = DEFERRED). |
| **S9.3** | All 25 remaining no-applicator entries carry `state: 'deferred'`. Registry-level unit test asserts count of `state: 'persists-only'` entries == 0 at plan close. |
| **S7B** | Ctrl+Shift+G opens Settings → Page Setup section. Modal not reachable via menu or keybinding. Transitional notice shows once per user. Debug API `_legacyPageSetupModal` available for regression testing. |
| **S7C** | `page-setup-dialog.js` deleted. Modal CSS removed. Debug API removed. Transitional notice removed. Code search for `page-setup-dialog` returns zero hits outside git history. |

### Plan-level stop conditions — "Settings is constitutionally stable" when ALL hold

1. **RC1 contains no internal contradictions** — S10 amended three sections in one slice:
   (a) §8.1.2 to match H3A (PERSISTS_ONLY full opacity, control-disabled-only);
   (b) §3.3 to remove the Save button (Reset All only, immediate-apply doctrine);
   (c) §8.1 to add the operational PERSISTS_ONLY vs DEFERRED rule (≤ next 2 slices → PERSISTS_ONLY; else DEFERRED).
2. **Every row matches RC1 §4.1** — label + helper + scope badge + control + reset button, in the prescribed grid layout. (S4, S1, S2)
3. **Every control matches its RC1 §5.2 spec** — toggle, radio, select, number, slider, text, color, shortcut, margin group. (S3, plus existing H5/H6/H7)
4. **Nav matches RC1 §3.3 (amended)** — header, search, items with icons + counts, footer with **Reset All only** (no Save). (S5)
5. **Page Setup is single-track via Store with `persistsTo:'script'` routing** — no parallel writers, no orphan applicators. (S7)
6. **Single-resolver truth rule holds** — both PageSetupPreview and any future Print Preview derive geometry from `Rga.Framework.LayoutProfile.compose(doc)`. No consumer reads `Store.effective` directly for geometry; no consumer reads CSS custom properties for geometry; no consumer carries its own paper/margin defaults. (S8)
7. **PERSISTS_ONLY count = 0% of registry at plan close** — operational rule produces 0 frozen-looking rows when no further slices are named. DEFERRED count is 25; REAL count is 37. (S9.1, S9.2, S9.3)
8. **No parallel persistence paths exist except categorical exemptions** — only Category 1 (UI Session State: view-mode + workspace-state + tab-manager) and Category 2 (Recent / History Data: recent-files) are permitted. Theme/units/script-language are in Store. (S12)
9. **Drift guard enforces (8) categorically at unit-test level** — `ownership-stab-slice2.test.js` recognises owner files by category, not by individual key; rejects unknown owner files. Constrains `setAttribute('data-theme')` and configuration-owned CSS custom properties to applicator owners. (S12)
10. **Every visual fidelity slice ships a prototype-comparison test** — Section 4 pattern applied across S4, S6, S1, S2, S3, S5, S8.
11. **Every behavior test asserts ≥ 1 visible-surface change** — H5/H6/H7 retrofitted (this can happen in-place within S7 as part of the wider test hardening, or as a fast-follow). Final state: no green test passes while the product behavior is broken.
12. **`persists-only-visual-contract.spec.js` exists and passes** — the renamed H3A test guards against four named regressions: row-level opacity drift, helper opacity drift, label-helper hierarchy collapse, row spacing collapse. PERSISTS_ONLY count = 0 at plan close, so the test has no current rows to exercise — but the test fixtures and assertions remain in place as a forward-looking guard for future plans that re-introduce PERSISTS_ONLY entries.
13. **Modal Stage 3 complete** — `page-setup-dialog.js` deleted; single Page Setup surface exists. (S7C)

When all 13 conditions hold, Settings is no longer a parallel renderer with theatrical wiring. It is a constitutional implementation of RC1.

---

## Appendix A — Slice cards (one-line summary)

| Slice | Phase | Estimate | Risk | One-line scope |
|---|---|---|---|---|
| S10 | 0 | 1 hr | Zero | Amend RC1 §8.1.2 (PERSISTS_ONLY full opacity), §3.3 (no Save button), §8.1 (operational PERSISTS_ONLY/DEFERRED definitions); rename `visual-contract-h3a.spec.js` → `persists-only-visual-contract.spec.js` (regression guard against opacity + hierarchy + spacing drifts); add `data-test-*` attrs to prototype HTML |
| S7 | 1 | 6 hrs | Medium | `Store.set` auto-routes by `entry.persistsTo`; migrate `LayoutProfile` + `manuscript-geometry` readers; rewire page-setup-dialog to write through Store (Stage 1) |
| S12 | 1 | 6 hrs | Medium | Remove theme `setAttribute` bypass; promote `units` + `editor.scriptLanguage` to registry; exempt view-mode + workspace-state; broaden drift guard |
| S8 | 1 | 4 hrs | Low | Port `PageSetupPreview` to vanilla JS; render 240px side panel when Page Setup section is active; **reads via `LayoutProfile.compose(doc)` ONLY** (single-resolver truth rule); retires orphan `--page-margin-*` CSS-var writes from H7 |
| S4 | 2 | 2 hrs | Low | Row layout migration to `grid-template-columns: 1fr auto` + flat `--border-secondary` separator + no card chrome |
| S6 | 2 | 1 hr | Zero | Typography corrections: section title 16/600, helper 11/400, label 13/500; content padding 24px 32px; max-width 680px |
| S1 | 2 | 1 hr | Zero | Add `ScopeBadge` to every row; port from `settings-controls.jsx:7-27` |
| S2 | 2 | 2 hrs | Low | Add per-row reset button (↺); show on modification; call `Store.set(id, Registry.getDefault(id))` |
| S3 | 2 | 4 hrs | Low | Custom toggle (36×20 track + 16×16 thumb); segmented radio; ±buttons number; port from `settings-controls.jsx` |
| S5 | 2 | 4 hrs | Low | Nav chrome: header + icons + counts + footer with **Reset All only (NO Save)**; tab with `⚙` + modified-count; Settings status bar |
| S9.1 | 3 | 6 hrs | Medium | Wire 10 easy boolean toggles / simple values to REAL; explicit `state: 'persists-only'` tag on remaining S9.2 + S9.3 targets per operational rule |
| S9.2 | 3 | 6 hrs | Low | Wire 6 more settings to REAL; introduce registry `state` field + DEFERRED state factory (renders 40% opacity + "This feature is coming soon.") |
| S9.3 | 3 | 1 hr | Zero | Tag **all** 25 remaining no-applicator entries as `state: 'deferred'` (operational rule — no S9.4 named → cannot stay PERSISTS_ONLY). Final PERSISTS_ONLY count: **0**. |
| S7B | 4 | 30 min | Zero | Ctrl+Shift+G repoints to Settings → Page Setup section; transitional notice; debug API for legacy modal |
| S7C | 4 | 30 min | Zero | Delete `page-setup-dialog.js` + CSS + debug API + transitional notice (post-bake) |

**Total estimated time: ~44 hours of focused slice work, plus bake period between S7B and S7C.**

---

## Appendix B — What this plan does NOT do

To prevent scope creep:

- **No new control types.** RC1 §5.1 inventory is the closed set.
- **No new badge types.** RC1 §7 inventory is the closed set.
- **No new sections.** RC1 §2.1 ordering and content are the closed set.
- **No constitution amendments beyond S10.** S10 amends three sections in one slice — RC1 §8.1.2 (PERSISTS_ONLY full opacity), RC1 §3.3 (Reset All only, no Save button), and RC1 §8.1 (operational PERSISTS_ONLY/DEFERRED rule) — and these are the only RC1 changes in this plan.
- **No multi-language UI shipping.** Kurdish labels (`labelKu`) get added to the registry in S9.2 as a data prep step, but a working language switcher is out of scope for this plan.
- **No light-theme verification expansion.** Fidelity tests run against dark theme only.
- **No mobile/responsive expansion.** RC1 §11 breakpoint implementation is out of scope; the current single-layout shipping is preserved.
- **No JSON preview panel or tweaks panel in production.** These remain dev-only per RC1 §3.5.
- **No automated migration of user data.** Existing pref-file values for `pageSetup.*` (incorrectly stored at user tier under H7) are abandoned at S7 — users see registry defaults until they re-edit. This is acceptable because the incorrect values were not visible-effect-bearing in the first place (orphan applicator).

---

## Appendix C — Open questions for review before S1 starts

These do not block plan approval but are decisions needed *during* slice execution:

1. **DEFERRED-state factory shape.** Should DEFERRED be a registry field (`state: 'DEFERRED'`) or a computed property (entry has no applicator AND no expected near-future wiring)? Recommendation: explicit field. Asks for a registry shape extension at S9.2.
2. **Reset All button semantics.** Does it reset ALL settings to defaults, or only modified ones in the current section? RC1 §3.3 says "Reset All" but doesn't specify scope. Recommendation: reset all modified settings globally with a single confirmation dialog. Decided at S5.
3. **Save button purpose.** ~~RC1 doctrine elsewhere is "immediate apply, no Save button". RC1 §3.3 lists a Save button in the nav footer. Reconcile.~~ **DECIDED (locked):** Save button is **REMOVED**. Settings uses immediate-apply doctrine throughout. A Save button with no pending state creates fake interaction → fake ownership → trust damage. Reset All stays. RC1 §3.3 is amended in S10 to specify Reset All only. The prototype port in S5 drops the Save button.
4. **Per-section count format.** Total settings, or "N visible / M total" (when filtered by search)? Recommendation: total settings in default view; "N matches" when search active.
5. **Modal transitional notice copy.** Exact text + dismiss UX. Decided at S7B.

---

*End of SETTINGS_RECOVERY_EXECUTION_PLAN.md*

*Plan only. No implementation. Stop after the plan.*
