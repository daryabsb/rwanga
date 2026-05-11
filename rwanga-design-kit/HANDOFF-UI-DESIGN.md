# Rwanga UI Redesign — Design Handoff Brief

> **For:** Claude Design (or a new Cowork agent session focused on UI/design system)
> **From:** The session that built the StudioBinder UI clone and designed the review system
> **Date:** 6 May 2026
> **Owner:** Darya Ibrahim (daryabsb@gmail.com)
> **Task:** Analyze `studiobinder-clone.html`, extract a design system, and create a component pattern library that can replace the current Django templates

---

## Context

Rwanga (ڕوانگە) is a Kurdish cinema preproduction platform (Django + HTMX + Bootstrap 5). The current UI works but looks prototype-grade. We built a StudioBinder-inspired UI clone that represents the target look and feel. Now we need to:

1. **Analyze** the clone HTML — identify every component, pattern, and design token
2. **Extract** a design system — colors, typography, spacing, component variants, states
3. **Fix** minor issues in the clone (any inconsistencies, accessibility gaps, responsive problems)
4. **Document** a pattern library that an engineering agent can use to rebuild Django templates

---

## The File to Analyze

**Path:** `rwanga-design-kit/prototypes/studiobinder-clone.html`

This is a single self-contained HTML file (~43KB) with:
- **Page 1: Home Dashboard** — project cards, stats, recent activity
- **Page 2: Project Overview** — scene list, character cards, location cards, project stats
- **Sidebar navigation** — collapsible, icons + labels, active states
- **Top navigation** — search, notifications, user menu
- **Dark/light mode** — CSS variable-based theming
- **RTL support** — Kurdish is RTL; the layout must work in both directions
- **Bootstrap 5 only** — zero custom layout CSS; all layout via BS5 utility classes

### Design Constraints
- **No custom CSS for layout.** BS5 flex/grid utilities only. Custom CSS is allowed ONLY for: design tokens (CSS variables), component skins (borders, shadows, colors), and animations.
- **RTL-first.** Use CSS logical properties (`margin-inline-start` not `margin-left`). BS5 RTL build is available.
- **HTMX-compatible.** Components will be loaded/swapped via HTMX. No React, no SPA.
- **Mobile-responsive.** Sidebar collapses, cards stack, tables scroll horizontally.

---

## What Already Exists

### Current CSS (`static/css/rwanga.css`)
The existing stylesheet has:
- CSS custom properties for colors, fonts, spacing
- Dark/light mode toggle
- RTL logical properties
- Component styles for: sidebar, topnav, cards, modals, tables, badges, toasts
- About 1200 lines — functional but grown organically, needs systematic cleanup

### Current Design Tokens (from `specs/design-plan.md`)
```
Primary:    #2563EB (blue)
Success:    #059669 (green)
Warning:    #D97706 (amber)
Danger:     #DC2626 (red)
Info:       #0891B2 (cyan)
Surface:    #1E293B (dark) / #FFFFFF (light)
Text:       #F1F5F9 (dark) / #1E293B (light)
Font:       Inter (UI), NotoSansArabic (Kurdish text)
```

### Review System Design Principles
The review system UI follows specific locked principles (from consultant sessions with Sarwar). Read `tasks/active/SESSION-MEMORY-PLATFORM-DESIGN.md` for the full context:
- Director Workbench with 3 tabs (Active / Locked / Full Bible)
- Bible ↔ Script toggle
- Decision chains visualized as trajectories (not tags)
- Expression types: emotional, behavioral, artistic, memory, broken
- Intensity levels: low, medium, peak, collapse

---

## What I Need From You

### Deliverable 1: Component Inventory
Go through `studiobinder-clone.html` and catalog every distinct component:
- Name, purpose, HTML structure
- Variants (sizes, states, themes)
- BS5 classes used
- Any custom CSS needed
- Screenshot/description of appearance

### Deliverable 2: Design Token Extraction
From the clone, extract the complete token set:
- Color palette (semantic names, not hex only)
- Typography scale (font sizes, weights, line heights)
- Spacing scale
- Border radii
- Shadow definitions
- Transition/animation values
- Dark mode overrides

### Deliverable 3: Pattern Library Document
A markdown document that an engineering agent reads to build Django templates:
- Each component as a reusable pattern
- HTML snippet (BS5 classes)
- When to use / when not to use
- Responsive behavior
- RTL considerations
- Accessibility notes (ARIA, keyboard, contrast)

### Deliverable 4: Minor Fixes
While analyzing, fix:
- Accessibility issues (contrast, ARIA labels, focus indicators)
- Responsive breakpoints that don't work
- Inconsistent spacing or alignment
- Any hardcoded values that should be tokens

---

## File Map

```
rwanga-design-kit/
├── prototypes/
│   └── studiobinder-clone.html    ← THE FILE TO ANALYZE
├── specs/
│   └── design-plan.md             ← Current design spec (reference)
├── static/
│   ├── css/rwanga.css              ← Current stylesheet (will be replaced)
│   └── js/rwanga.js                ← Current JS (keep)
├── tasks/active/
│   ├── SESSION-MEMORY-PLATFORM-DESIGN.md  ← Review system design principles
│   ├── MOBILE-RESPONSIVE-REDESIGN.md      ← Mobile issues (some fixed)
│   └── DESIGN-AUDIT-REPORT.md             ← Previous design audit findings
└── brand/
    ├── rwanga_letterhead_v01-1.png
    └── rwanga_letterhead_v01-2.png
```

---

## How to Start

1. Read this file (done)
2. Open `prototypes/studiobinder-clone.html` — view it, take screenshots, read the source
3. Read `specs/design-plan.md` for context on current tokens
4. Read `tasks/active/SESSION-MEMORY-PLATFORM-DESIGN.md` for review system context
5. Begin the component inventory
6. Deliver all 4 outputs as files in `rwanga-design-kit/design-system/` (create the folder)

Do NOT ask Darya clarifying questions about the design. Everything you need is in the files. If something is ambiguous, make the best design decision and note it — Darya will review.
