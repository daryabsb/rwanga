# STABILIZATION ROUND 2 — Remaining Fixes

> **Context:** Round 1 (STABILIZATION-TASK.md) is mostly complete. Priority 00, 0, 1 (partial), 3, 5, and 6 are done. This file contains ONLY the remaining work. Read `rwanga-design-kit/specs/CLAUDE.md` first, then execute everything here.

> **Mode: NON-STOP.** Fix everything. Update Progress after every fix.

> **WeasyPrint blocker acknowledged.** PDF exports (call sheets, shot lists) require native GTK/Pango libraries. The agent logged a GapBlocker — this is acceptable for now. Don't try to fix it; the 503 fallback is fine.

---

## 1 — Scripts stub pages (was Priority 2.2)

Three scripts pages are still stubs showing "coming soon." Replace each with the design-kit template and wire real data.

- `/scripts/<pk>/breakdown/` → copy `rwanga-design-kit/templates/scripts/breakdown.html` into the Django project templates, render ScriptElement data grouped by scene
- `/scripts/<pk>/elements/` → copy `rwanga-design-kit/templates/scripts/elements.html`, render element list with type filters (character, location, prop, wardrobe, vehicle, etc.)
- `/scripts/<pk>/docs/` → copy `rwanga-design-kit/templates/scripts/docs.html`, render script versions and attached documents

Each view must pass real context from the database. Check `rwanga-design-kit/specs/BACKEND_SPEC.md` for expected context variables. If no ScriptElements exist yet for a script, show an empty state — NOT "coming soon."

**Test:** Navigate to each URL with a valid script PK. Must return 200 with real template, not a stub.

---

## 2 — Reviews frontend (was Priority 2.3)

The backend is fully built: `BibleReview`, `ReviewDecision`, `InlineComment`, `ReviewBatch` models all exist with full DRF API. But there is NO frontend page.

Create a minimal functional UI:

**2a — Reviews list page** at `/reviews/` or `/projects/<pk>/reviews/`:
- Extends `base.html`
- Lists `BibleReview` records for the current project
- Each row shows: review title, status badge (proposed → amber, locked → green, rejected → red), created date, assigned reviewer name
- "New Review" button (can be a modal or separate page)
- Uses Rwanga design tokens (dark theme compatible, RTL)

**2b — Review detail page** at `/reviews/<pk>/`:
- Shows the review with its `ReviewDecision` items
- Each decision shows: section/field reference, proposed value, status (proposed/locked/rejected)
- Approve/reject buttons per decision (POST via HTMX)
- `InlineComment` panel below or alongside — threaded comments on each decision, with a reply form

Keep it functional, not elaborate. Real data, real CRUD, real HTMX interactions.

**Test:** `/reviews/` returns 200 with project reviews (or empty state). Click a review → detail page loads. Approve/reject buttons POST and update status.

---

## 3 — Community frontend (was Priority 2.4)

Same situation — backend models exist (`ReviewSession`, `CommunityReview`, `VoteRecord`, `CommunityNote`, `CommunityConfig`), no frontend.

Create:

**3a — Community list** at `/community/` or `/projects/<pk>/community/`:
- Extends `base.html`
- Lists `ReviewSession` records for the current project
- Each row: session title, status badge (draft/open/closed), vote count, date range
- "New Session" button

**3b — Session detail** at `/community/<pk>/`:
- Shows the session with its `CommunityReview` entries
- Vote tallies per review item
- `CommunityNote` feed below
- Add note form (POST via HTMX)

**Test:** `/community/` returns 200. Click a session → detail page loads with votes and notes.

---

## 4 — Notification panel dismiss + full-page view

**Two bugs:**

### 4a — Dropdown doesn't close

The notification bell opens a panel/dropdown, but clicking outside or pressing X does NOT dismiss it. Only a page refresh removes it.

Fix: wire proper dismiss behavior. Either use Bootstrap offcanvas with `data-bs-dismiss`, or add a click-outside handler:

```javascript
// In rwanga.js
document.addEventListener('click', function(e) {
    var panel = document.getElementById('notification-panel');
    var bell = document.getElementById('notification-bell');
    if (panel && !panel.contains(e.target) && !bell.contains(e.target)) {
        panel.remove();
    }
});
```

Also verify the X close button inside the panel has a working click handler.

### 4b — `/notifications/` renders as unstyled partial

Navigating to `rwanga.zeneon.co.uk/notifications/` shows the notification panel content on a blank white page — no sidebar, no topnav, no styling. The view returns a partial template that doesn't extend `base.html`.

Fix:
- Keep the existing partial as `notifications/_panel.html` (for the dropdown bell)
- Create `notifications/list.html` extending `base.html` for the full-page view
- The full-page view should list ALL notifications with: read/unread indicator, timestamp, message text, link to relevant object
- Wire a view at `/notifications/` that renders this full-page template

**Test:** Click bell → panel opens → click X → panel closes. Click "ھەموو ئاگادارکردنەوەکان ببینە" → `/notifications/` → full page with sidebar and topnav.

---

## 5 — Bootstrap 5 local bundling (CSS load order fix)

BS5 currently loads from CDN and loads AFTER `rwanga.css`, causing: fonts not rendering correctly, style conflicts, Cairo font not applying.

**Fix:**

1. Download these files into `static/vendor/bootstrap/`:
   - `bootstrap.rtl.min.css` (RTL variant)
   - `bootstrap.bundle.min.js` (includes Popper.js)

2. In `base.html`, set the correct load order — BS5 FIRST, then Rwanga overrides:
```html
<link rel="stylesheet" href="{% static 'vendor/bootstrap/bootstrap.rtl.min.css' %}">
<link rel="stylesheet" href="{% static 'css/rwanga.css' %}">
```

3. Load Bootstrap JS locally:
```html
<script src="{% static 'vendor/bootstrap/bootstrap.bundle.min.js' %}"></script>
```

4. **Remove ALL CDN `<link>` and `<script>` tags for Bootstrap** from `base.html` and any other template that loads them (check `login.html`, `register.html` too).

5. Run `python manage.py collectstatic` if using collected static files.

**Test:** Disconnect from internet → reload any page → Bootstrap styling still works, Cairo font renders, dark mode works. No FOUC.

---

## 6 — Projects page self-invitation with dead buttons

On `/projects/`, the logged-in studio owner sees an invitation bar: "میوانێکی نادیار — Crew — Super Admin's Studio" with Accept/Reject buttons that do nothing.

**Fix — two parts:**

### 6a — Filter out self-invitations
In the projects list view, exclude invitations where the user is already owner or member:

```python
invitations = StudioInvitation.objects.filter(
    email=request.user.email,
    status='pending'
).exclude(
    studio__owner=request.user
).exclude(
    studio__memberships__user=request.user
)
```

### 6b — Wire accept/reject buttons
For invitations that ARE legitimate, the buttons must POST:

```html
<form method="post" action="{% url 'accounts:accept_invitation' invitation.pk %}">
    {% csrf_token %}
    <button type="submit" class="btn btn-primary">قبووڵکردن</button>
</form>
```

Create `accept_invitation` and `reject_invitation` views if they don't exist:
- Accept: add user to `Studio.memberships`, delete invitation, redirect to `/projects/`
- Reject: delete invitation, redirect to `/projects/`

**Test:** As studio owner, `/projects/` should NOT show any self-invitation. No dead buttons anywhere.

---

## 7 — User dropdown not opening (desktop AND mobile)

The user avatar/name dropdown in the topnav does NOT open on click — on ANY viewport.

**Likely root causes (check all):**

1. **Bootstrap bundle JS not loaded** — if only `bootstrap.min.js` is loaded (not the bundle), Popper.js is missing and dropdowns won't work. Fix covered in section 5 above, but verify.

2. **Missing `data-bs-toggle="dropdown"`** on the trigger element. Verify this exact markup:
```html
<div class="dropdown">
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
</div>
```

3. **HTMX intercepting the click** — if the dropdown trigger has `hx-get`, `hx-post`, or `hx-boost`, HTMX eats the click. Remove ALL `hx-*` attributes from the user dropdown trigger.

4. **JS error blocking Bootstrap init** — check browser console on page load for errors.

**Critical:** the trigger and `.dropdown-menu` must be siblings inside a `.dropdown` or `.nav-item.dropdown` wrapper.

**Test:** Click user avatar → dropdown opens. Click outside → closes. Test at 1920px AND 375px.

---

## 8 — Mobile viewport meta tag

Verify `base.html` contains:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

If missing, add it inside `<head>`. Test login page and projects list at 375px width — content must not overflow horizontally.

---

## Validation Checklist

After ALL Round 2 fixes:

```bash
# 1. System checks
python manage.py check
python manage.py makemigrations --check

# 2. All pages return 200 (logged in):
#    /scripts/<pk>/breakdown/
#    /scripts/<pk>/elements/
#    /scripts/<pk>/docs/
#    /reviews/              (or /projects/<pk>/reviews/)
#    /community/            (or /projects/<pk>/community/)
#    /notifications/

# 3. Notification bell opens AND closes without refresh

# 4. User dropdown opens on desktop and mobile

# 5. No CDN requests for Bootstrap (check Network tab)

# 6. No self-invitation shown for studio owner on /projects/

# 7. All tests pass
pytest -x
```

## MANDATORY — Progress Updates

For every fix:
1. Update the corresponding ProgressTask status
2. Create a ProgressUpdate with files_affected and summary

At the end, create an AgentReport:
```python
AgentReport.objects.create(
    agent_name="engineering-agent",
    session_id="stabilization-round-2",
    report_type="phase_completion",
    phase="stabilization-r2",
    summary="Scripts stubs replaced, Reviews + Community frontend built, notifications fixed, BS5 bundled locally, self-invitation filtered, user dropdown fixed."
)
```
