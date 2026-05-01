from django import forms


PROJECT_TYPE_CHOICES = [
    ("feature", "فیلمی درێژ"),
    ("short", "فیلمی کورت"),
    ("episode", "ئەپیۆدی تەلەفزیۆن"),
    ("music_video", "ڤیدیۆی گۆرانی"),
    ("commercial", "ڕیکلام"),
]


class ProjectBasicsForm(forms.Form):
    title = forms.CharField(max_length=200, required=True)
    title_latin = forms.CharField(max_length=200, required=False)
    project_type = forms.ChoiceField(choices=PROJECT_TYPE_CHOICES, initial="feature")
    director_name = forms.CharField(max_length=200, required=False)
    logline = forms.CharField(required=False)


class ScriptUploadForm(forms.Form):
    project_id = forms.UUIDField(widget=forms.HiddenInput)
    script_file = forms.FileField(required=False)
    skip = forms.BooleanField(required=False)


class ModuleSelectionForm(forms.Form):
    project_id = forms.UUIDField(widget=forms.HiddenInput)
    modules = forms.MultipleChoiceField(
        required=False,
        choices=[
            ("scripts", "Scripts"),
            ("shots", "Shots"),
            ("floorplans", "Floor Plans"),
            ("scheduling", "Scheduling"),
            ("departments", "Departments"),
            ("ai_engine", "AI Engine"),
        ],
    )


class TeamInviteForm(forms.Form):
    project_id = forms.UUIDField(widget=forms.HiddenInput)
