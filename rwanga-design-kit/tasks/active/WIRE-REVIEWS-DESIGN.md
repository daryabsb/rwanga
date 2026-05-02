# Wire Reviews & Community Design Templates

> **Context:** Claude Design has delivered 13 template files for the Reviews and Community sections, plus updated topnav, sidebar, and projects list. These templates are in `rwanga-design-kit/templates/`. The engineering agent must now replace the current basic templates with these designed versions and wire up any new URL names, context processors, and view changes.

> **Read first:** `rwanga-design-kit/specs/CLAUDE.md`, then skim the new template files to understand what context variables and URL names they expect.

> **Mode: NON-STOP.**

---

## Section 1 — Copy Design Templates

Copy the following from `rwanga-design-kit/templates/` to the Django app templates, replacing existing files:

```
rwanga-design-kit/templates/reviews/list.html       → src/reviews/templates/reviews/list.html
rwanga-design-kit/templates/reviews/detail.html      → src/reviews/templates/reviews/detail.html
rwanga-design-kit/templates/reviews/_decision_card.html → src/reviews/templates/reviews/_decision_card.html
rwanga-design-kit/templates/reviews/_evaluation_card.html → src/reviews/templates/reviews/_evaluation_card.html
rwanga-design-kit/templates/reviews/_create_modal.html → src/reviews/templates/reviews/_create_modal.html
rwanga-design-kit/templates/community/list.html      → src/community/templates/community/list.html
rwanga-design-kit/templates/community/detail.html    → src/community/templates/community/detail.html
rwanga-design-kit/templates/community/_comment_thread.html → src/community/templates/community/_comment_thread.html
rwanga-design-kit/templates/projects/list.html       → src/projects/templates/projects/list.html
rwanga-design-kit/templates/components/_topnav.html  → src/templates/components/_topnav.html (or wherever base template components live)
rwanga-design-kit/templates/components/_sidebar.html → src/templates/components/_sidebar.html
```

Check `{% extends %}` and `{% include %}` paths after copying. Adjust if the app template structure differs.

---

## Section 2 — Wire URL Names

The new templates expect these URL names. Verify they exist or create them:

### Reviews URLs (`src/reviews/urls.py`, namespace `reviews`):

```python
urlpatterns = [
    path('', ReviewListView.as_view(), name='list'),
    path('create/', ReviewCreateView.as_view(), name='create'),
    path('<uuid:pk>/', ReviewDetailView.as_view(), name='detail'),
    # Tab content (HTMX partials):
    path('<uuid:pk>/decisions/', decisions_tab, name='decisions_tab'),
    path('<uuid:pk>/evaluations/', evaluations_tab, name='evaluations_tab'),
    path('<uuid:pk>/comments/', comments_tab, name='comments_tab'),
    path('<uuid:pk>/bible/', bible_tab, name='bible_tab'),
    # Decision actions (HTMX POST):
    path('decisions/<uuid:pk>/lock/', lock_decision, name='lock_decision'),
    path('decisions/<uuid:pk>/reject/', reject_decision, name='reject_decision'),
    path('decisions/<uuid:pk>/repropose/', repropose_decision, name='repropose_decision'),
    # Create forms:
    path('<uuid:pk>/decisions/create/', create_decision, name='create_decision'),
    path('<uuid:pk>/evaluations/create/', create_evaluation, name='create_evaluation'),
]
```

### Community URLs (`src/community/urls.py`, namespace `community`):

```python
urlpatterns = [
    path('', SessionListView.as_view(), name='list'),
    path('create/', SessionCreateView.as_view(), name='create'),
    path('sessions/<uuid:pk>/', SessionDetailView.as_view(), name='detail'),
    path('sessions/<uuid:pk>/open/', open_session, name='open_session'),
    path('sessions/<uuid:pk>/close/', close_session, name='close_session'),
    path('sessions/<uuid:pk>/invite/', invite_participant, name='invite'),
    path('sessions/<uuid:pk>/content/add/', add_content, name='add_content'),
    path('sessions/<uuid:pk>/comments/', post_comment, name='post_comment'),
    path('comments/<uuid:pk>/reply/', reply_comment, name='reply_comment'),
    path('comments/<uuid:pk>/react/', react_comment, name='react_comment'),
]
```

Check each `{% url %}` in the new templates against these. If a URL name doesn't match, either rename the URL or fix the template reference.

---

## Section 3 — Context Processors

The new topnav and sidebar expect these variables in every request context. Create or update a context processor:

```python
# src/core/context_processors.py (or wherever your processors live)

def navigation_context(request):
    """Provide nav_mode and badge counts for topnav/sidebar."""
    ctx = {}
    
    if not request.user.is_authenticated:
        return ctx
    
    # Determine nav_mode based on current URL
    path = request.path
    if '/reviews/' in path:
        ctx['nav_mode'] = 'reviews'
    elif '/community/' in path:
        ctx['nav_mode'] = 'community'
    else:
        ctx['nav_mode'] = 'project'
    
    # Badge counts for sidebar
    from src.reviews.models import ReviewDecision
    from src.community.models import ReviewSession
    
    ctx['pending_decisions_count'] = ReviewDecision.objects.filter(
        status='proposed'
    ).count()
    
    ctx['active_sessions_count'] = ReviewSession.objects.filter(
        status='open'
    ).count()
    
    return ctx
```

Register it in `settings.py`:
```python
TEMPLATES[0]['OPTIONS']['context_processors'].append(
    'src.core.context_processors.navigation_context'
)
```

---

## Section 4 — View Context Updates

### Projects list view
Add review and community counts to the context:

```python
# In ProjectListView.get_context_data():
from src.reviews.models import BibleReview
from src.community.models import ReviewSession

ctx['active_reviews_count'] = BibleReview.objects.filter(
    project__members=self.request.user
).exclude(status='delivered').count()

ctx['active_sessions_count'] = ReviewSession.objects.filter(
    project__members=self.request.user,
    status='open'
).count()
```

### Reviews detail view
The detail template has 4 tabs loaded via HTMX. Each tab needs a view that returns the partial:

```python
def decisions_tab(request, pk):
    review = get_object_or_404(BibleReview, pk=pk)
    decisions = review.decisions.all().order_by('-created_at')
    return render(request, 'reviews/_decisions_list.html', {
        'decisions': decisions, 'review': review
    })
```

Same pattern for evaluations_tab, comments_tab, bible_tab.

---

## Section 5 — CSS Check

The new templates may reference CSS classes not yet in `rwanga.css`. Check for:
- `.rw-review-card` — review list card style
- `.rw-decision-card` — decision card in detail view
- `.rw-tension-bar` — tension score visual bar
- `.rw-tab-bar` — tab navigation in review detail
- `.rw-comment-thread` — threaded comment styles
- `.rw-badge-purple`, `.rw-badge-teal` — review/community badge colors
- `.rw-tile-reviews`, `.rw-tile-community` — dashboard tiles

If these classes are defined inline in the templates, extract them to `rwanga.css` or a new `rwanga-reviews.css` and include it in `base.html`.

---

## Validation

```bash
python manage.py check
python manage.py runserver 0.0.0.0:8020

# All these must return 200 with the new designs:
# /reviews/                    → review list with filter, cards, new button
# /reviews/create/             → modal or create page
# /reviews/<pk>/               → 4-tab detail (decisions, evaluations, comments, bible)
# /community/                  → session grid with filter
# /community/create/           → create page
# /community/sessions/<pk>/    → two-column detail
# /projects/                   → must show reviews + community tiles below project cards

# Topnav: when on /reviews/, should show secondary nav with 3 tabs
# Sidebar: review and community icons should have badge counts
```

---

## Progress Updates

Update Progress tasks after completion:
- Reviews UI redesign → completed
- Community UI redesign → completed  
- Navigation + context processors → completed
