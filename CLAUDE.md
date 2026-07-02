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

## Ground rules that outrank convenience

- **Launch gate:** the editor cannot launch while any launch-checklist **P0** is FALSE / PARTIAL / UNKNOWN.
- **AI gate:** **no AI / Agent-harness feature work** until *both* the launch gate **and** the Alive-App
  Phase 2 gate are closed. (See HANDOFF for exact status.)
- **Status of record (editor):** `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` — forensically verified honest on 2026-07-02.
- **Git root is this folder** (`E:\api\rwanga\`); the editor is a subfolder. Run editor tests from `rwanga-editor/`
  (`npm run test:unit`, `npm run test:e2e`).
