# Project Create Wizard — Real CRUD Implementation

**Priority:** HIGH — this is the P1 gap blocking all project-scoped features
**Date:** 2026-04-30
**Prerequisite:** CSRF fix deployed (`CSRF_TRUSTED_ORIGINS` includes `rwanga.zeneon.co.uk`)

---

## What This Is

The project create wizard at `/projects/create/` currently has a working 4-step UI template but **no backend persistence**. Clicking "Next" on Step 1 either triggers HTML5 validation or advances a session counter without creating a Project in the database.

This task implements real CRUD: Step 1 creates the Project, Steps 2-4 add data to it, and the wizard redirects to the new project dashboard on completion.

---

## GOLDEN RULE: Template Is Already Done — Don't Touch It

The design-kit template `projects/create_wizard.html` is production-ready and already deployed. It handles all 4 steps with proper HTMX attributes, form fields, and Kurdish i18n.

**DO NOT:**
- Modify `create_wizard.html` or any existing template
- Change existing model fields in `src/projects/models.py`
- Alter existing URL patterns
- Touch `base.html`, `rwanga.css`, or `rwanga.js`
- Restructure any existing code

**DO:**
- Create `src/projects/services.py` (if missing) with `ProjectService`
- Create `src/projects/forms.py` (if missing) with wizard step forms
- Modify `src/projects/views.py` to add real persistence logic to the wizard views
- Add tests in `src/projects/tests/`

---

## Step 0: Audit Current State (MANDATORY)

Before writing any code:

1. Check `src/projects/models.py` — list the actual Project model fields
2. Check `src/projects/views.py` — find the current wizard view(s) and understand what they do now
3. Check `src/projects/urls.py` — find the URL patterns for `create_wizard` and `create_step`
4. Check `src/projects/forms.py` — does it exist? What forms are defined?
5. Check `src/projects/services.py` — does it exist?
6. Check what the template actually expects:
   - Step 1 POSTs to `{% url 'projects:create_step' 1 %}`
   - Step 2 POSTs to `{% url 'projects:create_step' 2 %}` with file upload
   - Step 3 POSTs to `{% url 'projects:create_step' 3 %}`
   - Step 4 POSTs to `{% url 'projects:create_step' 4 %}`
   - Each step targets `#rw-wizard-body` via `hx-target`
   - Steps 2-4 send `project_id` as hidden field

**Present your audit findings and execution plan. WAIT for approval.**

---

## Step 1: Create ProjectService

Create `src/projects/services.py` (or extend if it exists):

```python
"""
src.projects.services
~~~~~~~~~~~~~~~~~~~~~

Business logic for Project operations.
Single write path for views, API, and future MCP tools.

Dependencies:
    - src.projects.models.Project, Scene, Character, Location
    - src.accounts.models.Studio, ProjectMembership
"""
from django.db import transaction
from src.projects.models import Project


class ProjectService:
    """
    Service layer for Project operations.

    Responsibilities:
        - Project CRUD with validation
        - Wizard step persistence
        - Studio-scoped project access

    Usage:
        service = ProjectService(user=request.user)
        project = service.create_project(title="...", project_type="feature")
    """

    def __init__(self, user=None):
        self.user = user

    def create_project(self, *, title, title_latin='', project_type='feature',
                       logline='', director_name='', studio=None) -> Project:
        """
        Create a new project (Step 1 of wizard).

        Args:
            title: Kurdish project title (required)
            title_latin: Latin/English title
            project_type: One of feature/short/episode/music_video/commercial
            logline: Short description
            director_name: Director's name
            studio: Studio instance (auto-resolved from user if None)

        Returns:
            Created Project instance

        Raises:
            ValidationError: If title is empty or project_type is invalid
        """
        if studio is None:
            studio = self._get_or_create_studio()

        project = Project.objects.create(
            studio=studio,
            title=title,
            title_latin=title_latin,
            project_type=project_type,
            logline=logline,
            status='draft',
        )

        # Create ProjectMembership for the creator as director
        from src.accounts.models import ProjectMembership
        ProjectMembership.objects.create(
            user=self.user,
            project=project,
            role_type='crew',
            department_role='director',
            is_active=True,
        )

        return project

    def update_project_modules(self, project, modules):
        """
        Update which modules are enabled for a project (Step 3).

        Args:
            project: Project instance
            modules: List of module key strings
        """
        # Store as JSON field or project settings
        # Adapt to actual model field available
        if hasattr(project, 'enabled_modules'):
            project.enabled_modules = modules
            project.save(update_fields=['enabled_modules', 'updated_at'])

    def _get_or_create_studio(self):
        """Get user's studio or create a default one."""
        from src.accounts.models import Studio
        # Check if user has a studio
        studio = Studio.objects.filter(
            memberships__user=self.user
        ).first()
        if not studio:
            studio = Studio.objects.create(
                name=f"{self.user.get_full_name() or self.user.email}'s Studio",
            )
        return studio
```

**IMPORTANT:** Check the actual Project model fields first. The fields above are from the design spec (`title`, `title_latin`, `project_type`, `logline`, `cover`, `status`). If the actual model has different field names, adapt the service. If `director_name` is not a field on Project, store it differently (e.g., via the ProjectMembership created for the user).

---

## Step 2: Create Wizard Forms

Create `src/projects/forms.py` (or extend if it exists):

```python
"""
src.projects.forms
~~~~~~~~~~~~~~~~~~

Django forms for project wizard steps.
"""
from django import forms
from src.projects.models import Project


PROJECT_TYPE_CHOICES = [
    ('feature', 'فیلمی درێژ'),
    ('short', 'فیلمی کورت'),
    ('episode', 'ئێپیزۆدی تەلەویزیۆن'),
    ('music_video', 'فیدیۆی گۆرانی'),
    ('commercial', 'ڕیکلام'),
]


class ProjectBasicsForm(forms.Form):
    """Step 1: Project basics."""
    title = forms.CharField(max_length=200, required=True)
    title_latin = forms.CharField(max_length=200, required=False)
    project_type = forms.ChoiceField(choices=PROJECT_TYPE_CHOICES, initial='feature')
    director_name = forms.CharField(max_length=200, required=False)
    logline = forms.CharField(widget=forms.Textarea, required=False)


class ScriptUploadForm(forms.Form):
    """Step 2: Script file upload."""
    project_id = forms.UUIDField(widget=forms.HiddenInput)
    script_file = forms.FileField(required=False)
    skip = forms.BooleanField(required=False)


class ModuleSelectionForm(forms.Form):
    """Step 3: Module selection."""
    project_id = forms.UUIDField(widget=forms.HiddenInput)
    modules = forms.MultipleChoiceField(
        required=False,
        widget=forms.CheckboxSelectMultiple,
        choices=[
            ('scripts', 'Scripts'),
            ('shots', 'Shots'),
            ('floorplans', 'Floor Plans'),
            ('scheduling', 'Scheduling'),
            ('departments', 'Departments'),
            ('ai_engine', 'AI Engine'),
        ]
    )


class TeamInviteForm(forms.Form):
    """Step 4: Single team invite row."""
    project_id = forms.UUIDField(widget=forms.HiddenInput)
    email = forms.EmailField(required=False)
    role = forms.CharField(max_length=50, required=False)
```

---

## Step 3: Implement Wizard View Logic

Modify `src/projects/views.py` — find the existing wizard view(s) and add real persistence. The template expects:

- `GET /projects/create/` → render Step 1 (or resume from session)
- `POST /projects/create/step/<int:step>/` → process step, return next step HTML via HTMX

### Key behavior per step:

**Step 1 POST:**
```python
def create_step_1(self, request):
    form = ProjectBasicsForm(request.POST)
    if form.is_valid():
        service = ProjectService(user=request.user)
        project = service.create_project(
            title=form.cleaned_data['title'],
            title_latin=form.cleaned_data['title_latin'],
            project_type=form.cleaned_data['project_type'],
            logline=form.cleaned_data['logline'],
            director_name=form.cleaned_data['director_name'],
        )
        # Store project ID in session for subsequent steps
        request.session['wizard_project_id'] = str(project.pk)
        # Return Step 2 HTML (HTMX swap into #rw-wizard-body)
        return render(request, 'projects/create_wizard.html', {
            'step': 2,
            'project': project,
            'wizard_steps': self.get_wizard_steps(),
        })
    else:
        # Re-render Step 1 with errors
        return render(request, 'projects/create_wizard.html', {
            'step': 1,
            'form': form,
            'wizard_steps': self.get_wizard_steps(),
        })
```

**Step 2 POST (Script Upload):**
```python
def create_step_2(self, request):
    project = Project.objects.get(pk=request.POST.get('project_id'))
    skip = request.POST.get('skip')
    if not skip and request.FILES.get('script_file'):
        # Save script file to project
        # If Script model exists, create Script instance
        # Otherwise store on project
        pass
    # Advance to Step 3
    return render(request, 'projects/create_wizard.html', {
        'step': 3,
        'project': project,
        'available_modules': self.get_available_modules(),
        'wizard_steps': self.get_wizard_steps(),
    })
```

**Step 3 POST (Modules):**
```python
def create_step_3(self, request):
    project = Project.objects.get(pk=request.POST.get('project_id'))
    modules = request.POST.getlist('modules')
    service = ProjectService(user=request.user)
    service.update_project_modules(project, modules)
    return render(request, 'projects/create_wizard.html', {
        'step': 4,
        'project': project,
        'wizard_steps': self.get_wizard_steps(),
    })
```

**Step 4 POST (Team Invites):**
```python
def create_step_4(self, request):
    project = Project.objects.get(pk=request.POST.get('project_id'))
    # Process invite rows (multiple emails/roles)
    emails = request.POST.getlist('email')
    roles = request.POST.getlist('role')
    for email, role in zip(emails, roles):
        if email:  # Skip empty rows
            # Queue invite (or create placeholder membership)
            pass
    # Wizard complete — update project status
    project.status = 'active'
    project.save(update_fields=['status', 'updated_at'])
    # Clear wizard session data
    request.session.pop('wizard_project_id', None)
    # Redirect to project dashboard
    from django.http import HttpResponseRedirect
    from django.urls import reverse
    return HttpResponseRedirect(reverse('projects:dashboard', args=[project.pk]))
```

### Helper methods:

```python
def get_wizard_steps(self):
    """Return step definitions for the step bar."""
    return [
        {'num': 1, 'label': 'بنەڕەتەکان'},
        {'num': 2, 'label': 'دەستنووس'},
        {'num': 3, 'label': 'مۆدیولەکان'},
        {'num': 4, 'label': 'تیم'},
    ]

def get_available_modules(self):
    """Return module list for Step 3 checkboxes."""
    return [
        {'key': 'scripts', 'icon': '📄', 'name': 'دەستنووس', 'desc': 'بارکردن و داڕشتنی دەستنووس', 'required': True, 'default': True, 'ai': True, 'rwanga': False},
        {'key': 'shots', 'icon': '🎬', 'name': 'شۆتەکان', 'desc': 'لیستی شۆت و ستۆریبۆرد', 'required': False, 'default': True, 'ai': False, 'rwanga': False},
        {'key': 'floorplans', 'icon': '📐', 'name': 'پلانی زەوی', 'desc': 'نەخشەی لۆکەیشن و کامێرا', 'required': False, 'default': True, 'ai': True, 'rwanga': True},
        {'key': 'scheduling', 'icon': '📅', 'name': 'خشتەبەندی', 'desc': 'ڕۆژانی وێنەگرتن و کۆڵشیت', 'required': False, 'default': False, 'ai': False, 'rwanga': False},
        {'key': 'departments', 'icon': '🏷', 'name': 'بەشەکان', 'desc': 'ڕووناکی، دەنگ، جلوبەرگ، کەلوپەل', 'required': False, 'default': False, 'ai': False, 'rwanga': False},
        {'key': 'ai_engine', 'icon': '🤖', 'name': 'AI ئەنجین', 'desc': 'داڕشتنی خۆکار و پێشنیاری AI', 'required': False, 'default': False, 'ai': True, 'rwanga': True},
    ]
```

### HTMX response note:

The template uses `hx-target="#rw-wizard-body"` and `hx-swap="innerHTML"`. This means your step POST responses should return the **inner content** of the wizard body, not the full page. Check whether the current view returns a full page or a partial. If HTMX sends an `HX-Request` header, return only the wizard body content. If it's a regular request, return the full page.

```python
def _render_step(self, request, context):
    """Render full page or HTMX partial based on request type."""
    if request.headers.get('HX-Request'):
        # Return just the wizard body content
        return render(request, 'projects/_wizard_step.html', context)
    else:
        # Return full page
        return render(request, 'projects/create_wizard.html', context)
```

**However:** If the template is monolithic (all steps in one file with `{% if step == N %}` blocks), then always return the full template — HTMX will swap the target div. Check what `create_wizard.html` actually does. From my reading, it's a single template with `{% if step == 1 %}...{% elif step == 2 %}...` blocks, so returning the full page should work — HTMX will extract `#rw-wizard-body`.

---

## Step 4: Write Tests (TDD — Rule 1)

Create `src/projects/tests/test_wizard.py`:

```python
"""
Tests for project creation wizard.
Test-first per CLAUDE.md Rule 1.
"""
import pytest
from django.test import TestCase, Client
from django.urls import reverse
from src.projects.models import Project


class TestProjectWizardStep1(TestCase):
    """Step 1: Create project with basic info."""

    def setUp(self):
        self.client = Client()
        # Create and login a test user
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.user = User.objects.create_user(
            email='test@test.com', password='testpass123'
        )
        self.client.login(email='test@test.com', password='testpass123')

    def test_step1_creates_project(self):
        """POST Step 1 with valid data creates a Project in DB."""
        response = self.client.post(
            reverse('projects:create_step', args=[1]),
            {'title': 'میوانێکی نادیار', 'title_latin': 'Mysterious Guest',
             'project_type': 'feature', 'director_name': 'Sarwar'}
        )
        self.assertEqual(Project.objects.count(), 1)
        project = Project.objects.first()
        self.assertEqual(project.title, 'میوانێکی نادیار')
        self.assertEqual(project.project_type, 'feature')

    def test_step1_requires_title(self):
        """POST Step 1 without title returns form with errors."""
        response = self.client.post(
            reverse('projects:create_step', args=[1]),
            {'title': '', 'project_type': 'feature'}
        )
        self.assertEqual(Project.objects.count(), 0)

    def test_step1_returns_step2(self):
        """After Step 1 success, response contains Step 2 content."""
        response = self.client.post(
            reverse('projects:create_step', args=[1]),
            {'title': 'Test Film', 'project_type': 'feature'}
        )
        # Should contain script upload content
        self.assertContains(response, 'script_file', status_code=200)

    def test_step1_stores_project_in_session(self):
        """Step 1 stores project ID in session for subsequent steps."""
        self.client.post(
            reverse('projects:create_step', args=[1]),
            {'title': 'Test Film', 'project_type': 'feature'}
        )
        project = Project.objects.first()
        session = self.client.session
        self.assertEqual(session.get('wizard_project_id'), str(project.pk))


class TestProjectWizardStep4(TestCase):
    """Step 4: Complete wizard and redirect to dashboard."""

    def setUp(self):
        self.client = Client()
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.user = User.objects.create_user(
            email='test@test.com', password='testpass123'
        )
        self.client.login(email='test@test.com', password='testpass123')
        # Create a project via Step 1 first
        self.client.post(
            reverse('projects:create_step', args=[1]),
            {'title': 'Test Film', 'project_type': 'feature'}
        )
        self.project = Project.objects.first()

    def test_step4_redirects_to_dashboard(self):
        """Completing Step 4 redirects to project dashboard."""
        response = self.client.post(
            reverse('projects:create_step', args=[4]),
            {'project_id': str(self.project.pk)},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn(str(self.project.pk), response.url)

    def test_step4_activates_project(self):
        """Step 4 sets project status to active."""
        self.client.post(
            reverse('projects:create_step', args=[4]),
            {'project_id': str(self.project.pk)},
        )
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'active')
```

**IMPORTANT:** Adapt these tests to the actual model fields and URL names. Run the tests FIRST (they should fail), then implement the code to make them pass.

---

## Step 5: Validate

```
[ ] python manage.py test src.projects.tests.test_wizard (all pass)
[ ] python manage.py runserver starts without errors
[ ] Visit /projects/create/ — Step 1 form renders
[ ] Fill Step 1 form, click Next — Project created in DB
[ ] Step 2 renders with file upload zone and project_id hidden field
[ ] Skip Step 2 — Step 3 renders with module checkboxes
[ ] Complete Step 3 — Step 4 renders with team invite form
[ ] Complete Step 4 — redirects to /projects/<uuid>/
[ ] Project dashboard shows the created project
[ ] Visit /projects/ — project appears in list
[ ] Check Django admin — project visible with correct fields
```

---

## Step 6: Update Progress App

```python
from src.progress.services import ProgressService
s = ProgressService()

task = s.create_task(
    title="P1: Implement project create wizard persistence",
    description="Real CRUD in 4-step wizard: Project creation, script upload, module selection, team invites",
    task_type="implementation",
    phase="P1",
    app_name="projects",
    priority="high",
)
# After completion:
s.update_task_status(task_id=str(task.pk), status="completed",
                     note="Wizard creates Project in DB, 4 steps persisted, tests passing")
```

---

## Step 7: Commit

```
feat(projects): implement real CRUD in project create wizard

- Create ProjectService with create_project method
- Add ProjectBasicsForm and step forms for validation
- Wire Step 1 POST to create Project in DB
- Wire Steps 2-4 to update project data
- Step 4 completes wizard and redirects to project dashboard
- Add wizard integration tests
```

---

## What NOT To Do

1. **DO NOT** modify `create_wizard.html` — the template is finished
2. **DO NOT** change Project model fields — work with what exists
3. **DO NOT** implement script AI breakdown — that's P5
4. **DO NOT** implement real email invites — just store the data for now
5. **DO NOT** add new URL patterns — use the existing `create_wizard` and `create_step` URLs
6. **DO NOT** change any existing working view — only modify the wizard view logic

---

## Reference Files

| File | Purpose |
|------|---------|
| `rwanga-design-kit/templates/projects/create_wizard.html` | Production template — 4 steps with HTMX |
| `MASTER-DESIGN.md` Part 4, `projects` section | Project model: studio, title, title_latin, project_type, logline, cover, status |
| `MASTER-DESIGN.md` Part 4, `accounts` section | ProjectMembership model for team/roles |
| `BACKEND_SPEC.md` | HTMX patterns, URL routing conventions |
| `CLAUDE.md` Rule 1 | TDD — test first |
| `CLAUDE.md` Rule 4 | Business logic in services, not views |
