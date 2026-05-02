# Claude Design Brief — Review System Templates

**Date:** 2 May 2026  
**From:** Darya's AI Agent  
**To:** Claude Design Agent  
**Project:** Rwanga (ڕوانگە) — Kurdish Cinema Preproduction Platform

---

## Your Job

Design and build **3 new HTML templates** for Rwanga's review system. These templates go into `rwanga-design-kit/templates/exports/` alongside the existing call sheet, shot list, and scene viewer templates.

**Before you start:** Read `rwanga-design-kit/templates/exports/preview.html` — this is the existing brand. Your new templates must match it exactly: same colors, same fonts, same component patterns. You will ADD new panels to the preview switcher (or create a new preview file) so all templates are browsable.

---

## Brand System (from existing templates)

**Colors:**
- Pink: `#F72585` (primary brand, logos, accents, badges)
- Amber: `#D4A574` (secondary accent, active states on dark bg)
- Dark amber: `#9A5520` (accent on light bg, shot numbers)
- Dark bg: `#0F0F12`, Surface: `#17171C`, Surface-2: `#1E1E26`
- Light bg: `#F7F7FA`, White: `#FFFFFF`
- Text light: `#EDEAD8`, Muted: `#78788C`, Dim: `#40404E`
- Text dark: `#0F0F12`, Muted dark: `#5C5C70`, Dim dark: `#A0A0B8`
- Borders: `#2C2C38` (dark), `#DCDCE8` (light)

**Fonts:**
- `Cairo` — Arabic/Kurdish text, headings, labels
- `Inter` — Latin text, numbers, monospace-like data

**Logo:** Pink square with `ڕ`

**Direction:** RTL (direction: rtl) — this is a Kurdish platform

**Patterns from existing templates:**
- `.pdf-page` wrapper for printable A4 views
- `.cs-header` / `.sl-header` style letterheads
- `.cs-section-title` for section labels (8pt, uppercase, letter-spacing, #A0A0B8)
- `.cs-table` for data tables
- Scene viewer uses dark theme with CSS variables
- Footer: "دروستکراوە لە ڕوانگە — پلاتفۆرمی پێشبەرهەمهێنانی سینەمای کوردی"

---

## Template 1: Review Workbench (Interactive, Dark Theme)

**What it is:** The main review interface. The director sees their unsettled decisions, acts on them, and reads the bible alongside.

**Layout:** Full-width, dark theme (like the scene viewer), not a PDF page.

**Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│  [ڕ] ڕوانگە — میوانێکی نادیار — پێداچوونەوە v03        │  ← top bar
├─────────────────────────────────────────────────────────────┤
│  [بڕیارە نوێیەکان]  [بڕیارە جێگیرکراوەکان]  [بایبڵ]    │  ← 3 tabs
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   LEFT PANEL             │   RIGHT PANEL                    │
│   Decision list          │   Bible section OR Script        │
│                          │                                  │
│   Each decision:         │   [بایبڵ ↔ سکریپت] toggle       │
│   - Topic (bold)         │                                  │
│   - Question text        │   When a decision is clicked:    │
│   - Expression type      │   highlight the relevant bible   │
│   - [✓ Accept] [✗ Reject]│   section / screenplay section   │
│   - Scene badges         │                                  │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

**Tab 1 — Active Decisions (بڕیارە نوێیەکان):**
- List of unsettled decisions (status: proposed)
- Each decision is a card with:
  - Topic (Kurdish, bold, Cairo font)
  - Decision text (Kurdish, regular)
  - Scene badges (pink chips like `.cs-scene-chip`)
  - Expression type badge (if assigned): emotional, behavioral, artistic, memory, broken
  - Intensity indicator: low / medium / peak / collapse
  - Action buttons: Accept (✓ amber) and Reject (✗ muted)
  - Comment input (collapsed, expands on click)
- Clicking a decision highlights the corresponding bible section in the right panel
- Count badge on the tab showing number of unsettled decisions

**Tab 2 — Locked Decisions (بڕیارە جێگیرکراوەکان):**
- Read-only list of locked decisions
- Each one collapsed by default (show topic only)
- Expandable to see full decision text + lock comment
- Lock date shown
- Grouped by review version (v1, v2, v3)

**Tab 3 — Full Bible (بایبڵ):**
- Full bible text, no overlay, no decision highlighting
- Just the story bible rendered clean for reading
- Scrollable, with section headers

**Right Panel:**
- Toggle between بایبڵ (bible summary) and سکریپت (full screenplay)
- When bible mode: show the analytical lens text
- When script mode: show the actual screenplay text
- Highlighted section follows the selected decision from the left panel
- Highlight style: amber left-border (like `.sv-notes-block`)

**Mock data to use:** Use the actual decision topics from the v03 review (Kurdish text). Use 3-4 active decisions and 3-4 locked decisions for the mock. Use a paragraph of the story bible for the right panel.

---

## Template 2: Chain Viewer (Interactive, Dark Theme)

**What it is:** When a director clicks on a decision chain, this view shows how the decision evolves across scenes — not just where it appears, but how it escalates.

**Layout:** Full-width, dark theme.

**Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│  [ڕ] ← Back to Review    Chain: D15 — ناڕاستەوخۆیی        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐  │
│  │ Sc.3 │───→│Sc.13 │───→│Sc.21 │───→│Sc.34 │───→│Sc.37 │  │
│  │      │    │      │    │      │    │      │    │      │  │
│  │ LOW  │    │ MED  │    │ PEAK │    │COLLAP│    │HELD  │  │
│  └──────┘    └──────┘    └──────┘    └──────┘    └──────┘  │
│  emotional   behavioral  artistic    broken      broken     │
│  stabilize   control     overwrite   system      conscience │
│              interaction reality     fails       alone      │
│                                                             │
│  ─────────────── Arrow / timeline ──────────────────────    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Selected scene detail panel]                              │
│                                                             │
│  Scene 21 — Rehearsal                                       │
│  Type: Artistic | Intensity: Peak | Function: Overwrite     │
│  Transition: behavioral → artistic                          │
│                                                             │
│  Lens: "When mediation reaches its peak, it becomes art.    │
│  Nali doesn't hide the body — he stages a performance that  │
│  makes the body invisible. Director and killer are the      │
│  same role."                                                │
│                                                             │
│  [View in screenplay →]                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**The chain timeline:**
- Horizontal row of scene nodes connected by arrows
- Each node shows: scene number, intensity level, expression type
- Intensity encoded visually: LOW = small/dim, MEDIUM = medium, PEAK = large/bright, COLLAPSE = fractured/broken style
- Arrows between nodes show the transition label (e.g., "emotional → behavioral")
- The whole timeline should feel like an escalation arc — visually rising to peak then falling to collapse

**Scene detail panel:**
- Appears below the timeline when a scene node is clicked
- Shows: scene number, type, intensity, function, transition
- Shows the lens text (English)
- Link to "View in screenplay" (would scroll to that scene in the script panel)
- Notes/comments area

**Design notes:**
- This is the key innovation. The visual language should make you FEEL the escalation — don't just use text labels. Use size, color intensity, border weight, or glow to show low vs peak vs collapse.
- The collapse nodes should look visually "broken" — different border style, desaturated, fractured.
- Use the amber (#D4A574) for the peak node, pink (#F72585) for the overall chain title, and a muted/broken treatment for collapse nodes.

**Mock data:** Use the D15 mediation chain — 5 scenes (3, 13, 21, 34, 37) with the data from this table:

| Scene | Type | Intensity | Function | Transition |
|-------|------|-----------|----------|------------|
| 3 | emotional | low | stabilize uncertainty | — (origin) |
| 13 | behavioral | medium | control interaction | emotional → behavioral |
| 21 | artistic | peak | overwrite reality | behavioral → artistic |
| 34 | broken | collapse | system fails (forced) | artistic → broken |
| 37 | broken (held) | collapse (sustained) | conscience alone (chosen) | collapse → sustained collapse |

---

## Template 3: Review Summary PDF (Printable, Light Theme)

**What it is:** A printable summary of a review round — all decisions with their status, organized for reading on paper. The director prints this to review offline or share with collaborators.

**Layout:** A4 PDF page (`.pdf-page` wrapper), light theme, RTL.

**Structure:**

```
┌─────────────────────────────────────────────────────────┐
│  [ڕ] ڕوانگە                                            │
│  میوانێکی نادیار — پێداچوونەوە v03                     │  ← letterhead
│  بەروار: ٢٠٢٦/٠٥/٠٢                    بڕیارەکان: ٤٤  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ══ بڕیارە جێگیرکراوەکان (٢٥) ══                       │  ← locked section
│                                                         │
│  ١. تەمەی سەرەکی — واقیعی دەستکرد            [جێگیر]  │
│     پوختەی سەرەکی فیلمەکە ئەوەیە...                    │
│     تێبینی: test                                        │
│                                                         │
│  ══ بڕیارە نوێیەکان (١٩) ══                             │  ← unsettled section
│                                                         │
│  ١. تویستی کۆتایی                              [نوێ]   │
│     لە کۆتاییدا دەبینین...                              │
│     ○ Chain A — Gesha                                   │  ← chain tag
│                                                         │
│  ─────────────────────────────────────────────────────   │
│  خشتەی پوختە                                           │  ← summary table
│  جێگیر: ٢٥ | نوێ: ١٩ | ڕەتکراوە: ٠                    │
│                                                         │
│  ── footer ──                                           │
└─────────────────────────────────────────────────────────┘
```

**Sections:**
1. Letterhead (like call sheet header — logo, project name, review version, date, counts)
2. Locked decisions section — grouped, collapsed format (topic + status badge only, with lock comment in small text)
3. Unsettled decisions section — full text shown, with chain tag (A/B/C/D) if applicable
4. Summary table at bottom (total counts by status)
5. Footer with Rwanga brand line

**Status badges:**
- Locked: green/amber background, "جێگیر" text
- Proposed: pink outline, "نوێ" text
- Rejected: muted/struck-through, "ڕەتکراوە" text

**Mock data:** Use 4 locked decisions and 4 unsettled decisions from the actual v03 review data.

---

## Integration with Preview Switcher

Add the 3 new templates to the preview switcher in `preview.html` or create a new `review_preview.html` file with its own switcher:

```
[Review Workbench]  [Chain Viewer]  [Review PDF]
```

---

## What NOT to do

- Don't change the existing templates (call sheet, shot list, scene viewer)
- Don't invent new colors or fonts — use the brand system exactly
- Don't make it LTR — everything is RTL (direction: rtl)
- Don't simplify the chain viewer into a plain list — the visual escalation is the whole point
- Don't add features not described here — keep it to these 3 templates

---

## Files to read before starting

1. `rwanga-design-kit/templates/exports/preview.html` — The existing brand and all component patterns
2. This file — The design spec

## Files to create

1. `rwanga-design-kit/templates/exports/review_workbench_preview.html` — Template 1
2. `rwanga-design-kit/templates/exports/chain_viewer_preview.html` — Template 2
3. `rwanga-design-kit/templates/exports/review_summary_preview.html` — Template 3 (PDF)
4. Optionally: `rwanga-design-kit/templates/exports/review_preview.html` — Combined preview with switcher

All templates use mock data and are static HTML — Django will render them at runtime later. The goal is to nail the design so engineering knows exactly what to build.
