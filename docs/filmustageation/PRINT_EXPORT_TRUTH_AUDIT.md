# Rwanga — Print / Export Truth Audit

> **Audit only. No implementation, no schema changes, no commit.**
> Created: 2026-05-29 · HEAD: `24b84060` (origin/main in sync).
> Inspected: `renderer/js/framework/{pagemap-engine,print-renderer,print-preview,manuscript-geometry,layout-profile,render-model,document-outline}.js`, `renderer/js/editor/{page-setup-dialog,page-setup-preview,page-surface,paper-view}.js`, `renderer/js/shell/{settings-registry,settings-layout,shell-applicators}.js`, `renderer/js/doc-types/screenplay/schema-v3.js` (`titleStrip` node), `electron/preload.js` (`rwanga.export.toPDF` IPC), `electron/menu.js` (`Export to PDF…` + `Print Preview` items), `renderer/css/editor-prosemirror.css` (`.rga-title-strip`).

This audit asks one question: **can the Rwanga editor produce a professional, director-ready script artifact right now, and if not, what stops it?** Findings ranked by who they hurt — the writer trying to hand off pages.

---

## 1. What works today

| Surface | State | Where it lives |
|---|---|---|
| **PageMap engine** | **Real, deterministic, NEVER measures DOM.** Conservative V1 packer: scene-heading / action / dialogue are not splittable; if a block doesn't fit, the whole block (plus its keep-with-next chain) moves to the next page. Character-count-per-line (`cpl`) drives line counts. Keep-with-next chains: `sceneHeading → next block`; `character → dialogue/parenthetical → dialogue`. | `framework/pagemap-engine.js` |
| **LayoutProfile / ManuscriptGeometry** | **Real.** Resolves per-block specs (cpl, leading blank lines, splittable flag, keepWithNext) from the screenplay profile + the doc's `settings.pageSetup`. Single composition resolver (Recovery Step 5: `Rga.ManuscriptGeometry.resolveFrom`). | `framework/layout-profile.js`, `framework/manuscript-geometry.js` |
| **PrintPreview controller** | **Real.** Registered with `ViewManager` as view id `printPreview` (body class `view-print-preview-active`). `show()` / `hide()` / `refresh()` / `isActive()` / `open()` / `setOptions()` / `getOptions()` public API. Esc-to-exit registered via the keyboard registry's last-wins discipline. The previous view (Flow / Draft) is restored on close. | `framework/print-preview.js` |
| **PrintRenderer** | **Real, paper-correct.** Emits one `<div class="rga-page-sheet">` per PageMap page — never one tall fake page. Sheet dimensions written inline from `layoutProfile.pageSize` (so Letter / A4 / Legal each get correct width/height). Padding from `layoutProfile.margins`. Page numbers positioned inline from margins. RTL: `dir="rtl"` carried onto each sheet; left/right padding swapped; page number sits on the binding side. Optional `footerStyle` / `headerStyle` (off by default). | `framework/print-renderer.js` |
| **Paper view (Flow surface for paper feel)** | **Real.** Separate `paper-view.js` lets the writer compose against a paper-edged page in Flow without switching to Print Preview. | `framework/paper-view.js` |
| **Page setup modal (Ctrl+Shift+G)** | **Real, but flagged for deletion** (comments at top of `page-setup-dialog.js`). Writes through `Rga.Settings.Store.set('pageSetup.paperSize', ...)` → routes to `script` tier → mirrors into `doc.settings.pageSetup`. LayoutProfile + manuscript-geometry read the mirrored shape. The replacement is the Settings UI (Stages 2/3 deletion tracked elsewhere). | `editor/page-setup-dialog.js` |
| **Margins / paper size persistence in `.rga`** | **Real.** `doc.settings.pageSetup = { paperSize, margins:{top,right,bottom,left} }` round-trips through `Rga.Doc.serialize` / `deserialize` (doc.js). Survives reload. | `renderer/js/doc.js` (defaults at `defaultSettings`) |
| **RTL pagination + render** | **Real (Flow + Print Preview).** LayoutProfile carries `direction`. PrintRenderer mirrors padding L↔R; page number to the binding side. Flow profiles already calibrated (`rtl-profile-calibration.js`, `rtl-font-chain.js`). | `framework/print-renderer.js`, `framework/rtl-*.js` |
| **Scene numbering in print** | **Schema reserves `settings.show_scene_numbers`** (`doc.js:55`) + `exportSettings.include_scene_numbers` (`doc.js:75`). PrintRenderer composes the page sheet; whether it reads either flag is a finding for §3. | `doc.js`, `framework/print-renderer.js` |
| **`Print Preview` menu item** | **Real and wired.** File menu and View menu both expose it (`menu.js:42`, `:75`). Dispatches `view.printPreview` action via `sendMenuAction`. Renderer-side receiver presumed (PrintPreview's `open()` exists). | `electron/menu.js`, `framework/print-preview.js` |
| **Tests** | Substantial unit-test coverage for the pipeline: `nav-index*` (4 files), `page-break-stability`, `page-marker-geometry`, `pagemap-engine`, `pagemap-integration`, `paper-view`, `print-renderer`, `print-preview-integration`, `print-preview-phase-d`, `render-model`, `manuscript-geometry`, `manuscript-geometry-wiring`, `parenthetical-box-geometry`, `runtime-profile`, `rtl-font-chain`, `rtl-profile-calibration`. The pure pipeline (Normalizer → LayoutProfile → PageMap → RenderModel → PrintRenderer) is well-tested. | `tests/unit/framework/*.test.js` |

---

## 2. What is fake / incomplete

| Surface | State | Evidence |
|---|---|---|
| **PDF export pipeline** | **WIRED AT BOTH ENDS, NO MIDDLE.** Menu emits `file.exportPdf` with `Cmd/Ctrl+Shift+E` accelerator (`menu.js:44`). Preload exposes `window.rwanga.export.toPDF(content, options)` → IPC channel `export.toPDF` (`preload.js:35`). **But (a) NO main-process handler registers `ipcMain.handle('export.toPDF', ...)`**, and **(b) NO renderer code calls `window.rwanga.export.toPDF`**, and **(c) NO renderer code listens for the `file.exportPdf` menu action**. Pressing Ctrl+Shift+E or clicking "Export to PDF…" produces nothing — no save dialog, no toast, no PDF, no error message to the user. The pipe is a wireframe. | grep results above |
| **`export.pdf` command** | **Registered as a keybinding target but the command itself is never defined.** Settings has `kb.exportPdf` → command `export.pdf` (`shell-applicators.js:286`), but no `registerCommand('export.pdf', …)` exists in the renderer. Hitting the keyboard shortcut from Settings would silently no-op (or throw, depending on how Settings dispatches). | grep results above |
| **Title page** | **No real title page.** Schema has `titleStrip` (`schema-v3.js:49`), but it's **an inline block at the top of the document body**, NOT a dedicated cover sheet. Print Preview renders it as the first page's first block — no centered layout, no byline, no contact info, no separation. CSS rule at `editor-prosemirror.css:842` styles it for in-flow display only. Industry standard expects title page = page 0 with title centered ~1/3 down, byline below, contact bottom-left/right, then a true page break. **Rwanga has no concept of a "page 0" cover sheet.** | `schema-v3.js`, `editor-prosemirror.css` |
| **Native browser print (`window.print()`)** | **Not used anywhere in code.** A writer cannot Cmd+P from inside the app to get a print/PDF dialog — there's no `window.print()` call, no Print menu binding to it, no print-stylesheet override (`@media print` rules). The Electron host's Cmd+P could land at the OS print dialog, but the renderer hasn't tuned `@media print` styles, so the result would be the editor's screen DOM, not the Print Preview's page sheets. | grep returned 0 hits for `window.print|@media print` outside docs |
| **Page-setup dialog** | **Real but deprecated.** Comments at top of `page-setup-dialog.js` say Stages 2/3 are tracked in `SETTINGS_RECOVERY_EXECUTION_PLAN.md` (replacement: Settings UI). Until the deletion lands, two surfaces own the same data ([modal + Settings UI]), which is a confusion risk for the writer. | `editor/page-setup-dialog.js` header |
| **Scene-number / revision-mark inclusion in print** | **Reserved fields, real consumers unclear.** `doc.settings.show_scene_numbers` and `doc.exportSettings.{include_scene_numbers, include_revision_marks}` are persisted but the audit could not confirm PrintRenderer reads either to gate the rendering. Worth a focused follow-up read. | `doc.js`, comments only |
| **`flagLog`** | **Persisted in `.rga`, downstream consumers unverified.** Per the prior `.rga` Memory Truth Audit, `addFlagLogEntry` is the only writer; whether export pipelines read it is unclear. | `.rga` audit §3 |
| **PageMap measurement model** | **Conservative-V1 character-based.** Lines = `max(1, ceil(text.length / cpl))`. Real screenplay typography has wider characters in caps (sceneHeading, character cues), proportional kerning at scale, and Unicode width quirks (RTL ligatures, Arabic shaping). The pagination is *honest* — it never claims to measure DOM — but it can miscount lines for non-Latin scripts and edge-case character runs. The renderer's actual sheet layout uses CSS, not the line count, so a small mismatch between PageMap's predicted line count and the rendered sheet's actual flow is possible. | `pagemap-engine.js:80–91` |

---

## 3. What breaks director-ready handoff

A "director-ready" artifact is a PDF with industry-standard title page, Courier 12pt, correct margins, correct page numbering, scene numbers in the gutter (if enabled), MORE / CONT'D continuation for dialogue split across pages, and locked pagination that matches the writer's preview.

Ranked from most-blocking to least-blocking for handoff today:

### 3.1 BLOCKER — PDF export does nothing

Without an actual PDF artifact, there is no handoff. A director cannot read the writer's `.rga` file. Today the menu item exists but the click is a no-op. **This is the single largest production gap in the build.**

### 3.2 BLOCKER — No title page

Every professional script artifact starts with a title page. Rwanga doesn't have one — `titleStrip` is an in-flow block, not a cover sheet. A handed-off PDF without title page reads as a draft / sample, not a deliverable.

### 3.3 HIGH — Dialogue continuation (MORE / CONT'D) not enforced

PageMap's keep-with-next chains atomically move character + dialogue chains to the next page if they don't fit — which prevents widow/orphan splits within a dialogue beat. But it does NOT emit the industry "MORE" (bottom of page 1) / "CONT'D" (top of page 2) overlay marks that signal "this dialogue continued from the previous page." This is a known industry convention; a director seeing dialogue start mid-page without "CONT'D" reads it as a discontinuity.

### 3.4 MEDIUM — Scene-number gutter rendering unverified

`doc.settings.show_scene_numbers` is persisted; whether PrintRenderer reads it and emits left + right gutter numbers (industry: scene numbers appear on BOTH the left and right of each scene heading) is unclear. Even if the flag is read, dual-gutter rendering is a separate piece of output formatting.

### 3.5 MEDIUM — Revision-mark gutter rendering

`doc.exportSettings.include_revision_marks` is persisted. Industry: revision marks appear as `*` in the right gutter of any line that changed since the last revision color (blue draft / pink draft / etc.). PrintRenderer support unverified.

### 3.6 MEDIUM — No locked / production scene numbering

Memory `project_production_scene_numbering_deferred` already names this. Production numbering (`A1`, `12A`, `OMITTED` markers, writing-lock mode) is a first-class industry feature for shoot drafts. Not in build today; blocks any post-greenlight handoff.

### 3.7 LOW — Print stylesheet missing

Even if the Cmd+P / OS print path were exposed, `@media print` rules don't strip the editor chrome — the writer would print the rendered editor DOM with toolbar, sidebar, etc. PrintPreview's sheet rendering is the right pipeline; native print needs a separate `@media print` discipline.

### 3.8 LOW — Title page convention may differ by language

For RTL scripts (Arabic, Kurdish), the title-page layout convention may mirror — title still centered, but byline/contact placement reflects right-to-left binding. Today this is a 0% concern (no title page at all); a future title-page slice should honour the existing LayoutProfile `direction` field consistently.

---

## 4. What blocks PDF export

Three breakages in one trench:

1. **Main-process IPC handler is missing.** `electron/preload.js:35` declares `toPDF: (content, options) => ipcRenderer.invoke('export.toPDF', content, options)`. No `ipcMain.handle('export.toPDF', …)` exists in `electron/main.js` or anywhere else in the main process. The invoke would reject (no handler) — silently from the writer's perspective if the renderer doesn't `.catch`.
2. **Renderer never calls `window.rwanga.export.toPDF`.** Grep returned **zero** matches across `renderer/js/**`. Even if the main handler existed, the renderer would never invoke it.
3. **Renderer doesn't handle the `file.exportPdf` menu action.** `electron/menu.js:44` dispatches it via `sendMenuAction(mainWindow, 'file.exportPdf')`. The renderer's preload listener (`preload.js:92`) emits `menu.action` events, but no `renderer/js/**` file subscribes for that specific action.

**Together**: clicking "Export to PDF…" or pressing Cmd+Shift+E does nothing observable. The pipe is wireframe.

---

## 5. What blocks print

1. **Same as PDF export, via the same dead pipe.** No `window.print()` call anywhere. No `@media print` rules. The user cannot invoke print from inside the app.
2. **Native OS print (host Cmd+P)** would print the editor DOM with shell chrome, not the PrintPreview's page sheets. To make native print work, either:
   - `@media print` rules need to hide shell chrome and apply `.rga-page-sheet` layout to the editor DOM, OR
   - The print path needs to render the PrintRenderer's sheets first, then trigger `window.print()` against that subtree.
3. **No "Print" menu item that actually prints.** `electron/menu.js:71` has `View > Print` as a *radio* (view-mode toggle), not a print-the-document action. Writers would expect a `File > Print…` with `Cmd+P`. It doesn't exist.

---

## 6. What blocks reliable page preview

Print Preview itself **works** and is well-tested. Blockers are at the edges:

1. **PageMap's character-based line count can differ from rendered CSS flow.** The renderer paints sheets via CSS, not by counting lines back from PageMap. For Latin screenplays at standard Hollywood profile this matches well (the profile was calibrated against real measurements — see `tests/unit/framework/page-break-stability.test.js`). For RTL scripts, multi-byte glyphs, or font-substitution scenarios, small drift can accumulate. The writer sees correctly-laid-out pages but the PageMap's `pages.length` may not exactly equal the rendered sheet count in edge cases.
2. **Refresh on doc change** — PrintPreview has `refresh()` (P7 Step 8). Whether every doc-changing transaction debounce-refreshes the preview when it's open is a stability concern that the audit did not exhaustively verify. If the preview goes stale during editing while open, the writer's "what I see in preview = what I'll print" promise weakens.
3. **`titleStrip` rendering inside the body** mis-frames page 1 — the title strip content steals the top of page 1 instead of becoming a dedicated cover sheet. The page count is off by one from industry expectation.
4. **`@page` CSS rules** for print stylesheets aren't authored. Even if the writer chooses "Save as PDF" from the OS print dialog after activating Print Preview, the cropped result depends on what the OS sees as the print viewport — which currently is the editor surface, not the Print Preview sheets.

---

## 7. Recommended next implementation bundle

### **Print-Bundle-1 — wire the dead PDF / print pipe**

Three small slices grouped because they share scope, all touch the dead-pipe surface, and together produce a writer-visible PDF artifact.

#### 7.1 PB1.A — Main-process PDF handler

Register `ipcMain.handle('export.toPDF', async (event, content, options) => { … })` in `electron/main.js` that:
- Accepts content/options from the renderer.
- Opens a save dialog (existing `Rga.File` save flow in main).
- Invokes `BrowserWindow.webContents.printToPDF(options)` against either the full window or a hidden child window pre-loaded with the PrintRenderer output.
- Writes the resulting `Buffer` to the chosen path; resolves with the path (or rejects with a structured error).

Risk: medium. Electron's `printToPDF` is mature but takes specific page-size / margin / scale options that must match `layoutProfile.pageSize` / `layoutProfile.margins`. Mismatch → wrong-sized output.

#### 7.2 PB1.B — Renderer-side export caller

Add a single small module (e.g. `renderer/js/export/pdf-export.js`) that:
- Listens for `menu.action: file.exportPdf` (via the existing preload `menu.subscribe` API at `preload.js:78-93`).
- On trigger: activates Print Preview (so PageMap is fresh + sheets are laid out), then invokes `window.rwanga.export.toPDF(content, options)` with content = `document.getElementById('rga-print-preview-root').innerHTML` (or, cleaner: passes the path-to-renderer-side print-sheet HTML for the main process to render in a hidden window).
- Registers the `export.pdf` command in the keyboard registry so `kb.exportPdf` actually fires.

Risk: low. The pipeline is a thin glue layer over existing surfaces.

#### 7.3 PB1.C — Page-number / margin parity with `printToPDF`

`webContents.printToPDF(options)` accepts `pageSize`, `margins`, `printBackground`, `landscape`. PB1.A must pass these from `layoutProfile.pageSize` and `layoutProfile.margins` so the PDF matches Print Preview pixel-for-pixel. This is a small but essential parity slice — without it, the PDF will have wrong margins / wrong paper size relative to what the writer saw.

Risk: low. Direct mapping.

### What PB1 does NOT do

- Does NOT add a title page (separate slice — call it `PB1.D` if bundled, or a follow-up).
- Does NOT add MORE / CONT'D dialogue overlays (separate slice — needs a small PageMap extension hook).
- Does NOT add `@media print` rules for native Cmd+P (separate slice).
- Does NOT remove the deprecated `page-setup-dialog.js` (separate Settings-arc cleanup).
- Does NOT add production scene-numbering, locked mode, or `OMITTED` markers (deferred per `project_production_scene_numbering_deferred`).
- Does NOT touch AI, Timeline, Inspector, or sidebar work.

### Why this bundle is the right next step

- **It converts a dead pipe into a working one.** The current state — menu items that silently do nothing — is the worst kind of half-shipped feature: the writer believes the function exists, the QA matrix shows it ticked, but the artifact never appears. Wiring the handler closes this honesty gap.
- **The pipeline below it is sound.** PageMap, PrintPreview, PrintRenderer, ManuscriptGeometry, RTL handling — all real, all tested. The PDF pipe only needs to hook into existing PrintRenderer output.
- **No schema change, no migration, no `.rga` format bump.** PB1 lives entirely in the runtime pipeline + the Electron IPC layer.
- **Unblocks the deferred title-page slice and the MORE / CONT'D slice.** Both are visible only via PDF / print — they have no preview-only value. Until a PDF actually exists, those slices have nothing to validate against.
- **Honours all binding moratoria.** No nav-index change. No contamination-triad touch. No new top-level `.rga` field.

---

# Closing

## Biggest blocker

**PDF export is a dead pipe.** Menu wired, accelerator wired, preload bridge wired, *zero* connectors between them and no main-process handler. Clicking "Export to PDF…" or pressing Cmd+Shift+E produces nothing observable. This breaks director handoff for every writer who reaches the export step. Everything else — title page, MORE/CONT'D, scene-number gutters, revision marks — is downstream of having a working PDF artifact.

## Safest implementation bundle

**Print-Bundle-1** — three thin glue slices (main-process IPC handler, renderer-side export caller, page-size/margin parity with `printToPDF`) that convert the existing well-tested PageMap → PrintPreview → PrintRenderer pipeline into a writer-invokable PDF artifact. No schema change, no migration, no new file format. Bundles cleanly into one commit + Playwright + unit coverage. Risk: low-medium (Electron `printToPDF` is mature; failure mode is wrong-sized output, fixable by parity testing). Closes the single largest production-readiness gap in the current build.

## STOP

Audit + recommendation only. No code edited, no schema changed, no commit created. The next decision — whether to authorise `Print-Bundle-1` as the next slice, defer for a different priority, or split it into 1A/1B/1C separate authorised steps — belongs to the user.
