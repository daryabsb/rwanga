# Canonical Bible Lifecycle — Single Source of Truth

> **Context:** The bible is the single source of truth for a film project. It starts from the screenplay, gets reviewed across multiple rounds, and evolves with each review cycle. Currently, each `BibleReview` holds its own isolated `content` with no lineage — there's no canonical bible on the project, no snapshot inheritance, and locked decisions don't flow back into the bible. This task fixes that.

> **Priority:** HIGH — this is a core workflow issue. Without it, the review system is disconnected from the project's actual bible.

> **Read first:** `src/reviews/models.py`, `src/projects/models.py`, `src/reviews/services.py`

> **Mode: NON-STOP.**

---

## The Lifecycle

```
Script (uploaded at project creation)
    ↓ AI consultant generates bible from script
ProjectBible v0 (draft)
    ↓ consultant creates a review
BibleReview v1 (snapshots current bible into review.content)
    ↓ decisions proposed, locked/rejected by director
    ↓ review delivered → locked decisions applied
ProjectBible v1 (updated, bible_version increments)
    ↓ another review round
BibleReview v2 (snapshots v1 bible)
    ↓ decisions proposed, locked/rejected
    ↓ review delivered → locked decisions applied
ProjectBible v2 (updated)
    ↓ ... repeat as needed ...
ProjectBible vN (status=final) ← SINGLE SOURCE OF TRUTH for production
```

---

## Section 1 — Model Changes

### 1.1 — Add canonical bible fields to Project

In `src/projects/models.py`, add to the `Project` model:

```python
# Canonical Bible — the single source of truth
canonical_bible = models.JSONField(
    default=dict, blank=True,
    verbose_name='بایبڵی ڕەسمی',
    help_text='The current canonical bible content for this project'
)
bible_version = models.PositiveIntegerField(
    default=0,
    verbose_name='وەشانی بایبڵ',
    help_text='Increments each time a review is delivered and bible updated'
)
bible_status = models.CharField(
    max_length=20,
    choices=[
        ('empty', 'بەتاڵ'),           # No bible yet
        ('draft', 'پێشنووس'),         # Being worked on
        ('in_review', 'لە پێداچوونەوەدا'),  # Active review in progress
        ('final', 'کۆتایی'),          # Locked as source of truth — no more reviews
    ],
    default='empty',
    verbose_name='بارودۆخی بایبڵ',
)
bible_finalized_at = models.DateTimeField(
    null=True, blank=True,
    verbose_name='کاتی کۆتایی',
    help_text='When the bible was marked as final'
)
bible_finalized_by = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    null=True, blank=True,
    on_delete=models.SET_NULL,
    related_name='finalized_bibles',
    verbose_name='کۆتایی کراوە لەلایەن',
)
```

Run:
```bash
python manage.py makemigrations projects
python manage.py migrate
```

### 1.2 — Add snapshot fields to BibleReview

In `src/reviews/models.py`, add to `BibleReview`:

```python
# Snapshot of the canonical bible at the time this review was created
bible_snapshot_version = models.PositiveIntegerField(
    default=0,
    help_text='The bible_version this review was created from'
)
```

The existing `content` field already holds the bible content for this review. We'll use it as the working copy that the consultant modifies during the review. The `bible_snapshot_version` records which canonical version it branched from.

Run:
```bash
python manage.py makemigrations reviews
python manage.py migrate
```

---

## Section 2 — Service Layer Updates

Update `src/reviews/services.py`:

### 2.1 — Create review with snapshot

```python
@staticmethod
def create_review(project, author):
    """Create a new bible review, snapshotting the current canonical bible."""
    if project.bible_status == 'final':
        raise ValueError('بایبڵ کۆتایی کراوە — ناتوانرێت پێداچوونەوەی نوێ دروست بکرێت')
    
    # Snapshot the current canonical bible
    review = BibleReview.objects.create(
        project=project,
        author=author,
        status='draft',
        version=BibleReview.objects.filter(project=project).count() + 1,
        content=project.canonical_bible,  # snapshot
        bible_snapshot_version=project.bible_version,
    )
    
    # Update project bible status
    project.bible_status = 'in_review'
    project.save(update_fields=['bible_status'])
    
    return review
```

### 2.2 — Deliver review → update canonical bible

```python
@staticmethod
def deliver_review(review, delivered_by):
    """
    Deliver a review: the review's content becomes the new canonical bible.
    Locked decisions serve as the audit trail of why things changed.
    """
    project = review.project
    
    if project.bible_status == 'final':
        raise ValueError('بایبڵ کۆتایی کراوە')
    
    # The review's content (which the consultant has been updating
    # throughout the review process) becomes the new canonical bible
    project.canonical_bible = review.content
    project.bible_version += 1
    project.bible_status = 'draft'  # Ready for next review or finalization
    project.save(update_fields=['canonical_bible', 'bible_version', 'bible_status'])
    
    # Mark the review as delivered
    review.status = 'delivered'
    review.save(update_fields=['status'])
    
    return review
```

### 2.3 — Finalize bible

```python
@staticmethod
def finalize_bible(project, finalized_by):
    """
    Mark the project bible as final — no more reviews allowed.
    This is the single source of truth for production.
    """
    from django.utils import timezone
    
    # Check no active reviews
    active_reviews = BibleReview.objects.filter(
        project=project
    ).exclude(status__in=['delivered', 'draft'])
    
    if active_reviews.exists():
        raise ValueError('هێشتا پێداچوونەوەی چالاک هەیە — سەرەتا تەواو بکە')
    
    project.bible_status = 'final'
    project.bible_finalized_at = timezone.now()
    project.bible_finalized_by = finalized_by
    project.save(update_fields=[
        'bible_status', 'bible_finalized_at', 'bible_finalized_by'
    ])
    
    return project
```

### 2.4 — Set initial bible from script

```python
@staticmethod
def set_bible_from_content(project, content, set_by=None):
    """
    Set the canonical bible content (e.g., generated from screenplay by AI).
    Used when initially creating the bible from the script.
    """
    if project.bible_status == 'final':
        raise ValueError('بایبڵ کۆتایی کراوە')
    
    project.canonical_bible = content if isinstance(content, dict) else {'text': content}
    project.bible_version += 1
    project.bible_status = 'draft'
    project.save(update_fields=['canonical_bible', 'bible_version', 'bible_status'])
    
    return project
```

---

## Section 3 — API Endpoints

### 3.1 — Project bible endpoints

Add these to `src/projects/` or `src/reviews/` API views:

```python
# GET /api/v1/projects/projects/{id}/bible/
# Returns the canonical bible content + metadata
class ProjectBibleView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        return Response({
            'canonical_bible': project.canonical_bible,
            'bible_version': project.bible_version,
            'bible_status': project.bible_status,
            'bible_finalized_at': project.bible_finalized_at,
            'bible_finalized_by': str(project.bible_finalized_by) if project.bible_finalized_by else None,
        })

# PUT /api/v1/projects/projects/{id}/bible/
# Set/update the canonical bible content
class ProjectBibleView(APIView):
    def put(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        content = request.data.get('content', {})
        ReviewService.set_bible_from_content(project, content)
        return Response({
            'canonical_bible': project.canonical_bible,
            'bible_version': project.bible_version,
            'bible_status': project.bible_status,
        })

# POST /api/v1/projects/projects/{id}/bible/finalize/
# Finalize the bible
class FinalizeBibleView(APIView):
    def post(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        ReviewService.finalize_bible(project, request.user)
        return Response({'status': 'final', 'bible_version': project.bible_version})
```

Wire these URLs:
```python
# In src/projects/urls.py or src/reviews/urls.py:
path('projects/<uuid:pk>/bible/', ProjectBibleView.as_view(), name='project_bible'),
path('projects/<uuid:pk>/bible/finalize/', FinalizeBibleView.as_view(), name='finalize_bible'),
```

### 3.2 — Update review delivery endpoint

The existing `update_review` PATCH should trigger `deliver_review` when status changes to `delivered`:

```python
# In the BibleReview viewset's partial_update:
def partial_update(self, request, *args, **kwargs):
    review = self.get_object()
    new_status = request.data.get('status')
    
    if new_status == 'delivered' and review.status != 'delivered':
        ReviewService.deliver_review(review, request.user)
        serializer = self.get_serializer(review)
        return Response(serializer.data)
    
    return super().partial_update(request, *args, **kwargs)
```

### 3.3 — Update create_review endpoint

The existing `create_review` POST should use `ReviewService.create_review()` which snapshots the canonical bible:

```python
# In the BibleReview viewset's create:
def create(self, request, *args, **kwargs):
    project = get_object_or_404(Project, pk=self.kwargs['project_id'])
    review = ReviewService.create_review(project, request.user)
    serializer = self.get_serializer(review)
    return Response(serializer.data, status=201)
```

### 3.4 — Update Project serializer

Add `canonical_bible`, `bible_version`, `bible_status`, `bible_finalized_at` to the Project serializer so they appear in project detail responses.

---

## Section 4 — MCP Tools

### 4.1 — Add `get_bible` tool

```typescript
server.tool(
  "get_bible",
  "Get the canonical bible for a project (single source of truth)",
  {
    project_id: z.string().describe("UUID of the project"),
  },
  async ({ project_id }) => {
    const data = await api(`/projects/projects/${project_id}/bible/`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);
```

### 4.2 — Add `set_bible` tool

```typescript
server.tool(
  "set_bible",
  "Set or update the canonical bible content for a project",
  {
    project_id: z.string().describe("UUID of the project"),
    content: z.string().describe("Bible content (JSON string or plain text)"),
  },
  async ({ project_id, content }) => {
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      parsedContent = { text: content };
    }
    const data = await api(`/projects/projects/${project_id}/bible/`, {
      method: "PUT",
      body: { content: parsedContent },
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);
```

### 4.3 — Add `finalize_bible` tool

```typescript
server.tool(
  "finalize_bible",
  "Mark a project's bible as final — no more reviews allowed",
  {
    project_id: z.string().describe("UUID of the project"),
  },
  async ({ project_id }) => {
    const data = await api(`/projects/projects/${project_id}/bible/finalize/`, {
      method: "POST",
      body: {},
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);
```

### 4.4 — Update `create_review` tool description

Update the description to clarify it snapshots the canonical bible:

```typescript
server.tool(
  "create_review",
  "Create a new bible review (snapshots the current canonical bible as starting point)",
  // ... rest stays the same
);
```

### 4.5 — Add `deliver_review` tool

```typescript
server.tool(
  "deliver_review",
  "Deliver a review — applies review content as the new canonical bible",
  {
    project_id: z.string().describe("UUID of the project"),
    review_id: z.string().describe("UUID of the review to deliver"),
  },
  async ({ project_id, review_id }) => {
    const data = await api(`/reviews/bible/${project_id}/${review_id}/`, {
      method: "PATCH",
      body: { status: "delivered" },
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);
```

### 4.6 — Rebuild

```bash
cd rwanga-mcp
npm run build

# Verify new tools appear:
grep -c "server.tool" dist/index.js
# Should be 42+ (38 existing + 4 new: get_bible, set_bible, finalize_bible, deliver_review)

# Smoke test:
RWANGA_API_URL=http://localhost:8020/api/v1 RWANGA_API_TOKEN=YOUR_TOKEN node dist/index.js
```

---

## Section 5 — Migrate Existing Data

The Mysterious Guest project already has 4 test reviews with empty content. Clean up and set the initial state:

```bash
python manage.py shell -c "
from src.projects.models import Project
from src.reviews.models import BibleReview

project = Project.objects.get(pk='b7821ef2-bef1-4527-b192-625ac0977aa5')

# Delete test reviews with empty content
empty_reviews = BibleReview.objects.filter(project=project, content={})
count = empty_reviews.count()
empty_reviews.delete()
print(f'Deleted {count} empty test reviews')

# Set project bible status to draft (ready for first real review)
project.bible_status = 'draft'
project.bible_version = 0
project.save(update_fields=['bible_status', 'bible_version'])
print(f'Project bible reset: status={project.bible_status}, version={project.bible_version}')
"
```

---

## Validation

```bash
python manage.py check
python manage.py runserver 0.0.0.0:8020

# Test the lifecycle:
TOKEN=YOUR_TOKEN
PROJECT=b7821ef2-bef1-4527-b192-625ac0977aa5

# 1. Set initial bible content
curl -X PUT -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" \
  -d '{"content": {"title": "میوانێکی نادیار", "version": "v1"}}' \
  http://localhost:8020/api/v1/projects/projects/$PROJECT/bible/
# → bible_version: 1, bible_status: draft

# 2. Get bible
curl -H "Authorization: Token $TOKEN" \
  http://localhost:8020/api/v1/projects/projects/$PROJECT/bible/
# → canonical_bible with content, version 1

# 3. Create review (should snapshot bible)
curl -X POST -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" \
  http://localhost:8020/api/v1/reviews/bible/$PROJECT/
# → review.content should equal canonical_bible, bible_snapshot_version: 1

# 4. Deliver review (should update canonical bible)
curl -X PATCH -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" \
  -d '{"status": "delivered"}' \
  http://localhost:8020/api/v1/reviews/bible/$PROJECT/$REVIEW_ID/
# → bible_version: 2

# 5. Finalize bible
curl -X POST -H "Authorization: Token $TOKEN" \
  http://localhost:8020/api/v1/projects/projects/$PROJECT/bible/finalize/
# → bible_status: final

# 6. Try creating review after finalization → should fail
curl -X POST -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" \
  http://localhost:8020/api/v1/reviews/bible/$PROJECT/
# → 400 or 403 with error message
```

---

## Checklist

- [ ] `canonical_bible`, `bible_version`, `bible_status`, `bible_finalized_at`, `bible_finalized_by` added to Project model
- [ ] `bible_snapshot_version` added to BibleReview model
- [ ] Migrations created and applied
- [ ] `ReviewService.create_review()` snapshots canonical bible
- [ ] `ReviewService.deliver_review()` updates canonical bible from review content
- [ ] `ReviewService.finalize_bible()` locks bible as final
- [ ] `ReviewService.set_bible_from_content()` sets initial bible
- [ ] API endpoint: GET/PUT `/projects/{id}/bible/` — get/set canonical bible
- [ ] API endpoint: POST `/projects/{id}/bible/finalize/` — finalize bible
- [ ] Review create endpoint uses `ReviewService.create_review()` with snapshot
- [ ] Review PATCH with `status=delivered` triggers `deliver_review()`
- [ ] Project serializer includes bible fields
- [ ] Test reviews with empty content deleted
- [ ] MCP tool: `get_bible` added
- [ ] MCP tool: `set_bible` added
- [ ] MCP tool: `finalize_bible` added
- [ ] MCP tool: `deliver_review` added
- [ ] `create_review` tool description updated
- [ ] `npm run build` succeeds
- [ ] MCP server starts without errors
- [ ] End-to-end: set bible → create review (snapshots) → deliver review (updates bible) → finalize
- [ ] End-to-end: creating review after finalization fails with error
