import json
import os
from typing import Any

import requests
from mcp.server.fastmcp import FastMCP


API_BASE = os.getenv("RWANGA_API_BASE", "http://localhost:8020/api/v1")
API_TOKEN = os.getenv("RWANGA_API_TOKEN", "")

mcp = FastMCP("rwanga-remote")


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if API_TOKEN:
        headers["Authorization"] = f"Token {API_TOKEN}"
    return headers


def _get(path: str, params: dict[str, Any] | None = None):
    response = requests.get(f"{API_BASE}{path}", headers=_headers(), params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _post(path: str, payload: dict[str, Any]):
    response = requests.post(f"{API_BASE}{path}", headers=_headers(), data=json.dumps(payload), timeout=30)
    response.raise_for_status()
    return response.json()


def _patch(path: str, payload: dict[str, Any]):
    response = requests.patch(f"{API_BASE}{path}", headers=_headers(), data=json.dumps(payload), timeout=30)
    response.raise_for_status()
    return response.json()


@mcp.tool()
def create_project(title: str, title_latin: str = "", project_type: str = "feature", logline: str = "", director_name: str = ""):
    return _post("/projects/projects/", {"title": title, "title_latin": title_latin, "project_type": project_type, "logline": logline, "director_name": director_name, "status": "draft"})


@mcp.tool()
def list_projects():
    return _get("/projects/projects/")


@mcp.tool()
def get_project(project_id: str):
    return _get(f"/projects/projects/{project_id}/")


@mcp.tool()
def create_scene(project_id: str, scene_number: int, heading: str, description: str = ""):
    return _post(f"/projects/projects/{project_id}/scenes/", {"scene_number": scene_number, "heading": heading, "description": description})


@mcp.tool()
def list_scenes(project_id: str):
    return _get(f"/projects/projects/{project_id}/scenes/")


@mcp.tool()
def update_scene(project_id: str, scene_id: str, **kwargs):
    return _patch(f"/projects/projects/{project_id}/scenes/{scene_id}/", kwargs)


@mcp.tool()
def bulk_create_scenes(project_id: str, scenes: list[dict[str, Any]]):
    return [create_scene(project_id=project_id, **scene) for scene in scenes]


@mcp.tool()
def create_character(project_id: str, name: str, name_latin: str = "", description: str = "", type: str = "supporting"):
    return _post(f"/projects/projects/{project_id}/characters/", {"name": name, "name_latin": name_latin, "description": description, "character_type": type})


@mcp.tool()
def list_characters(project_id: str):
    return _get(f"/projects/projects/{project_id}/characters/")


@mcp.tool()
def bulk_create_characters(project_id: str, characters: list[dict[str, Any]]):
    return [create_character(project_id=project_id, **character) for character in characters]


@mcp.tool()
def create_location(project_id: str, name: str, name_latin: str = "", int_ext: str = "", description: str = ""):
    return _post(f"/projects/projects/{project_id}/locations/", {"name": name, "name_latin": name_latin, "int_ext": int_ext, "description": description})


@mcp.tool()
def list_locations(project_id: str):
    return _get(f"/projects/projects/{project_id}/locations/")


@mcp.tool()
def upload_script(project_id: str, title: str, content: str, format: str = "plain"):
    return _post(f"/scripts/projects/{project_id}/scripts/", {"project": project_id, "title": title, "content": content, "script_format": format})


@mcp.tool()
def create_script_element(project_id: str, script_id: str, element_type: str, content: str, scene_id: str | None = None, order: int = 0):
    payload = {"script": script_id, "element_type": element_type, "content": content, "order": order}
    if scene_id:
        payload["scene"] = scene_id
    return _post(f"/scripts/projects/{project_id}/scripts/{script_id}/elements/", payload)


@mcp.tool()
def list_tasks(status: str | None = None, phase: str | None = None):
    params = {}
    if status:
        params["status"] = status
    if phase:
        params["phase"] = phase
    return _get("/progress/tasks/", params=params)


@mcp.tool()
def update_task(task_id: str, status: str, note: str = ""):
    return _patch(f"/progress/tasks/{task_id}/", {"status": status, "description": note})


@mcp.tool()
def create_gap_blocker(description: str, gap_type: str, severity: str, app: str):
    return _post("/progress/gaps/", {"title": description[:120], "description": description, "gap_type": gap_type, "severity": severity, "related_app": app, "phase": "P1", "status": "open"})


@mcp.resource("project://{project_id}")
def project_resource(project_id: str) -> str:
    project = get_project(project_id)
    scenes = list_scenes(project_id)
    characters = list_characters(project_id)
    return json.dumps({"project": project, "scenes": scenes, "characters": characters}, default=str)


@mcp.resource("progress://dashboard")
def progress_dashboard() -> str:
    tasks = _get("/progress/tasks/")
    return json.dumps({"count": len(tasks) if isinstance(tasks, list) else tasks.get("count"), "data": tasks}, default=str)


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=int(os.getenv("RWANGA_MCP_PORT", "8021")))
