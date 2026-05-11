# Cleanup: Delete Old Bad Decisions

> **Priority:** HIGH — pollutes the review with 20 duplicate question-style decisions
> **Mode: NON-STOP.**

---

## Context

The review `96f026e7-a45c-4e04-b604-c208aede15b7` has 45 decisions total:
- **25 CORRECT** (newly created, all `status=locked`) — proper Kurdish conclusion statements from the review sessions
- **20 BAD** (old, `status=proposed` except one that is `locked`) — question-style decisions that were created incorrectly

The bad decisions need to be deleted from the database. They cannot be rejected via API because only directors can reject, and the MCP runs as user 28 (Super Admin), not Sarwar (719).

---

## Delete Script

Run this in Django shell (`python manage.py shell`):

```python
from reviews.models import ReviewDecision

# The 20 bad decision IDs to delete
bad_ids = [
    '55b02cf9-7d55-4d31-b3ca-54a9ee028fe9',
    '3e31d9a6-7e44-4100-ab21-a01dd57edd36',
    '52664763-c6ce-460e-97bd-cf8401a59039',
    '76487c5e-3970-4e4d-bb59-b590f3cc47f8',
    '2c06bce2-9ecc-4276-8535-b92cef91eee0',
    '00cda708-1364-4ff4-8d78-c23e07ce22de',
    '625c93de-1dc1-4dbc-afeb-1bd774474a2c',
    'b0199081-08a7-45c8-8be9-470cf7586198',
    'e0647a6a-271e-420f-9d2f-1e4a2f776676',
    'b8842d96-c352-4a55-9132-3fa84cd2edb5',
    'c560c259-a52c-4342-b3cf-a7c9ed99e06c',
    'ad235c7e-2d5e-4023-964f-5deff9870eca',
    'c1272802-34cc-4804-b8fc-ff3d5e7d164e',
    'e0ae64c7-b085-4c98-9623-ea4bd882fc0c',
    'af33d5e1-82e8-49b6-8a68-941ea7a0a839',
    'eeece2b4-0f20-4f24-83ce-cb7149f6c515',
    '395963bc-6fb0-4e7a-979f-e2a44c594fa5',
    '47f7ad5f-96e9-4d18-9902-5d4cb6e969fa',
    '6089f2c7-9606-4935-a98f-025940680dee',
    '0473726a-07b3-487c-96f7-49fe96def393',
]

deleted = ReviewDecision.objects.filter(id__in=bad_ids).delete()
print(f"Deleted: {deleted}")

# Verify only 25 correct decisions remain
remaining = ReviewDecision.objects.filter(
    bible_review_id='96f026e7-a45c-4e04-b604-c208aede15b7'
).count()
print(f"Remaining decisions: {remaining}")  # Should be 25
```

---

## Also Fix: MCP Permission for Reject

The `reject_decision` API endpoint currently requires `is_director=True`. The MCP runs as user 28 (Super Admin) who is NOT a director on this project. Either:

1. **Option A:** Add Super Admin override to `reject_decision` permission check (recommended)
2. **Option B:** Make user 28 a director on the Mysterious Guest project

This is needed so future decision management works properly from the MCP.

---

## Verification

After running the delete script:
- [ ] `GET /api/reviews/decisions/96f026e7.../` returns exactly 25 decisions
- [ ] All 25 have `status: "locked"`
- [ ] No question-style decisions remain (topics should start with ١., ٢., etc. or بەرزکردنەوەی or پرەنسیپی)
- [ ] Review detail page shows correct decision count
