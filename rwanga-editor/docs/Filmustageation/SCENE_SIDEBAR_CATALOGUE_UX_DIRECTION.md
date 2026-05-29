# Scene Sidebar Catalogue — UX Direction

> **Direction only. No implementation, no engineering slices beyond recommendation, no code.**
> Created: 2026-05-29 · Surface: Scene Sidebar Catalogue (`.rga-shell-scene-navigator-*`)
> Grounded in: `Filmustageation UX Direction.html`, `SCENES_SIDEBAR_CATALOGUE_PHASE0.md`, `FILMUSTAGEATION_POST_F1A_REVIEW.md`, `RWANGA_EDITOR_CORE_PLUGIN_PLATFORM_DOCTRINE.md`, current `scene-navigator.js` + `shell.css:1499–1677`, design-system docs 01–09, current screenshots.

---

## What this surface is

The Scene Sidebar Catalogue is **orientation, navigation, and awareness.** Three verbs, no more.

- **Orientation** — *where am I in the structure?*
- **Navigation** — *take me to that scene.*
- **Awareness** — *how much script is there, and what's near me?*

It sits in the UX Direction's **Session Awareness** emotional layer: "Peripheral — you glance, you don't stare." The screenplay page is the heaviest object in the room and the permanent center of gravity. The catalogue orbits it. It is the panel you check with a glance and leave — never the panel you work *in*.

## What this surface is not

It is **not management.** It is **not a production inventory.** It is **not a dashboard.**

The screenshot's breakdown accordion — `CAST (5)`, `PROPS (8)`, `STUNTS (14)`, `ADD NEW CATEGORY` — is the exact anti-pattern. Counts-in-parentheses is a database-table interface. During writing it is noise. Every gram of inventory thinking that leaks into a scene row pulls the surface toward the admin panel the Doctrine warns against (anti-references: Discord tiles, AI-playground glow, generic-Electron clutter). The catalogue earns its calm by *refusing* most of what could be shown.

This document gives direction across sixteen dimensions of that surface. It is grounded in the **real** current implementation — the shell scene navigator — not the legacy breakdown sidebar in the screenshot.

---

## 1. Row Anatomy

The scene row is the atomic unit of the entire surface. Everything else is frame around it. Get the row right and the panel is right.

A row encodes, in a single glance and a single line, three zones reading inline-start → inline-end:

```
┌──────┬───────────────────────────────────────┬──────────┬────────┐
│  4   │  INT. APARTMENT — NIGHT                 │  ◖ ◗     │  p.3   │
└──────┴───────────────────────────────────────┴──────────┴────────┘
 INDEX     HEADING (load-bearing, ellipsised)      SIGNALS    PAGE
 gutter    flex                                     reserved   reserved
```

**The three zones, by role:**

1. **Index gutter** — the scene number. Fixed-width track, monospaced, so numbers stack into a clean vertical column the eye can run down. This is the orientation anchor.
2. **Heading** — the slug line. The single load-bearing token. It flexes, takes all remaining width, ellipsises on overflow. This is *what the writer reads*.
3. **Signal margin** — awareness marks (notes, revisions) and the page hint, right-aligned into **fixed, reserved tracks** so they form their own columns and never reflow the heading when they appear or vanish.

The current grid (`26px 1fr auto auto`) already expresses this skeleton correctly. The direction is not to rebuild it — it is to make each zone hold its discipline:

- **One line. Always.** A scene row is single-height by default (the current `min-height: 28px` is correct). No two-line rows in the default catalogue. The moment rows wrap, the column rhythm collapses and the surface reads as a list of paragraphs, not a structure.
- **Reserved, not collapsing, signal tracks.** The signal margin and page track must occupy their width whether or not they have content, so that a notes dot appearing on scene 12 does not shove scene 12's slug leftward. Reflow-on-hover and reflow-on-state-change are the surface's enemy. (See §13.)
- **No row chrome beyond state.** No leading icon, no per-row button, no drag handle, no checkbox, no color swatch. A row is a number, a slug, and quiet awareness marks. Anything else is the admin panel knocking.

> **Direction.** The row is a *label*, not a *card*. Label rows scan; card rows demand. Keep the row a label.

---

## 2. Current vs Selected Treatment

This is the catalogue's most sophisticated existing idea and its single most important behavior to protect. The implementation already separates two states that lesser navigators conflate — keep them separate, and make the separation legible.

| State | Means | Driven by | Posture |
|---|---|---|---|
| **Current** | "The cursor is in this scene." | `ScriptSession.currentScene.nodeId` (editor cursor) | **Passive.** It tracks you. Changes constantly as you scroll/type. |
| **Selected** | "I deliberately moved the highlight here." | keyboard-nav `_selectedNodeId` | **Active.** It reflects intent — a thing the writer just did. |

These coexist. A row may be current, selected, both, or neither. The SEPARATION INVARIANT (documented in code, enforced in CSS, pinned by 30+ unit tests) is correct and non-negotiable.

**Visual direction for each:**

- **Current = ambient "you are here."** Because it changes every few seconds as the writer moves, it must **whisper**. The existing brand-pink (`--accent-rwanga`, `#C2185B`) inline-start rail + tinted number cell is exactly right: an edge marker, not a fill. A fill would make the surface flicker and shout every time the cursor crosses a scene boundary. Keep current as a **2px edge rail + number-cell tint** — quiet, peripheral, glanceable.
- **Selected = deliberate focus.** Because it is the product of an explicit act, it can carry slightly more weight: the existing soft `--bg-hover` fill + 1px outline ring (using the interaction accent, `--accent-primary` family) is correct. It says "this is the row your keyboard is on."

**The hard case — when they diverge.** The writer keyboard-navigates the list to peek at scene 30 (selected) while the cursor stays in scene 4 (current). Both must read at once, unambiguously:

- **Current** owns the **inline-start edge** (the pink rail) — a vertical signal.
- **Selected** owns the **row interior** (fill + ring) — a horizontal signal.

Edge vs interior. Pink vs neutral-blue. They occupy different visual real estate and never compete for the same pixels. When the two states coincide on one row, they *stack* — rail and fill together read as "here, and focused" without muddiness.

> **Direction.** Never promote *current* to a loud treatment to make it "easier to see." Its visibility problem is positional (it scrolls off-screen — see §14), not chromatic. The fix is keeping it on-screen, never making it brighter.

---

## 3. Scene Metadata Hierarchy

What earns a place in a row, in strict priority order. Everything below the line is exiled to the inspector or breakdown mode.

**Tier 1 — Primary (the row's reason to exist):**
1. **Location text** (`KITCHEN`, `APARTMENT`, `DEVASTATED CITY BLOCK`). Writers navigate by place — *"the rooftop scene,"* never *"the INT. scene."* Location is the heaviest token. Full `--text` weight.

**Tier 2 — Secondary (orientation context, dimmer):**
2. **Scene number** — orientation anchor, but the column position already says "this is a number," so it can sit at muted weight.
3. **Setting** (`INT.`/`EXT.`/`EST.`) and **time-of-day** (`NIGHT`/`DAY`/`CONTINUOUS`) — context modifiers. Useful, but subordinate to location. `--text-2` / `--text-3`.

**Tier 3 — Awareness signals (present only when true, in the reserved margin):**
4. **Page hint** (`p.3`).
5. **Notes present** (a mark, not a count).
6. **Revision flagged** (a mark, not a count).

**Below the line — does NOT belong in the row:**
- Tag-mention counts per scene (how many characters/props in this scene).
- Estimated duration / eighths.
- Block count, transition labels (`CUT TO:`), continuity markers.
- Any status, assignment, or completion state.

> **Direction.** The hierarchy is a discipline against accretion. Every future "could we also show…" request is answered by this ladder: if it isn't Tier 1–3, it lives in the inspector or breakdown mode. The row's calm is a budget, and the budget is already spent.

---

## 4. Scene Numbering Presentation

The number is the orientation anchor — treat it as a typographic column, not a label.

- **A column, not a tag.** Right-aligned, monospaced (Courier, matching the page's screenplay DNA), in `--accent-gold` — the domain-specific screenplay-warmth accent reserved for exactly this kind of structural signal. Numbers stack into a scannable vertical edge.
- **Display, never compute.** Numbers come from `nav-index` (`scene.sceneNumber`), which the engine owns. The catalogue is a *renderer* of numbers; it never assigns or renumbers. This is locked — the nav-index moratorium forbids the catalogue from owning numbering logic.
- **Drop the decorative `#`.** Position in a fixed gutter already communicates "this is the scene number." A literal `#` prefix adds typographic noise to every row. Let the column carry the meaning.
- **Plan for non-integer numbers.** Production numbering (`A1`, `12`, `12A`) and locked numbers are a real future. The gutter should right-align and tolerate ~3–4 mono characters gracefully now, so it never has to be re-laid-out later. (The *generation* of such numbers is deferred and engine-owned — but the presentation should not assume `1, 2, 3…`.)
- **The pre-scene / unnumbered case.** A title sequence or pre-scene (the screenshot's "0: PRE-SCENE / TITLE SEQUENCE") should render its gutter empty or with a muted neutral glyph — never a faked number. An honest blank reads correctly; an invented "0" implies a scene that isn't one.

---

## 5. Page / Location Indicators

**Page.** The most useful awareness number after the scene number — *where in the script does this scene live?*

- Single page where the scene **starts** (`p.3`), right-aligned in the reserved page track, monospaced, dim (`--text-3`).
- One number, not a range, by default. Multi-page scenes can reveal their span on hover/inspect — but the resting state is one quiet figure.
- It is **awareness, not pagination control.** No "go to page" affordance lives here; clicking the row navigates by scene, and the page number is a passive coordinate.
- Show it only when PageMap data exists. When pagination is unresolved, the track stays reserved-but-empty (no fallback "p.?" noise).

**Location.** There is no separate location indicator — **location is already the heaviest token in the heading** (§3). Adding a location chip, pill, or color swatch would duplicate the slug and reintroduce inventory texture.

- **Resist location color-coding.** Tinting rows by location is the single most tempting slide toward the breakdown panel. It turns a calm structural list into a heat-map and asks the writer to decode a legend. Location lives as *text*, where it is already legible.
- A faint, optional grouping cue for *runs of the same location* (consecutive scenes in one place) is the only location-awareness idea worth holding in reserve — and even that is deferred, not directed, because it borders on structural grouping (§14) and would lean on data the index doesn't project today.

---

## 6. Note Indicators

Scene Notes already live in the inspector (post-F1A.5). The catalogue's only job is to signal **presence**, so the writer knows a note is *there* without opening it.

- **A single quiet mark, not a count.** `hasNotes` is binary in the row. A count ("3 notes") is inventory thinking and management creep — it invites the writer to *manage* notes from the navigator, which is not this surface's job. Presence: yes/no. Depth: the inspector.
- **A real glyph, not an emoji.** The current 📝 is platform-dependent (renders differently across macOS/Windows/Linux font fallback) and reads as debug-noise against the "instrument labeling" voice. Direction: a single restrained line glyph from the established Lucide set (CORE-provided), sized to the text, in a calm neutral or the gold accent — never a colored tile.
- **Fixed track.** The note mark lives in the reserved signal margin so its appearance never reflows the slug (§1, §13).

> **Direction.** The note mark answers *"is there a note?"* The inspector answers *"what does it say?"* Keep that division absolute. The day the catalogue shows note *content* is the day it stops being a navigator.

---

## 7. Revision Indicators

Revision flags (`hasRevisionFlag`) follow the same presence-only logic as notes — with one critical addition: **distinguish them by shape, not by color alone.**

- **A distinct mark.** The note mark and the revision mark share the signal margin, so they must be tellable apart without relying on color (colorblind-safe). Give them **different glyphs** — e.g. a note glyph vs. a flag/tick glyph — so the difference is structural, not chromatic. Replace the current 🚩 emoji with a restrained Lucide flag mark.
- **Presence, not history.** The row shows *that* a scene is flagged, never the revision color depth, the draft generation, or the change history. Revision history is inspector territory.
- **Industry colors are a future, handled carefully.** Production revision colors (blue/pink/yellow draft passes) are a legitimate eventual signal — but if/when introduced, they must remain a *thin, subordinate mark*, never a row fill, and must keep the shape distinction so color is reinforcement, not the sole carrier.

---

## 8. Icon Strategy

Rwanga's identity is restraint — VS Code calm, explicitly anti-Discord, anti-AI-playground. The catalogue's icon budget is therefore deliberately tiny.

- **No per-row leading icons.** `INT.`/`EXT.` is *text*, and text is clearer and more screenplay-native than a door/tree glyph. Time-of-day is `NIGHT`, not a moon. A leading icon on every row is visual tax with no navigational payoff.
- **One family, line weight, sized to text.** Where icons do appear — the panel's rail/header identity (`clapperboard`/`list-tree`), the note and revision marks, a group-collapse chevron if grouping ships — they come from the single established Lucide set, line-style, monochrome, scaled to the surrounding text. No filled tiles, no two-tone, no color-coded icon language.
- **Never emoji.** Emoji are the current indicators' weakness (§6, §7) and have no place in a professional writing instrument's chrome.
- **Marks vs icons.** The note/revision signals are better understood as *typographic marks* than as iconography — the smallest possible glyph that carries presence. Treat them with the restraint of punctuation, not the prominence of buttons.

---

## 9. Header Treatment

The panel header is identity + a single awareness figure + (eventually) the entry point to find. It is **not** a toolbar.

- **Quiet section identity.** Matches the established `.sidebar-section-header` voice — small, uppercase, wide-tracked, calm. It names the surface ("Scenes") and anchors the panel.
- **One awareness figure, used with caution.** A scene count (`Scenes · 42`) is genuine orientation — *how big is this script?* — and aligns with the Outline panel's header pattern. But a count is one keystroke from feeling inventory-like; if it reads as a tally rather than a glance, it should be dropped. One number, never a row of stats.
- **No button strip.** The header must not accumulate sort/group/filter/options buttons. At most, one understated affordance (the find entry, §10). The toolbar-creep failure mode named in the UX Direction is exactly what a busy header becomes.
- **Pinned.** The header stays fixed while the list scrolls beneath it, so identity and count are always available.

---

## 10. Search / Filter Posture

The posture is **find, not query.** The catalogue's search exists to *jump*, not to build saved, faceted views.

- **A single, progressive find field.** Collapsed/understated by default; expands on focus. It substring-matches the visible slug (location, setting, time) and the scene number — type `café` to narrow to cafés, type `12` to surface scene 12. That solves the real lived gap ("find the dancer scene without scrolling or the command palette").
- **Temporary, not sticky.** Filtering is a transient lens. Escape/blur clears it and restores the full list. The catalogue never persists a filtered state as if it were a saved view — persistent filtered views are a management construct.
- **No faceted filtering.** "All night exteriors," "every scene with this character," filter-by-tag — these are *breakdown* operations (cross-scene production queries) and belong in breakdown mode (§16), never in the writing navigator. At most, the catalogue might offer **one** quick presence toggle (e.g. "scenes with notes") — and even that is optional, not directed.
- **Honor the existing power path.** The command palette / quick-scene-jump (`Cmd+P`) is the keyboard-first jump; the find field is its discoverable, in-panel sibling. They are complementary, not redundant — keep both, and don't let the field try to become the palette.
- **Escape precedence must be deliberate.** When find is active, Escape clears the *filter* first; a second Escape clears *selection*. State this rule explicitly so the two Escapes don't fight.

---

## 11. Empty State

The empty state is a moment of calm instruction, never a marketing surface.

- **Two distinct empties:**
  - **No scenes yet** — the document has no scene headings. Quiet, centered, `--text-3`: a single sentence describing what the catalogue *will* show as the writer works.
  - **No results** — a find query matched nothing. "No scenes match '…'" with a one-tap clear-filter affordance, so the writer is never stranded in an empty filtered list.
- **Doc-type-neutral tone.** The current copy ("Press Enter on the slug line to start one") teaches a screenplay-specific *mechanic* from a CORE-rendered surface. Direction: describe the catalogue's *purpose* ("Scenes will appear here as you write"), not the keystroke. Calmer, and correct as the platform grows beyond screenplays.
- **No illustration, no CTA button, no zero-state hero.** A big empty-state graphic or a "Create your first scene" button is dashboard onboarding — exactly the admin-panel impression to avoid. Muted text, centered, done.

---

## 12. Density Rules

Density should adapt to the script, but only along axes that never sacrifice the load-bearing tokens.

- **The current 28px row is the calm default** and matches the chrome-spacing philosophy. It is the right resting density for a feature script (~40–90 scenes).
- **Adaptive, not chaotic.** A long-form episodic script (200+ short scenes) genuinely benefits from a tighter row. Direction: a single **compact** option (either a setting, or an automatic step-down past a scene-count threshold) governed by **one density token** — never per-element nudges that drift out of sync.
- **What compresses, in order.** Under tightening, the *first* things to yield are Tier-2 modifiers — time-of-day, then the `INT.`/`EXT.` setting abbreviation. The number gutter, the location, and the reserved signal margin **never** compress away; they are the surface's reason to exist.
- **Fixed margins regardless of density.** The signal/page tracks keep their width across densities, so the column rhythm and no-reflow guarantee survive the change.

> **Direction.** Density is a comfort dial, not a feature surface. It changes how much air a row has — never *what* the row means.

---

## 13. Hover / Focus Behavior

Three behavioral layers must coexist without muddiness: **hover** (transient, mouse), **selected** (intent, §2), and **current** (cursor position, §2).

- **Hover is a whisper.** A subtle `--bg-hover` lift and slight text brightening — and *nothing structural*. No buttons appear, no card expands, no tooltip card unfurls. The one acceptable reveal: the OS title tooltip exposing a long, ellipsised slug in full. Hover that spawns chrome makes the surface twitchy and turns scanning into a minefield.
- **No layout shift, ever.** Because hover/selected/current add fills, rails, and rings but the signal margin is pre-reserved (§1), no state change may reflow a row. This is the difference between a surface that feels solid and one that feels nervous.
- **Focus is keyboard-first and complete.** The list is focusable; Arrow Up/Down move *selection* without moving the cursor; Home/End jump to first/last; Enter bridges selection → cursor (navigates the editor); Escape clears. This existing model is correct — protect it. The focus ring must be clearly visible and distinct from both hover and current.
- **Click navigates, and confirms.** A single click moves the editor to the scene with the existing flash-confirm pulse (~1.2s). That confirmation is good interaction feedback — it answers "did it work?" without a modal or a toast. Keep it; keep it brief.
- **Power actions live behind right-click, not on hover.** Any future row actions (copy scene number, reveal in outline, etc.) belong in a context menu — never as hover-revealed buttons that fight the scan.

---

## 14. Writer Workflow Support

The catalogue serves one loop: **orient → navigate → return to writing.** Every behavior is judged by whether it speeds that loop or interrupts it.

- **Auto-scroll the current row into view — this is the spine.** The dominant lived weakness today: the writer types in scene 47 of a 60-scene script while the panel shows scenes 1–25, so the pink "you are here" marker points *off-screen*. The catalogue claims awareness while delivering none. When the current scene changes, the current row must come into view. This is the highest-value single behavior the surface can gain, and it is the safest first slice (see Closing §3).
  - It must be **functional, not theatrical**: instant alignment (`block: 'nearest'`), no decorative animation, and triggered only on an *actual* current-scene transition — never on every snapshot tick, and never fighting a deliberate manual scroll beyond bringing "here" back into view.
- **Click-to-jump + flash confirm** is the navigation core. Keep it.
- **Keyboard jump** (`Cmd+P` quick-scene-jump) is the power path; the find field (§10) is the discoverable path. Both serve "take me there."
- **Structural orientation for long scripts** — act/sequence grouping (collapsible) would genuinely help writers locate themselves in a 120-scene script. But it is **deferred, not directed**: the data model has no act/sequence concept, and surfacing one would require new per-scene data — which walks straight into the nav-index moratorium. Hold it as a future, gated behind that work.
- **Reordering scenes does NOT belong here.** Drag-to-reorder is a *structural edit* — management, not navigation. It belongs to outline/breakdown surfaces, not the writing navigator. The catalogue's gestures are: click (jump), keyboard (move selection / jump), right-click (peripheral actions). No drag handles.
- **Never add:** completion checkboxes, status toggles, assignment, "mark as done," color-by-status. Each is a small, reasonable-sounding step directly toward the dashboard the surface must not become.

---

## 15. What Belongs in the Inspector Instead

The catalogue answers **"which scene, and where am I?"** The inspector answers **"what's inside *this* scene?"** That division is the cleanest test for where a feature goes.

Route to the inspector (the contextual-depth surface, post-F1A.3/F1A.5):

- **Notes content** — the catalogue shows a presence mark; the inspector shows and edits the actual note text.
- **Tagged entities for the scene** — the characters, props, locations, wardrobe, SFX appearing in the selected scene (a future scene-detail inspector panel).
- **Revision history** — draft generations, change trail, flag detail.
- **Scene-level metadata editing** — renaming the location, changing time-of-day, slug corrections (inspector or inline-on-page — never an editable field in a navigator row).
- **Scene-level AI observations** — if/when they exist, gated behind the Alive App entry conditions.
- **Estimated duration** — when a model exists, the per-scene figure is inspector detail, not row chrome.

> **Direction.** A catalogue row should never become editable in place or expandable into a detail card. The instant a row tries to *hold* scene content rather than *point at* it, the inspector's reason to exist evaporates and the navigator inherits a job it is the wrong shape for.

---

## 16. What Belongs in Breakdown Mode Instead

Breakdown mode is the rail-switched secondary surface for production work. Everything inventory-shaped lives there — and is kept *out* of the writing catalogue.

Route to breakdown mode:

- **The category accordion from the screenshot** — `CAST (5)`, `EXTRAS (1)`, `PROPS (8)`, `SET DRESSING (3)`, `STUNTS (14)`, `SOUND (4)`, etc. This is the literal admin panel; it is production inventory and it is the reason the writing sidebar must default to the *scene catalogue*, not this.
- **`ADD NEW CATEGORY` and category CMS actions** — content-management verbs, not writing verbs.
- **Cross-scene production queries** — "every scene with this character," "all night exteriors," tag-faceted filtering, element management.
- **Per-category counts and tallies** — the parenthetical-count interface pattern in its entirety.
- **Bulk operations, scheduling, stripboard, status tracking.**

The breakdown sidebar is a *deliberate mode the writer enters* (from the rail) to do breakdown work — not the ambient companion during writing. The two surfaces share the same physical sidebar zone but never the same default: **writing → scene catalogue; breakdown work → breakdown panel.** This separation is the central UX decision that keeps the editor feeling like a writing tool rather than a production database with a text field attached.

---

# Closing

## 1. Strongest current behavior

**The current-vs-selected SEPARATION INVARIANT.** The catalogue already distinguishes *current* (cursor position — passive, brand-pink edge rail, tied to `ScriptSession.currentScene`) from *selected* (keyboard intent — soft fill + ring) and lets them coexist on one row without collapsing into a single ambiguous "active" state. This is the mature, correct anatomy for a writing-first navigator: it separates *where you are* from *what you're looking at*. It is documented in code, enforced in CSS, and pinned by tests. It is the surface's best idea — build on it, never erode it.

## 2. Most important UX change

**Establish the scene catalogue as the sidebar's primary writing surface, and make "you are here" actually visible — by keeping the current row on-screen.** Two faces of one principle: the catalogue must *be* the default writing companion (not the breakdown accordion, which belongs in breakdown mode), and it must deliver the awareness it promises. Today the pink current marker points off-screen the moment the writer moves past the visible rows — the surface claims orientation while providing none. Auto-scrolling the current row into view on scene change converts the catalogue from a static list into a live "you are here" map. This is the highest-leverage change because it repairs the surface's core promise — awareness — at its weakest point.

## 3. Safest first implementation slice

**Auto-scroll the current row into view when the current scene changes (SN.1).** It is pure presentation behavior, isolated to the navigator panel: it touches no engine code, honors the nav-index moratorium (no new per-scene data), changes no CSS identity, and preserves the separation invariant, keyboard nav, click-to-jump, and empty state untouched. It must align instantly (no theatrical motion), fire only on a real current-scene transition, and only when the row is actually off-screen. Small, reversible, and it fixes the most-felt weakness — the correct first step before any visual-refinement slice.

## 4. Highest-risk change to avoid

**Letting the catalogue become a management surface.** Every step toward inventory — per-scene tag/character counts, duration columns, status toggles or completion checkboxes, location color-coding, drag-to-reorder, faceted/saved filters, or promoting the breakdown accordion back into the writing default — pulls the surface toward the admin-panel/dashboard the Doctrine explicitly rejects, and most of it also collides with the nav-index moratorium (new per-scene data is off-limits). The related, subtler trap: making *current* louder to "fix" its visibility (a fill or bright highlight) when the real problem is positional, solved by scrolling (§2, Closing §3). Guard the row's calm; it is a spent budget, not a canvas.

## 5. STOP

This is UX Direction only. No implementation has begun, no code has been written, and no engineering plan beyond the single recommended first slice has been authored. The numbering, indexing, and schema constraints (the nav-index moratorium, engine freeze) are treated as immovable. The next decision — whether to authorize, amend, or reject the recommended first slice and this direction — belongs to the user, not to this document.
