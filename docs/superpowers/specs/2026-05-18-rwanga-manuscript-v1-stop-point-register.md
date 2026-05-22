# Rwanga Manuscript v1 — Stop-Point Register

> **Status:** Phase A.3 artifact. Authored 2026-05-18. Baseline commit: `f837ed8e`. Test baseline: 879/879 pass.
> **Purpose:** Every "ghost feature," dead code path, and latent bug surfaced by the manuscript-subsystem forensic audit. Each entry has an explicit STOP gate: who decides what happens, when, and what evidence closes the entry.
> **Binding rule:** No item in this register may be silently changed by the executing agent. If the agent encounters a stop point, the agent halts and reports.

---

## Index

| ID | Subject | Severity | Resolution path in v1 |
|---|---|---|---|
| SP-01 | Print Preview is implemented but UNREACHABLE from live UI | P1 | Fixed in Phase D |
| SP-02 | Export to PDF menu wired in shell, NO implementation | P2 | Phase F spec only — NOT implemented in v1 |
| SP-03 | Page Setup margin Apply does NOT re-paginate immediately | P1 | Fixed in Phase E.3 |
| SP-04 | Page Setup hidden behind Ctrl+Shift+G; no File-menu entry | P2 | Fixed in Phase E.4 |
| SP-05 | `.rga-page-break` CSS rules target v3-deleted PM node (dead code) | P3 | Deleted in Phase C.4 |
| SP-06 | Manual page-break has no v3 schema node | P3 | OUT OF SCOPE for v1 — deferred to v3.1 schema |
| SP-07 | Status-bar `printPreview` option is hidden+disabled placeholder | P2 | Made live in Phase D.1 |
| SP-08 | `.rga-page-sheet` padding hardcoded; ignores doc margins | P1 | Fixed in Phase D.2 |
| SP-09 | Print Preview lacks bottom-center footer + running header | P3 | Added in Phase D.3, D.4 |
| SP-10 | Print Preview RTL: padding-left:1.5in unconditional (wrong-side binding for Arabic/Kurdish) | P2 | Fixed in Phase D (RTL mirror rule) |
| SP-11 | Reference memory `reference_ide_key_files.md` lists 70 tests; reality is 879 | P3 | Update memory entry after Phase A |
| SP-12 | Flow `.rga-page` width / padding written by inline JS, `view-flow` CSS uses !important fallback | P3 | Document, do not change in v1 |
| SP-13 | Sample fixture path mismatch between memory + repo | P3 | Verify before Phase C tests |
| SP-14 | nav-index plugin recomputes on EVERY `tr.docChanged` — perf at 120+ pages unverified | P2 | Verify in Phase C |
| SP-15 | View menu lacks "Print Preview" radio entry (Flow/Draft/Print only) | P2 | Fixed in Phase D.1 |
| SP-16 | `--page-width` token has TWO consumers (`.rga-page` + `.rga-shell-toolbar-inner`) | INFO | LOCKED — do not break |
| SP-17 | Ctrl+Shift+P is RESERVED for Command Palette | INFO | Binding rule — do not bind to Print Preview |
| SP-18 | `Rga.PageMap.build` V1 cannot split blocks (rule 6); pathological inputs overflow one page | INFO | LOCKED — V1 contract, V2 may revisit |

---

## SP-01 — Print Preview is implemented but UNREACHABLE

**Where:** `renderer/js/framework/print-preview.js` + `renderer/js/framework/print-renderer.js` + CSS `editor-prosemirror.css:2127-2188`.
**Symptom:** `Rga.PrintPreview.show(view)` is registered with `Rga.ViewManager` and would mount a per-sheet renderer if called. Nothing calls it from the live UI.
**Evidence:**
- `electron/menu.js:51-75`: View menu has Flow / Draft / Print only.
- `renderer/js/shell/status-bar.js:147-155`: hidden disabled `printPreview` `<option>` with comment "held by the hidden option for display only" implies a toolbar trigger that does not exist.
- `grep -i printPreview renderer/js/format-toolbar.js` → zero matches.
- No `KeyboardRegistry.register` call binds Print Preview anywhere.
**Severity:** P1 (a fully-built feature is dark).
**Resolution path in v1:** Phase D.1 adds File menu entry + makes status-bar dropdown option live. **No keybinding** (per correction B — Ctrl+Shift+P is reserved).
**Stop gate:** Phase D.1 implementation must verify reachability from BOTH surfaces before D.2 opens. User signs off after smoke test on Windows.
**Out of scope:** Wiring Print Preview into any other surface (command palette, toolbar button, dock). Future work.

---

## SP-02 — Export to PDF menu wired, NO implementation

**Where:** `electron/menu.js:34` defines `Export to PDF…` → `file.exportPdf` (Ctrl+Shift+E). `renderer/index.html:1305-1308` explicitly comments "file.exportPdf… not yet wired."
**Symptom:** Clicking the menu does nothing. No `webContents.printToPDF`. No `Rga.Export` module. No IPC bridge.
**Severity:** P2 (a writer-discoverable surface is a dead button).
**Resolution path in v1:** **NO IMPLEMENTATION.** Phase F authors `docs/superpowers/specs/2026-NN-NN-rwanga-export-and-branding-design.md`. v1 ships the menu entry as-is.
**Stop gate:** Phase F spec is the artifact; execution of export is a separate plan + session and requires explicit user authorization.
**User must decide before Phase F:** whether to keep the broken menu entry visible in v1, hide it, or replace its label with "Export to PDF (coming soon)…". Open question. Default: leave as-is.

---

## SP-03 — Page Setup margin Apply does NOT re-paginate immediately

**Where:** `renderer/js/editor/page-setup-dialog.js:89-104`.
**Symptom:** On Apply, the dialog writes `doc.settings.pageSetup.{paperSize,margins}` + calls `Rga.Doc.markDirty(doc)` + invokes the `onApply` callback (which today calls `Rga.PageSurface.apply(ps)` — geometry on the .rga-page only). It does NOT trigger pagination recompute. The nav-index plugin only rebuilds the PageMap on `tr.docChanged`. Margin changes alone are NOT a doc change.
**Result:** Flow markers and status-bar Page X / Y reflect the OLD geometry until the writer next types a character.
**Severity:** P1 (silent visible-vs-truth divergence; the kind of bug that erodes export confidence).
**Resolution path in v1:** Phase E.3 — Page Setup Apply dispatches `view.dispatch(view.state.tr.setMeta('rga.forceReindex', true))`. nav-index `apply` hook checks for `forceReindex` meta in addition to `tr.docChanged`. Single-line patch in each.
**Stop gate:** Phase E.3 must verify with a smoke test: open Page Setup → change top margin from 1.0 to 0.75 → Apply → confirm status-bar Page count changes WITHOUT typing.

---

## SP-04 — Page Setup hidden behind Ctrl+Shift+G

**Where:** `renderer/js/editor/page-setup-dialog.js:111-120`. Comment: "TEMPORARY trigger for Step A verification. The permanent trigger (a File menu item) is tracked in the Stop-Point Register."
**Symptom:** Writers must know the undocumented Ctrl+Shift+G shortcut to find Page Setup. There is no File menu entry.
**Severity:** P2 (discoverability — feature exists but is hidden).
**Resolution path in v1:** Phase E.4 — add File menu entry; both `electron/menu.js` (macOS) AND renderer-owned menubar (Windows/Linux). Keep Ctrl+Shift+G as accelerator (no-op change for muscle memory).
**Stop gate:** Phase E.4 implementation must sync BOTH menu surfaces. Verify on both platforms.

---

## SP-05 — `.rga-page-break` CSS targets v3-deleted PM node

**Where:** `renderer/css/editor-prosemirror.css:53-64` (Print view), `:92-116` (Flow view). Targets the PM node `.rga-page-break` which exists in the CSS surface but NOT in `renderer/js/doc-types/screenplay/schema-v3.js` (grepped, zero matches for `pageBreak` in the v3 schema).
**Symptom:** Dead CSS. Confusing for any future maintainer. The legacy v2 schema may have had a `pageBreak` node; the v3 migration dropped it.
**Severity:** P3 (cosmetic + confusing, not visibly broken).
**Resolution path in v1:** Phase C.4 — delete both CSS rule blocks. Verify with `grep -n 'rga-page-break' renderer/css/editor-prosemirror.css` returning no matches.
**Stop gate:** Phase C.4 must NOT also delete the `archived/page-breaks-v1.js` reference (that's intentional historical preservation).

---

## SP-06 — Manual page-break has no v3 schema node

**Where:** `renderer/js/doc-types/screenplay/schema-v3.js` does not declare a `pageBreak` node. The v2 schema (and `archived/page-breaks-v1.js`) had one.
**Symptom:** Writers cannot insert a manual page break in v3 documents. The PageMap engine cannot honor a writer-requested boundary because the schema cannot represent one.
**Severity:** P3 (design feature, not a regression — many screenplay editors don't expose manual breaks).
**Resolution path in v1:** **OUT OF SCOPE.** Deferred to a hypothetical v3.1 schema migration. If revived, the schema gains a `pageBreak` node + the CSS rules deleted in SP-05 come back (targeted, intentional).
**Stop gate:** If during Phase C any agent proposes restoring `.rga-page-break` CSS without a schema change, STOP and report. Adding presentational CSS for a non-existent node would be a regression.

---

## SP-07 — Status-bar `printPreview` option is hidden+disabled placeholder

**Where:** `renderer/js/shell/status-bar.js:147-155`.
**Symptom:** `<option value="printPreview" disabled hidden>Print Preview</option>` — its sole purpose today is holding `.value` when the user enters Print Preview "via the toolbar" (which does not exist). It is a workaround for a feature that was never wired.
**Severity:** P2 (UI lie — the dropdown implies Print Preview exists, but you cannot pick it).
**Resolution path in v1:** Phase D.1 — remove `disabled` and `hidden` attributes; option becomes a live choice; `_onViewModeChange` already routes to `Rga.ViewMode.set('printPreview')` which the ViewManager resolves to the registered controller.
**Stop gate:** Verify that selecting Print Preview from the dropdown calls `Rga.PrintPreview.show(view)` correctly with the active editor view as argument. The current `_onViewModeChange` calls `Rga.ViewMode.set(mode)` with the mode string only — Print Preview's `activate(view)` needs the editor view. Phase D.1 must thread this argument or document why it's safe.

---

## SP-08 — `.rga-page-sheet` padding hardcoded; ignores doc margins

**Where:** `renderer/css/editor-prosemirror.css:2168` — `padding: 1in 1in 1in 1.5in;`.
**Symptom:** Print Preview sheets ignore `doc.settings.pageSetup.margins`. A writer who sets compact margins (0.75in all around) sees Print Preview render at Hollywood-default margins. Visible truth divergence between Page Setup intent and Print Preview output.
**Severity:** P1 (breaks "what you see is what you get" doctrine).
**Resolution path in v1:** Phase D.2 — `Rga.PrintRenderer._buildPageSheet` reads `renderModel.layoutProfile.margins` and writes inline-style padding per-sheet. Drop the hardcoded CSS padding (keep as fallback for empty render).
**Stop gate:** Verify with a fixture: set margins to 0.5/0.5/1/0.5 → Print Preview sheets show wider text area. `getComputedStyle(sheet).paddingLeft` reflects the override.

---

## SP-09 — Print Preview lacks bottom-center footer + running header

**Where:** `renderer/js/framework/print-renderer.js:74-77` — only `<div class="rga-page-sheet-header">N.</div>` top-right.
**Symptom:** No bottom-center page number, no running header (script title top-left). Cannot match Industry / Submission templates.
**Severity:** P3 (Hollywood top-right `N.` IS the dominant convention; absence is a feature gap not a bug).
**Resolution path in v1:** Phase D.3 + D.4 — extend `_buildPageSheet` with optional footer + header slots driven by `Rga.PrintPreview.options.{footerStyle, headerStyle}`. Defaults preserve today's behavior (top-right only).
**Stop gate:** D.3 + D.4 must NOT change the default header/footer rendering. Existing tests + fixtures stay green.

---

## SP-10 — Print Preview RTL: wrong-side binding margin

**Where:** `renderer/css/editor-prosemirror.css:2168` — `padding: 1in 1in 1in 1.5in;` (T R B L).
**Symptom:** Hollywood convention: left margin wider for binding. For Arabic / Kurdish (RTL) the binding side is RIGHT, so padding should be `1in 1.5in 1in 1in` when `dir="rtl"`. Today, Arabic Print Preview shows binding margin on the wrong side.
**Severity:** P2 (visibly wrong for the project's namesake audience — Kurdish/Arabic screenwriters).
**Resolution path in v1:** Phase D — single CSS rule `[dir="rtl"] .rga-page-sheet { padding: 1in 1.5in 1in 1in; }` OR derive from LayoutProfile's margins which already carry left/right correctly (LTR-canonical). Choice in Phase D execution.
**Stop gate:** Phase D must verify with an RTL fixture if one exists in `tests/fixtures/`. If none, log a note and ship the LTR-correct path; flag an RTL fixture as a Phase D follow-up.

---

## SP-11 — Reference memory `reference_ide_key_files.md` is stale on test count

**Where:** `C:\Users\darya\.claude\projects\E--api-rwanga\memory\reference_ide_key_files.md` line 40: "Run all: `node --test tests/unit/**/*.test.js tests/unit/*.test.js` (70 tests)".
**Symptom:** Memory claims 70 tests. Reality: **879 tests (verified this session, 2026-05-18, all pass)**.
**Severity:** P3 (memory hygiene; not a code issue).
**Resolution path in v1:** After Phase A, update the memory entry to current test count + new key files added since (manuscript-geometry.js when it lands, etc.).
**Stop gate:** Do NOT update memory mid-phase. Update once, after Phase G lock, with the final test count.

---

## SP-12 — Flow `.rga-page` width / padding written by inline JS

**Where:** `renderer/js/editor/page-surface.js:32-44` writes inline `style.width / minHeight / padding*` to the live `.rga-page`. `renderer/css/editor-prosemirror.css:828-839` provides fallback values; `:74-82` (`#editor-container.view-flow .rga-page`) overrides with `!important`.
**Symptom:** Geometry is split across inline JS + CSS fallback + per-view !important override. Three sources for "page width" (with `--page-width` token as a 4th implicit source for `.rga-shell-toolbar-inner`).
**Severity:** P3 (works correctly today; architectural smell, not a defect).
**Resolution path in v1:** **DOCUMENT, do not refactor.** Phase B's ManuscriptGeometry module reads the same inputs as PageSurface but writes nothing. Future v2 may centralize the writer side.
**Stop gate:** No agent may consolidate these three writers in v1 without explicit authorization. Per "no shell redesign / no toolbar changes" rule, touching `.rga-shell-toolbar-inner`'s `--page-width` consumption is forbidden.

---

## SP-13 — Sample fixture path mismatch

**Where:** Memory `project_ide_script_framework_locked.md` references "sample at tests/fixtures/sample-the-last-light.rga"; current repo has `rwanga-editor/tests/fixtures/playground-the-last-light.rga` (modified — see `git status`).
**Symptom:** Memory + reality drift on fixture path. Phase B/C tests need to reference the correct file.
**Severity:** P3 (test-author convenience).
**Resolution path in v1:** Before Phase C writes any test, verify fixture path with `Get-ChildItem rwanga-editor/tests/fixtures/*.rga`. Update memory if needed.
**Stop gate:** No agent may rename or move fixture files without authorization.

---

## SP-14 — nav-index plugin perf at 120+ pages unverified

**Where:** `renderer/js/framework/nav-index.js:457-460` — `apply` hook recomputes the full pipeline (Normalizer + LayoutProfile + PageMap + Decorations) on every `tr.docChanged`.
**Symptom:** PageMap math is pure and fast, but the Normalizer walks the entire doc on every transaction. For a 120-page screenplay (~3,500 blocks) the cost is unmeasured. Burst typing → burst pagination.
**Severity:** P2 (unknown; may be a non-issue).
**Resolution path in v1:** Phase C must measure. Open `playground-the-last-light.rga` (or a synthetic large fixture), type into it, capture per-`apply` timing. If >50ms, debounce the decoration emission (not the math). Do not optimize prematurely.
**Stop gate:** If measurement shows perf issue, STOP and present numbers + proposed debouncer; do not silently optimize.

---

## SP-15 — View menu lacks "Print Preview" radio entry

**Where:** `electron/menu.js:51-75`. View menu has Flow / Draft / Print radios only.
**Symptom:** macOS users (whose native menu is authoritative) cannot reach Print Preview from the View menu at all.
**Severity:** P2 (cross-platform discoverability gap).
**Resolution path in v1:** Phase D.1 — add View menu entry for Print Preview (NOT as a radio because Print Preview is modal — it overlays Flow/Draft/Print; pressing Esc returns to the prior view). Likely a regular menu item under View → "Print Preview" with no accelerator.
**Stop gate:** Phase D.1 must update BOTH `electron/menu.js` AND the renderer-owned menubar (Windows/Linux). Both surfaces must show the entry. Verify on both platforms.

---

## SP-16 — `--page-width` has TWO consumers

**Where:** `renderer/css/tokens.css:98` — `--page-width: 8.5in`. Consumed by `.rga-page` (the writing surface) AND `.rga-shell-toolbar-inner` (Row-3 toolbar's centered band).
**Symptom:** None today. Documented because changing paper size at the token level would change the toolbar visual alignment.
**Severity:** INFO (locked by handoff memory at `project_session_handoff_2026-05-18.md:94` — "Manuscript geometry LOCKED").
**Resolution path in v1:** **DO NOT CHANGE.** Per "no toolbar changes" rule. ManuscriptGeometry reads from `doc.settings.pageSetup.paperSize` (Letter/A4/Legal); the `--page-width` token remains 8.5in for the Flow visual + toolbar alignment regardless. Mismatch between doc paper size and `--page-width` is acceptable in v1 — Flow's column reads as 8.5in even for an A4 document; Print Preview shows the actual A4 sheet.
**Stop gate:** If any agent proposes "make `--page-width` track `doc.settings.pageSetup.paperSize`," STOP — that touches the toolbar inner-band alignment which is locked. Comes back through brainstorming.

---

## SP-17 — Ctrl+Shift+P is RESERVED for Command Palette

**Where:** Binding decision per user correction B (this session).
**Symptom:** N/A — declarative binding rule.
**Severity:** INFO (binding rule).
**Resolution path in v1:** **No new keybinding on Ctrl+Shift+P.** All Phase D execution must check `keyboard-registry.js` for collisions and choose alternatives. Print Preview ships without a default accelerator.
**Stop gate:** Any agent proposing Ctrl+Shift+P for ANY new feature must STOP and present the proposal; reserved for Command Palette.

---

## SP-18 — `Rga.PageMap.build` V1 cannot split blocks

**Where:** `renderer/js/framework/pagemap-engine.js:168-178`. If a single block (or keep-with-next chain) exceeds `linesPerPage`, V1 places it on an "overlong page" as the only safety net. Comment: "Production V2 will split here."
**Symptom:** Pathological inputs (a 600-character action block at default cpl 60 = 10 lines — fine; but a single action block longer than `linesPerPage` = 54 at Hollywood Letter = ~3,200 characters → overlong page).
**Severity:** INFO (locked V1 contract; the engine acknowledges this in the directive rule 6 comment).
**Resolution path in v1:** **NO CHANGE.** V1 contract holds. V2 may introduce splittable blocks (dialogue + action especially). Out of v1 scope.
**Stop gate:** Any agent proposing splittable blocks in v1 must STOP — this would invalidate the V1 contract, the existing PageMap fixtures, and the cross-view pagination identity gate (§10.1). Comes back through brainstorming.

---

## Closure protocol

This register is consulted **before each phase opens**:
1. Filter the index by phase → list of entries this phase must resolve or explicitly defer.
2. Phase plan addresses each entry explicitly.
3. Phase completion report cites the entry by ID + evidence (test name, smoke step, git diff).
4. Closed entries marked "RESOLVED in `<phase>` at `<sha>`" in this file.
5. New stop-points discovered during execution: append here; do NOT add silently.

The register is the contract between this plan and execution. If an executing agent finds reality differs from this register, the agent STOPS and reports.
