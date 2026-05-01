import json

from django.template.loader import render_to_string

from src.departments.models import ContinuityItem, LightingNote, Prop, SoundNote, WardrobeItem
from src.floorplans.models import FloorPlan
from src.scheduling.models import ScheduleBlock
from src.shots.models import Shot


class ExportService:
    def generate_scene_viewer(self, scene) -> str:
        shots = list(Shot.objects.filter(scene=scene).values("shot_number", "shot_type", "description", "lens", "movement", "duration"))
        floorplan = FloorPlan.objects.filter(scene=scene).first()
        departments = {
            "lighting": list(LightingNote.objects.filter(shot__scene=scene).values("shot__shot_number", "note", "color_temp", "equipment")),
            "sound": list(SoundNote.objects.filter(shot__scene=scene).values("shot__shot_number", "note", "sound_type")),
            "props": list(Prop.objects.filter(project=scene.project, scenes=scene).values("name", "category", "status", "notes")),
            "wardrobe": list(WardrobeItem.objects.filter(scene=scene).values("outfit_name", "description", "notes", "character__name")),
            "continuity": list(ContinuityItem.objects.filter(scene=scene).values("direction", "description", "checked")),
        }
        payload = {
            "project": scene.project.title,
            "scene": {
                "number": scene.number,
                "title": scene.title,
                "summary": scene.summary,
            },
            "shots": shots,
            "floorplan": {
                "name": floorplan.name if floorplan else "",
                "room_width": floorplan.room_width if floorplan else 0,
                "room_height": floorplan.room_height if floorplan else 0,
                "furniture": floorplan.furniture if floorplan else [],
                "cameras": floorplan.cameras if floorplan else [],
                "paths": floorplan.paths if floorplan else [],
            },
            "departments": departments,
        }
        return render_to_string("exports/scene_viewer_export.html", {"scene": scene, "payload_json": json.dumps(payload)})

    def generate_call_sheet_pdf(self, shoot_day) -> bytes:
        from weasyprint import HTML

        blocks = ScheduleBlock.objects.filter(shoot_day=shoot_day).select_related("scene")
        html = render_to_string("exports/call_sheet_template.html", {"shoot_day": shoot_day, "blocks": blocks})
        return HTML(string=html).write_pdf()

    def generate_shot_list_pdf(self, project) -> bytes:
        from weasyprint import HTML

        shots = Shot.objects.filter(scene__project=project).select_related("scene").order_by("scene__number", "order")
        html = render_to_string("exports/shot_list_template.html", {"project": project, "shots": shots})
        return HTML(string=html).write_pdf()
