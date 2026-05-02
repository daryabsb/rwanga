# Template Completion Spec — Rwanga Design Kit

**For:** Claude Design (template author)
**From:** Claude Opus (architecture lead)
**Date:** 2026-04-30
**Status:** Ready to execute

---

## Context

You designed the first batch of production-ready Django templates for Rwanga (`rwanga-design-kit/templates/`). Those templates are excellent — the coding agent copies them directly into the runtime project. But the design kit only covers ~30% of the pages defined in MASTER-DESIGN.md. The coding agent needs the rest before implementation can continue.

**Your completed work (13 files):**

```
templates/base.html                          ← app shell (sidebar + topnav + content)
templates/components/_sidebar.html           ← 68px icon rail
templates/components/_topnav.html            ← project-scoped navigation
templates/components/_breadcrumb.html        ← breadcrumb bar
templates/components/_empty_state.html       ← empty state component
templates/components/_ai_progress.html       ← AI job progress strip
templates/components/_modal.html             ← modal dialog
templates/components/_toast.html             ← toast notification
templates/accounts/login.html                ← standalone login (magic link + password)
templates/projects/dashboard.html            ← project home with module grid
templates/projects/create_wizard.html        ← project creation wizard
templates/projects/scene_view.html           ← tabbed scene workspace
templates/scripts/upload.html                ← script upload + AI breakdown
```

**What's missing:** 31 templates across all apps (detailed below).

---

## Design System Reference

All new templates MUST use your established design system. Here's a quick reference:

### Extends & Includes
- Full pages: `{% extends "base.html" %}` → content goes in `{% block content %}`
- Scene view tab partials: NO extends — they're HTMX fragments swapped into `#rw-tab-content`
- Standalone pages (login, community session): full HTML, no base.html

### CSS Classes (from rwanga.css)
- Layout: `.rw-app`, `.rw-main`, `.rw-rail`
- Cards: `.rw-card`, `.rw-card-title`
- Stats: `.rw-stats`, `.rw-stat`, `.rw-stat-val`, `.rw-stat-lbl`
- Tables: `.rw-shot-table`, `.rw-shot-row`, `.rw-shot-num`
- Buttons: `.rw-btn`, `.rw-btn-primary`, `.rw-btn-ghost`, `.rw-btn-amber`, `.rw-btn-icon`, `.rw-btn-ai`
- Badges: `.rw-badge`, `.rw-badge-d`, `.rw-badge-v`, `.rw-badge-i`
- Forms: `.rw-form-label`, `.rw-form-input`
- Empty: `.rw-empty`, `.rw-empty-icon`, `.rw-empty-title`, `.rw-empty-sub`
- Sections: `.rw-section-hdr`, `.rw-sec-row`, `.rw-sec-label`, `.rw-sec-modules`
- Checklists: `.rw-checklist`, `.rw-check-item`, `.rw-ci-name`, `.rw-ci-note`
- Filters: `.rw-filter-row`, `.rw-f-btn`
- Floor plan: `.rw-fp-controls`, `.rw-fp-btn`, `.rw-fp-wrap`
- Lighting: `.rw-ct-bar`, `.rw-ct-seg`, `.rw-light-grid`, `.rw-light-card`
- Sound: `.rw-sound-list`, `.rw-sound-item`
- Wardrobe: `.rw-wardrobe-grid`, `.rw-wc-card`, `.rw-wc-name`
- Continuity: `.rw-flow`, `.rw-flow-node`, `.rw-cont-grid`
- Schedule: `.rw-sched-list`, `.rw-sched-row`
- Storyboard: `.rw-sb-grid`, `.rw-sb-card`, `.rw-sb-thumb`
- Warn box: `.rw-warn`, `.rw-warn-icon`, `.rw-warn-text`
- Upload: `.rw-upload-zone`, `.rw-upload-icon`, `.rw-upload-title`

### Design Tokens (CSS variables)
- Backgrounds: `--rw-bg`, `--rw-surface`, `--rw-surface-2`, `--rw-surface-3`
- Borders: `--rw-border`, `--rw-border-2`
- Text: `--rw-text`, `--rw-text-2`, `--rw-text-3`
- Accent: `--rw-amber`, `--rw-amber-dim`, `--rw-pink`, `--rw-pink-dim`
- Sections: `--rw-script`, `--rw-break`, `--rw-vis`, `--rw-plan`, `--rw-shoot`
- Layout: `--rw-rail-w` (68px), `--rw-panel-w` (248px), `--rw-topnav-h` (56px)
- Spacing: `--rw-pad-xs` (8px), `--rw-pad-sm` (16px), `--rw-pad-md` (28px), `--rw-pad-lg` (48px), `--rw-pad-xl` (72px)
- Fonts: `--rw-font` (Cairo), `--rw-font-en` (Inter)

### i18n Rules
- ALL user-facing text: `{% trans "..." %}`
- Load at top: `{% load static i18n %}`
- Kurdish is the display language; English is for development
- Technical terms stay LTR: `<bdi>85mm</bdi>`, `<span dir="ltr">POV</span>`
- Shot numbers always Western digits: "12.1" never "١٢.١"

### HTMX Patterns
- Tab switch: `hx-get="..." hx-target="#rw-tab-content" hx-swap="innerHTML"`
- Inline edit: `hx-get` on click → swap row with form partial
- Filter: `hx-get` on input, `hx-trigger="input changed delay:300ms"`
- Checkbox toggle: `hx-post` on change, `hx-swap="none"`
- Modal: `hx-get="..." hx-target="#rw-modal-container" hx-swap="innerHTML"`

### Template Header Format
```
{# ════════════════════════════════════════════════════════
   RWANGA — <app>/<template_name>.html
   <One-line description>

   Context:
     <variable>   — <Type> <description>
   ════════════════════════════════════════════════════════ #}
```

---

## PRIORITY 1 — Phase 0/1 Templates (Build First)

These templates are needed immediately. The coding agent is blocked on them.

---

### 1. `templates/projects/list.html`

**URL name:** `projects:list`
**URL pattern:** `/projects/`
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
project          — Project instance (active, if any)
owned_projects   — QuerySet[Project] owned by user's studio
member_projects  — QuerySet[Project] where user has ProjectMembership
invitations      — QuerySet[ProjectMembership] pending (accepted_at=None)
```

**Description:** The project lobby — the first page after login. Shows all projects the user has access to. This is the "dashboard" in the project-as-workspace model: not a project dashboard, but the studio lobby where you pick which project workspace to enter.

**Layout spec:**
- Page header: "ڕوانگە" brand + user's studio name
- Section: "Owned Projects" — grid of project cards (cover image, title, type, scene count, last updated)
- Section: "Member Projects" — same card format, different heading
- Section: "Invitations" — pending invites with accept/decline buttons
- Each project card links to `projects:dashboard` with `project.pk`
- Empty state (no projects): use `_empty_state.html` with CTA to create first project
- "+ New Project" button linking to `projects:create_wizard`
- No `active_project` in context (we're in the lobby, not inside a project)

**Card design:** Use `.rw-card` style. Each card shows:
- Cover image or emoji placeholder (like dashboard header)
- Project title (bold)
- `project.get_project_type_display` + scene count
- Last updated date

---

### 2. `templates/accounts/register.html`

**URL name:** `accounts:register` (maps to allauth signup)
**URL pattern:** `/accounts/signup/`
**Extends:** NONE — standalone page like login.html
**Phase:** P1

**Context variables:**
```
form     — allauth signup form
error    — error message (optional)
```

**Description:** Registration page. Same standalone dark page style as login.html — centered box, brand mark, no sidebar/topnav.

**Layout spec:** Mirror login.html structure exactly:
- Brand mark "ڕ" (pink square)
- Title: `{% trans "دروستکردنی هەژمار" %}` (Create Account)
- Subtitle: same platform tagline as login
- Form fields: email, nickname, first_name, last_name, password (use `.rw-form-label` + `.rw-form-input`)
- Submit button: `.rw-btn .rw-btn-primary` full width
- Footer link: "Already have an account?" → login page
- Theme toggle at bottom

---

### 3. `templates/accounts/profile.html`

**URL name:** `accounts:profile`
**URL pattern:** `/accounts/profile/`
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
user             — User instance
studio           — Studio instance
memberships      — QuerySet[ProjectMembership] user's active memberships
```

**Description:** User profile page. Shows user info, studio info, project memberships.

**Layout spec:**
- User info card: avatar (initials circle like topnav), name, email, nickname
- Studio info card: studio name, slug, language, timezone
- Project memberships list: project name, role, joined date
- Edit profile button (links to `accounts:settings`)

---

### 4. `templates/accounts/settings.html`

**URL name:** `accounts:settings`
**URL pattern:** `/accounts/settings/`
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
user         — User instance
studio       — Studio instance
user_form    — User edit form
studio_form  — Studio edit form
```

**Description:** Account settings page. Edit user profile and studio settings.

**Layout spec:**
- Two-section layout (not tabs — just stacked cards):
  - "Account" card: name, email, nickname, password change link
  - "Studio" card: studio name, logo upload, language selector, timezone
- Save button per section
- Danger zone at bottom: "Delete Account" (`.rw-warn` style warning)

---

### 5. `templates/accounts/team.html`

**URL name:** `accounts:team`
**URL pattern:** `/accounts/team/` (studio-scoped via middleware)
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
studio       — Studio instance
members      — QuerySet[ProjectMembership] grouped by project
invitations  — QuerySet[ProjectMembership] pending invites
```

**Description:** Studio team management. List all crew and reviewers across projects.

**Layout spec:**
- Page title: `{% trans "تیمی ستودیۆ" %}` (Studio Team)
- Invite button: "+ Invite Member" → opens modal (use `_modal.html`)
- Members table: name, email, role_type, department_role, project, status (active/pending)
- Group by project or flat list (filter toggle using `.rw-filter-row`)
- Pending invitations section with resend/cancel actions

---

### 6. `templates/accounts/contacts.html`

**URL name:** `accounts:contacts`
**URL pattern:** `/projects/<project_pk>/contacts/`
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
project      — Project instance
members      — QuerySet[ProjectMembership] for this project
```

**Description:** Project-scoped crew contact list. Referenced from dashboard module grid (Plan section).

**Layout spec:**
- Breadcrumb: project → "Contacts"
- Member cards or table: name, role, department, phone, email
- Group by department_role
- Invite button for adding new project members

---

### 7. `templates/projects/settings.html`

**URL name:** `projects:settings`
**URL pattern:** `/projects/<project_pk>/settings/`
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
project      — Project instance
form         — Project edit form
members      — QuerySet[ProjectMembership]
```

**Description:** Project settings. Edit project metadata, manage team, danger zone.

**Layout spec:**
- Breadcrumb: project → "Settings"
- Project info card: title, title_latin, project_type, logline, cover image upload, status
- Team section: list members with role management
- Danger zone: archive/delete project (`.rw-warn` box)

---

### 8. `templates/scripts/index.html`

**URL name:** `scripts:index`
**URL pattern:** `/projects/<project_pk>/scripts/`
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
project          — Project instance
scripts          — QuerySet[Script]
active_section   — 's' (script section)
```

**Description:** Script list for the project. Links to upload and breakdown views.

**Layout spec:**
- Breadcrumb: project → "Scripts"
- Script list: filename, upload date, scene count, status
- Each script links to breakdown view
- Empty state: "No scripts uploaded" with CTA to upload page
- Upload button in header

---

### 9. `templates/scripts/breakdown.html`

**URL name:** `scripts:breakdown`
**URL pattern:** `/projects/<project_pk>/scripts/breakdown/`
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
project          — Project instance
breakdown        — breakdown data (characters, locations, props extracted from script)
active_section   — 'b' (breakdown section)
```

**Description:** Script breakdown view. Shows elements extracted by AI from uploaded screenplay.

**Layout spec:**
- Breadcrumb: project → "Breakdown"
- Stats strip: total scenes, characters, locations, props (use `.rw-stats`)
- Sections for each element type: Characters, Locations, Props, SFX, VFX
- Each element: name, occurrence count, linked scenes
- "Re-run Breakdown" AI button
- Empty state if no breakdown exists yet

---

### 10. `templates/scripts/docs.html`

**URL name:** `scripts:docs`
**URL pattern:** `/projects/<project_pk>/scripts/docs/`
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
project      — Project instance
documents    — list of script-related documents
active_section — 's'
```

**Description:** Script documents view — treatments, synopses, notes associated with the project.

**Layout spec:**
- Breadcrumb: project → "Documents"
- Document list: title, type, last modified, author
- Upload/create document button
- Empty state if no documents

---

### 11. `templates/scripts/elements.html`

**URL name:** `scripts:elements`
**URL pattern:** `/projects/<project_pk>/scripts/elements/`
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
project      — Project instance
elements     — categorized elements (characters, locations, props, etc.)
active_section — 'b'
```

**Description:** All script elements in a browsable list. Linked from dashboard breakdown section.

**Layout spec:**
- Breadcrumb: project → "Elements"
- Filter bar: by type (Characters, Locations, Props, SFX, VFX) using `.rw-filter-row`
- Element cards: name, type badge, scene appearances
- Click element → detail modal or inline expand

---

### 12. `templates/projects/_scene_list.html` (HTMX partial)

**URL name:** `projects:scene_list_partial`
**URL pattern:** `/projects/<project_pk>/scenes/partial/`
**Extends:** NONE — partial fragment
**Phase:** P1

**Context variables:**
```
scenes       — QuerySet[Scene]
active_scene — Scene instance (current)
group_by     — bool (group by location)
```

**Description:** Scene list panel content loaded via HTMX into `scene_view.html`'s `#rw-scene-list` div. Already referenced by scene_view.html.

**Layout spec:** Use the scene list classes from rwanga.css:
- If `group_by`: `.rw-scene-grp-label` headers by location
- Each scene: `.rw-scene-item` with `.rw-sc-num` + `.rw-sc-loc` + `.rw-sc-time`
- Active scene gets `.active` class
- Click links to scene view for that scene

---

### 13. `templates/stub.html`

**URL name:** used by all stub views
**Extends:** `base.html`
**Phase:** P1

**Context variables:**
```
stub_name    — string (module name)
```

**Description:** Shared stub template for URL names that exist but have no real page yet. Per AGENT-REMEDIATION.md spec.

**Content:** Exactly as specified in AGENT-REMEDIATION.md:
```html
{% extends "base.html" %}
{% block content %}
<div id="rw-content" style="padding:var(--rw-pad-lg)">
  <p style="color:var(--rw-text-2)">{{ stub_name }} — coming soon</p>
</div>
{% endblock %}
```

---

## PRIORITY 2 — Scene View Tab Partials (Phase 2-3)

These are HTMX fragments loaded into scene_view.html's `#rw-tab-content` div. They do NOT extend base.html. They are standalone HTML fragments.

**Common URL pattern:** `projects:scene_tab` with `project_pk`, `scene_pk`, `tab_id`

---

### 14. `templates/projects/scenes/tabs/overview.html`

**Tab ID:** `overview`
**Phase:** P2

**Context variables:**
```
scene        — Scene instance
project      — Project instance
shot_count   — int
setup_count  — int
screen_time  — string (e.g., "2:30")
characters   — QuerySet[Character] in this scene
```

**Description:** Scene overview tab — the default tab. Quick summary of everything about this scene.

**Layout spec:**
- Stats strip (`.rw-stats`): shots, setups, screen time, characters
- Scene description card (`.rw-card`): scene heading, int/ext, location, time of day, description text
- Characters in scene: list with names
- Quick actions: "Add Shot", "Edit Scene", "Export"

---

### 15. `templates/projects/scenes/tabs/shots.html`

**Tab ID:** `shots`
**Phase:** P2

**Context variables:**
```
scene        — Scene instance
project      — Project instance
shots        — QuerySet[Shot] ordered by `order`
setups       — QuerySet[Setup]
filter_type  — current filter (optional)
```

**Description:** Shot list with HTMX inline editing. The core production table.

**Layout spec:**
- Filter bar (`.rw-filter-row`): All / Dialogue / Visual / Insert
- Shot table (`.rw-shot-table`):
  - Columns: #, Type, Style, Lens, Movement, Duration, Setup
  - Each row (`.rw-shot-row`): clickable to expand (`.rw-exp-row`)
  - Expanded view (`.rw-exp-grid`): full shot details, notes block (`.rw-notes-block`), edit button
  - Shot number in `.rw-shot-num` (amber)
  - Type badges (`.rw-badge-d`, `.rw-badge-v`, `.rw-badge-i`)
  - Setup chips (`.rw-setup-chip`)
- Add Shot button at bottom
- Sortable.js integration: `data-sortable` attribute on table body
- Empty state if no shots

---

### 16. `templates/projects/scenes/tabs/floorplan.html`

**Tab ID:** `floorplan`
**Phase:** P2

**Context variables:**
```
scene        — Scene instance
project      — Project instance
floorplan    — FloorPlan instance or None
```

**Description:** Floor plan editor tab. SVG canvas rendered from JSON data.

**Layout spec:**
- Controls bar (`.rw-fp-controls`): Select, Furniture, Camera, Path, Delete buttons (`.rw-fp-btn`)
- SVG canvas wrapper (`.rw-fp-wrap`): renders floor plan from JSON
- Properties panel (right side or below): selected item properties
- Empty state if no floor plan: "Create Floor Plan" button
- Save button (HTMX post)
- Floor plan loaded via `floorplan-editor.js` (already in static/js/)

**Extra block:** `{% block floorplan_js %}` loads `floorplan-editor.js` + `floorplan.css`

---

### 17. `templates/projects/scenes/tabs/storyboard.html`

**Tab ID:** `storyboard`
**Phase:** P3

**Context variables:**
```
scene            — Scene instance
project          — Project instance
storyboard_frames — QuerySet[StoryboardFrame] with linked shots
```

**Description:** Storyboard grid. Upload images, associate with shots, reorder via drag-and-drop.

**Layout spec:**
- Storyboard grid (`.rw-sb-grid`):
  - Each card (`.rw-sb-card`): thumbnail (`.rw-sb-thumb`, 16:9 ratio), shot number (`.rw-sb-num`), style (`.rw-sb-style`), lens (`.rw-sb-lens`)
  - Empty thumbnail shows shot number in large amber text
- Upload zone for new frames
- Sortable.js for reorder
- Click card → detail modal with full image + shot association

---

### 18. `templates/projects/scenes/tabs/lighting.html`

**Tab ID:** `lighting`
**Phase:** P3

**Context variables:**
```
scene            — Scene instance
project          — Project instance
lighting_notes   — QuerySet[LightingNote] for shots in this scene
color_temps      — list of color temperature data
```

**Description:** Lighting module. Color temperature visualization + per-shot lighting notes.

**Layout spec:**
- Color temperature bar (`.rw-ct-bar`): gradient segments showing temperature across shots
- Lighting grid (`.rw-light-grid`, 2-column):
  - Each card (`.rw-light-card`): shot number (`.rw-light-num`), note text (`.rw-light-note`), equipment list
- Add note button per shot
- Section header: `{% trans "ڕووناکی" %}`

---

### 19. `templates/projects/scenes/tabs/sound.html`

**Tab ID:** `sound`
**Phase:** P3

**Context variables:**
```
scene            — Scene instance
project          — Project instance
sound_notes      — QuerySet[SoundNote]
sound_setup      — dict (track assignments, equipment)
critical_moments — list (timestamped critical sound cues)
```

**Description:** Sound module. Golden rule checklist, track setup, critical moments.

**Layout spec:**
- Golden rule card: "Record room tone" reminder (`.rw-warn` style with amber instead of pink)
- Sound list (`.rw-sound-list`):
  - Each item (`.rw-sound-item`): icon (`.rw-si-icon`), title (`.rw-si-title`), description (`.rw-si-desc`)
  - Critical items get `.crit` on title (shows in pink)
- Track setup section: which audio tracks are assigned to what
- Add note button

---

### 20. `templates/projects/scenes/tabs/props.html`

**Tab ID:** `props`
**Phase:** P3

**Context variables:**
```
scene        — Scene instance
project      — Project instance
props        — QuerySet[Prop] categorized (A/B/C)
```

**Description:** Props checklist with categories. HTMX checkbox toggles.

**Layout spec:**
- Category labels: A = Critical (`.rw-cat-a`), B = Important (`.rw-cat-b`), C = Background (`.rw-cat-c`)
- Checklist (`.rw-checklist`):
  - Each item (`.rw-check-item`): checkbox (HTMX toggle: `hx-post`, `hx-swap="none"`), name (`.rw-ci-name`), note (`.rw-ci-note`), linked shots (`.rw-ci-shots`)
- Add prop button → modal form
- Section header per category

---

### 21. `templates/projects/scenes/tabs/wardrobe.html`

**Tab ID:** `wardrobe`
**Phase:** P3

**Context variables:**
```
scene            — Scene instance
project          — Project instance
characters       — QuerySet[Character] in scene
wardrobe_items   — QuerySet[WardrobeItem] grouped by character
```

**Description:** Wardrobe module. Character outfit cards.

**Layout spec:**
- Wardrobe grid (`.rw-wardrobe-grid`, 2-column):
  - Each card (`.rw-wc-card`): character name (`.rw-wc-name`), outfit rows (`.rw-wc-row` with label:value pairs), notes block (`.rw-wc-note`)
  - Card border-top color from character's assigned color
- Add wardrobe item button per character
- Image upload per item

---

### 22. `templates/projects/scenes/tabs/continuity.html`

**Tab ID:** `continuity`
**Phase:** P3

**Context variables:**
```
scene        — Scene instance
project      — Project instance
prev_scene   — Scene or None
next_scene   — Scene or None
continuity_items — QuerySet[ContinuityItem] (in/out)
```

**Description:** Continuity module. Scene flow visualization + in/out checklists.

**Layout spec:**
- Scene flow (`.rw-flow`):
  - Three nodes (`.rw-flow-node`): prev scene → current scene (`.current`) → next scene
  - Arrows between (`.rw-flow-arr`)
  - Each shows scene number (`.rw-flow-num`) + location label (`.rw-flow-lbl`)
- Continuity grid (`.rw-cont-grid`, 2-column):
  - Left: "IN" items (what carries into this scene from previous)
  - Right: "OUT" items (what carries from this scene to next)
- Checklist items with checkboxes (HTMX toggle)
- Add continuity item buttons per direction

---

### 23. `templates/projects/scenes/tabs/schedule.html`

**Tab ID:** `schedule`
**Phase:** P4

**Context variables:**
```
scene            — Scene instance
project          — Project instance
schedule_blocks  — QuerySet[ScheduleBlock] for this scene
shoot_day        — ShootDay or None
```

**Description:** Scene schedule tab showing when this scene is scheduled to shoot.

**Layout spec:**
- Schedule strip (`.rw-sched-list`):
  - Each block (`.rw-sched-row`): time (`.rw-s-time`), duration (`.rw-s-dur`), setup (`.rw-s-setup`), title (`.rw-s-title`), shot list (`.rw-s-shots`), notes (`.rw-s-notes`), cast (`.rw-s-cast`)
  - Break rows get `.s-break`
  - Priority items get `.rw-pri-badge`
- Empty state if not yet scheduled

---

## PRIORITY 3 — Full Page Templates (Phase 2-4)

---

### 24. `templates/shots/list.html`

**URL name:** `shots:list`
**URL pattern:** `/projects/<project_pk>/shots/`
**Extends:** `base.html`
**Phase:** P2

**Context variables:**
```
project      — Project instance
shots        — QuerySet[Shot] (project-wide, all scenes)
filters      — current filter state
active_section — 'v' (visualize)
```

**Description:** Project-wide shot list. All shots across all scenes with filters.

**Layout spec:**
- Filter bar: by scene, type, setup, movement (`.rw-filter-row`)
- Same table structure as scene tab but with scene column added
- HTMX filter: `hx-get` on filter change, `hx-target="#rw-shot-list"`
- Group by scene option

---

### 25. `templates/shots/storyboards.html`

**URL name:** `shots:storyboards`
**URL pattern:** `/projects/<project_pk>/storyboards/`
**Extends:** `base.html`
**Phase:** P2

**Context variables:**
```
project              — Project instance
storyboard_frames    — QuerySet[StoryboardFrame] (project-wide)
active_section       — 'v'
```

**Description:** Project-wide storyboard gallery.

**Layout spec:**
- Storyboard grid (`.rw-sb-grid`) — same cards as scene tab version
- Filter by scene
- Upload new frames

---

### 26. `templates/floorplans/list.html`

**URL name:** `floorplans:list`
**URL pattern:** `/projects/<project_pk>/floorplans/`
**Extends:** `base.html`
**Phase:** P2

**Context variables:**
```
project      — Project instance
floorplans   — QuerySet[FloorPlan]
active_section — 'v'
```

**Description:** List of all floor plans for the project.

**Layout spec:**
- Grid of floor plan cards: scene reference, name, thumbnail (SVG preview), last modified
- Click → opens floor plan editor for that scene
- Create new button

---

### 27. `templates/scheduling/index.html`

**URL name:** `scheduling:index`
**URL pattern:** `/projects/<project_pk>/schedule/`
**Extends:** `base.html`
**Phase:** P4

**Context variables:**
```
project      — Project instance
shoot_days   — QuerySet[ShootDay]
active_section — 'p'
```

**Description:** Shooting schedule overview. Stripboard view.

**Layout spec:**
- Day selector: list of shoot days with dates
- Stripboard (`.rw-sched-list`): schedule blocks per day
- Sortable.js for reorder (drag strips to reschedule)
- Add shoot day button
- Total shoot days stat

---

### 28. `templates/scheduling/stripboard.html`

**URL name:** `scheduling:stripboard`
**URL pattern:** `/projects/<project_pk>/schedule/stripboard/`
**Extends:** `base.html`
**Phase:** P4

**Context variables:**
```
project      — Project instance
strips       — ordered schedule strips (scenes + day breaks)
active_section — 'p'
```

**Description:** Full stripboard — the industry-standard schedule visualization. Each scene is a colored strip, draggable to reorder.

**Layout spec:**
- Strips colored by int/ext and day/night
- Columns: day, scene #, int/ext, location, pages, cast members
- Sortable.js for drag-and-drop reorder
- Day break markers between shoot days
- Print/export button

---

### 29. `templates/scheduling/call_sheets.html`

**URL name:** `scheduling:call_sheets`
**URL pattern:** `/projects/<project_pk>/call-sheets/`
**Extends:** `base.html`
**Phase:** P4

**Context variables:**
```
project      — Project instance
call_sheets  — QuerySet[CallSheet]
active_section — 'sh'
```

**Description:** List of call sheets. Download PDF, send via WhatsApp.

**Layout spec:**
- Call sheet list: shoot day, date, location, general call time, status (draft/sent)
- Actions per sheet: View PDF, Download, Send via WhatsApp
- Generate new call sheet button
- WhatsApp delivery status indicator

---

### 30. `templates/locations/list.html`

**URL name:** `locations:list`
**URL pattern:** `/locations/` (NOT project-scoped — global)
**Extends:** `base.html`
**Phase:** P4

**Context variables:**
```
locations    — QuerySet[Location]
```

**Description:** Location management with map. Referenced from sidebar and dashboard.

**Layout spec:**
- Split view: map on top/left, list on bottom/right
- Map: Leaflet.js with markers for each location (load from CDN)
- Location cards: name, address, photo thumbnail, linked scenes count
- Click card → highlight on map
- Add location button → modal form with map pin placement

---

### 31. `templates/notifications/panel.html` (HTMX partial)

**URL name:** `notifications:panel`
**Extends:** NONE — partial, loaded into sidebar via HTMX
**Phase:** P4

**Context variables:**
```
notifications — QuerySet[Notification] recent
unread_count  — int
```

**Description:** Notification dropdown panel loaded when bell icon is clicked in sidebar.

**Layout spec:**
- Small panel (max 360px wide, max 480px tall)
- Notification items: icon, message, timestamp, read/unread indicator
- "Mark all read" button at top
- "View all" link at bottom
- Each notification links to relevant page
- Background: `--rw-surface`, border: `--rw-border`

---

## PRIORITY 4 — Progress App Templates (Phase 0)

The progress app is for Darya (project owner) to monitor implementation. These pages are simpler — they're admin-style data views, not production UI. Use the same design system but keep layouts straightforward.

---

### 32. `templates/progress/dashboard.html`

**URL name:** `progress:dashboard`
**URL pattern:** `/progress/`
**Extends:** `base.html`
**Phase:** P0

**Context variables:**
```
tasks_summary    — dict (pending, in_progress, completed, blocked counts)
recent_updates   — QuerySet[ProgressUpdate] last 10
current_phase    — string (e.g., "P1")
open_gaps        — QuerySet[GapBlocker] status=open
```

**Description:** Progress tracking dashboard. Darya's main monitoring page.

**Layout spec:**
- Stats strip (`.rw-stats`): tasks by status (4 columns), current phase
- Open blockers section (`.rw-warn` for critical, `.rw-card` for others)
- Recent updates feed: chronological list of ProgressUpdate entries
- Quick links: Tasks, Gaps, Decisions, Agent Reports, Changelog

---

### 33. `templates/progress/tasks.html`

**URL name:** `progress:tasks`
**URL pattern:** `/progress/tasks/`
**Extends:** `base.html`
**Phase:** P0

**Context variables:**
```
tasks        — QuerySet[ProgressTask]
filters      — current filter state (phase, status, app, priority)
```

**Description:** Full task list with filters.

**Layout spec:**
- Filter bar: phase (P0-P7), status, app_name, priority
- Task table: title, phase, app, status badge, priority, assigned_to
- Status badges: pending (gray), in_progress (amber), completed (green), blocked (pink)
- Click row → task detail page
- HTMX filtering

---

### 34. `templates/progress/task_detail.html`

**URL name:** `progress:task_detail`
**URL pattern:** `/progress/tasks/<id>/`
**Extends:** `base.html`
**Phase:** P0

**Context variables:**
```
task         — ProgressTask instance
updates      — QuerySet[ProgressUpdate] linked to this task
blocked_by   — QuerySet[ProgressTask] (M2M)
changes      — QuerySet[ChangeRecord] linked to this task
```

**Description:** Individual task with linked updates, dependencies, and change records.

**Layout spec:**
- Task header: title, status badge, phase, priority
- Description card
- Dependencies: blocked_by tasks (linked)
- Updates timeline: chronological ProgressUpdate entries
- Change records: files changed, diffs
- Edit status button (HTMX)

---

### 35. `templates/progress/updates.html`

**URL name:** `progress:updates`
**URL pattern:** `/progress/updates/`
**Extends:** `base.html`
**Phase:** P0

**Context:** `updates` — QuerySet[ProgressUpdate] chronological

**Description:** Chronological feed of all progress updates.

**Layout:** Timeline-style feed. Each entry: timestamp, author, type badge, body, linked task.

---

### 36. `templates/progress/gaps.html`

**URL name:** `progress:gaps`
**URL pattern:** `/progress/gaps/`
**Extends:** `base.html`
**Phase:** P0

**Context:** `gaps` — QuerySet[GapBlocker], `filters` — severity/status/type

**Description:** Open gaps and blockers list.

**Layout:** Filter bar + list. Critical gaps use `.rw-warn` styling. Each: title, severity badge, gap_type, description, related task, resolution status.

---

### 37. `templates/progress/decisions.html`

**URL name:** `progress:decisions`
**URL pattern:** `/progress/decisions/`
**Extends:** `base.html`
**Phase:** P0

**Context:** `decisions` — QuerySet[DesignDecision], filters

**Description:** Design decision log.

**Layout:** Table or card list. Each: title, phase, status (proposed/approved/superseded), decided_by, date. Click → expand with context + alternatives considered.

---

### 38. `templates/progress/agent_reports.html`

**URL name:** `progress:agent_reports`
**URL pattern:** `/progress/agent-reports/`
**Extends:** `base.html`
**Phase:** P0

**Context:** `reports` — QuerySet[AgentReport]

**Description:** Agent session reports.

**Layout:** Card list. Each report: agent_name, phase, report_type badge, summary, tasks completed count, tasks blocked count, gaps found count. Click → expand full details.

---

### 39. `templates/progress/changelog.html`

**URL name:** `progress:changelog`
**URL pattern:** `/progress/changelog/`
**Extends:** `base.html`
**Phase:** P0

**Context:** `changes` — QuerySet[ChangeRecord]

**Description:** Change record log.

**Layout:** Timeline feed. Each: change_type badge, app_name, description, files_changed, commit_hash, timestamp.

---

### 40. `templates/progress/diagrams.html`

**URL name:** `progress:diagrams`
**URL pattern:** `/progress/diagrams/`
**Extends:** `base.html`
**Phase:** P0

**Context:** `current_diagram` — SystemDiagram (is_current=True), `all_diagrams` — QuerySet

**Description:** System diagrams viewer.

**Layout:** Current diagram rendered (Mermaid or SVG). Selector to switch between diagram types. History of previous versions.

---

### 41. `templates/progress/docs.html`

**URL name:** `progress:docs`
**URL pattern:** `/progress/docs/`
**Extends:** `base.html`
**Phase:** P0

**Context:** `documents` — QuerySet[DocumentVersion]

**Description:** Document version history.

**Layout:** Table: document_name, version, changed_by, change_summary, phase, date. Click → view content.

---

## DEFERRED — Phase 6 Templates (Do Not Build Yet)

These are documented for completeness but should NOT be built now. Build them when Phase 6 begins.

### `templates/community/session_detail.html` — Sandboxed session view (standalone, NO base.html)
### `templates/community/session_list.html` — Session list for directors (extends base.html)
### `templates/reviews/bible_detail.html` — Structured review view (extends base.html)
### `templates/reviews/_inline_comment.html` — Comment form HTMX partial

---

## File Delivery Checklist

Place all completed templates in:
```
rwanga-design-kit/templates/
```

Following the existing structure:
```
templates/
├── base.html                          ✅ done
├── stub.html                          ◻ NEW
├── components/                        ✅ done (7 files)
├── accounts/
│   ├── login.html                     ✅ done
│   ├── register.html                  ◻ NEW
│   ├── profile.html                   ◻ NEW
│   ├── settings.html                  ◻ NEW
│   ├── team.html                      ◻ NEW
│   └── contacts.html                  ◻ NEW
├── projects/
│   ├── list.html                      ◻ NEW
│   ├── dashboard.html                 ✅ done
│   ├── create_wizard.html             ✅ done
│   ├── settings.html                  ◻ NEW
│   ├── scene_view.html                ✅ done
│   ├── _scene_list.html               ◻ NEW (partial)
│   └── scenes/tabs/
│       ├── overview.html              ◻ NEW (partial)
│       ├── shots.html                 ◻ NEW (partial)
│       ├── floorplan.html             ◻ NEW (partial)
│       ├── storyboard.html            ◻ NEW (partial)
│       ├── lighting.html              ◻ NEW (partial)
│       ├── sound.html                 ◻ NEW (partial)
│       ├── props.html                 ◻ NEW (partial)
│       ├── wardrobe.html              ◻ NEW (partial)
│       ├── continuity.html            ◻ NEW (partial)
│       └── schedule.html              ◻ NEW (partial)
├── scripts/
│   ├── upload.html                    ✅ done
│   ├── index.html                     ◻ NEW
│   ├── breakdown.html                 ◻ NEW
│   ├── docs.html                      ◻ NEW
│   └── elements.html                  ◻ NEW
├── shots/
│   ├── list.html                      ◻ NEW
│   └── storyboards.html              ◻ NEW
├── floorplans/
│   └── list.html                      ◻ NEW
├── scheduling/
│   ├── index.html                     ◻ NEW
│   ├── stripboard.html               ◻ NEW
│   └── call_sheets.html              ◻ NEW
├── locations/
│   └── list.html                      ◻ NEW
├── notifications/
│   └── panel.html                     ◻ NEW (partial)
└── progress/
    ├── dashboard.html                 ◻ NEW
    ├── tasks.html                     ◻ NEW
    ├── task_detail.html               ◻ NEW
    ├── updates.html                   ◻ NEW
    ├── gaps.html                      ◻ NEW
    ├── decisions.html                 ◻ NEW
    ├── agent_reports.html             ◻ NEW
    ├── changelog.html                 ◻ NEW
    ├── diagrams.html                  ◻ NEW
    └── docs.html                      ◻ NEW
```

**Total: 31 new templates (+ 4 deferred for Phase 6)**

---

## Build Order for Claude Design

1. **Start with `stub.html`** — trivial, unblocks all URL stubs
2. **Then Priority 1** (templates 1-12) — unblocks Phase 1 implementation
3. **Then Priority 2** (templates 14-23) — scene view tab partials
4. **Then Priority 3** (templates 24-31) — full page templates
5. **Then Priority 4** (templates 32-41) — progress app pages
6. **Skip deferred** — Phase 6 templates built later

Within each priority, build in the order listed. The coding agent will copy each template as you deliver it.
