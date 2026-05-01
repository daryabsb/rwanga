# MCP Setup Guide — Connecting Claude to Rwanga Progress

After the coding agent implements the MCP server (see `MCP-PROGRESS-TASK.md`), follow these steps to connect.

---

## 1. Claude Code (Local — Your Machine)

Add this to your Claude Code MCP config. On Windows, the config file is at:
`%APPDATA%\Claude\claude_desktop_config.json`

Or if using Claude Code CLI, add to `.claude/settings.json` in the repo:

```json
{
  "mcpServers": {
    "rwanga-progress": {
      "command": "python",
      "args": ["-m", "src.ai_engine.mcp.server"],
      "cwd": "E:\\api\\rwanga",
      "env": {
        "DJANGO_SETTINGS_MODULE": "src.settings"
      }
    }
  }
}
```

After adding this config:
1. Restart Claude Code
2. You should see "rwanga-progress" in the MCP server list
3. The coding agent can now read/write Progress data directly

### Quick Test

In Claude Code, ask:
> "Read the progress overview from rwanga-progress"

You should get back JSON with task counts, gaps, and completion percentage.

---

## 2. Cowork (Remote — So Darya's Cowork Claude Can Observe)

This requires the SSE transport and a public URL. Two options:

### Option A: ngrok (simplest)

```bash
# Terminal 1: Start MCP server with SSE
cd E:\api\rwanga
python -m src.ai_engine.mcp.server --transport sse --port 8002

# Terminal 2: Expose via ngrok
ngrok http 8002
```

ngrok gives you a public URL like `https://abc123.ngrok.io`. The SSE endpoint is at `/sse`.

### Option B: Cloudflare Tunnel (persistent)

```bash
cloudflared tunnel --url http://localhost:8002
```

### Connecting from Cowork

Once exposed, the MCP server URL can be added as a custom connector in Cowork settings. The SSE endpoint will be:
```
https://<your-tunnel-url>/sse
```

This is optional and can be set up later. Path 1 (Claude Code local) is the priority.

---

## 3. Verification Checklist

After setup, verify these work:

```
[ ] python -m src.ai_engine.mcp.server starts without errors
[ ] Claude Code shows "rwanga-progress" in MCP servers
[ ] Reading rwanga://progress/overview returns valid JSON
[ ] Reading rwanga://progress/tasks returns 83+ tasks
[ ] Reading rwanga://progress/gaps returns gap entries
[ ] Creating a test task via create_task tool works
[ ] Updating task status via update_task_status tool works
[ ] The progress_report prompt generates a status report
```

---

## 4. What This Unlocks

Once connected, the coding agent can:
- **Start sessions** by reading `rwanga://progress/overview` to see current state
- **Pick tasks** by reading `rwanga://progress/tasks` filtered by phase/status
- **Check blockers** by reading `rwanga://progress/gaps` before starting work
- **Report work** by calling `report_progress_update` after each implementation step
- **Log changes** by calling `record_change` with files affected and commit hash
- **Flag problems** by calling `report_gap` when something is unclear

No more copy-pasting reports between sessions.
