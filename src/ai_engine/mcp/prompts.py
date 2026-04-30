"""
src.ai_engine.mcp.prompts
~~~~~~~~~~~~~~~~~~~~~~~~~

MCP prompts for progress analysis.
"""
import json

from mcp.types import GetPromptResult, Prompt, PromptArgument, PromptMessage, TextContent

from src.progress.models import AgentReport, DesignDecision, GapBlocker, ProgressTask
from src.progress.services import ProgressService

service = ProgressService()


def register_prompts(app):
    @app.list_prompts()
    async def list_prompts():
        return [
            Prompt(
                name="progress_report",
                description="Generate a structured project progress report from live Progress app data.",
                arguments=[
                    PromptArgument(name="scope", description="full | phase | blockers_only", required=False),
                    PromptArgument(name="phase", description="Phase code like P1 when scope=phase", required=False),
                ],
            )
        ]

    @app.get_prompt()
    async def get_prompt(name: str, arguments: dict[str, str] | None = None) -> GetPromptResult:
        if name != "progress_report":
            raise ValueError(f"Unknown prompt: {name}")

        args = arguments or {}
        scope = args.get("scope", "full")
        phase = args.get("phase")
        overview = service.get_overview()

        if scope == "phase" and phase:
            tasks = ProgressTask.objects.filter(phase=phase)
            scope_desc = f"Phase {phase}"
        elif scope == "blockers_only":
            tasks = ProgressTask.objects.filter(status="blocked")
            scope_desc = "Blockers Only"
        else:
            tasks = ProgressTask.objects.all()
            scope_desc = "Full Project"

        completed = list(tasks.filter(status="completed").values_list("title", flat=True))
        in_progress = list(tasks.filter(status="in_progress").values_list("title", flat=True))
        blocked = list(tasks.filter(status="blocked").values_list("title", flat=True))
        pending = list(tasks.filter(status="pending").values_list("title", flat=True))

        gaps = list(GapBlocker.objects.filter(status="open").values("title", "severity", "gap_type", "phase"))
        decisions = list(
            DesignDecision.objects.filter(status="approved").order_by("-created_at")[:10].values("title", "decision", "phase")
        )
        latest_report = AgentReport.objects.order_by("-created_at").first()

        prompt_text = f"""Generate a Rwanga project status report.

Scope: {scope_desc}
Current Phase: {overview['current_phase']}
Completion: {overview['phase_completion_pct']}%

Task Summary:
- Total: {overview['tasks']['total']}
- Completed ({len(completed)}): {', '.join(completed[:15])}{'...' if len(completed) > 15 else ''}
- In Progress ({len(in_progress)}): {', '.join(in_progress)}
- Blocked ({len(blocked)}): {', '.join(blocked)}
- Pending ({len(pending)}): {', '.join(pending[:15])}{'...' if len(pending) > 15 else ''}

Open Gaps/Blockers ({len(gaps)}):
{json.dumps(gaps, indent=2, default=str)}

Recent Approved Decisions:
{json.dumps(list(decisions), indent=2, default=str)}

Latest Agent Report: {latest_report.summary[:200] if latest_report else 'None'}

Produce a report with these sections:
1. Current Phase & Completion
2. Completed Work
3. In Progress
4. Blockers & Gaps
5. Risks
6. Decisions Made
7. Recommended Next Steps
"""
        return GetPromptResult(
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(type="text", text=prompt_text),
                )
            ]
        )
