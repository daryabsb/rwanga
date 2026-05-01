from allauth.account.views import LoginView as AllauthLoginView
from django.conf import settings as django_settings
from django.contrib.auth import logout
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.urls import path
from django.views import View

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
    return render(request, "accounts/profile.html")


def settings(request):
    return render(request, "accounts/settings.html")


def team(request):
    return render(request, "accounts/team.html")


def contacts(request, project_id):
    return render(request, "accounts/contacts.html", {"project_id": project_id})


def invite_row(request):
    return render(request, "accounts/_invite_row.html")


def invite_modal(request):
    return HttpResponse("<div class='rw-modal'><div class='rw-card'>Invite member</div></div>")


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
    path("invites/<uuid:pk>/accept/", accept_invite, name="accept_invite"),
    path("invites/<uuid:pk>/decline/", decline_invite, name="decline_invite"),
    path("delete-account/", delete_account, name="delete_account"),
]
