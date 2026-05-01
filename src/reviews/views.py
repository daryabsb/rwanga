from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project, Scene
from src.reviews.models import BibleReview, InlineComment


class ReviewsIndexView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        reviews = BibleReview.objects.filter(project=project).select_related("author", "author__user")
        return render(request, "reviews/index.html", {"project": project, "reviews": reviews, "active_project": project})


class SceneCommentsPartialView(View):
    def get(self, request, project_pk, scene_pk):
        project = get_object_or_404(Project, id=project_pk)
        scene = get_object_or_404(Scene, id=scene_pk, project=project)
        comments = InlineComment.objects.filter(content_type__model="scene", object_id=str(scene.id)).select_related("author")
        return render(request, "reviews/_comments.html", {"project": project, "scene": scene, "comments": comments})
