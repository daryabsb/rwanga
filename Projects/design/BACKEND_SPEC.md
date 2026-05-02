# ڕوانگە — Backend Specification
**For the backend engineering agent**
Design Lead: Claude | Stack: Django 5 + HTMX + BS5 RTL + PostgreSQL + Celery + Channels

---

## 1. URL Structure

```
/                                    → redirect to /projects/
/accounts/login/                     → accounts:login
/accounts/register/                  → accounts:register
/accounts/magic-link/                → accounts:magic_link
/accounts/logout/                    → accounts:logout
/accounts/profile/                   → accounts:profile
/accounts/settings/                  → accounts:settings
/accounts/team/                      → accounts:team
/accounts/contacts/<project_id>/     → accounts:contacts

/projects/                           → projects:list
/projects/create/                    → projects:create_wizard
/projects/<pk>/                      → projects:dashboard
/projects/<pk>/settings/             → projects:settings
/projects/<pk>/scenes/               → projects:scene_list (JSON/partial)
/projects/<pk>/scenes/<scene_pk>/    → projects:scene (scene_view.html)
/projects/<pk>/scenes/<scene_pk>/<tab>/  → projects:scene_tab (HTMX partial)

/scripts/<project_pk>/               → scripts:index
/scripts/<project_pk>/upload/        → scripts:upload
/scripts/<project_pk>/breakdown/     → scripts:breakdown
/scripts/<project_pk>/elements/      → scripts:elements
/scripts/<project_pk>/docs/          → scripts:docs

/shots/<project_pk>/                 → shots:list
/shots/<project_pk>/storyboards/     → shots:storyboards
/shots/<project_pk>/<shot_pk>/edit/  → shots:edit (HTMX inline partial)

/floorplans/<project_pk>/            → floorplans:list
/floorplans/<project_pk>/<pk>/       → floorplans:editor

/scheduling/<project_pk>/            → scheduling:index (stripboard)
/scheduling/<project_pk>/call-sheets/ → scheduling:call_sheets
/scheduling/<project_pk>/optimize/   → scheduling:optimize (AI, POST)

/departments/<project_pk>/lighting/  → departments:lighting
/departments/<project_pk>/sound/     → departments:sound
/departments/<project_pk>/props/     → departments:props
/departments/<project_pk>/wardrobe/  → departments:wardrobe
/departments/<project_pk>/continuity/ → departments:continuity

/ai/generate-scene/<scene_pk>/       → ai_engine:generate_scene (POST, queues Celery)
/ai/rerun-breakdown/<script_pk>/     → ai_engine:rerun_breakdown (POST)
/ai/job/<job_id>/result/             → ai_engine:job_result (HTMX target)
/ai/job/<job_id>/status/             → ai_engine:job_status (JSON, polled by WS)

/exports/scene-viewer/<scene_pk>/    → exports:scene_viewer (returns standalone HTML)
/exports/call-sheet/<shoot_day_pk>/  → exports:call_sheet (PDF via WeasyPrint)

/ws/ai-jobs/<project_id>/            → Django Channels WebSocket consumer
/ws/notifications/<user_id>/         → Django Channels notification consumer

/locations/                          → locations:list
/notifications/panel/                → notifications:panel (HTMX partial)
```

---

## 2. Django Apps

```
rwanga/apps/
├── accounts/      # Studio, User, Membership, auth
├── projects/      # Project, Scene, Character, Location
├── scripts/       # Script, ScriptElement, Breakdown
├── shots/         # Shot, Setup, StoryboardFrame
├── floorplans/    # FloorPlan (JSON-based, no svg_data field — see note)
├── scheduling/    # ShootDay, ScheduleBlock, CallSheet
├── departments/   # LightingNote, SoundNote, Prop, WardrobeItem, ContinuityItem
├── ai_engine/     # AIJob, Celery tasks, Anthropic SDK wrapper
├── exports/       # Scene viewer HTML generator, PDF
├── locations/     # Location model with Leaflet map data
└── notifications/ # Notification model, Channels consumer
```

---

## 3. Key Template Context Variables

### base.html
| Variable | Source | Required |
|---|---|---|
| `LANGUAGE_CODE` | Django i18n | Yes |
| `LANGUAGE_BIDI` | Django i18n | Yes |
| `active_project` | View context | Optional |
| `active_section` | View context | Optional |
| `unread_count` | Notification queryset | Optional |

### projects/dashboard.html
| Variable | Type | Notes |
|---|---|---|
| `project` | Project | With `shots_count` annotation |
| `active_jobs` | QuerySet[AIJob] | Running jobs only |

### projects/scene_view.html
| Variable | Type | Notes |
|---|---|---|
| `project` | Project | |
| `scene` | Scene | With `setups_count`, `screen_time` annotations |
| `tabs` | list[{id, label}] | Ordered tab definitions |
| `active_tab` | str | Default: 'overview' |
| `active_tab_template` | str | e.g. 'scenes/tabs/overview.html' |
| `scene_list` | QuerySet[Scene] | For panel — ordered by number |
| `prev_scene` | Scene\|None | |
| `next_scene` | Scene\|None | |
| `crumbs` | list[{label, url}] | For breadcrumb |
| `active_jobs` | QuerySet[AIJob] | |

### Scene tab templates (HTMX partials)
Each tab lives at `templates/scenes/tabs/<tab_id>.html`
Rendered server-side on initial load, swapped via HTMX on tab click.

Tab → Template → Primary queryset:
```
overview    → scenes/tabs/overview.html    → scene (annotated)
shots       → scenes/tabs/shots.html       → scene.shots.all()
storyboard  → scenes/tabs/storyboard.html  → scene.shots.select_related('storyboard')
floorplan   → scenes/tabs/floorplan.html   → scene.floor_plans.first()
schedule    → scenes/tabs/schedule.html    → scene.schedule_blocks.all()
lighting    → scenes/tabs/lighting.html    → shot.lighting_notes per shot
sound       → scenes/tabs/sound.html       → scene (sound notes embedded)
props       → scenes/tabs/props.html       → scene.props.all()
wardrobe    → scenes/tabs/wardrobe.html    → scene.wardrobe_items.all()
continuity  → scenes/tabs/continuity.html  → scene.continuity.all()
```

---

## 4. HTMX Patterns

### Pattern 1 — Inline Edit (shot rows)
```html
<tr hx-get="/shots/{{ project.pk }}/{{ shot.pk }}/edit/"
    hx-swap="outerHTML"
    hx-trigger="click"
    class="rw-shot-row">
```

### Pattern 2 — Tab switching (scene view)
```html
<button hx-get="/projects/{{ project.pk }}/scenes/{{ scene.pk }}/shots/"
        hx-target="#rw-tab-content"
        hx-swap="innerHTML"
        hx-push-url="true">
```

### Pattern 3 — AI action with progress
```html
<button hx-post="/ai/generate-scene/{{ scene.pk }}/"
        hx-target="#rw-ai-status"
        hx-swap="innerHTML">
  🤖 AI دروستکردن
</button>
```
View returns `_ai_progress.html` partial. WebSocket streams progress. On complete, HTMX refreshes the target pane.

### Pattern 4 — Props checkbox toggle
```html
<input type="checkbox"
       hx-post="/departments/{{ project.pk }}/props/{{ prop.pk }}/toggle/"
       hx-trigger="change"
       hx-swap="none">
```

### Pattern 5 — Scene list filter
```html
<input type="search"
       hx-get="/projects/{{ project.pk }}/scenes/?q={{ query }}"
       hx-target="#rw-scene-list"
       hx-trigger="input changed delay:300ms">
```

---

## 5. AI Jobs (Celery)

### AIJob model
```python
class AIJob(models.Model):
    JOB_TYPES = [
        ('breakdown', 'Script Breakdown'),
        ('storyboard', 'Storyboard Generation'),
        ('floorplan', 'Floor Plan Generation'),
        ('schedule', 'Schedule Optimization'),
    ]
    STATUS = [('queued','Queued'),('running','Running'),('done','Done'),('error','Error')]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4)
    project    = models.ForeignKey(Project, on_delete=models.CASCADE)
    type       = models.CharField(max_length=20, choices=JOB_TYPES)
    status     = models.CharField(max_length=10, choices=STATUS, default='queued')
    progress   = models.IntegerField(default=0)   # 0–100
    step       = models.CharField(max_length=200, blank=True)
    result     = models.JSONField(null=True, blank=True)
    error      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### Celery task pattern
```python
@shared_task(bind=True)
def run_breakdown(self, script_id):
    job = AIJob.objects.get(pk=self.request.id)
    job.status = 'running'; job.save()

    def progress(pct, step):
        job.progress = pct; job.step = step; job.save()
        # Broadcast to WebSocket
        channel_layer.group_send(f'project_{job.project_id}', {
            'type': 'job.progress',
            'job_id': str(job.id),
            'progress': pct,
            'step': step,
        })

    progress(5, 'دەستنووس خوێندنەوە...')
    # ... Claude API calls ...
    progress(100, 'تەواو بوو')
    job.status = 'done'; job.save()
```

---

## 6. WebSocket Consumers

### Project AI job consumer
```python
# ws/ai-jobs/<project_id>/
class AIJobConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.project_id = self.scope['url_route']['kwargs']['project_id']
        self.group = f'project_{self.project_id}'
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    # Message types: job.progress, job.complete, job.error, notification
```

---

## 7. Floor Plan — JSON Storage (not SVG)

**IMPORTANT: Do NOT store raw SVG in the database.**
Store structured JSON; render SVG in the template/JS.

```python
class FloorPlan(models.Model):
    scene         = models.ForeignKey(Scene, on_delete=models.CASCADE)
    name          = models.CharField(max_length=100, default='Primary')
    room_width    = models.FloatField(default=8.0)   # metres
    room_height   = models.FloatField(default=4.0)
    furniture     = models.JSONField(default=list)
    # [{type, x, y, w, h, label, color}]
    cameras       = models.JSONField(default=list)
    # [{letter, x, y, target_x, target_y}]
    paths         = models.JSONField(default=list)
    # [{character, points: [[x,y],...], color}]
    ai_generated  = models.BooleanField(default=False)
```

SVG is rendered client-side in `static/js/floorplan-editor.js` from this JSON.

---

## 8. i18n / RTL Architecture

```python
# settings/base.py
LANGUAGE_CODE = 'ckb'   # Kurdish Sorani
LANGUAGES = [
    ('ckb', 'Kurdish Sorani'),   # RTL
    ('ku',  'Kurmanji'),         # RTL
    ('ar',  'Arabic'),           # RTL
    ('en',  'English'),          # LTR
]
USE_I18N = True
USE_L10N = True
LOCALE_PATHS = [BASE_DIR / 'locale']
```

**Bootstrap 5 handles RTL/LTR with a single stylesheet.**
BS5 uses logical CSS properties (`start`/`end`) natively — no separate RTL file needed.
Direction is controlled entirely by the `dir` attribute on `<html>`:

```html
<html lang="{{ LANGUAGE_CODE }}" dir="{% if LANGUAGE_BIDI %}rtl{% else %}ltr{% endif %}">
```

`rwanga.css` also uses logical properties exclusively (`border-inline-start`,
`padding-inline-end`, `inset-inline-start` etc.) — zero physical `left`/`right`.
Switching language flips direction with no template or CSS changes required.

---

## 9. Scene Viewer Export

`/exports/scene-viewer/<scene_pk>/` returns a fully self-contained HTML file:
- All scene data embedded as JSON in a `<script>` tag
- rwanga.css inlined
- No external dependencies
- Works offline
- Used as the shareable deliverable for pre-production meetings

The generator in `exports/generators.py` renders `exports/scene_viewer_template.html`
with the scene's full data and returns it as a downloadable HTML file.

---

## 10. Call Sheet — WhatsApp Delivery

```python
# scheduling/tasks.py
from twilio.rest import Client

@shared_task
def send_call_sheet_whatsapp(call_sheet_id):
    call_sheet = CallSheet.objects.get(pk=call_sheet_id)
    pdf_url = call_sheet.pdf.url  # S3/R2 public URL
    client = Client(settings.TWILIO_SID, settings.TWILIO_TOKEN)
    for member in call_sheet.shoot_day.project.memberships.all():
        if member.user.whatsapp:
            client.messages.create(
                from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
                to=f'whatsapp:{member.user.whatsapp}',
                media_url=[pdf_url],
                body=f'ئایننامەی ڕۆژی {call_sheet.shoot_day.day_number}'
            )
```

---

## 11. Design Tokens — Reference

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--rw-bg` | `#0F0F12` | `#F7F7FA` | Page background |
| `--rw-surface` | `#17171C` | `#FFFFFF` | Cards, panels |
| `--rw-border` | `#2C2C38` | `#DCDCE8` | All borders |
| `--rw-text` | `#EDEAD8` | `#0F0F12` | Primary text |
| `--rw-text-2` | `#78788C` | `#5C5C70` | Secondary text |
| `--rw-amber` | `#D4A574` | `#9A5520` | Accent, shot numbers |
| `--rw-pink` | `#F72585` | `#F72585` | Primary CTA, brand |
| `--rw-script` | `#FF6B35` | same | Script section |
| `--rw-break` | `#2D5BE3` | same | Breakdown section |
| `--rw-vis` | `#00A896` | same | Visualize section |
| `--rw-plan` | `#7C3AED` | same | Plan section |
| `--rw-shoot` | `#F72585` | same | Shoot section |

Font: Cairo (Kurdish/Arabic) + Inter (Latin/numeric).
Radius: 2px max. Shadows: none.

---

*Design owned by Claude. Backend implementation owned by the engineering agent.*
*Questions on design: ask Claude. Questions on models/views/tasks: ask the engineering agent.*
