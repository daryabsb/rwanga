# Rwanga v2 Specs Synthesis Brief
**Date:** May 9, 2026 | **Controller:** Synthesis Brief | **Scope:** MASTER-DESIGN.md + SKILL.md + ROADMAP.md

---

## 1. Summary of Primary Documents

### MASTER-DESIGN.md
The complete v1 system design: a Django platform for film preproduction built from an HUD2 skeleton, organized into 7 phases (P0–P7) spanning infrastructure, auth, projects, shots, departments, scheduling, AI, and community reviews. Architecture is dual-routed (HTMX web UI + DRF REST API from day one), uses django-split-settings, TDD-first, soft-deletes, and tight i18n/RTL support for Kurdish/Arabic. The Progress app is mandatory source of truth; markdown docs are generated exports. Three independent review systems (inline comments, structured consultation, external sandbox). Subscription scaffolding present but gated off. No AI Kurdish translation — only human-verified .po files.

### SKILL.md
A production agent system designed as a "smart breakdown assistant" operating on propose-preview-approve principles. The agent reads scripts, extracts structured data (characters, locations, scenes, gaps), creates them via MCP tools, surfaces missing information without guessing, and moves to next unblocked task if unclear. Workflows cover new projects (read → confirm → bulk-create), project continuation (fetch state → report status), schedule analysis (group by location/cast, flag risk), and gap review (surface 3 most urgent). The agent never makes creative decisions, never silently mutates, uses bulk operations, respects language/RTL, and logs everything as first-class gaps. System prompt = SKILL.md verbatim.

### ROADMAP.md (Filmustage "AI Dude" Vision)
Six-phase roadmap to evolve from breakdown assistant to full production agent parity with Filmustage's AI Dude. Phase 1 is already shipped (script breakdown + gap tracking). Phase 2 (biggest unlock): scheduling layer — `ShootingDay`, `Strip`, `CastAvailability`, `LocationAvailability`, `ScheduleConstraint`, plus `analyze_schedule_conflicts` tool and naive `propose_schedule` optimizer. Phases 3–5 add budgeting, VFX/complexity awareness, call sheets/DOOD. Phase 6 is storyboards (deferred). Architectural notes: load SKILL.md as system prompt verbatim, rewrite MCP tool descriptions (80% of quality), always fetch full project state before acting, use preview/commit pattern, log agent reasoning to production_log table (training data). Priority: rewrite tool descriptions (1 day), Phase 2 scheduling (2 weeks), Phase 4 VFX tags (1 week), Phase 5 call sheets (2 weeks).

---

## 2. Key Ideas Extracted

### From MASTER-DESIGN.md
1. **Clone-first mentality:** HUD2 skeleton provides proven infrastructure; copy settings, .env, Redis/Celery/Postgres configs wholesale. Same machine, same hosts. Avoids wheel-reinvention.
2. **Service layer separation:** All business logic in `services.py`, not views. Both HTMX views and DRF views call same service. Enables dual UI without duplication.
3. **BaseModel inheritance:** UUID pk + `created_at`/`updated_at` on all models. `SoftDeleteModel` adds `is_deleted`/`deleted_at`. Framework-wide, testable from day one.
4. **django-split-settings:** Settings components in `src/settings/components/` — env, db, redis, celery, common, restframework, integrations, etc. Never collapse. Enables feature-flag toggling without code changes.
5. **TDD as gating criterion:** No code ships without test. Test first (red), code (green), refactor, document. Every module, class, function has docstring.
6. **Progress app as source of truth:** DB-backed tracking of tasks, updates, gaps, changes, decisions, diagrams. MCP-readable, web-browsable. Markdown docs are *generated exports*, not maintained manually.
7. **Studio model with 1-N membership:** User owns studio (1) + joins other studios (N). Project belongs to studio. ProjectMembership ties user to project with role (crew/internal_reviewer) + department. Consultant is separate system-level entity.
8. **Three independent review systems:** Inline (contextual, attached to objects), Structured (consultation deliverable, BibleReview+SceneEvaluation+ReviewDecision), Community (external sandbox, frozen snapshot in SessionContent JSON, zero FK back to project).
9. **RTL-first, i18n-first:** CSS logical properties (border-inline-start, not border-left). No hardcoded UI text. English development language; Kurdish/Arabic are translation layers. Shot numbers always Western digits. Human-verified Kurdish labels in MASTER-DESIGN Part 7.
10. **Soft-delete with soft constraints:** `SoftDeleteModel` + `objects.filter(is_deleted=False)`. Never hard-delete. Preserves history.

### From SKILL.md
1. **Propose-preview-approve pattern:** Agent proposes structural changes (bulk_create_scenes, move_strip), shows preview, waits for approval. Single-item edits during active flow don't re-confirm (context is approval). Money-sensitive changes (budget) always preview-first.
2. **No creative decisions:** Agent does not invent plot, suggest character motivation, or improve script unless explicitly asked. Gap instead.
3. **Bulk operations as default:** `bulk_create_scenes`, `bulk_create_characters` over loop + single creates. Faster, cheaper, atomic.
4. **Language preservation:** Project titles, character names, scene headings in original language (Kurdish). `title_latin` for romanized version. No auto-translation.
5. **Gap-first workflow:** Anything unresolved from script → create GapBlocker. Director reviews gaps; agent doesn't guess. Blocks next work if critical.
6. **State fetching before acting:** Always `list_projects` → `get_project` early in session. Agent needs full context (counts, recent changes, open gaps) in one call; no 5 round-trips.
7. **Plain summary opening:** State project, not pleasantries. *"Mysterious Guest, draft, 0 scenes. Ready to break down the script."*
8. **Role as a service, not an authority:** Agent is a 1st AD/line producer analogue. Director/producer is decision-maker. Agent executes, proposes, surfaces.

### From ROADMAP.md
1. **Scheduling layer as killer feature:** `ShootingDay` + `Strip` + `analyze_schedule_conflicts` + `propose_schedule`. Even naive conflict checker is hugely useful. Optimizer can start heuristic (group by location, then cast cluster).
2. **MCP tool descriptions are 80% of agent quality:** 3–5 sentence descriptions (when to use, parameters mean, what returns look like) beat prompt engineering.
3. **Model choice per-tool:** Opus for breakdown/reasoning-heavy (schedule analysis, gap detection). Sonnet for routine CRUD (create scene, update task). 5× cheaper, same quality for dumb work.
4. **Production log as training data:** Agent writes decisions to `production_log` table per project. Audit trail + fine-tuning corpus.
5. **Provider pattern for AI services:** Swappable providers (Ollama local, NLLB for Kurdish translation, Stable Diffusion, Anthropic prod). Same pipeline, different backends. Zero-cost dev, cloud prod.
6. **Data surface area unlocks capability:** Every new model (ScheduleConstraint, RateCard, BudgetLine) + tool exposes new reasoning. Roadmap is data-driven: model → agent capability.
7. **Deferred storyboards:** Skip AI image generation until production-management core is rock-solid. Filmustage added last for reason.

---

## 3. Convergences (High-Confidence Ideas)

1. **Service layer separation is non-negotiable:** Both MASTER-DESIGN (Rule 4) and AI-ENGINE-DEV-SPEC (provider pattern) and ROADMAP (tool descriptions) assume business logic is centralized, testable, and reusable. HTMX views and DRF views call same service. Agent MCP tools call same service.

2. **Progress app is the spine:** MASTER-DESIGN makes it P0 mandatory. SKILL.md assumes gaps are logged. ROADMAP notes `production_log` as audit + training data. All three assume system state is DB-backed, queryable, and agent-readable.

3. **Propose-preview-approve is the safety pattern:** SKILL.md enforces it in prompt. ROADMAP calls it "tool pattern — consider adding `preview_bulk_scene_changes` + `commit_pending(preview_id)`." MASTER-DESIGN implicit in "Darya reviews output, not process."

4. **MCP connectivity is foundational:** MASTER-DESIGN mandates MCP server (P5.5). SKILL.md assumes agent works via MCP tools. ROADMAP assumes `get_project`, `list_tasks`, `create_gap_blocker` are MCP-exposed tools. Platform is agent-native from day one.

5. **Data models before agent capability:** ROADMAP says "every capability maps to a specific data model + tool." MASTER-DESIGN builds models (Scene, Shot, FloorPlan, ScheduleBlock) in phases. You don't get agent scheduling without ShootDay + Strip + ScheduleConstraint. Data leads capability.

6. **Language preservation (no AI translation):** MASTER-DESIGN Rule 11 forbids auto-translation of Kurdish UI labels. SKILL.md says "Rwanga projects are often in Kurdish; project titles, character names, scene headings may be in Kurdish; keep them in their original language." Same principle: human-verified only.

7. **Dual routing (HTMX + DRF) from day one:** MASTER-DESIGN Rule 5 mandates every app has `urls.py` + `api/urls.py`. SKILL.md assumes both exist (agent calls DRF, director uses HTMX). ROADMAP implies MCP queries DRF endpoints. Not an afterthought.

---

## 4. Tensions / Conflicts

1. **Soft-delete vs. agent authority:** MASTER-DESIGN assumes all deletes are soft (preserve history). SKILL.md says "There is no delete in Rwanga; agent should propose marking as cut instead." But who marks as cut? Agent's own decision, or director approval? If agent proposes + waits, it blocks workflow on a non-core decision. If agent auto-marks, it's violating propose-preview-approve. Unresolved edge case.

2. **Scheduling optimizer scope:** ROADMAP calls `propose_schedule` "the agent's killer feature" and suggests "optimize for fewest company moves" / "group all interior nights into back half." But SKILL.md forbids creative decisions. Is schedule optimization creative or mechanical? ROADMAP frames it as a heuristic (group by location, then cast cluster), suggesting mechanical. But "fewest company moves" is a business decision (cheaper? faster?), not a universal truth. Tension: what's a proposal vs. a creative call?

3. **Consultation model conflicts with team:** MASTER-DESIGN creates three parallel role systems (crew via ProjectMembership, consultant via ConsultantProfile, community reviewer via ReviewSessionParticipant). A consultant can access a project, propose decisions, lock decisions (with director approval). But SKILL.md and ROADMAP assume a single "agent" voice. Do agents have a ConsultantProfile? Or are they abstract services? If Darya runs multiple agents (one for breakdown, one for scheduling, one for budget), are they separate ConsultantProfiles or MCP-authenticated service accounts?

4. **MCP auth vs. studio context:** MCP-SERVER-SPEC says MCP connections authenticate via API key tied to ProjectMembership, inheriting user's role. MASTER-DESIGN builds studio context middleware that injects active studio into request. But MCP is stateless; there's no "active studio" per connection. How does an MCP tool know which studio to write to if the API key is project-scoped, not studio-scoped? MCP needs studio context, but ProjectMembership ties to project, not studio. Spec gap.

5. **Production log vs. Progress app:** ROADMAP says "log agent reasoning to `production_log` table per project. This becomes both audit trail and training data." But MASTER-DESIGN's Progress app already has `ProgressUpdate` (update_type, body, files_affected), `AgentReport` (session_id, report_type, summary, tasks_completed), and `ChangeRecord` (change_type, description, diff_summary). Is `production_log` a separate table in projects app? Or is it a renamed/repurposed ProgressUpdate? Duplication risk.

6. **Subscription gating contradicts AI-first vision:** MASTER-DESIGN says `SUBSCRIPTION_ENABLED = False` (bypass all checks) and "Feature flag `RWANGA_AI_ENABLED = False` (Phase 4)." ROADMAP roadmap assumes agents are core platform, not gated. When does AI turn on? If it's Phase 4, but subscription gating is off, how do you limit free users? SKILL.md doesn't mention subscription at all. Tension: is AI a premium feature or core platform?

---

## 5. Opportunities (Best Ideas to Extract)

1. **Service-layer separation as the execution moat:** MASTER-DESIGN's Rule 4 + AI-ENGINE-DEV-SPEC provider pattern = ultimate flexibility. Write business logic once in `services.py`, call from HTMX view, DRF view, Celery task, MCP tool, or future UI framework. This is the architectural decision that lets you stay API-first without compromise. *Worth carrying forward:* Make every new app's service layer the primary target for testing + documentation. Views are thin client code.

2. **Progress app as the control layer:** MASTER-DESIGN makes it P0; ROADMAP calls it audit + training data. This is not a "nice to have" dashboard. It's the machine-readable spine that lets Darya see state, agents read dependencies, and the system export documentation. *Worth carrying forward:* Build Progress mutations into every agent workflow. No task is complete until reflected in Progress app + visible in `/progress/` dashboard.

3. **Propose-preview-approve pattern as a framework primitive:** Rather than encode this in prompts (SKILL.md style), build it into MCP tools. Tools like `preview_bulk_scene_changes(preview_id)` + `commit_pending_changes(preview_id)` make the pattern enforceable in code, testable, auditable. MCP tool descriptions can then teach agents when to use preview vs. direct commit. *Worth carrying forward:* Create a `PreviewQueue` model (preview_id, user, action, proposed_data, status), expose `preview_*` + `commit_preview(preview_id)` tools, wire to Progress app.

4. **Scheduling layer as the first AI unlock after breakdown:** ROADMAP prioritizes Phase 2 (scheduling) above budgeting. This is right. Scheduling is mechanical (group scenes by location, check cast conflicts, catch turnaround violations), visible (director sees DOOD chart, sees "3 consecutive night shoots with 8hr turnaround — risk"), and directly saves money/time. Build ShootDay + Strip + ScheduleConstraint first; add ScheduleBlock + CallSheet + WhatsApp later. *Worth carrying forward:* Prioritize `analyze_schedule_conflicts` as the first complex agent reasoning task. It's a forcing function for MCP tool design.

5. **Provider pattern for AI services (not just models):** AI-ENGINE-DEV-SPEC shows swappable providers (Ollama, NLLB, StableDiffusion, Anthropic). Same interface, different costs/capabilities. ROADMAP says "dev uses local models, prod uses cloud — pipeline stays identical." This is a contract worth enforcing. *Worth carrying forward:* Design `src/ai_engine/providers/base.py` interface upfront. Use it for text generation, translation, image generation. Build Anthropic provider last (production), develop against Ollama first (free, local).

6. **MCP resources as the agent's "read API":** MCP-SERVER-SPEC defines resources like `rwanga://projects/{id}/scenes/{id}/shots`, `rwanga://progress/tasks`, `rwanga://progress/gaps`. These are the "watch" side of the event loop. Agent reads state, acts, reads again to confirm. This is simpler than agents doing 5 DRF calls in series. *Worth carrying forward:* Design MCP resources to be coarse-grained and cacheable. Avoid resource explosion; a few well-designed resources beat 50 tiny ones.

7. **Language as data, not UI magic:** MASTER-DESIGN + SKILL.md converge: Kurdish titles stay Kurdish, character names stay Kurdish, only translations are human-verified .po files. Don't build auto-translation features. Build clean separation: `title_latin` field for romanized names (searchable), keep `title` in original language. *Worth carrying forward:* Every project, scene, character, location model has both fields. Search queries match on `_latin` field, display uses language-selected field.

8. **Soft-delete + snapshots for audit:** MASTER-DESIGN uses soft-delete. Community review app uses frozen JSON snapshots (SessionContent.content_data). Both are audit-friendly. *Worth carrying forward:* When deleting (via soft-delete) or snapshotting (for external review), record the deletion/snapshot timestamp + reason in Progress app. This gives directors visibility into what changed and why.

9. **Dark theme + RTL as first-class requirements:** MASTER-DESIGN mentions "RWANGA_DEFAULT_THEME = 'dark'" + Bootstrap 5 RTL stylesheet. Not an afterthought. *Worth carrying forward:* Test RTL layout continuously. Use logical CSS properties from day one (no `border-left`, only `border-inline-start`). Make light theme a feature toggle, not default.

10. **MCP as the primary agent interface, not DRF:** MCP-SERVER-SPEC makes MCP the canonical way for agents to interact. Tools + Resources are higher-level than raw REST endpoints. *Worth carrying forward:* Design MCP first (tools, resources, prompts), then implement DRF endpoints that back them. Don't design DRF and tack MCP on top.

---

## 6. Flags for Controller (Spec Contradictions & Unresolved Scope)

### Contradictions with Decided Concepts

**Conflict: Soft-delete vs. Agent Authority**
- **Decided:** Project models use soft-delete. Agent only proposes; director approves.
- **Spec issue:** SKILL.md says "agent should propose marking as cut instead," but doesn't define "approve marking as cut." If director must confirm every soft-delete, 50-scene script breakdown becomes tedious. If agent auto-marks, violates propose-preview-approve.
- **Recommendation:** Clarify: does agent auto-mark as cut after director cuts scene from script? Or does agent propose soft-delete + wait for director to confirm?

**Conflict: Subscription Gating**
- **Decided:** `SUBSCRIPTION_ENABLED = False` (bypass all checks). Studios start at "beta" tier (unlimited).
- **Spec issue:** MASTER-DESIGN doesn't say when subscription gating turns on. SKILL.md doesn't mention it. ROADMAP doesn't mention it. MASTER-DESIGN Part 6 has `RWANGA_MAX_SCENES_FREE = 10`, suggesting eventual metering, but gating is off. AI features are behind `RWANGA_AI_ENABLED = False`, but no subscription tie.
- **Recommendation:** Decide: is AI a paid feature in Phase 5+? If so, at what tier? Document in rwanga.py settings.

**Conflict: MCP Auth Scope (Project vs. Studio)**
- **Decided:** Studio model: 1 owned + N memberships. Project model: belongs to studio. ProjectMembership has mcp_api_key.
- **Spec issue:** MCP-SERVER-SPEC ties API key to ProjectMembership (project-scoped). But `create_project` tool needs studio context, not project context. A user with MCP key for Project A can't create a new project in Studio X; they're bound to Project A.
- **Recommendation:** Either add `mcp_api_key` to Studio model (studio-scoped auth) or define: agent + MCP key tied to ProjectMembership, agent can only read/write Project A and related studio context. If agent needs to create new project, API key must be Studio-scoped, not ProjectMembership-scoped.

**Conflict: Production Log vs. Progress App**
- **Decided:** Progress app is source of truth for task tracking, updates, changes, gaps, decisions.
- **Spec issue:** ROADMAP adds `production_log` table ("audit trail + training data for fine-tuning"). Is this separate from ProgressUpdate? Or renamed? If separate, duplication. If same, Progress app is doing too much (design tracking + audit trail + training data).
- **Recommendation:** Consolidate: ProgressUpdate can serve as production log. Add `visibility` field (internal vs. training_data vs. audit), or use existing `update_type` field (already has "note", "question"). Query ProgressUpdate for training data without separate table.

**Conflict: Consultant Model (Role vs. Agent)**
- **Decided:** ConsultantProfile is system-level. ProjectConsultantAssignment ties consultant to project. Three review systems separate.
- **Spec issue:** If Darya runs Rwanga-internal agents (breakdown agent, scheduling agent, budget agent), do they each get a ConsultantProfile? Or are agents abstract service accounts? SKILL.md + ROADMAP frame agent as singular, propose-preview-approve. But architecture has room for multiple consultants with competing authority.
- **Recommendation:** Clarify: is an "agent" a ConsultantProfile + Assignment combo, or is an agent a stateless MCP client? If latter, agent reasoning goes to ProgressUpdate.production_log, not BibleReview.

### Unresolved Scope Items

**Question: Why is Scheduling Phase 2, but Call Sheets Phase 4?**
- ROADMAP prioritizes Phase 2 (ShootDay + Strip + conflict checker). But Phase 4 adds CallSheet + DOOD + WhatsApp. Why not together?
- **Assumption:** CallSheet generation is PDF templating (trivial once Schedule exists). Conflict detection is the hard reasoning. Separate phases let you validate scheduling layer before adding output formatting.
- **Recommendation:** Confirm this is the intent. If call sheets are blocking production (directors need them day 1), move to Phase 2.

**Question: When does the Agent learn?**
- ROADMAP mentions "fine-tuning later" and "production_log as training data," but doesn't say when fine-tuning happens or which model. Is it continuous? Post-Phase-5? Annual?
- **Assumption:** Fine-tuning is post-MVP, once you have 100+ projects' production_log entries to learn from.
- **Recommendation:** Decide: is fine-tuning in-scope for v2 launch, or v2.1? If v2.1, document when.

**Question: What data drives "AI Dude" parity?**
- ROADMAP says "AI Dude's most-demoed trick — moving strips, catching cast conflicts, surfacing overtime." These are scheduling tricks. What else is "AI Dude" famous for? Is storyboards a must-have, or is Filmustage's scheduling the bar?
- **Assumption:** Scheduling + budgeting + call sheets = "AI Dude" core. Storyboards are nice-to-have (Filmustage added last). Breakdown + gap tracking (Phase 1) are table stakes.
- **Recommendation:** Confirm with Filmustage demo or customer feedback: what 3 things would they pay for? That's what goes in v2.

### Reinforced Concepts (Specs Agree)

**✓ Studio Model (1 owned + N memberships):** MASTER-DESIGN, SKILL.md (implicit in project context), MCP-SERVER-SPEC (resource filtering). Consistent.

**✓ Project as Workspace:** MASTER-DESIGN Part 3 "project as workspace." SKILL.md "List my projects" → "Open X" workflow. ROADMAP assumes full project context in MCP connections. Consistent.

**✓ Feature/Short + Core+Overlay:** MASTER-DESIGN lists `project_type` ("feature", "short", "tv_episode", "music_video", "commercial"). Not explicitly "Core+Overlay" but implied by modularity (shots optional, departments optional, scheduling optional). ROADMAP phases show gradual feature unlock. Consistent.

**✓ Action Log Spine for AI:** MASTER-DESIGN Progress app. SKILL.md gap logging. ROADMAP production_log. All assume audit trail. Consistent.

**✓ Ask AI Button (Gated by Subscription):** MASTER-DESIGN `RWANGA_AI_ENABLED = False`. ROADMAP implies AI is gated (Phases 2+ unlock new AI capabilities). Subscription gating is separate (off for v1, on for v2+). Consistent intent, unclear implementation.

**✓ MCP Bidirectional (Inbound Concierge + Outbound Agent Queries):** MCP-SERVER-SPEC defines both resources (agent reads project state) + tools (agent writes). SKILL.md assumes agent can call tools. ROADMAP assumes MCP connectivity. Consistent.

**✓ Concierge Model (Human + AI Helping Invisibly Until Fine-Tuned):** SKILL.md frames agent as "production assistant inside Rwanga — 1st AD / line producer." Propose-preview-approve keeps human in loop. ROADMAP notes fine-tuning "later." Consistent: human-in-the-loop → autonomous over time.

---

## Architecture Decision Summary

**The v2 brief should prioritize:**

1. **Service layer separation** as the architectural moat. Every app's business logic lives in `services.py`. Both UI (HTMX/DRF) and agents (MCP) call same services.

2. **Progress app as control plane.** Every agent action → Progress app mutation. Every task completion → ProgressUpdate. Darya's `/progress/` dashboard is the single source of truth.

3. **Propose-preview-approve as code primitive.** Not just a prompt instruction. Build `PreviewQueue` model + `preview_*` MCP tools + `commit_preview(preview_id)` tool. Make it enforceable, auditable, testable.

4. **Scheduling (Phase 2) as first complex AI task.** ShootDay + Strip + ScheduleConstraint + `analyze_schedule_conflicts` tool. Validate agent reasoning on a mechanical, high-ROI task before moving to budget optimization.

5. **MCP resources as coarse-grained read API.** `rwanga://projects/{id}`, `rwanga://projects/{id}/schedule`, `rwanga://progress/tasks` — not 50 tiny endpoints. Agent can introspect state efficiently.

6. **Provider pattern for AI services.** Swappable providers (Ollama local, Anthropic prod) before day 1. Same pipeline, different costs. Zero-cost development, production-ready.

7. **Language preservation (no auto-translation).** Project/scene/character names stay in original language. Search on `_latin` field. Display field selected by user language. Final translations human-verified .po files only.

8. **Soft-delete + snapshots for audit.** Every deletion is soft. Community review snapshots are frozen JSON. Progress app logs reason. Directors see what changed, when, why.

---

**End of Brief**
