# Scene Navigator v1 — Engineering Review

> **Engineering challenge of the designer package, as if implementation starts tomorrow.**
> Date: 2026-06-02 · Reviewer posture: senior engineer · Not UX feedback, not doctrine, not a new design, not code.
> Inputs read: `SCENE_NAVIGATOR_V1_UX_DIRECTION.md`, `Scene Navigator v1 Wireframes.html`, and the **actual implementation**: `renderer/js/shell/panels/scene-navigator.js`, `renderer/js/framework/nav-index.js`, plus the existing e2e/unit coverage.

---

## The two facts that govern everything below

Before the section answers, two ground truths from the code that the design does not account for:

**Fact 1 — `nav-index` does not expose what the new features need.** `idx.scenes[]` carries `nodeId, sceneNumber, pmPos, pmEndPos, headingDisplay, setting, locationText, time, transitionDisplay, blockCount, hasNotes, hasRevisionFlag` (`nav-index.js:187-201`). It carries **no scene body text** and **no per-scene character list**. `idx.characters[]` exists but is **tag-mark + `tagRegistry` derived** (`_composeTagsAndCharacters`, `nav-index.js:271-311`) and is indexed the *wrong way* for expansion: `sceneAppearances` is characters→scenes, not scene→characters. Full-text search and the "characters in this scene" tier both want data that isn't there — and the design itself names a **"nav-index moratorium"** as immovable. That is the central tension of the whole package.

**Fact 2 — the navigator re-renders by full DOM teardown on every ScriptSession tick.** `_render()` does `_container.innerHTML = ''` and rebuilds the entire list (`scene-navigator.js:95-138`), wired to fire on every `ScriptSession.subscribe` callback (`:56-58`). It already needs a focus-restore hack to survive a writer typing in the find field (`_captureFindInputFocus`/`_restoreFindInputFocus`, `:169-189`). Separately, the nav-index plugin rebuilds the **entire index + the full Normalizer→LayoutProfile→PageMap pipeline on every `docChanged`** (`nav-index.js:487-490, 423-458`). Every new feature (search snippets, expansion children, highlights) multiplies the cost of this already-per-keystroke teardown.

Everything that follows is a consequence of these two facts.

---

## 1. What is strong

- **The change order is *mostly* correctly risk-ranked at the top.** Auto-scroll first, schema-untouched throughout, "no new per-scene schema fields" — these are real and correct. schema-v3 is locked; the design respects it, and nothing here needs a schema change. The gaps are about *derivation/exposure*, not the schema.
- **Auto-scroll (SN.1) is already shipped and correct.** `block:'nearest'` + the "only on actual scene transition" guard (`scene-navigator.js:151-156`) is exactly the calm behavior the design asks for. This item is **done**, not future work — the ship order should say so.
- **The Marks tier is genuinely cheap.** `hasNotes`/`hasRevisionFlag` already exist on every scene entry (`nav-index.js:199-200`), and `idx.notes[]`/`idx.flags[]` already carry scene linkage. "Presence, not counts" maps onto data that is already computed for free. This is the one expansion tier that needs no new derivation.
- **The current/selected separation invariant is already implemented and load-bearing** (`scene-navigator.js:298-307`). The design preserves it; engineering should treat it as a hard constraint through every new interaction.
- **Rejecting the Filmustage inventory model is the right call for the data model, not just the philosophy** — see §5. Props/SFX/wardrobe require both Breakdown mode (which does not exist — P3/FALSE in the launch checklist) *and* tagging discipline. Keeping them out avoids shipping a feature with no backing surface.

## 2. What is weak

- **"Screenplay search" has no data source today and the design treats it as a swap.** §5/Migration says "replace slug-matching with screenplay-text search." But the existing search (`_applyFilter`, `scene-navigator.js:271-279`) matches `sceneNumber` + `headingDisplay` *because those are the only fields it has*. Full-text needs body text, which lives only in `view.state.doc`. So search is not a "swap" — it requires a new doc-walk (or a new cached text index), per query keystroke, O(doc size). The design's framing hides a whole subsystem.
- **The "characters are derived directly from the script, not a breakdown database" claim is not true of this codebase.** In the current model, characters and props come from the **same** mechanism: tag marks + `tagRegistry` (`nav-index.js:289-310`). A character cue with no tag-mark contributes nothing to `idx.characters`. To list speaking characters from the *parse* (untagged), you must walk each scene's `character` cue blocks for raw text — a new path nav-index does not provide. The design's central justification for "characters in, props out" does not map onto the implementation, where the two are symmetric.
- **Character-anchor navigation has no position to jump to.** "Click → scrolls to their first line in this scene" needs the pmPos of a specific character cue within a scene. `scrollToScene` only resolves scene nodes (`scene-navigator.js:374-407` via `Rga.Nav.findScene`). There is no per-cue position lookup anywhere.
- **Search-result navigation has no mechanism.** Clicking a snippet must scroll to a **text-match position**, not a scene. No `scrollToPos`/`scrollToMatch` exists; only `scrollToScene`. And a stored match position is ephemeral (text shifts on edit), like `pmPos`/`sceneNumber` (`nav-index.js:37-41`) — it must be resolved at click time, not cached.
- **"Escape restores Mode A at its previous scroll position" is unbuilt state.** The current model is a filter-in-place, not a Mode-A↔Mode-B switch; no scroll position is captured or restored. Mode B is a larger change than the existing filter.

## 3. What is risky

- **In-editor highlight is the biggest hidden dependency, and the design treats it as a footnote.** "All occurrences → ambient highlight; selected result → strong highlight" (§2, §Highlight) is a **new ProseMirror decoration plugin** that (a) recomputes on every query keystroke *and* every docChange, (b) must compose with the decorations nav-index already owns — scene-number `NodeDecoration`s + page-break widgets (`nav-index.js:346-377`), and (c) touches the **LOCKED** editor framework. This is real, framework-adjacent work disguised as a one-liner. It is the single riskiest item in the package and it is buried in a bullet.
- **The per-tick full DOM teardown is the architectural weak point everything else stresses.** Expansion children, search snippets, and re-render-on-keystroke all pile onto a model that already wipes and rebuilds the whole list every tick and needs a focus hack to stay usable (`scene-navigator.js:89-93, 169-189`). Add expansion state that must survive teardown (like `_filterText` does, `:281-291`) and you are re-rendering N rows + all expanded children + all snippets on every editor keystroke.
- **The nav-index moratorium collides head-on with two v1 features.** Full-text search wants per-scene text; the Characters tier wants scene→character. The clean home for both is nav-index — which is frozen. Either the moratorium bends (a governance decision, not an engineering one) or both features grow bespoke doc-walks in the navigator that duplicate what nav-index is *for*. This conflict must be resolved **before** the search/expansion slices start, or they will stall mid-implementation.
- **The "Breakdown →" gateway points at a surface that does not exist.** Breakdown mode is unimplemented (launch checklist BD-\* = FALSE/P3). Shipping the affordance now means shipping a dead link or a stub. Either defer the gateway or gate it behind Breakdown mode existing.
- **Act group headers are blocked on a model addition that is fenced.** "Derived from the document's structural markers" — schema-v3 (LOCKED) has no act node. The Large-Script wireframe (act groups) is partly un-buildable today; the density part is fine, the act-grouping part is not.
- **Keyboard model overload.** The code already runs `inFindInput` gymnastics for Home/End/Enter/Escape (`scene-navigator.js:432-508`) and a two-stage Escape (clear filter → clear selection, `:484-505`). The design adds Space/←/→ for expand/collapse *and* a third Escape meaning (exit search → restore scroll). Arrow keys would now mean three things depending on focus (text cursor in find / selection move / nothing) and Escape three things. This is a coherence risk, not just extra code.

## 4. What is over-designed

- **Mode A ↔ Mode B as a full surface switch.** The current filter-in-place already delivers "type → see only matching scenes." A whole second mode with snippet layout, results header (`"N results · M scenes"`), scroll capture/restore, and a distinct empty state is more surface than the first useful increment needs.
- **Two highlight intensities ("ambient" + "strong", simultaneously visible).** This doubles the decoration work (two decoration classes, two update paths) for a refinement most writers will not notice on the first cut. One highlight, or none, is enough for v1.
- **The two-tier expansion shipped together.** Marks (free) and Characters (new derivation + new navigation target) are bundled as one "Expandable scenes" slice. They have wildly different costs and should not ship together.
- **"Multiple scenes expanded simultaneously" + "instant, no animation" + chevron-vs-row target separation in a 30px gutter.** The simultaneous-expansion requirement multiplies the re-render cost and the state to persist across teardown, for marginal value over single-expand. The chevron target lives *inside* the number gutter beside a 3px rail — a tight click-target split needing `stopPropagation`, easy to get wrong.
- **Snippet context "before · match · after, ordered by screenplay position, grouped by scene."** Each refinement (snippet windowing, multi-hit stacking under one slug, spatial ordering) is a separate piece of doc-walk logic. Worthwhile eventually; over-scoped for the first search slice.

## 5. What can be simplified

- **Split search into "results panel" vs "editor highlight."** The results panel (walk doc, render snippets, navigate) is navigator-local and shippable. The editor highlight is heavy, framework-touching, and separable. The design bundles them ("two intensities; one truth"); engineering should cleave the highlight for last.
- **Make the first search a body-aware extension of the *existing* filter, not Mode B.** Extend `_applyFilter` to also match each scene's `textContent` (one extra doc-walk, debounced), render a one-line snippet under matching rows, and reuse `scrollToScene` to jump to the scene (not the exact line). This delivers the headline value — "search the screenplay, not just the slug" — while touching **nothing locked**: no nav-index change, no new decoration plugin, no `scrollToPos`, no character resolution.
- **Ship Marks expansion alone first.** It needs no new data and proves the expand interaction, the chevron target, and the keyboard additions on the cheapest possible content.
- **Defer character-anchor *navigation* even if you show the character list.** Listing speaking characters (read-only) is far cheaper than making each one a precise jump target. Show them before you make them clickable.
- **Relax the absolute "no counts" rule only if/when convenient — the data is free.** `cueCount`/`mentionCount`/`sceneAppearances` are already computed (`nav-index.js:300-307`). Banning all counts is a design choice with zero data cost to reverse later; no need to engineer against it now.
- **Drop the Breakdown gateway from v1** until Breakdown mode exists; it is a rail-switch to nowhere today.

### On the Filmustage rejection (was it correct?)
**Yes, for the right engineering reason.** Props/SFX/wardrobe inventory needs Breakdown mode (absent) *and* consistent tagging (`tagRegistry` + tag marks). The minimal subset worth preserving is exactly what the design already keeps: **the expand-to-reveal interaction** and a **per-scene character presence**. The one caveat: in this codebase characters are *not* more "parse-native" than props (same tag pipeline) — so if "characters without tagging" is the promise, that is new walk code, not a free consequence of the rejection.

## 6. Recommended ship order

The design's order is **Auto-scroll → Search → Expansion → Density**. Engineering would change it, because it front-loads the heaviest, most-coupled item (full search + highlight) and leaves the render-model risk (which every feature stresses) for last.

**Recommended:**

0. **Auto-scroll (SN.1) — already shipped.** Acknowledge as done; not a future slice.
1. **Render-model hardening / density.** Stop the full-`innerHTML` teardown-per-tick, or at minimum verify it at 300 scenes and add the CSS density step-down. This de-risks *every* slice below it, since they all add to the per-tick rebuild. Pull this *forward* from #4.
2. **Marks expansion.** Cheapest real expansion (data exists); proves the chevron target + expand keyboard on free content.
3. **Body-text search — results only.** Debounced doc-walk + snippet + jump-to-scene via existing `scrollToScene`. No editor highlight, no line precision, no Mode B. Highest headline value at lowest coupling.
4. **Characters expansion (list, then navigation).** Per-scene speaking-character derivation; make clickable only once `scrollToPos` exists.
5. **Search line-precision + in-editor highlight.** The heavy, framework-touching decoration work, done deliberately last with its own gates (decoration composition with nav-index, performance under typing).

**Blocked / out of this sequence:** Breakdown gateway (needs Breakdown mode), Act group headers (needs an act marker in a LOCKED schema). Do not sequence them as if they are ready.

## 7. Smallest valuable implementation path

The repository already provides: slug+number filter, auto-scroll, current/selected separation, `scrollToScene`, keyboard nav, and per-scene note/flag presence. The smallest increment that delivers the design's *headline* promise ("find any word in the screenplay, not just the slug") **without touching anything locked**:

> **Extend the existing filter to match scene body text and show a one-line snippet, still jumping with `scrollToScene`.**
>
> - Walk each scene node's `textContent` inside `_applyFilter` (debounced on input).
> - Keep the result a filtered **Mode-A list** (no Mode B, no scroll capture/restore).
> - Render a single context snippet under matching rows.
> - Reuse `scrollToScene(nodeId)` — jump to the scene, not the exact line.
> - **No** nav-index change, **no** new decoration plugin, **no** `scrollToPos`, **no** character resolution, **no** editor highlight.

This is one file, one new doc-walk, zero locked-surface contact, and it converts "search the table of contents" into "search the book" at the scene granularity. Line-precision, highlight, characters, and Mode B then layer on top as the separately-gated slices in §6 — each with a clear, isolated dependency rather than the current package's all-at-once coupling.

The single decision that must precede *any* of this: **resolve the nav-index moratorium vs. the data full-text/characters need.** Until that is answered, search and the Characters tier have no sanctioned home for their data.

---

## STOP

Engineering review only. No new design, no code, no feature plan produced. The existing package is implementable, but not in the order or scope it proposes: split search from highlight, ship Marks before Characters, pull render-model/density forward, and settle the nav-index moratorium first.
