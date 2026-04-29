DJANGO_CELERY_BEAT_TZ_AWARE = False
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TASK_ROUTES = {
    "src.ai_engine.tasks.*": {"queue": "ai"},
    "src.scheduling.tasks.*": {"queue": "scheduling"},
    "src.exports.tasks.*": {"queue": "exports"},
}
