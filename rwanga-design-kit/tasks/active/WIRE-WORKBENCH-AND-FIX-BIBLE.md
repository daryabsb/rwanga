# Wire Review Workbench into UI + Deploy Bible Viewer Fix

> **Priority:** HIGH — the review workbench is unreachable from the UI. Sarwar can't get to it without typing the URL manually.
> **Mode: NON-STOP.**

---

## Problem

1. **The workbench is not wired into the navigation.** There is no "پێداچوونەوە" (Review) tab in the project topnav, and no review card on the project dashboard. The old review detail page is still the default route.

2. **The bible tab dumps raw JSON.** The workbench's bible tab (Tab 3) was rendering `{{ review.content|safe }}` as raw JSON text. This has been fixed in the design-kit source templates — the new version uses `{{ review.content|json_script:"bb-data" }}` and a JS parser that renders the content as formatted sections.

3. **Template comments leak into UI.** Multiline `{# ... #}` comments are not supported by Django and leak into the rendered HTML. The review templates now use `{% comment %}{% endcomment %}` blocks instead.

---

## What to do

### Task 1 — Deploy updated templates (verbatim copy)

Copy these files from `rwanga-design-kit/templates/` to `src/reviews/templates/reviews/`:

| Source | Destination |
|--------|-------------|
| `reviews/workbench.html` | `src/reviews/templates/reviews/workbench.html` |
| `reviews/chain_viewer.html` | `src/reviews/templates/reviews/chain_viewer.html` |
| `reviews/summary_pdf.html` | `src/reviews/templates/reviews/summary_pdf.html` |

Also copy the topnav:

| Source | Destination |
|--------|-------------|
| `components/_topnav.html` | `src/templates/components/_topnav.html` |

**Rules:** Copy verbatim. Do not modify any CSS, HTML, JS, Kurdish text, or URL tags. The URL tags have already been updated to use namespaced routes (`projects:review_workbench`, `projects:review_chain`, `reviews:lock-decision`, `reviews:reject-decision`).

### Task 2 — Add `latest_review` to project context

The topnav's new Review tab uses `active_project.latest_review`. Add a property or annotation so this is available:

**Option A — Model property (preferred):**
In `src/projects/models.py`, add to the `Project` model:

```python
@property
def latest_review(self):
    """Return the most recent BibleReview for this project."""
    return self.bible_reviews.order_by('-created_at').first()
```

Make sure the `BibleReview` model has `related_name='bible_reviews'` on its project FK. If it uses a different related_name, update the property to match.

**Option B — Context processor:**
If the topnav doesn't have `active_project` as a model instance (e.g., it's a dict), add `latest_review` to the context in the project middleware or context processor.

### Task 3 — Wire the workbench as the default review entry

The workbench URL should be the primary review page. Make sure:

1. `projects/urls.py` has the workbench route:
   ```python
   path('<int:project_id>/reviews/<int:review_id>/workbench/',
        views.review_workbench, name='review_workbench'),
   ```

2. Any old "review detail" URL that shows the raw review content should redirect to the workbench:
   ```python
   # If there's an old review_detail view, redirect it:
   def review_detail(request, project_id, review_id):
       return redirect('projects:review_workbench', project_id=project_id, review_id=review_id)
   ```

3. The workbench view must pass these context variables:
   ```python
   context = {
       'review': review,                    # BibleReview instance
       'project': project,                  # Project instance
       'active_decisions': review.decisions.filter(status='proposed'),
       'locked_decisions': review.decisions.filter(status='locked'),
       'active_section': 'r',               # NEW — tells topnav which tab is active
   }
   ```
   The `active_section = 'r'` is important — it highlights the Review tab in the topnav.

### Task 4 — Fix multiline `{# #}` comments in deployed templates

Check ALL templates in `src/` for multiline `{# ... #}` comments (they leak into rendered HTML). Replace with `{% comment %}{% endcomment %}`:

```bash
# Find all affected files:
rg -l "\{#.*═" src/*/templates/ src/templates/
```

For each file, replace:
```
{# ════════════
   ...
   ════════════ #}
```
With:
```
{% comment %}
...
{% endcomment %}
```

Short single-line `{# inline comment #}` is fine — only multiline blocks need fixing.

---

## Verification

1. Go to any project's topnav → confirm "پێداچوونەوە" tab appears (only if project has a review)
2. Click the tab → should load the workbench at `/projects/<id>/reviews/<id>/workbench/`
3. Click the "بایبڵ" tab in the workbench → bible content should render as formatted sections with sidebar TOC, not raw JSON
4. Check page source → no `{# ═══` comment text should appear in the HTML output
5. `python manage.py check` should pass

---

## Agent prompt (copy-paste)

```
Read the task file at rwanga-design-kit/tasks/active/WIRE-WORKBENCH-AND-FIX-BIBLE.md and execute all 4 tasks in order. Deploy the updated templates verbatim from the design-kit, add the latest_review property, wire the workbench as the default review entry, and fix multiline template comments. Verify with manage.py check when done.
```
