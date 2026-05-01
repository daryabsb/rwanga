class ExportService:
    def build_scene_viewer_payload(self, *, scene):
        return {
            "scene_id": str(scene.id),
            "scene_number": scene.number,
            "title": scene.title,
        }
