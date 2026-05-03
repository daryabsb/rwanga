# Engineering Task — Review System UI Implementation

> **For the engineering agent.** Integrate the review system templates into the live Rwanga Django platform. The design work is done — 3 new HTML templates exist with full brand, layout, and interaction patterns. Your job is to wire them into Django views, add missing model fields, create the URL routes, and make them render with real data from the database.

---

## Context

Rwanga (ڕوانگە) is a Kurdish cinema preproduction platform. Tech stack: Django 5 + DRF, Celery + Redis, HTMX, WeasyPrint for PDF export, MCP Server (TypeScript).

The review system lets the director review analytical decisions about the story's structure. Each `BibleReview` generates `ReviewDecision` objects that can be proposed, locked (accepted), or rejected. The models exist. The API exists. What's missing is the **frontend** — the interactive views that let the director work through decisions.

Three design templates have been built as static HTML with mock data. They are pixel-perfect references for what the Django templates should produce. The engineering agent must convert these into Django templates that render with real model data.

---

## Files to Read Before Starting

**These are mandatory reads. Do not skip any.**

1. `rwanga-design-kit/templates/exports/review_workbench_preview.html` — Template 1 design reference
2. `rwanga-design-kit/templates/exports/chain_viewer_preview.html` — Template 2 design reference
3. `rwanga-design-kit/templates/exports/review_summary_preview.html` — Template 3 design reference
4. `rwanga-design-kit/templates/exports/preview.html` — Existing brand system (call sheet, shot list, scene viewer)
5. `rwanga-design-kit/tasks/active/SESSION-MEMORY-PLATFORM-DESIGN.md` — Design principles and north star
6. `rwanga-design-kit/tasks/active/SESSION-MEMORY-CHAINS.md` — Chain system context
7. `rwanga-design-kit/tasks/active/CLAUDE-DESIGN-REVIEW-BRIEF.md` — Original design spec with wireframes

---

## What Already Exists (Do NOT Rebuild)

### Models (in `src/reviews/models.py` or equivalent)

- `BibleReview` — snapshot of bible at review time. Fields: content, status (draft/in_review/delivered), project FK
- `ReviewDecision` — the decision. Fields: topic, decision_text, status (proposed/locked/rejected), lock_comment, reject_reason, review FK, scene FK (optional)
- `BibleSection` — M2M to Scene and ReviewDecision (may not be fully built yet)
- `Scene` — 43 scenes in the screenplay

### API Endpoints (in `src/reviews/api/`)

- `GET/POST /reviews/bible/{project_id}/` — list/create reviews
- `GET/PATCH /reviews/bible/{project_id}/{review_id}/` — get/update review
- `GET/POST /reviews/decisions/{review_id}/` — list/create decisions
- `PATCH /reviews/decisions/{review_id}/{decision_id}/` — update decision (lock/reject)

### Export Templates (in `rwanga-design-kit/templates/exports/`)

- `preview.html` — Combined preview of call sheet, shot list, scene viewer (DO NOT MODIFY)
- `review_workbench_preview.html` — Review Workbench design (REFERENCE ONLY)
- `chain_viewer_preview.html` — Chain Viewer design (REFERENCE ONLY)
- `review_summary_preview.html` — Review Summary PDF design (REFERENCE ONLY)
- `review_preview.html` — Combined preview switcher for all 3 review templates

---

## Deliverable 1 — Model Changes

### 1A. Add fields to `ReviewDecision`

The current model is missing fields needed by the review UI. Add these:

```python
# New fields on ReviewDecision
expression_type = models.CharField(
    max_length=20,
    choices=[
        ('emotional', 'Emotional'),
        ('behavioral', 'Behavioral'),
        ('artistic', 'Artistic'),
        ('memory', 'Memory'),
        ('broken', 'Broken'),
    ],
    blank=True, null=True,
    help_text="Expression type for chain visualization"
)

intensity = models.CharField(
    max_length=20,
    choices=[
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('peak', 'Peak'),
        ('collapse', 'Collapse'),
    ],
    blank=True, null=True,
    help_text="Intensity level for chain visualization"
)

function_label = models.CharField(
    max_length=100,
    blank=True, default='',
    help_text="What the decision does at this point (e.g. 'stabilize uncertainty')"
)

transition_label = models.CharField(
    max_length=100,
    blank=True, default='',
    help_text="How it moved from previous state (e.g. 'emotional → behavioral')"
)

chain_id = models.CharField(
    max_length=10,
    blank=True, default='',
    help_text="Chain letter assignment (A, B, C, D, etc.)"
)

chain_name = models.CharField(
    max_length=200,
    blank=True, default='',
    help_text="Human name of the chain (e.g. 'Gesha: The Guest''s Own Tragedy')"
)

chain_order = models.PositiveIntegerField(
    default=0,
    help_text="Order within the chain (0 = first link)"
)
```

### 1B. Add fields to serializer

Update the `ReviewDecisionSerializer` to include the new fields. They should be read/write via the API.

### 1C. Migration

```bash
python manage.py makemigrations reviews
python manage.py migrate
```

---

## Deliverable 2 — Review Workbench View

**What it is:** The main interactive review page. The director sees unsettled decisions, acts on them (accept/reject), and reads the bible alongside.

**Design reference:** `review_workbench_preview.html`

### 2A. Create Django view

```python
# src/reviews/views.py (or create new file)

class ReviewWorkbenchView(LoginRequiredMixin, DetailView):
    """
    Main review workbench — 3-tab director interface.
    URL: /projects/{project_id}/reviews/{review_id}/workbench/
    """
    model = BibleReview
    template_name = 'reviews/workbench.html'
    context_object_name = 'review'
    pk_url_kwarg = 'review_id'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        review = self.object
        decisions = review.decisions.select_related('scene').order_by('created_at')

        ctx['active_decisions'] = decisions.filter(status='proposed')
        ctx['locked_decisions'] = decisions.filter(status='locked')
        ctx['rejected_decisions'] = decisions.filter(status='rejected')
        ctx['project'] = review.project

        # Group locked decisions by review version
        # (if version tracking exists, otherwise group by lock date month)

        return ctx
```

### 2B. Create Django template

Create `src/templates/reviews/workbench.html` (or wherever your templates live).

**Copy the ENTIRE HTML/CSS from `review_workbench_preview.html` as the starting template.** Then convert the mock data JavaScript sections into Django template variables:

**Replace this pattern (mock JS data):**
```javascript
var activeDecisions = [
  {id:'3e31d9a6', topic:'تویستی کۆتایی', text:'...', scenes:['42','43'], ...},
  ...
];
```

**With this pattern (Django template data passed via JSON):**
```html
<script>
var activeDecisions = {{ active_decisions_json|safe }};
var lockedDecisions = {{ locked_decisions_json|safe }};
</script>
```

Or better — render the decision cards directly in Django templates:

```html
{% for decision in active_decisions %}
<div class="rw-decision" data-section="{{ decision.chain_id|default:'general' }}">
  <div class="rw-d-header" onclick="selectDecision(this,'{{ decision.chain_id|default:'general' }}')">
    <div class="rw-d-topic">{{ decision.topic }}</div>
    <div class="rw-d-text">{{ decision.decision_text }}</div>
    <div class="rw-d-meta">
      {% if decision.scene %}
      <span class="rw-chip rw-chip-scene">دیمەن {{ decision.scene.scene_number }}</span>
      {% endif %}
      {% if decision.expression_type %}
      <span class="rw-chip rw-chip-expr {{ decision.expression_type }}">{{ decision.expression_type }}</span>
      {% endif %}
      {% if decision.intensity %}
      <div class="rw-intensity">
        <div class="rw-int-bar">
          <!-- render intensity dots based on level -->
        </div>
        <span>{{ decision.intensity }}</span>
      </div>
      {% endif %}
    </div>
  </div>
  <div class="rw-d-actions">
    <button class="rw-btn rw-btn-accept"
            hx-patch="{% url 'lock-decision' review.id decision.id %}"
            hx-target="closest .rw-decision"
            hx-swap="outerHTML">✓ پەسەندکردن</button>
    <button class="rw-btn rw-btn-reject"
            hx-patch="{% url 'reject-decision' review.id decision.id %}"
            hx-target="closest .rw-decision"
            hx-swap="outerHTML">✗ ڕەتکردنەوە</button>
    <button class="rw-btn rw-btn-comment" onclick="toggleComment(this)">💬 تێبینی</button>
  </div>
  <div class="rw-comment-area">
    <textarea class="rw-comment-input" placeholder="تێبینیت لێرە بنووسە..."></textarea>
  </div>
</div>
{% endfor %}
```

### 2C. HTMX Integration

The accept/reject buttons should use HTMX to patch the decision status without a full page reload:

```python
# HTMX partial views
class LockDecisionView(LoginRequiredMixin, View):
    """HTMX endpoint: lock a decision and return updated card HTML."""
    def patch(self, request, review_id, decision_id):
        decision = get_object_or_404(ReviewDecision, id=decision_id, review_id=review_id)
        comment = request.POST.get('comment', '')
        decision.status = 'locked'
        decision.lock_comment = comment
        decision.save()
        # Return the locked-state card partial
        return render(request, 'reviews/partials/locked_card.html', {'decision': decision})

class RejectDecisionView(LoginRequiredMixin, View):
    """HTMX endpoint: reject a decision and return updated card HTML."""
    def patch(self, request, review_id, decision_id):
        decision = get_object_or_404(ReviewDecision, id=decision_id, review_id=review_id)
        reason = request.POST.get('reason', '')
        decision.status = 'rejected'
        decision.reject_reason = reason
        decision.save()
        return render(request, 'reviews/partials/rejected_card.html', {'decision': decision})
```

### 2D. URL Routes

```python
# src/reviews/urls.py (add to existing or create)
urlpatterns = [
    path('projects/<uuid:project_id>/reviews/<uuid:review_id>/workbench/',
         ReviewWorkbenchView.as_view(), name='review-workbench'),
    path('reviews/<uuid:review_id>/decisions/<uuid:decision_id>/lock/',
         LockDecisionView.as_view(), name='lock-decision'),
    path('reviews/<uuid:review_id>/decisions/<uuid:decision_id>/reject/',
         RejectDecisionView.as_view(), name='reject-decision'),
]
```

---

## Deliverable 3 — Chain Viewer View

**What it is:** When the director clicks a decision chain, this view shows how the decision evolves across scenes with a visual escalation timeline.

**Design reference:** `chain_viewer_preview.html`

### 3A. Create Django view

```python
class ChainViewerView(LoginRequiredMixin, TemplateView):
    """
    Chain visualization — shows decision escalation across scenes.
    URL: /projects/{project_id}/reviews/{review_id}/chain/{chain_id}/
    """
    template_name = 'reviews/chain_viewer.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        review_id = self.kwargs['review_id']
        chain_id = self.kwargs['chain_id']

        # Get all decisions in this chain, ordered by chain_order
        chain_decisions = ReviewDecision.objects.filter(
            review_id=review_id,
            chain_id=chain_id
        ).select_related('scene').order_by('chain_order')

        ctx['chain_decisions'] = chain_decisions
        ctx['chain_id'] = chain_id
        if chain_decisions.exists():
            ctx['chain_name'] = chain_decisions.first().chain_name
        ctx['review'] = BibleReview.objects.get(id=review_id)
        return ctx
```

### 3B. Create Django template

Create `src/templates/reviews/chain_viewer.html`.

**Copy the ENTIRE HTML/CSS from `chain_viewer_preview.html`.** Then convert the timeline nodes from static HTML to a Django loop:

```html
<div class="cv-timeline" id="cv-timeline">
{% for decision in chain_decisions %}
  {% if not forloop.first %}
  <!-- Arrow connector -->
  <div class="cv-arrow{% if decision.intensity == 'collapse' %} to-collapse{% endif %}">
    <div class="cv-arrow-line"></div>
    <div class="cv-arrow-label">{{ decision.transition_label }}</div>
  </div>
  {% endif %}

  <!-- Node -->
  <div class="cv-node intensity-{{ decision.intensity }}" onclick="showDetail({{ forloop.counter0 }})">
    <div class="cv-node-box">
      <div class="cv-scene-num">{{ decision.scene.scene_number }}</div>
      <div class="cv-intensity-label cv-int-{{ decision.intensity }}">{{ decision.intensity|upper }}</div>
    </div>
    <div class="cv-node-below">
      <div class="cv-expr-type">{{ decision.expression_type }}</div>
      <div class="cv-func">{{ decision.function_label }}</div>
    </div>
  </div>
{% endfor %}
</div>
```

**Critical visual rules — do NOT simplify these:**
- Node HEIGHT varies by intensity: low=90px, medium=110px, peak=140px, collapse=100px
- Peak node has amber glow/shadow and thicker border
- Collapse nodes have dashed borders, red color, diagonal hatched background
- Sustained collapse has dotted borders, lower opacity
- These are defined in the CSS classes `.cv-node.intensity-*` — copy them exactly from the design reference

### 3C. URL Route

```python
path('projects/<uuid:project_id>/reviews/<uuid:review_id>/chain/<str:chain_id>/',
     ChainViewerView.as_view(), name='chain-viewer'),
```

---

## Deliverable 4 — Review Summary PDF Export

**What it is:** A printable A4 summary of a review round — all decisions with status, organized for paper reading.

**Design reference:** `review_summary_preview.html`

### 4A. Create WeasyPrint PDF view

```python
class ReviewSummaryPDFView(LoginRequiredMixin, DetailView):
    """
    PDF export of review summary via WeasyPrint.
    URL: /projects/{project_id}/reviews/{review_id}/summary/pdf/
    """
    model = BibleReview
    template_name = 'reviews/summary_pdf.html'
    pk_url_kwarg = 'review_id'

    def get(self, request, *args, **kwargs):
        self.object = self.get_object()
        ctx = self.get_context_data()
        html_string = render_to_string(self.template_name, ctx, request=request)

        # Generate PDF via WeasyPrint
        from weasyprint import HTML
        pdf = HTML(string=html_string, base_url=request.build_absolute_uri('/')).write_pdf()

        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="review-{self.object.id}-summary.pdf"'
        return response

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        review = self.object
        decisions = review.decisions.select_related('scene').order_by('chain_id', 'chain_order')

        ctx['locked'] = decisions.filter(status='locked')
        ctx['proposed'] = decisions.filter(status='proposed')
        ctx['rejected'] = decisions.filter(status='rejected')
        ctx['total_count'] = decisions.count()
        ctx['project'] = review.project
        return ctx
```

### 4B. Create Django template

Create `src/templates/reviews/summary_pdf.html`.

**Copy the ENTIRE HTML/CSS from `review_summary_preview.html`.** Convert to Django template tags:

```html
<!-- Letterhead -->
<div class="rs-header">
  <div class="rs-header-row">
    <div>
      <div class="rs-logo-mark">ڕ</div>
      <div class="rs-logo-name">ڕوانگە</div>
    </div>
    <div class="rs-project-info">
      <div class="rs-project-title">{{ project.title }}</div>
      <div class="rs-project-sub">{{ project.description|default:"فیلمی کورت" }} — پێداچوونەوەی بایبڵ</div>
    </div>
    <div class="rs-review-col">
      <div class="rs-review-badge">v{{ review.version|default:"03" }}</div>
      <div class="rs-review-label">پێداچوونەوە</div>
    </div>
  </div>
</div>

<!-- Meta counts -->
<div class="rs-meta">
  <div class="rs-meta-item"><div class="rs-meta-val">{{ today|date:"Y/m/d" }}</div><div class="rs-meta-lbl">بەروار</div></div>
  <div class="rs-meta-item"><div class="rs-meta-val">{{ total_count }}</div><div class="rs-meta-lbl">بڕیاری گشتی</div></div>
  <div class="rs-meta-item"><div class="rs-meta-val">{{ locked.count }}</div><div class="rs-meta-lbl">جێگیرکراو</div></div>
  <div class="rs-meta-item"><div class="rs-meta-val">{{ proposed.count }}</div><div class="rs-meta-lbl">نوێ</div></div>
  <div class="rs-meta-item"><div class="rs-meta-val">{{ rejected.count }}</div><div class="rs-meta-lbl">ڕەتکراوە</div></div>
</div>

<!-- Locked decisions -->
{% for d in locked %}
<div class="rs-decision">
  <div class="rs-d-row">
    <div class="rs-d-num">{{ forloop.counter }}</div>
    <div class="rs-d-content">
      <div class="rs-d-topic">{{ d.topic }}</div>
      <div class="rs-d-text">{{ d.decision_text }}</div>
      {% if d.lock_comment %}<div class="rs-d-comment">{{ d.lock_comment }}</div>{% endif %}
    </div>
    <span class="rs-badge rs-badge-locked">جێگیر</span>
  </div>
</div>
{% endfor %}
```

### 4C. URL Route

```python
path('projects/<uuid:project_id>/reviews/<uuid:review_id>/summary/pdf/',
     ReviewSummaryPDFView.as_view(), name='review-summary-pdf'),
```

### 4D. HTML view (non-PDF)

Also create a plain HTML view of the same summary (for on-screen viewing):

```python
path('projects/<uuid:project_id>/reviews/<uuid:review_id>/summary/',
     ReviewSummaryView.as_view(), name='review-summary'),
```

---

## Deliverable 5 — MCP Tool Updates

Update the Rwanga MCP server to expose the new fields via the existing decision tools.

**File:** `rwanga-mcp/src/tools/` (wherever decision tools are defined)

### 5A. Update `create_decision` tool

Add optional parameters:
- `expression_type` (string, one of: emotional/behavioral/artistic/memory/broken)
- `intensity` (string, one of: low/medium/peak/collapse)
- `function_label` (string)
- `transition_label` (string)
- `chain_id` (string, e.g. "A", "B", "C", "D")
- `chain_name` (string)
- `chain_order` (integer)

### 5B. Update `list_decisions` response

Include the new fields in the API response so the MCP `list_decisions` tool returns them.

### 5C. Add `list_chains` tool (new)

```typescript
// New MCP tool: list_chains
// Returns unique chains for a review with decision counts
// Input: review_id
// Output: Array of { chain_id, chain_name, decision_count, scenes: number[] }
```

---

## Deliverable 6 — Navigation Integration

### 6A. Add review links to project dashboard

If a project dashboard exists, add a "پێداچوونەوەکان" (Reviews) section that links to:
- The review workbench: `/projects/{id}/reviews/{review_id}/workbench/`
- The PDF summary: `/projects/{id}/reviews/{review_id}/summary/pdf/`

### 6B. Add chain links within the workbench

In the Review Workbench template, when a decision has a `chain_id`, make it clickable:

```html
{% if decision.chain_id %}
<a href="{% url 'chain-viewer' project.id review.id decision.chain_id %}"
   class="rw-chip" style="cursor:pointer;text-decoration:none;">
   🔗 زنجیرەی {{ decision.chain_id }}
</a>
{% endif %}
```

---

## Brand Rules — Non-Negotiable

These are extracted from the existing templates. Do NOT deviate:

| Element | Value |
|---------|-------|
| Primary color | `#F72585` (pink) |
| Accent color | `#D4A574` (amber) |
| Dark accent | `#9A5520` |
| Dark background | `#0F0F12` |
| Surface | `#17171C` |
| Surface-2 | `#1E1E26` |
| Light background | `#F7F7FA` |
| Text (dark bg) | `#EDEAD8` |
| Text muted | `#78788C` |
| Text dim | `#40404E` |
| Text (light bg) | `#0F0F12` |
| Border (dark) | `#2C2C38` |
| Border (light) | `#DCDCE8` |
| Kurdish/Arabic font | `Cairo` |
| Latin/numbers font | `Inter` |
| Direction | RTL (`direction: rtl`) |
| Border radius | 2px max |
| Shadows | None |
| Logo | Pink square with `ڕ` |
| Footer text | `دروستکراوە لە ڕوانگە — پلاتفۆرمی پێشبەرهەمهێنانی سینەمای کوردی` |

---

## CSS to Copy Verbatim

The design templates contain hundreds of lines of carefully tuned CSS. **Do not rewrite the CSS.** Copy it from the design reference files:

- **Workbench CSS:** From `review_workbench_preview.html` lines 8–180 (everything inside `<style>`)
- **Chain Viewer CSS:** From `chain_viewer_preview.html` lines 8–145
- **Summary PDF CSS:** From `review_summary_preview.html` lines 8–110

Put this CSS either inline in the Django templates (same as the existing call sheet/shot list templates do) or in a shared static CSS file.

---

## What NOT To Do

1. **Do NOT modify existing templates** (call sheet, shot list, scene viewer in `preview.html`)
2. **Do NOT invent new colors, fonts, or visual patterns** — use the brand system exactly
3. **Do NOT make anything LTR** — everything is RTL
4. **Do NOT simplify the chain viewer into a plain list** — the visual escalation with varying heights, glows, and broken styles IS the point
5. **Do NOT skip the HTMX integration** — accept/reject must work without full page reloads
6. **Do NOT build a REST-only solution** — this needs server-rendered Django templates, not a JS SPA
7. **Do NOT add React, Vue, or any JS framework** — vanilla JS + HTMX only (matches existing stack)

---

## Acceptance Criteria

- [ ] `ReviewDecision` model has `expression_type`, `intensity`, `function_label`, `transition_label`, `chain_id`, `chain_name`, `chain_order` fields
- [ ] Migration runs cleanly
- [ ] `/projects/{id}/reviews/{id}/workbench/` renders the 3-tab review workbench with real decisions
- [ ] Accept/reject buttons work via HTMX without page reload
- [ ] Clicking a decision highlights the corresponding bible section in the right panel
- [ ] Bible ↔ Script toggle works in the right panel
- [ ] `/projects/{id}/reviews/{id}/chain/{chain_id}/` renders the escalation timeline with correct visual encoding
- [ ] Chain nodes have varying heights/styles by intensity level
- [ ] Clicking a chain node shows the detail panel with lens text
- [ ] `/projects/{id}/reviews/{id}/summary/pdf/` generates a downloadable PDF via WeasyPrint
- [ ] PDF has correct RTL layout, letterhead, status badges, summary table
- [ ] MCP tools updated to read/write the new fields
- [ ] All templates use Cairo + Inter fonts, pink/amber brand colors, RTL direction
- [ ] Footer on all views shows the Rwanga brand line

---

## Build Order

1. Model changes + migration (15 min)
2. Review Workbench view + template (60 min) — start here, it's the main deliverable
3. HTMX accept/reject partials (20 min)
4. Chain Viewer view + template (45 min)
5. Review Summary PDF view + template (30 min)
6. URL wiring + navigation links (15 min)
7. MCP tool updates (20 min)
8. Test with real data from the v03 review (15 min)

**Total estimated: ~4 hours**

---

## Test Data

The live database has:
- **Project:** `b7821ef2-bef1-4527-b192-625ac0977aa5` (میوانێکی نادیار)
- **Review:** `96f026e7-a45c-4e04-b604-c208aede15b7` (v03, bible v3.0, draft)
- **25 locked decisions** (status: locked)
- **19 proposed decisions** (status: proposed)

After implementing, test with this real review data to verify rendering.
