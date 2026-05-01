from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from src.accounts.models import Studio
from src.departments.models import ContinuityItem, LightingNote, Prop, SoundNote, WardrobeItem
from src.projects.models import Character, Project, Scene
from src.shots.models import Shot


class DepartmentViewsTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="depv@example.com", password="pass123", terms=True)
        self.client.force_login(self.user)
        studio = Studio.objects.create(name="D", slug="d")
        self.project = Project.objects.create(studio=studio, owner=self.user, title="P", slug="p-d")
        self.scene = Scene.objects.create(project=self.project, number=1, title="Scene 1")
        self.character = Character.objects.create(project=self.project, name="Hero")
        self.shot = Shot.objects.create(scene=self.scene, shot_number="1.1", shot_type="visual")

    def test_lighting_list(self):
        response = self.client.get(reverse("departments:lighting", args=[self.project.pk]))
        self.assertEqual(response.status_code, 200)

    def test_lighting_create(self):
        response = self.client.post(reverse("departments:lighting", args=[self.project.pk]), {"shot": str(self.shot.pk), "note": "Key", "color_temp": "5600K", "equipment": "Panel"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(LightingNote.objects.count(), 1)

    def test_sound_list(self):
        response = self.client.get(reverse("departments:sound", args=[self.project.pk]))
        self.assertEqual(response.status_code, 200)

    def test_sound_create(self):
        response = self.client.post(reverse("departments:sound", args=[self.project.pk]), {"shot": str(self.shot.pk), "note": "Room tone", "sound_type": "ambience"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(SoundNote.objects.count(), 1)

    def test_props_list(self):
        response = self.client.get(reverse("departments:props", args=[self.project.pk]))
        self.assertEqual(response.status_code, 200)

    def test_props_create(self):
        response = self.client.post(reverse("departments:props", args=[self.project.pk]), {"name": "Cup", "category": "A", "status": "needed", "notes": "Red"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Prop.objects.count(), 1)

    def test_wardrobe_list(self):
        response = self.client.get(reverse("departments:wardrobe", args=[self.project.pk]))
        self.assertEqual(response.status_code, 200)

    def test_wardrobe_create(self):
        response = self.client.post(reverse("departments:wardrobe", args=[self.project.pk]), {"character": str(self.character.pk), "scene": str(self.scene.pk), "outfit_name": "Coat"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(WardrobeItem.objects.count(), 1)

    def test_continuity_list(self):
        response = self.client.get(reverse("departments:continuity", args=[self.project.pk]))
        self.assertEqual(response.status_code, 200)

    def test_continuity_create(self):
        response = self.client.post(reverse("departments:continuity", args=[self.project.pk]), {"scene": str(self.scene.pk), "direction": "in", "description": "Door open", "checked": False})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(ContinuityItem.objects.count(), 1)
