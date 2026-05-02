# Bible Reset & Seed Preparation

> **Context:** The canonical bible lifecycle was implemented and tested, but the test left the Mysterious Guest project in a broken state: the bible is **finalized** with **garbled UTF-8 content** (`"???????? ??????"`). The old test review (`ae6ca1e3-f874-4913-af86-319277b5505f`) also has garbled content. We need to reset everything so we can seed the real Story Bible V3.

> **Priority:** CRITICAL — blocks all bible review seeding.

> **Mode: NON-STOP.**

---

## What Happened

The engineering agent tested the canonical bible lifecycle by:
1. Setting a bible via `set_bible` API
2. Creating a review, delivering it
3. Finalizing the bible

But the content was garbled (UTF-8 encoding issue with Kurdish text). Now:
- `bible_status = "final"` → blocks `create_review`
- `canonical_bible = {"title": "???????? ??????", "version": "v1"}` → garbled
- `bible_version = 2` → inflated from test
- One test review exists with garbled content

---

## Section 1 — Database Reset

Run this Django management command or shell script to reset the Mysterious Guest project:

```python
# python manage.py shell
from projects.models import Project

p = Project.objects.get(id='b7821ef2-bef1-4527-b192-625ac0977aa5')

# Reset bible to empty draft
p.canonical_bible = {}
p.bible_version = 0
p.bible_status = 'empty'
p.bible_finalized_at = None
p.bible_finalized_by = None
p.save()

print(f"Reset: bible_status={p.bible_status}, bible_version={p.bible_version}")
```

Then delete the garbled test review:

```python
from reviews.models import BibleReview

# Delete the garbled test review
BibleReview.objects.filter(id='ae6ca1e3-f874-4913-af86-319277b5505f').delete()
print("Deleted garbled test review")
```

---

## Section 2 — Set the Real Bible Content

After reset, use the `set_bible` API endpoint to load the Story Bible V3:

```python
import json

# Read the bible content from the file
bible_file = 'path/to/STORY-BIBLE-V3-KU.md'  # adjust path
with open(bible_file, 'r', encoding='utf-8') as f:
    bible_text = f.read()

p = Project.objects.get(id='b7821ef2-bef1-4527-b192-625ac0977aa5')
p.canonical_bible = {
    "title": "میوانێکی نادیار — بایبڵی چیرۆک v3.0",
    "version": "v3.0",
    "content": bible_text
}
p.bible_version = 1
p.bible_status = 'draft'
p.save()

print(f"Bible set: version={p.bible_version}, status={p.bible_status}")
print(f"Content length: {len(bible_text)} chars")
```

The bible content file is at: `Projects/Mysterious-Guest/Reviews/STORY-BIBLE-V3-KU.md` (relative to the project root or the normalize folder).

---

## Section 3 — Verify UTF-8 Handling

The garbled content was caused by UTF-8 Kurdish text not being handled properly. Before proceeding, verify:

1. Read the bible back via API: `GET /api/projects/b7821ef2-bef1-4527-b192-625ac0977aa5/bible/`
2. Confirm Kurdish characters display correctly (not `?????`)
3. If the issue is in the API serializer, ensure `ensure_ascii=False` is set in any JSON serialization
4. Check `DEFAULT_CHARSET = 'utf-8'` in Django settings
5. Check database connection charset is `utf8mb4` (if MySQL) or `UTF8` (if PostgreSQL)

---

## Section 4 — Rebuild MCP Server

The MCP server must include all 4 bible management tools. Verify these exist in `rwanga-mcp/src/index.ts`:

1. **`get_bible`** — `GET /api/projects/{project_id}/bible/`
2. **`set_bible`** — `PUT /api/projects/{project_id}/bible/` with `{content: {...}}`  
3. **`deliver_review`** — `POST /api/reviews/bible/{project_id}/{review_id}/deliver/`
4. **`finalize_bible`** — `POST /api/projects/{project_id}/bible/finalize/`

After verifying/adding, rebuild:

```bash
cd rwanga-mcp
npm run build
```

Test with:
```bash
node dist/index.js --help  # or just ensure it compiles
```

---

## Section 5 — Verification Checklist

After all steps:

- [ ] `GET /api/projects/b7821ef2.../` shows `bible_status: "draft"`, `bible_version: 1`, Kurdish content intact
- [ ] `GET /api/projects/b7821ef2.../bible/` returns full Kurdish bible text without garbling
- [ ] `POST /api/reviews/bible/b7821ef2.../` successfully creates a new review (bible is no longer final)
- [ ] No garbled test reviews remain
- [ ] MCP server has all 42+ tools including the 4 bible tools
- [ ] MCP server builds without errors

---

## Important Notes

- The project ID is `b7821ef2-bef1-4527-b192-625ac0977aa5`
- The project owner is user 719 (Sarwar, sawasarwar3@gmail.com)
- Auth token for Sarwar: `8e7455eee062e10b7db8babe3938b316a0804cca`
- The bible content is in Kurdish (Sorani) — all UTF-8 handling must preserve Kurdish characters
- After this reset, we will seed ~20 decisions via MCP from the cowork session
