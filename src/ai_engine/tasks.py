from celery import shared_task


@shared_task
def run_script_breakdown(job_id):
    return {"job_id": job_id, "status": "done"}


@shared_task
def run_floorplan_generation(job_id):
    return {"job_id": job_id, "status": "done"}


@shared_task
def run_schedule_optimization(job_id):
    return {"job_id": job_id, "status": "done"}
