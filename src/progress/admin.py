from django.contrib import admin

from src.progress.models import (
    AgentReport,
    ChangeRecord,
    DesignDecision,
    DocumentVersion,
    GapBlocker,
    ProgressTask,
    ProgressUpdate,
    SystemDiagram,
)

admin.site.register(ProgressTask)
admin.site.register(ProgressUpdate)
admin.site.register(DesignDecision)
admin.site.register(GapBlocker)
admin.site.register(AgentReport)
admin.site.register(ChangeRecord)
admin.site.register(SystemDiagram)
admin.site.register(DocumentVersion)
