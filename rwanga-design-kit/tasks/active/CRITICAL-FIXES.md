# CRITICAL FIXES — 3 Items, No Excuses

> These are the 3 highest-impact bugs in Rwanga right now. Each one has an exact fix and an exact verification step. Do NOT report success until the verification passes.

## Fix 1 — bootstrap.bundle.min.js is MISSING (404)

The file `/static/vendor/bootstrap/bootstrap.bundle.min.js` does not exist. It returns 404. This breaks EVERY dropdown, modal, and tooltip in the entire application.

**Exact fix:**

```bash
# Step 1: Download the actual Bootstrap 5.3.3 bundle JS
cd E:/api/rwanga/static/vendor/bootstrap/
curl -o bootstrap.bundle.min.js https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js
```

If curl is not available:
```python
# In Django shell or a management command:
import urllib.request
urllib.request.urlretrieve(
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'E:/api/rwanga/static/vendor/bootstrap/bootstrap.bundle.min.js'
)
```

Then if using collectstatic:
```bash
python manage.py collectstatic --noinput
```

**Verification — do this BEFORE reporting success:**
```bash
# Must return the file size (200+ KB), not an error:
ls -la E:/api/rwanga/static/vendor/bootstrap/bootstrap.bundle.min.js

# Start the server and test:
python manage.py runserver 0.0.0.0:8020
# Then in another terminal:
curl -s -o /dev/null -w "%{http_code}" http://localhost:8020/static/vendor/bootstrap/bootstrap.bundle.min.js
# MUST print: 200
# If it prints 404 or 503, the fix failed.
```

**After this fix works:** click the user avatar (SA button) in the top-left of any page. A dropdown MUST appear with Profile, Settings, Logout links. If it doesn't appear, the fix is not done.

---

## Fix 2 — Project settings page is a stub

`/projects/<pk>/settings/` shows "Project settings — coming soon". This page has a design-kit template at `rwanga-design-kit/templates/projects/settings.html`.

**Exact fix:**

1. Copy the template:
```bash
cp E:/api/rwanga/../normalize/rwanga-design-kit/templates/projects/settings.html E:/api/rwanga/src/projects/templates/projects/settings.html
```
(Adjust the source path if the design-kit is elsewhere. The template file is `rwanga-design-kit/templates/projects/settings.html`.)

2. Create or update the view in `src/projects/views.py`:
```python
class ProjectSettingsView(LoginRequiredMixin, UpdateView):
    model = Project
    template_name = 'projects/settings.html'
    fields = ['title', 'title_latin', 'logline', 'status', 'genre']
    
    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['project'] = self.get_object()
        return ctx
    
    def get_success_url(self):
        return reverse('projects:settings', kwargs={'pk': self.object.pk})
```

3. Wire the URL in `src/projects/urls.py`:
```python
path('<uuid:pk>/settings/', ProjectSettingsView.as_view(), name='settings'),
```

4. If the view already exists but renders a stub template, just replace the template file. Keep the existing view logic.

**Verification:**
```bash
curl -s -o /dev/null -w "%{http_code}" -b "sessionid=YOUR_SESSION" http://localhost:8020/projects/b7821ef2-bef1-4527-b192-625ac0977aa5/settings/
# MUST print: 200
```
And the page MUST NOT contain the text "coming soon". Grep for it:
```bash
curl -s -b "sessionid=YOUR_SESSION" http://localhost:8020/projects/b7821ef2-bef1-4527-b192-625ac0977aa5/settings/ | grep -i "coming soon"
# MUST return empty (no match)
```

---

## Fix 3 — Find and kill ALL remaining "coming soon" stubs

Search the entire codebase for any remaining "coming soon" text:

```bash
grep -r "coming soon" E:/api/rwanga/src/ --include="*.html" --include="*.py" -l
```

For every file found:
- If there's a design-kit template for that page, copy it and wire the view
- If there's no design-kit template, replace the stub with a real page extending base.html that shows actual data or an empty state ("هیچ داتایەک نییە" / "No data yet")

**Verification:**
```bash
grep -r "coming soon" E:/api/rwanga/src/ --include="*.html" --include="*.py"
# MUST return empty (zero matches)
```

---

## Order of execution

1. Fix 1 first (Bootstrap JS) — this unblocks everything interactive
2. Fix 2 (project settings)
3. Fix 3 (remaining stubs)

## Progress update

After ALL THREE are verified, create ONE ProgressUpdate:
```python
ProgressUpdate.objects.create(
    task=...,  # find or create appropriate task
    update_type='fix',
    summary='Critical: downloaded bootstrap.bundle.min.js (was 404), replaced project settings stub, eliminated all remaining coming-soon stubs.',
    files_affected='static/vendor/bootstrap/bootstrap.bundle.min.js, src/projects/templates/projects/settings.html'
)
```
