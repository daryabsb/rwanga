# Rwanga — Agent Pattern Guide
> **Read this before building any page or component.**  
> Stack: Django 5 + HTMX + Bootstrap 5 RTL + `rwanga-ds.css`  
> Design system: B+E hybrid icons · amber glow · dark-first · RTL-native

---

## 0. The One Rule

**Layout = Bootstrap 5 utilities only.**  
`rwanga-ds.css` contains ZERO margin, padding, flex or grid rules for content areas.  
All spacing, columns, and alignment come from BS5 classes: `d-flex`, `gap-*`, `px-*`, `py-*`, `col-*`, `row`, `g-*`, `ms-auto`, `align-items-*`, etc.

`rwanga-ds.css` only contains:
- Design tokens (`--rw-*` CSS variables)
- Component skins (border, background, color, filter)
- Icon glow effects

---

## 1. File Structure

```
templates/
├── base.html                    ← Shell: rail + topnav + content slot
├── components/
│   ├── _sidebar.html            ← Rail icons (B+E hybrid SVGs)
│   ├── _topnav.html             ← Top nav + section tabs
│   ├── _breadcrumb.html         ← Optional breadcrumb bar
│   ├── _modal.html              ← Modal scaffold
│   ├── _toast.html              ← Toast notification
│   ├── _empty_state.html        ← Empty list state
│   └── _ai_progress.html        ← AI job progress bar
├── {app}/
│   ├── list.html                ← LIST pattern
│   ├── detail.html              ← DETAIL / form pattern
│   └── _partials/               ← HTMX partials (table body, card grid, etc.)
static/
└── css/
    └── rwanga-ds.css            ← The design system stylesheet
```

---

## 2. base.html Shell

```html
<!DOCTYPE html>
<html lang="{{ LANGUAGE_CODE|default:'ku' }}"
      dir="{% if LANGUAGE_BIDI %}rtl{% else %}ltr{% endif %}"
      data-theme="dark" data-bs-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}ڕوانگە{% endblock %} — ڕوانگە</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="{% static 'css/rwanga-ds.css' %}">
  {% block extra_css %}{% endblock %}
</head>
<body>

<div class="rw-app">               {# d-flex height:100vh overflow:hidden #}

  {# RAIL — always first child (= right in RTL, left in LTR) #}
  <aside class="rw-rail">
    {% include "components/_sidebar.html" %}
  </aside>

  {# MAIN AREA #}
  <div class="rw-main">            {# flex:1 d-flex flex-column overflow:hidden #}
    {% include "components/_topnav.html" %}
    <div id="rw-content" class="flex-grow-1 overflow-auto">
      {% block content %}{% endblock %}
    </div>
  </div>

</div>

<div id="rw-toast-container" class="rw-toast-container"></div>
<div id="rw-modal-container"></div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://unpkg.com/htmx.org@1.9.12"></script>
<script src="{% static 'js/rwanga.js' %}"></script>
{% block extra_js %}{% endblock %}
</body>
</html>
```

---

## 3. Icon System (B+E Hybrid)

### CSS classes on every SVG icon
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  {# .ico = fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round #}
</svg>
```

### Rail icon slot
```html
<a href="..." class="rw-rail-icon [STATE]" title="...">
  <svg ...>...</svg>
</a>
```

**States:**
| Class | Appearance |
|---|---|
| *(none)* | Dim grey, no glow |
| `active` | Amber glow + amber left bar |
| `active-plan` | Purple glow + purple bar (Reviews) |
| `active-vis` | Teal glow + teal bar (Community) |

### Cinema glyphs (Option E) — domain icons

| Icon | Use for | SVG key shapes |
|---|---|---|
| Film frame | Projects, any project nav | `rect` + horizontal/vertical `line` grid |
| Clapperboard | Script, Write section | `path` top + `rect` body + diagonal lines |
| Viewfinder | Shot list, camera focus | outer `circle` + inner `circle` + crosshairs |
| Storyboard grid | Storyboard module | 4× `rect` 2×2 grid |
| Floor plan | Floor plan module | `rect` + internal grid lines + 2× `circle` |
| Film reel | Schedule, timeline | outer `circle` + centre `circle` + 8× small `circle` |
| Camera | Camera, shoot section | `rect` body + `circle` lens + `path` top |
| Aperture | Settings, precision tools | outer `circle` + inner `circle` + 4× diagonal lines |

### Utility icons (Option B) — standard stroke

Use for: Team, Locations, Reviews ✓-box, Community bubble, Settings gear, Notifications bell, Theme sun, Profile.

**Always 28px × 28px inside a 60px × 52px `.rw-rail-icon` slot.**

---

## 4. Page Patterns

Pick the right pattern by answering: *what is the primary task on this page?*

### LIST — browse a flat collection
**When:** team, tasks, contacts, decisions, locations (list-only), sessions  
**Structure:**
```
sticky page header (title + primary CTA button)
↓
filter strip (rw-filter-row + rw-f-btn)
↓
table (rw-tbl) — overflow-x:auto wrapper for mobile
↓
optional: pagination
```
**Django template:**
```html
{% block content %}
<div id="rw-content" class="flex-grow-1 overflow-auto">

  {# Header #}
  <div class="d-flex align-items-center justify-content-between px-4 py-3
              bg-rw-surface" style="border-bottom:1px solid var(--rw-border)">
    <div>
      <h1 class="fs-4 fw-bold mb-1">{% trans "PAGE TITLE" %}</h1>
      <p class="mb-0" style="font-size:12px;color:var(--rw-text-2)">{{ subtitle }}</p>
    </div>
    <button class="rw-btn rw-btn-primary"
            hx-get="{% url 'app:create_modal' %}"
            hx-target="#rw-modal-container">
      + {% trans "زیادکردن" %}
    </button>
  </div>

  {# Filter strip #}
  <div class="d-flex align-items-center px-4 py-2"
       style="background:var(--rw-surface-2);border-bottom:1px solid var(--rw-border)">
    <div class="rw-filter-row">
      <button class="rw-f-btn active"
              hx-get="?filter=all" hx-target="#list-body" hx-swap="innerHTML">
        {% trans "هەموو" %}
      </button>
      {# add more filters #}
    </div>
    <span class="ms-auto" style="font-size:11px;color:var(--rw-text-3)">
      {{ items.count }} {% trans "ئایتەم" %}
    </span>
  </div>

  {# Table #}
  <div id="list-body" style="overflow-x:auto">
    <table class="rw-tbl">
      <thead>
        <tr>
          <th class="px-3 py-2">{% trans "ناو" %}</th>
          {# more columns #}
        </tr>
      </thead>
      <tbody>
        {% for item in items %}
        <tr class="rw-tbl-row"
            onclick="location.href='{% url 'app:detail' item.pk %}'">
          <td class="px-3 py-2">{{ item.name }}</td>
        </tr>
        {% empty %}
        <tr>
          <td colspan="99" class="p-0">
            {% include "components/_empty_state.html"
               with icon_svg="..." title=_("هیچ ئایتەمێک نییە") %}
          </td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>

</div>
{% endblock %}
```

---

### CARD GRID — visual collection
**When:** community sessions, project list (home), storyboard frames  
**Key:** CSS `auto-fill` grid — NOT BS5 `col-*` columns
```html
<div style="display:grid;
            grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
            gap:1px;
            background:var(--rw-border);
            border:1px solid var(--rw-border)">
  {% for item in items %}
  <a href="{% url 'app:detail' item.pk %}"
     class="rw-session-card d-flex flex-column gap-3 p-3">
    {# card content #}
  </a>
  {% endfor %}
</div>
```

---

### SPLIT VIEW — map/panel or list/content
**When:** locations (map + list), notifications (panel + detail)  
**Key:** two flex children, panel has fixed width, main takes remaining space
```html
{% block content %}
<div id="rw-content" class="d-flex flex-grow-1 overflow-hidden">

  {# Main area (map, content) #}
  <div class="flex-grow-1 d-flex flex-column overflow-hidden">
    {# toolbar #}
    <div class="d-flex align-items-center px-3 py-2 bg-rw-surface"
         style="height:56px;flex-shrink:0;border-bottom:1px solid var(--rw-border)">
      <h1 class="fs-5 fw-bold flex-grow-1 mb-0">...</h1>
    </div>
    {# scrollable or map content #}
    <div class="flex-grow-1 overflow-auto">...</div>
  </div>

  {# Side panel — hidden on mobile #}
  <aside class="rw-scene-panel d-none d-md-flex flex-column overflow-hidden">
    {# search + list #}
  </aside>

</div>
{% endblock %}
```

---

### SCENE VIEW — the core production layout
**When:** any scene-level module (shot list, storyboard, floor plan, lighting, sound, props, wardrobe, continuity)  
**Key:** scene panel (first in DOM = right in RTL) + scene main with module tabs
```html
{% block content %}
<div class="d-flex flex-grow-1 overflow-hidden">

  {# Scene list panel — FIRST IN DOM #}
  <aside class="rw-scene-panel d-none d-lg-flex flex-column overflow-hidden">
    <div class="px-3 py-2 rw-overline"
         style="border-bottom:1px solid var(--rw-border)">
      {% trans "سەحنەکان" %}
    </div>
    <div class="flex-grow-1 overflow-auto">
      {% for scene in project.scenes.all %}
      <a class="rw-scene-item {% if scene == active_scene %}active{% endif %}"
         hx-get="{% url 'scripts:scene' project.pk scene.pk %}"
         hx-target="#rw-scene-main" hx-push-url="true">
        <span class="rw-sc-num">{{ scene.number }}</span>
        <div>
          <div class="rw-sc-loc">{{ scene.location_name }}</div>
          <div class="rw-sc-time">{{ scene.time_of_day }}</div>
        </div>
      </a>
      {% endfor %}
    </div>
  </aside>

  {# Scene main #}
  <div id="rw-scene-main" class="flex-grow-1 d-flex flex-column overflow-hidden">

    {# Scene topbar #}
    <div class="d-flex align-items-center px-4 gap-3 bg-rw-surface"
         style="height:56px;flex-shrink:0;border-bottom:1px solid var(--rw-border)">
      <div>
        <div class="fw-bold">{{ scene.int_ext }}. {{ scene.location_name }}</div>
        <div style="font-size:11px;color:var(--rw-text-2)">
          {% trans "سەحنە" %} {{ scene.number }} ·
          <span class="rw-font-en">{{ scene.page_count }}</span> {% trans "پەڕە" %}
        </div>
      </div>
      <a class="rw-btn rw-btn-amber rw-btn-sm ms-auto"
         href="{% url 'exports:scene_viewer' scene.pk %}">
        ↗ {% trans "دەرهێنان" %}
      </a>
    </div>

    {# Module tabs #}
    <div class="d-flex overflow-x-auto px-3 bg-rw-surface"
         style="height:48px;flex-shrink:0;border-bottom:1px solid var(--rw-border)">
      {% for tab in tabs %}
      <button class="rw-mod-tab {% if tab.active %}active{% endif %}"
              hx-get="{{ tab.url }}" hx-target="#rw-tab-content"
              hx-push-url="true">
        {{ tab.label }}
      </button>
      {% endfor %}
    </div>

    {# Tab content #}
    <div id="rw-tab-content" class="flex-grow-1 overflow-auto p-4"
         style="background:var(--rw-bg)">
      {% block tab_content %}{% endblock %}
    </div>

  </div>
</div>
{% endblock %}
```

---

### DASHBOARD — project overview with section rows
**When:** project overview page (Write/Breakdown/Visualize/Plan/Shoot rows)
```html
{# Project cover header #}
<div class="d-flex align-items-center gap-4 px-4 py-4 bg-rw-surface"
     style="border-bottom:1px solid var(--rw-border)">
  <div class="rw-proj-cover d-flex align-items-center justify-content-center">
    🎬
  </div>
  <div>
    <div class="rw-proj-title">{{ project.title }}</div>
    <div style="font-size:13px;color:var(--rw-text-2)">{{ project.studio.name }}</div>
  </div>
</div>

{# Stats strip #}
<div class="rw-stats mx-4 mt-4 mb-3">
  <div class="rw-stat">
    <div class="rw-stat-val">{{ project.scenes.count }}</div>
    <div class="rw-stat-lbl mt-1">{% trans "سەحنە" %}</div>
  </div>
  {# more stats #}
</div>

{# Section rows #}
<div class="px-4 pb-4">
  {% for section in sections %}
  <div class="d-flex rw-sec-row">

    <a href="{{ section.url }}"
       class="rw-sec-label bg-rw-{{ section.color }}
              d-flex flex-column align-items-center justify-content-center gap-2 py-3">
      <svg ...>...</svg>
      <span class="rw-sec-label-text">{{ section.name }}</span>
    </a>

    <div class="rw-sec-modules flex-grow-1 d-flex flex-wrap">
      {% for mod in section.modules %}
      <a href="{{ mod.url }}"
         class="rw-mod-card d-flex flex-column align-items-center
                justify-content-center gap-2 py-4 px-3 text-decoration-none">
        <svg class="ico" style="color:var(--rw-{{ section.color }})">...</svg>
        <span class="rw-mod-name">{{ mod.name }}</span>
      </a>
      {% endfor %}
    </div>

  </div>
  {% endfor %}
</div>
```

---

### FORM / EDIT — data entry
**When:** create project, edit shot, settings, invite member  
**Key:** max-width container, never full-width on desktop
```html
{% block content %}
<div id="rw-content" class="flex-grow-1 overflow-auto p-4 p-lg-5">
  <div style="max-width:640px;margin:0 auto">

    <div class="rw-section-hdr mb-4">{% trans "زانیاری بنەڕەتی" %}</div>

    <form method="post" hx-post="{% url 'app:save' %}"
          hx-target="#rw-content" hx-swap="outerHTML">
      {% csrf_token %}

      <div class="mb-3">
        <label class="rw-form-label">{% trans "ناوی پڕۆژە" %}</label>
        <input class="rw-form-input" type="text" name="title"
               value="{{ form.title.value|default:'' }}"
               placeholder="{% trans 'ناوی پڕۆژەکەت بنووسە...' %}">
      </div>

      <div class="d-flex gap-2 mt-4">
        <button type="submit" class="rw-btn rw-btn-primary">
          {% trans "پاشەکەوتکردن" %}
        </button>
        <a href="{{ cancel_url }}" class="rw-btn rw-btn-ghost">
          {% trans "هەڵوەشاندنەوە" %}
        </a>
      </div>
    </form>

  </div>
</div>
{% endblock %}
```

---

## 5. Component Quick Reference

### Buttons
```html
{# Primary — create, save, confirm #}
<button class="rw-btn rw-btn-primary">+ {% trans "زیادکردن" %}</button>

{# Amber — export, publish, highlight action #}
<a class="rw-btn rw-btn-amber" href="...">↗ {% trans "دەرهێنان" %}</a>

{# Ghost — secondary, cancel, back #}
<button class="rw-btn rw-btn-ghost">← {% trans "گەڕانەوە" %}</button>

{# AI — async AI jobs only #}
<button class="rw-btn rw-btn-ai"
        hx-post="{% url 'ai_engine:job' %}" hx-indicator="#spin">
  🤖 {% trans "AI داڕشتن" %}
</button>

{# Size modifiers #}
.rw-btn-sm   → padding: 5px 12px; font-size: 12px
.rw-btn-lg   → padding: 12px 24px; font-size: 14px
```

### Badges
```html
.rw-badge-ok    → green  — active, complete, success
.rw-badge-warn  → amber  — pending, waiting, draft
.rw-badge-err   → pink   — blocked, error, critical
.rw-badge-mute  → grey   — inactive, disabled, closed
.rw-badge-plan  → purple — review, decision, annotation
.rw-badge-d     → yellow — dialogue shot type
.rw-badge-v     → grey   — visual/action shot type
.rw-badge-i     → blue   — insert shot type
```

### Card accents (left border)
```html
.rw-card-script → --rw-script orange  (Write)
.rw-card-break  → --rw-break blue     (Breakdown)
.rw-card-vis    → --rw-vis teal       (Visualize)
.rw-card-plan   → --rw-plan purple    (Plan)
.rw-card-shoot  → --rw-shoot pink     (Shoot)
.rw-card-amber  → --rw-amber          (AI, warning, highlight)
```

### Section colours
```
--rw-script  #FF6B35  Write / دەستنووس
--rw-break   #2D5BE3  Breakdown / داڕشتن
--rw-vis     #00A896  Visualize / بینراوکردن
--rw-plan    #7C3AED  Plan / ڕێنوێس
--rw-shoot   #F72585  Shoot / وێنەگرتن
```

---

## 6. RTL Rules

| Rule | Implementation |
|---|---|
| Logical margins | `margin-inline-start` / `margin-inline-end` |
| Logical borders | `border-inline-start` / `border-inline-end` |
| Logical position | `inset-inline-start` / `inset-inline-end` |
| Text align | `text-align: start` (not `left`) |
| English in Kurdish | `<bdi dir="ltr" class="rw-font-en">85mm</bdi>` |
| Shot numbers | Always `dir="ltr"` — `12.3A` is industry format, never translate |
| Timestamps | Always `dir="ltr"` — `2026-05-07 14:30` |
| Rail position | First child of `.rw-app` — BS5 RTL handles placement |
| MS-auto | `ms-auto` (BS5) works correctly in both LTR and RTL |

---

## 7. HTMX Patterns

### Filter → replace list body
```html
<button class="rw-f-btn active"
        hx-get="?filter=all"
        hx-target="#list-body"
        hx-swap="innerHTML"
        hx-push-url="true">
  {% trans "هەموو" %}
</button>
<div id="list-body">...</div>
```

### Inline row edit (shot table)
```html
{# Read row — click to edit #}
<tr class="rw-tbl-row"
    hx-get="{% url 'shots:edit_row' shot.pk %}"
    hx-target="closest tr"
    hx-swap="outerHTML">
  <td class="px-3 py-2"><span class="rw-shot-num">{{ shot.number }}</span></td>
</tr>

{# Edit row — saves and swaps back #}
<tr>
  <td colspan="99" class="px-3 py-3">
    <form hx-post="{% url 'shots:save' shot.pk %}"
          hx-target="closest tr"
          hx-swap="outerHTML">
      {% csrf_token %}
      {{ form.as_div }}
      <div class="d-flex gap-2 mt-2">
        <button type="submit" class="rw-btn rw-btn-primary rw-btn-sm">{% trans "پاشەکەوتکردن" %}</button>
        <button hx-get="{% url 'shots:read_row' shot.pk %}"
                hx-target="closest tr" hx-swap="outerHTML"
                class="rw-btn rw-btn-ghost rw-btn-sm">{% trans "هەڵوەشاندنەوە" %}</button>
      </div>
    </form>
  </td>
</tr>
```

### AI job with progress indicator
```html
<button class="rw-btn rw-btn-ai"
        hx-post="{% url 'ai_engine:breakdown' scene.pk %}"
        hx-target="#ai-result"
        hx-indicator="#ai-spinner">
  🤖 {% trans "AI داڕشتنی ئۆتۆماتیکی" %}
</button>

<div id="ai-spinner" class="htmx-indicator px-3 py-2"
     style="font-size:12px;color:var(--rw-amber)">
  ⟳ {% trans "AI کاردەکات..." %}
</div>

<div id="ai-result"></div>
```

### Modal load via HTMX
```html
{# Trigger #}
<button class="rw-btn rw-btn-primary"
        hx-get="{% url 'projects:create_modal' %}"
        hx-target="#rw-modal-container"
        hx-swap="innerHTML">
  + {% trans "پڕۆژەی نوێ" %}
</button>

{# In _modal.html partial — wraps BS5 modal #}
<div class="modal fade show d-block" tabindex="-1">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title fw-bold">{% trans "پڕۆژەی نوێ" %}</h5>
        <button class="btn-close" onclick="document.getElementById('rw-modal-container').innerHTML=''"></button>
      </div>
      <div class="modal-body">{{ form.as_div }}</div>
      <div class="modal-footer">
        <button class="rw-btn rw-btn-ghost"
                onclick="document.getElementById('rw-modal-container').innerHTML=''">
          {% trans "هەڵوەشاندنەوە" %}
        </button>
        <button class="rw-btn rw-btn-primary"
                hx-post="{% url 'projects:create' %}"
                hx-target="#rw-content">
          {% trans "دروستکردن" %}
        </button>
      </div>
    </div>
  </div>
</div>
<div class="modal-backdrop fade show"
     onclick="document.getElementById('rw-modal-container').innerHTML=''"></div>
```

---

## 8. Mobile Behaviour

| Breakpoint | Rail | Scene Panel | Tables |
|---|---|---|---|
| `≥992px` (lg) | Left/right rail 60px | Visible 240px | Full |
| `768px–991px` (md) | Left/right rail 60px | Collapsed (hidden) | Scroll |
| `<768px` (sm) | **Fixed bottom tab bar** 60px height | Hidden (offcanvas) | Scroll |
| `<480px` (xs) | Bottom bar | Hidden | Scroll, 1-col stats |

**Mobile rail** becomes a horizontal bottom tab bar. The top 5 most important icons show. Logo is hidden — shown in topnav on mobile instead.

---

## 9. Anti-Patterns — Never Do This

```
❌  style="margin-left:16px"         →  use ms-3 (BS5) or margin-inline-start
❌  style="display:flex;gap:8px"     →  use d-flex gap-2
❌  style="border-left:3px solid"    →  use border-inline-start
❌  <p style="color:#D4A574">        →  use class="text-rw-amber"
❌  <span style="font-size:10px;font-weight:700;text-transform:uppercase">  →  use class="rw-overline"
❌  Bootstrap .btn-primary            →  use .rw-btn.rw-btn-primary
❌  Emoji as icons (🏠, 📋, ⚙)     →  use SVG glyphs from icon system
❌  Inline hex colours               →  use var(--rw-*) tokens
❌  Custom grid in CSS               →  use BS5 row/col or auto-fill grid
❌  Hardcoded English text in Kurdish template  →  use {% trans "..." %}
❌  text-align:left inside RTL area  →  use text-align:start
```

---

## 10. Icon SVG Library

Copy-paste ready. All 28×28px, `class="ico"`, `viewBox="0 0 24 24"`.

### Projects — Film frame
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <rect x="2" y="4" width="20" height="16" rx="1"/>
  <line x1="2" y1="8" x2="22" y2="8"/><line x1="2" y1="16" x2="22" y2="16"/>
  <line x1="6" y1="4" x2="6" y2="8"/><line x1="10" y1="4" x2="10" y2="8"/>
  <line x1="14" y1="4" x2="14" y2="8"/><line x1="18" y1="4" x2="18" y2="8"/>
  <line x1="6" y1="16" x2="6" y2="20"/><line x1="10" y1="16" x2="10" y2="20"/>
  <line x1="14" y1="16" x2="14" y2="20"/><line x1="18" y1="16" x2="18" y2="20"/>
</svg>
```

### Script — Clapperboard
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <path d="M4 6l16-3v4H4z"/>
  <rect x="2" y="7" width="20" height="14" rx="1"/>
  <line x1="7" y1="3.5" x2="5" y2="7"/><line x1="11" y1="2.7" x2="9" y2="7"/>
  <line x1="15" y1="1.9" x2="13" y2="7"/><line x1="19" y1="1.1" x2="17" y2="7"/>
</svg>
```

### Shot List — Viewfinder
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <circle cx="12" cy="12" r="9"/>
  <circle cx="12" cy="12" r="3"/>
  <line x1="12" y1="3" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="21"/>
  <line x1="3" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/>
</svg>
```

### Storyboard — Frame grid
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <rect x="2" y="2" width="9" height="7" rx="1"/><rect x="13" y="2" width="9" height="7" rx="1"/>
  <rect x="2" y="11" width="9" height="7" rx="1"/><rect x="13" y="11" width="9" height="7" rx="1"/>
  <line x1="5" y1="20" x2="19" y2="20"/>
</svg>
```

### Floor Plan
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <rect x="3" y="3" width="18" height="18" rx="1"/>
  <line x1="3" y1="10" x2="21" y2="10"/>
  <line x1="10" y1="10" x2="10" y2="21"/>
  <circle cx="6.5" cy="6.5" r="1.5"/><circle cx="16" cy="16" r="1.5"/>
</svg>
```

### Schedule — Film reel
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <circle cx="12" cy="12" r="9"/>
  <circle cx="12" cy="12" r="2.5"/>
  <circle cx="12" cy="5.5" r="1.5"/><circle cx="12" cy="18.5" r="1.5"/>
  <circle cx="5.5" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/>
  <circle cx="7.7" cy="7.7" r="1.5"/><circle cx="16.3" cy="16.3" r="1.5"/>
  <circle cx="16.3" cy="7.7" r="1.5"/><circle cx="7.7" cy="16.3" r="1.5"/>
</svg>
```

### Team — People
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <circle cx="9" cy="7" r="3"/>
  <path d="M3 21v-1a6 6 0 0 1 12 0v1"/>
  <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-1a4 4 0 0 0-3-3.85"/>
</svg>
```

### Locations — Pin
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
  <circle cx="12" cy="9" r="2.5"/>
</svg>
```

### Reviews — Check frame
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <path d="M9 11l3 3L22 4"/>
  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
</svg>
```

### Community — Chat bubble
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
</svg>
```

### Settings — Aperture
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <circle cx="12" cy="12" r="9"/>
  <circle cx="12" cy="12" r="3.5"/>
  <line x1="12" y1="3" x2="12" y2="8.5"/><line x1="12" y1="15.5" x2="12" y2="21"/>
  <line x1="3" y1="12" x2="8.5" y2="12"/><line x1="15.5" y1="12" x2="21" y2="12"/>
  <line x1="5.6" y1="5.6" x2="9.4" y2="9.4"/><line x1="14.6" y1="14.6" x2="18.4" y2="18.4"/>
  <line x1="18.4" y1="5.6" x2="14.6" y2="9.4"/><line x1="9.4" y1="14.6" x2="5.6" y2="18.4"/>
</svg>
```

### Notifications — Bell
```html
<svg width="28" height="28" viewBox="0 0 24 24" class="ico">
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
</svg>
```

---

## 11. Modals

Always loaded via HTMX into `#rw-modal-container` — never pre-rendered.

### Variants
| Class | Top border | Use for |
|---|---|---|
| `.rw-modal` | amber | Default — forms, create, edit |
| `.rw-modal.rw-modal-danger` | pink | Destructive — delete, revoke |
| `.rw-modal.rw-modal-sm` | amber | Confirm, quick prompt (max-width 380px) |
| `.rw-modal.rw-modal-lg` | amber | Large forms, multi-column (max-width 740px) |

### Trigger pattern
```html
<button class="rw-btn rw-btn-primary"
        hx-get="{% url 'app:create_modal' %}"
        hx-target="#rw-modal-container"
        hx-swap="innerHTML">
  + {% trans "زیادکردن" %}
</button>
```

### Modal partial skeleton
```html
{# app/_modal_create.html #}
<div class="rw-modal-backdrop"
     hx-on:click="if(event.target===this) document.getElementById('rw-modal-container').innerHTML=''">
  <div class="rw-modal [rw-modal-sm|rw-modal-lg|rw-modal-danger]"
       onclick="event.stopPropagation()">

    <div class="rw-modal-header">
      <span class="rw-modal-title">{% trans "TITLE" %}</span>
      <button class="rw-modal-close"
              onclick="document.getElementById('rw-modal-container').innerHTML=''">✕</button>
    </div>

    <div class="rw-modal-body">
      <form hx-post="{% url 'app:save' %}"
            hx-target="#rw-content"
            hx-swap="outerHTML">
        {% csrf_token %}
        {# form fields #}
      </form>
    </div>

    <div class="rw-modal-footer">
      <button class="rw-btn rw-btn-ghost"
              onclick="document.getElementById('rw-modal-container').innerHTML=''">
        {% trans "هەڵوەشاندنەوە" %}
      </button>
      <button class="rw-btn rw-btn-primary" form="...">{% trans "پاشەکەوتکردن" %}</button>
    </div>

  </div>
</div>
```

### Close on success (Django view)
```python
# Option A — redirect (full page)
response = HttpResponse(status=204)
response['HX-Redirect'] = project.get_absolute_url()
return response

# Option B — OOB swap to clear modal + refresh list
return render(request, 'app/_row.html', {'item': item, 'close_modal': True})
# In template: {% if close_modal %}
# <div id="rw-modal-container" hx-swap-oob="innerHTML"></div>
# {% endif %}
```

---

## 12. Toasts & Alerts

### Toasts — transient floating notifications

```html
{# In base.html — container already present #}
<div id="rw-toast-container" class="rw-toast-container"></div>
```

```python
# Django view — inject toast via OOB in any HTMX response
# Append to any partial template that HTMX loads:
```

```html
{# At bottom of any HTMX partial — fires a toast OOB #}
{% if toast %}
<div id="rw-toast-container" hx-swap-oob="afterbegin">
  <div class="rw-toast t-{{ toast.type }}"
       x-init="setTimeout(() => $el.remove(), 4200)">
    <span class="rw-toast-icon">
      {% if toast.type == 'ok' %}✓{% elif toast.type == 'err' %}✕{% else %}⚠{% endif %}
    </span>
    <div class="rw-toast-body">
      <div class="rw-toast-title">{{ toast.title }}</div>
      <div class="rw-toast-msg">{{ toast.msg }}</div>
    </div>
    <button class="rw-toast-close"
            onclick="this.closest('.rw-toast').remove()">✕</button>
    <div class="rw-toast-bar"></div>
  </div>
</div>
{% endif %}
```

```python
# views.py helper — pass toast context dict
def save_shot(request, pk):
    ...
    return render(request, 'shots/_row.html', {
        'shot': shot,
        'toast': {'type': 'ok', 'title': 'تەواوبوو', 'msg': 'شاتەکە پاشەکەوت کرا'}
    })
```

Toast types: `t-ok` (teal) · `t-warn` (amber) · `t-err` (pink) · `t-info` (blue)

### Alerts — inline persistent messages

```html
{# Use inside content areas, not for transient feedback #}
<div class="rw-alert rw-alert-[ok|warn|err|info]">
  <span class="rw-alert-icon">⚠</span>
  <div class="rw-alert-text">
    <div class="rw-alert-title">{% trans "ناوی ئاگادارکردن" %}</div>
    {% trans "دەقی ئاگادارکردن لێرەدا" %}
  </div>
</div>
```

---

## 13. Wizards — Multi-Step Forms

For: new project creation, script upload, team invite.

```python
# urls.py
path('projects/new/<int:step>/', views.project_wizard, name='project_wizard'),

# views.py
WIZARD_STEPS = ['basics', 'script', 'modules', 'team']

def project_wizard(request, step=1):
    if request.method == 'POST':
        request.session[f'wizard_{step}'] = request.POST.dict()
        if step == len(WIZARD_STEPS):
            project = build_project_from_session(request.session)
            response = HttpResponse(status=204)
            response['HX-Redirect'] = project.get_absolute_url()
            return response
        response = render(request, f'projects/wizard/_step_{step+1}.html',
                          {'step': step + 1, 'total': len(WIZARD_STEPS)})
        response['HX-Trigger'] = json.dumps({'wizardStep': step + 1})
        return response
    return render(request, f'projects/wizard/_step_{step}.html',
                  {'step': step, 'total': len(WIZARD_STEPS)})
```

```html
{# Wizard shell — projects/wizard/shell.html #}
<div class="rw-wizard-bar">
  {% for i, label in steps_list %}
  <div class="rw-wiz-step
              {% if i < step %}done{% elif i == step %}active{% endif %}">
    <div class="rw-wiz-num">{% if i < step %}✓{% else %}{{ i }}{% endif %}</div>
    {{ label }}
  </div>
  {% if not forloop.last %}<div class="rw-wiz-connector"></div>{% endif %}
  {% endfor %}
</div>

<div id="rw-wiz-body">
  {% include step_template %}
</div>

<div class="rw-wizard-footer">
  {% if step > 1 %}
  <button class="rw-btn rw-btn-ghost"
          hx-get="{% url 'projects:wizard' step|add:'-1' %}"
          hx-target="#rw-wiz-body">← {% trans "پێشوو" %}</button>
  {% endif %}
  <div class="flex-grow-1 text-center" style="font-size:12px;color:var(--rw-text-3)">
    {% trans "هەنگاو" %} {{ step }} {% trans "لە" %} {{ total }}
  </div>
  <button class="rw-btn rw-btn-primary"
          hx-post="{% url 'projects:wizard' step %}"
          hx-target="#rw-wiz-body"
          hx-include="closest form">
    {% if step == total %}{% trans "دروستکردن" %}{% else %}{% trans "دواتر" %} →{% endif %}
  </button>
</div>
```

---

## 14. Loaders — AI is a First-Class Citizen

**Rule: never show a blank area while waiting.** Always choose the appropriate loader.

| Variant | Class | When to use |
|---|---|---|
| Inline spinner | `.rw-spin` | Inside buttons, next to loading labels |
| Progress bar | `.rw-progress-bar` | Top of content area, inside AI block |
| Skeleton | `.rw-skel` | Replace content shapes while loading |
| AI thinking | `.rw-ai-thinking` | Celery AI jobs with step tracking |
| Full backdrop | `.rw-loader-backdrop` | Page-level blocking (export, bulk AI) |

### 1. Inline spinner — in buttons
```html
<button class="rw-btn rw-btn-ai d-flex align-items-center gap-2"
        hx-post="{% url 'ai_engine:breakdown' scene.pk %}"
        hx-target="#breakdown-result"
        hx-indicator="#spin-{{ scene.pk }}">
  <span id="spin-{{ scene.pk }}"
        class="rw-spin rw-spin-sm htmx-indicator"
        style="border-color:rgba(212,165,116,.2);border-top-color:var(--rw-amber)"></span>
  🤖 {% trans "AI داڕشتن" %}
</button>
```

Modifier classes: `.rw-spin-sm` · `.rw-spin-lg` · `.rw-spin-pink` · `.rw-spin-vis` · `.rw-spin-plan`

### 2. Indeterminate progress bar — top of content
```html
{# Sticky at top of #rw-content, auto-shown by HTMX #}
<div id="page-bar"
     class="rw-progress-bar rw-progress-indeterminate htmx-indicator"
     style="position:sticky;top:0;z-index:50">
  <div class="rw-progress-fill"></div>
</div>
```

### 3. Skeleton — same shape as final content
```html
{# Place in HTMX target — replaced by real content on response #}
<div id="shot-list">
  {% include "components/_skeleton_table.html" %}
</div>
{# _skeleton_table.html — rows of .rw-skel divs matching table column widths #}
```

### 4. AI thinking block — Celery job tracker
```html
{# Returned by view when AI job starts; polls itself every 2s #}
<div class="rw-ai-thinking"
     hx-get="{% url 'ai_engine:job_status' task_id %}"
     hx-trigger="every 2s"
     hx-target="this"
     hx-swap="outerHTML">

  <div class="rw-ai-thinking-header">
    <div class="rw-ai-pulse">
      <span></span><span></span><span></span>
    </div>
    AI دەهوڕێت — {{ job_label }}
  </div>

  <div class="rw-progress-bar rw-progress-indeterminate">
    <div class="rw-progress-fill"></div>
  </div>

  <div class="rw-ai-step-list">
    {% for step in steps %}
    <div class="rw-ai-step {{ step.status }}">
      <div class="rw-ai-step-dot"></div>
      {{ step.label }}
    </div>
    {% endfor %}
  </div>

</div>
```

```python
# views.py — job status endpoint
def ai_job_status(request, task_id):
    result = AsyncResult(task_id)
    steps = get_job_steps(task_id)  # from cache/DB
    if result.ready():
        # Job done — return real content instead of thinking block
        return render(request, 'ai/_breakdown_result.html', {'scene': ...})
    return render(request, 'ai/_thinking.html',
                  {'task_id': task_id, 'steps': steps, 'job_label': '...'})
```

Step status values: `done` · `active` · *(none = pending)*

### 5. Full backdrop — page-level blocking
```html
<button class="rw-btn rw-btn-amber"
        hx-post="{% url 'exports:scene_html' scene.pk %}"
        hx-indicator="#export-backdrop">
  ↗ {% trans "دەرهێنانی HTML" %}
</button>

<div id="export-backdrop" class="rw-loader-backdrop htmx-indicator">
  <div class="rw-loader-ring"></div>
  <div class="rw-loader-label">{% trans "HTML دەرهێندرێت..." %}</div>
  <div class="rw-loader-sub">{% trans "ئەمە چەند چرکەیەک دەخاتە سەر" %}</div>
</div>
```

### HTMX indicator CSS (already in rwanga-ds.css)
```css
.htmx-indicator                 { display: none !important; }
.htmx-request .htmx-indicator  { display: flex  !important; }
.htmx-request.htmx-indicator   { display: flex  !important; }
.rw-progress-bar.htmx-indicator { display: block !important; }
.rw-loader-backdrop.htmx-indicator { display: flex !important; }
```

---

*Last updated: May 2026 — Rwanga Design System v1.0*
