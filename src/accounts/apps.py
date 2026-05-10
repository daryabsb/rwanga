from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "src.accounts"

    def ready(self):
        from . import signals  # noqa

        # Patch allauth views to be accessible without login.
        # LoginRequiredMiddleware (Django 5.2) makes every view require login
        # by default; allauth's auth views must remain public.
        from django.contrib.auth.decorators import login_not_required
        from django.utils.decorators import method_decorator
        from allauth.account import views as allauth_views

        _public_allauth_views = [
            "LoginView",
            "LogoutView",
            "SignupView",
            "PasswordResetView",
            "PasswordResetDoneView",
            "PasswordResetFromKeyView",
            "PasswordResetFromKeyDoneView",
            "ConfirmEmailView",
            "EmailVerificationSentView",
            "ConfirmLoginCodeView",
            "RequestLoginCodeView",
            "AccountInactiveView",
            "SignupByPasskeyView",
        ]
        for cls_name in _public_allauth_views:
            view_cls = getattr(allauth_views, cls_name, None)
            if view_cls:
                view_cls.dispatch = method_decorator(login_not_required)(view_cls.dispatch)
