# Settings Designer Update Report

**Date:** 2026-05-27
**HEAD at report time:** `bebd9cd6` (pushed to `origin/main`)
**Audience:** designer + product, post Phase 1 + Phase 2 of the Settings Recovery
**Companion docs:** `SETTINGS_RECOVERY_EXECUTION_PLAN.md`, `H8_SETTINGS_FORENSIC_REPORT.md`, `DESIGNER_SETTINGS_DRIFT_REPORT.md`, `RWANGA_SETTINGS_DESIGN_CONSTITUTION.md` (RC1)

---

## 1. Why this report exists

The forensic and designer drift reports (2026-05-26) concluded that the shipped Settings UI did not match the RC1 design constitution or the prototype at `docs/rwanga-settings/`. The recovery plan ordered the fixes as truth → shape → expansion (Phase 1 ownership → Phase 2 visual fidelity → Phase 3 saturation reduction). Phases 1 and 2 are now complete. This report brings the designer up to date so the next round of design work starts from accurate ground truth.

---

## 2. Baseline before recovery

Pre-recovery HEAD was `328fb726` (post-H7). The state, captured in H8 + the designer drift report:

- **Page Setup** was a two-track architecture. The legacy modal wrote `doc.settings.pageSetup` directly; the Settings UI wrote a parallel user-tier value through `Settings.Store` that nothing in the geometry layer read. The H7 margins applicator wrote `--page-margin-*` CSS variables that no consumer read. The Settings UI was theatrical for margins.
- **Tier routing was broken.** `pageSetup.*`, `screenplay.*`, and `export.*` carry `persistsTo: 'script'` in the registry; `Store.set` defaulted to `tier: 'user'`. Document preferences persisted per-user; two scripts could not have different margins.
- **Five parallel persistence paths** bypassed `Settings.Store` entirely: `Rga.Theme` localStorage, `units`, `view-mode`, `script-language`, `workspace-state`.
- **One direct DOM bypass.** Boot-time `Rga.Theme.init` called `Rga.Theme.apply` outside the applicator chain, which set `data-theme` directly on `documentElement`.
- **Rows were cards.** The implementation rendered each row as a vertical stack inside a surface-secondary background with 1px subtle border + 4px radius. RC1 §4.1 requires a flat two-column grid (1fr auto) with a single 1px bottom separator.
- **Typography drifted.** Section title 22px (RC1: 16px). Row label weight 600 (RC1: 500). Helper text 12px (RC1: 11px). Content padding 0 40px 32px (RC1: 24px 32px). No max-width (RC1: 680px).
- **Scope badges absent.** RC1 §4.4 mandates one scope badge per row; none rendered.
- **Per-row reset absent.** RC1 §4.1 + §12.7 require ↺ on every row visible when the value differs from the registry default; none rendered.
- **Controls drifted.** Toggle was a 16×16 native checkbox; RC1 §5.2.1 specifies a 36×20 switch with a 16×16 thumb. Radio was a flex of native radios with 12px gaps; RC1 §5.2.2 specifies a segmented control. Number was a plain input min-width 100px; RC1 §5.2.4 specifies a wrap with `[− input unit? +]`.
- **Nav chrome was minimal.** Just labels — no icons, no descriptions, no count, no header, no footer. RC1 §3.3 specifies a gear-titled header, items with icon + label + count, and a Reset All footer button.
- **41 of 62 entries (66%)** rendered as `PERSISTS_ONLY` with disabled controls and " Behavior not wired yet." suffix. Four entire sections — Screenplay, Print/Export, Autosave, Advanced — were 100% frozen-looking.

The user's three perceptions ("far from designer intent", "drift keeps returning", "75% appears frozen") were all empirically true.

---

## 3. What was fixed, slice by slice

Phase 1 (truth) and Phase 2 (shape) shipped as ten slices. Each slice landed with a dedicated Playwright spec; the full settings suite is at 113/113 passing as of `bebd9cd6`.

### Phase 0 — doctrinal clear

**S10 — `9937b0f6` — RC1 alignment.** Three RC1 amendments in one documentation slice:
1. §8.1.2 reconciled to the H3A doctrine (PERSISTS_ONLY rows render at full opacity; only the control is disabled). The H3A test was *renamed* from `visual-contract-h3a.spec.js` → `persists-only-visual-contract.spec.js` and broadened as a regression guard against four named drifts (row-level opacity, helper opacity, label-helper hierarchy collapse, row spacing collapse).
2. §3.3 — Save button removed. Settings uses immediate-apply doctrine; a Save button with no pending state is fake interaction → fake ownership → trust damage. Reset All stays.
3. §8.1 — operational PERSISTS_ONLY vs DEFERRED rule added: "named follow-up slice within ≤ next 2 slices → PERSISTS_ONLY; else DEFERRED." Replaces the previous subjective "engine status" judgement with a checkable answer.

### Phase 1 — ownership correction

**S7 Stage 1 — `b48be1d3` — Page Setup ownership.** `Settings.Store.set` now auto-routes by `entry.persistsTo`: dotted ids like `pageSetup.margins` land on the active doc's `doc.settings.pageSetup.margins` (nested file-format compat shape). The modal was rewired to write through Store; muscle memory (Ctrl+Shift+G) is preserved. `manuscript-geometry.applyPreset` migrated to Store. The first Page Setup-ownership spec (5 tests, 7 brief behaviors) shipped here.

**S12 — `6fc78145` — Legacy paths cleanup.** Three configuration-value bypasses retired:
- `Rga.Theme.apply` no longer writes `localStorage('rga-theme')`. Persistence flows through `Settings.Store` user tier (`window.rwanga.prefs`).
- `units` promoted to the registry (user tier, default `'in'`, options `['in','cm','mm','px']`). The legacy `Rga.Units` module became a thin Store pass-through.
- `editor.scriptLanguage` promoted to the registry (script tier, default `'en'`). The legacy `Rga.ScriptLanguage` module became applicator-driven.

RC1 §1A.6 added: **categorical exemptions**. UI session state (`view-mode`, `workspace-state`, `tab-manager`) and recent/history data (`file-manager`) are allowed by category, not by individual key. A new categorical drift guard at `tests/unit/shell/ownership-stab-slice2.test.js` enforces by owner-file enumeration so renaming a key cannot bypass the rule.

**S8 — `03f5b427` — Page Setup live preview (single-resolver page truth).** `Rga.LayoutProfile.compose` is now the single resolver consumed by both the Settings UI's Page Setup preview AND any future Print Preview / PrintRenderer. The compose() output was extended with orientation (page swaps width/height when landscape), page-number position, and header/footer text — so the preview reads everything from compose's shape, never from `Store.effective`. The orphan `--page-margin-*` CSS variable writes from H7 were retired (no consumer ever read them). Seven preview-notifier applicators (`pageSetup.paperSize`, `.orientation`, `.margins`, `.pageNumbers`, `.pageNumberPosition`, `.headerText`, `.footerText`) drive the preview's repaint via the standard `Settings.Applicators` wire path; the preview itself is rAF-debounced so the live-update budget (≤100ms) holds comfortably.

### Phase 2 — visual fidelity

**S4 — `ddae3b73` — Row anatomy.** `.rga-settings-row` flipped from card (surface-secondary background, 1px subtle border, 4px radius) to flat grid (`grid-template-columns: 1fr auto`, `grid-template-areas: "label control"/"helper control"`, 8px column gap, 14px vertical padding, single 1px solid `--border-secondary` bottom separator). The `is-pro` left-border decoration retired. Rows container gap dropped from 16px to 0 (the separator IS the visual break).

**S6 — `ea26b36a` — Typography + content geometry.** Section title 22px → 16px (weight 600 unchanged). Row label weight 600 → 500 (13px unchanged). Helper text 12px → 11px + explicit `font-weight: 400`. Content padding `0 40px 32px` → `24px 32px`. New `max-width: 680px` on the content column (the pageSetup section overrides to 1000px so the 280px live preview side panel still fits).

**S1 — `8b05c9d8` — Scope badges.** Every row carries exactly one scope badge inline after the row label inside the row header. Four scopes (`flow`, `print`, `export`, `all`) with the RC1 colour set (`#FFC107`, `#007acc`, `#4EC9B0`, `#9e9e9e`) and the per-row 8% alpha background. Dot 6×6, font 10px/600/0.04em letter-spacing, padding 2px 7px, radius 3px. Renders on REAL and PERSISTS_ONLY rows alike — scope is an identity signal, not a status one.

**S2 — `90482c93` — Per-row reset.** RC1 §4.1 ↺ button. Lives in the DOM at all times (no layout twitch); visibility flipped by the `.is-modified` class on the row via opacity transition. Click writes `Registry.getDefault(id)` through `Settings.Store.set`, with S7 auto-routing placing the value in the correct tier. Object defaults (margins) are cloned before write so the registry never shares references with persisted state. PERSISTS_ONLY rows do not render reset (H3A doctrine: those rows are intentionally non-interactive).

**S3 — `cb249cd2` — Control fidelity.** Toggle, radio, number rebuilt to RC1.
- **Toggle**: 36×20 track with 16×16 thumb; thumb at left 2px (off) / 18px (on); `--bg-quaternary` (off) / `--accent-primary` (on) via `:has(input:checked)`. Hidden native checkbox preserves keyboard + ARIA semantics; the label carries `role="switch"` + `aria-checked`.
- **Radio**: segmented control. Shared outer border + `--radius-md` on the fieldset; per-segment 5px 12px padding. Native radio hidden (opacity 0, fills the segment so clicks always land on the input). Active segment painted with `--accent-primary` + white text via `:has(input:checked)` + a JS-mirrored `data-checked`.
- **Number**: wrap `[− input unit? +]` with shared 1px border + `--radius-md`. Centred 56px input. ± buttons step by `entry.step` (default 1) and clamp to `entry.min`/`entry.max` when present. Direct typing clamps on blur.

**S5 — `bebd9cd6` — Nav chrome.** RC1 §3.3.
- Nav header band: gear icon + "Settings" title (16px / 600).
- Nav items rebuilt: `[icon (18×18)] [title (13/400 → 500 active) + description (11/400, ellipsised at < 900px width)] [count chip]`, padding 8px 16px, 2px transparent left border that flips to `--accent-primary` on the active item, hover background.
- Nav footer band with a full-width Reset All button. No Save. Reset All iterates the registry and writes every non-default value back to default through `Settings.Store` (S7 auto-routing handles tier).
- Responsive: at ≤ 900px the item descriptions hide; at ≤ 600px the workspace flips to a single-column stacked layout (nav becomes a horizontal item rail at the top, header + footer hide).

---

## 4. Artifacts: where to see it

Visual artifacts live in the live app + the fidelity Playwright specs. There are no screenshots embedded in this report by design (per project memory: *"for layout / responsive / DOM-geometry work, write a Playwright spec instead of asking for screenshots"*). The specs assert computed-style values via `data-*` attributes so layout drift is caught without binary diffs.

| Slice | Spec | Assertions |
|---|---|---|
| S4 | `tests/e2e/settings/row-layout-fidelity.spec.js` | 10 — grid display, 1fr-auto tracks, 8px gap, no card chrome, single bottom separator, control hugs right, label hugs left, controls work |
| S6 | `tests/e2e/settings/typography-fidelity.spec.js` | 10 — section title 16/600, row label 13/500, helper 11/400, content padding 24/32, max-width 680px, S4 grid invariant, controls work |
| S1 | `tests/e2e/settings/scope-badges-fidelity.spec.js` | 10 — one badge per row, label matches registry scope, leading dot, 6×6 dot, 10/600/0.04em font, 2px 7px padding, inline after label |
| S2 | `tests/e2e/settings/row-reset-fidelity.spec.js` | 10 — hidden at default, shows on user-tier change, restores on click, hides after restore, script-tier reset, object reset (`pageSetup.margins`), computed style matches RC1, 6px gap from control |
| S3 | `tests/e2e/settings/control-fidelity.spec.js` | 10 — toggle 36×20 / thumb 16×16, click round-trip, radio segmented + no native dot, accent active background, click round-trip, number `[− input +]`, ± clamp, blur clamp |
| S5 | `tests/e2e/settings/navigation-fidelity.spec.js` | 10 — icon, title, description, indicator bar, active bg, hover state, Reset All exists, Save absent, responsive narrow widths, prior invariants hold |
| S7 | `tests/e2e/settings/page-setup-ownership.spec.js` | 5 — modal → Store, doc tier persistence, LayoutProfile reflects the modal-set margins, orphan CSS path drift guard, reload preserves state |
| S8 | `tests/e2e/settings/page-setup-preview.spec.js` | 7 — preview mounts, single resolver invariant, margins update ≤ 100ms, orientation swap, paper size update, single-source contract, no orphan CSS path |

The prototype's `Settings UI.html` + JSX files remain in `docs/rwanga-settings/` as the original designer artifacts; future fidelity tests can use them as visual-truth comparison material per the recovery plan's Section 4.

---

## 5. What now matches RC1 vs what remains

### Matches RC1 today

- §1A.3 + §1A.6 — ownership + categorical exemptions (S12 + drift guard)
- §3.3 — nav chrome: gear header, items with icon + title + description + count, footer with Reset All only (S5)
- §3.4 — content max-width 680px, padding 24px 32px (S6)
- §3.6 — Settings status bar … **not yet** — see "remains" below
- §4.1 — row anatomy: grid 1fr auto, 8px gap, single bottom separator, label/helper left + control right; reset button hugs right with 6px gap (S4 + S2)
- §4.4 — every row has one scope badge (S1)
- §5.2.1 — toggle switch 36×20 / thumb 16×16 (S3)
- §5.2.2 — radio segmented control (S3)
- §5.2.4 — number wrap `[− input +]` (S3)
- §5.2.5 — slider (already correct since H5)
- §5.2.6 — text input (already correct)
- §5.2.7 — color swatches (already correct since H7)
- §5.2.8 — shortcut control (already correct since H6)
- §5.2.9 — margin group (already correct since H7)
- §7.1 — scope badge anatomy (S1)
- §7.2 — Pro / Restart status markers (already correct)
- §8.1.2 — PERSISTS_ONLY full opacity + control-disabled-only (S10 + H3A)
- §10.3 — tier routing: document-scope settings persist per-document (S7)
- §12.7 — reset opacity transition (S2)

### Still pending (Phase 3 + tail slices)

- §8.1.1 — DEFERRED state at 40% opacity + " This feature is coming soon." Currently no entry uses this state; rendering paths for `state: 'deferred'` ship in S9.2.
- §8.1.3 — conditional-disabled at 40% opacity when `entry.dependencies` is unmet. Declared in the registry, not yet enforced at render time.
- §10.2 — section descriptions for document-scope sections should include the phrase "for this document" / "for the current script". Currently generic.
- §11 — responsive breakpoints. S5 added a minimal 900/600 collapse; the full 5-breakpoint table in §11 is out of scope for the recovery plan.
- §6.5 — Kurdish labels (`labelKu`) on every registry entry. Data prep is named in S9.2.
- §3.2 — Settings tab indicator: `⚙ Settings` glyph + modified-count badge. Not in scope for the recovery plan; queued.

---

## 6. What designer should watch in future UI work

These are the constraints the recovery established. Any future design change must respect them or be ratified with an RC1 amendment first (per RC1 §14.3).

1. **Single-resolver page truth.** Anything that renders page geometry — print preview, paper view, miniatures, even thumbnails — MUST read via `Rga.LayoutProfile.compose(profile, settings)` or `Rga.ManuscriptGeometry.resolve(doc)`. Designs that suggest reading paper dimensions from a config object or CSS variable are rejected at code review.
2. **No Save button.** Settings is immediate-apply. Reset (per-row + Reset All) is the only meta-affordance.
3. **PERSISTS_ONLY rows are full-opacity.** Only the interactive control is disabled. The textual signal is " Behavior not wired yet." appended to the helper text. Row chrome (label, badge, layout) is identical to a REAL row.
4. **Every row carries exactly one scope badge.** Scope is identity, not status — it renders on REAL and PERSISTS_ONLY rows alike. Designs that omit the badge or duplicate it are rejected.
5. **Reset button visibility is binary.** Opacity 0 when value === default, opacity 1 when value !== default. Both states keep the same layout slot (no jitter when it appears).
6. **`pageSetup.*` rows always show the live preview side panel.** The side panel reserves a 280px column inside the content area; the row column is 1fr inside a max-width 1000px override. Future design changes to Page Setup should respect this two-column shape.
7. **Configuration values must flow through `Settings.Store`.** The `localStorage` exemption is categorical (UI session state + recent/history data) and the four owner files are enumerated in RC1 §1A.6. Any new key in a new file requires either declaring the file in §1A.6 or routing through `Settings.Store`.
8. **No control-type chips.** RC1 §7.3 forbids badges that expose engineer vocabulary (`toggle`, `select`, etc.) to writers. The H3 cleanup removed them; do not reintroduce.
9. **Phase 3 is the next major design surface.** When wiring the remaining 41 PERSISTS_ONLY entries, every wiring requires a visible-effect path. A registered applicator with no consumer is an orphan (the pre-S8 `--page-margin-*` writes were exactly this) and will be rejected.

---

## 7. Push state

All ten recovery commits are on `origin/main` as of `bebd9cd6`. The remaining working-tree noise (Python `.pyc` cache files, the unrelated `docs/RWANGA_IDE_ALIVE_APP_CHECKLIST.md` from the H7 era, and the empty `rwanga-editor/tests/diagnostics/visual-drift/` directory) is the standing don't-touch list called out in the original handoff and is unrelated to this recovery work.

---

*End of report. The Settings UI now matches the RC1 constitution across ownership and visual fidelity. Phase 3 (saturation reduction) is the next major arc.*
