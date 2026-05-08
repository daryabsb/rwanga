from django.http import HttpResponse
from django.urls import path
from src.shots.views import ShotEditView, ShotListView, StoryboardsView

app_name = 'shots'


def _stub(request, *args, **kwargs):
    return HttpResponse(status=404)


urlpatterns = [
    path('<uuid:project_pk>/', ShotListView.as_view(), name='list'),
    path('<uuid:project_pk>/storyboards/', StoryboardsView.as_view(), name='storyboards'),
    path('<uuid:project_pk>/<uuid:shot_pk>/edit/', ShotEditView.as_view(), name='edit'),
    # Stub endpoints — not yet built; templates use safe-form {% url ... as u %}
    path('<uuid:project_pk>/export-pdf/', _stub, name='export_pdf'),
]
