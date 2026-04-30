from allauth.account.views import LoginView as AllauthLoginView
from django.contrib.auth import logout
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.urls import path
from django.views import View

app_name = "accounts"


class LoginView(AllauthLoginView):
    template_name = "accounts/login.html"


class RegisterView(View):
    def get(self, request):
        return render(request, "accounts/login.html")


def magic_link(request):
    return HttpResponse("")


def logout_view(request):
    logout(request)
    return redirect("accounts:login")


def profile(request):
    return render(request, "stub.html", {"stub_name": "Profile"})


def settings(request):
    return render(request, "stub.html", {"stub_name": "Account settings"})


def team(request):
    return render(request, "stub.html", {"stub_name": "Team"})


def contacts(request, project_id):
    return render(request, "stub.html", {"stub_name": f"Contacts for {project_id}"})


def invite_row(request):
    return HttpResponse("<div></div>")


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
]
