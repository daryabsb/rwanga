from django.urls import path
from django.http import HttpResponse

app_name = "accounts"


def placeholder(request):
    return HttpResponse("accounts")


urlpatterns = [
    path("", placeholder, name="index"),
]
