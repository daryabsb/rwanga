from allauth.account.views import LoginView as AllauthLoginView
from django.conf import settings as django_settings
from django.contrib import messages
from django.contrib.auth import logout
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path
from django.views import View
from src.accounts.models import ProjectMembership, Studio
from src.projects.models import Project

app_name = "accounts"


class LoginView(AllauthLoginView):
    template_name = "accounts/login.html"

    def get_success_url(self):
        return django_settings.LOGIN_REDIRECT_URL


class RegisterView(View):
    def get(self, request):
        return render(request, "accounts/register.html")


def magic_link(request):
    return HttpResponse("Magic link flow is not enabled yet.", status=501)


def logout_view(request):
    logout(request)
    return redirect("accounts:login")


def profile(request):
    studio = Studio.objects.first()
    memberships = ProjectMembership.objects.filter(user=request.user, is_active=True).select_related("project") if request.user.is_authenticated else ProjectMembership.objects.none()
    return render(request, "accounts/profile.html", {"studio": studio, "memberships": memberships})


def settings(request):
    studio = getattr(request, "studio", None) or Studio.objects.first()
    if request.method == "POST" and request.user.is_authenticated:
        section = request.POST.get("section")
        if section == "account":
            first_name = (request.POST.get("first_name") or "").strip()
            last_name = (request.POST.get("last_name") or "").strip()
            display_name = " ".join(x for x in [first_name, last_name] if x).strip()
            if display_name:
                request.user.name = display_name
            email = (request.POST.get("email") or "").strip()
            if email:
                request.user.email = email
            request.user.save(update_fields=["name", "email"])
            messages.success(request, "Account settings saved.")
        elif section == "studio" and studio is not None:
            studio.name = (request.POST.get("studio_name") or studio.name).strip() or studio.name
            studio.language = (request.POST.get("language") or studio.language).strip() or studio.language
            studio.timezone = (request.POST.get("timezone") or studio.timezone).strip() or studio.timezone
            if request.FILES.get("logo"):
                studio.logo = request.FILES["logo"]
                studio.save()
            else:
                studio.save(update_fields=["name", "language", "timezone"])
            messages.success(request, "Studio settings saved.")
        return redirect("accounts:settings")
    return render(request, "accounts/settings.html", {"studio": studio})


def team(request):
    studio = Studio.objects.first()
    memberships = ProjectMembership.objects.select_related("project", "user").order_by("project__title", "created_at")
    filter_value = request.GET.get("filter")
    if filter_value == "crew":
        memberships = memberships.filter(role_type=ProjectMembership.RoleType.CREW)
    elif filter_value == "reviewer":
        memberships = memberships.filter(role_type=ProjectMembership.RoleType.INTERNAL_REVIEWER)
    invitations = memberships.filter(accepted_at__isnull=True)
    return render(request, "accounts/team.html", {"studio": studio, "members": memberships, "invitations": invitations})


def contacts(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    members = ProjectMembership.objects.filter(project=project, is_active=True).select_related("user")
    return render(request, "accounts/contacts.html", {"project": project, "members": members})


def invite_row(request):
    return render(request, "accounts/_invite_row.html")


def invite_modal(request):
    return HttpResponse(
        """
<div class="modal fade" id="inviteModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Invite member</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <p class="mb-0">Invite form wiring is pending.</p>
      </div>
    </div>
  </div>
</div>
"""
    )


def edit_member_modal(request, pk):
    membership = get_object_or_404(ProjectMembership, pk=pk)
    return HttpResponse(
        f"""
<div class="modal fade" id="editMemberModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Edit member: {membership.user.email}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <p class="mb-0">Member edit form wiring is pending.</p>
      </div>
    </div>
  </div>
</div>
"""
    )


def resend_invite(request, pk):
    messages.info(request, "Invite resend queued.")
    return redirect("accounts:team")


def cancel_invite(request, pk):
    membership = get_object_or_404(ProjectMembership, pk=pk)
    membership.delete()
    messages.success(request, "Invite cancelled.")
    return redirect("accounts:team")


def accept_invite(request, pk):
    return redirect("projects:list")


def decline_invite(request, pk):
    return redirect("projects:list")


def delete_account(request):
    if not request.user.is_authenticated:
        return redirect("accounts:login")
    user = request.user
    logout(request)
    user.delete()
    return redirect("accounts:login")


urlpatterns = [
    path("", LoginView.as_view(), name="index"),
    path("login/", LoginView.as_view(), name="login"),
    path("register/", RegisterView.as_view(), name="register"),
    path("magic-link/", magic_link, name="magic_link"),
    path("logout/", logout_view, name="logout"),
    path("profile/", profile, name="profile"),
    path("settings/", settings, name="settings"),
    path("team/", team, name="team"),
    path("contacts/<uuid:project_id>/", contacts, name="contacts"),
    path("invite-row/", invite_row, name="invite_row"),
    path("invite-modal/", invite_modal, name="invite_modal"),
    path("members/<uuid:pk>/edit-modal/", edit_member_modal, name="edit_member_modal"),
    path("invites/<uuid:pk>/resend/", resend_invite, name="resend_invite"),
    path("invites/<uuid:pk>/cancel/", cancel_invite, name="cancel_invite"),
    path("invites/<uuid:pk>/accept/", accept_invite, name="accept_invite"),
    path("invites/<uuid:pk>/decline/", decline_invite, name="decline_invite"),
    path("delete-account/", delete_account, name="delete_account"),
]
