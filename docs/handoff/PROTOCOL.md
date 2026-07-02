# Handoff & Checkpoint Protocol

The rules for the project's in-repo memory. Read once; then follow every session.
This system lives with the project **until it ships**. Do not delete it.

## The three files

- **`HANDOFF.md`** — the living index of "where we are / what's next." One page. Always current.
  A new agent reads *only* this (plus what it links) to know what to do. Read first, update last.
- **`CHECKPOINTS.md`** — append-only, dated log. History of what changed. Never rewrite past entries.
- **`PROTOCOL.md`** — this file.

## What a "handoff" is

A handoff hands over one of these, so the next agent needs zero re-discovery:
- a **case solved** (with the evidence/commit that proves it),
- a **gap found** (a defect, risk, or missing piece — with a pointer),
- a **plan to execute** (link the plan doc; don't inline it), or
- a **task** ready to pick up (the single next action).

## When to update (obligation)

Update at the **end of every unit of work** — a solved case, a found gap, a made plan, a finished task —
and always before you end a session. *A step that doesn't update the handoff didn't happen.*

Each update = **two edits**:
1. **`HANDOFF.md`** — revise `NEXT ACTION`, `Where we are`, and the Open/Solved tables. Keep it short.
2. **`CHECKPOINTS.md`** — append a new checkpoint (template below). Never edit old ones.

## Checkpoint template (append to `CHECKPOINTS.md`, newest at top)

```
## <YYYY-MM-DD> · <short title> · HEAD <sha>
- **Did:** <what was done this session>
- **Evidence:** <tests run / commit / doc / QA — the proof>
- **Status deltas:** <checklist IDs or cases whose status changed, old → new>
- **Gaps/risks surfaced:** <new open items, or "none">
- **Next action:** <the single next thing — must match HANDOFF.md's NEXT ACTION>
```

## Rules

1. **Keep `HANDOFF.md` an index, not a report.** Detail goes in `docs/…` and is linked.
2. **Evidence, not assertion.** "Done" needs a test name, commit SHA, or recorded QA — same bar as the launch checklist (Operating Rule 4).
3. **One `NEXT ACTION`.** If several things are open, the handoff names the *one* to do next and lists the rest under Open cases.
4. **Never rewrite `CHECKPOINTS.md` history.** Correct a mistake with a new checkpoint that says so.
5. **Two masters stay in sync.** `RWANGA_IDE_LAUNCH_CHECKLIST.md` remains the P0 status of record; the handoff *points* to it, and both must agree. If you flip a checklist item, note it in the checkpoint's Status deltas.
6. **Respect the gates.** No AI/agent-harness feature work until the launch gate + Alive-App Phase 2 gate are closed (see HANDOFF).
