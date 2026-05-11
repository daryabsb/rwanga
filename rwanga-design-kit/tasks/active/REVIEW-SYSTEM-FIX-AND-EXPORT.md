# Review System Fix + PDF Export

> **Priority:** CRITICAL — the review detail page is broken and unusable for the director.
> **Mode: NON-STOP.**
> **Reference:** The original review design is in `Projects/Mysterious-Guest/Reviews/REVIEW-V3.html` (English). The Kurdish translations are in `TRANSLATION-CHUNKS-V3-KU.txt`. Export template patterns are in `rwanga-design-kit/templates/exports/`.

---

## Background

The review detail page currently:
- Shows **45 decisions** (20 bad question-style + 25 correct locked conclusions)
- Has an **empty Bible tab** ("هیچ ناوەڕۆکی بایبڵێک نییە") even though `canonical_bible` has 20,332 chars of Kurdish content
- Has **no structure** — all decisions in a flat list, no narrative organization
- Decisions are **not sorted** — Sarwar has to scroll endlessly to find actionable items
- **Badge counts are wrong** — sidebar shows incorrect numbers

The review SHOULD look like the REVIEW-V3.html: 4 organized tabs with narrative structure, not a flat CRUD list.

---

## Part 1 — Database Cleanup (Run First)

```python
# python manage.py shell
from reviews.models import ReviewDecision

# Delete the 20 bad question-style decisions
bad_ids = [
    '55b02cf9-7d55-4d31-b3ca-54a9ee028fe9',
    '3e31d9a6-7e44-4100-ab21-a01dd57edd36',
    '52664763-c6ce-460e-97bd-cf8401a59039',
    '76487c5e-3970-4e4d-bb59-b590f3cc47f8',
    '2c06bce2-9ecc-4276-8535-b92cef91eee0',
    '00cda708-1364-4ff4-8d78-c23e07ce22de',
    '625c93de-1dc1-4dbc-afeb-1bd774474a2c',
    'b0199081-08a7-45c8-8be9-470cf7586198',
    'e0647a6a-271e-420f-9d2f-1e4a2f776676',
    'b8842d96-c352-4a55-9132-3fa84cd2edb5',
    'c560c259-a52c-4342-b3cf-a7c9ed99e06c',
    'ad235c7e-2d5e-4023-964f-5deff9870eca',
    'c1272802-34cc-4804-b8fc-ff3d5e7d164e',
    'e0ae64c7-b085-4c98-9623-ea4bd882fc0c',
    'af33d5e1-82e8-49b6-8a68-941ea7a0a839',
    'eeece2b4-0f20-4f24-83ce-cb7149f6c515',
    '395963bc-6fb0-4e7a-979f-e2a44c594fa5',
    '47f7ad5f-96e9-4d18-9902-5d4cb6e969fa',
    '6089f2c7-9606-4935-a98f-025940680dee',
    '0473726a-07b3-487c-96f7-49fe96def393',
]

deleted = ReviewDecision.objects.filter(id__in=bad_ids).delete()
print(f"Deleted: {deleted}")

# Also delete any test community sessions
from community.models import CommunitySession  # or whatever the model is
CommunitySession.objects.filter(title__startswith='new s').delete()

# Verify
remaining = ReviewDecision.objects.filter(
    bible_review_id='96f026e7-a45c-4e04-b604-c208aede15b7'
).count()
print(f"Remaining decisions: {remaining}")  # Should be 25
```

---

## Part 2 — Fix Bible Tab (Bug)

The Bible tab shows "هیچ ناوەڕۆکی بایبڵێک نییە" even though the project's `canonical_bible` field has content.

### Root Cause

The review detail view doesn't pass the bible content to the template, OR the template doesn't render `canonical_bible.content`.

### Fix

In the review detail view (likely `reviews/views.py`), ensure the bible content from the project's `canonical_bible` is passed to the template context:

```python
# In the review detail view
project = review.project  # or however the relation works
context['bible_content'] = project.canonical_bible.get('content', '')
context['bible_title'] = project.canonical_bible.get('title', '')
context['bible_version'] = project.canonical_bible.get('version', '')
```

In the template's Bible tab, render the content as markdown (it's a `.md` file):

```html
{% if bible_content %}
  <div class="bible-content" dir="rtl" lang="ku">
    <h3>{{ bible_title }}</h3>
    <div class="markdown-body">{{ bible_content|linebreaks }}</div>
  </div>
{% else %}
  <p class="text-muted">{% trans "هیچ ناوەڕۆکی بایبڵێک نییە." %}</p>
{% endif %}
```

**Better:** If you have a markdown filter (like `markdownify`), use `{{ bible_content|markdown }}` for proper heading/list/bold rendering.

---

## Part 3 — Fix Decisions Tab Sorting & Structure

Currently all 25 decisions show in a flat unsorted list. Fix:

### A. Sort: Proposed (unsettled) first, then Locked

```python
decisions = review.decisions.all().order_by(
    Case(
        When(status='proposed', then=0),
        When(status='locked', then=1),
        When(status='rejected', then=2),
        default=3,
    ),
    'created_at'
)
```

### B. Group with headers

In the template, group decisions visually:

```html
{% regroup decisions by status as decision_groups %}
{% for group in decision_groups %}
  <h4 class="decision-group-header">
    {% if group.grouper == 'proposed' %}
      بڕیارە چاوەڕوانەکان  {# Pending Decisions #}
    {% elif group.grouper == 'locked' %}
      بڕیارە جێگیرکراوەکان  {# Locked Decisions #}
    {% elif group.grouper == 'rejected' %}
      بڕیارە ڕەتکراوەکان  {# Rejected Decisions #}
    {% endif %}
    <span class="badge">{{ group.list|length }}</span>
  </h4>
  {% for d in group.list %}
    {# decision card #}
  {% endfor %}
{% endfor %}
```

### C. Show decision numbers from topic

The decisions have Kurdish numbering in the topic (١., ٢., etc.). The topic should be rendered as a header, with the decision_text as the body. Currently it seems the topic isn't displayed prominently enough.

---

## Part 4 — Fix Badge Counts

The sidebar shows wrong badge numbers (19 on reviews icon, 3 on community). Find the context processor or template tag that counts these and fix:

```python
# In context_processors.py or wherever badges are computed
review_count = BibleReview.objects.filter(
    project__in=user_projects,
    # only count reviews with pending (proposed) decisions
).annotate(
    pending=Count('decisions', filter=Q(decisions__status='proposed'))
).filter(pending__gt=0).count()

# Community should show 0 if no real sessions exist
community_count = CommunitySession.objects.filter(
    project__in=user_projects,
    # exclude test data
).exclude(title__startswith='new s').count()
```

---

## Part 5 — Fix Permissions: Super Admin Override

The MCP runs as user 28 (Super Admin) but can't reject decisions because the API checks `is_director`. Add a Super Admin override:

```python
# In the reject_decision view/serializer
def check_permissions(self, request):
    if request.user.is_superuser or request.user.is_staff:
        return  # Super admin can always reject
    if not self.get_object().bible_review.project.is_director(request.user):
        raise PermissionDenied("Only directors can reject decisions")
```

---

## Part 6 — Review PDF Export Template

Create `templates/exports/review_export.html` — a WeasyPrint A4 PDF template that matches the REVIEW-V3.html structure. This is what directors receive and share.

### Structure (4 sections, matching the review design)

**Section 1 — کارەکانی پێشوو تا ئێستا (Previous Reviews)**
- Brief intro paragraph about review history
- D1–D13 (V1 decisions) as numbered items with status tags
- D14–D20 (V2 decisions) as numbered items with status tags
- Director's corrections section (if any)

**Section 2 — شیکردنەوەی V3 (V3 Analysis)**
- Intro about what the corrections revealed
- Upgrade subsections: D9↑, D17↑, D20↑ with V1→V3 comparison
- New principles: Reality Replacement, Bilateral Tragedy
- French Girl execution rules
- Summary: how all 20 decisions + upgrades work together

**Section 3 — بایبڵی چیرۆک (Story Bible)**
- Full canonical bible content rendered as markdown

**Section 4 — تۆماری گفتوگۆکان (Conversation Log)**
- Header in Kurdish
- Conversation content in English (as designed)

### Template Pattern

Follow the exact pattern from `call_sheet_template.html`:

```html
{# exports/review_export.html #}
{% load i18n %}
<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
<meta charset="UTF-8">
<title>{% trans "پێداچوونەوە" %} — {{ project.title }} — V{{ review.version }}</title>
<style>
/* Use same tokens as call_sheet_template.html */
:root {
  --rw-bg:       #FFFFFF;
  --rw-surface:  #F7F7FA;
  --rw-border:   #DCDCE8;
  --rw-text:     #0F0F12;
  --rw-text-2:   #5C5C70;
  --rw-text-3:   #A0A0B8;
  --rw-amber:    #9A5520;
  --rw-pink:     #F72585;
  --rw-vis:      #007A6E;
  --rw-font:     'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
}

@page {
  size: A4 portrait;
  margin: 14mm 12mm 18mm 12mm;
  @bottom-center {
    content: "ڕوانگە — " string(project-title) " — " counter(page) " / " counter(pages);
    font-family: 'Cairo', Arial, sans-serif;
    font-size: 8pt;
    color: var(--rw-text-3);
  }
}

body {
  font-family: var(--rw-font);
  font-size: 11pt;
  color: var(--rw-text);
  line-height: 1.6;
  direction: rtl;
}

/* Section headers */
.section-header {
  font-size: 16pt;
  font-weight: 700;
  color: var(--rw-pink);
  border-bottom: 2pt solid var(--rw-pink);
  padding-bottom: 6pt;
  margin: 24pt 0 12pt;
  page-break-after: avoid;
}

/* Decision cards */
.decision {
  background: var(--rw-surface);
  border: 1pt solid var(--rw-border);
  padding: 8pt 12pt;
  margin-bottom: 8pt;
  page-break-inside: avoid;
}
.decision-topic {
  font-weight: 700;
  font-size: 11pt;
  color: var(--rw-text);
  margin-bottom: 4pt;
}
.decision-text {
  font-size: 10pt;
  color: var(--rw-text-2);
  line-height: 1.5;
}
.status-tag {
  display: inline-block;
  font-size: 8pt;
  font-weight: 700;
  padding: 1pt 6pt;
  border-radius: 2pt;
}
.tag-confirmed { background: #E8F5E9; color: #2E7D32; }
.tag-refined { background: #FFF3E0; color: #E65100; }
.tag-upgraded { background: #E3F2FD; color: #1565C0; }
.tag-new { background: #FCE4EC; color: #C2185B; }

/* Upgrade comparison */
.upgrade-box {
  background: #FAFAFA;
  border-right: 3pt solid var(--rw-amber);
  padding: 8pt 12pt;
  margin: 8pt 0;
}
.upgrade-label {
  font-size: 9pt;
  font-weight: 700;
  color: var(--rw-amber);
  margin-bottom: 4pt;
}

/* Bible content */
.bible-content {
  font-size: 10.5pt;
  line-height: 1.7;
}
.bible-content h2 { font-size: 13pt; color: var(--rw-pink); margin: 16pt 0 6pt; }
.bible-content h3 { font-size: 11pt; color: var(--rw-text); margin: 12pt 0 4pt; }

/* Conversation log */
.conversation { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; direction: ltr; text-align: left; }
.conv-entry { margin-bottom: 12pt; }
.conv-speaker { font-weight: 700; font-size: 10pt; }
.conv-text { font-size: 10pt; color: var(--rw-text-2); }
</style>
</head>
<body>

{# ── COVER / HEADER ── #}
<div style="text-align:center;margin-bottom:24pt;">
  <div style="width:48pt;height:48pt;background:var(--rw-pink);color:#fff;font-size:22pt;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--rw-font);">ڕ</div>
  <h1 style="font-size:18pt;margin:8pt 0 4pt;">{{ project.title }}</h1>
  <p style="font-size:10pt;color:var(--rw-text-2);">{{ review.title }} — {{ review.created_at|date:"Y-m-d" }}</p>
  <p style="font-size:9pt;color:var(--rw-text-3);">{{ review.get_status_display }}</p>
</div>

{# ── SECTION 1: PREVIOUS REVIEWS ── #}
<div class="section-header">کارەکانی پێشوو تا ئێستا</div>
<p>ئەمە سێیەمین پێداچوونەوەیە بۆ پڕۆژەی "{{ project.title }}".</p>

{% for d in v1_decisions %}
<div class="decision">
  <div class="decision-topic">
    {{ d.topic }}
    {% if 'پشتڕاستکرایەوە' in d.topic %}
      <span class="status-tag tag-confirmed">پشتڕاستکرایەوە</span>
    {% elif 'وردتر کرایەوە' in d.topic %}
      <span class="status-tag tag-refined">وردتر کرایەوە</span>
    {% elif 'جێگیرکراو' in d.topic %}
      <span class="status-tag tag-confirmed">جێگیرکراو</span>
    {% endif %}
  </div>
  <div class="decision-text">{{ d.decision_text }}</div>
</div>
{% endfor %}

{# ── SECTION 2: V3 ANALYSIS ── #}
<div class="section-header">شیکردنەوەی V3</div>
<p>ئەو ٢٠ بڕیارەی پێشتر جێگیرمان کردبوون هێشتا وەک خۆیانن و تێکنەچوون.</p>

{% for d in v3_upgrades %}
<div class="decision">
  <div class="decision-topic">
    {{ d.topic }}
    <span class="status-tag tag-upgraded">بەرزکرایەوە</span>
  </div>
  <div class="decision-text">{{ d.decision_text }}</div>
</div>
{% endfor %}

{% for d in new_principles %}
<div class="decision">
  <div class="decision-topic">
    {{ d.topic }}
    <span class="status-tag tag-new">پرەنسیپی نوێ</span>
  </div>
  <div class="decision-text">{{ d.decision_text }}</div>
</div>
{% endfor %}

{# ── SECTION 3: STORY BIBLE ── #}
<div class="section-header" style="page-break-before:always;">بایبڵی چیرۆک</div>
<div class="bible-content">
  {{ bible_content|linebreaks }}
</div>

{# ── SECTION 4: CONVERSATION LOG ── #}
<div class="section-header" style="page-break-before:always;">تۆماری گفتوگۆکان</div>
<p>گفتوگۆی تەواوی نێوان "دەریا ئیبراهیم" و AI — بەبێ دەستکاری.</p>
<div class="conversation">
  {% for entry in conversation_log %}
  <div class="conv-entry">
    <span class="conv-speaker">{{ entry.speaker }}:</span>
    <span class="conv-text">{{ entry.text }}</span>
  </div>
  {% endfor %}
</div>

</body>
</html>
```

### View for PDF Export

```python
# reviews/views.py
from django.template.loader import render_to_string
from weasyprint import HTML
from django.http import HttpResponse

def export_review_pdf(request, project_id, review_id):
    review = get_object_or_404(BibleReview, id=review_id)
    project = review.project
    decisions = review.decisions.filter(status='locked').order_by('created_at')
    
    # Split decisions into categories
    v1_decisions = [d for d in decisions if d.topic and d.topic[0] in '٠١٢٣٤٥٦٧٨٩']
    v3_upgrades = [d for d in decisions if 'بەرزکردنەوەی' in d.topic]
    new_principles = [d for d in decisions if 'پرەنسیپی نوێ' in d.topic]
    
    context = {
        'project': project,
        'review': review,
        'v1_decisions': v1_decisions,
        'v3_upgrades': v3_upgrades,
        'new_principles': new_principles,
        'bible_content': project.canonical_bible.get('content', ''),
        'conversation_log': [],  # populate from session content if available
    }
    
    html_string = render_to_string('exports/review_export.html', context)
    pdf = HTML(string=html_string, base_url=request.build_absolute_uri('/')).write_pdf()
    
    response = HttpResponse(pdf, content_type='application/pdf')
    filename = f"review-{project.title}-v{review.version}.pdf"
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    return response
```

### URL

```python
# reviews/urls.py
path('projects/<uuid:project_id>/reviews/<uuid:review_id>/export/',
     export_review_pdf, name='review_export_pdf'),
```

### Button in Review Detail Template

Add an export button to the review detail page header:

```html
<a href="{% url 'review_export_pdf' project.id review.id %}" 
   class="btn btn-outline" target="_blank">
  <i class="icon-download"></i> {% trans "هەناردەکردنی PDF" %}
</a>
```

---

## Part 7 — Fix Synopsis Metadata

The project synopsis shows raw `[RWANGA_META]` JSON block. Strip it in the template:

```python
# In template filter or context
import re
synopsis_clean = re.sub(r'\[RWANGA_META\].*?\[/RWANGA_META\]', '', project.synopsis, flags=re.DOTALL).strip()
```

Or as a template filter:

```python
# templatetags/rwanga_filters.py
@register.filter
def strip_meta(value):
    import re
    return re.sub(r'\[RWANGA_META\].*?\[/RWANGA_META\]', '', value, flags=re.DOTALL).strip()
```

Usage: `{{ project.synopsis|strip_meta }}`

---

## Verification Checklist

After all changes:

- [ ] Only 25 decisions remain (20 bad deleted)
- [ ] Bible tab shows full Kurdish story bible content with proper markdown rendering
- [ ] Decisions tab shows proposed (unsettled) decisions FIRST, then locked decisions grouped below
- [ ] Decision topics display with status tags (پشتڕاستکرایەوە, وردتر کرایەوە, بەرزکرایەوە, پرەنسیپی نوێ)
- [ ] Badge counts correct: reviews = actual review count, community = 0 (no real sessions)
- [ ] PDF export generates A4 document with 4 sections matching REVIEW-V3.html structure
- [ ] PDF renders Kurdish text correctly (Cairo font, RTL)
- [ ] Super admin (user 28) can reject decisions via API
- [ ] Synopsis doesn't show [RWANGA_META] block
- [ ] No test community sessions ("new s") remain

---

## Important Notes

- Project ID: `b7821ef2-bef1-4527-b192-625ac0977aa5`
- Review ID: `96f026e7-a45c-4e04-b604-c208aede15b7`
- Auth token (Sarwar): `8e7455eee062e10b7db8babe3938b316a0804cca`
- Super Admin user: 28
- WeasyPrint must be installed (`pip install weasyprint`)
- The review PDF export is the FIRST export type to use the same Rwanga branding as call sheets and scene viewers
- Kurdish (Sorani) text requires Cairo font and `dir="rtl"` throughout
