# MCP Tools — Reviews & Community

> **Context:** The Reviews and Community Django apps are built with working API endpoints. The MCP server (`rwanga-mcp/src/index.ts`) currently has tools for projects, scenes, characters, locations, scripts, tasks, and gaps — but zero tools for reviews or community. We need these so the AI consultant (Claude/Darya) can seed bible reviews and community sessions directly.

> **Read first:** `rwanga-mcp/src/index.ts` to understand the tool registration pattern (use `server.tool()` with Zod schemas, call the `api<T>()` helper).

> **Mode: NON-STOP.** Build all tools. Rebuild and test.

---

## Section 1 — Review Tools

Add these tools to `rwanga-mcp/src/index.ts`, following the existing pattern:

### 1.1 — `list_reviews`
- **API:** `GET /reviews/bible/{project_id}/`
- **Params:** `project_id` (string, required)
- **Returns:** List of BibleReview objects (id, status, version, author, created_at)

### 1.2 — `create_review`
- **API:** `POST /reviews/bible/{project_id}/`
- **Params:** `project_id` (string, required), `content` (string, optional — JSON or text for the bible content)
- **Returns:** Created BibleReview object

### 1.3 — `get_review`
- **API:** `GET /reviews/bible/{project_id}/{id}/`
- **Params:** `project_id` (string, required), `review_id` (string, required)
- **Returns:** Full BibleReview with nested decisions and scene evaluations

### 1.4 — `update_review`
- **API:** `PATCH /reviews/bible/{project_id}/{id}/`
- **Params:** `project_id`, `review_id`, plus optional fields: `status`, `content`
- **Returns:** Updated BibleReview

### 1.5 — `list_decisions`
- **API:** `GET /reviews/decisions/{review_id}/`
- **Params:** `review_id` (string, required)
- **Returns:** List of ReviewDecision objects

### 1.6 — `create_decision`
- **API:** `POST /reviews/decisions/{review_id}/`
- **Params:** `review_id` (string, required), `topic` (string, required), `decision_text` (string, required), `scene_id` (string, optional)
- **Returns:** Created ReviewDecision with status='proposed'

### 1.7 — `lock_decision`
- **API:** `PATCH /reviews/decisions/{review_id}/{id}/`
- **Params:** `review_id`, `decision_id`, send body: `{ "status": "locked" }`
- **Returns:** Updated decision

### 1.8 — `reject_decision`
- **API:** `PATCH /reviews/decisions/{review_id}/{id}/`
- **Params:** `review_id`, `decision_id`, send body: `{ "status": "rejected" }`
- **Returns:** Updated decision

### 1.9 — `create_scene_evaluation`
- **API:** `POST /reviews/evaluations/{review_id}/` (verify actual URL in urls.py)
- **Params:** `review_id`, `scene_id`, `analysis` (text), `tension_score` (number 0-10), `notes` (optional), `recommendations` (optional)
- **Returns:** Created SceneEvaluation

---

## Section 2 — Community Tools

### 2.1 — `list_sessions`
- **API:** `GET /community/sessions/{project_id}/`
- **Params:** `project_id` (string, required)
- **Returns:** List of ReviewSession objects

### 2.2 — `create_session`
- **API:** `POST /community/sessions/{project_id}/`
- **Params:** `project_id`, `title` (string, required), `session_type` (enum: screenplay/bible/scene_selection), `visibility` (enum: invite_only/public, default invite_only)
- **Returns:** Created ReviewSession with status='draft'

### 2.3 — `get_session`
- **API:** `GET /community/sessions/{project_id}/{id}/`
- **Params:** `project_id`, `session_id`
- **Returns:** Full session with content, participants, comments

### 2.4 — `open_session` / `close_session`
- **API:** `PATCH /community/sessions/{project_id}/{id}/`
- **Params:** `project_id`, `session_id`, send body: `{ "status": "open" }` or `{ "status": "closed" }`

### 2.5 — `invite_participant`
- **API:** `POST /community/sessions/{id}/invite/`
- **Params:** `session_id`, `user_id` (string, required) or `email` (string)

### 2.6 — `add_session_content`
- **API:** Needs a new endpoint or use snapshot service
- **Params:** `session_id`, `content_type` (scene/bible), `content_data` (JSON), `label` (string)
- **Note:** If there's no direct API for adding SessionContent, create one: `POST /api/v1/community/sessions/{id}/content/`

### 2.7 — `list_comments`
- **API:** `GET /community/sessions/{id}/comments/`
- **Params:** `session_id`

### 2.8 — `create_comment`
- **API:** `POST /community/sessions/{id}/comments/`
- **Params:** `session_id`, `session_content_id` (string, required), `body` (string, required), `anchor_type` (enum: line/paragraph/scene/general, default general), `anchor_ref` (optional), `parent_id` (optional — for replies)

### 2.9 — `react_to_comment`
- **API:** `POST /community/sessions/{id}/comments/{comment_id}/react/`
- **Params:** `session_id`, `comment_id`, `reaction_type` (enum: agree/disagree/question)

---

## Section 3 — Verify API Endpoints

Before adding MCP tools, verify these Django API endpoints actually work. Some may need to be created or fixed:

```bash
# Start server
python manage.py runserver 0.0.0.0:8020

# Test review endpoints (replace UUIDs with real ones):
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8020/api/v1/reviews/bible/PROJECT_ID/
curl -X POST -H "Authorization: Token YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{"content": "test"}' http://localhost:8020/api/v1/reviews/bible/PROJECT_ID/

# Test community endpoints:
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8020/api/v1/community/sessions/PROJECT_ID/

# Check URL patterns:
python manage.py show_urls | grep -E "reviews|community"
```

If any endpoint returns 404 or 500, fix the Django URL/view first, then add the MCP tool.

---

## Section 4 — Build & Test

```bash
cd rwanga-mcp
npm run build

# Test by running the server briefly:
RWANGA_API_URL=http://localhost:8020/api/v1 RWANGA_API_TOKEN=YOUR_TOKEN node dist/index.js
```

Verify all new tools appear in the MCP tool list.

---

## Checklist

- [ ] All 9 review tools registered and working
- [ ] All 9 community tools registered and working
- [ ] Any missing API endpoints created in Django
- [ ] `npm run build` succeeds
- [ ] MCP server starts without errors
- [ ] Create a test review via MCP tool → verify it appears at /reviews/
- [ ] Create a test session via MCP tool → verify it appears at /community/
