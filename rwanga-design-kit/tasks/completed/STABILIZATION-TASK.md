# STABILIZATION TASK — Make Rwanga Demo-Ready

> **This is the most important task you will execute.** The project owner tried to demo Rwanga on his phone to friends. Login failed. Dropdowns didn't work. Pages crashed. "Coming soon" stubs appeared. The system cannot be trusted. Your job is to make every single page work. No stubs. No crashes. No excuses.

> **Mode: NON-STOP.** Fix everything. Only stop for a genuine infrastructure blocker.

## Before You Start

Read these files IN ORDER:
1. `rwanga-design-kit/CLAUDE.md`
2. `rwanga-design-kit/BACKEND_SPEC.md`

## Priority 00 — HTMX NAVIGATION & MODAL SYSTEM (Most Visible Bugs)

These two bugs make the entire app look broken. Fix them before anything else.

### 00.1 — Full-page nesting on navigation (hx-boost issue)

**Symptom:** Clicking any nav link (Scripts, Locations, Scheduling, etc.) loads the entire target page — including its own `<html>`, `<head>`, base.html header, sidebar — INSIDE the current page's content area. You see double headers, double sidebars, a page inside a page.

**Root cause:** Either `hx-boost="true"` is set on a container element and HTMX is intercepting `<a>` clicks, swapping the full HTML response into a target div instead of doing a full browser navigation. OR the nav links use `hx-get` with `hx-target` pointing at a content container, and the server returns a full page instead of a partial.

**Fix — choose ONE approach:**

**Option A (recommended): Remove hx-boost from nav links entirely.** Sidebar and topnav links should be regular `<a href="...">` links with NO `hx-*` attributes. Let the browser do full-page navigation for section changes. HTMX should only be used for in-page interactions (tab switching, inline edit, form submit, filter).

```html
<!-- In _sidebar.html and _topnav.html -->
<!-- WRONG: -->
<a href="/scripts/{{ project.pk }}/" hx-boost="true">Scripts</a>
<a href="/locations/" hx-get="/locations/" hx-target="#main-content">Locations</a>

<!-- RIGHT: -->
<a href="/scripts/{{ project.pk }}/">Scripts</a>
<a href="/locations/">Locations</a>
```

Check these files for hx-boost or hx-get on navigation links:
- `templates/components/_sidebar.html`
- `templates/components/_topnav.html`
- `templates/base.html` (check for `hx-boost="true"` on `<body>` or any wrapper div)

If `hx-boost="true"` is on `<body>` or a main wrapper, REMOVE IT. hx-boost on body means every single `<a>` tag in the page gets intercepted by HTMX.

**Option B (if hx-boost is intentional):** Keep hx-boost but make sure all views return ONLY the inner content (no base.html wrapper) when the request is an HTMX request. Check for the `HX-Request` header:

```python
# In every view that can be reached via nav link:
def get(self, request, *args, **kwargs):
    context = self.get_context_data()
    if request.headers.get('HX-Request'):
        return render(request, 'scripts/index_partial.html', context)  # partial, no base.html
    return render(request, 'scripts/index.html', context)  # full page with base.html
```

But this requires creating partial versions of every template. Option A is simpler and correct.

**Test:** After fixing, click every nav link. Each must do a FULL page load (browser URL changes, no nested content). The only things that should use HTMX swapping are: tab switches within scene_view, inline edits, form submissions, and filter/search.

### 00.2 — Modals rendering as inline page content instead of overlays

**Symptom:** Clicking "+ شوێنی نوێ" (New Location) or any "add" button appends the modal HTML at the bottom of the page as regular content. It should appear as a centered Bootstrap overlay with a backdrop.

**Root cause:** The HTMX response returns modal HTML and swaps it into the page, but:
1. The response might not be wrapped in Bootstrap modal markup (`<div class="modal">...</div>`)
2. Nobody calls `bootstrap.Modal.show()` on the inserted element
3. The `hx-target` might be appending to body instead of a dedicated modal container

**Fix — implement a modal system:**

**Step 1:** Add a modal container to `base.html`:
```html
<!-- At the bottom of base.html, before </body> -->
<div id="rw-modal-container"></div>
```

**Step 2:** All modal-triggering buttons should target this container:
```html
<button hx-get="{% url 'locations:add_modal' %}"
        hx-target="#rw-modal-container"
        hx-swap="innerHTML">
  + شوێنی نوێ
</button>
```

**Step 3:** Modal views must return proper Bootstrap modal markup:
```html
<!-- locations/add_modal.html -->
<div class="modal fade" id="addLocationModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content" style="background: var(--rw-surface); color: var(--rw-text);">
      <div class="modal-header">
        <h5 class="modal-title">شوێنی نوێ</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <form hx-post="{% url 'locations:create' %}" hx-target="#location-list" hx-swap="innerHTML">
          {% csrf_token %}
          {{ form.as_div }}
          <button type="submit" class="btn btn-primary mt-3">Save</button>
        </form>
      </div>
    </div>
  </div>
</div>
```

**Step 4:** Add an HTMX after-swap hook to auto-show the modal. In `rwanga.js` or a `<script>` in base.html:
```javascript
// Auto-show Bootstrap modals loaded via HTMX
document.body.addEventListener('htmx:afterSwap', function(event) {
    if (event.detail.target.id === 'rw-modal-container') {
        var modalEl = event.detail.target.querySelector('.modal');
        if (modalEl) {
            var modal = new bootstrap.Modal(modalEl);
            modal.show();
            // Clean up container when modal is hidden
            modalEl.addEventListener('hidden.bs.modal', function() {
                event.detail.target.innerHTML = '';
            });
        }
    }
});
```

**Step 5:** Apply this pattern to EVERY modal in the app:
- Locations: add_modal, edit_modal
- Scheduling: generate_call_sheet_modal
- Accounts: invite_modal
- Any other `*_modal` URL name

**Test:** Click every "add" / "new" / "invite" button in the app. Each must open a centered overlay with a dark backdrop. Clicking outside or the X button must close it. The form inside must submit via HTMX and close the modal on success.

### 00.3 — Settings page (and all forms) not saving to database

**Symptom:** The `/accounts/settings/` page (and potentially other POST forms across the app) allows editing fields but clicking Save does nothing — the data is not persisted to the database. The page either reloads with old data or stays unchanged.

**Likely root causes (check all):**

1. **The view is GET-only — no POST handler.** The agent copied the design-kit template but only wrote a `get()` method in the view class. There's no `post()` or `form_valid()` to process the submission.

2. **The form tag is missing `method="POST"` or `{% csrf_token %}`.**

3. **The form class doesn't exist.** The view might reference a `UserSettingsForm` that was never created.

4. **HTMX is intercepting the submit but swapping to nowhere useful.**

**Fix — implement proper POST handling for settings:**

```python
# src/accounts/views.py
class UserSettingsView(LoginRequiredMixin, UpdateView):
    model = User
    form_class = UserSettingsForm
    template_name = 'accounts/settings.html'
    success_url = reverse_lazy('accounts:settings')

    def get_object(self):
        return self.request.user

    def form_valid(self, form):
        messages.success(self.request, 'Settings saved.')
        return super().form_valid(form)
```

```python
# src/accounts/forms.py — create if missing
from django import forms
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSettingsForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email']  # add other editable fields
```

**Audit all other forms in the app for the same pattern.** Check:
- `/accounts/profile/` — does it save?
- `/accounts/team/` — does invite work?
- `/locations/` — does create/edit save?
- `/scheduling/<pk>/call-sheets/` — does generate work?
- `/projects/<pk>/settings/` — does save work?

Every form in the app must have a working POST handler. No view should be GET-only if its template contains a `<form>`.

**Test:** Edit a field on `/accounts/settings/`, click Save, reload the page. The new value must persist.

## Priority 0 — STOP THE BLEEDING (Security + Auth)

These are critical. Fix them first.

### 0.1 — DEBUG = False on production tunnel

The public Cloudflare tunnel at rwanga.zeneon.co.uk is serving full Django tracebacks. This exposes source code, database structure, and secret keys.

```python
# src/settings/components/rwanga.py (or wherever DEBUG is set)
# Add environment-based DEBUG:
DEBUG = env.bool("DEBUG", default=False)
```

Also add:
```python
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "rwanga.zeneon.co.uk", "*.zeneon.co.uk"])
```

### 0.2 — CSRF cookie failure on login

The terminal shows:
```
Forbidden (CSRF cookie has incorrect length.): /accounts/login/
HTTP POST /accounts/login/ 403
```

This means login is COMPLETELY BROKEN on the Cloudflare tunnel. Fix:
```python
# Add to settings:
CSRF_TRUSTED_ORIGINS = [
    "https://rwanga.zeneon.co.uk",
    "https://*.zeneon.co.uk",
]
CSRF_COOKIE_SECURE = True  # tunnel is HTTPS
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SAMESITE = "Lax"
```

Test: POST to `/accounts/login/` must return 302 (redirect), not 403.

### 0.3 — Register page renders login template

`/accounts/register/` shows the login form instead of registration. Fix the register view to render the correct template. The design-kit has `accounts/register.html` — copy it and wire it.

### 0.4 — API endpoints require authentication

`/api/v1/projects/projects/` and `/api/v1/progress/` return data without any auth token. Add DRF default permission:

```python
# settings
REST_FRAMEWORK = {
    ...
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    ...
}
```

The token auth endpoint (`/api/v1/auth/token/`) must remain exempt (it's how you GET a token).

### 0.5 — Magic link email backend

`/accounts/magic-link/` is configured with `console.EmailBackend`, which only prints to terminal. For now this is acceptable but add a clear message on the magic link page: "Email sending is not configured in development mode. Use email/password login instead."

## Priority 1 — CRASHING PAGES (500 Errors)

Four pages crash with NoReverseMatch. All are the same root cause: design-kit templates reference URL names that don't exist as views.

### 1.1 — `/locations/` crashes — NoReverseMatch for `add_modal`

The locations template references a URL name like `locations:add_modal` that doesn't exist. Either:
- Add a stub view + URL for the modal, OR
- Remove/guard the reference in the template with `{% url 'locations:add_modal' as add_url %}{% if add_url %}...{% endif %}`

The correct fix: add the modal view. Locations needs a working add/edit form.

### 1.2 — `/notifications/panel/` crashes — NoReverseMatch for `list`

Same pattern. The notifications panel template references `notifications:list`. Add the URL + view.

### 1.3 — `/scheduling/<pk>/stripboard/` crashes — NoReverseMatch for `reorder_strips`

The stripboard template references `scheduling:reorder_strips`. Add a stub POST endpoint that accepts strip reorder data.

### 1.4 — `/scheduling/<pk>/call-sheets/` crashes — NoReverseMatch for `generate_call_sheet_modal`

Same. Add the modal view.

**For ALL four:** after fixing, verify with `python manage.py runserver` that each URL returns 200, not 500.

## Priority 2 — STUB PAGES ("Coming Soon")

Nine pages show "coming soon" text. Replace every one with the design-kit template or a functional page. **No more stubs.**

### 2.1 — Accounts stubs

These 4 pages are stubs:
- `/accounts/profile/` → copy `rwanga-design-kit/templates/accounts/profile.html`, wire view to render user data
- `/accounts/settings/` → copy `rwanga-design-kit/templates/accounts/settings.html`, wire settings form
- `/accounts/team/` → copy `rwanga-design-kit/templates/accounts/team.html`, wire team member list from Studio.memberships
- `/accounts/contacts/<project_pk>/` → copy `rwanga-design-kit/templates/accounts/contacts.html`, wire cast/crew contact list

Each needs a real view that passes real context. Check BACKEND_SPEC.md Section 3 for the expected context variables.

### 2.2 — Scripts stubs

Three pages are stubs:
- `/scripts/<pk>/breakdown/` → copy `rwanga-design-kit/templates/scripts/breakdown.html`, render ScriptElement data grouped by scene
- `/scripts/<pk>/elements/` → copy `rwanga-design-kit/templates/scripts/elements.html`, render element list with filters
- `/scripts/<pk>/docs/` → copy `rwanga-design-kit/templates/scripts/docs.html`, render script versions/docs

### 2.3 — Reviews stub

`/reviews/` or wherever reviews lives is a stub. Reviews has NO design-kit template — create a minimal functional page extending base.html that:
- Lists BibleReview records for the current project
- Shows ReviewDecision status (proposed/locked/rejected)
- Has an InlineComment panel

### 2.4 — Community stub

Same — no design-kit template. Create a minimal functional page:
- Lists ReviewSession records
- Shows session status (draft/open/closed)
- Links to session detail (can be a separate view or HTMX partial)

## Priority 3 — API SCHEMA ERRORS

These show in the terminal every time `/api/schema/` or `/api/docs/` is hit:

### 3.1 — Duplicate LocationSerializer names

```
Warning: Encountered 2 components with identical names "Location"
  - src.projects.api.serializers.LocationSerializer
  - src.locations.api.serializers.LocationSerializer
```

Fix: rename the locations app serializer:
```python
# src/locations/api/serializers.py
class StandaloneLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        ...
```

Or better: if both serializers serialize the same model, remove the duplicate and use one. If they serialize different models (projects.Location vs locations.Location), rename one to avoid the schema collision.

### 3.2 — Missing serializer_class on APIViews

```
Error [obtain_token]: unable to guess serializer
Error [exports_health]: unable to guess serializer
Error [HealthAPIView]: unable to guess serializer
```

Fix each:
```python
# accounts/api/views.py — ObtainTokenView
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as s

class ObtainTokenView(APIView):
    @extend_schema(
        request=inline_serializer("TokenRequest", fields={"email": s.EmailField(), "password": s.CharField()}),
        responses={200: inline_serializer("TokenResponse", fields={"token": s.CharField(), "user_id": s.IntegerField(), "email": s.EmailField()})},
    )
    def post(self, request):
        ...
```

Same pattern for exports_health and HealthAPIView — add `@extend_schema` decorators or `serializer_class` attributes.

## Priority 4 — DROPDOWN & MOBILE UX

### 4.1 — Bootstrap JS not loading on auth pages

Login and register pages don't load `bootstrap.bundle.min.js` because they don't extend `base.html` (they use a minimal auth layout). Either:
- Make auth pages extend base.html, OR
- Add bootstrap bundle JS to the auth layout template

Dropdowns, tooltips, and modals all require the bundle. Without it, the mobile hamburger menu won't toggle.

### 4.2 — Mobile viewport

Verify `base.html` has:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

If not, add it. Test the login page and projects list on a narrow viewport (375px width).

## Priority 5 — PROGRESS APP STATUS SYNC

The engineering agent built 12 apps but never updated the ProgressTask statuses. Fix them now:

Update these ProgressTask records to status="completed":
- P1.6 Reviews app (ID: `0788d4c8`) — built, change "blocked" → "completed"
- P1.6 duplicate (ID: `17d6ccc5`) — "pending" → "completed"
- P1.7 InlineComment (ID: `4c07574e`) — wired, "pending" → "completed"
- P2.1 Shots (ID: `31c3a967`) — built, "in_progress" → "completed"
- P2.2 Floorplans (ID: `53a3c9a0`) — built, "in_progress" → "completed"
- P2.3 Exports (ID: `21234697`) — built, "in_progress" → "completed"
- P3.1 Departments (ID: `b085df9f`) — built, "in_progress" → "completed"
- P4.1 Scheduling (ID: `24c7f5fd`) — built, "in_progress" → "completed"
- P4.3 Locations (ID: `6c3c5340`) — built, "in_progress" → "completed"
- P4.4 Notifications (ID: `bec473db`) — built, "in_progress" → "completed"
- P5.1 AI Engine (ID: `15de7aae`) — built, "in_progress" → "completed"

Use the Progress API or ORM to update each one. Create ProgressUpdate records for each.

## Priority 6 — EXPORTS PIPELINE

**The design agent has delivered the export templates.** They are in `rwanga-design-kit/templates/exports/`:

| File | Type | What to do |
|------|------|------------|
| `call_sheet_template.html` | Django template → WeasyPrint A4 PDF | Wire into `src/exports/views.py` → `WeasyPrint(html).write_pdf()` |
| `shot_list_template.html` | Django template → WeasyPrint A4 landscape PDF | Wire into exports view, pass `total_shots`, `total_setups`, `total_pages` from view |
| `scene_viewer_export.html` | Django template → self-contained HTML | Wire into exports view, pass JSON data via `<script id="rw-data">` block |

**Step 1:** Copy these 3 template files from `rwanga-design-kit/templates/exports/` into the Django project's templates directory at `src/templates/exports/` (or wherever templates live).

**Step 2:** Wire the export views. These URLs must work:
- `/exports/scene-viewer/<scene_pk>/` — renders `scene_viewer_export.html` with full scene data as JSON context. Returns HTML response.
- `/exports/call-sheet/<shoot_day_pk>/` — renders `call_sheet_template.html` with shooting day data, pipes through WeasyPrint, returns PDF response with `Content-Type: application/pdf`.
- `/exports/shot-list/<project_pk>/` — renders `shot_list_template.html` with all shots grouped by scene, pipes through WeasyPrint, returns PDF response.

**Step 3:** Context variables — each template has a header comment block documenting exactly what context variables it expects. Read the top of each template file and build the view context accordingly.

**Step 4:** For the two PDF exports, the view pattern is:
```python
from weasyprint import HTML
from django.template.loader import render_to_string

def call_sheet_pdf(request, shoot_day_pk):
    context = build_call_sheet_context(shoot_day_pk)  # build this in services.py
    html_string = render_to_string('exports/call_sheet_template.html', context)
    pdf = HTML(string=html_string).write_pdf()
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="call_sheet_{shoot_day_pk}.pdf"'
    return response
```

**Step 5:** For the scene viewer, it's a plain HTML response — no WeasyPrint:
```python
def scene_viewer_export(request, scene_pk):
    context = build_scene_viewer_context(scene_pk)  # build in services.py
    return render(request, 'exports/scene_viewer_export.html', context)
```

**Note:** The templates extend NO base template — they are standalone documents by design. Don't wrap them in base.html.

Verify URLs are wired in `src/exports/urls.py` AND in `src/urls.py`.

## Validation Checklist

After ALL fixes, run this sequence and every item must pass:

```bash
# 1. No import errors
python manage.py check

# 2. No pending migrations
python manage.py makemigrations --check

# 3. All tests pass
pytest -x

# 4. Server starts clean (no tracebacks on boot)
python manage.py runserver 0.0.0.0:8020

# 5. Manual URL checks — ALL must return 200 (not 403, 404, or 500):
#    /accounts/login/
#    /accounts/register/
#    /accounts/profile/        (logged in)
#    /accounts/settings/       (logged in)
#    /accounts/team/           (logged in)
#    /projects/                (logged in)
#    /projects/<pk>/           (logged in, use any existing project)
#    /scripts/<pk>/
#    /scripts/<pk>/breakdown/
#    /scripts/<pk>/elements/
#    /shots/<pk>/
#    /floorplans/<pk>/
#    /departments/<pk>/lighting/
#    /departments/<pk>/sound/
#    /departments/<pk>/props/
#    /departments/<pk>/wardrobe/
#    /departments/<pk>/continuity/
#    /scheduling/<pk>/
#    /scheduling/<pk>/call-sheets/
#    /locations/
#    /notifications/panel/
#    /exports/scene-viewer/<scene_pk>/   (if scenes exist)
#    /progress/

# 6. Login test via tunnel:
#    POST to https://rwanga.zeneon.co.uk/accounts/login/ with valid credentials
#    Must return 302, not 403

# 7. API auth test:
#    GET https://rwanga.zeneon.co.uk/api/v1/projects/projects/ without token
#    Must return 401 or 403, NOT 200
```

## MANDATORY — Progress Updates

For every fix in this task:
1. Update the corresponding ProgressTask status
2. Create a ProgressUpdate with files_affected and summary
3. Create ChangeRecord entries

At the end, create an AgentReport:
```python
AgentReport.objects.create(
    agent_name="engineering-agent",
    session_id="stabilization",
    report_type="phase_completion",
    phase="stabilization",
    summary="Fixed auth, CSRF, stubs, crashes, API schema, mobile UX, exports wiring, progress sync."
)
```

## Summary

7 priorities (00 through 6), ~28 specific fixes. HTMX navigation + modals + form saves first (most visible), then security, then crashes, then stubs, then API cleanup, then mobile UX, then progress sync, then exports wiring. Every page in Rwanga must return 200 and show real content. Every form must save to the database. Zero "coming soon" pages. Zero 500 errors. Zero unauthenticated API access. This is the last cleanup before the system goes into real use.

---

## ROUND 2 — Additional Issues Found During Testing

> These were discovered during live testing AFTER Priority 00 was completed. Execute these after completing priorities 0–6 above, or interleave them where they fit naturally.

### R2.1 — Notification panel is not dismissible + full-page rendering broken

**Two separate bugs:**

**Bug A — Dropdown won't close:** The notification bell opens a dropdown/panel overlay, but clicking outside it or pressing X does NOT close it. Only a full page refresh removes it. This is likely because the panel is inserted via HTMX and the dismiss handler (click-outside or close button) is not wired.

**Fix:** The notification panel must use the same modal system from Priority 00.2, OR use a Bootstrap offcanvas/dropdown with proper dismiss behavior. If it's a custom panel:
```javascript
// In rwanga.js — close notification panel on outside click
document.addEventListener('click', function(e) {
    var panel = document.getElementById('notification-panel');
    var bell = document.getElementById('notification-bell');
    if (panel && !panel.contains(e.target) && !bell.contains(e.target)) {
        panel.remove();  // or panel.classList.add('d-none')
    }
});
```

**Bug B — `/notifications/` full page is broken:** Navigating to `rwanga.zeneon.co.uk/notifications/` renders the notification panel content at the bottom-left of a blank white page with no base.html chrome (no sidebar, no topnav, no styling). The view is either returning a partial template that doesn't extend base.html, or the notifications list view doesn't exist and falls through to the panel partial.

**Fix:** Create a proper full-page notifications view that extends `base.html`:
- Copy `rwanga-design-kit/templates/notifications/panel.html` as the partial (for the dropdown)
- Create `notifications/list.html` extending `base.html` for the full-page view at `/notifications/`
- The full-page view should list all notifications with read/unread status, timestamps, and links to relevant objects

**Test:** Click bell → panel opens → click X or outside → panel closes. Click "ھەموو ئاگادارکردنەوەکان ببینە" → navigates to `/notifications/` → renders full page with sidebar and topnav.

### R2.2 — Bootstrap 5 loading from CDN instead of locally (CSS load order conflict)

**Symptom:** BS5 loads from a CDN `<link>` tag, and it loads AFTER `rwanga.css`. This causes: fonts not loading correctly, style conflicts where BS5 overrides Rwanga design tokens, and Cairo font not applying consistently.

**Fix:** Bundle Bootstrap 5 locally:

1. Download `bootstrap.min.css` and `bootstrap.bundle.min.js` (and `bootstrap.rtl.min.css` for RTL) into `static/vendor/bootstrap/`
2. In `base.html`, load Bootstrap CSS BEFORE rwanga.css:
```html
<!-- Load order matters: BS5 first, then Rwanga overrides -->
<link rel="stylesheet" href="{% static 'vendor/bootstrap/bootstrap.rtl.min.css' %}">
<link rel="stylesheet" href="{% static 'css/rwanga.css' %}">
```
3. Load Bootstrap JS locally too:
```html
<script src="{% static 'vendor/bootstrap/bootstrap.bundle.min.js' %}"></script>
```
4. Remove ALL CDN `<link>` and `<script>` tags for Bootstrap.

**Why this matters:** CDN loading is unreliable on the Cloudflare tunnel (slow, sometimes blocked), and load order determines which styles win. Rwanga's design tokens MUST override Bootstrap defaults, so rwanga.css must come second.

**Test:** Disconnect from internet → load any page → Bootstrap styling still works. Cairo font renders on first load, no FOUC (flash of unstyled content).

### R2.3 — Projects page shows self-invitation with placeholder accept/reject

**Symptom:** On the projects list (`/projects/`), there's an invitation bar showing "میوانێکی نادیار — Crew — Super Admin's Studio" with "قبووڵکردن" (Accept) and "ڕەتکردنەوە" (Reject) buttons. The logged-in user IS the studio owner — they shouldn't see an invitation to their own studio. The buttons are placeholders with no action.

**Fix — two parts:**

1. **Filter out self-invitations:** In the projects list view, exclude invitations where the invited user is already a member or owner of the studio:
```python
# In the view that builds the invitation queryset:
invitations = StudioInvitation.objects.filter(
    email=request.user.email,
    status='pending'
).exclude(
    studio__owner=request.user  # don't show self-invitations
).exclude(
    studio__memberships__user=request.user  # don't show if already member
)
```

2. **Wire the accept/reject buttons:** If invitations ARE shown to the right user, the buttons must POST:
```html
<form method="post" action="{% url 'accounts:accept_invitation' invitation.pk %}">
    {% csrf_token %}
    <button type="submit" class="btn btn-primary">قبووڵکردن</button>
</form>
<form method="post" action="{% url 'accounts:reject_invitation' invitation.pk %}">
    {% csrf_token %}
    <button type="submit" class="btn btn-outline-secondary">ڕەتکردنەوە</button>
</form>
```

Create the accept/reject views if they don't exist. Accept should add the user to `Studio.memberships` and delete the invitation. Reject should delete the invitation.

**Test:** As studio owner, `/projects/` should NOT show any self-invitation. Create a test invitation for a different email → that user sees it with working buttons.

### R2.4 — User dropdown not opening (desktop AND mobile)

**Symptom:** The user avatar/name dropdown in the topnav does NOT open on click — not on mobile, not on desktop. This was thought to be mobile-only but affects all viewports.

**Root cause candidates:**

1. **Bootstrap JS not loaded** (covered in R2.2 — if BS5 JS is CDN and fails to load, no dropdowns work)
2. **Missing `data-bs-toggle="dropdown"`** on the trigger element
3. **HTMX intercepting the click** — if the dropdown trigger has any `hx-*` attribute, HTMX might be eating the click before Bootstrap processes it
4. **JavaScript error blocking execution** — check browser console for errors on page load

**Fix — verify this exact markup on the user dropdown trigger:**
```html
<a class="nav-link dropdown-toggle" href="#" role="button"
   data-bs-toggle="dropdown" aria-expanded="false"
   id="userDropdown">
    <!-- avatar + name -->
</a>
<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
    <li><a class="dropdown-item" href="/accounts/profile/">پرۆفایل</a></li>
    <li><a class="dropdown-item" href="/accounts/settings/">ڕێکخستنەکان</a></li>
    <li><hr class="dropdown-divider"></li>
    <li><a class="dropdown-item" href="/accounts/logout/">دەرچوون</a></li>
</ul>
```

Critical checklist:
- `data-bs-toggle="dropdown"` MUST be present on the trigger
- NO `hx-get`, `hx-post`, or `hx-boost` on the trigger or its parent
- `bootstrap.bundle.min.js` MUST be loaded (not just `bootstrap.min.js` — the bundle includes Popper.js which dropdowns require)
- The trigger and menu must be siblings inside a `.dropdown` wrapper

**Test:** Click user avatar → dropdown opens with profile/settings/logout links. Click outside → dropdown closes. Test on both desktop (1920px) and mobile (375px).

### R2.5 — Reviews and Community sections need frontend

**These are the "our review" and "community" sections you mentioned.**

**Reviews** — The backend exists (BibleReview, ReviewDecision, InlineComment, ReviewBatch models + full API). But there's no design-kit template and no functional frontend. Create a minimal but real UI:

- `/reviews/` (or `/projects/<pk>/reviews/`) — list of BibleReview records for the current project
- Each review shows: title, status badge (proposed/locked/rejected), created date, assigned reviewer
- Click a review → detail view showing ReviewDecision items with approve/reject/comment controls
- InlineComment panel on the side (or below) showing threaded comments on each decision

**Community** — Same situation. Backend has ReviewSession, CommunityReview, VoteRecord, CommunityNote, CommunityConfig. Create:

- `/community/` (or `/projects/<pk>/community/`) — list of ReviewSession records
- Each session shows: title, status (draft/open/closed), vote count, date range
- Click a session → detail view with vote tallies, community notes

Both pages must extend `base.html`, use Rwanga design tokens, and support RTL. They don't need to be elaborate — functional CRUD with the real data is enough.

### R2 Validation

After Round 2, verify:
- Notification bell opens AND closes without page refresh
- `/notifications/` renders a full styled page
- Bootstrap works offline (no CDN dependency)
- No self-invitations shown on projects page
- User dropdown opens on desktop and mobile
- `/reviews/` and `/community/` render real data (or empty states if no records exist)
