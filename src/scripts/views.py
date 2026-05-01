from collections import defaultdict

from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View
from src.projects.models import Project
from src.scripts.models import Breakdown, Script, ScriptElement


class ScriptIndexView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scripts/upload.html', {'project': project, 'active_project': project})


class ScriptUploadView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scripts/upload.html', {'project': project, 'active_project': project})

    def post(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        if request.headers.get("HX-Request") == "true":
            return HttpResponse('<div class="rw-empty-state"><p style="margin:0">Upload queued.</p></div>')
        return render(request, 'scripts/upload.html', {'project': project, 'active_project': project})


class ScriptBreakdownView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        scripts = Script.objects.filter(project=project)
        scene_count = ScriptElement.objects.filter(script__in=scripts, scene__isnull=False).values("scene_id").distinct().count()
        buckets = {"characters": [], "locations": [], "props": [], "sfx": [], "vfx": []}
        category_map = {
            "character": "characters",
            "characters": "characters",
            "location": "locations",
            "locations": "locations",
            "prop": "props",
            "props": "props",
            "sfx": "sfx",
            "vfx": "vfx",
        }
        for item in Breakdown.objects.filter(script__in=scripts):
            bucket = category_map.get((item.category or "").lower())
            if not bucket:
                continue
            details = item.details or {}
            buckets[bucket].append(
                {
                    "pk": item.pk,
                    "name": item.item_name,
                    "scene_count": int(details.get("scene_count", 0) or 0),
                    "description": details.get("description", ""),
                    "int_ext": details.get("int_ext", ""),
                }
            )
        breakdown = {"scene_count": scene_count, **buckets}
        return render(
            request,
            "scripts/breakdown.html",
            {"project": project, "active_project": project, "active_section": "b", "breakdown": breakdown},
        )


class ScriptDocsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        documents = Script.objects.filter(project=project).select_related("project")
        return render(
            request,
            "scripts/docs.html",
            {"project": project, "active_project": project, "active_section": "s", "documents": documents},
        )


class ScriptElementsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        scripts = Script.objects.filter(project=project)
        selected_type = (request.GET.get("type") or "all").lower()
        category_map = {
            "character": "characters",
            "characters": "characters",
            "location": "locations",
            "locations": "locations",
            "prop": "props",
            "props": "props",
            "sfx": "sfx",
            "vfx": "vfx",
        }
        grouped = defaultdict(list)
        for item in Breakdown.objects.filter(script__in=scripts):
            bucket = category_map.get((item.category or "").lower())
            if not bucket:
                continue
            grouped[bucket].append(
                {
                    "pk": item.pk,
                    "name": item.item_name,
                    "scene_count": int((item.details or {}).get("scene_count", 0) or 0),
                    "description": (item.details or {}).get("description", ""),
                    "int_ext": (item.details or {}).get("int_ext", ""),
                }
            )
        elements = {
            "characters": grouped.get("characters", []),
            "locations": grouped.get("locations", []),
            "props": grouped.get("props", []),
            "sfx": grouped.get("sfx", []),
            "vfx": grouped.get("vfx", []),
        }
        if selected_type != "all" and selected_type in elements:
            for key in list(elements.keys()):
                if key != selected_type:
                    elements[key] = []
        context = {"project": project, "active_project": project, "active_section": "b", "elements": elements}
        if request.headers.get("HX-Request") == "true":
            return render(request, "scripts/_elements_body.html", context)
        return render(request, "scripts/elements.html", context)


class ScriptModalStubView(View):
    def get(self, request, project_pk, *args, **kwargs):
        return HttpResponse(status=204)
