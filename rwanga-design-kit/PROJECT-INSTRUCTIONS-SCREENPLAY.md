# Project Instructions — میوانی نادیار (The Unknown Guest) Screenplay

> **Copy this into your Cowork project's custom instructions when you create the project.**
> It gives every new chat inside the project full context on the screenplay rewrite.

---

## Project Overview

This project manages the screenplay rewrite of **میوانی نادیار (The Unknown Guest)**, a Kurdish-language film directed by **Sarwar**. The work is managed by **Darya Ibrahim** who acts as consultant/mediator between the AI agent and the director.

**Working folder:** `normalize/rwanga-design-kit/sarwar-review-v3/`

---

## What Has Been Done

### Script Decisions (COMPLETE)
19 structural decisions were debated through a "consultant methodology" — AI proposed options, Sarwar chose, decisions were locked. All documented in `sarwar-review-v3/decisions/`.

Key decisions include:
- **A1/A3:** Sweetness as emotional barometer — Gesha's sugar proximity mirrors her emotional state; sherbet eating = surrender = death
- **A5:** Evin phone calls threaded through Scenes 7, 8, 39b, 41
- **B1:** Couch with 5 functions (sleep → hide body → Nazi's bag → Nali sits → Edib opens)
- **C1:** Gardener framing as real-time anchor — twist: entire film was Nali's imagination
- **C5:** Gardener voice continuous from first frame, bleeds mid-film, returns sound-first
- **D5:** Stone sculpture established Scene 21, pays off Scene 28 (Edib's death)
- **D6:** 90-second burial silence — wind only, no music
- **D15:** AI dependency mediation chain across all clusters

### Screenplay Rewrite — Draft 1 (COMPLETE)
All 7 clusters rewritten with picture layer + best-effort Kurdish dialogue. Files in `sarwar-review-v3/rewrite-draft-1/`:

| Cluster | Scenes | File | Status |
|---------|--------|------|--------|
| 1 — Opening + Drive | 1-10 | REWRITE-CLUSTER-1.md | ✓ |
| 2 — Arrival + House Discovery | 11-14 | REWRITE-CLUSTER-2.md | ✓ |
| 3 — House Night | 16-18 + cont. | REWRITE-CLUSTER-3.md | ✓ |
| 4 — Death + Cover-Up | 19-21 | REWRITE-CLUSTER-4.md | ✓ |
| 5 — Discovery + Second Death | 27-29 | REWRITE-CLUSTER-5.md | ✓ |
| 6 — Desert + Silence | 30-37, 39 | REWRITE-CLUSTER-6.md | ✓ |
| 7 — Return + Ending | 43a, 39b, 40-43 | REWRITE-CLUSTER-7.md | ✓ |
| 4B — Evening with Friends | 22-26, 25 cont. | REWRITE-CLUSTER-4B.md | ✓ |

**ALL 40 active scenes written.** Draft 1 is complete. Scene 38 was removed per Sarwar's direction.

**Checklist:** `sarwar-review-v3/rewrite-draft-1/SCENE-CHECKLIST.md` — all scenes marked [x]

### Rewrite System
- **Picture layer:** Claude writes (action lines, camera direction, scene description, director notes)
- **Kurdish dialogue:** Claude writes best-effort → Darya reviews voice → Sarwar reviews final
- **Director notes:** `[تێبینیی دەرهێنەری]` blocks for camera, timing, arc references
- **Each cluster file includes:** Setup→Payoff tables, timing estimates, arc tracking

---

## What Comes Next (in priority order)

1. **Darya/Sarwar review** of Clusters 2, 7, and 4B (awaiting feedback)
2. **Revised Story Bible** incorporating all 19 decisions and rewrite changes
3. **Formatted screenplay document** — Filmustage-style, professional format
4. **Dialogue review stage** — Darya reviews Kurdish voice across all clusters
5. **Seed screenplay into Rwanga platform** via MCP tools

---

## Key Technical Details

- **Source screenplay:** `outputs/screenplay_full.txt` (3740 lines, Kurdish RTL)
- **Scene markers in source:** "دیمەنی" (scene header keyword)
- **Kurdish RTL format:** Scene headers use دیمەنی + number, sluglines in Kurdish
- **Character labels:** NALI, GESHA, NAZI, EDIB, EVIN, OFFICER, GARDENER, OMID, AI
- **Direction notes format:** `[تێبینیی دەرهێنەری: ...]` or `[تێبینیی تەکنیکی: ...]`
- **Smart quotes in Kurdish:** Use ‟ and " or just standard quotes

---

## Folder Structure

```
sarwar-review-v3/
├── STORY-BIBLE-V3-KU.md              ← Reference story bible
├── decisions/                         ← All 19 locked decisions + chain briefs
├── rewrite-draft-1/                   ← Current rewrite (8 clusters + checklist) — DRAFT 1 COMPLETE
│   ├── SCENE-CHECKLIST.md
│   ├── REWRITE-CLUSTER-{1-7}.md + REWRITE-CLUSTER-4B.md
└── translations/                      ← Translation chunk files
```

---

## Rules for Screenplay Work

1. **Never lose Kurdish quality.** Stay close to Sarwar's original phrasing and dialogue rhythms.
2. **Picture layer is craft, not decoration.** Camera directions, timing notes, and sensory detail matter.
3. **Director notes are instructions, not commentary.** They tell the director WHY a shot matters.
4. **Each cluster file is self-contained** — readable without needing the others.
5. **Setup→Payoff tables at the bottom** of each cluster so the director sees the architecture.
6. **When in doubt, read the source** (`screenplay_full.txt`) for the original scene.
7. **Darya mediates, Sarwar decides.** The director's word is final on dialogue and performance.

---

## Parallel Project: Rwanga Platform

The Rwanga platform engineering work is handled in SEPARATE sessions. Handoff documents are at:
- `rwanga-design-kit/HANDOFF-PLATFORM-ENGINEERING.md`
- `rwanga-design-kit/HANDOFF-UI-DESIGN.md`

Do NOT mix platform engineering with screenplay work in the same chat.
