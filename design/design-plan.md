# ڕوانگە (Rwanga) — Design Plan
## AI-Powered Preproduction Platform for Kurdish Cinema

**Version:** 0.1 Draft  
**Date:** April 2026  
**Author:** Darya Ibrahim  
**For:** Kurdish Film Directors & Production Teams

---

## 1. Vision

**ڕوانگە** ("Rwanga" — Kurdish for "Vision/Perspective") is a web-based preproduction management platform built specifically for Kurdish-language film and TV production. It follows the StudioBinder model — script-centric, scene-driven, collaborative — but adds an AI layer that understands Kurdish text and automates the most time-consuming parts of prep.

**The core idea:** A director uploads a Kurdish screenplay. The system breaks it down, generates shot lists, creates storyboards, builds floor plans, and produces a shooting schedule — all before the first production meeting. The director refines, the team collaborates, and everyone walks onto set with the same visual language.

**What makes it different from StudioBinder:**

- Kurdish-first (Sorani RTL), with full English and Arabic support
- AI auto-breakdown from script upload (StudioBinder requires manual tagging)
- AI storyboard generation (StudioBinder requires uploading your own images)
- AI floor plan generation from scene descriptions
- Smart scheduling that optimizes for Kurdish production realities (smaller crews, limited equipment, weather windows)
- Offline-capable PWA for on-set use in areas with poor connectivity
- Touch-optimized for smartboard/TV use in production meetings

---

## 2. User Model

### 2.1 Tenant / Studio

The top-level entity. A production company, a film school, or an independent director.

| Field | Description |
|-------|-------------|
| Studio Name | e.g., "Sarwar Muhedin Films" |
| Logo | Uploaded, shown on call sheets and exports |
| Primary Language | Kurdish Sorani (default), Central Kurmanji, English, Arabic |
| Timezone | Asia/Baghdad (default) |
| Billing Plan | Free / Indie / Studio / Enterprise |

### 2.2 Users & Roles

Each studio has team members with role-based access:

| Role | Permissions |
|------|-------------|
| **Owner** | Full control. Billing. Delete studio. |
| **Director** | Create/edit projects. All scene modules. Final approvals. |
| **DP / Cinematographer** | Shot lists, storyboards, floor plans, lighting. |
| **AD (Assistant Director)** | Scheduling, call sheets, continuity, contacts. |
| **Art Department** | Props, wardrobe, set design, floor plans. |
| **Sound** | Sound design notes per scene. |
| **Editor** | Read-only + can add continuity notes. |
| **Viewer** | Read-only access via share link. No account needed. |

### 2.3 Authentication

- Email/password + magic link (primary, for regions where Google/Apple sign-in is uncommon)
- Google OAuth (optional)
- Share links with optional PIN for view-only access (for showing directors on set)

---

## 3. Project Structure

### 3.1 Creating a Project

Step-by-step flow:

**Step 1 — Name & Basics**
- Project title (Kurdish + transliteration)
- Type: Feature Film / Short Film / TV Episode / Music Video / Commercial
- Director name
- Logline (optional)
- Cover image (optional, AI can generate one from logline)

**Step 2 — Script Upload**
- Upload: `.fdx` (Final Draft), `.fountain`, `.pdf`, or `.docx`
- Or: Write directly in built-in Kurdish script editor
- AI parses the script, detects scenes, characters, locations
- Director confirms the scene breakdown

**Step 3 — Module Selection**
Choose which modules to activate (can change later):

- ✅ Script & Breakdown (always on)
- ☐ Shot Lists
- ☐ Storyboards
- ☐ Floor Plans & Blocking
- ☐ Shooting Schedule
- ☐ Call Sheets
- ☐ Lighting Design
- ☐ Sound Design
- ☐ Props & Set Dressing
- ☐ Wardrobe & Makeup
- ☐ Continuity
- ☐ Budget
- ☐ Locations
- ☐ Cast & Crew Contacts

**Step 4 — Team Invites** (optional, can do later)
- Invite by email or generate share link
- Assign roles

### 3.2 Project Dashboard

After creation, the director lands on the project dashboard. This is the home base.

```
┌─────────────────────────────────────────────────────┐
│  ← All Projects     Mysterious Guest (میوانێکی نادیار)  │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ 32 Scenes│  │ 187 Shots│  │ 12 Locs  │            │
│  │ ████████ │  │ ██████░░ │  │ ████░░░░ │            │
│  │ 100%     │  │ 78%      │  │ 50%      │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                       │
│  QUICK ACCESS                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │📜   │ │🎯   │ │🖼   │ │🗺   │ │📅   │ │📄   │   │
│  │Script│ │Shots│ │Story│ │Floor│ │Sched│ │Call  │   │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │
│                                                       │
│  RECENT ACTIVITY                                      │
│  • Sarwar updated Shot List for Scene 12 — 2h ago     │
│  • AI generated storyboard for Scene 5 — 3h ago       │
│  • Hana added wardrobe notes for Gesha — yesterday    │
│                                                       │
│  SHOOTING CALENDAR                                    │
│  [Month view with color-coded shoot days]              │
└─────────────────────────────────────────────────────┘
```

---

## 4. Scene-Level Modules

This is where ڕوانگە lives. Everything is organized by scene. When a director clicks into a scene, they get a tabbed interface with all the modules relevant to that scene.

### 4.1 Scene View Layout

```
┌────────────────────────────────────────────────────────────┐
│  Scene 12 — INT. Garden House — Evening                     │
│                                                              │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐    │
│  │Overview│Breakdwn│Shots   │Storybd │FloorPln│Schedule│    │
│  ├────────┴────────┴────────┴────────┴────────┴────────┤    │
│  │                                                      │    │
│  │         [Active module content here]                  │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────┬────────┬────────┬────────┬────────┐             │
│  │Lighting│Sound   │Props   │Wardrobe│Continu.│             │
│  └────────┴────────┴────────┴────────┴────────┘             │
└────────────────────────────────────────────────────────────┘
```

This is exactly what we built for Scene 12 of "Mysterious Guest" — but as a dynamic, database-driven application instead of a static HTML file.

### 4.2 Module Details

#### A. Script Breakdown
- Script text displayed with highlighted elements (color-coded by category)
- Click any word/phrase to tag it: Character, Prop, Wardrobe, Vehicle, SFX, VFX, Makeup, Animal, etc.
- AI auto-tags on first import (director reviews and corrects)
- Elements Manager: searchable inventory of all tagged items across all scenes
- Each element has a profile: name, category, scenes it appears in, notes, images

#### B. Shot List
- Table view: Shot #, Setup, Style, Lens, Characters, Duration, Type, Notes
- Each shot linked to a script line
- Drag-to-reorder
- Filter by type (dialogue/visual/insert), by setup, by character
- AI suggestion: "Based on this dialogue, consider a two-shot at 40mm with the table between them"
- Export to PDF with Kurdish formatting

#### C. Storyboard
- Grid of frames, one per shot
- Upload images, sketch in-app, or generate with AI
- AI generation: takes the shot description + scene context → generates a cinematic storyboard frame
- Annotate with arrows, camera movement indicators, text
- Lightbox view for presentation mode
- Print-ready export (4-up, 6-up, 9-up per page)

#### D. Floor Plan & Blocking
- Interactive SVG canvas (like what we just built for Scene 12)
- Drag furniture, cameras, lights onto the floor plan
- Draw character movement paths
- Click camera positions to see linked shots
- AI generation: describe the room → get a floor plan
- Multiple setups per scene, each saveable
- Export as SVG or PDF

#### E. Shooting Schedule
- Stripboard view: scenes as colored strips, drag to reorder
- Auto-sort by location, time of day, cast availability
- Day breaks with running time calculation
- Block view: time slots with setup/teardown estimates
- Calendar integration
- AI optimization: "Moving Scene 14 after Scene 12 saves one lighting change"

#### F. Call Sheet
- Auto-populated from schedule, cast, crew, and location data
- Weather pulled automatically
- Map link to location
- Per-person call times
- Send via email or WhatsApp (crucial for Kurdish crews)
- PDF export with studio branding

#### G. Lighting Design
- Color temperature map (visual bar like we built)
- Per-shot lighting notes
- Practical vs. film lighting inventory
- Gel/filter requirements
- Reference images

#### H. Sound Design
- Room tone requirements per location
- Per-shot sound notes (dialogue, SFX, ambience)
- Equipment list
- Foley notes
- Music cue list

#### I. Props Checklist
- Categorized list with checkboxes
- Status: Needed / Sourced / On Set / Struck
- Per-prop images and notes
- Which scenes each prop appears in (auto from breakdown)
- Print checklist for art department

#### J. Wardrobe & Makeup
- Per-character outfit cards
- Outfit changes tracked across scenes
- Reference images
- Makeup notes
- Continuity alerts: "Gesha's sunglasses should be on her head in Scene 12"

#### K. Continuity
- Scene flow diagram (visual)
- In/out checklists per scene
- Prop positions, wardrobe state, lighting state
- Cross-scene warnings: "This prop was on the left in Scene 11"
- Photo upload for continuity reference

#### L. Budget (per scene)
- Equipment rental
- Crew costs
- Location fees
- Props/wardrobe purchases
- Rollup to project total

---

## 5. AI Features — The Differentiator

This is what separates ڕوانگە from StudioBinder. Every AI feature follows the same pattern: **generate → review → refine**.

### 5.1 Auto Script Breakdown
- **Input:** Kurdish screenplay (any format)
- **Process:** Kurdish NLP model identifies characters, locations, props, wardrobe, time of day, int/ext, SFX, VFX
- **Output:** Tagged script with element inventory
- **Director action:** Review tags, correct mistakes, approve
- **Tech:** Claude API with Kurdish-tuned prompts, fine-tuned NER model for Kurdish screenplay format

### 5.2 AI Storyboard Generation
- **Input:** Shot description + scene context + style reference (optional)
- **Process:** Text-to-image model generates cinematic frame
- **Output:** Storyboard panel matching the shot description
- **Director action:** Accept, regenerate with feedback, or upload own image
- **Tech:** Flux/SDXL with LoRA trained on cinematic compositions, integrated via API

### 5.3 AI Floor Plan Generation
- **Input:** Scene description ("A garden house with a dining table in the center, sofa on the west wall, kitchen shelves on the east...")
- **Process:** Layout generation model creates a top-down SVG
- **Output:** Editable floor plan with furniture placed
- **Director action:** Drag to adjust, add camera positions, draw blocking
- **Tech:** Claude API for layout reasoning → SVG generation pipeline

### 5.4 Smart Scheduling
- **Input:** All scenes with their requirements (cast, location, equipment, estimated duration)
- **Process:** Optimization algorithm considering location moves, lighting changes, actor availability, equipment swaps
- **Output:** Suggested shooting order with explanation
- **Director action:** Accept, modify, or manually schedule
- **Tech:** Constraint solver + Claude for natural-language explanations

### 5.5 Kurdish NLP
- Script analysis: theme detection, character arc mapping, dialogue style analysis
- Auto-translation: Kurdish ↔ English ↔ Arabic (for international co-productions)
- Dialogue analysis: pacing, word count, estimated screen time
- **Tech:** Claude API with Kurdish Sorani specialization

### 5.6 AI Scene Viewer Generator
- **Input:** Completed scene data (all modules)
- **Output:** The kind of interactive HTML viewer we built for Scene 12 — self-contained, shareable, works offline
- **Use case:** Director generates a viewer for each scene, sends it to the team before a production meeting
- **Tech:** Template engine + data injection → single HTML file

---

## 6. Navigation & Information Architecture

### 6.1 Global Navigation (Sidebar)

```
┌──────────────────┐
│  ڕوانگە          │
│                  │
│  🏠 Dashboard    │
│  📁 Projects     │
│  👥 Team         │
│  📍 Locations    │
│  👤 Contacts     │
│  ⚙️ Settings     │
│                  │
│  ─── Project ─── │
│  📜 Script       │
│  📝 Breakdown    │
│  🎯 Shot Lists   │
│  🖼 Storyboards  │
│  🗺 Floor Plans  │
│  📅 Schedule     │
│  📄 Call Sheets  │
│  💡 Lighting     │
│  🔊 Sound        │
│  🎭 Props        │
│  👗 Wardrobe     │
│  🔄 Continuity   │
│  💰 Budget       │
│                  │
│  ─── Scenes ──── │
│  1. EXT. Village │
│  2. INT. Car     │
│  3. EXT. Road    │
│  ...             │
│  12. INT. Garden │  ← active
│  ...             │
└──────────────────┘
```

### 6.2 Page Hierarchy

```
Home (Studio Dashboard)
├── Projects List
│   ├── Project Dashboard
│   │   ├── Script (full screenplay view)
│   │   ├── Breakdown (all scenes, element manager)
│   │   ├── Shot Lists (all scenes, filterable)
│   │   ├── Storyboards (all scenes, grid view)
│   │   ├── Floor Plans (by location)
│   │   ├── Schedule (stripboard, calendar)
│   │   ├── Call Sheets (by shoot day)
│   │   ├── Locations (list with maps)
│   │   ├── Cast & Crew (contact directory)
│   │   └── Budget (project-level summary)
│   │
│   └── Scene View (per scene)
│       ├── Overview (hero + stats)
│       ├── Breakdown (tagged script for this scene)
│       ├── Shot List (shots for this scene)
│       ├── Storyboard (frames for this scene)
│       ├── Floor Plan (blocking for this scene)
│       ├── Schedule (time blocks for this scene)
│       ├── Lighting (notes for this scene)
│       ├── Sound (notes for this scene)
│       ├── Props (checklist for this scene)
│       ├── Wardrobe (per character for this scene)
│       └── Continuity (in/out checklists)
│
├── Team Management
├── Studio Settings
└── Billing
```

---

## 7. Technical Architecture

### 7.1 Stack Overview

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | **Django 5.x** | Batteries-included. ORM, auth, admin, forms, i18n — all built in. |
| Frontend interactions | **HTMX 2.x** | Server-rendered partials, no JS framework needed. `hx-get`, `hx-post`, `hx-swap` for 90% of UI. |
| CSS framework | **Bootstrap 5** | RTL support out of the box via `bootstrap.rtl.min.css`. Familiar grid, components, utilities. |
| Database | **PostgreSQL 16** | Django's best-supported DB. JSONField for flexible data (annotations, SVG metadata). |
| Real-time | **Django Channels + WebSocket** | Multi-user editing, live notifications. HTMX SSE extension for simple cases. |
| Task queue | **Celery + Redis** | AI jobs (storyboard generation, script breakdown) run async. Redis also handles caching. |
| Storage | **Django Storages + S3** | Storyboard images, script uploads, exports. Cloudflare R2 or AWS S3. |
| AI | **Claude API (Anthropic SDK)** | Script analysis, breakdown, Kurdish NLP, scheduling. Direct Python SDK. |
| Image AI | **Replicate API** (Flux/SDXL) | Storyboard generation. Called from Celery tasks. |
| Deployment | **Docker + Gunicorn + Nginx** | Standard Django production stack. |

### 7.2 Why Django + HTMX, Not React

StudioBinder itself is a server-rendered application with targeted JS interactions — not an SPA. The ڕوانگە UI pattern is the same: mostly reading/browsing data, with focused editing interactions. HTMX gives us those interactions (inline editing, filtering, drag-and-drop with Sortable.js, modal forms) without a JS build pipeline, a state management library, or the React rendering overhead.

The few places that need richer client-side behavior:
- **Floor plan SVG editor** — vanilla JS + SVG DOM manipulation (exactly like what we built for Scene 12)
- **Storyboard drag-and-drop** — Sortable.js (BS5-compatible, works with HTMX)
- **Stripboard drag-and-drop** — same Sortable.js approach
- **Script text selection for tagging** — vanilla JS Selection API + HTMX to save tags

Everything else is `hx-get` partials and BS5 components.

### 7.3 Django Project Structure

```
rwanga/
├── manage.py
├── rwanga/                    # Project config
│   ├── settings/
│   │   ├── base.py
│   │   ├── dev.py
│   │   └── prod.py
│   ├── urls.py
│   ├── celery.py
│   └── asgi.py               # For Channels WebSocket
│
├── apps/
│   ├── accounts/              # Tenant, User, Role, Auth
│   │   ├── models.py          # Studio, User, Membership
│   │   ├── views.py           # Login, register, team management
│   │   ├── forms.py
│   │   └── templates/accounts/
│   │
│   ├── projects/              # Project CRUD, dashboard
│   │   ├── models.py          # Project, Scene, Character, Location
│   │   ├── views.py           # Project list, dashboard, scene list
│   │   └── templates/projects/
│   │
│   ├── scripts/               # Script upload, parsing, breakdown
│   │   ├── models.py          # Script, ScriptElement, Breakdown
│   │   ├── parsers.py         # .fdx, .fountain, .docx, .pdf parsers
│   │   ├── views.py
│   │   └── tasks.py           # Celery: AI auto-breakdown
│   │
│   ├── shots/                 # Shot lists + storyboards
│   │   ├── models.py          # Shot, StoryboardFrame, Setup
│   │   ├── views.py           # Shot table, storyboard grid
│   │   └── templates/shots/
│   │       ├── shot_list.html
│   │       ├── shot_row.html          # HTMX partial for inline edit
│   │       ├── storyboard_grid.html
│   │       └── storyboard_card.html   # HTMX partial
│   │
│   ├── floorplans/            # Interactive SVG floor plans
│   │   ├── models.py          # FloorPlan, CameraPosition, FurnitureItem
│   │   ├── views.py
│   │   └── static/floorplans/
│   │       └── editor.js      # Vanilla JS SVG editor
│   │
│   ├── scheduling/            # Schedule, call sheets, calendar
│   │   ├── models.py          # ShootDay, ScheduleBlock, CallSheet
│   │   ├── views.py           # Stripboard, calendar, call sheet
│   │   └── tasks.py           # Celery: AI schedule optimization
│   │
│   ├── departments/           # Lighting, sound, props, wardrobe, continuity
│   │   ├── models.py          # LightingNote, SoundNote, Prop, WardrobeItem, ContinuityItem
│   │   ├── views.py           # Per-department views, checklists
│   │   └── templates/departments/
│   │
│   ├── ai_engine/             # AI integration layer
│   │   ├── client.py          # Anthropic SDK wrapper
│   │   ├── prompts.py         # Kurdish-tuned system prompts
│   │   ├── tasks.py           # Celery tasks for AI jobs
│   │   └── views.py           # HTMX endpoints for AI actions
│   │
│   └── exports/               # PDF, HTML viewer, print
│       ├── views.py
│       ├── generators.py      # Scene viewer HTML generator
│       └── templates/exports/
│
├── templates/
│   ├── base.html              # BS5 layout, sidebar, HTMX include
│   ├── components/            # Reusable BS5 partials
│   │   ├── _sidebar.html
│   │   ├── _navbar.html
│   │   ├── _modal.html
│   │   ├── _toast.html
│   │   └── _empty_state.html
│   └── scenes/
│       └── scene_view.html    # Tabbed scene view (like our Scene 12 viewer)
│
├── static/
│   ├── css/
│   │   ├── bootstrap.rtl.min.css
│   │   ├── rwanga.css         # Custom overrides, dark theme
│   │   └── floorplan.css
│   ├── js/
│   │   ├── htmx.min.js
│   │   ├── sortable.min.js    # Drag-and-drop for storyboard/stripboard
│   │   ├── floorplan-editor.js
│   │   └── rwanga.js          # Minimal custom JS
│   └── img/
│
└── locale/
    ├── ckb/                   # Kurdish Sorani translations
    ├── ku/                    # Kurmanji
    ├── ar/                    # Arabic
    └── en/                    # English
```

### 7.4 HTMX Patterns

The bulk of the UI interactions use these three HTMX patterns:

**Pattern 1 — Inline Edit (shot list, props checklist, etc.)**
```html
<!-- Shot row in table — click to edit -->
<tr hx-get="/projects/{{project.id}}/shots/{{shot.id}}/edit/"
    hx-swap="outerHTML"
    hx-trigger="click"
    class="cursor-pointer">
  <td>{{ shot.number }}</td>
  <td>{{ shot.style }}</td>
  <td>{{ shot.lens }}</td>
</tr>

<!-- Edit form replaces the row -->
<tr>
  <td colspan="6">
    <form hx-post="/projects/{{project.id}}/shots/{{shot.id}}/"
          hx-swap="outerHTML"
          hx-target="closest tr">
      {% csrf_token %}
      {{ form.as_div }}
      <button type="submit" class="btn btn-sm btn-primary">Save</button>
      <button hx-get="/projects/{{project.id}}/shots/{{shot.id}}/"
              hx-swap="outerHTML" hx-target="closest tr"
              class="btn btn-sm btn-outline-secondary">Cancel</button>
    </form>
  </td>
</tr>
```

**Pattern 2 — Filter/Search (shot list by type, storyboard by setup)**
```html
<!-- Filter buttons swap the table body -->
<div class="btn-group" role="group">
  <button hx-get="/projects/{{project.id}}/scenes/{{scene.id}}/shots/?type=all"
          hx-target="#shot-tbody" hx-swap="innerHTML"
          class="btn btn-outline-secondary active">هەموو</button>
  <button hx-get="/projects/{{project.id}}/scenes/{{scene.id}}/shots/?type=dialogue"
          hx-target="#shot-tbody" hx-swap="innerHTML"
          class="btn btn-outline-secondary">دیالۆگ</button>
  <button hx-get="/projects/{{project.id}}/scenes/{{scene.id}}/shots/?type=visual"
          hx-target="#shot-tbody" hx-swap="innerHTML"
          class="btn btn-outline-secondary">بینراو</button>
</div>
```

**Pattern 3 — AI Action (generate storyboard, auto-breakdown)**
```html
<!-- AI generate button with loading indicator -->
<button hx-post="/ai/storyboard/generate/"
        hx-vals='{"shot_id": "{{shot.id}}"}'
        hx-target="#storyboard-frame-{{shot.id}}"
        hx-swap="outerHTML"
        hx-indicator="#ai-spinner-{{shot.id}}"
        class="btn btn-sm btn-outline-warning">
  🤖 دروستکردنی وێنە
</button>
<div id="ai-spinner-{{shot.id}}" class="htmx-indicator">
  <div class="spinner-border spinner-border-sm text-warning"></div>
  AI کاردەکات...
</div>
```

### 7.5 Django Models (Core)

```python
# apps/accounts/models.py
class Studio(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to='studios/logos/', blank=True)
    language = models.CharField(max_length=10, default='ckb')  # Kurdish Sorani
    timezone = models.CharField(max_length=50, default='Asia/Baghdad')
    plan = models.CharField(max_length=20, default='free')
    created_at = models.DateTimeField(auto_now_add=True)

class Membership(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    studio = models.ForeignKey(Studio, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

# apps/projects/models.py
class Project(models.Model):
    studio = models.ForeignKey(Studio, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=300)
    title_latin = models.CharField(max_length=300, blank=True)  # transliteration
    project_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    logline = models.TextField(blank=True)
    cover = models.ImageField(upload_to='projects/covers/', blank=True)
    status = models.CharField(max_length=20, default='development')
    created_at = models.DateTimeField(auto_now_add=True)

class Scene(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='scenes')
    number = models.PositiveIntegerField()
    int_ext = models.CharField(max_length=3, choices=[('INT', 'INT'), ('EXT', 'EXT')])
    location_name = models.CharField(max_length=200)
    time_of_day = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    script_text = models.TextField(blank=True)
    page_count = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    class Meta:
        ordering = ['number']
        unique_together = ['project', 'number']

class Character(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='characters')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    scenes = models.ManyToManyField(Scene, related_name='characters', blank=True)

# apps/shots/models.py
class Setup(models.Model):
    scene = models.ForeignKey(Scene, on_delete=models.CASCADE, related_name='setups')
    letter = models.CharField(max_length=2)  # A, B, C...
    description = models.TextField(blank=True)
    class Meta:
        ordering = ['letter']
        unique_together = ['scene', 'letter']

class Shot(models.Model):
    scene = models.ForeignKey(Scene, on_delete=models.CASCADE, related_name='shots')
    setup = models.ForeignKey(Setup, on_delete=models.SET_NULL, null=True, related_name='shots')
    number = models.CharField(max_length=10)  # "12.1", "12.2"
    style = models.CharField(max_length=100)  # "لێدانی ناوەندی"
    lens = models.CharField(max_length=20, blank=True)
    movement = models.TextField(blank=True)
    duration = models.CharField(max_length=10, blank=True)
    shot_type = models.CharField(max_length=20, choices=SHOT_TYPE_CHOICES)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    has_dialogue = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    class Meta:
        ordering = ['order']

class StoryboardFrame(models.Model):
    shot = models.OneToOneField(Shot, on_delete=models.CASCADE, related_name='storyboard')
    image = models.ImageField(upload_to='storyboards/')
    annotations = models.JSONField(default=dict, blank=True)
    ai_generated = models.BooleanField(default=False)
    ai_prompt = models.TextField(blank=True)

# apps/floorplans/models.py
class FloorPlan(models.Model):
    scene = models.ForeignKey(Scene, on_delete=models.CASCADE, related_name='floor_plans')
    name = models.CharField(max_length=100, default='Primary')
    svg_data = models.TextField(blank=True)  # Raw SVG markup
    room_width = models.FloatField(default=8.0)  # meters
    room_height = models.FloatField(default=4.0)
    furniture = models.JSONField(default=list)  # [{type, x, y, w, h, label}]
    camera_positions = models.JSONField(default=list)  # [{letter, x, y, target_x, target_y}]
    movement_paths = models.JSONField(default=list)
    ai_generated = models.BooleanField(default=False)

# apps/departments/models.py
class Prop(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='props')
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50)
    status = models.CharField(max_length=20, default='needed')
    notes = models.TextField(blank=True)
    image = models.ImageField(upload_to='props/', blank=True)
    scenes = models.ManyToManyField(Scene, related_name='props', blank=True)

class WardrobeItem(models.Model):
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='wardrobe')
    scene = models.ForeignKey(Scene, on_delete=models.CASCADE, related_name='wardrobe_items')
    outfit_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    image = models.ImageField(upload_to='wardrobe/', blank=True)

class LightingNote(models.Model):
    shot = models.ForeignKey(Shot, on_delete=models.CASCADE, related_name='lighting_notes')
    note = models.TextField()
    color_temp = models.CharField(max_length=20, blank=True)
    equipment = models.CharField(max_length=200, blank=True)

class SoundNote(models.Model):
    shot = models.ForeignKey(Shot, on_delete=models.CASCADE, related_name='sound_notes')
    note = models.TextField()
    sound_type = models.CharField(max_length=20, choices=SOUND_TYPE_CHOICES)

class ContinuityItem(models.Model):
    scene = models.ForeignKey(Scene, on_delete=models.CASCADE, related_name='continuity')
    direction = models.CharField(max_length=3, choices=[('in', 'In'), ('out', 'Out')])
    description = models.TextField()
    checked = models.BooleanField(default=False)

# apps/scheduling/models.py
class ShootDay(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='shoot_days')
    date = models.DateField()
    day_number = models.PositiveIntegerField()
    notes = models.TextField(blank=True)

class ScheduleBlock(models.Model):
    shoot_day = models.ForeignKey(ShootDay, on_delete=models.CASCADE, related_name='blocks')
    scene = models.ForeignKey(Scene, on_delete=models.CASCADE, null=True)
    order = models.PositiveIntegerField()
    time_start = models.TimeField(null=True)
    duration = models.DurationField(null=True)
    block_type = models.CharField(max_length=20)  # shoot, setup, break
    title = models.CharField(max_length=200)
    shots = models.ManyToManyField(Shot, blank=True)
    notes = models.TextField(blank=True)
    class Meta:
        ordering = ['order']

class CallSheet(models.Model):
    shoot_day = models.OneToOneField(ShootDay, on_delete=models.CASCADE, related_name='call_sheet')
    general_call = models.TimeField()
    location = models.ForeignKey('projects.Location', on_delete=models.SET_NULL, null=True)
    weather_data = models.JSONField(default=dict)
    sent_at = models.DateTimeField(null=True)
    pdf = models.FileField(upload_to='call_sheets/', blank=True)
```

---

## 8. Development Phases

### Revised Phasing (informed by design review)

> **Principle:** Ship something a real director can use on set, then expand. The Scene 12 viewer we already built proves the concept — the platform wraps tooling around that output.

### Phase 0 — Validate the Foundation (2 weeks)
**Goal:** Prove the base template works before building on it.
- BS5 RTL base template with dark cinema theme
- Kurdish typography stress test: mixed Kurdish + English technical terms ("85mm", "POV", "Dolly") in the same layout
- Sortable.js RTL drag handle behavior — confirm or patch
- Scene View tabbed interface prototype with real Scene 12 data
- TV-first validation: test at 1920×1080 on a smartboard/TV
- **Design specs enforced:** 44px min touch targets, 16px min body text, 24px min headings, 48px min button height for on-set use

### Phase 1 — MVP: The Three Load-Bearing Modules (8 weeks)
**Goal:** A director can enter shots, place cameras, and export a scene package.

What ships:
- Django scaffold + auth (`django-allauth`, email + magic link)
- Project + Scene CRUD
- **Shot List** — table with HTMX inline editing, filtering by type/setup
- **Floor Plan Editor** — vanilla JS SVG editor, drag cameras/furniture, draw blocking paths, click camera → see linked shots
- **Scene Viewer Export** — one-click export to self-contained HTML (like our Scene 12 viewer), works offline, shareable via WhatsApp/USB
- Scene View: tabbed interface showing Shot List + Floor Plan + Overview
- Team invites with role-based access

What doesn't ship yet: storyboards, scheduling, breakdown, lighting, sound, props, wardrobe, continuity, budget, call sheets. These live in spreadsheets until Phase 2.

### Phase 2 — Complete the Scene View (8 weeks)
**Goal:** Every department has its tab in the scene view.

- **Storyboard** — upload images, grid layout, Sortable.js reorder (no AI generation yet)
- **Lighting** — per-shot notes, color temperature map, equipment list
- **Sound** — per-shot notes, room tone, SFX list
- **Props** — checklist with status tracking, HTMX checkbox toggle
- **Wardrobe & Makeup** — per-character outfit cards, outfit changes across scenes
- **Continuity** — in/out checklists, scene flow diagram
- Scene Viewer Export updated to include all new modules

### Phase 3 — Production Workflow (6 weeks)
**Goal:** The platform manages a shoot day, not just a scene.

- **Shooting Schedule** — stripboard with Sortable.js, day breaks, time estimates
- **Call Sheets** — auto-populated from schedule + cast + location, PDF via WeasyPrint, WhatsApp delivery via Twilio
- **Contacts** — cast & crew directory, per-project roles
- **Locations** — list with Leaflet.js maps, photos
- Project Dashboard with progress tracking

### Phase 4 — AI Layer (6 weeks)
**Goal:** AI eliminates grunt work. Every AI feature follows generate → review → refine.

- `ai_engine` app with Anthropic Python SDK
- Celery tasks for async AI jobs, HTMX loading indicators
- **AI Script Breakdown** — upload Kurdish screenplay, Claude parses scenes/characters/props/locations, director reviews and corrects tags
- **AI Floor Plan Generation** — describe the room in Kurdish, get an SVG floor plan
- **Smart Scheduling** — AI suggests shooting order based on location/cast/equipment constraints
- ~~AI Storyboard Generation~~ — **deferred indefinitely.** Generic image models produce Western-looking frames that misrepresent Kurdish visual language. Revisit only when fine-tuning on Kurdish cinema reference material is feasible. Upload-your-own-image storyboards work fine.

### Phase 5 — Scale & Polish (ongoing)
- PWA with service worker for offline project access (`django-pwa`)
- Multi-language: `django.utils.translation` for Kurmanji, Arabic, English
- Django Channels WebSocket for real-time collaboration
- Budget module
- Calendar integration
- Mobile-responsive refinements for on-set phone/tablet use
- Performance optimization for large projects (50+ scenes)

### What We Explicitly Don't Build
- **AI storyboard generation** — until Kurdish visual fine-tuning is possible
- **Script editor** — directors use Final Draft / Highland / Word. We import, not replace.
- **Video editing integration** — out of scope. This is preproduction.
- **Mobile native app** — BS5 responsive + PWA is sufficient. Native is a distraction.

---

## 9. Competitive Positioning

| Feature | StudioBinder | ڕوانگە (Rwanga) |
|---------|-------------|-----------------|
| Script breakdown | Manual tagging | AI auto-tag + manual refinement |
| Storyboards | Upload only | AI generation + upload |
| Floor plans | None | Interactive SVG editor + AI generation |
| Lighting design | None | Per-shot notes + color temp map |
| Sound design | None | Per-shot notes + equipment list |
| Kurdish language | No | Native RTL, Kurdish NLP |
| Offline use | No | PWA with service worker |
| Smartboard/TV use | No | Touch-optimized, presentation mode |
| Scene viewer export | No | Self-contained HTML viewer per scene |
| Scheduling AI | Basic sort | Constraint optimization with explanations |
| Call sheets via WhatsApp | No | Yes (crucial for Kurdish crews) |
| Free tier | Yes (limited) | Yes (1 project, 10 scenes) |

---

## 10. Design Principles

1. **Kurdish-first, not Kurdish-adapted.** The UI is designed for RTL from the start, not retrofitted. Typography, spacing, icons — all consider Kurdish Sorani reading patterns.

2. **Script is the source of truth.** Everything flows from the screenplay. Change a character name in the script, it updates across all modules.

3. **AI generates, humans decide.** Every AI feature produces a draft. The director always has the final say. No black boxes.

4. **Works on a TV in a production office.** Large touch targets, high contrast, readable from 3 meters. Directors pin scenes to a smartboard and walk the crew through them.

5. **Works without internet.** Kurdish productions often shoot in rural areas. The PWA caches the active project for offline access.

6. **One scene, one view.** A director should be able to see everything about a scene in one place — not hunt across 8 different screens.

7. **Export everything.** Every module exports to PDF with Kurdish formatting. The scene viewer exports to a self-contained HTML file. Nothing is locked inside the platform.

### 10.1 TV-First Design Specifications

The primary use case is a director standing in front of a 55" TV or smartboard in a production office, walking the crew through a scene. Design for that first, degrade to laptop/tablet/phone second.

| Element | Minimum Size | Rationale |
|---------|-------------|-----------|
| Body text | 16px | Readable from 2m on 1080p TV |
| Section headings | 24px | Scannable from 3m |
| Navigation labels | 14px, 600 weight | Sidebar readable at angle |
| Touch targets (buttons, tabs, chips) | 48px height × 44px width | Thumb-friendly, stylus-safe |
| Table row height | 48px | Tap-safe on touchscreen |
| Icon size | 20px minimum | Distinguishable at distance |
| Spacing between interactive elements | 8px minimum gap | Prevents mis-taps |
| Card padding | 16px | Content doesn't feel cramped on large display |
| Sidebar width | 240px collapsed / 280px expanded | Enough for Kurdish text without truncation |

**Color contrast (dark theme):**
- Primary text on background: minimum 7:1 ratio (WCAG AAA)
- Secondary text: minimum 4.5:1 ratio (WCAG AA)
- Interactive element borders: visible at 3m distance
- Active/selected state: amber (#D4A574) — distinct from all status colors

**Mixed-direction text handling:**
Kurdish scene headings with English technical terms ("85mm", "POV", "Steadicam", "f/2.8") appear constantly. Rules:
- English technical terms stay LTR within RTL flow — use `<bdi>` or `dir="ltr"` spans
- Lens specs, f-stops, and camera model names are never translated
- Numbers follow Kurdish convention (٢٧٠٠K) in Kurdish context, Western (2700K) in technical specs
- Shot numbers always use Western digits with dots: "12.1", "12.2" (industry standard)

---

## 11. Naming

**ڕوانگە** (Rwanga) means "vision" or "perspective" in Kurdish Sorani. It captures both the cinematic meaning (the director's vision) and the practical meaning (seeing the full picture of a production).

Tagline: **"لە دەستنووسەوە بۆ شاشە"** — "From script to screen."

---

---

## 12. What to Build Next

Based on design review, the immediate next steps (in order):

1. **Phase 0: BS5 RTL base template prototype.** A single `base.html` with the sidebar, navbar, dark cinema theme, Kurdish typography, and a Scene View tabbed layout using real Scene 12 data. Test it on a TV. This validates the foundation before we write any Django models.

2. **Phase 0: Scene View prototype.** The tabbed scene interface (Overview, Shot List, Floor Plan) as static BS5 + HTMX markup, using the Scene 12 data we already have. Not connected to a database yet — just proving the layout, typography, and interaction patterns work in RTL with mixed Kurdish/English content.

3. **Phase 1: Django scaffold.** Once the template is validated, wire it to models, views, and HTMX partials. Shot List first (CRUD is the simplest to prove), then Floor Plan editor, then Scene Viewer export.

---

*This document is a living design plan. It will evolve as we build, test with real Kurdish directors, and learn what works on set.*
