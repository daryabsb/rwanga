import uuid

from django.db import models
from django.test import TestCase

from src.core.models import BaseModel, SoftDeleteModel


class BaseModelTests(TestCase):
    class ExampleModel(BaseModel):
        name = models.CharField(max_length=100)

        class Meta:
            app_label = "core"

    class SoftExampleModel(SoftDeleteModel):
        name = models.CharField(max_length=100)

        class Meta:
            app_label = "core"

    def test_base_model_has_uuid_and_timestamps(self):
        obj = self.ExampleModel.objects.create(name="core")
        self.assertIsInstance(obj.id, uuid.UUID)
        self.assertIsNotNone(obj.created_at)
        self.assertIsNotNone(obj.updated_at)

    def test_soft_delete_marks_record_deleted(self):
        obj = self.SoftExampleModel.objects.create(name="soft")
        obj.soft_delete()

        self.assertTrue(self.SoftExampleModel.all_objects.filter(id=obj.id).exists())
        self.assertFalse(self.SoftExampleModel.objects.filter(id=obj.id).exists())
