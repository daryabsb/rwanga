# Scene Navigator Tags — Designer Handoff (Visual Polish)

**Status:** Functionality accepted and shipped. This is a **visual polish** pass only.
**Audience:** Designer.
**Engineering contact:** whoever picks up the implementation slice afterward.
**Shipped commits:** `9c0be990` (V1) → `0f7ce202` (V1.1 hybrid occurrence model).

> **Read the boundaries (§4) and the final reminder (§8) before proposing anything.**
> The data model, the search model, and the navigator architecture are **closed**.
> We are repainting a working surface, not rebuilding it.

---

## 1. Feature Summary (user language)

When a writer **expands a scene row** in the Scene Navigator (left sidebar, the
clapperboard "Scenes" panel), the row now reveals the **tag intelligence for
that one scene**:

- **Scene-local tagged entities** — only the entities actually tagged *inside this
  scene* (not the whole script's registry).
- **Categories** — Characters, Props, Wardrobe, Locations, SFX, VFX, Vehicles,
  Animals, Custom (only the non-empty ones show).
- **Per-scene occurrence count** — e.g. `NALI ·2` means NALI is tagged twice *in
  this scene*.
- **Occurrence snippets** — expanding an entity shows the actual screenplay
  wording around each tag (e.g. *"NALI stands by the window…"*), the tagged word
  emphasised.
- **Click-to-highlight** — clicking an entity row lights up all of that entity's
  tagged occurrences in the editor (a soft blue box).
- **Click-to-jump** — clicking an occurrence snippet moves the editor cursor to
  that exact occurrence.

The honest framing is deliberate: the label reads **"Tagged in this scene"** —
never "appears", "detected", or "referenced". Counts mean *tagged occurrences*.

---

## 2. How the Designer Can See It

1. **Open a sample file** in the Rwanga Editor (desktop app).
   - Primary (LTR): **`tests/fixtures/playground-the-last-light.rga`**
   - RTL check: **`tests/fixtures/mysterious-guest-rtl.rga`**
   - Both already contain tagged entities, so the feature shows immediately. (If
     you open a fresh/empty file, select a name in the script and use the toolbar
     **Tag…** dropdown to tag it first.)
2. **Open the Scene Navigator** — click the **clapperboard ("Scenes")** icon in
   the left activity rail. The scenes list appears.
3. **Expand a scene row** — click the **chevron** at the left of a scene number.
   The row reveals (in order): any **notes/flags** lines, then the **"Tagged in
   this scene"** zone with category groups and entity rows.
4. **Expand an entity row** — click the small **chevron on the entity row** (e.g.
   on `NALI ·2`). Its occurrence snippets appear beneath it.
5. **Click an occurrence snippet** — the editor jumps to that exact occurrence
   (the cursor lands on the tagged word).
6. **Click an entity row** (the name, not its chevron) — the editor **highlights**
   all of that entity's tagged occurrences (soft blue boxes, `.rga-tag-focus-active`).
   The cursor does **not** move.
7. **Observe the highlight** in the editor pane and how it relates to the panel
   selection. Click another entity to watch the highlight move.

> Tip: scenes with a chevron have either notes/flags or tags. A scene tagged but
> with no notes still gets a chevron and is expandable.

---

## 3. Current UI Problems to Review

These are the known visual weaknesses. Treat them as a starting checklist, not a
mandate — add your own observations.

- **Font too small on desktop.** The tag zone uses the smallest type ramp
  (`--font-size-xs`, ~10px). It's legible but cramped on a large display.
- **Weak typography hierarchy.** Category label, entity name, count, and snippet
  are all close in size/weight; the eye has trouble finding the structure.
- **Occurrence snippets too muted.** Snippets sit at `--text-tertiary`; the
  emphasised tagged word lifts only slightly. Reads as "disabled" rather than
  "secondary, clickable".
- **Horizontal/vertical density balance.** The list is vertical now (good), but
  the rhythm of gaps (3px zone / 1px group / 1px occurrence) may feel either too
  tight or arbitrary — wants a deliberate vertical rhythm.
- **Category labels need clearer personality.** Currently a plain secondary-text
  line ("Characters"). They could carry more identity (weight, case, color, or a
  per-category accent) without becoming loud.
- **Color dots underused.** Each entity has a small color dot (its tag color) but
  it's tiny (7px) and easy to miss; the relationship to the editor's tag color /
  the blue focus highlight could be clearer.
- **Duplicate warnings need styling review.** Duplicate same-named entities show
  an amber triangle (`--accent-warning`). It works but hasn't had a design pass
  for size/placement/contrast next to the count.
- **RTL readability.** Layout mirrors via logical CSS, but check real Arabic text:
  entity name + count + dot ordering, snippet truncation ellipses, chevron caret
  direction, and indentation side.
- **Nested indentation.** Three levels of inline-start indent (scene → tag zone
  → occurrences). Confirm the steps read as a clear hierarchy and align under the
  heading, not as accidental drift.
- **Separators / dividers.** There are none inside the expanded zone. Decide
  whether groups/entities want hairline separation or whitespace-only grouping.
- **Scene row vs expanded content relationship.** The expanded content currently
  flows directly under the row with no visual "container". Review whether the
  expansion needs a subtle background, rule, or inset to read as "belonging to"
  this scene.

---

## 4. Engineering Boundaries

**The designer MAY suggest changes to:**

- Typography scale (sizes, weights, line-height, casing, letter-spacing)
- Spacing (margins, padding, gaps, vertical rhythm, indentation steps)
- Category label style (weight, color, case, optional per-category accent)
- Tag entity row style (layout, dot size, count treatment, hover/active)
- Occurrence snippet style (color, emphasis of the matched word, truncation)
- Color usage (dots, accents, the relationship to the focus highlight)
- Warning icon treatment (size, color, placement, tooltip affordance)
- Hover / focus / active states
- RTL mirror polish

**The designer MUST NOT suggest:**

- A new data model or new fields
- A new search model / matching behavior
- Merge UI
- Autocomplete
- AI features
- A breakdown system
- A new panel architecture
- A full sidebar redesign

These are out of scope for this slice and would reopen accepted functionality.

---

## 5. Implementation Surface

Likely files an engineer will touch when applying your feedback:

| File | Role |
|---|---|
| `rwanga-editor/renderer/css/shell.css` | **Primary** — all the visual styling for the tag zone (search for `scene-navigator-scene-tags`, `-tag-group`, `-tag-entity`, `-tag-occurrence`). |
| `rwanga-editor/renderer/js/shell/panels/scene-navigator.js` | DOM structure of the tag zone (only touched if a change is *structural*, e.g. adding/reordering elements). |
| `rwanga-editor/renderer/js/doc-types/screenplay/plugins/scene-tag-occurrences.js` | The read-only data derivation (counts, wording, positions). **Not a visual file** — listed only so the designer knows where the data comes from. |
| `rwanga-editor/renderer/js/doc-types/screenplay/plugins/tag-focus-highlight.js` | The editor highlight on entity click (`.rga-tag-focus-active`). Style of the highlight box lives in `renderer/css/editor-prosemirror.css`. |

**Clarification:** Most visual changes should be **CSS-only, in `shell.css`** (the
editor highlight color lives in `editor-prosemirror.css`). The DOM structure in
`scene-navigator.js` only changes if you explicitly request a *structural* change
(e.g. "move the count before the name", "wrap the expansion in a card"). Flag
those as structure-changing (see §7).

### Key CSS hooks (class names you can reference in feedback)

- `.rga-shell-scene-navigator-scene-tags` — the whole expanded tag zone
- `.rga-shell-scene-navigator-scene-tags-label` — the "Tagged in this scene" label
- `.rga-shell-scene-navigator-tag-group` / `-tag-group-label` — a category block / its label
- `.rga-shell-scene-navigator-tag-entity` — an entity row (clickable)
- `.rga-shell-scene-navigator-tag-entity-chevron` — the entity's expand caret
- `.rga-shell-scene-navigator-tag-dot` — the entity color dot
- `.rga-shell-scene-navigator-tag-entity-name` — the entity name
- `.rga-shell-scene-navigator-tag-entity-count` — the per-scene count (`·2`)
- `.rga-shell-scene-navigator-tag-entity-dup` — the duplicate-identity warning marker
- `.rga-shell-scene-navigator-tag-occurrences` — the occurrence snippet list
- `.rga-shell-scene-navigator-tag-occurrence` — one snippet (clickable → jump)
- `.rga-shell-scene-navigator-tag-occurrence-match` — the emphasised tagged word
- `.rga-tag-focus-active` — the editor highlight box (in `editor-prosemirror.css`)

---

## 6. States the Designer Must Cover

Please provide feedback for each of these states (screenshots welcome):

1. **Collapsed scene row** (default — chevron only).
2. **Expanded scene with only notes/flags** (no tags).
3. **Expanded scene with tags** (categories + entity rows + counts).
4. **Expanded entity with occurrence snippets** (the wording lines).
5. **Duplicate entity warning** (two same-named entities, amber marker).
6. **Active / focused entity** (after clicking an entity row — panel state + the
   editor highlight relationship).
7. **Clicked occurrence** (after a jump — what, if anything, should the panel show).
8. **Empty scene** (no notes, no tags — should have no chevron, nothing to expand).
9. **RTL expanded scene** (`mysterious-guest-rtl.rga`).
10. **Narrow sidebar / compact density** (drag the sidebar narrow — how do counts,
    names, and snippets behave with truncation).

---

## 7. Response Format Required From the Designer

Send feedback in **implementable language** — one entry per change:

```
Change #
- Target area:        e.g. ".rga-shell-scene-navigator-tag-occurrence" / "the snippet line"
- Current problem:    what reads wrong today
- Desired result:     the visual/behavioral outcome (be concrete: size, weight, color token, spacing)
- Priority:           P0 (must) / P1 (should) / P2 (nice-to-have)
- Type:               CSS-only  |  structure-changing
- Annotation:         attach an annotated screenshot if possible
```

Notes:

- Prefer **existing design tokens** (e.g. `--text-primary`, `--text-secondary`,
  `--font-size-sm`, `--accent-warning`) over hard-coded values; if a new token is
  genuinely needed, call it out explicitly.
- If a change is **structure-changing**, say so — it requires a `scene-navigator.js`
  edit and a heavier engineering review, so we batch those.
- Group your changes by state (§6) so we can review them in context.

---

## 8. Final Reminder

- This is **visual polish only**. The functionality is **accepted** — do not
  reopen it.
- **Do not redesign the sidebar.** The panel architecture, the activity rail, and
  the scene list are fixed.
- **Do not propose new behavior** (search, merge, autocomplete, AI, breakdowns,
  new data). See §4.
- Engineers wire behavior; **designers own visuals**. Hand back concrete,
  token-aware, state-by-state notes and engineering will implement them cleanly in
  a follow-up slice.
