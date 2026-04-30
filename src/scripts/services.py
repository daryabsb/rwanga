from django.shortcuts import get_object_or_404

from src.scripts.models import Script, ScriptElement


class ScriptsService:
    @staticmethod
    def list_scripts(project_id=None):
        qs = Script.objects.select_related("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    @staticmethod
    def get_script(script_id, project_id=None):
        qs = Script.objects.select_related("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return get_object_or_404(qs, id=script_id)

    @staticmethod
    def create_script(**kwargs):
        return Script.objects.create(**kwargs)

    @staticmethod
    def update_script(instance, **kwargs):
        for k, v in kwargs.items():
            setattr(instance, k, v)
        instance.save()
        return instance

    @staticmethod
    def delete_script(instance):
        instance.delete()

    @staticmethod
    def list_elements(project_id=None, script_id=None):
        qs = ScriptElement.objects.select_related("script", "scene", "character", "script__project")
        if project_id:
            qs = qs.filter(script__project_id=project_id)
        if script_id:
            qs = qs.filter(script_id=script_id)
        return qs

    @staticmethod
    def create_element(**kwargs):
        return ScriptElement.objects.create(**kwargs)

    @staticmethod
    def update_element(instance, **kwargs):
        for k, v in kwargs.items():
            setattr(instance, k, v)
        instance.save()
        return instance

    @staticmethod
    def delete_element(instance):
        instance.delete()
