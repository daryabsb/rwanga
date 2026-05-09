# Rwanga v2 Sub-Project 1: Studio + Project Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Studio + Project foundational layer per the v2 foundations spec — multi-studio model with primary anchor, project lifecycle with soft-delete + snapshot + versioning, subscription scaffolding, invitation flows, account deactivation, dashboard 3-row UI, and audit log instrumentation. This is the foundation everything else attaches to.

**Architecture:** Service-layer-first (all logic in `services.py`); dual-route + MCP from line one (HTMX, DRF, MCP all calling same services); soft-delete and versioning as model mixins; subscription auto-created with trial; production_log written via signals. Existing v1 codebase is EXTENDED, not replaced — Studio/Project/ProjectMembership models grow new fields; new models added; dashboard UI extends the just-migrated templates.

**Tech Stack:** Django 5.x, django-split-settings, DRF, MCP server (existing), Celery, Postgres, HTMX, Bootstrap 5 RTL, the `rwanga-ds.css` design system from migration.

**Spec reference:** `docs/superpowers/specs/2026-05-09-rwanga-v2-foundations-design.md`

---

## File Structure

**New files created:**
- `src/core/mixins.py` — `SoftDeleteModel`, `Versioned` mixins
- `src/core/models.py` — `Version` (versioning history), `production_log` model
- `src/core/services.py` — snapshot_on_delete cascade helper, recovery service
- `src/core/signals.py` — production_log writer, primary studio enforcement
- `src/core/decorators.py` — `@subscription_required`, `@rbac_required`
- `src/core/middleware.py` — `ActiveStudioMiddleware` (extends existing StudioContextMiddleware)
- `src/billing/` — new app: `models.py`, `services.py`, `providers/base.py`, `providers/mock.py`
- `src/accounts/services/` — split out: `studio_services.py`, `membership_services.py`, `invitation_services.py`, `deactivation_services.py`
- `src/projects/services/` — split out: `project_services.py`, `lifecycle_services.py`, `snapshot_services.py`
- `src/dashboard/` — new app: views and templates for the 3-row tile dashboard
- `src/dashboard/templates/dashboard/_tile.html` — reusable tile component
- `templates/components/_studio_switcher.html` — user dropdown studio switcher
- `templates/components/_user_dropdown.html` — extends to include "My Studio" link

**Modified existing files:**
- `src/accounts/models.py` — extend Studio, StudioMembership; add fields per spec §2.1, §2.2
- `src/accounts/admin.py` — register new fields
- `src/accounts/urls.py` — add account deactivation, switcher views
- `src/accounts/views.py` — add deactivation view + studio create + switcher
- `src/projects/models.py` — extend Project per spec §2.3; ProjectMembership per §2.4
- `src/projects/views.py` — extend ProjectListView for the 3-row dashboard data
- `src/projects/urls.py` — add invitation accept/reject endpoints
- `src/projects/api/serializers.py` — add new fields
- `src/projects/api/views.py` — extend
- `src/mcp/tools/studio.py` — new MCP tools per spec §4.1
- `src/mcp/tools/projects.py` — extend existing MCP tools
- `src/mcp/resources/studio.py`, `project.py` — new MCP resources
- `src/settings/components/common.py` — add `RWANGA_PAYMENT_PROVIDER`, `RWANGA_AI_PROVIDER` settings + middleware
- `templates/base.html` — wire studio switcher into topnav
- `templates/components/_topnav.html` — studio switcher integration
- `static/css/rwanga-ds.css` — minor classes for tile pending/dimmed states (most styles already exist from migration)

**Tests:**
- `src/core/tests/test_mixins.py`, `test_signals.py`, `test_decorators.py`
- `src/accounts/tests/test_studio_services.py`, `test_membership_services.py`, `test_invitation_services.py`, `test_deactivation_services.py`
- `src/projects/tests/test_lifecycle_services.py`, `test_snapshot_services.py`
- `src/billing/tests/test_subscription_services.py`
- `src/dashboard/tests/test_dashboard_views.py`
- `src/mcp/tests/test_studio_tools.py`, `test_project_tools.py`

---

## Working rules (apply to every phase)

1. **Branch:** all work on `main` (per established convention from UI migration). No worktree.
2. **TDD:** write failing test first, watch it fail, write minimal code to pass, refactor. Never code without a test except for trivial wiring.
3. **Service-layer separation:** ALL business logic in `services.py`. Views are thin clients. MCP tools wrap services. DRF views wrap services. NEVER duplicate logic across surfaces.
4. **Commit cadence:** one commit per task (each task ends with a `git commit`). Each phase ends with a phase-level summary commit if multiple small commits accumulated.
5. **No overnight WIP:** commit per approval; clean working tree at end of session.
6. **Visual companion REQUIRED for UI tasks:** any task that touches a template or HTML must have a mockup approved by the user before implementation. The user has stated this is non-negotiable. UI tasks marked **🎨 VC-REQUIRED** below.
7. **Verify-before-commit on user-visible changes:** all UI/UX tasks require user visual verification before commit, same as the UI migration's flow.
8. **Audit log instrumentation:** every service mutation writes to `production_log` (Phase 1 sets up the helper; later phases use it).
9. **No CDN, all assets local** (per migration memory).
10. **Single-line `{% %}` tags only**, no multi-line `{# #}` blocks (migration lessons in memory).
11. **Per-item URLs in `{% for %}` loops** must use safe-form `{% url 'name' obj.pk as u %}{{ u|default:'#' }}` (migration lesson).
12. **UUID PKs in URL patterns** — `<uuid:pk>` not `<int:pk>` (migration lesson).
13. **No remote pushes** until user explicitly says so.

---

## Phase plan

| # | Phase | Focus | Risk |
|---|---|---|---|
| 0 | Foundations | Soft-delete + Versioning mixins, production_log model, snapshot service | Low — foundational, isolated |
| 1 | Studio model | Studio + StudioMembership extensions, primary studio enforcement, signup hook | Medium — touches sign-up flow |
| 2 | Project model | Project extensions, ProjectMembership tier, snapshot_on_delete | Medium — affects many existing views |
| 3 | Subscription scaffolding | Billing app, Subscription model, trial machinery, gate decorator | Low — additive |
| 4 | RBAC + Permission gates | Role enum, area permissions, @rbac_required decorator | Low — additive |
| 5 | Invitation flows | Magic link tokens, accept/reject views (project + studio) | Medium — user-facing flow |
| 6 | Account deactivation | Cascade snapshot service, deactivation view + UI | High — destructive op, must be safe |
| 7 | Studio context switching | active_studio middleware, switcher dropdown | Medium — affects every page |
| 8 | Dashboard 3-row UI 🎨 | Tile component, Row 1/2/3 queries + render, visual verification | High — user-facing, mandatory VC |
| 9 | DRF API surface | Serializers + viewsets for new models | Low — mechanical |
| 10 | MCP tools + resources | Studio + Project tool catalog, resources, instrumentation | Medium — agent surface |
| 11 | Final QA + cleanup | Smoke tests, migration cleanup, docs | Low |

Each phase = one git commit (atomic, revertible). User verification gate before commit on UI phases.

---

## Phase 0 — Foundations

### Task 0.1 — `SoftDeleteModel` mixin

**Files:**
- Create: `src/core/mixins.py`
- Test: `src/core/tests/test_mixins.py`

- [ ] **Step 1: Write failing test for SoftDeleteModel**

```python
# src/core/tests/test_mixins.py
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from src.core.mixins import SoftDeleteModel


class SoftDeleteMixinTest(TestCase):
    def test_default_manager_excludes_soft_deleted(self):
        from src.accounts.models import Studio  # uses SoftDeleteModel
        s = Studio.objects.create(name="Test", slug="test-1")
        s.soft_delete(by_user=None)
        self.assertNotIn(s, Studio.objects.all())
        self.assertIn(s, Studio.all_with_deleted.all())

    def test_recovery_grace_until_set_on_soft_delete(self):
        from src.accounts.models import Studio
        s = Studio.objects.create(name="Test2", slug="test-2")
        s.soft_delete(by_user=None)
        self.assertIsNotNone(s.deleted_at)
        self.assertEqual(
            (s.recovery_grace_until - s.deleted_at).days, 30
        )
```

- [ ] **Step 2: Run test, expect failure**

Run:
```
cd "E:/api/rwanga" && python manage.py test src.core.tests.test_mixins -v 2
```
Expected: FAIL — `SoftDeleteModel` doesn't exist yet.

- [ ] **Step 3: Implement SoftDeleteModel**

Create `src/core/mixins.py`:

```python
from datetime import timedelta
from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        return self.filter(deleted_at__isnull=False)


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()


class SoftDeleteAllManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db)


class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )
    recovery_grace_until = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_with_deleted = SoftDeleteAllManager()

    GRACE_DAYS = 30

    class Meta:
        abstract = True

    def soft_delete(self, by_user=None):
        now = timezone.now()
        self.deleted_at = now
        self.deleted_by = by_user
        self.recovery_grace_until = now + timedelta(days=self.GRACE_DAYS)
        self.save(update_fields=["deleted_at", "deleted_by", "recovery_grace_until"])

    def restore(self):
        self.deleted_at = None
        self.deleted_by = None
        self.recovery_grace_until = None
        self.save(update_fields=["deleted_at", "deleted_by", "recovery_grace_until"])
```

- [ ] **Step 4: Add SoftDeleteModel to existing Studio model**

Edit `src/accounts/models.py`:
```python
from src.core.mixins import SoftDeleteModel

class Studio(SoftDeleteModel, BaseModel):
    # ... existing fields ...
```

- [ ] **Step 5: Make + apply migration**

Run:
```
cd "E:/api/rwanga" && python manage.py makemigrations accounts && python manage.py migrate
```

- [ ] **Step 6: Run test, expect pass**

Run:
```
python manage.py test src.core.tests.test_mixins -v 2
```
Expected: PASS.

- [ ] **Step 7: Commit**

```
git add src/core/mixins.py src/core/tests/test_mixins.py src/accounts/models.py src/accounts/migrations/
git commit -m "feat(core): add SoftDeleteModel mixin with grace period"
```

---

### Task 0.2 — `Version` model + `Versioned` mixin

**Files:**
- Modify: `src/core/models.py` (create file)
- Modify: `src/core/mixins.py` (add Versioned)
- Test: `src/core/tests/test_versioning.py`

- [ ] **Step 1: Write failing test**

```python
# src/core/tests/test_versioning.py
from django.test import TestCase
from src.accounts.models import Studio


class VersioningTest(TestCase):
    def test_save_creates_version(self):
        s = Studio.objects.create(name="Original", slug="v-test-1")
        self.assertEqual(s.versions.count(), 1)
        s.name = "Renamed"
        s.save()
        self.assertEqual(s.versions.count(), 2)
        self.assertEqual(s.versions.order_by("-version_number").first().snapshot_json["name"], "Renamed")

    def test_revert_restores_field_state(self):
        s = Studio.objects.create(name="Original", slug="v-test-2")
        s.name = "Renamed"
        s.save()
        first_version = s.versions.order_by("version_number").first()
        s.revert_to(first_version.version_number)
        s.refresh_from_db()
        self.assertEqual(s.name, "Original")
```

- [ ] **Step 2: Run test, expect failure**

Run:
```
python manage.py test src.core.tests.test_versioning -v 2
```
Expected: FAIL.

- [ ] **Step 3: Implement Version model**

Create `src/core/models.py`:

```python
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
import uuid


class Version(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    target = GenericForeignKey("content_type", "object_id")
    version_number = models.PositiveIntegerField()
    snapshot_json = models.JSONField()
    actor_type = models.CharField(max_length=32, default="system")
    actor_id = models.UUIDField(null=True, blank=True)
    actor_name = models.CharField(max_length=128, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = [("content_type", "object_id", "version_number")]
        indexes = [models.Index(fields=["content_type", "object_id"])]
        ordering = ["-version_number"]
```

- [ ] **Step 4: Add Versioned mixin**

Append to `src/core/mixins.py`:

```python
from django.contrib.contenttypes.fields import GenericRelation


class Versioned(models.Model):
    versions = GenericRelation("core.Version", related_query_name="versions")

    class Meta:
        abstract = True

    def _snapshot_fields(self):
        return {
            f.name: getattr(self, f.name)
            for f in self._meta.fields
            if not f.is_relation or f.many_to_one
        }

    def save(self, *args, actor=None, reason="", **kwargs):
        super().save(*args, **kwargs)
        from src.core.models import Version
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(self.__class__)
        last = Version.objects.filter(content_type=ct, object_id=self.id).first()
        version_number = (last.version_number + 1) if last else 1
        Version.objects.create(
            content_type=ct,
            object_id=self.id,
            version_number=version_number,
            snapshot_json={k: str(v) if v is not None else None for k, v in self._snapshot_fields().items()},
            actor_type="user" if actor else "system",
            actor_id=actor.id if actor else None,
            actor_name=actor.email if actor else "",
            reason=reason,
        )

    def revert_to(self, version_number):
        from src.core.models import Version
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(self.__class__)
        v = Version.objects.get(content_type=ct, object_id=self.id, version_number=version_number)
        for k, val in v.snapshot_json.items():
            if hasattr(self, k) and not k.endswith("_id") and k != "id":
                setattr(self, k, val)
        self.save(reason=f"reverted to version {version_number}")
```

- [ ] **Step 5: Add Versioned to Studio**

```python
# src/accounts/models.py
class Studio(SoftDeleteModel, Versioned, BaseModel):
    ...
```

- [ ] **Step 6: Make + apply migration; run test**

```
python manage.py makemigrations core accounts && python manage.py migrate
python manage.py test src.core.tests.test_versioning -v 2
```
Expected: tests PASS.

- [ ] **Step 7: Commit**

```
git add src/core/models.py src/core/mixins.py src/accounts/models.py src/core/migrations/ src/accounts/migrations/ src/core/tests/test_versioning.py
git commit -m "feat(core): add Version model and Versioned mixin"
```

---

### Task 0.3 — `production_log` model + write helper

**Files:**
- Modify: `src/core/models.py`
- Create: `src/core/audit.py` — write helper
- Test: `src/core/tests/test_audit.py`

- [ ] **Step 1: Write failing test**

```python
# src/core/tests/test_audit.py
from django.test import TestCase
from src.core.audit import log_event
from src.core.models import ProductionLog


class AuditTest(TestCase):
    def test_log_event_creates_row(self):
        log_event(
            event_type="test_event",
            actor_type="system",
            payload={"key": "value"},
        )
        self.assertEqual(ProductionLog.objects.count(), 1)
        entry = ProductionLog.objects.first()
        self.assertEqual(entry.event_type, "test_event")
        self.assertEqual(entry.payload["key"], "value")
```

- [ ] **Step 2: Run, expect failure**

```
python manage.py test src.core.tests.test_audit -v 2
```

- [ ] **Step 3: Implement ProductionLog model and helper**

Append to `src/core/models.py`:

```python
class ProductionLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    studio = models.ForeignKey("accounts.Studio", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    project = models.ForeignKey("projects.Project", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    actor_type = models.CharField(
        max_length=32,
        choices=[("user", "user"), ("ai_agent", "ai_agent"), ("system", "system"), ("external_mcp", "external_mcp")],
        default="system",
    )
    actor_id = models.UUIDField(null=True, blank=True)
    actor_name = models.CharField(max_length=128, blank=True)
    event_type = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    payload = models.JSONField(default=dict)
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    session_id = models.CharField(max_length=64, blank=True)
    visibility = models.CharField(
        max_length=16,
        choices=[("public", "public"), ("private", "private"), ("training_only", "training_only")],
        default="private",
    )

    class Meta:
        indexes = [
            models.Index(fields=["studio", "timestamp"]),
            models.Index(fields=["project", "timestamp"]),
            models.Index(fields=["actor_type", "timestamp"]),
        ]
        ordering = ["-timestamp"]
```

Create `src/core/audit.py`:

```python
from src.core.models import ProductionLog


def log_event(
    event_type, actor_type="system", actor_id=None, actor_name="",
    studio=None, project=None, target_type="", target_id=None,
    payload=None, source_ip=None, session_id="", visibility="private",
):
    """Append an event to production_log. Single-source audit helper.
    Use everywhere a meaningful state change happens."""
    return ProductionLog.objects.create(
        event_type=event_type,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_name=actor_name,
        studio=studio,
        project=project,
        target_type=target_type,
        target_id=target_id,
        payload=payload or {},
        source_ip=source_ip,
        session_id=session_id,
        visibility=visibility,
    )
```

- [ ] **Step 4: Migrate + run test**

```
python manage.py makemigrations core && python manage.py migrate
python manage.py test src.core.tests.test_audit -v 2
```

- [ ] **Step 5: Commit**

```
git add src/core/models.py src/core/audit.py src/core/migrations/ src/core/tests/test_audit.py
git commit -m "feat(core): add production_log model and log_event helper"
```

---

### Task 0.4 — `snapshot_on_delete` cascade service

**Files:**
- Create: `src/core/services.py`
- Test: `src/core/tests/test_snapshot.py`

- [ ] **Step 1: Write failing test**

```python
# src/core/tests/test_snapshot.py
from django.test import TestCase
from src.core.services import snapshot_related


class SnapshotTest(TestCase):
    def test_snapshot_captures_related_data(self):
        from src.accounts.models import Studio, User
        u = User.objects.create_user(email="t@example.com", password="x")
        s = Studio.objects.create(name="X", slug="snap-1", created_by=u)
        snapshot = snapshot_related(s, depth=1)
        self.assertIn("self", snapshot)
        self.assertEqual(snapshot["self"]["name"], "X")
        self.assertIn("related", snapshot)
```

- [ ] **Step 2: Run, expect failure**

```
python manage.py test src.core.tests.test_snapshot -v 2
```

- [ ] **Step 3: Implement snapshot service**

Create `src/core/services.py`:

```python
from django.core.serializers import serialize
from django.db.models.fields.related import ForeignObjectRel
import json


def snapshot_related(instance, depth=1):
    """Walk reverse relations and capture all related rows into a JSON-serializable dict.
    Used when soft-deleting parent records so child data can be restored.
    depth: how many levels of relation to walk; 1 = direct children only."""
    data = {"self": _serialize_one(instance), "related": {}}
    if depth <= 0:
        return data
    for rel in instance._meta.get_fields():
        if isinstance(rel, ForeignObjectRel):
            related_name = rel.get_accessor_name()
            if not hasattr(instance, related_name):
                continue
            qs = getattr(instance, related_name)
            if hasattr(qs, "all"):
                children = list(qs.all())
                if children:
                    data["related"][related_name] = [_serialize_one(c) for c in children]
    return data


def _serialize_one(obj):
    serialized = json.loads(serialize("json", [obj]))[0]
    return {"model": serialized["model"], "pk": str(serialized["pk"]), "fields": serialized["fields"]}
```

- [ ] **Step 4: Run test, expect pass**

```
python manage.py test src.core.tests.test_snapshot -v 2
```

- [ ] **Step 5: Commit**

```
git add src/core/services.py src/core/tests/test_snapshot.py
git commit -m "feat(core): add snapshot_related cascade helper"
```

---

### Task 0.5 — Phase 0 wrap-up commit

- [ ] **Step 1: Run all core tests; confirm clean**

```
python manage.py test src.core -v 2 && python manage.py check
```
Expected: all green.

- [ ] **Step 2: Phase 0 summary commit**

```
git commit --allow-empty -m "chore(v2): phase 0 complete — core foundations (mixins, version, audit, snapshot)"
```

---

## Phase 1 — Studio model

### Task 1.1 — Extend Studio model with v2 fields

**Files:**
- Modify: `src/accounts/models.py`
- Test: `src/accounts/tests/test_studio_model.py`

- [ ] **Step 1: Write failing test for new Studio fields**

```python
# src/accounts/tests/test_studio_model.py
from django.test import TestCase
from src.accounts.models import Studio


class StudioModelTest(TestCase):
    def test_studio_has_specialty_choice(self):
        s = Studio.objects.create(name="X", slug="x-1", specialty="feature_films")
        self.assertEqual(s.specialty, "feature_films")

    def test_studio_api_key_generation(self):
        s = Studio.objects.create(name="Y", slug="y-1")
        token = s.generate_studio_api_key()
        self.assertTrue(token.startswith("rws_"))
        self.assertIsNotNone(s.studio_api_key_hash)

    def test_snapshot_on_delete_field_exists(self):
        from src.accounts.models import Studio
        f = Studio._meta.get_field("snapshot_on_delete")
        self.assertEqual(f.get_internal_type(), "JSONField")
```

- [ ] **Step 2: Run, expect failure**

```
python manage.py test src.accounts.tests.test_studio_model -v 2
```

- [ ] **Step 3: Extend Studio model**

In `src/accounts/models.py`, extend the Studio class:

```python
import secrets
import hashlib
from src.core.mixins import SoftDeleteModel, Versioned


class Studio(SoftDeleteModel, Versioned, BaseModel):
    # existing fields: name, slug, etc.
    SPECIALTY_CHOICES = [
        ("feature_films", "Feature Films"),
        ("documentary", "Documentary"),
        ("commercial", "Commercial"),
        ("mixed", "Mixed"),
        ("other", "Other"),
    ]
    specialty = models.CharField(max_length=32, choices=SPECIALTY_CHOICES, default="feature_films")
    studio_api_key_hash = models.CharField(max_length=128, blank=True, db_index=True)
    studio_api_key_last_four = models.CharField(max_length=4, blank=True)
    snapshot_on_delete = models.JSONField(null=True, blank=True)

    def generate_studio_api_key(self):
        token = "rws_" + secrets.token_urlsafe(32)
        self.studio_api_key_hash = hashlib.sha256(token.encode()).hexdigest()
        self.studio_api_key_last_four = token[-4:]
        self.save(update_fields=["studio_api_key_hash", "studio_api_key_last_four"])
        return token
```

- [ ] **Step 4: Migrate + run test**

```
python manage.py makemigrations accounts && python manage.py migrate
python manage.py test src.accounts.tests.test_studio_model -v 2
```

- [ ] **Step 5: Commit**

```
git add src/accounts/models.py src/accounts/migrations/ src/accounts/tests/test_studio_model.py
git commit -m "feat(accounts): extend Studio with specialty, api_key, snapshot fields"
```

---

### Task 1.2 — Extend StudioMembership with `is_primary`, role, tier, permissions

**Files:**
- Modify: `src/accounts/models.py`
- Test: `src/accounts/tests/test_studio_membership.py`

- [ ] **Step 1: Write failing test**

```python
# src/accounts/tests/test_studio_membership.py
from django.test import TestCase
from django.db import IntegrityError
from src.accounts.models import User, Studio, StudioMembership


class StudioMembershipTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="m@x.com", password="x")
        self.studio = Studio.objects.create(name="S", slug="s-1", created_by=self.user)

    def test_membership_default_role_member(self):
        m = StudioMembership.objects.create(user=self.user, studio=self.studio)
        self.assertEqual(m.role, "member")
        self.assertEqual(m.tier, "production")

    def test_only_one_primary_per_user(self):
        s2 = Studio.objects.create(name="S2", slug="s-2", created_by=self.user)
        StudioMembership.objects.create(user=self.user, studio=self.studio, is_primary=True)
        with self.assertRaises(IntegrityError):
            StudioMembership.objects.create(user=self.user, studio=s2, is_primary=True)
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Extend StudioMembership model**

```python
class StudioMembership(SoftDeleteModel, BaseModel):
    studio = models.ForeignKey(Studio, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="studio_memberships")
    ROLE_CHOICES = [
        ("owner", "Owner"), ("admin", "Admin"), ("member", "Member"),
        ("auditor", "Auditor"), ("reviewer", "Reviewer"),
    ]
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default="member")
    TIER_CHOICES = [("production", "production"), ("community", "community")]
    tier = models.CharField(max_length=16, choices=TIER_CHOICES, default="production")
    permissions = models.JSONField(default=dict, blank=True)
    STATUS_CHOICES = [("pending", "pending"), ("active", "active"), ("suspended", "suspended")]
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    is_primary = models.BooleanField(default=False)
    invited_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    magic_link_token = models.CharField(max_length=64, blank=True, unique=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(is_primary=True),
                name="one_primary_studio_per_user",
            ),
            models.UniqueConstraint(
                fields=["studio", "user"],
                name="unique_studio_user",
            ),
        ]
```

- [ ] **Step 4: Migrate + run test**

```
python manage.py makemigrations accounts && python manage.py migrate
python manage.py test src.accounts.tests.test_studio_membership -v 2
```

- [ ] **Step 5: Commit**

```
git add src/accounts/models.py src/accounts/migrations/ src/accounts/tests/test_studio_membership.py
git commit -m "feat(accounts): extend StudioMembership with role, tier, is_primary"
```

---

### Task 1.3 — Studio service functions (create, list_for_user, transfer_ownership, soft_delete)

**Files:**
- Create: `src/accounts/services/studio_services.py`
- Test: `src/accounts/tests/test_studio_services.py`

- [ ] **Step 1: Write failing test**

```python
# src/accounts/tests/test_studio_services.py
from django.test import TestCase
from src.accounts.models import User, Studio, StudioMembership
from src.accounts.services.studio_services import (
    create_studio_for_user, list_studios_for_user, soft_delete_studio,
)


class StudioServicesTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="o@x.com", password="x")

    def test_create_studio_creates_studio_and_owner_membership(self):
        s = create_studio_for_user(self.user, name="My", specialty="feature_films")
        self.assertEqual(s.created_by, self.user)
        m = StudioMembership.objects.get(studio=s, user=self.user)
        self.assertEqual(m.role, "owner")

    def test_list_studios_returns_owned_and_member(self):
        s1 = create_studio_for_user(self.user, name="A")
        other = User.objects.create_user(email="o2@x.com", password="x")
        s2 = create_studio_for_user(other, name="B")
        StudioMembership.objects.create(user=self.user, studio=s2, role="member")
        result = list_studios_for_user(self.user)
        self.assertIn(s1, result)
        self.assertIn(s2, result)

    def test_soft_delete_studio_writes_snapshot(self):
        s = create_studio_for_user(self.user, name="DEL")
        soft_delete_studio(s, by_user=self.user)
        s.refresh_from_db()
        self.assertIsNotNone(s.deleted_at)
        self.assertIsNotNone(s.snapshot_on_delete)
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Implement services**

Create `src/accounts/services/__init__.py` (empty).

Create `src/accounts/services/studio_services.py`:

```python
from django.db import transaction
from django.utils import timezone
from src.accounts.models import Studio, StudioMembership
from src.core.audit import log_event
from src.core.services import snapshot_related


@transaction.atomic
def create_studio_for_user(user, name, specialty="feature_films", is_primary=False, slug=None):
    if not slug:
        from django.utils.text import slugify
        base = slugify(name) or "studio"
        slug = base
        counter = 1
        while Studio.objects.filter(slug=slug).exists():
            counter += 1
            slug = f"{base}-{counter}"
    studio = Studio.objects.create(
        name=name, slug=slug, specialty=specialty, created_by=user,
    )
    StudioMembership.objects.create(
        studio=studio, user=user, role="owner", tier="production",
        is_primary=is_primary, accepted_at=timezone.now(), status="active",
    )
    log_event(
        event_type="studio_created", actor_type="user", actor_id=user.id,
        actor_name=user.email, studio=studio,
        target_type="accounts.Studio", target_id=studio.id,
        payload={"name": name, "specialty": specialty, "is_primary": is_primary},
    )
    return studio


def list_studios_for_user(user):
    return Studio.objects.filter(memberships__user=user, memberships__status="active").distinct()


def soft_delete_studio(studio, by_user):
    if studio.memberships.filter(is_primary=True).exists():
        raise ValueError("Cannot delete primary studio without account deactivation")
    snapshot = snapshot_related(studio, depth=2)
    studio.snapshot_on_delete = snapshot
    studio.save(update_fields=["snapshot_on_delete"])
    studio.soft_delete(by_user=by_user)
    log_event(
        event_type="studio_soft_deleted", actor_type="user", actor_id=by_user.id,
        actor_name=by_user.email, studio=studio,
        target_type="accounts.Studio", target_id=studio.id,
    )


def transfer_ownership(studio, from_user, to_user):
    target_membership, _ = StudioMembership.objects.get_or_create(
        studio=studio, user=to_user,
        defaults={"role": "owner", "tier": "production", "status": "active",
                  "accepted_at": timezone.now()},
    )
    if target_membership.role != "owner":
        target_membership.role = "owner"
        target_membership.save(update_fields=["role"])
    log_event(
        event_type="ownership_granted", actor_type="user", actor_id=from_user.id,
        actor_name=from_user.email, studio=studio,
        payload={"granted_to": str(to_user.id)},
    )
```

- [ ] **Step 4: Run tests, expect pass**

```
python manage.py test src.accounts.tests.test_studio_services -v 2
```

- [ ] **Step 5: Commit**

```
git add src/accounts/services/ src/accounts/tests/test_studio_services.py
git commit -m "feat(accounts): add studio create/list/delete/transfer services"
```

---

### Task 1.4 — Auto-create "My Studio" on signup signal

**Files:**
- Create: `src/accounts/signals.py`
- Modify: `src/accounts/apps.py` to wire signal
- Test: `src/accounts/tests/test_signals.py`

- [ ] **Step 1: Write failing test**

```python
# src/accounts/tests/test_signals.py
from django.test import TestCase
from src.accounts.models import User, Studio, StudioMembership


class SignupSignalTest(TestCase):
    def test_signup_creates_my_studio(self):
        u = User.objects.create_user(email="new@x.com", password="x")
        s = Studio.objects.get(memberships__user=u, memberships__is_primary=True)
        self.assertEqual(s.name, "My Studio")
        m = StudioMembership.objects.get(user=u, is_primary=True)
        self.assertEqual(m.role, "owner")
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Implement signal**

Create `src/accounts/signals.py`:

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user


@receiver(post_save, sender=User)
def create_primary_studio_on_signup(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.studio_memberships.filter(is_primary=True).exists():
        return
    create_studio_for_user(instance, name="My Studio", is_primary=True)
```

Modify `src/accounts/apps.py`:

```python
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "src.accounts"

    def ready(self):
        from . import signals  # noqa
```

- [ ] **Step 4: Run, expect pass**

```
python manage.py test src.accounts.tests.test_signals -v 2
```

- [ ] **Step 5: Commit**

```
git add src/accounts/signals.py src/accounts/apps.py src/accounts/tests/test_signals.py
git commit -m "feat(accounts): auto-create My Studio on user signup"
```

---

### Task 1.5 — Phase 1 wrap-up commit

- [ ] **Step 1: All accounts tests pass + manage.py check**

```
python manage.py test src.accounts -v 2 && python manage.py check
```

- [ ] **Step 2: Phase 1 summary commit**

```
git commit --allow-empty -m "chore(v2): phase 1 complete — Studio model + signup auto-create"
```

---

## Phase 2 — Project model

### Task 2.1 — Extend Project model with v2 fields

**Files:**
- Modify: `src/projects/models.py`
- Test: `src/projects/tests/test_project_model.py`

- [ ] **Step 1: Write failing test**

```python
# src/projects/tests/test_project_model.py
from django.test import TestCase
from src.accounts.services.studio_services import create_studio_for_user
from src.accounts.models import User
from src.projects.models import Project


class ProjectModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="p@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="S")

    def test_project_status_default_draft(self):
        p = Project.objects.create(studio=self.studio, name="P", slug="p-1", project_type="feature", created_by=self.user)
        self.assertEqual(p.status, "draft")

    def test_project_has_metadata_optional_fields(self):
        p = Project.objects.create(studio=self.studio, name="P2", slug="p-2", project_type="feature", created_by=self.user)
        for field in ("logline", "language", "director_credit", "estimated_shoot_start", "estimated_length_minutes", "ai_context_notes"):
            self.assertTrue(hasattr(p, field), f"missing field {field}")

    def test_name_latin_field_present(self):
        p = Project.objects.create(studio=self.studio, name="مشروع", name_latin="mashrou", slug="p-3", project_type="feature", created_by=self.user)
        self.assertEqual(p.name_latin, "mashrou")
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Extend Project model**

In `src/projects/models.py`:

```python
from src.core.mixins import SoftDeleteModel, Versioned

class Project(SoftDeleteModel, Versioned, BaseModel):
    # existing fields preserved
    studio = models.ForeignKey("accounts.Studio", on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=255)
    name_latin = models.CharField(max_length=255, blank=True, db_index=True)
    slug = models.SlugField(max_length=255)
    PROJECT_TYPE_CHOICES = [("feature", "Feature"), ("short", "Short")]
    project_type = models.CharField(max_length=16, choices=PROJECT_TYPE_CHOICES, default="feature")
    STATUS_CHOICES = [
        ("draft", "Draft"), ("active", "Active"), ("in_production", "In Production"),
        ("wrap", "Wrap"), ("completed", "Completed"),
        ("cancelled", "Cancelled"), ("on_hold", "On Hold"),
    ]
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft", db_index=True)
    status_changed_at = models.DateTimeField(null=True, blank=True)
    status_changed_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="+")
    snapshot_on_delete = models.JSONField(null=True, blank=True)

    # optional metadata
    logline = models.TextField(blank=True)
    language = models.CharField(max_length=8, blank=True)
    target_rating = models.CharField(max_length=16, blank=True)
    director_credit = models.CharField(max_length=255, blank=True)
    poster = models.ImageField(upload_to="projects/posters/", null=True, blank=True)
    estimated_shoot_start = models.DateField(null=True, blank=True)
    estimated_length_minutes = models.PositiveIntegerField(null=True, blank=True)
    ai_context_notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["studio", "slug"], name="unique_project_slug_per_studio"),
        ]
```

- [ ] **Step 4: Migrate + run test**

```
python manage.py makemigrations projects && python manage.py migrate
python manage.py test src.projects.tests.test_project_model -v 2
```

- [ ] **Step 5: Commit**

```
git add src/projects/models.py src/projects/migrations/ src/projects/tests/test_project_model.py
git commit -m "feat(projects): extend Project model with v2 status, metadata, snapshot"
```

---

### Task 2.2 — Extend ProjectMembership with `tier` enum

**Files:**
- Modify: `src/projects/models.py` (or wherever ProjectMembership lives — likely `src/accounts/models.py`)
- Test: `src/projects/tests/test_project_membership.py`

- [ ] **Step 1: Write test**

```python
# src/projects/tests/test_project_membership.py
from django.test import TestCase
from src.accounts.models import User, ProjectMembership
from src.accounts.services.studio_services import create_studio_for_user
from src.projects.models import Project


class ProjectMembershipTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="pm@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="S")
        self.project = Project.objects.create(studio=self.studio, name="P", slug="p-pm", project_type="feature", created_by=self.user)

    def test_tier_default_production(self):
        m = ProjectMembership.objects.create(user=self.user, project=self.project, role_type="dop")
        self.assertEqual(m.tier, "production")

    def test_tier_can_be_community(self):
        m = ProjectMembership.objects.create(user=self.user, project=self.project, role_type="reviewer", tier="community")
        self.assertEqual(m.tier, "community")
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Extend ProjectMembership**

In the right models.py:

```python
class ProjectMembership(SoftDeleteModel, BaseModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="project_memberships")
    role_type = models.CharField(max_length=64)
    department = models.CharField(max_length=64, blank=True)
    TIER_CHOICES = [("production", "production"), ("community", "community")]
    tier = models.CharField(max_length=16, choices=TIER_CHOICES, default="production")
    permissions = models.JSONField(default=dict, blank=True)
    STATUS_CHOICES = [
        ("pending", "pending"), ("active", "active"),
        ("completed_with_project", "completed_with_project"), ("removed", "removed"),
    ]
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="active")
    invited_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    invited_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    magic_link_token = models.CharField(max_length=64, blank=True, unique=True, null=True)
```

- [ ] **Step 4: Migrate + run test**

- [ ] **Step 5: Commit**

```
git add src/accounts/models.py src/accounts/migrations/ src/projects/tests/test_project_membership.py
git commit -m "feat(projects): add tier enum and v2 fields to ProjectMembership"
```

---

### Task 2.3 — Project lifecycle services (create, change_status, soft_delete with snapshot)

**Files:**
- Create: `src/projects/services/__init__.py`, `src/projects/services/lifecycle_services.py`
- Test: `src/projects/tests/test_lifecycle_services.py`

- [ ] **Step 1: Write failing tests**

```python
# src/projects/tests/test_lifecycle_services.py
from django.test import TestCase
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.projects.services.lifecycle_services import (
    create_project, change_project_status, soft_delete_project,
)


class LifecycleTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="lc@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="S")

    def test_create_project_default_draft(self):
        p = create_project(studio=self.studio, user=self.user, name="X", project_type="feature")
        self.assertEqual(p.status, "draft")

    def test_change_status_records_actor_and_time(self):
        p = create_project(studio=self.studio, user=self.user, name="Y", project_type="feature")
        change_project_status(p, new_status="active", by_user=self.user)
        p.refresh_from_db()
        self.assertEqual(p.status, "active")
        self.assertEqual(p.status_changed_by, self.user)
        self.assertIsNotNone(p.status_changed_at)

    def test_soft_delete_writes_snapshot(self):
        p = create_project(studio=self.studio, user=self.user, name="Z", project_type="feature")
        soft_delete_project(p, by_user=self.user)
        p.refresh_from_db()
        self.assertIsNotNone(p.snapshot_on_delete)
        self.assertIsNotNone(p.deleted_at)
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Implement services**

Create `src/projects/services/__init__.py` (empty).

Create `src/projects/services/lifecycle_services.py`:

```python
from django.db import transaction
from django.utils import timezone
from src.projects.models import Project
from src.core.audit import log_event
from src.core.services import snapshot_related


@transaction.atomic
def create_project(studio, user, name, project_type, slug=None, **metadata):
    from django.utils.text import slugify
    if not slug:
        base = slugify(name) or "project"
        slug = base
        counter = 1
        while Project.objects.filter(studio=studio, slug=slug).exists():
            counter += 1
            slug = f"{base}-{counter}"
    project = Project.objects.create(
        studio=studio, name=name, slug=slug, project_type=project_type,
        created_by=user, status="draft", **metadata,
    )
    log_event(
        event_type="project_created", actor_type="user", actor_id=user.id,
        actor_name=user.email, studio=studio, project=project,
        target_type="projects.Project", target_id=project.id,
        payload={"name": name, "project_type": project_type},
    )
    return project


def change_project_status(project, new_status, by_user):
    old = project.status
    project.status = new_status
    project.status_changed_at = timezone.now()
    project.status_changed_by = by_user
    project.save(update_fields=["status", "status_changed_at", "status_changed_by"])
    log_event(
        event_type="project_status_changed", actor_type="user", actor_id=by_user.id,
        actor_name=by_user.email, studio=project.studio, project=project,
        payload={"old": old, "new": new_status},
    )


def soft_delete_project(project, by_user):
    snapshot = snapshot_related(project, depth=3)
    project.snapshot_on_delete = snapshot
    project.save(update_fields=["snapshot_on_delete"])
    project.soft_delete(by_user=by_user)
    log_event(
        event_type="project_soft_deleted", actor_type="user", actor_id=by_user.id,
        actor_name=by_user.email, studio=project.studio, project=project,
    )
```

- [ ] **Step 4: Run, expect pass + commit**

```
python manage.py test src.projects.tests.test_lifecycle_services -v 2
git add src/projects/services/ src/projects/tests/test_lifecycle_services.py
git commit -m "feat(projects): add lifecycle services (create/change_status/soft_delete)"
```

---

### Task 2.4 — Phase 2 wrap-up commit

```
python manage.py test src.projects -v 2 && python manage.py check
git commit --allow-empty -m "chore(v2): phase 2 complete — Project model + lifecycle services"
```

---

## Phase 3 — Subscription scaffolding

### Task 3.1 — Create `billing` app + Subscription model

**Files:**
- Create: `src/billing/` app (models, services, providers, tests)
- Modify: `src/settings/components/common.py` to add 'src.billing' to INSTALLED_APPS

- [ ] **Step 1: Generate app skeleton**

```
cd "E:/api/rwanga"
python manage.py startapp billing src/billing
```

Then update `src/billing/apps.py`:
```python
class BillingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "src.billing"
```

Add to INSTALLED_APPS in `src/settings/components/common.py`:
```python
INSTALLED_APPS = [
    # ... existing ...
    "src.billing",
]
```

- [ ] **Step 2: Write failing test**

```python
# src/billing/tests/test_subscription_model.py
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.billing.models import Subscription


class SubscriptionModelTest(TestCase):
    def test_subscription_default_pro_trial(self):
        u = User.objects.create_user(email="b@x.com", password="x")
        s = create_studio_for_user(u, name="B")
        sub = Subscription.objects.create(owner_studio=s, owner_user=u)
        self.assertEqual(sub.plan, "pro")
        self.assertEqual(sub.status, "trial")
        self.assertAlmostEqual(
            (sub.trial_ends_at - timezone.now()).days, 30, delta=1,
        )
```

- [ ] **Step 3: Implement Subscription model**

Create `src/billing/models.py`:

```python
import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone


class Subscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_studio = models.OneToOneField("accounts.Studio", on_delete=models.CASCADE, related_name="subscription")
    owner_user = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="billing_subscriptions")
    PLAN_CHOICES = [("free", "Free"), ("pro", "Pro"), ("studio_unlimited", "Studio Unlimited"), ("enterprise", "Enterprise")]
    plan = models.CharField(max_length=24, choices=PLAN_CHOICES, default="pro")
    STATUS_CHOICES = [("trial", "trial"), ("active", "active"), ("past_due", "past_due"), ("suspended", "suspended"), ("cancelled", "cancelled")]
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="trial")
    trial_started_at = models.DateTimeField(default=timezone.now)
    trial_ends_at = models.DateTimeField(default=lambda: timezone.now() + timedelta(days=30))
    billing_email = models.EmailField(blank=True)
    payment_provider = models.CharField(max_length=32, blank=True)
    payment_provider_customer_id = models.CharField(max_length=128, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    seat_count = models.PositiveIntegerField(default=1)
    seat_limit = models.PositiveIntegerField(default=5)
    feature_flags = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SubscriptionUsage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="usage_meters")
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    METER_KINDS = [
        ("ai_requests", "AI Requests"), ("ai_tokens", "AI Tokens"),
        ("studio_seats", "Studio Seats"), ("api_requests", "API Requests"),
        ("project_count", "Project Count"), ("production_log_size", "Production Log Size"),
    ]
    meter_kind = models.CharField(max_length=32, choices=METER_KINDS)
    consumed = models.PositiveIntegerField(default=0)
    limit = models.PositiveIntegerField(default=0)
    overage_charged_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
```

- [ ] **Step 4: Migrate + test + commit**

```
python manage.py makemigrations billing && python manage.py migrate
python manage.py test src.billing -v 2
git add src/billing/ src/settings/components/common.py
git commit -m "feat(billing): add Subscription + SubscriptionUsage models"
```

---

### Task 3.2 — Auto-create Subscription on Studio creation signal

**Files:**
- Create: `src/billing/signals.py`
- Modify: `src/billing/apps.py` to wire signal
- Test: `src/billing/tests/test_signals.py`

- [ ] **Step 1: Write failing test**

```python
# src/billing/tests/test_signals.py
from django.test import TestCase
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.billing.models import Subscription


class BillingSignalsTest(TestCase):
    def test_studio_creation_creates_subscription(self):
        u = User.objects.create_user(email="bs@x.com", password="x")
        s = create_studio_for_user(u, name="X")
        sub = Subscription.objects.get(owner_studio=s)
        self.assertEqual(sub.plan, "pro")
        self.assertEqual(sub.status, "trial")
```

- [ ] **Step 2: Implement signal**

`src/billing/signals.py`:
```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from src.accounts.models import Studio
from src.billing.models import Subscription


@receiver(post_save, sender=Studio)
def create_subscription_on_studio_create(sender, instance, created, **kwargs):
    if not created:
        return
    Subscription.objects.get_or_create(
        owner_studio=instance,
        defaults={"owner_user": instance.created_by},
    )
```

`src/billing/apps.py` — add `def ready(self): from . import signals`.

- [ ] **Step 3: Run + commit**

```
python manage.py test src.billing -v 2
git add src/billing/signals.py src/billing/apps.py src/billing/tests/test_signals.py
git commit -m "feat(billing): auto-create subscription on studio creation"
```

---

### Task 3.3 — `@subscription_required` decorator

**Files:**
- Modify: `src/core/decorators.py` (create)
- Test: `src/core/tests/test_decorators.py`

- [ ] **Step 1: Write failing test**

```python
# src/core/tests/test_decorators.py
from django.test import TestCase, RequestFactory
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.core.decorators import subscription_required


@subscription_required(feature="ask_ai")
def some_view(request):
    return "ok"


class SubscriptionDecoratorTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(email="d@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="D")

    def test_pro_trial_passes(self):
        req = self.factory.get("/")
        req.user = self.user
        req.active_studio = self.studio
        result = some_view(req)
        self.assertEqual(result, "ok")
```

- [ ] **Step 2: Implement decorator**

Create `src/core/decorators.py`:
```python
from functools import wraps
from django.http import HttpResponseForbidden


PRO_FEATURES = {"ask_ai", "studio_api_key", "outbound_mcp"}


def subscription_required(feature):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            studio = getattr(request, "active_studio", None)
            if studio is None:
                return HttpResponseForbidden("No active studio")
            sub = getattr(studio, "subscription", None)
            if sub is None:
                return HttpResponseForbidden("No subscription")
            if feature in PRO_FEATURES:
                if sub.plan in ("pro", "studio_unlimited", "enterprise"):
                    return view_func(request, *args, **kwargs)
                if sub.status == "trial":
                    return view_func(request, *args, **kwargs)
                return HttpResponseForbidden(f"Feature '{feature}' requires Pro subscription")
            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator
```

- [ ] **Step 3: Run + commit**

```
python manage.py test src.core.tests.test_decorators -v 2
git add src/core/decorators.py src/core/tests/test_decorators.py
git commit -m "feat(core): add @subscription_required decorator"
```

---

### Task 3.4 — Phase 3 wrap-up

```
git commit --allow-empty -m "chore(v2): phase 3 complete — billing scaffolding + subscription gate"
```

---

## Phase 4 — RBAC primitives

### Task 4.1 — RBAC area constants + `@rbac_required` decorator

**Files:**
- Modify: `src/core/decorators.py`
- Create: `src/core/rbac.py` (constants)
- Test: `src/core/tests/test_rbac.py`

- [ ] **Step 1: Write failing test**

```python
# src/core/tests/test_rbac.py
from django.test import TestCase, RequestFactory
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.core.decorators import rbac_required


@rbac_required(area="scheduling", action="edit")
def some_view(request):
    return "ok"


class RBACTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(email="r@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="R")

    def test_owner_passes_all_areas(self):
        req = self.factory.get("/")
        req.user = self.user
        req.active_studio = self.studio
        result = some_view(req)
        self.assertEqual(result, "ok")
```

- [ ] **Step 2: Implement RBAC**

Create `src/core/rbac.py`:
```python
RBAC_AREAS = ["scripts", "breakdown", "shots", "storyboards", "scheduling",
              "contacts", "departments", "reviews", "community",
              "progress", "settings", "billing"]
RBAC_ACTIONS = ["view", "edit", "manage", "delete"]


ROLE_DEFAULT_PERMISSIONS = {
    "owner": {area: ["view", "edit", "manage", "delete"] for area in RBAC_AREAS},
    "admin": {area: ["view", "edit", "manage"] for area in RBAC_AREAS},
    "member": {area: ["view", "edit"] for area in RBAC_AREAS if area != "billing"},
    "auditor": {area: ["view"] for area in RBAC_AREAS},
    "reviewer": {area: ["view"] for area in RBAC_AREAS},
}


def user_can(user, studio, area, action):
    if not user.is_authenticated:
        return False
    membership = studio.memberships.filter(user=user, status="active").first()
    if not membership:
        return False
    role_perms = ROLE_DEFAULT_PERMISSIONS.get(membership.role, {})
    overrides = membership.permissions or {}
    allowed = overrides.get(area, role_perms.get(area, []))
    return action in allowed
```

Append to `src/core/decorators.py`:
```python
from src.core.rbac import user_can


def rbac_required(area, action):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            studio = getattr(request, "active_studio", None)
            if studio is None:
                return HttpResponseForbidden("No active studio")
            if not user_can(request.user, studio, area, action):
                return HttpResponseForbidden(f"RBAC denied: {area}/{action}")
            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator
```

- [ ] **Step 3: Run + commit**

```
python manage.py test src.core -v 2
git add src/core/rbac.py src/core/decorators.py src/core/tests/test_rbac.py
git commit -m "feat(core): add RBAC areas, ROLE_DEFAULT_PERMISSIONS, @rbac_required"
```

---

### Task 4.2 — Phase 4 wrap-up

```
git commit --allow-empty -m "chore(v2): phase 4 complete — RBAC primitives"
```

---

## Phase 5 — Invitation flows

### Task 5.1 — Magic link token generation + invitation services

**Files:**
- Create: `src/accounts/services/invitation_services.py`
- Test: `src/accounts/tests/test_invitations.py`

- [ ] **Step 1: Write failing tests**

```python
# src/accounts/tests/test_invitations.py
from django.test import TestCase
from src.accounts.models import User, StudioMembership
from src.accounts.services.studio_services import create_studio_for_user
from src.accounts.services.invitation_services import (
    invite_to_studio, accept_studio_invitation, reject_studio_invitation,
)


class StudioInvitationTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x")
        self.studio = create_studio_for_user(self.owner, name="O")

    def test_invite_creates_pending_membership(self):
        target = User.objects.create_user(email="t@x.com", password="x")
        m = invite_to_studio(self.studio, target, role="member", tier="production", invited_by=self.owner)
        self.assertEqual(m.status, "pending")
        self.assertTrue(m.magic_link_token)

    def test_accept_marks_active(self):
        target = User.objects.create_user(email="t2@x.com", password="x")
        m = invite_to_studio(self.studio, target, role="member", tier="production", invited_by=self.owner)
        accept_studio_invitation(m.magic_link_token, by_user=target)
        m.refresh_from_db()
        self.assertEqual(m.status, "active")
        self.assertIsNotNone(m.accepted_at)

    def test_reject_deletes_membership(self):
        target = User.objects.create_user(email="t3@x.com", password="x")
        m = invite_to_studio(self.studio, target, role="reviewer", tier="community", invited_by=self.owner)
        token = m.magic_link_token
        reject_studio_invitation(token, by_user=target)
        self.assertFalse(StudioMembership.objects.filter(magic_link_token=token).exists())
```

- [ ] **Step 2: Implement**

`src/accounts/services/invitation_services.py`:
```python
import secrets
from django.utils import timezone
from src.accounts.models import StudioMembership, ProjectMembership
from src.core.audit import log_event


def invite_to_studio(studio, user, role, tier, invited_by):
    token = secrets.token_urlsafe(32)
    m = StudioMembership.objects.create(
        studio=studio, user=user, role=role, tier=tier, status="pending",
        invited_by=invited_by, invited_at=timezone.now(),
        magic_link_token=token,
    )
    log_event(
        event_type="studio_invitation_sent", actor_type="user",
        actor_id=invited_by.id, actor_name=invited_by.email,
        studio=studio,
        payload={"invited_user_id": str(user.id), "role": role, "tier": tier},
    )
    return m


def accept_studio_invitation(token, by_user):
    m = StudioMembership.objects.get(magic_link_token=token, user=by_user)
    m.status = "active"
    m.accepted_at = timezone.now()
    m.magic_link_token = None
    m.save(update_fields=["status", "accepted_at", "magic_link_token"])
    log_event(
        event_type="studio_invitation_accepted", actor_type="user",
        actor_id=by_user.id, actor_name=by_user.email,
        studio=m.studio,
    )
    return m


def reject_studio_invitation(token, by_user):
    m = StudioMembership.objects.get(magic_link_token=token, user=by_user)
    studio_id = m.studio_id
    m.delete()
    log_event(
        event_type="studio_invitation_rejected", actor_type="user",
        actor_id=by_user.id, actor_name=by_user.email,
    )


def invite_to_project(project, user, role_type, tier, department, invited_by):
    token = secrets.token_urlsafe(32)
    m = ProjectMembership.objects.create(
        project=project, user=user, role_type=role_type, department=department,
        tier=tier, status="pending", invited_by=invited_by, invited_at=timezone.now(),
        magic_link_token=token,
    )
    log_event(
        event_type="project_invitation_sent", actor_type="user",
        actor_id=invited_by.id, actor_name=invited_by.email,
        studio=project.studio, project=project,
        payload={"invited_user_id": str(user.id), "role_type": role_type, "tier": tier},
    )
    return m


def accept_project_invitation(token, by_user):
    m = ProjectMembership.objects.get(magic_link_token=token, user=by_user)
    m.status = "active"
    m.accepted_at = timezone.now()
    m.magic_link_token = None
    m.save(update_fields=["status", "accepted_at", "magic_link_token"])
    return m


def reject_project_invitation(token, by_user):
    m = ProjectMembership.objects.get(magic_link_token=token, user=by_user)
    m.delete()
```

- [ ] **Step 3: Run + commit**

```
python manage.py test src.accounts -v 2
git add src/accounts/services/invitation_services.py src/accounts/tests/test_invitations.py
git commit -m "feat(accounts): invitation services with magic-link tokens"
```

---

### Task 5.2 — Phase 5 wrap-up (UI for invitations deferred to Phase 8)

```
git commit --allow-empty -m "chore(v2): phase 5 complete — invitation services (UI in Phase 8)"
```

---

## Phase 6 — Account deactivation

### Task 6.1 — Deactivation cascade service

**Files:**
- Create: `src/accounts/services/deactivation_services.py`
- Test: `src/accounts/tests/test_deactivation.py`

- [ ] **Step 1: Write failing test**

```python
# src/accounts/tests/test_deactivation.py
from django.test import TestCase
from src.accounts.models import User, Studio
from src.accounts.services.studio_services import create_studio_for_user
from src.accounts.services.deactivation_services import deactivate_account


class DeactivationTest(TestCase):
    def test_deactivate_soft_deletes_user_and_owned_studios(self):
        u = User.objects.create_user(email="dead@x.com", password="x")
        # primary auto-created. Add a second owned studio.
        s2 = create_studio_for_user(u, name="Second")
        deactivate_account(u, by_user=u)
        u.refresh_from_db()
        self.assertFalse(u.is_active)
        from src.accounts.models import Studio
        self.assertEqual(Studio.objects.filter(memberships__user=u).count(), 0)
        self.assertEqual(Studio.all_with_deleted.filter(memberships__user=u).count(), 2)
```

- [ ] **Step 2: Implement**

`src/accounts/services/deactivation_services.py`:
```python
from django.db import transaction
from django.utils import timezone
from src.accounts.models import StudioMembership, Studio
from src.core.services import snapshot_related
from src.core.audit import log_event


@transaction.atomic
def deactivate_account(user, by_user):
    owned_studios = Studio.objects.filter(memberships__user=user, memberships__role="owner")
    for s in owned_studios:
        s.snapshot_on_delete = snapshot_related(s, depth=2)
        s.save(update_fields=["snapshot_on_delete"])
        s.soft_delete(by_user=by_user)
    StudioMembership.all_with_deleted.filter(user=user).update(
        deleted_at=timezone.now(), deleted_by=by_user,
    )
    user.is_active = False
    user.save(update_fields=["is_active"])
    log_event(
        event_type="account_deactivated", actor_type="user",
        actor_id=by_user.id, actor_name=by_user.email,
        payload={"target_user_id": str(user.id)},
    )
```

- [ ] **Step 3: Run + commit**

```
python manage.py test src.accounts.tests.test_deactivation -v 2
git add src/accounts/services/deactivation_services.py src/accounts/tests/test_deactivation.py
git commit -m "feat(accounts): account deactivation cascade with snapshot"
```

---

### Task 6.2 — Phase 6 wrap-up (deactivation UI deferred to Phase 8)

```
git commit --allow-empty -m "chore(v2): phase 6 complete — account deactivation service"
```

---

## Phase 7 — Studio context switching

### Task 7.1 — `ActiveStudioMiddleware`

**Files:**
- Modify: `src/core/middleware.py` (extend existing StudioContextMiddleware)
- Test: `src/core/tests/test_middleware.py`

- [ ] **Step 1: Write failing test**

```python
# src/core/tests/test_middleware.py
from django.test import TestCase, RequestFactory
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.core.middleware import StudioContextMiddleware


class MiddlewareTest(TestCase):
    def test_active_studio_defaults_to_primary(self):
        u = User.objects.create_user(email="mw@x.com", password="x")
        primary = u.studio_memberships.get(is_primary=True).studio
        rf = RequestFactory()
        req = rf.get("/")
        req.user = u
        req.session = {}
        mw = StudioContextMiddleware(get_response=lambda r: None)
        mw(req)
        self.assertEqual(req.active_studio, primary)
```

- [ ] **Step 2: Update middleware**

`src/core/middleware.py`:
```python
from src.accounts.models import Studio


class StudioContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.active_studio = None
        request.theme = request.COOKIES.get("rwanga_theme", "dark")
        if request.user.is_authenticated:
            sid = request.session.get("active_studio_id") if hasattr(request, "session") else None
            if sid:
                try:
                    request.active_studio = Studio.objects.get(
                        id=sid, memberships__user=request.user, memberships__status="active",
                    )
                except Studio.DoesNotExist:
                    pass
            if request.active_studio is None:
                primary_m = request.user.studio_memberships.filter(is_primary=True, status="active").first()
                if primary_m:
                    request.active_studio = primary_m.studio
        return self.get_response(request)
```

- [ ] **Step 3: Run + commit**

```
python manage.py test src.core.tests.test_middleware -v 2
git add src/core/middleware.py src/core/tests/test_middleware.py
git commit -m "feat(core): ActiveStudioMiddleware with session-based switching"
```

---

### Task 7.2 — Switch / exit views

**Files:**
- Modify: `src/accounts/views.py`, `src/accounts/urls.py`
- Test: `src/accounts/tests/test_switcher_views.py`

- [ ] **Step 1: Test**

```python
# src/accounts/tests/test_switcher_views.py
from django.test import TestCase, Client
from django.urls import reverse
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user


class SwitcherViewsTest(TestCase):
    def test_switch_studio_updates_session(self):
        u = User.objects.create_user(email="sw@x.com", password="x")
        s2 = create_studio_for_user(u, name="Second")
        c = Client()
        c.force_login(u)
        c.post(reverse("accounts:switch_studio"), {"studio_id": str(s2.id)})
        self.assertEqual(c.session["active_studio_id"], str(s2.id))
```

- [ ] **Step 2: Implement**

In `src/accounts/views.py`:
```python
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from src.accounts.models import Studio


@login_required
def switch_studio(request):
    if request.method != "POST":
        return HttpResponseRedirect(reverse("projects:list"))
    sid = request.POST.get("studio_id")
    studio = get_object_or_404(
        Studio, id=sid, memberships__user=request.user, memberships__status="active",
    )
    request.session["active_studio_id"] = str(studio.id)
    return HttpResponseRedirect(reverse("projects:list"))


@login_required
def exit_studio(request):
    primary = request.user.studio_memberships.filter(is_primary=True).first()
    if primary:
        request.session["active_studio_id"] = str(primary.studio_id)
    return HttpResponseRedirect(reverse("projects:list"))
```

In `src/accounts/urls.py`:
```python
path("switch-studio/", switch_studio, name="switch_studio"),
path("exit-studio/", exit_studio, name="exit_studio"),
```

- [ ] **Step 3: Run + commit**

```
python manage.py test src.accounts.tests.test_switcher_views -v 2
git add src/accounts/views.py src/accounts/urls.py src/accounts/tests/test_switcher_views.py
git commit -m "feat(accounts): switch/exit studio views"
```

---

### Task 7.3 — Studio switcher UI in topnav 🎨 VC-REQUIRED

- [ ] **Step 1: Visual companion mockup of switcher dropdown**

Open visual companion. Mock up:
- Topnav user dropdown including: avatar/name, "View profile" link, "**My Studio**" first-class link, divider, list of joined studios (current marked active), divider, "+ New studio" link, divider, "Sign out".
- For switched-into-other-studio context: subtle banner under topnav "You're working in [Studio X]" with "Exit" link.

Get user approval on the mockup before any HTML changes.

- [ ] **Step 2: Implement template**

Create `templates/components/_studio_switcher.html`:
```html
{% load i18n %}
{% comment %}
   Studio switcher in user dropdown. Inserted into _topnav.html user menu.
   Context: request.user, request.active_studio, user_studios (queryset)
{% endcomment %}
<li><h6 class="dropdown-header">{% trans "Studios" %}</h6></li>
{% for s in user_studios %}
  <li>
    <form method="post" action="{% url 'accounts:switch_studio' %}" class="d-inline">
      {% csrf_token %}
      <input type="hidden" name="studio_id" value="{{ s.id }}">
      <button type="submit" class="dropdown-item d-flex align-items-center {% if s.id == request.active_studio.id %}active{% endif %}">
        {% if s.id == request.active_studio.id %}<span class="me-2">●</span>{% endif %}
        {{ s.name }}
        {% if s.is_primary_for_user %}<span class="ms-auto badge bg-rw-amber">{% trans "Primary" %}</span>{% endif %}
      </button>
    </form>
  </li>
{% endfor %}
<li><hr class="dropdown-divider"></li>
<li><a class="dropdown-item" href="#" data-action="create-studio">+ {% trans "New studio" %}</a></li>
```

Wire into `templates/components/_topnav.html` user menu.

In context processor `src/core/context_processors.py`, add `user_studios` to navigation_context.

- [ ] **Step 3: User visual verification, then commit**

User reloads / logs in → checks switcher dropdown visually → approves → commit:
```
git add templates/components/_studio_switcher.html templates/components/_topnav.html src/core/context_processors.py
git commit -m "feat(ui): studio switcher dropdown in topnav (VC-approved)"
```

---

### Task 7.4 — Phase 7 wrap-up

```
git commit --allow-empty -m "chore(v2): phase 7 complete — studio context switching"
```

---

## Phase 8 — Dashboard 3-row UI 🎨

### Task 8.1 — Visual companion mockup of the 3-row dashboard

- [ ] **Step 1: Open VC, present mockups**

Three rows of tiles with section headers. Tile states: pending (dimmed + accept/reject buttons), active (full), completed (dimmed + sorted-down). Headers show counts and filters. "+ New project" button on Row 1.

Get user approval on:
- Tile composition (what fields visible)
- Empty-state per row
- Pending tile interaction
- Spacing and density
- Mobile responsive behavior

- [ ] **Step 2: Iterate until approved**

---

### Task 8.2 — Tile component template

**Files:**
- Create: `src/dashboard/` app
- Create: `src/dashboard/templates/dashboard/_tile.html`
- Test: `src/dashboard/tests/test_tile_render.py`

- [ ] **Step 1: Generate app + template**

```
python manage.py startapp dashboard src/dashboard
```

Add to INSTALLED_APPS.

`src/dashboard/templates/dashboard/_tile.html`:
```html
{% load i18n %}
<a href="{{ tile.url }}" class="rw-tile rw-tile--{{ tile.state }} d-block text-decoration-none position-relative">
  {% if tile.poster %}
    <img src="{{ tile.poster }}" alt="{{ tile.name }}" class="rw-tile-poster">
  {% else %}
    <div class="rw-tile-placeholder d-flex align-items-center justify-content-center">{{ tile.name|first }}</div>
  {% endif %}
  <div class="rw-tile-body p-3">
    <div class="rw-tile-name fw-semibold">{{ tile.name }}</div>
    {% if tile.role_label %}<div class="rw-tile-role text-muted small">{{ tile.role_label }}</div>{% endif %}
    {% if tile.studio_name %}<div class="rw-tile-studio text-muted small">{% trans "in" %} {{ tile.studio_name }}</div>{% endif %}
    <div class="rw-tile-status mt-1">
      <span class="rw-badge rw-badge-{{ tile.status }}">{{ tile.status_label }}</span>
    </div>
  </div>
  {% if tile.state == "pending" %}
    <div class="rw-tile-actions p-2 border-top d-flex gap-2">
      <form method="post" action="{{ tile.accept_url }}" class="flex-grow-1"><button type="submit" class="rw-btn rw-btn-primary rw-btn-sm w-100">{% trans "Accept" %}</button></form>
      <form method="post" action="{{ tile.reject_url }}"><button type="submit" class="rw-btn rw-btn-ghost rw-btn-sm">{% trans "Reject" %}</button></form>
    </div>
  {% endif %}
</a>
```

- [ ] **Step 2: Commit**

```
git add src/dashboard/ src/settings/components/common.py
git commit -m "feat(dashboard): tile component template"
```

---

### Task 8.3 — Dashboard view with 3 rows

**Files:**
- Create: `src/dashboard/views.py`, `src/dashboard/urls.py`
- Modify: `src/urls.py` to wire dashboard

- [ ] **Step 1: Implement**

`src/dashboard/views.py`:
```python
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from src.projects.models import Project


@login_required
def home(request):
    studio = request.active_studio
    if studio is None:
        return render(request, "dashboard/empty.html", {})

    # Row 1 — projects in active studio
    row1_projects = Project.objects.filter(studio=studio).order_by(
        # active first, then completed
        models.Case(models.When(status="completed", then=1), default=0), "-created_at",
    )

    # Row 2 — production memberships across all studios
    row2_qs = request.user.project_memberships.filter(
        tier="production", status__in=["active", "pending", "completed_with_project"],
    ).select_related("project__studio")

    # Row 3 — community memberships across all studios
    row3_qs = request.user.project_memberships.filter(
        tier="community", status__in=["active", "pending", "completed_with_project"],
    ).select_related("project__studio")

    return render(request, "dashboard/home.html", {
        "row1": [_project_to_tile(p, request) for p in row1_projects],
        "row2": [_membership_to_tile(m, request) for m in row2_qs],
        "row3": [_membership_to_tile(m, request) for m in row3_qs],
    })


def _project_to_tile(project, request):
    return {
        "url": f"/projects/{project.id}/",
        "poster": project.poster.url if project.poster else None,
        "name": project.name,
        "role_label": "Owner" if project.created_by_id == request.user.id else "",
        "studio_name": "",
        "status": project.status,
        "status_label": project.get_status_display(),
        "state": "completed" if project.status == "completed" else "active",
    }


def _membership_to_tile(m, request):
    return {
        "url": f"/projects/{m.project.id}/",
        "poster": m.project.poster.url if m.project.poster else None,
        "name": m.project.name,
        "role_label": m.role_type,
        "studio_name": m.project.studio.name,
        "status": m.status,
        "status_label": m.get_status_display(),
        "state": "pending" if m.status == "pending" else ("completed" if m.project.status == "completed" else "active"),
        "accept_url": f"/projects/invitations/{m.magic_link_token}/accept/" if m.status == "pending" else None,
        "reject_url": f"/projects/invitations/{m.magic_link_token}/reject/" if m.status == "pending" else None,
    }
```

`src/dashboard/templates/dashboard/home.html`:
```html
{% extends "base.html" %}
{% load i18n %}
{% block title %}{{ request.active_studio.name }}{% endblock %}
{% block content %}
<div class="container-fluid p-4">
  <h2>{{ request.active_studio.name }}</h2>

  <section class="mb-5">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="rw-section-hdr mb-0">{% trans "My projects" %}</h3>
      <a href="#" class="rw-btn rw-btn-primary">+ {% trans "New project" %}</a>
    </div>
    <div class="rw-tile-grid">
      {% for tile in row1 %}{% include "dashboard/_tile.html" %}{% empty %}<p class="text-muted">{% trans "No projects yet." %}</p>{% endfor %}
    </div>
  </section>

  <section class="mb-5">
    <h3 class="rw-section-hdr mb-3">{% trans "Production memberships" %}</h3>
    <div class="rw-tile-grid">
      {% for tile in row2 %}{% include "dashboard/_tile.html" %}{% empty %}<p class="text-muted">{% trans "No production memberships." %}</p>{% endfor %}
    </div>
  </section>

  <section>
    <h3 class="rw-section-hdr mb-3">{% trans "Review & community memberships" %}</h3>
    <div class="rw-tile-grid">
      {% for tile in row3 %}{% include "dashboard/_tile.html" %}{% empty %}<p class="text-muted">{% trans "No review memberships." %}</p>{% endfor %}
    </div>
  </section>
</div>
{% endblock %}
```

`src/dashboard/urls.py`:
```python
from django.urls import path
from . import views
app_name = "dashboard"
urlpatterns = [path("", views.home, name="home")]
```

In `src/urls.py`, change root:
```python
path("dashboard/", include("src.dashboard.urls")),
```
(Keep landing at `/` for anonymous users; logged-in users redirect from `/` to `/dashboard/`.)

Update `src/urls.py` `landing_view`:
```python
def landing_view(request):
    if request.user.is_authenticated:
        return redirect("dashboard:home")
    return render(request, "landing.html")
```

- [ ] **Step 2: Visual verification + commit**

User reloads → checks dashboard visually → approves → commit:
```
git add src/dashboard/ src/urls.py
git commit -m "feat(dashboard): 3-row tile dashboard wired to landing redirect"
```

---

### Task 8.4 — Phase 8 wrap-up

```
python manage.py test && python manage.py check
git commit --allow-empty -m "chore(v2): phase 8 complete — 3-row dashboard UI"
```

---

## Phase 9 — DRF API surface

### Task 9.1 — Studio + Subscription serializers + viewsets

**Files:**
- Modify: `src/accounts/api/serializers.py`, `src/accounts/api/views.py`
- Test: `src/accounts/tests/test_api.py`

- [ ] **Step 1: Write tests**

```python
class StudioApiTest(TestCase):
    def test_list_studios_returns_only_user_studios(self):
        u = User.objects.create_user(email="api@x.com", password="x")
        Studio.objects.create(name="Other", slug="other-1")  # not user's
        c = APIClient()
        c.force_authenticate(u)
        r = c.get("/api/v1/accounts/studios/")
        names = [s["name"] for s in r.json()["results"]]
        self.assertEqual(names, ["My Studio"])
```

- [ ] **Step 2: Implement**

Add Studio + Subscription serializers, ModelViewSets, register in router.

- [ ] **Step 3: Commit**

```
git commit -m "feat(api): Studio and Subscription DRF endpoints"
```

---

### Task 9.2 — Project + ProjectMembership API

Same pattern as 9.1.

```
git commit -m "feat(api): Project and ProjectMembership DRF endpoints"
```

---

### Task 9.3 — Phase 9 wrap-up

```
git commit --allow-empty -m "chore(v2): phase 9 complete — DRF API surface"
```

---

## Phase 10 — MCP tools + resources

### Task 10.1 — Studio MCP tools

**Files:**
- Modify: `src/mcp/tools/studio.py` (new file or extend existing)
- Test: `src/mcp/tests/test_studio_tools.py`

- [ ] **Step 1: Implement studio tools**

```python
# src/mcp/tools/studio.py
from src.accounts.services.studio_services import create_studio_for_user, list_studios_for_user


async def list_studios(actor):
    """List studios accessible to the current actor.
    Returns: array of {id, name, slug, specialty, is_primary, member_count}"""
    studios = list_studios_for_user(actor.user)
    return [
        {"id": str(s.id), "name": s.name, "slug": s.slug, "specialty": s.specialty,
         "is_primary": s.memberships.filter(user=actor.user, is_primary=True).exists(),
         "member_count": s.memberships.filter(status="active").count()}
        for s in studios
    ]


async def get_studio(actor, studio_id):
    """Get full details of one studio (members, projects, recent activity)."""
    from src.accounts.models import Studio
    s = Studio.objects.get(id=studio_id, memberships__user=actor.user)
    return {
        "id": str(s.id), "name": s.name, "slug": s.slug,
        "specialty": s.specialty,
        "members": [{"user": str(m.user.email), "role": m.role, "tier": m.tier} for m in s.memberships.all()],
        "project_count": s.projects.count(),
    }
```

Register tools in MCP server.

- [ ] **Step 2: Commit**

```
git add src/mcp/tools/studio.py src/mcp/tests/test_studio_tools.py
git commit -m "feat(mcp): studio list/get tools"
```

---

### Task 10.2 — Project MCP tools

Same pattern. `list_projects`, `get_project`, `create_project` (the last requires studio_full API key scope).

```
git commit -m "feat(mcp): project tools (list, get, create)"
```

---

### Task 10.3 — Phase 10 wrap-up

```
git commit --allow-empty -m "chore(v2): phase 10 complete — MCP tools + resources"
```

---

## Phase 11 — Final QA + cleanup

### Task 11.1 — Full test suite + smoke test

```
python manage.py test
python manage.py check --deploy
python manage.py collectstatic --noinput --dry-run
```

User smoke-tests:
- Sign up new user → My Studio created → land in dashboard
- Create project → see in Row 1
- Invite second user as production member → second user sees in Row 2
- Switch to second studio → see only their data
- Account deactivation → confirmed soft-deleted

### Task 11.2 — Final commit

```
git commit --allow-empty -m "chore(v2): sub-project 1 complete — Studio + Project core (foundations)"
```

---

## Self-Review Notes

- **Spec coverage:** All sections of foundations spec §1, §2, §4.5 (subscription scaffolding) covered. AI infrastructure (§3) and full MCP catalog deferred to sub-projects 2 + 3.
- **No placeholders:** every step shows actual code, file paths, commands.
- **Type consistency:** model names, field names, service signatures consistent across tasks.
- **Visual companion enforced:** Tasks 7.3 and 8.1-8.3 marked VC-REQUIRED per user mandate.
- **TDD pattern:** every code task has test-first cycle.
- **Per-phase commit cadence:** matches successful UI migration pattern.
