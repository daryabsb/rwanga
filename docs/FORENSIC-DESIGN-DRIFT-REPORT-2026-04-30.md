# Forensic Design Drift Report
Date: 2026-04-30
Repository: `E:\api\rwanga`
Design baseline: `rwanga-design-kit/INDEX.md` + `rwanga-design-kit/MASTER-DESIGN.md`

## Scope
- Performed forensic comparison between implemented code and design-kit requirements.
- Did not refactor or alter already-implemented functional modules during this pass.
- Recorded task-by-task status in Progress app and added gap records.

## Method
- Reviewed design reading-order files from `INDEX.md`.
- Mapped P0-P7 tasks from `MASTER-DESIGN.md` against current `src/` implementation.
- Verified architecture coverage (apps, models, services, API layers, tests, templates, routing).
- Captured template drift via SHA256 hash comparison against `rwanga-design-kit/templates/*`.

## High-Impact Drift Findings
1. Installed app architecture drift:
   - `src/settings/components/common.py` currently installs only:
     - `src.core`, `src.accounts`, `src.projects`, `src.progress`
   - Design expects broader local app registration across phases (reviews/community/realtime and phase apps).

2. Missing architecture-critical apps from design:
   - `src/reviews/` missing
   - `src/community/` missing
   - `src/realtime/` missing

3. Phase-app implementation is mostly view stubs in several modules:
   - `shots`, `floorplans`, `exports`, `departments`, `scheduling`, `locations`, `notifications`, `ai_engine`
   - These currently lack one or more of: `models.py`, `services.py`, `api/`, and tests expected by design.

4. Template drift vs design-kit files (hash mismatch):
   - `templates/base.html`
   - `src/accounts/templates/accounts/login.html`
   - `src/projects/templates/projects/dashboard.html`
   - `src/projects/templates/projects/create_wizard.html`
   - `src/projects/templates/projects/scene_view.html`
   - `src/scripts/templates/scripts/upload.html`

## Phase Status (Forensic Classification)
- P0: Mostly complete; validation checklist and initial system diagram still not fully evidenced.
- P1: Core auth/projects/base complete; `reviews` + inline comment integration pending; workspace UX partial.
- P2: Dashboard exists; shots/floorplans/exports are partial (view-first, missing model/service/api depth).
- P3: Departments present as stubs; full tab/model/API/export integration pending.
- P4: Scheduling/locations/notifications partial; call-sheet pipeline pending.
- P5: AI engine partial endpoints only; MCP/realtime progress and AI pipelines pending.
- P6: Community app + professional review output pending.
- P7: PWA/budget/performance/polish tasks pending or not evidenced.

## Progress App Recording Completed
Recorded in DB (2026-04-30):
- Added/updated P0-P7 tasks with status and forensic notes.
- Added per-task `ProgressUpdate` forensic note entries.
- Added open `GapBlocker` entries for critical drift.

Current DB snapshot:
- Total tasks: 83
- Completed: 38
- In progress: 16
- Pending: 29
- Open gaps: 4
- Forensic updates added: 54

## Open GapBlockers Added In This Pass
- Gap: Design requires many local apps but only 4 are installed
- Gap: Design-kit template hashes diverged from implementation
- Gap: Missing reviews/community/realtime apps

## Notes
- This report intentionally lists drift without auto-refactoring mismatches, per instruction.
- Remaining build work is substantial and spans P1-P7 task backlog.
