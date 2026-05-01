import json

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer

from src.ai_engine.models import AIJob
from src.ai_engine.providers import get_text_provider, get_translation_provider
from src.scripts.models import Script


def broadcast_job_progress(job):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"project_{job.project_id}",
        {
            "type": "job.progress",
            "job_id": str(job.id),
            "progress": job.progress,
            "step": job.step,
            "status": job.status,
        },
    )


@shared_task(bind=True)
def run_breakdown(self, script_id, job_id=None):
    script = Script.objects.get(pk=script_id)
    if job_id:
        job = AIJob.objects.get(pk=job_id)
    else:
        job = AIJob.objects.get(pk=self.request.id)

    job.status = AIJob.Status.RUNNING
    job.progress = 1
    job.step = "Starting"
    job.save(update_fields=["status", "progress", "step", "updated_at"])
    broadcast_job_progress(job)

    translator = get_translation_provider()
    text_provider = get_text_provider()

    job.step = "Translating script..."
    job.progress = 10
    job.save(update_fields=["step", "progress", "updated_at"])
    broadcast_job_progress(job)
    english_text = translator.translate(script.content or "", "ckb_Arab", "eng_Latn")

    job.step = "Extracting scenes..."
    job.progress = 40
    job.save(update_fields=["step", "progress", "updated_at"])
    broadcast_job_progress(job)
    scenes_json = text_provider.generate_text(
        f"Extract scenes and return JSON array with scene_number and summary only.\\n\\n{english_text}",
        system="You are a screenplay parser. Return valid JSON only.",
    )

    job.step = "Parsing output..."
    job.progress = 70
    job.save(update_fields=["step", "progress", "updated_at"])
    broadcast_job_progress(job)

    parsed = []
    try:
        parsed = json.loads(scenes_json)
    except Exception:
        parsed = [{"raw": scenes_json}]

    job.result = {"scenes": parsed}
    job.status = AIJob.Status.DONE
    job.progress = 100
    job.step = "Complete"
    job.save(update_fields=["result", "status", "progress", "step", "updated_at"])
    broadcast_job_progress(job)
    return job.result
