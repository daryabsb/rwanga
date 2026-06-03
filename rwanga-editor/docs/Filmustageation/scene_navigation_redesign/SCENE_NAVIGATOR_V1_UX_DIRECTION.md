# Scene Navigator v1 — UX Direction

> **Direction only. No implementation, no CSS, no engineering plan.**
> Created: 2026-06-02 · Surface: Scene Navigator (replaces Scene List inside the existing sidebar)
> Grounded in: `SCENE_SIDEBAR_CATALOGUE_UX_DIRECTION.md`, `FLOW_VIEW_UX_DIRECTION_V2.md`, `PRINT_TRUTH_DOCTRINE_V1.md`, `RWANGA_EDITOR_CORE_PLUGIN_PLATFORM_DOCTRINE.md`, Phase 1 screenshots (current Rwanga + Filmustage references), schema-v3 (LOCKED), nav-index moratorium.
> Companion visual: `Scene Navigator v1 Wireframes.html`

---

## Mission

Transform the existing flat scene list into a true screenplay navigator — one that lets a writer find any scene, character, or word in the script faster than scrolling, without ever feeling like a production database.

The shell, rail, sidebar container, colors, typography, spacing, and all other surfaces are **untouched**. This document concerns only what lives inside the scene list area.

---

## 1. UX Direction — The Navigation Model

The Scene Navigator is **three verbs: orient, navigate, aware.** This has not changed from the catalogue direction. What changes is the *depth* available within each verb.

**The central reframe:**
The current surface is a *label list* — it shows what scenes exist, in order, with a page number. The new surface is a *screenplay navigator* — it shows what scenes exist, what's inside them, and where any word in the script lives. Two different promises; one panel.

The Filmustage reference achieves this with a production breakdown accordion: each scene expands into a database of tagged categories with counts. That is the wrong model for a writing surface. It turns a navigator into an inventory panel and collapses the distinction between *writing the screenplay* and *breaking it down for production*.

The Rwanga-native solution: **the expansion reveals screenplay entities, not production categories.** Characters who speak in a scene are screenplay entities — they're derived directly from the script, not from a separately maintained breakdown database. Notes and flags are writing-session objects. These belong in the navigator. Props, SFX, wardrobe, set dressing, and their counts belong in Breakdown mode — accessible from the navigator via a deliberate gateway link, never inline.

**The search reframe:**
The current "Find scene…" field searches the navigator's own labels — slug text only. The new search field searches the screenplay itself: action lines, dialogue, character cues, scene headings. The result is a context-snippet panel (before · **match** · after), ordered by screenplay position, grouped by scene. This is the difference between searching a table of contents and searching a book.

**The two surfaces in one panel:**
- **Mode A — Scene List** is the default. It is the existing catalogue, evolved: the same row anatomy, the same current/selected distinction, the same signal margin — now with an expand affordance that reveals screenplay-native sub-content.
- **Mode B — Search Results** replaces the scene list while search is active. It shows context snippets, not a filtered scene list. Escape restores Mode A at its previous scroll position.

---

## 2. Information Architecture

### Header (pinned)
- Label: `Scenes · N` — orientation count
- Search field: full screenplay text (not slug-only)

### Mode A — Scene List

**Scene Row (collapsed) — anatomy unchanged from catalogue direction:**
```
┌──────┬──────────────────────────────────────────┬──────────┬──────┐
│ rail │  N   heading (EXT./INT. location — time)  │ ◎  ⚑    │ p.3  │
└──────┴──────────────────────────────────────────┴──────────┴──────┘
  3px   30px  1fr                                   20px fixed  30px
```
- **Current rail** (3px, pink): tracks editor cursor, passive
- **Number gutter** (amber-tinted, monospace): orientation anchor + expand chevron on hover
- **Heading** (load-bearing, ellipsises): location is the heaviest token
- **Signal margin** (fixed 20px, reserved): note dot · flag dot — presence only, no counts
- **Page reference** (monospace, dim)

**Scene Row (expanded) — two-tier children zone:**

Tier 1 — **Characters** (screenplay anchors):
- Each speaking character in the scene rendered as a navigation link
- Clicking → scrolls screenplay to their first line in this scene
- Derived from the existing screenplay parse; not manually entered
- No counts, no parenthetical numbers

Tier 2 — **Marks** (awareness only):
- Note presence: read-only orientation ("1 note attached")
- Revision flag status
- Content lives in the inspector; the navigator holds only presence

**Breakdown gateway** (bottom of children zone):
- A single link: `Breakdown →`
- Activates Breakdown rail mode, pre-filtered to this scene
- Production data (CAST, PROPS, SFX, STUNTS, COSTUMES…) never loads inline

**Optional: Act group headers** (large scripts only):
- Structural orientation labels between scene rows
- Derived from document's structural markers; not managed by the writer
- Collapsible per act

### Mode B — Search Results

```
Results header: "N results · M scenes"                    [Esc to clear]
─────────────────────────────────────────────────────────────────────
  3   INT. KITCHEN — DAY                                         p.2
      …she walked into the KITCHEN and paused at the threshold…

  7   INT. KITCHEN — NIGHT                                       p.6
      …back in the KITCHEN now, the dishes untouched since…
```

- Ordered by screenplay position (spatial), not relevance score
- Grouped by scene: multiple hits in one scene stack under one slug header
- Selected result: strong pink highlight
- All matches in screenplay: ambient pink highlight
- Two intensities; one truth

---

## 3. Wireframes

Five states documented in `Scene Navigator v1 Wireframes.html`:

1. **Normal Navigator** — default collapsed list, current indicator, signal marks
2. **Expanded Scene** — scene 4 open with characters + marks + breakdown gateway
3. **Search Results** — "kitchen" query, 3 results with context snippets
4. **Large Script** — 104 scenes, compact density (21px rows), act group headers, auto-scroll to current (scene 47)
5. **Empty States** — no scenes (blank document) + no results (zero-match search), side by side

---

## 4. Interaction Notes

### Expand / Collapse

- **Click the row** → navigates to scene (existing behavior, unchanged)
- **Click the chevron** in the number gutter → toggles expansion
- Two distinct targets; navigation and expansion never share the same zone
- Expansion is instant — no animation
- Multiple scenes may be expanded simultaneously
- Keyboard: `Space` or `→` expands; `←` or `Space` again collapses; `↑/↓` move selection; `Enter` navigates
- The existing keyboard contract (Arrow + Enter + Escape) is preserved

### Search Behavior

- Focusing the field enters search mode; the panel transitions to results immediately
- Results update on every keystroke — no Enter required
- Results are ordered by screenplay position, not relevance score
- `Escape (1st press)` — clears the search text
- `Escape (2nd press)` — exits search mode, restores scene list at previous scroll position
- The `Cmd+P` quick-scene-jump (command palette) is complementary; not replaced

### Highlight + Sync Behavior

- While search is active: all occurrences in the screenplay → ambient highlight
- Selected result: strong highlight (stronger opacity, brighter mark)
- Two intensities; both visible simultaneously
- Clicking any scene row, character anchor, or result item → immediate screenplay scroll
- A brief flash-confirm (~1s) on the target line confirms the jump
- The current-scene indicator (pink rail) tracks the editor cursor continuously and independently of search mode — navigator and screenplay always share one "where you are"

### Auto-scroll Current Into View

- When the current scene changes, the current row scrolls into view if off-screen
- Instant alignment (`nearest`), no animation, triggered only on actual scene transitions
- This is the highest-value existing fix and ships before everything else

---

## 5. Migration Notes

### What carries forward unchanged

The row anatomy, the current/selected separation invariant, the brand-pink current rail, the amber monospace number gutter, and the reserved signal margin carry forward intact. The row grid adds one column (the expand zone: a narrow chevron position inside the number gutter) but the visual logic is unchanged.

The existing "Find scene…" search field is the container the new search inherits — same placement, same header context. It is not removed; its scope expands from slug to full screenplay text.

The shell, rail, sidebar container, editor area, inspector, timeline, command palette, color system, and typographic system are untouched throughout.

### Change order, by priority

**1. Auto-scroll current scene into view** (SN.1 from catalogue direction)
Pure presentation behavior. Zero schema change. Ships first and independently.

**2. Full-text screenplay search**
Replace slug-matching with screenplay-text search and the results panel. Ships independently of the expand hierarchy — highest value, minimum coupling.

**3. Expandable scenes**
Character anchors derived from the existing screenplay parse. Marks from the existing note/flag model. No new per-scene schema fields required for the first cut. Breakdown gateway is a rail-switch, not a data load.

**4. Compact density + act group headers**
A CSS step-down at a scene-count threshold (~40 scenes). Act group headers require a structural act marker in the document model — gated behind that work; not blocked by it.

---

## What this design deliberately refuses

The Filmustage breakdown accordion (`CAST (5)`, `PROPS (8)`, `STUNTS (14)`, `ADD NEW CATEGORY`) is the explicit anti-pattern. It is the production database showing through the writing surface. Every design decision above is organized around keeping that model out:

- **No counts in parentheses** — presence only, or no signal at all
- **No category accordion** — two screenplay-native tiers only (characters + marks)
- **No "Add new category"** — the navigator is read-derived, never editable
- **No per-row color coding by category** — the color vocabulary (teal INT. / orange EXT.) is slug-semantic, not breakdown-categorical
- **No persistent filtered views** — search is a transient lens; Escape always restores
- **No drag-to-reorder** — structural editing belongs to the Outline surface

The Filmustage value borrowed is *information architecture philosophy* — expandable hierarchy, screenplay-to-navigator sync, entity-aware navigation. The Filmustage model rejected is its inventory implementation.

---

## Success test

> "I can find any scene, character, or word in the screenplay faster than scrolling — and this still feels like Rwanga."

Both conditions must hold. If the first fails, the navigator is not good enough. If the second fails, the redesign overreached.

---

## STOP

UX Direction and wireframes only. No implementation has begun. Schema-v3 LOCKED, nav-index moratorium, shell architecture, and the current/selected separation invariant are treated as immovable. The next decision — authorize the change order above, amend, or reject — belongs to the user.
