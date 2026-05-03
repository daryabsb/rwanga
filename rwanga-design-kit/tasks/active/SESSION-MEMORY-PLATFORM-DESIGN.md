# Session Memory — Platform Design (Review System Redesign)

**Last updated:** 2 May 2026  
**Purpose:** Context for any session that works on Rwanga platform UI/UX design, especially the review system.

---

## What is Rwanga?

Rwanga (ڕوانگە) is a Kurdish cinema preproduction platform. Tech stack: Django 5 + DRF, Celery + Redis, HTMX, WeasyPrint, MCP Server (TypeScript). The current project is "Mysterious Guest" (میوانێکی نادیار) directed by Sarwar.

The platform handles: project creation, screenplay upload, story bible management, bible reviews with decisions (propose/lock/reject), scenes, characters, locations, shots, floor plans, and export templates (call sheets, shot lists, scene viewer).

---

## The Review System — Current State

The review system exists and works. A bible review takes a snapshot of the story bible and generates decisions — structural questions the director needs to settle. Decisions can be proposed, locked (accepted), or rejected.

**What's live:**
- ReviewDecision model with status workflow (proposed → locked/rejected)
- Decision CRUD via API and MCP tools
- Comment system on decisions
- Basic review list view

**What's NOT live:**
- Bible section parser (connecting bible text to decisions)
- Decision-to-scene mapping (which decisions govern which scenes)
- Interactive bible viewer
- Chain visualization
- Expression types / intensity on decisions
- Bible ↔ Script toggle

---

## Design Principles (locked from consultant sessions)

These came from 2 rounds of feedback between the AI agent and Sarwar (acting as consultant). Darya mediates the process. These are NOT to be reopened:

### 1. Bible as Lens
The bible is an analytical overlay on the screenplay — it doesn't replace the script, it illuminates it. Each bible section is a "lens" — a ≤50 word summary that defines the RULE a scene obeys, not what happens in the scene.

**Rule:** "A lens should not describe the scene. It should define the rule the scene obeys."

**Example (Scene 21):** "When mediation reaches its peak, it becomes art. Nali doesn't hide the body — he stages a performance that makes the body invisible. Director and killer are the same role. This is D15 in its complete form: mediation as art."

### 2. Director Workbench (3 Tabs)
The director's review experience has three tabs:

1. **Active Decisions** — Unsettled decisions only. Accept/reject inline. Bible highlights on click.
2. **Locked Decisions** — Past conclusions. Read-only, collapsed.
3. **Full Bible** — Complete bible text, no overlay. For reading straight through.

Plus a toggle: **Bible ↔ Script** — switches the right panel between the analytical summary (1-2 pages) and the full screenplay.

### 3. North Star
> "Rwanga's review system is an interactive analytical overlay on the screenplay — where clicking a decision illuminates the story moment it governs, and the bible is the bridge between structural analysis and the actual film that gets shot."

### 4. Decision Display — Not Tags, Trajectories
When a user clicks a decision (e.g., D15 — Mediation), they should NOT see 5 equally-highlighted scenes. They should see an **arrow** — from low/emotional through peak/artistic to collapse/broken. The visual language should encode escalation, not just presence.

Each decision appearance has:
- **Expression type:** emotional, behavioral, artistic, memory, broken
- **Intensity:** low, medium, peak, collapse
- **Function:** what the system does here (stabilize, control, overwrite, fail)
- **Transition:** how it moved from the previous state

### 5. Chains, Not Isolated Decisions
Decisions form chains — groups where settling one forces you to settle the others because they share structural logic across scenes. The review system should support viewing decisions as chains, not just individual items.

The D15 chain example:
```
Scene 3          Scene 13         Scene 21         Scene 34         Scene 37
ESTABLISH   →    ENFORCE     →    PEAK        →    FRACTURE    →    SUSPEND
emotional        behavioral       artistic         broken           broken (held)
low              medium           peak             collapse         collapse (sustained)
```

### 6. Three Director Archetypes
The system should work for:
- **Passive director:** Just reads the bible, trusts the analysis
- **Tech-savvy director:** Wants to see the data, click through mappings
- **Collaborative director:** Works with consultant, uses review as discussion tool

### 7. Lens Format
- ≤50 words
- English (Kurdish handled by translator separately)
- Rule-defining, not descriptive
- Uses vocabulary of locked decisions (certainty, mediation, system, self-destruction)
- Points forward or backward to other moments in the chain

---

## Current Decision Inventory

**Review ID:** `96f026e7-a45c-4e04-b604-c208aede15b7`
**Project ID:** `b7821ef2-bef1-4527-b192-625ac0977aa5`

- **25 locked decisions** from reviews v1 and v2 (covering system identification, Act 2A problem, bomb model, AI role, hidden timer, scene preservation, couch condition, twist, sherbet, Nali's flaw, genre, dual-edge scenes, audience > Nali, behavior law, mediation as structural law, AI observation boundary, certainty as fundamental problem, single twist principle, structure emphasis, central tension, and 5 new/elevated decisions from v3)
- **19 proposed (unsettled) decisions** from v03 (covering: final twist, Nali's character, Gesha's character, AI role depth, couch as symbol, locked room, Truth or Dare, Edib's death, Gesha's death, skincare mask, sherbet, AI grammar, opening montage, Chekhov mirror, gardener, Evin's revelation, house as system, ending, Nali's most human moment)

The 19 unsettled decisions have been organized into 4 chains (see `SESSION-MEMORY-CHAINS.md` for full details with decision IDs and scene traces):
- **Chain A:** Gesha's arc (5 decisions)
- **Chain B:** Physical world (3 decisions)
- **Chain C:** Film architecture (5 decisions)
- **Chain D:** Nali's system (6 decisions)

Sarwar is currently choosing which chain to work through first.

---

## Brand & Template System

All documents use the Rwanga export template brand:
- **Templates location:** `rwanga-design-kit/templates/exports/`
- **Preview file:** `preview.html` (shows call sheet, shot list, scene viewer)
- **Colors:** Pink #F72585 (primary), Amber #D4A574 (accent), Dark amber #9A5520
- **Backgrounds:** #0F0F12 (dark), #17171C (surface), #F7F7FA (light)
- **Text:** #EDEAD8 (light on dark), #0F0F12 (dark on light), #5C5C70 (muted), #A0A0B8 (dim)
- **Fonts:** Cairo (Arabic/Kurdish), Inter (Latin/numbers)
- **Logo:** Pink square with ڕ
- **PDF format:** A4, Cairo font, with .pdf-page wrapper

---

## UX References

- **Filmustage "AI Dude"** — cited as UX reference for how an AI assistant can surface insights in a production tool without being intrusive
- **Split-screen viewer** — bible on left, screenplay on right, with highlighting sync

---

## Engineering Context

The Django models exist. Key ones for review:
- `BibleReview` — snapshot of bible at review time
- `ReviewDecision` — the decision with topic, text, status, lock_comment, reject_reason
- `BibleSection` — M2M to Scene and ReviewDecision (not yet built as viewer)
- `Scene` — 43 scenes in the screenplay
- `Script` — the screenplay document

MCP tools available for all CRUD operations on decisions, reviews, scenes, etc.

**Not yet built (engineering tasks from previous session):**
- Bible section parser
- Manual decision-to-section mapping
- Split-screen viewer
- Expression type fields on ReviewDecision model
- Chain visualization component
- PDF export of review with chains

---

## What to do in a platform design session

1. Read this file first
2. Read the brand templates at `rwanga-design-kit/templates/exports/preview.html`
3. Design work can proceed on:
   - Review UI redesign (3-tab workbench)
   - Decision display with expression types
   - Chain visualization component
   - Bible ↔ Script toggle
   - Decision-to-scene mapping UI
4. Do NOT:
   - Reopen locked design principles
   - Wait for Sarwar's chain response (that's content, not design)
   - Write Kurdish (translator handles it)
   - Skip reading the brand templates

---

## Key files

- `rwanga-design-kit/tasks/active/SESSION-MEMORY-CHAINS.md` — Chain exercise context
- `rwanga-design-kit/tasks/active/SESSION-MEMORY-PLATFORM-DESIGN.md` — THIS FILE
- `rwanga-design-kit/tasks/active/SARWAR-CHAIN-BRIEF.html` — Brief given to Sarwar
- `rwanga-design-kit/tasks/active/D15-MEDIATION-CHAIN.md` — Example of a completed chain
- `rwanga-design-kit/tasks/active/LENS-PROTOTYPE-EXERCISE.md` — 8 scene lenses
- `rwanga-design-kit/tasks/active/CONSULTANT-SESSION-2-RESPONSE.md` — Consultant response
- `rwanga-design-kit/tasks/active/CONSULTANT-SESSION-2-BRIEFING.md` — Initial briefing
- `rwanga-design-kit/tasks/active/CONSULTANT-BRIEF-REVIEW-REDESIGN.md` — Original 9-section brainstorming brief
- `rwanga-design-kit/templates/exports/preview.html` — Brand template system
