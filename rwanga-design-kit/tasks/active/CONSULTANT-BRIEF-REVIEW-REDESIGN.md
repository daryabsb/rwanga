# Rwanga Review System Redesign — Brainstorming Brief

**Date:** 2 May 2026  
**From:** Darya Ibrahim (Platform Lead)  
**To:** Sarwar (Director / Consultant)  
**Subject:** The review detail page is broken. But the real problem is deeper — the bible needs to become an interactive layer on the screenplay, not a standalone document. This brief covers everything we discovered today and proposes a direction for discussion.

---

## 1. What Happened Today

We completed the canonical bible lifecycle: the Story Bible V3 (20,332 characters of Kurdish analytical text) was loaded into the Mysterious Guest project, and 25 review decisions were seeded — the same 20 locked conclusions from V1/V2 plus 3 V3 upgrades (D9↑ sherbet, D17↑ certainty, D20↑ house-as-system) and 2 new principles (Reality Replacement, Bilateral Tragedy).

When we looked at the result on the live platform, it was unusable:

**Problem 1 — Flat structure.** All 45 decisions (20 bad ones from a first failed attempt + 25 correct ones) dumped in a single scrollable list. No grouping, no status tags, no narrative. Sarwar would need to scroll through everything to find what needs his attention. The review we designed (the 4-tab HTML with Previous Reviews → V3 Analysis → Bible → Conversation Log) has editorial structure and tells a story. The platform has none of that.

**Problem 2 — Empty bible tab.** The bible tab says "no content" even though the project's `canonical_bible` field has 20K characters loaded. A view/template bug — the data exists but isn't being passed to the template.

**Problem 3 — Wrong badge counts.** Sidebar shows 19 on reviews, 3 on community. Both wrong. Test data pollution from engineering development.

**Problem 4 — No separation of actionable vs. settled.** The director needs to see ONLY what requires his action (proposed/unsettled decisions) front and center. The 25 locked conclusions from past reviews are reference material — important, but not the work queue. Currently everything is mixed together.

**Problem 5 — The bible is disconnected from decisions.** When Sarwar reads D9 (شڕوبی — self-destruction in despair), there's nothing linking that decision to the actual moment in the story it refers to. He reads the analytical conclusion in isolation. He has to mentally map it back to the screenplay himself.

---

## 2. The Core Insight

The bible is Rwanga's invention. Directors don't ask for bibles — they ask for better scripts. The bible is an analytical layer we create FROM the screenplay to extract structural DNA (system rules, character spines, tension mechanics, thematic principles). We use it to make precise decisions. Those decisions improve the screenplay. The deliverable back to the director is always a refined screenplay, not the bible.

**The pipeline is:**

```
Screenplay (source) → Bible (our analysis) → Decisions (reviews) → Screenplay (refined)
```

Right now the platform treats these as three disconnected things. The screenplay lives in the script upload. The bible lives in `canonical_bible`. The decisions live in `ReviewDecision`. There's no mapping between them.

**What we need is a live, bidirectional mapping:**

```
Script Scene 16 (Nali says the cruel line)
    ↕ mapped to
Bible Section "شڕوبی" (sherbet analysis)
    ↕ mapped to  
Decision D9 (this is self-destruction, not fun)
```

When any layer changes, the others know about it.

---

## 3. The Interactive Bible Viewer

Instead of a flat decision list + empty bible tab, the review detail becomes a **decision-driven bible reader**.

### The View

Two zones: a decisions panel and a bible/script panel. The bible is the default view — the director sees the analytical summary (1-2 pages). An action lets him switch to full script view (all scenes, full detail).

### The Interaction

The director clicks on D9 (شڕوبی). The decision card expands, showing the full conclusion, the V1→V3 evolution, the lock comment, the status tag. Simultaneously, the bible panel scrolls to the sherbet section and highlights it — like switching on a light. The surrounding text stays readable but recedes. The director reads the analytical principle in context of the story moment it describes.

If the director switches to full script view, clicking D9 highlights Scene 16 in the actual screenplay — the dialogue where Nali says the cruel line, the action where Gesha eats the sherbet in despair. He sees exactly what will be shot, illuminated by the analytical decision.

### The Tab Structure

**Tab 1 — بڕیارە نوێیەکان (Active/Unsettled):** Only proposed decisions needing the director's action. Accept/reject/comment controls inline. Bible highlights on click. This is the WORK tab. This is what the director sees first.

**Tab 2 — بڕیارە جێگیرکراوەکان (Settled Conclusions):** The locked decisions from past reviews. Read-only, collapsed by default. Same interactive highlighting when expanded. This is the REFERENCE tab.

**Tab 3 — بایبڵ (Full Bible):** The bible on its own, no decision overlay. For reading the story straight through.

**Toggle: بایبڵ ↔ سکریپت (Bible ↔ Script):** Switch the right panel between the analytical summary (bible, 1-2 pages) and the full screenplay (all scenes). Highlighting works in both views.

### Reference: Filmustage

Filmustage (filmustage.com) has an "AI Dude" feature that does something similar for script breakdowns. Their script viewer lets you click on elements (characters, props, locations) and highlights them in the script. The script is color-coded by element type. You can add notes inline. Their approach: AI parses the script, identifies elements per scene, creates a bidirectional map, and the UI lets you navigate by element or by scene.

Our version is deeper — we're not mapping props and characters, we're mapping analytical principles and structural decisions to story moments. But the UX pattern is the same: click an analytical element → the script illuminates the relevant section.

---

## 4. Three Director Archetypes

The system needs to serve all of these:

### Archetype 1 — Passive Director (Sarwar's case)

Gives us the complete screenplay. We analyze it, create the bible, run adversarial reviews, lock decisions. He reviews the conclusions and approves/rejects. We deliver a refined screenplay back.

**Platform need:** Interactive bible viewer with decision queue. Export to PDF for sharing. Full screenplay with highlighted decisions.

### Archetype 2 — Tech-Savvy Director

Writes or pastes their own script directly into Rwanga. Maybe uses a different AI agent. We receive the script, run analysis (Celery task), auto-generate a bible. The mapping is created during analysis — AI identifies which script sections correspond to which analytical principles.

**Platform need:** Script editor/uploader → automatic bible generation → decision-driven review process. The director never touches the bible directly.

### Archetype 3 — Collaborative Director

Participates actively. Might edit bible sections directly — overriding our analysis. When they change a section, the system flags dependent decisions for re-review and notifies the team.

**Platform need:** Editable bible with change tracking, notification system, decision dependency graph. When Bible Section X changes → Decisions D3, D9 flagged as "needs re-review."

### The Zero-Tech-Knowledge User

Someone who doesn't understand AI, doesn't know what a "bible" is, doesn't care about analytical frameworks. They just want their script to be better.

**Platform need:** Hide the bible entirely. Show decisions as plain-language suggestions: "Scene 16 would be stronger if Gesha's action is despair, not fun." Accept/reject. The analytical machinery is invisible.

### The Expert User

Someone who understands AI systems, wants to see the full chain of reasoning, might challenge the analysis.

**Platform need:** Full transparency. Show the bible, the decision evolution (V1→V2→V3), the conversation logs, the adversarial debate. Let them drill into every layer.

---

## 5. The Mapping Architecture

### Current Data Model

```
Project
  ├── Script (uploaded file)
  ├── Scenes (43 scenes, parsed from script)
  ├── canonical_bible (JSON blob in Project model)
  └── BibleReview
       └── ReviewDecision (has optional scene FK)
```

### Proposed Data Model

```
Project
  ├── Script → Scenes (43 scenes)
  ├── Bible → BibleSections (parsed from canonical_bible)
  │    Each section: id, heading, content, anchor, char_range
  │    Maps to: one or more Scenes (M2M)
  ├── BibleReview
  │    └── ReviewDecision
  │         Maps to: one or more BibleSections (M2M)
  │         (replaces the single optional scene FK)
  └── Change tracking:
       Bible section edited → flag dependent decisions
       Script scene changed → flag dependent bible sections
```

### The BibleSection Model

```python
class BibleSection(models.Model):
    id = UUIDField(primary_key=True)
    project = ForeignKey(Project)
    heading = CharField()           # e.g., "شڕوبی"
    content = TextField()           # section content
    anchor = CharField()            # HTML anchor for scrolling
    order = IntegerField()          # display order
    scenes = ManyToManyField(Scene) # which script scenes this section covers
    
    # For change tracking
    last_edited_by = ForeignKey(User, null=True)
    last_edited_at = DateTimeField(null=True)
```

### The Mapping Process

**Option A — Manual mapping.** When creating decisions, the reviewer tags which bible sections and scenes are relevant. Precise but labor-intensive.

**Option B — AI-based mapping (recommended).** A Celery task runs when a decision is created or the bible is updated. It reads the decision text + bible content and identifies relevant sections using semantic similarity. Results are cached and stored as M2M relations.

**Option C — Hybrid.** AI suggests mappings, human confirms or adjusts. Best of both worlds.

---

## 6. Technology Available

The platform already has:

- **Django 5 + DRF** — backend and API
- **Celery + Redis** — async task processing (for AI mapping, bible parsing)
- **HTMX** — inline interactions without full page reloads
- **WeasyPrint** — PDF export (already used for call sheets, scene viewers)
- **MCP Server (TypeScript)** — external tool integration for AI agents
- **Caching layer** — for bible section parsing, mapping results
- **Any JS library** can be added — for the interactive viewer, consider:
  - **Mark.js** — text highlighting in DOM
  - **Split.js** — resizable split panels
  - **ScrollReveal / GSAP** — smooth scroll-to and highlight animations
  - **CodeMirror or ProseMirror** — if we want inline bible editing (Archetype 3)

---

## 7. Open Questions for Discussion

1. **Bible granularity.** The current bible is a single markdown document. Should we parse it into sections by heading? By paragraph? By concept? How fine-grained should the highlighting be?

2. **Script-bible mapping.** The bible references scenes by number (e.g., "دیمەنی ٣٧"). Should the mapping be automatic (AI reads the bible, extracts scene references) or manual? What about bible sections that span multiple scenes or reference abstract concepts rather than specific scenes?

3. **Director editing.** If Archetype 3 edits a bible section, what happens? Does the old version get preserved? Do dependent decisions get automatically un-locked? How do we prevent a director from accidentally invalidating months of review work?

4. **The zero-tech user.** How far do we simplify? Do we show them the bible at all, or do we translate everything into "here's what we suggest for Scene 16"? Is there a "simple mode" vs "expert mode"?

5. **Monetization angle.** If this is a business, what's the pricing model? Per-project? Subscription? Does the interactive bible viewer become a premium feature? Does the AI-mapping (Celery tasks) have a cost we need to pass on?

6. **The deliverable.** At the end of the review cycle, we deliver a refined screenplay. How does that work? Do we auto-generate script changes from locked decisions? Does the director manually incorporate them? Is there a "apply decisions to script" action?

7. **Multi-version tracking.** V1 → V2 → V3 reviews are already complex. If the bible changes between versions, how do we show the evolution? Diff views? Side-by-side? Timeline?

8. **Real-time collaboration.** Should multiple people (director, consultant, AI agent) be able to view the interactive bible simultaneously? Is this a future requirement or essential from the start?

---

## 8. What's Already Built vs. What Needs Building

### Already Built (working)
- Project model with canonical_bible JSON field
- BibleReview model with ReviewDecision (propose/lock/reject lifecycle)
- 25 correct decisions seeded and locked for Mysterious Guest
- MCP server with bible management tools (get/set/deliver/finalize)
- Export template system (WeasyPrint) with call sheet and scene viewer templates
- 43 scenes parsed and stored in the database
- Celery + Redis infrastructure operational

### Needs Fixing (engineering tasks ready)
- Delete 20 bad decisions (cleanup script written)
- Fix bible tab (pass content to template)
- Fix badge counts
- Fix super admin permissions for reject
- Fix synopsis metadata display

### Needs Designing (this discussion)
- Interactive bible viewer UX
- Bible-to-screenplay mapping system
- BibleSection model and M2M relations
- Decision-to-section highlighting
- Director archetype UI modes
- Review PDF export with interactive structure

### Needs Building (after design is settled)
- BibleSection parser (markdown → sections)
- AI mapping service (Celery task)
- Interactive viewer frontend (JS + HTMX)
- Split panel UI with highlight/scroll
- Bible editing mode with change tracking
- Script view with decision highlighting
- Review PDF export template

---

## 9. The One-Line Vision

**Rwanga's review system should be an interactive analytical overlay on the screenplay — where clicking a decision illuminates the story moment it governs, and the bible is the bridge between structural analysis and the actual film that gets shot.**

---

*This brief covers the full discussion from the May 2nd session. The consultant has context from the V1/V2/V3 review process and the 20 locked decisions. The technical infrastructure exists. What we need is the right UX architecture before building.*
