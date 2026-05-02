# Design Audit — Compare Original Templates vs Implemented

> **For: Claude Design Agent**
> **Owner: Darya Ibrahim**
> **Date: 2026-05-02**

---

## What You're Doing

You designed all the templates in `rwanga-design-kit/templates/`. An engineering agent then implemented them into the Django app at `E:/api/rwanga/src/`. The implementation has drifted significantly from your originals — wrong classes, missing styles, different fonts, misplaced elements, wrong libraries, broken patterns.

Your job: **audit every implemented template against your original design** and produce a detailed fix report that we hand directly to the engineering agent.

---

## How To Do It

### Step 1 — Read Your Originals

Your design templates are in:
```
rwanga-design-kit/templates/
├── base.html
├── components/_topnav.html, _sidebar.html, _modal.html, _empty_state.html, _breadcrumb.html, _toast.html
├── projects/list.html, dashboard.html, scene_view.html, settings.html, create_wizard.html, _scene_list.html
├── accounts/login.html, register.html, profile.html, settings.html, contacts.html, team.html
├── scripts/index.html, upload.html, breakdown.html, docs.html, elements.html
├── locations/list.html
├── shots/list.html, storyboards.html
├── scheduling/index.html, stripboard.html, call_sheets.html
├── notifications/panel.html
├── progress/dashboard.html, tasks.html, task_detail.html, updates.html, gaps.html, etc.
├── exports/call_sheet_template.html, shot_list_template.html, scene_viewer_export.html, etc.
└── reviews/ and community/ (newly designed)
```

Your CSS is in:
```
rwanga-design-kit/static/css/rwanga.css
```

### Step 2 — Read The Implementations

The engineering agent's implemented templates are in the Django app:
```
E:/api/rwanga/src/
├── templates/          ← base.html, components/ (shared templates)
├── projects/templates/projects/
├── accounts/templates/accounts/
├── scripts/templates/scripts/
├── locations/templates/locations/
├── reviews/templates/reviews/
├── community/templates/community/
├── shots/templates/shots/
├── scheduling/templates/scheduling/
├── notifications/templates/notifications/
├── progress/templates/progress/
└── static/css/         ← implemented CSS
```

### Step 3 — Compare and Report

For EVERY template pair (original vs implemented), check:

1. **HTML structure** — Does the implemented version match your DOM hierarchy? Are elements in the right order? Are containers, wrappers, and sections preserved?

2. **CSS classes** — Does it use your exact class names (`rw-btn`, `rw-badge-amber`, `rw-mod-card`, `rw-topnav`, `rw-sec-tab`, etc.)? Or did the agent use different/made-up class names? List every class mismatch.

3. **CSS variables** — Does it use your design tokens (`--rw-bg`, `--rw-surface`, `--rw-text`, `--rw-primary`, `--rw-border`, `--rw-r`, `--rw-pad-lg`, etc.)? Or are there hardcoded colors, sizes, fonts?

4. **Font** — Is Cairo loaded and applied? Is the RTL direction correct? Are logical properties used (`margin-inline-start` not `margin-left`)?

5. **Dark mode** — Do all colors go through CSS variables so dark mode works? Or are there hardcoded `#fff`, `#000`, `rgb()` values that break in dark mode?

6. **Libraries** — Is it using Bootstrap 5.3.3 RTL CSS + Bundle JS from local vendor? Or is it loading from CDN, loading wrong version, or loading BS4?

7. **HTMX patterns** — Do modals use `#rw-modal-container` + `htmx:afterSwap`? Do inline actions use `hx-post`/`hx-target`/`hx-swap`? Or did the agent use different patterns?

8. **Component includes** — Does it use `{% include "components/_topnav.html" %}`, `{% include "components/_sidebar.html" %}` etc? Or are components inlined/duplicated?

9. **Django template tags** — Are `{% trans %}` tags used for Kurdish text? Or is text hardcoded in English?

10. **Empty states** — Do they use your `_empty_state.html` component? Or are they raw text?

11. **Status badges** — Do they follow your badge pattern (`rw-badge-gray`, `rw-badge-amber`, `rw-badge-green`, `rw-badge-red`)? Or custom/different styles?

12. **Responsive / mobile** — Is the viewport meta tag correct? Does the layout break on mobile?

---

## Report Format

Produce a single markdown file with this structure:

```markdown
# Design Audit Report — [Date]

## Summary
- X templates audited
- Y have critical issues (broken layout, wrong structure)
- Z have moderate issues (wrong classes, missing styles)
- W are acceptable (minor differences only)

## Critical Issues (fix immediately)

### [template-name.html]
**Original:** rwanga-design-kit/templates/path/to/file.html
**Implemented:** src/app/templates/path/to/file.html

| Issue | Expected (Design) | Actual (Implemented) | Fix |
|-------|-------------------|---------------------|-----|
| Wrong class | `rw-btn rw-btn-primary` | `btn btn-primary` | Replace with design class |
| Hardcoded color | `var(--rw-primary)` | `#e91e8a` | Use CSS variable |
| Missing element | Sidebar badge count | Not present | Add badge span |
| ... | ... | ... | ... |

## Moderate Issues (fix in next round)
[same format]

## Minor Issues (nice to have)
[same format]

## CSS Diff
List any CSS classes used in your designs that are:
- Missing from the implemented rwanga.css
- Present but with different properties
- Duplicated or overridden incorrectly

## Missing Templates
List any templates you designed that were never implemented at all.
```

---

## Important Notes

- Be specific. "The styling is wrong" is useless. "Line 42: uses `class='btn btn-danger'` instead of `class='rw-btn rw-btn-red'`" is useful.
- Include file paths and line numbers where possible.
- The report goes directly to an engineering agent who will execute fixes mechanically — it needs to be unambiguous.
- Don't skip any template. Even if a page "looks close", check the classes and structure.
- Pay special attention to `base.html` — if the base template is wrong, everything inherits the problems.
- Check `rwanga.css` in the Django app against your original — are all your CSS rules present?

---

## Deliverable

Save the report to:
```
rwanga-design-kit/tasks/active/DESIGN-AUDIT-REPORT.md
```
