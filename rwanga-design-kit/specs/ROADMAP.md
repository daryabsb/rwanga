# Rwanga Production Agent — Roadmap to AI Dude Parity

This document is the **build plan** for evolving the Rwanga agent from "smart breakdown assistant" (what the SKILL.md covers today) to a full propose-preview-approve production agent on par with Filmustage's AI Dude.

The agent loop itself is mostly done — Claude with tool-calling over your MCP is exactly the right architecture. What's missing is **data surface area**. Every capability below maps to a specific data model + tool you'd add to Rwanga.

---

## Phase 1 — Today (already shipped)

What you have, and what the skill above already exploits:

- Projects, scenes, characters, locations, scripts
- Bulk creation for scenes and characters
- Gap/blocker tracking via tasks
- Multi-tenant studio model

**Agent capability unlocked:** end-to-end script breakdown, gap surfacing, project state review, conversational editing of any record. This alone matches Filmustage's *breakdown* product (one of their original four pillars).

---

## Phase 2 — Scheduling layer (the biggest unlock)

This is the single most valuable thing you can add. AI Dude's most-demoed trick — moving strips, catching cast conflicts, surfacing overtime — all lives here.

**Data models to add:**

- `ShootingDay` — date, unit, call time, wrap target, location(s)
- `Strip` — one per scene-on-a-day, ordered. A scene can be split across days (rare but real)
- `CastAvailability` — character → date ranges of available / hold / unavailable / conflict
- `LocationAvailability` — same shape, for locations
- `ScheduleConstraint` — per-project rules: max hours/day, turnaround minimum, child-actor limits, weather windows

**Tools to expose:**

- `bulk_create_shooting_days`, `add_strip`, `move_strip`, `reorder_day`
- `compute_dood` — Day-Out-Of-Days report from current strip order
- `analyze_schedule_conflicts` — returns structured list of: cast double-bookings, turnaround violations, location overlaps, overtime risk
- `propose_schedule` — given scenes + constraints, produce a draft strip order. This is the agent's killer feature: *"Optimize for fewest company moves"* / *"Group all interior nights into the back half"*

**Skill addition needed:** a new section in SKILL.md teaching the agent to always run `analyze_schedule_conflicts` after any strip change, and to present the diff (before/after) before committing.

**Effort estimate:** 3–6 weeks of backend work for the models and a basic constraint checker. The "optimizer" can start as a heuristic (group by location, then by cast cluster) and get smarter later — even a naive version is hugely useful.

---

## Phase 3 — Budgeting layer

Filmustage generates a budget template from breakdown + schedule. You can do the same with less surface area than they have.

**Data models to add:**

- `BudgetTemplate` — department + line items, with per-studio defaults
- `BudgetLine` — department, account code, description, qty, rate, unit, total. Linked optionally to a scene, character, or location
- `RateCard` — per-studio rates for cast, crew positions, equipment, locations. Regional (Kurdistan rates ≠ LA rates)

**Tools to expose:**

- `generate_budget_from_breakdown` — auto-creates lines for: cast (count × shoot days × rate), locations (days × day rate), VFX scenes (flagged complexity), props lists, etc.
- `update_budget_line`, `recalculate_budget`
- `compare_budget_versions` — for the "what if we cut 2 shoot days" conversation

**Skill addition needed:** the agent should always *propose* budget changes as a preview diff, never silently recalculate. Money is the most sensitive data in production.

**Effort estimate:** 4–8 weeks. The data model is straightforward; the hard part is the rate card library and getting regional defaults right. Start with one studio's actuals and grow.

---

## Phase 4 — VFX & complexity awareness

Right now scenes are flat. Add a complexity layer so the agent can reason about risk.

**Data additions:**

- `Scene.vfx_complexity` (none / minor / moderate / major / hero)
- `Scene.special_requirements` — flags for: stunts, weapons, water, animals, kids, crowd, vehicles, picture cars, weather-dependent
- `Scene.estimated_setup_time` — minutes to light/rig

**Why this matters for the agent:** with these flags, the agent can answer *"what are the 5 riskiest days in our schedule?"* — which is exactly the kind of question Filmustage demos.

**Effort estimate:** 1–2 weeks. Mostly schema + UI for tagging.

---

## Phase 5 — Call sheets & DOOD

Once you have shooting days and a strip board, call sheets are mostly templating.

**Tools to expose:**

- `generate_call_sheet` — for a given shooting day, produce: cast call times, crew calls, location, weather, nearest hospital, scenes shooting with strip numbers and pages
- `export_dood_pdf`, `export_call_sheet_pdf`

**Skill addition:** call sheets are sent to crew — the agent must *always* preview and require explicit approval before any "send" action. Treat distribution like a destructive action.

**Effort estimate:** 2–3 weeks. Mostly PDF templating.

---

## Phase 6 — Storyboards & shot lists

Sarwar's project already has the shots and floorplans modules enabled, so the data model is partly there. The agent additions:

- Generate a draft shot list per scene from the script (wide / mid / CU / inserts) — this is a creative recommendation, so always frame it as a starting point
- Link shots to scenes so the agent can answer *"how many setups on day 3?"* (which feeds back into schedule realism)

**Effort estimate:** depends on what the shots module already does. Possibly already mostly built.

---

## The agent itself — architectural notes

You said you're running Cowork with Opus 4.6. A few notes on getting the most out of it:

**1. System prompt = SKILL.md, verbatim.** The skill above is written to be loaded as a system-level instruction. Don't paraphrase it into the prompt — load it as-is. That preserves the exact wording around propose-preview-approve, gap handling, etc., which is what keeps the agent from going off-script.

**2. Tool descriptions are 80% of agent quality.** Look at your current MCP tool descriptions for Rwanga — they're terse (`"Add a character to a project"`). Agents perform dramatically better when the description tells them *when* to use the tool, *what the parameters mean*, and *what the return looks like*. Rewrite each one to be 3–5 sentences. This single change usually beats prompt engineering.

**3. Always include `get_project` (or equivalent) early in every session.** The agent needs full state before acting. The skill enforces this in Workflow 2, but make sure the tool returns enough context (counts, recent changes, open gaps) in one call so the agent doesn't have to make 5 round-trips.

**4. Propose-preview-approve as a tool pattern.** Consider adding tools like `preview_bulk_scene_changes` that return a diff without committing, paired with `commit_pending_changes(preview_id)`. This makes the safety pattern enforceable in code, not just in the prompt.

**5. Logging the agent's reasoning.** Have the agent write its decisions back to a `production_log` table per project. This becomes both an audit trail and training data for fine-tuning later.

**6. Model choice.** Opus is right for breakdown and reasoning-heavy work (schedule analysis, gap detection). For routine CRUD (create scene, update task), Sonnet is enough and 5× cheaper. If Cowork lets you route per-tool, use Sonnet for the bulk_create paths and Opus for analyze/propose paths.

---

## What I'd build first if I were you

In priority order, ROI-weighted:

1. **Rewrite the MCP tool descriptions** (1 day, free quality boost)
2. **Phase 2 scheduling — even just `ShootingDay` + `Strip` + a naive conflict checker** (2 weeks, biggest user-visible jump)
3. **Phase 4 VFX/complexity flags** (1 week, makes Phase 2 much smarter)
4. **Phase 5 call sheets** (2 weeks, the deliverable producers actually pay for)
5. **Phase 3 budgeting** (last — biggest scope, most regional variation, most political)

Skip storyboards/AI image generation until the production-management core is rock solid. Filmustage added that layer last for a reason.

---

## How to use the SKILL.md

Drop `SKILL.md` into your skills directory (or paste it as the system prompt for the agent in Cowork). Test it with these scenarios in order:

1. *"List my projects"* — should call `list_projects`, return clean summary, not raw IDs
2. *"Open Mysterious Guest"* — should fetch full state, open with status not questions
3. Paste a 5-page script → *"Break it down"* — should read all of it, count first, confirm, then bulk-create in the right order
4. *"What's missing?"* — should run `list_tasks` AND do its own analysis
5. *"Delete scene 3"* — should ask for explicit confirmation before calling `update_*` (Rwanga has no delete; agent should propose marking as cut instead)

If any of those go wrong, the fix is almost always in the SKILL.md, not the model.
