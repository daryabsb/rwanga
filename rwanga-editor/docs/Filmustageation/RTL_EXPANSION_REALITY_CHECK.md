# RTL Expansion Reality Check

> **Why the screenshot and the fix report disagree.**
> Investigation of the running application — live DOM evidence, computed-style evidence, screenshots.
> Date: 2026-06-02 · Investigator: Claude (Opus 4.8) · Status: **INVESTIGATION ONLY — nothing patched, nothing committed.**

---

## Verdict (one paragraph)

The committed fix (`f421b906`) **works in the running application** — proven by launching the app from
HEAD, opening the real `mysterious-guest-rtl.rga` through the real file pipeline, and capturing live DOM:
the navigator receives `dir="rtl"`, the grid mirrors, the chevron renders on the inline-start side, and
expansion renders "Note attached" indented from the right. The screenshot disagrees for **two stacked
reasons**: **(1)** the screenshotted app instance was running **pre-fix code** — the screenshot was taken at
20:21, the fix landed at 17:40, and Electron only loads renderer JS/CSS at launch, so an instance opened
before the fix keeps the old code until it is fully relaunched; **(2)** independently, this screenplay has
**zero scenes with notes or revision flags (0 of 47)**, and the chevron is a disclosure control that exists
*only* on marked scenes (the original Marks-Expansion-v1 design: "no empty expansions") — so even the fixed
app shows no chevrons for this document until a scene gets a mark. A third, smaller discovery: after adding
a note, the chevron appears on the *next* navigator re-render (any cursor movement), not instantly — a
pre-existing, direction-agnostic trigger gap, noted below but **not fixed** (out of scope for this check).

---

## 0. Environment under test

| Item | Value |
|---|---|
| Branch / worktree | `main`, single worktree `E:/api/rwanga` |
| HEAD | `f421b906f7b02dd1e48aa4f2aeb7eda65ad19077` — `fix(editor): Support RTL scene navigator expansion` |
| Fix commit authored | **2026-06-02 17:40:46 +0300** |
| User's screenshot file time | **2026-06-02 20:21** (`Screenshot 2026-06-02 202146.png`) — 2h41m *after* the fix landed |
| Working tree | Clean for both changed files (`renderer/js/shell/panels/scene-navigator.js`, `renderer/css/shell.css` match HEAD) |
| How the app runs | `npm start` → `electron .` from this repo. **No packaged build exists** (no `dist/`, no installed copy in Programs, no shortcuts) |
| How the changed files load | Direct, unbundled: `<script src="js/shell/panels/scene-navigator.js">` (index.html:673), `<link href="css/shell.css">` (index.html:15). `build-renderer.js` does not touch either. **Disk = runtime, at launch time.** |
| Document under test | `tests/fixtures/mysterious-guest-rtl.rga` — 47 scenes, `metadata.screenplayProfile = {"language":"ku","direction":"rtl","screenplayConvention":"hollywood"}`. The screenshot shows "SCENES · 47" with the same title — same document. |

---

## 1. Is the shipped code actually running?

**In a freshly launched instance: YES. In the instance the screenshot was taken from: NO.**

### Proof the fixed code runs when the app is launched from current disk state

Runtime marker: the pre-fix navigator **never** sets a `dir` attribute on its wrapper; the fixed code
**always** sets one (`"ltr"` or `"rtl"`) on every render path, including the empty state. Captured from a
fresh launch, *before any document was opened*:

```json
PRE_OPEN = {
  "sidebarCurrent": "sceneNavigator",
  "wrapperExists": true,
  "wrapperHasDirAttr": true,     ← pre-fix code can never produce this
  "wrapperDirAttr": "ltr"
}
```

### Proof the screenshotted instance was NOT running the fixed code

Proof by elimination — the two cannot coexist:

| | User's screenshot (20:21) | Fresh launch from HEAD, same document |
|---|---|---|
| Scene numbers | **LEFT** side of rows | **RIGHT** side of rows (28px from right edge) |
| Page badges (p.N) | **RIGHT** side of rows | **LEFT** side of rows (10px from left edge) |
| Layout verdict | LTR grid | **RTL grid (mirrored)** |

The fixed code sets `dir` on **every** render (the navigator re-renders on every ScriptSession tick), and
this document's profile is unambiguously `direction: "rtl"`. With HEAD code there is **no code path** that
renders this document with an LTR grid. Therefore the renderer that produced the screenshot was executing
pre-fix `scene-navigator.js`.

**Mechanism:** Electron loads renderer JS/CSS from disk once, at window creation. An app window opened
before ~17:40 keeps the old code in memory indefinitely — committing files to disk changes nothing inside
an already-running window. The instance must be **fully closed and relaunched** (`npm start`).

---

## 2. Is the navigator receiving `dir="rtl"`?

**YES** — in the running app (fresh launch), with the real RTL document opened through the real pipeline
(`Rga.FileManager.openFromContent` → `Doc.deserialize` → `TabManager.openDocument`):

```json
EVIDENCE = {
  "querySelector('.rga-shell-scene-navigator')?.dir":  "rtl",
  "getAttribute('dir')":                               "rtl",
  "getComputedStyle(...).direction":                   "rtl",

  "activeDoc.metadata.screenplayProfile": {
    "language": "ku", "direction": "rtl", "screenplayConvention": "hollywood"
  },
  "editor #editor dir attribute": "rtl",

  "gridOrientation": {
    "numOffsetFromRowLeft": 225,  "numOffsetFromRowRight": 28,
    "pageOffsetFromRowLeft": 10,  "pageOffsetFromRowRight": 219,
    "verdict": "NUMBER ON RIGHT (RTL layout)"
  }
}
```

Both expressions the mission asked for return **"rtl"**. The document model holds the profile, the editor
mirrors, and the navigator mirrors.

---

## 3. Is the chevron being rendered?

**Initially NO — correctly.** This is the second half of the disagreement:

```json
"rowCount": 47,
"chevronCount": 0,
"navIndexSceneCount": 47,
"scenesWithNotes": 0,           ← zero scenes have a note
"scenesWithRevisionFlags": 0    ← zero scenes have a revision flag
```

The chevron is **not** a per-row UI element. It is a disclosure control for scene **marks** and renders
*only* when `scene.hasNotes || scene.hasRevisionFlag` (Marks-Expansion-v1 design, unchanged since the
feature shipped: *"Chevron appears only when the scene has a mark — no empty expansions"*).
`mysterious-guest-rtl.rga` contains **no notes and no revision flags in any of its 47 scenes**, so **zero
chevrons is the designed, correct rendering for this document — in RTL and in LTR alike.** The user's
screenshot also shows zero note/flag indicator icons on every row, consistent with the same fact.

**After a scene gets a real mark** (note attached via the app's own notes mechanism, `Rga.SceneNotes.set`,
which persists into `scene.attrs.notes` in the document):

```json
"chevron": {
  "opacity": "0.55", "display": "flex", "visibility": "visible",
  "width": 12, "height": 14,
  "ariaExpanded": "false", "offScreen": false
},
"placement": {
  "rowSceneNumber": "1",
  "chevronOffsetFromRowRight": 6,    ← 6px from the row's RIGHT edge (inline-start in RTL)
  "chevronOffsetFromRowLeft": 241,
  "overlapsHeading": false           ← does NOT overlap the heading column
}
```

Not hidden, not transparent, not zero-sized, not off-screen, not overlapping — rendered exactly where the
fix places it.

---

## 4. Why does the screenshot show no chevrons?

What the running application is doing, with evidence for each link in the chain:

1. **The screenshotted instance executes pre-fix code** (§1). Its navigator is an LTR grid; the fixed
   navigator is an RTL grid for this document. → Even the *layout* half of the fix is absent in the
   screenshot.

2. **The document has no marked scenes** (§3). 0/47 notes, 0/47 revision flags. → No chevrons exist to
   show, in either code version, in either direction. The expansion affordance the user is looking for
   appears only after a scene gets a note or a revision flag.

3. **Secondary discovery (pre-existing, direction-agnostic, NOT fixed in this check):** when a note is
   created, the navigator does not re-render immediately. The note lands in the document
   (`scene.attrs.notes` ✅) and the nav-index flag flips (`hasNotes: true` ✅), but the navigator redraws
   only on its existing triggers (ScriptSession tick — i.e. any cursor movement in the editor, view change,
   filter change). Measured:

   ```json
   CHAIN = {
     "pm scene.attrs.notes": "Reality-check note — attached via Rga.SceneNotes.set",
     "SceneNotes.get(scene-001)": "Reality-check note — attached via Rga.SceneNotes.set",
     "nav-index scene.hasNotes": true,
     ...but chevronCount in the DOM: 0
   }
   RERENDER_TEST = {
     "chevronsBeforeCursorMove": 0,
     "chevronsAfterCursorMove": 1    ← one cursor move later, the chevron is there
   }
   ```

   In real writing this is invisible (the writer's next click/keystroke triggers it), but it is a genuine
   trigger gap that exists in LTR too. Flagged for a future slice; per the Stop rule, nothing was changed.

---

## 5. Reproduction of the screenshot scenario (real RTL screenplay, real pipeline)

Workflow: launch app → open `mysterious-guest-rtl.rga` (47 scenes, Kurdish, RTL profile) → Scene Navigator
visible → attach a note to scene 1 via `Rga.SceneNotes` → cursor move → click the chevron.

**Result: the expansion affordance is visible and works.**

```json
EXPANSION = {
  "marksZoneRendered": true,
  "markLines": ["Note attached"],
  "ariaExpanded": "true",
  "marksPaddingLeft": "0px",
  "marksPaddingRight": "34px"      ← indented from the RIGHT (inline-start in RTL)
}
```

### Screenshots (artifacts in `test-results/rtl-reality-check/`, gitignored)

| File | Shows |
|---|---|
| `navigator-real-rtl-fixture.png` | The fixed navigator with the real RTL doc: header/count on the right, numbers on the right, page badges on the left — the mirror of the user's screenshot |
| `navigator-with-note-chevron.png` | Row 1 carrying a left-pointing chevron at the row's right edge + note indicator |
| `navigator-expanded.png` | Row 1 expanded: chevron rotated, **"Note attached"** line beneath the row, indented from the right |
| `full-window.png` | Whole app window for context (editor also `dir="rtl"`) |

---

## 6. What the user needs to do to see the fix

1. **Fully close the running Rwanga window** (not minimize — quit).
2. Relaunch: `npm start` (from `rwanga-editor/`).
3. Open the RTL screenplay.
4. The navigator now mirrors: scene numbers on the right, page badges on the left, find-placeholder
   right-aligned.
5. To see a chevron: give any scene a **note** or a **revision flag** (the chevron is the disclosure for
   marks and only exists on marked scenes — same rule as LTR). It appears at the row's right edge, points
   left when collapsed, and expanding reveals "Note attached" / "Revision flagged".

---

## 7. Open items surfaced by this check (NOT acted on)

| # | Item | Scope |
|---|---|---|
| 1 | Navigator does not re-render immediately when a note/flag is created — chevron appears on the next cursor move / tick. Pre-existing, affects LTR equally. | Future slice (needs authorization) |
| 2 | If "every scene row should show an expansion affordance regardless of marks" is the desired design, that is a **design change** to Marks-Expansion-v1, not a bug — needs a design decision first. | Design decision |

---

## 8. Reproducibility

The probe that produced every value above was a temporary Playwright/Electron spec (read-only observation;
deleted after this report — full source below). Run it by saving as
`tests/e2e/filmustageation/__rtl-reality-check-probe.spec.js` and:

```
npx playwright test --config=tests/integration/playwright.config.js __rtl-reality-check-probe
```

<details>
<summary>Probe source (click to expand)</summary>

```js
// TEMPORARY INVESTIGATION PROBE — RTL Expansion Reality Check.
'use strict';

const { test, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE = path.resolve(APP_ROOT, 'tests', 'fixtures', 'mysterious-guest-rtl.rga');
const ART_DIR = path.resolve(APP_ROOT, 'test-results', 'rtl-reality-check');

test('REALITY CHECK — open real RTL fixture in the running app, capture live evidence', async () => {
  test.setTimeout(120000);
  fs.mkdirSync(ART_DIR, { recursive: true });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtl-reality-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga && window.Rga.Shell && window.Rga.Shell.Sidebar
    && window.Rga.Shell.SceneNavigator && window.Rga.FileManager && window.Rga.TabManager && window.Rga.Nav));

  // Q1 — runtime-code marker (pre-fix code never sets a dir attribute).
  const preOpen = await page.evaluate(() => {
    const w = document.querySelector('.rga-shell-scene-navigator');
    return {
      sidebarCurrent: window.Rga.Shell.Sidebar.current(),
      wrapperExists: !!w,
      wrapperHasDirAttr: w ? w.hasAttribute('dir') : null,
      wrapperDirAttr: w ? w.getAttribute('dir') : null
    };
  });
  console.log('PRE_OPEN=' + JSON.stringify(preOpen, null, 2));

  // Q5 — open the REAL fixture through the REAL pipeline.
  const content = fs.readFileSync(FIXTURE, 'utf8');
  await page.evaluate((args) => {
    window.Rga.FileManager.openFromContent(args.handle, args.content);
  }, { handle: 'mysterious-guest-rtl.rga', content: content });

  await page.waitForSelector('.rga-shell-scene-navigator-row', { timeout: 15000 });
  await page.waitForTimeout(800);

  // Q2 + Q3 + Q4 — live DOM, computed styles, doc model, nav-index.
  const evidence = await page.evaluate(() => {
    const nav = document.querySelector('.rga-shell-scene-navigator');
    const cs = (el, p) => (el ? getComputedStyle(el, p || null) : null);
    const doc = window.Rga.TabManager.activeDoc();
    const view = (typeof window.Rga.TabManager._editorView === 'function') ? window.Rga.TabManager._editorView() : null;
    const idx = (window.Rga.Nav && view && view.state) ? window.Rga.Nav.getIndex(view.state) : null;
    const scenes = (idx && Array.isArray(idx.scenes)) ? idx.scenes : [];
    const rows = Array.from(document.querySelectorAll('.rga-shell-scene-navigator-row'));
    const chevrons = Array.from(document.querySelectorAll('.rga-shell-scene-navigator-chevron'));
    const editorEl = document.getElementById('editor');

    let gridOrientation = null;
    if (rows.length) {
      const r = rows[0].getBoundingClientRect();
      const numEl = rows[0].querySelector('.rga-shell-scene-navigator-num');
      const pageEl = rows[0].querySelector('.rga-shell-scene-navigator-page');
      const nr = numEl ? numEl.getBoundingClientRect() : null;
      const pr = pageEl ? pageEl.getBoundingClientRect() : null;
      gridOrientation = {
        numOffsetFromRowLeft: nr ? Math.round(nr.left - r.left) : null,
        numOffsetFromRowRight: nr ? Math.round(r.right - nr.right) : null,
        pageOffsetFromRowLeft: pr ? Math.round(pr.left - r.left) : null,
        pageOffsetFromRowRight: pr ? Math.round(r.right - pr.right) : null,
        verdict: (nr && pr)
          ? ((nr.left - r.left) < (r.right - nr.right) ? 'NUMBER ON LEFT (LTR layout)' : 'NUMBER ON RIGHT (RTL layout)')
          : 'n/a'
      };
    }

    const chevronDetail = chevrons.map((c) => {
      const cr = c.getBoundingClientRect();
      const ccs = cs(c);
      return {
        rect: { left: Math.round(cr.left), top: Math.round(cr.top), width: Math.round(cr.width), height: Math.round(cr.height) },
        opacity: ccs.opacity, display: ccs.display, visibility: ccs.visibility,
        ariaExpanded: c.getAttribute('aria-expanded'),
        offScreen: cr.right < 0 || cr.left > window.innerWidth || cr.bottom < 0 || cr.top > window.innerHeight
      };
    });

    return {
      'querySelector(.rga-shell-scene-navigator)?.dir': nav ? nav.dir : null,
      'getAttribute(dir)': nav ? nav.getAttribute('dir') : null,
      'getComputedStyle(...).direction': nav ? cs(nav).direction : null,
      activeDocExists: !!doc,
      activeDocMetadataKeys: (doc && doc.metadata) ? Object.keys(doc.metadata) : null,
      'activeDoc.metadata.screenplayProfile': (doc && doc.metadata) ? (doc.metadata.screenplayProfile || null) : null,
      'editor #editor dir attribute': editorEl ? editorEl.getAttribute('dir') : null,
      rowCount: rows.length,
      chevronCount: chevrons.length,
      chevronDetail: chevronDetail,
      navIndexSceneCount: scenes.length,
      scenesWithNotes: scenes.filter(function(s) { return !!s.hasNotes; }).length,
      scenesWithRevisionFlags: scenes.filter(function(s) { return !!s.hasRevisionFlag; }).length,
      first5SceneFlags: scenes.slice(0, 5).map(function(s) {
        return { sceneNumber: s.sceneNumber, hasNotes: !!s.hasNotes, hasRevisionFlag: !!s.hasRevisionFlag };
      }),
      gridOrientation: gridOrientation
    };
  });
  console.log('EVIDENCE=' + JSON.stringify(evidence, null, 2));

  try { await page.locator('#sidebar').screenshot({ path: path.join(ART_DIR, 'navigator-real-rtl-fixture.png') }); } catch (_) {}
  try { await page.screenshot({ path: path.join(ART_DIR, 'full-window.png') }); } catch (_) {}

  // Q5 phase 2 — attach a REAL note via the app's real notes mechanism.
  const afterNote = await page.evaluate(() => {
    const SN = window.Rga.SceneNotes;
    if (!SN || typeof SN.set !== 'function') return { sceneNotesApi: false };
    const view = window.Rga.TabManager._editorView();
    const idx = window.Rga.Nav.getIndex(view.state);
    const firstScene = idx.scenes[0];
    SN.set(firstScene.nodeId, 'Reality-check note — attached via Rga.SceneNotes.set');
    return { sceneNotesApi: true, usedNodeId: firstScene.nodeId, sceneNumber: firstScene.sceneNumber };
  });
  await page.waitForTimeout(800);

  // Chain forensics: where does SceneNotes.set → chevron break?
  const chain = await page.evaluate(() => {
    const view = window.Rga.TabManager._editorView();
    const SN = window.Rga.SceneNotes;
    let pmAttrsNotes = '(scene node not found)';
    let pmSceneAttrs = null;
    view.state.doc.descendants(function(node) {
      if (node.type && node.type.name === 'scene' && node.attrs && String(node.attrs.id) === 'scene-001') {
        pmAttrsNotes = node.attrs.notes;
        pmSceneAttrs = Object.keys(node.attrs);
        return false;
      }
      return true;
    });
    const snGet = (SN && typeof SN.get === 'function') ? SN.get('scene-001') : '(no get)';
    const idx = window.Rga.Nav.getIndex(view.state);
    const sc = idx.scenes.filter(function(s) { return s.nodeId === 'scene-001'; })[0] || null;
    return {
      pmSceneAttrKeys: pmSceneAttrs,
      'pm scene.attrs.notes': pmAttrsNotes,
      'SceneNotes.get(scene-001)': snGet,
      'nav-index scene.hasNotes': sc ? sc.hasNotes : '(scene not in index)',
      'nav-index scene.hasRevisionFlag': sc ? sc.hasRevisionFlag : null
    };
  });
  console.log('CHAIN=' + JSON.stringify(chain, null, 2));

  // Re-render trigger test — the writer's next cursor move.
  const rerenderTest = await page.evaluate(() => {
    const before = document.querySelectorAll('.rga-shell-scene-navigator-chevron').length;
    const view = window.Rga.TabManager._editorView();
    const PM = window.RgaProseMirror;
    const sel = PM.TextSelection.near(view.state.doc.resolve(2));
    view.dispatch(view.state.tr.setSelection(sel));
    return { chevronsBeforeCursorMove: before };
  });
  await page.waitForTimeout(600);
  const afterCursorMove = await page.evaluate(() => ({
    chevronsAfterCursorMove: document.querySelectorAll('.rga-shell-scene-navigator-chevron').length
  }));
  console.log('RERENDER_TEST=' + JSON.stringify(Object.assign(rerenderTest, afterCursorMove), null, 2));

  const postNote = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.rga-shell-scene-navigator-row'));
    const chevrons = Array.from(document.querySelectorAll('.rga-shell-scene-navigator-chevron'));
    const first = chevrons[0] || null;
    const cs = first ? getComputedStyle(first) : null;
    const cr = first ? first.getBoundingClientRect() : null;
    let placement = null;
    if (first) {
      const row = first.closest('.rga-shell-scene-navigator-row');
      const rr = row.getBoundingClientRect();
      const heading = row.querySelector('.rga-shell-scene-navigator-heading');
      const hr = heading ? heading.getBoundingClientRect() : null;
      placement = {
        rowSceneNumber: row.getAttribute('data-scene-number'),
        chevronOffsetFromRowRight: Math.round(rr.right - cr.right),
        chevronOffsetFromRowLeft: Math.round(cr.left - rr.left),
        overlapsHeading: hr ? !(cr.left >= hr.right || cr.right <= hr.left) : null
      };
    }
    return {
      rowCount: rows.length,
      chevronCount: chevrons.length,
      chevron: first ? {
        opacity: cs.opacity, display: cs.display, visibility: cs.visibility,
        width: Math.round(cr.width), height: Math.round(cr.height),
        ariaExpanded: first.getAttribute('aria-expanded'),
        offScreen: cr.right < 0 || cr.left > window.innerWidth
      } : null,
      placement: placement
    };
  });
  console.log('AFTER_NOTE=' + JSON.stringify({ afterNote: afterNote, postNote: postNote }, null, 2));
  try { await page.locator('#sidebar').screenshot({ path: path.join(ART_DIR, 'navigator-with-note-chevron.png') }); } catch (_) {}

  if (postNote.chevronCount > 0) {
    await page.locator('.rga-shell-scene-navigator-chevron').first().click();
    const expansion = await page.evaluate(() => {
      const marks = document.querySelector('.rga-shell-scene-navigator-marks');
      const chev = document.querySelector('.rga-shell-scene-navigator-chevron');
      const mcs = marks ? getComputedStyle(marks) : null;
      return {
        marksZoneRendered: !!marks,
        markLines: marks ? Array.from(marks.querySelectorAll('.rga-shell-scene-navigator-mark')).map(function(m) { return m.textContent; }) : [],
        ariaExpanded: chev ? chev.getAttribute('aria-expanded') : null,
        marksPaddingLeft: mcs ? mcs.paddingLeft : null,
        marksPaddingRight: mcs ? mcs.paddingRight : null
      };
    });
    console.log('EXPANSION=' + JSON.stringify(expansion, null, 2));
    try { await page.locator('#sidebar').screenshot({ path: path.join(ART_DIR, 'navigator-expanded.png') }); } catch (_) {}
  }

  await app.close();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
});
```

</details>
