# Rwanga Shell — Visual Debt After Slice 2

Snapshot: 2026-05-16. Runtime restored after the post-Slice-2 emergency
CSS fix (commit `229336fc`). The app boots, the editor mounts, and a
real script (playground-the-last-light.rga) loads.

This is the **revised** report — the first pass was written from source
alone and missed several issues that are obvious in the running app.
The user-supplied 2026-05-16 23:15 screenshot is the source of truth
for everything below.

Severity legend:

- **P0** — runtime blocker (user cannot work)
- **P1** — product embarrassment (looks broken to a first-time viewer)
- **P2** — polish (a careful eye notices)
- **P3** — later (not visible to a typical first-time viewer; deferrable)

---

## 1. FOUR competing header strips stacked at the top — **P1**

What the screenshot shows, top to bottom:

1. **Native OS title bar** — `playground-the-last-light.rga — Rwanga`
   with the real Win11 minimise / maximise / close buttons.
2. **Native (Electron) menu bar** — `File · Edit · View · Help`
   (the OS-rendered application menu).
3. **Slice 1 titlebar** — `Rwanga • playground-the-last-light.rga`
   with the placeholder 👤 avatar on the right.
4. **Legacy custom menu bar** — `🟡 Rwanga · File · Edit · View · Script
   · Tags · Export · Help` with **a second set of fake min / max / close
   buttons** on the right.

Concrete visible problems:

- The word "Rwanga" appears **three times** in the top ~120px of the
  window (native title, Slice 1 titlebar, legacy menu logo).
- "File / Edit / View / Help" appears **twice** — once in the native
  menu, once in the custom menu.
- Two distinct sets of window controls — the real ones (top right) and
  the fake ones in the custom menu (which now do nothing meaningful in
  a non-frameless window).
- Three of the four strips are draggable; the user has no idea which to
  grab.
- ~120px of vertical real estate consumed before any product content.

This is by far the most visually wrong thing in the app.

---

## 2. Bright saturated-blue status bar — **P1**

The bottom strip renders as a **vivid Windows-selection-blue**
(approximately `#0050E0`-ish) with white text on it. Visible content:
`Scene: —  Page: —/3  —  439 words  print  en  Local`.

Problems:

- The colour is wildly inconsistent with the rest of the app, which is
  a warm-grey / cream palette in the editor area and a darker grey in
  the chrome. The status bar reads like a Windows system message bar
  accidentally embedded in the app.
- White text on this blue has low enough contrast in some segments
  (the em-dash placeholders, the `print` label) that they almost
  disappear.
- Long gaps appear between segments because they are spaced by
  whitespace rather than by deliberate alignment columns — the bar
  looks half-empty even with 7 segments populated.
- The clickable `print` (view mode) segment has no hover or affordance
  cue; users won't know it's clickable.
- The `Local` offline indicator is a plain word — no dot, no icon — and
  vanishes into the blue.

This was understated in the first report; in the screenshot it is the
single most jarring element after the chrome stack.

---

## 3. Scene Navigator — actively confusing rendering — **P1**

The panel mounts the right data (5 scenes, scene numbers, headings,
page badges) but the rendering is more broken than "unstyled":

What is actually visible:

- Scene number and heading are **glued together with no separator**:
  `1EXT. OLD HOUSE — ROSE GARDEN — DAWN`,
  `2EXT. BABAN'S BEDROOM — CONTINUOUS`, etc.
- Each heading wraps onto multiple lines with the wrap point falling
  mid-phrase ("DAWN" lands on its own line under scene 1).
- A page badge (📜 + `p.1`) is **inlined into the heading text run**
  rather than being a right-aligned chip — it visually attaches to the
  last word of the heading.
- Scene rows have no row backgrounds, no separators, no padding, no
  hover state, and no obvious click affordance.
- Two visual marks are supposed to coexist (cursor-current scene vs
  keyboard-selected scene) — neither is visible in the screenshot.
- A folder icon appears to the left of the scene number on some rows
  and not others — unclear why.

A first-time viewer would read this panel as a list dump, not as a
navigation surface.

---

## 4. Activity rail — governed by doctrine (2026-05-17)

> **Status update (2026-05-17):** the activity rail is now governed by
> `docs/rwanga-activity-rail-doctrine.md` (LOCKED). The five doctrine
> rules (single icon system, monochrome / calm / same-weight icon
> style, three-group spacing, four-state active model, VS Code +
> creative-tool + paper visual feeling) supersede the original P2
> classification below. Implementation slice is blocked on OD-A (icon
> family choice). The original notes are preserved as the symptom
> record that motivated the doctrine.

The left rail shows seven items rendered as **emoji glyphs**:
- 📄 (file)
- 📁 (folder)
- 🌳 (tree — Outline) — **rendered in bright green, full-colour
  emoji**, totally inconsistent with the other muted icons
- 👥 (people — Characters)
- 🔍 (search)
- 📜 (scroll — Revisions)
- ⚙ (gear — Settings)

Problems visible in the screenshot:

- The green tree pops as a vivid full-colour emoji while the others
  render as monochrome / dimmer — the eye is dragged to Outline for
  no reason.
- Emoji rendering is OS-dependent (these are Windows segoe-emoji
  glyphs); on macOS or Linux they will look totally different.
- No visible "active panel" indicator on the rail in the screenshot,
  even though Scene Navigator is the active panel — the 2px left bar
  designed for this is invisible against the rail background.

---

## 5. Scene Toolbox — clipped off the right edge of the editor — **P1**

The vertical scene-toolbox palette is visible in the screenshot as a
**narrow vertical sliver hanging off the right side of the editor
page** — only the leftmost ~12px is visible, showing partial control
fragments (a tiny `S` for "Scene" header, partial outlines of buttons).
The actual controls (block-type dropdown, ✎ Note, ⚑ Flag, ＋ Tag…) are
cut off by the inspector column.

This is a layout failure, not just a polish item — the user cannot use
the scene toolbox because it is hidden behind/under the inspector.

---

## 6. Inspector panel — legacy placeholder still visible — **P1**

The right-hand `INSPECTOR` panel shows the unchanged placeholder
copy: header in all-caps `INSPECTOR`, body line:
`Select a tag or scene header to view details.`

Two problems:

- The all-caps `INSPECTOR` header is the only all-caps heading in the
  entire UI — inconsistent.
- The placeholder copy has shipped this way for months; it reads as an
  unfinished panel rather than a contextual surface waiting for state.

---

## 7. Bottom panel — legacy chrome + placeholder copy — **P1**

The bottom panel shows the unchanged legacy tab bar:
`Scene · Notes · Flags · Problems · Breakdown` with the Scene tab
active, body showing `Notes — No scene selected` and the
`Add scene notes here...` textarea (greyed out — disabled because no
scene is selected).

Problems:

- Active-tab underline is the same bright blue as the status bar — the
  two unrelated UI elements adopt the same accent colour.
- All five tabs are empty-state on a fresh load — bottom panel feels
  like dead space rather than a workspace surface.
- The disabled textarea takes up most of the bottom panel's vertical
  space but does nothing — looks like a broken form.

---

## 8. Editor page — paper feel still weak — **P2**

The page surface renders the loaded script (`THE LAST LIGHT`, `Logline`,
`Characters`, `NALI — 28, the granddaughter…`). What's visible:

- The page is a flat off-white rectangle on a slightly darker grey
  desk — no shadow, no edge treatment, no sense of paper.
- Section headings (`Logline`, `Characters`) render as bold sans-serif
  blocks — they don't read as part of the screenplay; they read as
  default-styled HTML headings the renderer dropped in.
- The title `The Last Light` is centred in a monospace face and reads
  fine, but `Logline` and `Characters` below it are left-aligned bold
  in a different family — three typographic systems on one page.
- The script slug (`THE LAST LIGHT` at top) is small grey monospace and
  visually weak — easy to miss as a slug.
- Body text (NALI dialogue lead-in, action lines) renders in monospace
  with no leading discipline; lines feel cramped.

---

## 9. Spacing / alignment issues — **P2 / P3**

- The 4-strip chrome stack pushes the editor down so the visible page
  starts ~135px into the window; this is wasted vertical space.
- The tab bar with one tab and a `+` button looks half-empty across
  the full editor width.
- The status bar segment spacing is uneven — large gaps between
  `Scene: —`, `Page: —/3`, the em-dash block-type, then 439 words,
  then a big gap to `print en Local`.
- No separators between status-bar segments — they read as one
  irregularly-spaced sentence.
- The activity rail icons sit centred in 40px-tall slots but with
  large vertical gaps between them — wastes rail height.

---

## 10. Other visible leftovers — **P3**

- The `Tags` menu item is still in the custom menu bar even though the
  Tags sidebar panel was retired in Slice 2.
- The 👤 emoji avatar in the Slice 1 titlebar is a literal placeholder
  glyph, obviously not a real account surface.
- Format toolbar (undo / redo / B / I / U / S / A / colour / link /
  clear) is small and browser-button-styled — sits in its own strip
  above the editor and reads as engine chrome.
- The `+` new-tab button next to the single tab is small and the
  same colour as the bar background — easy to miss.

---

## Summary table (revised)

| # | Item | Severity |
|---|---|---|
| 1 | **Four** competing header strips with duplicate "Rwanga" + duplicate window controls + duplicate File/Edit/View | P1 |
| 2 | **Bright blue status bar** clashes with the rest of the palette | P1 |
| 3 | Scene Navigator — heading + number + page badge mashed together | P1 |
| 4 | Activity rail — emoji icons, one full-colour green outlier | governed by [doctrine](./rwanga-activity-rail-doctrine.md) — LOCKED 2026-05-17 |
| 5 | **Scene toolbox clipped** off the right edge — unusable | P1 |
| 6 | Inspector panel — legacy placeholder ALL-CAPS heading | P1 |
| 7 | Bottom panel — legacy tabs, blue accent matches status bar by accident | P1 |
| 8 | Editor page — flat rectangle, three typographic systems on one page | P2 |
| 9 | Spacing / alignment (chrome stack, status-bar gaps, rail) | P2 |
| 10a | `Tags` menu item points to nothing meaningful | P3 |
| 10b | 👤 emoji avatar placeholder | P3 |
| 10c | Format toolbar reads as engine chrome | P3 |
| 10d | `+` new-tab button low-contrast | P3 |

No P0 items remain after commit `229336fc`. **Six P1 items** make the
running app look unfinished to a first-time viewer; the four-strip
chrome stack, the bright blue status bar, and the clipped scene toolbox
are the three most jarring.

End of revised report.
