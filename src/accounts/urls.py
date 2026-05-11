from allauth.account.views import LoginView as AllauthLoginView
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path, reverse
from django.views import View
from src.accounts.models import Studio

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
    return render(request, "accounts/profile.html", {})


def settings(request):
    return render(request, "accounts/settings.html", {})


def team(request):
    template = "accounts/_team_table.html" if getattr(request, "htmx", False) else "accounts/team.html"
    return render(request, template, {})


def contacts(request, project_id):
    return render(request, "accounts/contacts.html", {"project_id": project_id})


def invite_row(request):
    return HttpResponse("<div></div>")


def invite_modal(request):
    return HttpResponse("")


def edit_member_modal(request, pk):
    return HttpResponse("")


def resend_invite(request, pk):
    return redirect("accounts:team")


def cancel_invite(request, pk):
    return redirect("accounts:team")


def delete_account(request):
    return HttpResponse("")


@login_required
def switch_studio(request):
    if request.method != "POST":
        return HttpResponseRedirect(reverse("projects:list"))
    sid = request.POST.get("studio_id")
    studio = get_object_or_404(
        Studio, id=sid, memberships__user=request.user, memberships__status="active",
    )
    request.session["active_studio_id"] = str(studio.id)
    return HttpResponseRedirect(reverse("projects:list"))


@login_required
def exit_studio(request):
    primary = request.user.studio_memberships.filter(is_primary=True).first()
    if primary:
        request.session["active_studio_id"] = str(primary.studio_id)
    return HttpResponseRedirect(reverse("projects:list"))


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
    path("member/<uuid:pk>/edit/", edit_member_modal, name="edit_member_modal"),
    path("invite/<uuid:pk>/resend/", resend_invite, name="resend_invite"),
    path("invite/<uuid:pk>/cancel/", cancel_invite, name="cancel_invite"),
    path("delete/", delete_account, name="delete_account"),
    path("switch-studio/", switch_studio, name="switch_studio"),
    path("exit-studio/", exit_studio, name="exit_studio"),
]
