# Decision Accept/Reject Comments + Sarwar User Setup

> **Context:** The ReviewDecision model supports lock/reject but has NO comment or reason field. Sarwar (the director) needs to interact with individual decision points — read each one, then accept (lock + comment) or reject (reject + comment). Without this, the review system is one-directional: the consultant proposes, but the director can only silently approve or deny with no feedback trail.

> **Priority:** CRITICAL — this blocks the first real review session with Sarwar.

> **Read first:** `src/reviews/models.py`, `src/reviews/services.py`, `src/reviews/views.py`, `src/reviews/urls.py`

> **Mode: NON-STOP.**

---

## Section 1 — Model Changes

### 1.1 — Add comment fields to ReviewDecision

In `src/reviews/models.py`, add these fields to `ReviewDecision`:

```python
# After rejected_at field:
lock_comment = models.TextField(
    blank=True, default='',
    verbose_name='تێبینی پەسەندکردن',
    help_text='Comment when locking/accepting a decision'
)
reject_reason = models.TextField(
    blank=True, default='',
    verbose_name='هۆکاری ڕەتکردنەوە',
    help_text='Reason for rejecting a decision'
)
```

Run:
```bash
python manage.py makemigrations reviews
python manage.py migrate
```

### 1.2 — Add repropose support

When a decision is rejected, the consultant should be able to re-propose it with modifications. Add:

```python
reproposed_from = models.ForeignKey(
    'self', null=True, blank=True, on_delete=models.SET_NULL,
    related_name='reproposals',
    help_text='If this is a re-proposal, link to the rejected decision'
)
```

---

## Section 2 — Service Layer Updates

Update `src/reviews/services.py`:

```python
@staticmethod
def lock_decision(decision, locked_by, comment=''):
    """Consultant OR Director can lock (approve) with optional comment."""
    decision.status = 'locked'
    decision.locked_by = locked_by
    decision.locked_at = timezone.now()
    decision.lock_comment = comment
    decision.save()
    return decision

@staticmethod
def reject_decision(decision, rejected_by, reason=''):
    """Director only can reject with mandatory reason."""
    decision.status = 'rejected'
    decision.rejected_by = rejected_by
    decision.rejected_at = timezone.now()
    decision.reject_reason = reason
    decision.save()
    return decision

@staticmethod
def repropose_decision(original_decision, proposed_by, new_topic=None, new_text=None):
    """Re-propose a rejected decision with modifications."""
    return ReviewDecision.objects.create(
        bible_review=original_decision.bible_review,
        scene=original_decision.scene,
        topic=new_topic or original_decision.topic,
        decision_text=new_text or original_decision.decision_text,
        status='proposed',
        proposed_by=proposed_by,
        reproposed_from=original_decision
    )
```

---

## Section 3 — API / View Updates

### 3.1 — Lock decision view (HTMX POST)

In `src/reviews/views.py`, update or create the lock view:

```python
@require_POST
@login_required
def lock_decision(request, pk):
    """Lock (accept) a decision with optional comment."""
    decision = get_object_or_404(ReviewDecision, pk=pk, status='proposed')
    comment = request.POST.get('comment', '')
    ReviewService.lock_decision(decision, request.user, comment=comment)
    # Return the updated decision card partial for HTMX swap
    return render(request, 'reviews/_decision_card.html', {
        'decision': decision,
        'review': decision.bible_review,
    })
```

### 3.2 — Reject decision view (HTMX POST)

```python
@require_POST
@login_required
def reject_decision(request, pk):
    """Reject a decision with reason."""
    decision = get_object_or_404(ReviewDecision, pk=pk, status='proposed')
    reason = request.POST.get('reason', '')
    if not reason.strip():
        return HttpResponse(
            '<div class="rw-alert rw-alert-red">هۆکاری ڕەتکردنەوە پێویستە</div>',
            status=422
        )
    ReviewService.reject_decision(decision, request.user, reason=reason)
    return render(request, 'reviews/_decision_card.html', {
        'decision': decision,
        'review': decision.bible_review,
    })
```

### 3.3 — Repropose decision view

```python
@require_POST
@login_required
def repropose_decision(request, pk):
    """Re-propose a rejected decision with modifications."""
    original = get_object_or_404(ReviewDecision, pk=pk, status='rejected')
    new_text = request.POST.get('decision_text', original.decision_text)
    new_topic = request.POST.get('topic', original.topic)
    new_decision = ReviewService.repropose_decision(
        original, request.user, new_topic=new_topic, new_text=new_text
    )
    return render(request, 'reviews/_decision_card.html', {
        'decision': new_decision,
        'review': new_decision.bible_review,
    })
```

### 3.4 — URL patterns

Make sure `src/reviews/urls.py` has:

```python
path('decisions/<uuid:pk>/lock/', lock_decision, name='lock_decision'),
path('decisions/<uuid:pk>/reject/', reject_decision, name='reject_decision'),
path('decisions/<uuid:pk>/repropose/', repropose_decision, name='repropose_decision'),
```

### 3.5 — DRF Serializer Update

If there's a `ReviewDecisionSerializer`, add `lock_comment`, `reject_reason`, `reproposed_from` to the fields. The PATCH endpoint for decisions should accept `comment` (for lock) and `reason` (for reject) in the request body.

Update the API viewset's `partial_update` method:

```python
def partial_update(self, request, *args, **kwargs):
    decision = self.get_object()
    new_status = request.data.get('status')
    
    if new_status == 'locked':
        comment = request.data.get('comment', '')
        ReviewService.lock_decision(decision, request.user, comment=comment)
    elif new_status == 'rejected':
        reason = request.data.get('reason', '')
        ReviewService.reject_decision(decision, request.user, reason=reason)
    else:
        return super().partial_update(request, *args, **kwargs)
    
    serializer = self.get_serializer(decision)
    return Response(serializer.data)
```

---

## Section 4 — Template Updates

### 4.1 — Decision card (`reviews/_decision_card.html`)

Each decision card needs an interactive accept/reject section. When status is `proposed`:

```html
{# Accept/Reject form — shown only for proposed decisions #}
{% if decision.status == 'proposed' %}
<div class="rw-decision-actions" style="margin-top:12px; padding-top:12px; border-top:1px solid var(--rw-border)">
  
  {# Accept (Lock) form #}
  <form hx-post="{% url 'reviews:lock_decision' decision.pk %}"
        hx-target="#decision-{{ decision.pk }}"
        hx-swap="outerHTML"
        style="margin-bottom:8px">
    {% csrf_token %}
    <textarea name="comment" 
              class="rw-input" 
              rows="2"
              placeholder="{% trans 'تێبینی (ئارەزوومەندانە)...' %}"
              style="width:100%; margin-bottom:8px"></textarea>
    <button type="submit" class="rw-btn rw-btn-green rw-btn-sm">
      ✓ {% trans 'پەسەندکردن' %}
    </button>
  </form>

  {# Reject form #}
  <form hx-post="{% url 'reviews:reject_decision' decision.pk %}"
        hx-target="#decision-{{ decision.pk }}"
        hx-swap="outerHTML"
        style="margin-bottom:8px">
    {% csrf_token %}
    <textarea name="reason" 
              class="rw-input" 
              rows="2"
              placeholder="{% trans 'هۆکاری ڕەتکردنەوە (پێویستە)...' %}"
              required
              style="width:100%; margin-bottom:8px"></textarea>
    <button type="submit" class="rw-btn rw-btn-red rw-btn-sm">
      ✕ {% trans 'ڕەتکردنەوە' %}
    </button>
  </form>
</div>
{% endif %}

{# Show lock comment if locked #}
{% if decision.status == 'locked' and decision.lock_comment %}
<div class="rw-decision-comment" style="margin-top:8px; padding:8px; background:var(--rw-green-bg, rgba(16,185,129,0.1)); border-radius:var(--rw-r); font-size:13px; color:var(--rw-text-2)">
  <strong>{{ decision.locked_by.get_full_name }}:</strong> {{ decision.lock_comment }}
</div>
{% endif %}

{# Show reject reason if rejected #}
{% if decision.status == 'rejected' and decision.reject_reason %}
<div class="rw-decision-comment" style="margin-top:8px; padding:8px; background:var(--rw-red-bg, rgba(239,68,68,0.1)); border-radius:var(--rw-r); font-size:13px; color:var(--rw-text-2)">
  <strong>{{ decision.rejected_by.get_full_name }}:</strong> {{ decision.reject_reason }}
</div>
{% endif %}

{# Repropose button if rejected #}
{% if decision.status == 'rejected' %}
<button class="rw-btn rw-btn-ghost rw-btn-sm" 
        hx-get="{% url 'reviews:repropose_decision' decision.pk %}"
        hx-target="#decision-{{ decision.pk }}"
        hx-swap="afterend"
        style="margin-top:8px">
  ↻ {% trans 'پێشنیارکردنەوە' %}
</button>
{% endif %}
```

Each decision card must have `id="decision-{{ decision.pk }}"` on its outer wrapper for HTMX targeting.

---

## Section 5 — Create Sarwar's User Account

### 5.1 — Create user via Django management command

```bash
cd /path/to/rwanga/src
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()

# Create Sarwar's account
sarwar, created = User.objects.get_or_create(
    username='sarwar',
    defaults={
        'email': 'sawasarwar3@gmail.com',
        'first_name': 'سەروەر',
        'last_name': 'عەبدولڕەحمان',
        'is_active': True,
    }
)
if created:
    sarwar.set_password('Rwanga2026!')
    sarwar.save()
    print(f'Created user: {sarwar.username} (ID: {sarwar.pk})')
else:
    print(f'User already exists: {sarwar.username} (ID: {sarwar.pk})')
"
```

### 5.2 — Create API token for Sarwar

```bash
python manage.py drf_create_token sarwar
```

### 5.3 — Reassign project ownership

```bash
python manage.py shell -c "
from django.contrib.auth import get_user_model
from src.projects.models import Project, ProjectMembership

User = get_user_model()
sarwar = User.objects.get(username='sarwar')
darya = User.objects.get(email='daryabsb@gmail.com')

# Find the Mysterious Guest project
project = Project.objects.get(title__contains='میوانێکی نادیار')
print(f'Project: {project.title} (ID: {project.pk})')

# Set Sarwar as owner/director
project.owner = sarwar
project.save()
print(f'Owner set to: {sarwar.username}')

# Ensure Sarwar has full membership
membership_s, _ = ProjectMembership.objects.get_or_create(
    project=project, user=sarwar,
    defaults={'role': 'director'}
)
print(f'Sarwar membership: {membership_s.role}')

# Ensure Darya has reviewer membership (keep superuser status)
membership_d, _ = ProjectMembership.objects.get_or_create(
    project=project, user=darya,
    defaults={'role': 'reviewer'}
)
# If Darya already had a membership, update role
if not _:
    membership_d.role = 'reviewer'
    membership_d.save()
print(f'Darya membership: {membership_d.role}')
"
```

**Note:** If `Project` doesn't have an `owner` field, use whatever field represents the project creator/director. If `ProjectMembership` doesn't have a `role` field yet, add one:

```python
# In src/projects/models.py — ProjectMembership
ROLE_CHOICES = [
    ('director', 'دەرهێنەر'),
    ('production_team', 'تیمی بەرهەمهێنان'),
    ('reviewer', 'پێداچوونەوەکەر'),
    ('community', 'کۆمیونیتی'),
    ('full_access', 'هەموو'),
]
role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='production_team')
```

Then run `makemigrations` and `migrate`.

---

## Section 6 — MCP Server: Add All Review + Community Tools and Rebuild

The MCP server has been moved into the Django repo at `rwanga-mcp/` (inside the project root, e.g. `E:/api/rwanga/rwanga-mcp/`). It currently has tools for projects, scenes, characters, locations, scripts, tasks, and gaps — but **zero tools for reviews or community**.

### 6.1 — Add ALL review tools to `rwanga-mcp/src/index.ts`

Add these tools after the existing `create_gap_blocker` tool, before the PROMPTS section. Follow the exact same pattern as existing tools (use `server.tool()` with Zod schemas, call `api<T>()`):

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// TOOLS — Reviews (Bible Review System)
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  "list_reviews",
  "List all bible reviews for a project",
  { project_id: z.string().describe("UUID of the project") },
  async ({ project_id }) => {
    const data = await api(`/reviews/bible/${project_id}/`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_review",
  "Create a new bible review for a project",
  {
    project_id: z.string().describe("UUID of the project"),
    content: z.string().optional().describe("Bible content (JSON or text)"),
  },
  async ({ project_id, content }) => {
    const body: Record<string, unknown> = {};
    if (content) body.content = content;
    const data = await api(`/reviews/bible/${project_id}/`, { method: "POST", body });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_review",
  "Get a bible review with its decisions and evaluations",
  {
    project_id: z.string().describe("UUID of the project"),
    review_id: z.string().describe("UUID of the bible review"),
  },
  async ({ project_id, review_id }) => {
    const data = await api(`/reviews/bible/${project_id}/${review_id}/`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "update_review",
  "Update a bible review (status, content)",
  {
    project_id: z.string().describe("UUID of the project"),
    review_id: z.string().describe("UUID of the bible review"),
    status: z.string().optional().describe("New status: draft, in_review, delivered"),
    content: z.string().optional().describe("Updated bible content"),
  },
  async ({ project_id, review_id, status, content }) => {
    const body: Record<string, unknown> = {};
    if (status) body.status = status;
    if (content) body.content = content;
    const data = await api(`/reviews/bible/${project_id}/${review_id}/`, { method: "PATCH", body });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "list_decisions",
  "List all decisions for a bible review",
  { review_id: z.string().describe("UUID of the bible review") },
  async ({ review_id }) => {
    const data = await api(`/reviews/decisions/${review_id}/`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_decision",
  "Propose a new decision for a bible review",
  {
    review_id: z.string().describe("UUID of the bible review"),
    topic: z.string().describe("Decision topic/title (Kurdish)"),
    decision_text: z.string().describe("Decision text/body (Kurdish)"),
    scene_id: z.string().optional().describe("UUID of related scene (optional)"),
  },
  async ({ review_id, topic, decision_text, scene_id }) => {
    const body: Record<string, unknown> = { topic, decision_text };
    if (scene_id) body.scene = scene_id;
    const data = await api(`/reviews/decisions/${review_id}/`, { method: "POST", body });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "lock_decision",
  "Lock (accept/approve) a review decision with optional comment",
  {
    review_id: z.string().describe("UUID of the bible review"),
    decision_id: z.string().describe("UUID of the decision to lock"),
    comment: z.string().optional().describe("Comment explaining the acceptance"),
  },
  async ({ review_id, decision_id, comment }) => {
    const body: Record<string, unknown> = { status: "locked" };
    if (comment) body.comment = comment;
    const data = await api(`/reviews/decisions/${review_id}/${decision_id}/`, {
      method: "PATCH",
      body,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "reject_decision",
  "Reject a review decision with reason",
  {
    review_id: z.string().describe("UUID of the bible review"),
    decision_id: z.string().describe("UUID of the decision to reject"),
    reason: z.string().optional().describe("Reason for rejecting"),
  },
  async ({ review_id, decision_id, reason }) => {
    const body: Record<string, unknown> = { status: "rejected" };
    if (reason) body.reason = reason;
    const data = await api(`/reviews/decisions/${review_id}/${decision_id}/`, {
      method: "PATCH",
      body,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_scene_evaluation",
  "Create a scene evaluation within a bible review",
  {
    review_id: z.string().describe("UUID of the bible review"),
    scene_id: z.string().describe("UUID of the scene to evaluate"),
    analysis: z.string().describe("Analysis text"),
    tension_score: z.number().min(0).max(10).describe("Tension score 0-10"),
    notes: z.string().optional().describe("Additional notes"),
    recommendations: z.string().optional().describe("Recommendations"),
  },
  async ({ review_id, scene_id, analysis, tension_score, notes, recommendations }) => {
    const body: Record<string, unknown> = { scene: scene_id, analysis, tension_score };
    if (notes) body.notes = notes;
    if (recommendations) body.recommendations = recommendations;
    const data = await api(`/reviews/evaluations/${review_id}/`, { method: "POST", body });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);
```

### 6.2 — Add ALL community tools

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// TOOLS — Community (Review Sessions)
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  "list_sessions",
  "List community review sessions for a project",
  { project_id: z.string().describe("UUID of the project") },
  async ({ project_id }) => {
    const data = await api(`/community/sessions/${project_id}/`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_session",
  "Create a community review session",
  {
    project_id: z.string().describe("UUID of the project"),
    title: z.string().describe("Session title"),
    session_type: z.enum(["screenplay", "bible", "scene_selection"]).default("bible"),
    visibility: z.enum(["invite_only", "public"]).default("invite_only"),
  },
  async ({ project_id, title, session_type, visibility }) => {
    const data = await api(`/community/sessions/${project_id}/`, {
      method: "POST",
      body: { title, session_type, visibility },
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_session",
  "Get a community session with content, participants, comments",
  {
    project_id: z.string().describe("UUID of the project"),
    session_id: z.string().describe("UUID of the session"),
  },
  async ({ project_id, session_id }) => {
    const data = await api(`/community/sessions/${project_id}/${session_id}/`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "update_session",
  "Update a community session (open/close)",
  {
    project_id: z.string().describe("UUID of the project"),
    session_id: z.string().describe("UUID of the session"),
    status: z.string().describe("New status: draft, open, closed"),
  },
  async ({ project_id, session_id, status }) => {
    const data = await api(`/community/sessions/${project_id}/${session_id}/`, {
      method: "PATCH",
      body: { status },
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "invite_participant",
  "Invite a user to a community session",
  {
    session_id: z.string().describe("UUID of the session"),
    user_id: z.string().optional().describe("UUID of user to invite"),
    email: z.string().optional().describe("Email of user to invite"),
  },
  async ({ session_id, user_id, email }) => {
    const body: Record<string, unknown> = {};
    if (user_id) body.user_id = user_id;
    if (email) body.email = email;
    const data = await api(`/community/sessions/${session_id}/invite/`, { method: "POST", body });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "add_session_content",
  "Add content (scene/bible snapshot) to a community session",
  {
    session_id: z.string().describe("UUID of the session"),
    content_type: z.enum(["scene", "bible"]).describe("Type of content"),
    content_data: z.string().describe("JSON content data"),
    label: z.string().describe("Content label"),
  },
  async ({ session_id, content_type, content_data, label }) => {
    const data = await api(`/community/sessions/${session_id}/content/`, {
      method: "POST",
      body: { content_type, content_data, label },
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "list_comments",
  "List comments for a community session",
  { session_id: z.string().describe("UUID of the session") },
  async ({ session_id }) => {
    const data = await api(`/community/sessions/${session_id}/comments/`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_comment",
  "Post a comment in a community session",
  {
    session_id: z.string().describe("UUID of the session"),
    session_content_id: z.string().describe("UUID of the content being commented on"),
    body: z.string().describe("Comment text"),
    anchor_type: z.enum(["line", "paragraph", "scene", "general"]).default("general"),
    anchor_ref: z.string().optional().describe("Reference to specific anchor point"),
    parent_id: z.string().optional().describe("UUID of parent comment (for replies)"),
  },
  async ({ session_id, session_content_id, body: commentBody, anchor_type, anchor_ref, parent_id }) => {
    const reqBody: Record<string, unknown> = {
      session_content: session_content_id,
      body: commentBody,
      anchor_type,
    };
    if (anchor_ref) reqBody.anchor_ref = anchor_ref;
    if (parent_id) reqBody.parent = parent_id;
    const data = await api(`/community/sessions/${session_id}/comments/`, { method: "POST", body: reqBody });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "react_to_comment",
  "React to a community session comment (agree/disagree/question)",
  {
    session_id: z.string().describe("UUID of the session"),
    comment_id: z.string().describe("UUID of the comment"),
    reaction_type: z.enum(["agree", "disagree", "question"]).describe("Reaction type"),
  },
  async ({ session_id, comment_id, reaction_type }) => {
    const data = await api(`/community/sessions/${session_id}/comments/${comment_id}/react/`, {
      method: "POST",
      body: { reaction_type },
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);
```

### 6.3 — Verify API endpoints exist BEFORE adding tools

Before adding the MCP tools, verify these Django API endpoints actually work:

```bash
# Start server
python manage.py runserver 0.0.0.0:8020

# Test review endpoints (replace UUIDs with real ones):
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8020/api/v1/reviews/bible/PROJECT_ID/
curl -X POST -H "Authorization: Token YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{"content": "test"}' http://localhost:8020/api/v1/reviews/bible/PROJECT_ID/

# Test community endpoints:
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8020/api/v1/community/sessions/PROJECT_ID/

# Check URL patterns:
python manage.py show_urls | grep -E "reviews|community"
```

If any endpoint returns 404 or 500, fix the Django URL/view/serializer first, then add the MCP tool. The URL patterns above are based on the task spec — adapt if the actual router used different paths.

### 6.4 — Build and test the MCP server

```bash
cd rwanga-mcp
npm run build

# Verify build output has all tools:
grep -c "server.tool" dist/index.js
# Should be 27+ (18 original + 9 review + 9 community — some may be fewer if grouped)

# Quick smoke test:
RWANGA_API_URL=http://localhost:8020/api/v1 RWANGA_API_TOKEN=YOUR_TOKEN node dist/index.js
# Should print "Rwanga MCP server running (stdio)" without errors
```

**IMPORTANT:** After building, the Claude Desktop MCP config must point to the built server inside the repo. If the config still points to the old location (e.g. `C:\Users\darya\Desktop\Sarwar\normalize\rwanga-mcp\`), update it to the new location inside the Django project.

---

## Validation

```bash
python manage.py check
python manage.py runserver 0.0.0.0:8020

# Test the flow:
# 1. Log in as Sarwar (username: sarwar, password: Rwanga2026!)
# 2. Go to /reviews/
# 3. Open a review with proposed decisions
# 4. On a proposed decision: type a comment → click "پەسەندکردن" → decision locks with comment shown
# 5. On another proposed decision: type a reason → click "ڕەتکردنەوە" → decision rejects with reason shown
# 6. On the rejected decision: click "پێشنیارکردنەوە" → new proposed decision appears

# Test MCP tools:
# 7. list_reviews for the project → should return reviews
# 8. create_decision with a topic and text → should return new proposed decision
# 9. lock_decision with a comment → should return locked decision with lock_comment
# 10. reject_decision with a reason → should return rejected decision with reject_reason
```

---

## Checklist

- [ ] `lock_comment` and `reject_reason` fields added to ReviewDecision model
- [ ] `reproposed_from` field added to ReviewDecision model
- [ ] Migration created and applied
- [ ] Service methods updated to accept comment/reason
- [ ] Lock/reject/repropose views updated with HTMX responses
- [ ] Decision card template updated with comment forms
- [ ] DRF serializer updated with new fields
- [ ] API PATCH endpoint accepts comment/reason in body
- [ ] Sarwar user created with credentials (sarwar / Rwanga2026!)
- [ ] API token generated for Sarwar
- [ ] Mysterious Guest project ownership reassigned to Sarwar
- [ ] Darya set as reviewer on the project
- [ ] ProjectMembership role field exists (add if missing)
- [ ] All 9 review MCP tools added to `rwanga-mcp/src/index.ts`
- [ ] All 9 community MCP tools added to `rwanga-mcp/src/index.ts`
- [ ] Django API endpoints verified (all return 200, not 404/500)
- [ ] `npm run build` succeeds for MCP server
- [ ] MCP server starts without errors
- [ ] End-to-end test: Sarwar can accept a decision with comment
- [ ] End-to-end test: Sarwar can reject a decision with reason
- [ ] End-to-end test: create_review via MCP → appears at /reviews/
- [ ] End-to-end test: create_decision via MCP → appears in review detail
