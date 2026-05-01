from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.accounts.api.views import (
    ConsultantProfileViewSet,
    ProjectConsultantAssignmentViewSet,
    ProjectMembershipViewSet,
    SignupProfileViewSet,
    StudioViewSet,
    UserViewSet,
    obtain_token,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("studios", StudioViewSet, basename="studio")
router.register("memberships", ProjectMembershipViewSet, basename="membership")
router.register("consultants", ConsultantProfileViewSet, basename="consultant")
router.register("consultant-assignments", ProjectConsultantAssignmentViewSet, basename="consultant-assignment")
router.register("signup-profiles", SignupProfileViewSet, basename="signup-profile")

urlpatterns = [
    path("token/", obtain_token, name="accounts-api-obtain-token"),
    path("", include(router.urls)),
]
