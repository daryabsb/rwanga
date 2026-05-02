# Design Task — Reviews & Community UX + Navigation Architecture

> **For: Claude Design Agent**
> **Owner: Darya Ibrahim**
> **Date: 2026-05-02**

> **Read first:** `rwanga-design-kit/specs/MASTER-DESIGN.md` (Part 4 — reviews and community apps), then `rwanga-design-kit/templates/` for existing design patterns (base.html, components/_topnav.html, projects/dashboard.html, components/_sidebar.html).

---

## Problem Statement

Reviews and Community are the two final major sections of Rwanga. The engineering agent built the backend and basic template views, but:

1. **No navigation** — users can only reach `/reviews/` and `/community/` by typing URLs or clicking sidebar icons. There's no integrated switching between Projects → Reviews → Community.
2. **No permissions architecture** — anyone logged in can see everything. There's no role-based access control for who can view reviews vs community.
3. **Wrong visual design** — the agent built raw forms with no labels, no badges, no tabs. The reviews page looks nothing like the Rwanga design kit.

---

## Task 1 — Navigation & Architecture

### Decision: Independent Sections with Dashboard Tiles

Reviews and Community are **independent sections**, not sub-pages of a project. The reasons:

- A reviewer (consultant) shouldn't need to navigate through the project workspace
- Community participants are external and should only see frozen snapshots
- The director's production workspace should stay focused on production
- Different permission models for each section

### What to Design

**A. User Dashboard (projects/list.html or a new dashboard)**

After the project cards, add a second row with two tiles/cards:

- **پێداچوونەوەکان (Reviews)** — links to `/reviews/`, shows count of active reviews across all projects the user has review access to
- **کۆمیونیتی (Community)** — links to `/community/`, shows count of active sessions

These tiles should use the Rwanga `rw-mod-card` pattern but with distinct colors (suggest: reviews = deep purple `#7c3aed`, community = teal `#0d9488`).

**B. Top Navigation**

The topnav currently has 5 section tabs (Script, Breakdown, Visualize, Plan, Shoot) that only show inside a project context. Add a **secondary nav mode** for when the user is on `/reviews/` or `/community/`:

- Show project name + 3 tabs: **پڕۆژە (Project)** | **پێداچوونەوە (Reviews)** | **کۆمیونیتی (Community)**
- Clicking "Project" goes to the project dashboard
- This allows switching between the three contexts without losing context

**C. Sidebar**

The right sidebar already has icons for reviews and community. These should:
- Highlight when active (like the current section indicators)
- Show badge counts (e.g., "3" for pending decisions, "2" for new comments)

### Permission Model

**Roles in the invitation flow:**

When a director/studio owner invites someone to a project (via the team/invitation modal), they should be able to assign one or more access levels:

| Role | Access |
|------|--------|
| **تیمی بەرهەمهێنان (Production Team)** | Full project workspace (scripts, scenes, locations, etc.) |
| **پێداچوونەوەکەر (Reviewer)** | Reviews section only — can view bible reviews, propose/lock/reject decisions, add scene evaluations |
| **کۆمیونیتی (Community Member)** | Community section only — can view session content, post comments, add reactions |
| **هەموو (Full Access)** | All of the above |

**Implementation notes for the engineer:**
- Add a `role` or `access_level` field to `ProjectMembership` (or a new `ProjectInvitation` model)
- The invitation modal should show checkboxes for these access levels
- Superusers (like Darya) always have full access
- The director/project creator always has full access
- Template views check `user.has_review_access(project)` and `user.has_community_access(project)`

---

## Task 2 — Reviews Page Redesign

The current reviews page is functional but visually broken. Redesign it to match the Rwanga design kit.

### Reference Files

- **Design system:** `rwanga-design-kit/static/css/rwanga.css` (CSS variables, tokens)
- **Base layout:** `rwanga-design-kit/templates/base.html`
- **Card patterns:** `rwanga-design-kit/templates/projects/dashboard.html` (module grid)
- **Scene view (tabs):** `rwanga-design-kit/templates/projects/scene_view.html`
- **Empty states:** `rwanga-design-kit/templates/components/_empty_state.html`
- **Modal pattern:** `rwanga-design-kit/templates/components/_modal.html`

### 2.1 — Reviews List (`/reviews/`)

**Layout:**
- Page title: "پێداچوونەوەکان" with project name subtitle
- "New Review" button using `rw-btn rw-btn-primary`
- Review cards in a list (not grid), each showing:
  - Review title/version (e.g., "پێداچوونەوەی v3")
  - Status badge: draft → `rw-badge-gray`, in_review → `rw-badge-amber`, delivered → `rw-badge-green`
  - Author avatar + name
  - Date (relative: "٢ ڕۆژ لەمەوپێش")
  - Decision stats: "٧ بڕیار — ٥ جێگیرکراو، ١ ڕەتکراوە"
  - Scene evaluation count
- Empty state: use `_empty_state.html` pattern with icon and Kurdish text

### 2.2 — Review Detail (`/reviews/<pk>/`)

**Header:**
- Review title + version badge
- Status badge (large)
- Author info + dates
- Action buttons: "گۆڕینی بار" (Change Status) dropdown

**Tab layout** (use the same tab pattern as scene_view.html):

| Tab | Kurdish | Content |
|-----|---------|---------|
| Decisions | بڕیارەکان | List of ReviewDecision items |
| Scene Evaluations | هەڵسەنگاندنی دیمەنەکان | List of SceneEvaluation items |
| Comments | لێدوانەکان | InlineComment thread |
| Bible | بایبڵ | The bible content (rendered from JSONField or text) |

**Decisions tab detail:**
Each decision is a card showing:
- Topic (bold, right-aligned)
- Decision text (body)
- Scene reference (if linked): "دیمەنی ١٦ — ناو باخەکە — شەو"
- Status badge: proposed → amber, locked → green, rejected → red
- Action buttons (only for authorized users):
  - Proposed → "جێگیرکردن" (Lock, green) + "ڕەتکردنەوە" (Reject, red)
  - Locked → shows who locked and when, no actions
  - Rejected → shows who rejected, option to re-propose
- HTMX inline updates for lock/reject actions

**Scene Evaluations tab:**
- Each evaluation shows: scene heading, analysis text, tension score (visual bar 0-10), recommendations
- Tension score: use a colored bar (0-3 green, 4-6 amber, 7-10 red) or a simple number badge

**Bible tab:**
- Render the bible content in a clean reading format
- Sections, headers, and character tables should be styled
- This is where the full Story Bible V3 content lives

### 2.3 — Review Create (modal or page)

- Simple form: project is auto-selected from context
- Title auto-generates as "پێداچوونەوەی v{N}"
- Optional: initial bible content (textarea or file upload)

---

## Design Rules (from MASTER-DESIGN)

- All templates extend `base.html`
- Use Rwanga CSS variables from `rwanga.css` (`--rw-bg`, `--rw-surface`, `--rw-text`, `--rw-primary`, `--rw-border`, etc.)
- RTL layout: Cairo font, `dir="rtl"`, logical properties (`margin-inline-start`, not `margin-left`)
- Dark mode: all colors via CSS variables, auto-switch with `data-theme="dark"`
- HTMX for inline interactions: `hx-post`, `hx-target`, `hx-swap`
- Modals: use `#rw-modal-container` + `htmx:afterSwap` pattern
- Kurdish labels: use `{% trans %}` tags for all UI text
- Status badges: `rw-badge-gray` (draft), `rw-badge-amber` (in_review/proposed), `rw-badge-green` (delivered/locked), `rw-badge-red` (rejected/closed)

---

## Deliverables

1. **Template files** (in `rwanga-design-kit/templates/`):
   - `reviews/list.html` — reviews list page
   - `reviews/detail.html` — review detail with tabs
   - `reviews/create.html` or `reviews/_create_modal.html`
   - `reviews/_decision_card.html` — partial for a single decision (HTMX swappable)
   - `reviews/_evaluation_card.html` — partial for a scene evaluation
   - `community/list.html` — sessions list (match same quality)
   - `community/detail.html` — session detail with content + comments
   - `community/_comment_thread.html` — threaded comments partial

2. **Updated templates:**
   - `projects/list.html` or dashboard — add review + community tiles
   - `components/_topnav.html` — add secondary nav mode for reviews/community
   - `components/_sidebar.html` — update icons with active states and badge counts
   - Invitation modal — add role/access checkboxes

3. **CSS additions** (in `rwanga.css` or a new `rwanga-reviews.css`):
   - Decision card styles
   - Tension score bar
   - Tab styles for review detail
   - Badge variants for review/decision statuses
   - Community comment thread styles

---

## Important Context

- The reviews section is the **core business product** — this is where the AI consultant (Claude) and the director collaborate on screenplay decisions. It must feel professional and authoritative.
- The community section is the **external sandbox** — lighter, more social, comment-focused. Should feel inviting but clearly separate from production data.
- The first real use case: Darya (consultant) and Sarwar (director) reviewing the "Mysterious Guest" bible with 20 locked decisions, scene evaluations, and a full story bible in Kurdish.
