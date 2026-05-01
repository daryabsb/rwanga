# REVIEWS & COMMUNITY — Full Implementation

> **Context:** The backend models for both apps already exist (created in earlier agent runs). The Round 2 agent created basic list/detail views. This task upgrades both sections into fully functional, production-ready features with real CRUD, proper UX, and the design patterns from MASTER-DESIGN.md.

> **Why now:** After this, we seed the system with a real project (Mysterious Guest / میوانێکی نادیار) through the MCP and test end-to-end. These are the last two major sections before the system is complete.

> **Read first:** `rwanga-design-kit/specs/CLAUDE.md`, then `rwanga-design-kit/specs/MASTER-DESIGN.md` (Part 4 — reviews and community sections).

> **Mode: NON-STOP.** Build everything. Only stop for genuine blockers.

---

## Section 1 — Reviews (Bible Review System)

This is the core business product — a structured consultation review of the project's screenplay/bible. The consultant (Darya/AI) analyzes scenes, proposes decisions, and the director locks or rejects them.

### 1.1 — Models (verify existing, fill gaps)

The models should already exist. Verify these are in `src/reviews/models.py`:

- `BibleReview` — project (FK→Project), author (FK→User), status (draft/in_review/delivered), version, content (JSONField)
- `SceneEvaluation` — bible_review (FK→BibleReview), scene (FK→Scene), analysis, tension_score, notes, recommendations
- `ReviewDecision` — bible_review (FK→BibleReview), scene (nullable FK→Scene), topic, decision_text, status (proposed/locked/rejected), proposed_by, locked_by, locked_at, rejected_by, rejected_at
- `InlineComment` — already exists from P1.6

If any model is missing fields, add them. Run `makemigrations` if changes are needed.

### 1.2 — Services (authority rules)

Create or update `src/reviews/services.py` with the authority enforcement from MASTER-DESIGN:

```python
class ReviewService:
    @staticmethod
    def create_review(project, author):
        """Create a new bible review. Author must be project member."""
        return BibleReview.objects.create(
            project=project, author=author, status='draft', version=1
        )

    @staticmethod
    def propose_decision(review, scene, topic, decision_text, proposed_by):
        """Only consultant or project member can propose."""
        return ReviewDecision.objects.create(
            bible_review=review, scene=scene, topic=topic,
            decision_text=decision_text, status='proposed',
            proposed_by=proposed_by
        )

    @staticmethod
    def lock_decision(decision, locked_by):
        """Consultant OR Director can lock (approve)."""
        decision.status = 'locked'
        decision.locked_by = locked_by
        decision.locked_at = timezone.now()
        decision.save()
        return decision

    @staticmethod
    def reject_decision(decision, rejected_by):
        """Director only can reject."""
        decision.status = 'rejected'
        decision.rejected_by = rejected_by
        decision.rejected_at = timezone.now()
        decision.save()
        return decision
```

### 1.3 — Template views (full CRUD)

Build these views in `src/reviews/views.py`, all extending `base.html`:

**1.3a — Reviews list** at `/reviews/` (project-scoped via session or URL):
- List all `BibleReview` records for the current project
- Each card shows: review title/version, status badge (draft → gray, in_review → amber, delivered → green), author name, date, scene evaluation count
- "New Review" button → opens create form (modal or page)
- Empty state: "هیچ پێداچوونەوەیەک نییە — پێداچوونەوەی نوێ دروست بکە"

**1.3b — Review detail** at `/reviews/<pk>/`:
- Header: review title, status badge, author, version, dates
- Tab or section layout:
  - **Decisions tab** — list of ReviewDecision items, each showing:
    - Topic, decision text, status badge
    - Scene reference (if linked to a scene)
    - Action buttons based on status:
      - proposed → "Lock" (green) and "Reject" (red) buttons
      - locked → shows locked_by and locked_at, no actions
      - rejected → shows rejected_by, option to re-propose
    - Lock/reject buttons POST via HTMX, update inline
  - **Scene Evaluations tab** — list of SceneEvaluation entries:
    - Scene number + slugline, analysis text, tension score (visual bar or number), recommendations
  - **Comments tab** — InlineComment thread for this review
- "Add Decision" button → form (modal or inline) with: topic, decision_text, scene (optional select)
- "Add Scene Evaluation" button → form with: scene (select), analysis, tension_score, notes, recommendations

**1.3c — Review create** at `/reviews/create/` or modal:
- Form: title (optional, auto-generate as "Review v{N}"), select project if not already scoped
- POST creates the BibleReview with status='draft', redirects to detail page

### 1.4 — API endpoints (verify/fix)

Verify these DRF endpoints work per MASTER-DESIGN:
- `GET/POST /api/v1/reviews/bible/{project_id}/` — list/create
- `GET/PATCH /api/v1/reviews/bible/{project_id}/{id}/` — detail/update
- `GET/POST /api/v1/reviews/decisions/{review_id}/` — list/create decisions
- `PATCH /api/v1/reviews/decisions/{review_id}/{id}/` — lock/reject

### 1.5 — Tests

Write tests in `src/reviews/tests/`:
- `test_models.py` — model creation, field validation
- `test_services.py` — authority rules: propose/lock/reject with correct and incorrect users
- `test_views.py` — list returns 200, create works, detail shows decisions, lock/reject POST handlers

---

## Section 2 — Community (External Review Sandbox)

This is the isolated review sandbox where the director shares frozen content snapshots with external reviewers. **Critical: no FK leakage back to production data.**

### 2.1 — Models (verify existing, fill gaps)

Verify in `src/community/models.py`:

- `ReviewSession` — project (FK→Project), title, session_type (screenplay/bible/scene_selection), status (draft/open/closed), created_by (FK→User), visibility (invite_only/public)
- `SessionContent` — session (FK→ReviewSession), content_type (screenplay/scene/bible), content_data (JSONField — frozen snapshot), label, order, version
- `ReviewSessionParticipant` — user (FK→User), session (FK→ReviewSession), role, invited_by, invited_at, accepted_at, is_active
- `SessionComment` — session_content (FK→SessionContent), author (FK→User), anchor_type (line/paragraph/scene/general), anchor_ref, body, parent (self FK for threads)
- `SessionReaction` — comment (FK→SessionComment), author (FK→User), reaction_type (agree/disagree/question)

**ISOLATION CHECK:** Verify there are NO foreign keys from SessionContent to Scene, Script, or any project model. `content_data` must be a JSON snapshot only.

### 2.2 — Snapshot service

Create or update `src/community/services.py`:

```python
class CommunityService:
    @staticmethod
    def create_session(project, title, session_type, created_by, visibility='invite_only'):
        return ReviewSession.objects.create(
            project=project, title=title, session_type=session_type,
            created_by=created_by, status='draft', visibility=visibility
        )

    @staticmethod
    def snapshot_scenes(session, scenes):
        """Freeze scene data into SessionContent JSON. No live FK."""
        contents = []
        for i, scene in enumerate(scenes):
            content = SessionContent.objects.create(
                session=session,
                content_type='scene',
                content_data={
                    'scene_number': scene.scene_number,
                    'slugline': scene.slugline,
                    'synopsis': scene.synopsis,
                    'page_count': str(scene.page_count) if scene.page_count else None,
                    'characters': list(scene.characters.values_list('name', flat=True)) if hasattr(scene, 'characters') else [],
                },
                label=f"Scene {scene.scene_number}",
                order=i
            )
            contents.append(content)
        return contents

    @staticmethod
    def snapshot_bible_review(session, bible_review):
        """Freeze a bible review into SessionContent JSON."""
        decisions = list(bible_review.decisions.values('topic', 'decision_text', 'status'))
        return SessionContent.objects.create(
            session=session,
            content_type='bible',
            content_data={
                'title': str(bible_review),
                'version': bible_review.version,
                'status': bible_review.status,
                'decisions': decisions,
            },
            label=f"Bible Review v{bible_review.version}",
            order=0
        )

    @staticmethod
    def invite_participant(session, user, invited_by):
        return ReviewSessionParticipant.objects.create(
            session=session, user=user, role='external_reviewer',
            invited_by=invited_by, invited_at=timezone.now(), is_active=True
        )

    @staticmethod
    def open_session(session):
        session.status = 'open'
        session.save()
        return session

    @staticmethod
    def close_session(session):
        session.status = 'closed'
        session.save()
        return session
```

### 2.3 — Template views (full CRUD)

Build these views in `src/community/views.py`, all extending `base.html`:

**2.3a — Sessions list** at `/community/` (project-scoped):
- List all `ReviewSession` records for the current project
- Each card shows: session title, type badge (screenplay/bible/scene_selection), status badge (draft → gray, open → green, closed → red), participant count, comment count, created date
- "New Session" button → create form
- Empty state: "هیچ دانیشتنێک نییە — دانیشتنی نوێ دروست بکە"

**2.3b — Session create** at `/community/create/` or modal:
- Form fields: title, session_type (select), visibility (select)
- After create, redirect to session detail where director can add content and invite participants

**2.3c — Session detail** at `/community/<pk>/`:
- Header: title, status badge, type, created_by, date range
- **Content section** — list of SessionContent entries:
  - Each shows: label, content_type badge, version
  - For scene content: show scene number, slugline, synopsis from the JSON snapshot
  - For bible content: show decisions summary from the JSON
- **Add Content** button (only in draft status):
  - Select scenes from the project → calls `snapshot_scenes`
  - Or select a bible review → calls `snapshot_bible_review`
  - These create frozen snapshots — make this clear in the UI
- **Participants section:**
  - List of ReviewSessionParticipant with avatar, name, role, invited date
  - "Invite" button → form to select/enter a user
- **Comments section:**
  - Threaded comments (SessionComment) grouped by SessionContent
  - Each comment shows: author, body, timestamp, reactions (agree/disagree/question counts)
  - Reply button → inline reply form (HTMX)
  - Reaction buttons → POST via HTMX, update counts inline
- **Session controls** (in header):
  - Draft → "Open Session" button (POST, changes status to open)
  - Open → "Close Session" button (POST, changes status to closed)
  - Closed → read-only, no add/edit actions

**2.3d — External reviewer view** (future, can be stubbed):
- When an external reviewer accesses a session, they see ONLY:
  - SessionContent (frozen data)
  - SessionComment (can read and post)
  - SessionReaction (can add)
- They do NOT see: project name, sidebar, production data
- For now, stub this as a note/TODO. The main flow (director creating and managing sessions) is the priority.

### 2.4 — API endpoints (verify/fix)

Per MASTER-DESIGN:
- `GET/POST /api/v1/community/sessions/{project_id}/` — list/create
- `GET/PATCH /api/v1/community/sessions/{project_id}/{id}/` — detail/close
- `POST /api/v1/community/sessions/{id}/invite/` — invite reviewer
- `GET/POST /api/v1/community/sessions/{id}/comments/` — list/create comments
- `POST /api/v1/community/sessions/{id}/comments/{id}/react/` — add reaction

### 2.5 — Tests

Write tests in `src/community/tests/`:
- `test_models.py` — model creation, isolation verification (no FK to project models from SessionContent)
- `test_services.py` — snapshot creation, invite, open/close session
- `test_views.py` — list, create, detail, add content, invite, comment, react

---

## Section 3 — Location create form (bonus fix)

The location modal opens but shows "Location create form wiring is pending." Wire it:

- The modal view at the locations add_modal URL must return a form with fields: name, description, address, int_ext (select: INT/EXT), time_of_day (select: DAY/NIGHT/DAWN/DUSK)
- POST handler creates the Location and returns a success response that closes the modal and refreshes the location list via HTMX

---

## Design Rules

- All templates extend `base.html`
- Use Rwanga design tokens (CSS variables from `rwanga.css`)
- RTL support (Cairo font, logical properties)
- Dark mode compatible
- HTMX for inline interactions (lock/reject, comments, reactions)
- Full page navigation for section changes (no hx-boost on nav links)
- Modals use the `#rw-modal-container` + `htmx:afterSwap` pattern from base.html
- Kurdish labels for all UI text (use `{% trans %}` tags)
- Status badges: draft/gray, in_review/amber or open/green, delivered/green or closed/red, proposed/amber, locked/green, rejected/red

## Validation

After building both sections:

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py test src.reviews src.community -v 2

# URL checks (logged in):
# /reviews/                    → 200, shows review list or empty state
# /reviews/create/             → 200 or modal works
# /reviews/<pk>/               → 200, shows decisions and evaluations
# /community/                  → 200, shows session list or empty state
# /community/create/           → 200 or modal works
# /community/<pk>/             → 200, shows content, participants, comments
# /locations/ → click "+ شوێنی نوێ" → modal opens with real form fields
```

## Progress Updates

Create ProgressTask entries for:
- Reviews full implementation (list, detail, create, lock/reject, evaluations)
- Community full implementation (sessions, snapshots, comments, reactions, invites)
- Location form wiring

Update each to "completed" as you finish. Create an AgentReport at the end.
