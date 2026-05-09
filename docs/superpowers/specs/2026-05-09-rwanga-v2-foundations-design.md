# Rwanga v2 — Platform Foundations Design Spec

**Date:** 2026-05-09
**Status:** Foundations spec — captures architectural decisions for the platform v2 redesign. Implementation plans for each sub-project follow this spec.
**Predecessors:** UI migration spec (`2026-05-08-rwanga-ui-migration-design.md`), original master design (`rwanga-design-kit/specs/MASTER-DESIGN.md`), agent skill (`SKILL.md`), Filmustage AI Dude vision (`ROADMAP.md`).
**Synthesis brief:** `docs/superpowers/inventory/2026-05-09-specs-synthesis-brief.md`
**Codebase inventory:** `docs/superpowers/inventory/2026-05-09-codebase-inventory.md`

---

## Preamble — the strategic North Star

Rwanga is the complete pre-production platform for film directors — from "I have an idea" through "we wrap." Originally built for Kurdish/MENA directors who lacked region-fit tooling. Three product layers stacked over time:

1. **Pre-production tool** (visible product) — script, breakdown, shots, storyboards, schedule, call sheets, on-set SmartBoard.
2. **AI consultant** (paid product) — script reviews, revisions, notes, scheduling intelligence, gap-flagging. Initially concierge (the platform owner Darya + Claude); evolves to a fine-tuned model; eventually an autonomous agent.
3. **AI training corpus generator** (invisible) — every interaction is structured data for fine-tuning the next generation of the AI consultant. The platform's job is to capture rich, attributed, contextual decision data.

The platform should have **character** — a useful AI companion that understands director mentality and regional production practices. The architecture below serves all three layers from the same codebase, evolving the AI worker(s) without changing the platform itself.

---

## Cross-cutting constraints (apply to every section)

These are non-negotiable architectural primitives. Every model, every endpoint, every UI element must respect them.

1. **API-first, MCP-first.** Every domain has three URL conf files from day one: `urls.py` (HTMX), `api/urls.py` (DRF), `mcp/tools.py` (MCP tools). All three call the same service functions.
2. **Service-layer separation.** All business logic in `services.py`. Views are thin clients.
3. **Action-attributable.** Every mutation has an `actor` (user / ai_agent / system / external_mcp). Every action logs to `production_log`.
4. **Soft-delete + Versioning as separate primitives.** Soft-delete = removable+recoverable records. Versioning = field-level revertible history.
5. **Snapshot-on-delete.** When a parent record is soft-deleted, all related child data is captured into a JSONB snapshot. No orphan rows ever.
6. **Propose-preview-approve as code primitive.** Risky MCP tools come in `preview_*` + `commit_preview(preview_id)` pairs. Pattern enforced by tool surface, not prompts.
7. **Subscription gates + RBAC gates as separate concerns.** Subscription = "is this user's plan high enough." RBAC = "does this user have permission in this studio."
8. **Provider pattern for swappable backends.** AI providers (Ollama dev, Anthropic prod, future fine-tuned). Payment providers (mock, Stripe, regional). Selected by settings.
9. **Language as data.** Every named entity has `title` (original Kurdish/Arabic/English) + `title_latin` (romanized). UI translations are human-verified `.po` only — never AI.
10. **No CDN, all assets local.** From the UI migration's lessons (memory: `feedback_local_assets_only.md`).
11. **AI never performs destructive actions.** Hard rule. UI redirect with explanation.
12. **Direct messaging vs notifications are separate concerns.** Notifications = typed event alerts. Conversations = bidirectional chat.
13. **The platform doesn't know which worker is processing.** Workers (human concierge, fine-tuned model, autonomous agent) consume the same queue and use the same MCP tools. Worker abstraction sits above provider abstraction.

---

## Section 1 — Architecture pillars

### 1.1 Service-layer separation

Every Django app has `services.py` (or `services/` package). Business logic lives there. HTMX views, DRF views, Celery tasks, MCP tools all call the same service functions. Tested in isolation. This is the architectural moat that lets the platform be multi-surface without duplication.

### 1.2 Dual-route + MCP from line one

Three URL conf files per app:
- `urls.py` — HTMX/HTML routes (web UI)
- `api/urls.py` — DRF REST routes (programmatic API)
- `mcp/tools.py` — MCP tools (agent verbs)

All three layer over the same services. Adding a feature = write the service, expose via all three.

### 1.3 Soft-delete primitive

```
SoftDeleteModel (mixin)
├── deleted_at (datetime, nullable)
├── deleted_by (FK to User, nullable)
├── recovery_grace_until (datetime — default deleted_at + 30 days)
└── default Manager filters out deleted=True
```

Records hidden from UI when deleted. Recoverable for 30 days. After grace: paid recovery from JSON snapshot.

### 1.4 Versioning primitive

```
Versioned (mixin)
├── on save() → creates Version row
└── revert_to(version_id) → restore field state from snapshot

Version (separate table)
├── id, model_type, model_id, version_number
├── snapshot_json (full field state at time of save)
├── actor, actor_type
├── reason (str — optional, why this change)
├── created_at
```

Any field change creates a Version. Revertible to any prior state. Implementation: probably `django-reversion` or custom signal-based.

### 1.5 Snapshot-on-delete (cascade)

When a parent record is soft-deleted:
1. Service walks all related models (FK reverse relations).
2. Builds a JSONB blob with all child data.
3. Stores blob on the parent's `snapshot_on_delete` field.
4. Marks all children as soft-deleted.
5. After grace period: paid recovery rebuilds parent + children from snapshot.

### 1.6 Action log spine

```
production_log (firehose, append-only)
├── id, timestamp (indexed)
├── studio (FK), project (FK, nullable)
├── actor_type (user / ai_agent / system / external_mcp)
├── actor_id, actor_name (denormalized)
├── event_type (model_save / view_request / mcp_tool_call / ai_suggestion / comment / decision / state_change / error / ...)
├── target_type, target_id
├── payload (JSONB)
├── source_ip, session_id
└── visibility (public / private / training_only)
```

Append-only. Never updated, never auto-deleted. Optimized for write throughput; indexed for batch reads at training time. Written by Django signals + view middleware + MCP tool wrappers + AI workers.

### 1.7 Propose-preview-approve as code

```
PreviewQueue
├── id (preview_id)
├── created_at, created_by (worker actor)
├── proposed_for_user (FK — who must approve)
├── studio (FK), project (FK)
├── target_type, target_id
├── action (create / update / delete / bulk_create / bulk_update / state_change)
├── proposed_payload (JSONB)
├── current_payload (JSONB — snapshot at proposal time, conflict detection)
├── status (pending / approved / rejected / expired / committed)
├── decided_at, decided_by
├── related_action_request (FK, nullable)
└── expires_at (default 24h)
```

MCP tools come in pairs for risky ops. Director sees pending in `/progress/previews/` with [accept] [reject].

### 1.8 Subscription + RBAC gating

Two distinct decorators on every protected operation:

```python
@subscription_required(feature="ask_ai")
@rbac_required(area="scheduling", action="edit")
def commit_schedule_change(...):
    ...
```

Both must pass. Subscription = billing plan check. RBAC = per-area permission check.

### 1.9 Provider pattern

```
src/ai_engine/providers/
├── base.py — TextProvider, EmbeddingProvider, ImageProvider, TranscriptionProvider
├── ollama.py, anthropic.py, rwanga.py (future), mock.py

src/billing/providers/
├── base.py — create_customer, subscribe, charge, webhook
├── mock.py, stripe.py, local_gateway.py
```

Active provider per setting. Same pipeline.

### 1.10 Language preservation

Every named model has `title` + `title_latin`. Search matches `_latin`. Display picks per user language. UI labels via `.po` files (human-verified only).

---

## Section 2 — Studio + Project models

### 2.1 Studio

```
Studio
├── id (UUID)
├── name (str — display, not unique globally)
├── slug (str — globally unique, URL-safe)
├── specialty (enum: feature_films / documentary / commercial / mixed / other)
├── created_at, created_by
├── studio_api_key (rotatable, for MCP studio-level ops)
├── subscription (FK → Subscription)
├── soft-delete fields, versioned
```

Auto-created at signup as "My Studio" (renameable). Globally unique slugs.

### 2.2 StudioMembership

```
StudioMembership
├── studio (FK), user (FK)
├── role (owner / admin / member / auditor / reviewer)
├── tier (production / community)
├── permissions (JSONB — per-area overrides; role gives defaults)
├── status (pending / active / suspended)
├── is_primary (boolean — exactly one True per user — the auto-created "My Studio" membership)
├── invited_by, invited_at, accepted_at
├── magic_link_token
├── soft-delete fields
```

User can have:
- Exactly **one** `is_primary=True` membership (their primary "My Studio").
- Any number of additional **owned** memberships (created via "+ New studio" or via being granted owner role).
- Any number of memberships in **other studios** (joined via invitation).

Primary studio cannot be deleted independently — only via account deactivation. Other owned studios can be deleted normally.

### 2.3 Project

```
Project
├── id (UUID), studio (FK)
├── name (str — original language)
├── name_latin (str — romanized for search)
├── slug (unique within studio)
├── type (enum: feature / short — v1)
├── status (enum: draft / active / in_production / wrap / completed / cancelled / on_hold)
├── status_changed_at, status_changed_by
├── created_at, created_by
├── snapshot_on_delete (JSONB)
├── # optional metadata, fillable in project settings:
│   ├── logline (text), language, genre (m2m), target_rating
│   ├── director_credit, poster (image), estimated_shoot_start
│   ├── estimated_length_minutes, ai_context_notes
├── soft-delete fields, versioned
```

Create wizard step 1: name + type required only. Save & Close → status=draft. Next → script branch (deferred to Review-product brainstorm).

### 2.4 ProjectMembership

```
ProjectMembership
├── project (FK), user (FK)
├── role (FK → Role lookup — DOP / Script Supervisor / Reviewer / etc.)
├── department (FK → Department lookup, for production roles)
├── tier (production / community)
├── permissions (JSONB)
├── status (pending / active / completed_with_project / removed)
├── invited_by, invited_at, accepted_at
├── magic_link_token
├── soft-delete fields
```

### 2.5 Subscription (overview — full detail in §4.5)

Studio-level billing. Auto-created with each new studio: `plan=pro, status=trial, trial_ends_at=now+30days`. Trial month = full Pro features. After trial: subscription gates active.

### 2.6 Dashboard tile

Reusable component used in all 3 rows + invitations.

```
Tile state machine:
pending  →  active   (on accept)
pending  →  vanishes (on reject)
active   →  dimmed   (when project status = completed)
```

Renders: project poster/placeholder, name, role badge, studio name (Row 2/3 only), status indicator, last-activity timestamp, accept/reject buttons (pending only).

### 2.7 Studio dashboard layout

- **Row 1 — My projects** (studio-scoped): projects in the active studio. Changes when user switches studios.
- **Row 2 — Production memberships** (user-scoped, GLOBAL): projects across ALL studios where this user has a production role. Doesn't change with studio switch.
- **Row 3 — Community memberships** (user-scoped, GLOBAL): projects across ALL studios where this user has read+comment access. Doesn't change with studio switch.

Tiles in Row 2/3 show "in [Studio Name]" so users know which studio's project each is.

### 2.8 Studio context switching

Light-touch. Session variable `active_studio_id`. "Switch to studio X" updates session var, redirects to that studio's dashboard. "Exit studio" returns to user's previously-active studio (default = primary on first sign-in, then last-active on subsequent).

Topnav always shows current studio name. User dropdown has "My Studio" as first-class link (always returns to primary). Studio switcher dropdown appears when user has 2+ studios.

### 2.9 Account deactivation (the only "studio delete" of the primary)

UI lives in **Account settings → Danger zone** (separate from studio settings). Cascade-soft-deletes:
- The user account
- The primary studio + all owned studios
- All projects in those studios (each with snapshot_on_delete)
- All memberships

30-day grace for reactivation; after that, paid recovery.

### 2.10 UI surfaces (Section 2)

| Concept | UI surface |
|---|---|
| Studio name + specialty | Studio settings page → editable form |
| Studio members + roles | Studio settings → Team tab |
| RBAC matrix per area | Studio settings → Permissions tab (granular toggle grid — needs thoughtful UI) |
| Studio API key | Studio settings → Integrations tab |
| Subscription / billing | Studio settings → Billing tab |
| Studio switcher | Topnav user dropdown — visible when 2+ studios |
| "My Studio" link | User dropdown first-class link |
| Account deactivation | Account settings → Danger zone (separate URL from studio settings) |
| 3-row project dashboard | Studio dashboard (home view after sign-in) |
| Project create | Modal triggered from "+ New project" |
| Project settings | Per-project multi-tab page (metadata, team, danger zone) |
| Tile states | Tile component (pending/active/completed visual states) |
| Pending invitations | Inline tiles in target row |

---

## Section 3 — AI infrastructure

### 3.1 Two logs

**`production_log`** (defined in §1.6) — the firehose, all events, training corpus.

**`ProgressUpdate`** — the curated narrative.

```
ProgressUpdate
├── id, project (FK), created_at, created_by
├── update_type (task_completed / gap_surfaced / decision_made / status_change / ai_suggestion / question / note)
├── title, body (markdown)
├── related_log_entries (m2m → production_log)
├── source (human / ai / system)
└── visibility (studio_internal / project_team / community)
```

Selectively written when worth surfacing. Drives `/progress/` dashboard. Subset of production_log events, framed as story.

### 3.2 Action queue

```
ActionRequest
├── id, created_at, created_by_user (FK)
├── studio (FK), project (FK, nullable)
├── source_context (JSONB — page URL, html element id, cursor selection, current data)
├── prompt (text — what user typed)
├── kind (explain / suggest / draft / analyze / fix / review / general)
├── status (queued / in_progress / done / failed / cancelled)
├── assigned_to (str — current worker identity)
├── response (markdown)
├── response_artifacts (JSONB — links to PreviewQueue entries, files)
├── started_at, completed_at
├── feedback_rating, feedback_text
└── related_log_entries (m2m → production_log)
```

Pro user clicks Ask AI → ActionRequest created → worker picks up → button enters in-progress → response renders in floating chat panel when done.

### 3.3 Preview queue

Defined in §1.7. MCP tool pairs `preview_*` + `commit_preview(preview_id)`. Director sees pending previews in `/progress/previews/`.

### 3.4 Notifications (typed alerts)

```
Notification
├── id, recipient (FK → User)
├── kind (invitation_received / invitation_accepted / comment_received /
│         ai_suggestion_ready / ai_decision_required / preview_pending /
│         status_change_on_my_project / action_request_completed /
│         message_received / system_announcement / ...)
├── title, body
├── source_type, source_id
├── source_actor_id, source_actor_display ("Claude / AI Assistant / Darya / Acme Studio")
├── created_at, read_at
├── delivered_channels (m2m: in_app / email / whatsapp)
└── action_url
```

Bell icon + panel. Each kind has its own visual treatment.

### 3.5 Direct messaging (Conversations)

Separate concern from notifications.

```
Conversation
├── id, created_at, last_message_at
├── participants (m2m → User)
├── related_to (generic FK — project / action_request / freeform)
├── kind (ai_consultation / darya_outreach / general)
└── status (active / archived)

Message
├── id, conversation (FK), created_at
├── sender (FK → User)
├── sender_actor_display (str — sender chooses identity, e.g., "Darya" vs "AI Assistant")
├── body (markdown)
├── ai_generated (boolean)
├── source_provider (str — "manual" / "claude-3.5" / "rwanga-finetuned-v1")
├── related_to_action_request (FK, nullable)
└── read_by (m2m → User)
```

Bidirectional chat. Darya can post as herself OR masked as "AI Assistant". Outbound can be drafted by AI provider, optionally reviewed by Darya, then sent. Notifications can point to conversations.

### 3.6 Actor / identity system

| Type | Examples | RBAC scope |
|---|---|---|
| `user` | Human signed-in user | Full RBAC + subscription gates |
| `ai_agent` | Claude → Darya's model → Darya's agent | Constrained MCP scope: read + propose + commit-preview; never destructive |
| `system` | Background jobs, signal handlers | Internal full access |
| `external_mcp` | Director's own AI agent calling our MCP | Read-only resources + propose-only tools; no commit-preview |

### 3.7 Autonomy spectrum (domain-specific)

| Domain | Autonomy | Pattern |
|---|---|---|
| Read | Full | Direct read tools |
| Mechanical (tagging, organizing, summaries) | Full + logged | Direct tools, log production_log |
| Structural (bulk changes, schedule commits) | Propose + preview | preview_* + commit_preview |
| Creative (script ideas, motivation) | Suggestion-only on explicit ask | Output as suggestion, user accepts |
| Destructive | Never AI | UI redirect only |

### 3.8 Worker abstraction

Workers consume the ActionRequest queue:
- **Phase A (now)**: Darya (human via Claude) reads queue, fulfills via MCP, writes responses.
- **Phase B (soon)**: Darya's fine-tuned model picks up queue, fulfills, Darya reviews edge cases.
- **Phase C (target)**: Darya's autonomous agent runs platform; Darya gets daily summaries.

Platform doesn't know which worker is active. Worker is just an actor identity with MCP credentials.

### 3.9 Subscription gates on AI

| Feature | Free | Pro | Enterprise |
|---|---|---|---|
| Projects, studios, basic CRUD | ✓ | ✓ | ✓ |
| Ask AI button | ❌ (greyed + tooltip) | ✓ | ✓ |
| Studio API key (outbound MCP) | ❌ | ✓ | ✓ |
| AI suggestions in dashboards | Read-only | Interactive | Custom |
| `production_log` retention | 90 days | 2 years | Unlimited |

Trial: 30 days Pro for new studios.

### 3.10 UI surfaces (Section 3)

| Concept | UI surface |
|---|---|
| Ask AI button | Floating action button (FAB) bottom-right (bottom-left RTL); always present on Pro, greyed on Free |
| Ask AI chat panel | Slide-up from FAB; markdown response, history, thumbs feedback |
| Pending ActionRequests | `/progress/` dashboard tab + bell badge |
| Worker queue (Darya's view) | `/progress/queue/` |
| Pending PreviewQueue | `/progress/previews/` + inline cards |
| production_log explorer | `/admin/production-log/` — filter, export to JSONL |
| ProgressUpdate feed | `/progress/` main view + per-project activity tab |
| Notifications | Bell → panel, plus email/WhatsApp |
| Conversations / Messages | `/messages/` — list + thread view; AI consultation conversations open from FAB |
| Subscription status | Studio settings → Billing; trial countdown banner |
| Provider config | `/admin/ai-providers/` — Darya only |

---

## Section 4 — MCP + API + Subscription internals

### 4.1 MCP server architecture

```
src/mcp/
├── server.py — entry, auth, routing
├── auth.py — API key → actor identity
├── tools/
│   ├── studio.py, projects.py, scenes.py, shots.py
│   ├── scheduling.py, tasks.py, gaps.py
│   └── ai_loops.py — claim_action_request, respond_to_action_request
├── resources/
│   ├── project.py — rwanga://projects/{id}
│   ├── progress.py — rwanga://progress/tasks, rwanga://progress/queue
│   ├── studio.py — rwanga://studios/{id}/members
│   └── action_log.py — rwanga://action-requests/pending
└── descriptions.py — verbose 3-5 sentence tool descriptions
```

**Resources** = read API. Coarse-grained, cacheable.
**Tools** = verbs. Semantic, not REST CRUD. Risky ones in propose/commit pairs.

### 4.2 MCP tool design rules

1. Tool descriptions are agent reading material (3-5 sentences each, the 80%-of-quality file).
2. Bulk operations preferred over loops.
3. Risky → preview/commit pairs.
4. Read-only and mechanical → direct.
5. Destructive → not exposed (UI redirect only).
6. Every tool wraps a service function (no business logic in tools).
7. Every tool call writes to `production_log` (auto-instrumented decorator).

### 4.3 API key model

```
ApiKey
├── id, created_at, name (user-friendly identifier)
├── actor_type (ai_agent / external_mcp / system)
├── scope (studio_full / studio_readonly / project_scoped / project_readonly)
├── studio (FK), project (FK)
├── created_by_user (FK)
├── last_used_at, request_count
├── expires_at, revoked_at
└── key_hash
```

Generate from Studio settings → Integrations. Display once, hash at rest.

### 4.4 DRF REST API

Mirrors MCP for human web/mobile + partner integrations. Backs the same services. REST conventions. Auth: session OR API key. Subscription + RBAC enforced via permission classes. Action log instrumented. OpenAPI auto-generated. Per-actor rate limiting.

### 4.5 Subscription model — full detail

```
Subscription (extends §2.5)
├── owner_studio (FK), owner_user (FK — billing contact)
├── plan (free / pro / studio_unlimited / enterprise)
├── status (trial / active / past_due / suspended / cancelled)
├── trial_started_at, trial_ends_at
├── billing_email
├── payment_provider, payment_provider_customer_id
├── current_period_start, current_period_end
├── seat_count, seat_limit
└── feature_flags (JSONB — per-tier overrides)

SubscriptionUsage
├── subscription (FK), period_start, period_end
├── meter_kind (ai_requests / ai_tokens / studio_seats / api_requests / project_count / production_log_size)
├── consumed, limit
└── overage_charged_amount

PaymentProviderEvent (webhook idempotency)
├── id, provider, provider_event_id (unique)
├── event_type, payload (JSONB)
├── processed_at, processed_status
└── related_subscription (FK)
```

**Plans (initial — pricing TBD):**

| Plan | Studios | Projects | Seats | Ask AI | production_log retention |
|---|---|---|---|---|---|
| Free | Unlimited | Unlimited | 1 | ❌ | 90 days |
| Pro | Unlimited | Unlimited | 5 | ✓ (token cap) | 2 years |
| Enterprise | Unlimited | Unlimited | Unlimited | ✓ unlimited | Unlimited |

**Trial:** 30 days Pro on new studio. 7 days before expiry: notification + email + banner. On expiry: `plan=free, status=active`.

### 4.6 Webhooks + idempotency

Payment events arrive as webhook → stored in `PaymentProviderEvent` (unique on `(provider, provider_event_id)`) → processed async via Celery. On success: subscription status update + ProgressUpdate "Subscription renewed" + notification to billing contact.

### 4.7 UI surfaces (Section 4)

| Concept | UI surface |
|---|---|
| API keys | Studio settings → Integrations |
| Subscription overview | Studio settings → Billing |
| Upgrade flow | Pricing page → checkout → webhook → confirmation toast |
| Usage meters | Billing tab |
| Trial countdown | App-wide top banner during trial |
| Payment failure | Critical notification + dashboard banner + email |
| MCP integration docs | `/docs/mcp/` — public docs for Pro users |

---

## Out of scope (deferred sub-projects)

Each gets its own brainstorm + spec + plan cycle later, **not** in this foundations spec:

- **Inside-project section completion** — script editor (Filmustage-like), breakdown, shots, storyboards, schedule, call sheets, SmartBoard tablet view. Each is its own implementation pass.
- **Review business product** — paid AI script review service. Own brainstorm. Includes script versioning, revision tracking, AI-assisted revision drafting, decision logs, deliverable formats.
- **Landing page CMS** — dynamic content models for hero/features/testimonials/footer; admin to edit.
- **Visual polish per AGENT-PATTERNS.md** — sweep across all migrated pages (deferred from migration).
- **Vendor third-party libraries locally** — Leaflet (locations map), Mermaid (progress diagrams).
- **Mobile-rail polish, landing mobile drift fix** — UI follow-ups from migration.
- **RBAC matrix UI design** — granular per-area permission grid; needs careful UX work.
- **Fine-tuning pipeline** — extracting production_log into training datasets, model fine-tuning workflow. Post-MVP.
- **WhatsApp + email delivery providers** — concrete integration, beyond the abstract notification system designed here.
- **AI consultation pricing experimentation** — strategy decisions about Pro tier pricing, free trial length, etc. (the spec allocates the scaffolding; the specific values come later).

---

## Implementation sequencing (sub-projects in order)

After this foundations spec is approved, write implementation plans for:

| Order | Sub-project | Depends on | Scope |
|---|---|---|---|
| 1 | **Studio + Project core** (foundations of B from earlier discussion) | This spec | Studio model + RBAC primitives + project model + soft-delete + snapshot pattern + dashboard 3-row UI + invitation flows + subscription scaffolding |
| 2 | **Action log + AI infrastructure** | 1 | production_log + ProgressUpdate models + ActionRequest + PreviewQueue + Notifications + Conversations + actor system + Ask AI floating panel |
| 3 | **MCP server + API key model** | 1, 2 | Studio/project/scenes/shots/scheduling tool catalog + resources + auth scopes + descriptions; DRF API mirrored |
| 4 | **Inside-project section completion** | 1, 2, 3 | Each section gets its own implementation pass. Script editor first (highest priority for AI training data). |
| 5 | **Review business product** | 1, 2, 3 | Own brainstorm + spec + plan cycle |
| 6 | **Studio settings + RBAC matrix UI** | 1 | Per-area permission UI, role presets editor, ownership transfer |
| 7 | **Landing CMS** | (independent) | Models for hero/features/testimonials, admin editor |

Each plan writes its own `docs/superpowers/plans/<date>-<name>.md` and references this foundations spec.

---

## Open decisions (acknowledged, not blocking)

- **Specific pricing for Free / Pro / Enterprise tiers** — placeholder values in §4.5. Decide before launching billing.
- **Concrete AI request quotas** — "Pro = AI with token cap" — actual cap value pending observation period.
- **WhatsApp delivery provider choice** — abstract notification system designed; concrete integration deferred.
- **Stripe vs regional payment gateway** — abstract payment provider designed; concrete provider TBD when launching billing.
- **RBAC area taxonomy** — what specific "areas" exist (scheduling, scripts, shots, contacts, settings, billing) needs final list. Initial guess: one area per main module.

---

## Success criteria

The foundations spec is successful if:

- Every later sub-project plan can reference it without re-deciding architecture
- A new engineer can read this spec and understand "why is the platform shaped this way?"
- Every cross-cutting constraint is captured (we don't rediscover the same issues mid-implementation)
- Sub-projects can ship independently in the order above without circular dependencies
- The AI worker (whatever phase) can operate against the platform without changes to the platform

---

**End of foundations spec.**
