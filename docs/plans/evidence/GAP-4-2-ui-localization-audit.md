# GAP-4-2 — Why the app's own RTL is missing: an audit

- **Date:** 2026-07-28 · **HEAD:** `65b52f19` · **Branch:** `main`
- **Question (user, 2026-07-28):** *"Why are RTL languages missing in the system? Not the RTL
  scripts — those render perfectly. I mean the system's RTL."*
- **Short answer:** the RTL **languages** are not missing — they are **declared and never
  implemented**. Everything behind the setting is absent, and **no launch-checklist item has ever
  tracked it**.

---

## What the user sees

Settings → General → **Interface Language**: a greyed dropdown reading "English", with the helper
text *"Behavior not wired yet."* The description under it promises exactly what is missing —
*"Controls UI text direction and translations."*

The greying is not a bug. It is the Settings Constitution being honest: a control with an editable
type and **no registered applicator** renders at 60% opacity with `pointer-events: none` and that
literal helper sentence (`settings-workspace.js:878-893`). The app is correctly telling the truth
about itself.

## Measured facts

| Question | Finding | Source |
|---|---|---|
| Are Kurdish/Arabic declared? | **Yes** — `options: ['en','ku','ar']`, `labels: {en:'English', ku:'Kurdish', ar:'Arabic'}`, `restartRequired: true` | `settings-registry.js:83-91` |
| Is the setting wired? | **No** — 44 applicators are registered; `language` is **not** one of them | live probe: `hasApplicator: false` |
| Is there a translation layer? | **None.** No i18n module, no string catalogue, no locale files anywhere in `renderer/` or `electron/` | `renderer/js/` has only `script-language.js`, which is about the *script's* language, not the UI |
| Are UI strings translatable? | **No** — hardcoded English throughout: 17 `textContent = '…'` literals in the shell modules alone (`'Scenes'`, `'Recover unsaved work?'`, `'Page Preview'`…) plus ~34 static English strings in `index.html` markup | grep |
| Does the app shell ever flip direction? | **No.** `document.documentElement` computes `direction: ltr` and `<html lang>` is `en`, always | live probe: `appDir: "ltr", htmlLang: "en"` |
| Where does every `dir` in the app come from? | The **open document's** screenplay profile — editor host (`tab-manager.js:110`), print sheet (`print-renderer.js:103`), scene navigator (`scene-navigator.js:150`), tags panel (`tags.js:295`), review bar (`review-bar.js:599`). All content, no chrome | grep |
| Could the chrome even mirror if flipped? | **Not today.** The shell CSS is physical-first: `shell.css` 25 physical (left/right) vs 12 logical; `settings-workspace.css` **13 physical vs 0 logical**. The print blocks were converted to logical properties by R1; the app chrome never was | grep |

## The answer to "was RTL not counted for in the first place?"

**Two different things were scoped very differently.**

- **The screenplay content: RTL was designed in, and it works.** RTL-01…RTL-15 cover document
  direction, fonts, every block's alignment, print, export, bidi — and after S4.2/S4.3 the page
  geometry is measured correct.
- **The application interface: it was never counted.** Searching the whole launch checklist (123
  tracked rows) for *interface language*, *UI translation*, *localisation*, or *UI direction*
  returns **nothing**. RTL-01…RTL-15 are all document-scoped. The Interface Language setting is the
  only trace of the intent anywhere in the product, and it is a promise with nothing behind it.

So the checklist — the launch constitution — has a hole, not just the code. That is why this never
surfaced as a red: nothing was ever measuring it.

## What this means for the product

A Kurdish screenwriter today writes a right-to-left Kurdish script inside a **left-to-right English
application**: English menus, English settings, English panel labels, sidebar on the left, dialogs
laid out for LTR reading. The core promise — *a Kurdish screenplay editor* — is currently half
delivered: the page is Kurdish, the tool around it is not.

## What building it would actually take (scoping only — no work started)

1. **A translation layer.** No catalogue exists, so this is the foundation: a string table, a
   lookup, and a sweep converting ~50+ hardcoded English literals (JS `textContent` + `index.html`
   markup) into keys. Every future UI string then has to go through it — that is a standing
   discipline, not a one-off.
2. **Kurdish + Arabic translations** of the entire UI surface — a translation job, not an
   engineering one, and it needs a native reviewer. (The screenplay *vocabulary* — `داخلي`/`خارجي`,
   transition words — is a separate, already-specified concern that lives in the document profile;
   see SW-23.)
3. **App-level direction.** Set `dir`/`lang` on the shell from the setting, independent of the open
   document's direction — the two must not be conflated: an English UI must be able to hold an RTL
   script and vice versa.
4. **Mirror the chrome CSS.** Convert the shell's physical left/right rules to logical
   start/end, exactly as R1 did for the print blocks. `settings-workspace.css` is the worst case at
   13 physical / 0 logical. Without this, flipping `dir` produces a broken layout rather than a
   mirrored one.
5. **Wire the applicator** so the setting stops being PERSISTS_ONLY, and add checklist rows so the
   work is tracked and testable.

**Order matters:** 3 and 4 together deliver a mirrored UI even while it is still English, and that
is independently valuable and testable. 1 and 2 deliver translation. Direction-first is the cheaper,
higher-value half.

## Decision the user owns

Is UI localisation **in scope for the v1 launch gate**, or a post-launch chapter? The launch
checklist currently says neither, because it never asked. Either answer is legitimate — but the
checklist must be amended to say which, otherwise "all P0s TRUE" will be declared over a hole.
