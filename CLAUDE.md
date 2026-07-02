# Rwanga — Agent Entry Point

You are working on **Rwanga**: a Django platform (the `rwanga-*` folders) plus an Electron
**screenplay editor** in **`rwanga-editor/`**. Most sessions target the editor.

---

## 🧭 START HERE — before doing anything else

1. **Read `docs/handoff/HANDOFF.md`** — the living handoff. It tells you, in one page:
   the current phase, the **ONE next action**, open cases/gaps, and recently solved cases.
2. **Do not read the case archive to figure out what to do next.** The handoff *is* the index.
   Open a deep doc only when the handoff points you at it for the task in hand
   (e.g. `docs/RWANGA_GO_LIVE_2026-07-02.md`, `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md`).

If you started *inside* `rwanga-editor/`, the same pointer is mirrored at `rwanga-editor/CLAUDE.md`.

---

## 📓 The handoff / checkpoint system (keep it alive until the project ships)

This project carries its own memory in **`docs/handoff/`**:

| File | Role |
|---|---|
| `HANDOFF.md` | The single source of "where we are / what's next." Always current. **Read first, update last.** |
| `CHECKPOINTS.md` | Append-only log of dated checkpoints (what changed · status deltas · next). |
| `PROTOCOL.md` | The rules for maintaining this system. Read once. |

**Your obligation as an agent:** when you finish a unit of work — a **case solved**, a **gap found**,
a **plan made**, or a **task done** — you MUST (a) update `HANDOFF.md` and (b) append a checkpoint to
`CHECKPOINTS.md`. *A step that doesn't update the handoff didn't happen.* See `docs/handoff/PROTOCOL.md`.

Keep `HANDOFF.md` short (it's an index, not a report). Long-form detail belongs in `docs/…` and is
linked from the handoff.

---

## ⚖️ MASTERPLAN EXECUTION DOCTRINE — strict, binding on EVERY agent, EVERY session

While `docs/handoff/HANDOFF.md` names the Stage-1 masterplan as the active work, these rules are
**non-negotiable**. They outrank convenience, initiative, and "better ideas."

1. **The masterplan is the ONLY route for Stage-1 work.**
   `docs/plans/2026-07-02-stage1-launch-gate-masterplan.md`. Read its **§0 survival protocol**
   before touching anything. Do not invent parallel plans, do not restructure the campaign,
   do not "quickly fix" launch items outside a slice.
2. **One slice at a time, in ledger order.** Your next step is the first unchecked `- [ ]` box of
   the slice named in HANDOFF's NEXT ACTION. Never skip, reorder, or open slice N+1 while slice N's
   close ritual is unfinished.
3. **Tick as you go, in the plan file itself.** The checkboxes + State Ledger ARE the campaign
   state. Work that isn't ticked and committed does not exist.
4. **Every slice ends with the SLICE CLOSE RITUAL** (plan §0.3): ledger tick → HANDOFF update →
   CHECKPOINTS append → fixture check → commit → **push**. If you find a slice half-done without
   its ritual, finish the ritual FIRST — before any new work.
5. **Evidence before flips.** No launch-checklist row changes status without a test name, commit
   SHA, or a file under `docs/plans/evidence/`.
6. **Escalate, never paper over.** A real defect found during QA becomes a gap row in the plan's
   §0.5 ledger + a HANDOFF Open case. Weakening/deleting a test to get green is forbidden.
7. **Never commit `rwanga-editor/tests/fixtures/*.rga`.** The app auto-migrates opened fixtures;
   check `git status` before every commit and revert stray fixture edits.
8. **Blocked ≠ stuck.** If a step needs the user (a decision, an elevated shell), end the session
   CLEANLY via the close ritual with NEXT ACTION naming the exact blocking step. That is a valid
   handoff; improvising around the block is not.
9. **Push every slice-close commit** (`git push` from `E:\api\rwanga\`). Cross-session survival
   includes surviving this machine.
10. **The gates stay shut** (below). Track SP.1 of the plan is *design writing only* — an agent
    writing `Rga.Contribution` **code** during Stage 1 is violating doctrine, full stop.

---

## Ground rules that outrank convenience

- **Launch gate:** the editor cannot launch while any launch-checklist **P0** is FALSE / PARTIAL / UNKNOWN.
- **AI gate:** **no AI / Agent-harness feature work** until *both* the launch gate **and** the Alive-App
  Phase 2 gate are closed. (See HANDOFF for exact status.)
- **Status of record (editor):** `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` — forensically verified honest on 2026-07-02.
- **Git root is this folder** (`E:\api\rwanga\`); the editor is a subfolder. Run editor tests from `rwanga-editor/`
  (`npm run test:unit`, `npm run test:e2e`).
