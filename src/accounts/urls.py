from allauth.account.forms import LoginForm
from django.conf import settings as django_settings
from django.contrib.auth import logout
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.urls import path
from django.views import View

app_name = "accounts"


class LoginView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect(request.GET.get("next") or django_settings.LOGIN_REDIRECT_URL)
        return render(request, "accounts/login.html")

    def post(self, request):
        data = request.POST.copy()
        if data.get("email") and not data.get("login"):
            data["login"] = data["email"]
        login_form = LoginForm(data=data, request=request)
        if login_form.is_valid():
            return login_form.login(
                request,
                redirect_url=data.get("next") or request.GET.get("next") or django_settings.LOGIN_REDIRECT_URL,
            )
        error = "; ".join(login_form.non_field_errors()) or "Invalid login credentials."
        return render(request, "accounts/login.html", {"error": error}, status=400)


class RegisterView(View):
    def get(self, request):
        return render(request, "accounts/login.html")


def magic_link(request):
    return HttpResponse("")


def logout_view(request):
    logout(request)
    return redirect("accounts:login")


def profile(request):
    return HttpResponse("profile")


def settings(request):
    return HttpResponse("settings")


def team(request):
    return HttpResponse("team")


def contacts(request, project_id):
    return HttpResponse(f"contacts {project_id}")


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
