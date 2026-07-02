# Rwanga — Consolidated Go-Live Checklist & Filmustageation Gap

> **Purpose:** a single, forensically-verified answer to two questions after weeks away from the project:
> 1. *Can Rwanga launch as a trustworthy RTL screenplay editor?* (the launch gate)
> 2. *What separates today's app from the Filmustageation vision — and can the AI Agent harness start?*
>
> **Author:** forensic re-verification pass · **Date:** 2026-07-02 · **HEAD:** `829faa74`
> **Supersedes for status purposes:** nothing — this reconciles and extends `RWANGA_IDE_LAUNCH_CHECKLIST.md` (which is verified accurate below) and folds in the Filmustageation code audit.

---

## 0. Forensic verdict on the existing checklist — IS IT HONEST?

**Yes. Verified.** The concern that "the last agent may not have updated the checklist" is disproven:

| Check | Method | Result |
|---|---|---|
| Checklist current vs. code? | `git log` | The 3 most-recent repo commits (`a27e9dce`, `aa5b08aa`, `829faa74`) are all checklist reconciliations; **no code has changed since.** The checklist describes HEAD exactly. |
| QG-01 test claim reproduces? | fresh `npm run test:unit` | **1936 tests · 1899 pass · 36 fail · 1 skipped** — identical to the documented figure. |
| "30 vs 36, all non-core" honest? | stashed the 2 dirty fixtures, re-ran the 6 suspect suites | **40/40 pass clean.** Confirms: clean checkout = **exactly 30 failures**, every one non-core (≈24 stale shell/ownership snapshot tests + 3 parenthetical print-cosmetic + 2 recovery-phase3). No core data-loss / pagination / print / recovery test is red. |
| Feature TRUE-flips backed by green tests? | inspected the 1899 pass set | atomic-save, autosave, crash-recovery, close-guard, print-contract, PDF export, RTL scene-heading mapping, pagination — all cited tests green. |

**Conclusion:** the map matches the territory. Proceed on the documented status with confidence.

**Housekeeping:** working tree has 2 auto-migrated fixtures (`tests/fixtures/playground-the-last-light.rga`, `mysterious-guest-rtl.rga`) — not intentional edits. They are the *only* reason the suite reports 36 instead of 30. Recommend `git checkout -- tests/fixtures/*.rga`.

---

## PART A — Launch Gate: "Can Rwanga launch as an editor?"

**P0 status (verified): 32 TRUE · 21 PARTIAL · 6 UNKNOWN · 1 FALSE** → 28 of 60 not yet TRUE.

The decisive finding: **not one of the 28 open P0s is a feature to build.** They are all verification or packaging. Every feature that previously made Rwanga *not launchable* (PDF export, Print Preview, RTL scene-heading mapping, persistence/recovery, RTL body-leading) is real and test-backed.

### A.1 — What's left, in buckets

| # | Bucket | P0 IDs | Nature | Effort | Owner |
|---|---|---|---|---|---|
| 1 | **Test hygiene** | QG-01 | Re-point ~24 stale shell/ownership snapshot tests to current ownership; quarantine-with-reason the 1 parenthetical print-cosmetic (3 tests). **Not feature work.** | ~0.5–1 day | Eng (test maintenance) |
| 2 | **Installer build** | LR-01 | `npm run pack:win` fails on a `winCodeSign` symlink-privilege error. **Environment, not code.** Fix: Windows **Developer Mode** or elevated Admin shell → retry, then launch the `.exe`. | ~0.5 day (+ signing later) | Build |
| 3 | **Lifecycle QA** | PF-01, PF-02, PF-03, PF-05, PF-13 | One QA day: cold-start launch matrix (Win/mac), E2E new→type→save→reopen, Save-As with path change, clean-console audit across core flows. Code exists; needs recorded evidence. | ~1 day | QA |
| 4 | **RTL visual + bidi QA** ⭐ | RTL-04…RTL-10 (alignment ×6 + print), RTL-11 (RTL PDF), RTL-12/13 (bidi), SW-23 | Visual verification against the ratified Kurdish/RTL profile + mixed-script bidi audit + one RTL PDF smoke. **The largest and most product-critical bucket** — this is the founding promise for the target audience. | ~2–4 days | QA + Eng |
| 5 | **Page-geometry QA** | MT-02, MT-04, MT-05, MT-06, MT-07, MT-10, PP-01, PP-03, SW-01 | Verify paper sizes (A4/Letter/Legal), margins, bottom-margin overflow, empty-line budget, scene-heading edit — all render-correct against the ratified profile. | ~1–2 days | QA |
| 6 | **Roll-up** | QG-12 | The only P0 `FALSE`. Flips TRUE automatically once 1–5 close. Not independently actionable. | — | — |

### A.2 — Launch bottom line

**Rwanga is roughly 1–2 focused weeks of verification + packaging away from a launchable editor.** No editor-trust feature construction remains. The critical path is: **QG-01 test hygiene → LR-01 installer (needs Dev Mode) → the QA sweeps (lifecycle, RTL, geometry) → QG-12 flips.**

---

## PART B — Filmustageation Vision Gap: "Is the app ready for the AI Agent harness?"

The launch checklist certifies **only** "a trustworthy RTL screenplay editor." It says **nothing** about Filmustage's production-management surface — which is most of the vision. Here is the verified state of the three pillars (code-audited 2026-07-02, file paths cited).

### B.1 — Pillar scorecard

| Pillar | State | One-line |
|---|---|---|
| **1. Filmustage parity** (breakdown / stripboard / schedule / reports) | 🔴 **PARTIAL/MINIMAL** | The tagging *spine* exists; the production-management *surface* mostly does not. |
| **2. RTL-powered** | ✅ **MATURE** | Direction is document-owned, travels in the `.rga`, cascades to editor/navigator/print. No blocking gaps (visual QA pending — see A.1 #4). |
| **3. `.rga` as portable agent-memory** | 🟡 **READABLE, NOT WRITABLE** | A complete read-only Memory projection exists; there is **no API for an agent to write back**. This is the crux for your harness. |

### B.2 — What genuinely EXISTS today (the foundation is real)

- **Entity/tag model** — global registry keyed by UUID + inline ProseMirror tag marks. 9 categories: character, prop, wardrobe, location, sfx, vfx, vehicle, animal, custom. (`doc.js:293-319`, `base-outer-marks.js:105-125`)
- **Memory API** — `Rga.Screenplay.Memory`: `scene()`, `cuesForScene()`, `entity()`, `entities()`, `coverage()`. Complete, pure (no DOM), server-portable. (`doc-types/screenplay/memory.js`, 314 lines)
- **SceneCatalog** — per-scene production bundle (characters/props/wardrobe/locations/sfx/vfx/vehicles/animals/custom + notes/flags/pageInfo). **Zero production consumers today.** (`scene-catalog.js:28-150`)
- **Tags Panel** — read-only browser of registry entities by category with occurrence counts + click-to-jump, RTL-aware. (`shell/panels/characters.js`, `plugins/tags.js`)
- **Platform seams** — `Rga.Platform` boundary + Inspector panel `registerPanel()` frame (no panels mounted) + activity-rail registry. The frame for a contribution API exists. (`platform.js`, `shell/inspector.js`, `shell/activity-rail.js`)
- **`.rga` v5.0 storage** — blocks, entities (with `aliases[]`, `merged_into`), tag marks, scene notes/flags, flag log, versioned print contract, document-owned direction. Portable JSON.

### B.3 — The 5 biggest gaps to the vision (ranked)

1. **Breakdown sheets — data exists, rendering missing.** The bottom-panel "Breakdown" tab is an empty `<tbody id="breakdown-body">` with **no JS populating it**; Memory + SceneCatalog already provide every field. *~1–2 day render task.* (`index.html:338-343`)
2. **Agent contribution API — the `.rga` is read-only to agents.** Agents can *query* scenes/entities but cannot *write* tags, aliases, confirmed references, or insights back. There is no `Rga.Contribution.*` / `Rga.Agent.*` namespace. **This is the #1 blocker for the harness** — an agent whose memory "travels with the document" needs a write path into the document. Seams exist (`tags.applyTag`, `doc.addEntity`, `scene.attrs.metadata.references[]` placeholder, Inspector `registerPanel`) but no public write API.
3. **Stripboard / shooting schedule / call sheets / production reports — absent entirely.** Zero code, zero stubs. Filmustage's core production tooling. Needs design + build.
4. **Autocomplete / mention recognizer — foundational layer was deleted.** The tier-1 ghost-text recognizer was removed in the v3 redesign (commit `7987d39f`); orphaned settings + CSS remain. Tier-2 "matched" (scan untagged names) and tier-3 "inferred" (pronouns) are unimplemented. Untagged mentions are invisible to every index — the gap that poisons downstream queries.
5. **Profile fields + alias resolution — schema-ready, logic unimplemented.** v3→v4 migration adds `aliases: []`; the resolver is designed (S0 brief) but not wired into `findOrCreateEntity`. No character-profile fields (age/arc/relationships), no `ai_insights` persistence.

### B.4 — Agent-harness readiness: the honest answer

**The frame exists but the door is locked.** For an Agent harness whose working memory is the `.rga` and "travels with the document," two things must be true that are **not** true today:

- **The document must be agent-writable.** Today it is agent-*readable* only (Memory projection). **Gap #2 must be built first** — a contribution/write API so agents can persist tags, aliases, references, and insights.
- **The memory must capture what agents reason over.** Untagged mentions, aliases, pronoun references, and AI-confidence tiers are the substrate of agent reasoning; today they are missing or unwritten (**Gaps #4, #5**).

There is **no** agent harness, LLM integration, MCP server, or contribution API in the codebase today — as expected. The platform boundary (`platform.js`) and Inspector frame are the correct seams to build on.

---

## PART C — The two-gate reality & recommended sequence

Building the Agent harness is gated by **two** doctrines, both currently closed:

1. **Launch foundation lock** (`RWANGA_IDE_LAUNCH_CHECKLIST.md` Rule 2/3): no invention features until every P0 is TRUE. → **28 P0s open** (Part A).
2. **Alive-App Phase 2 gate** (`RWANGA_IDE_ALIVE_APP_CHECKLIST.md`): "No AI feature implementation may start before this phase is visually verified." → **every box unchecked**, entry gate not open.

Plus a **technical** prerequisite the harness itself needs: **the `.rga` agent-write API (Gap #2).**

### Recommended path to the Agent harness

```
Stage 1 — CLOSE THE LAUNCH GATE (Part A)          ~1–2 weeks, verification+packaging
   QG-01 test hygiene → LR-01 installer (Dev Mode) → QA sweeps (lifecycle/RTL/geometry) → QG-12
        │
        ▼  foundation lock
Stage 2 — MAKE THE MEMORY WRITABLE + VISIBLE       the bridge to AI
   Gap #1 breakdown-sheet render (cheap, high-visibility)
   Gap #2 Rga.Contribution write API  ◄── the true harness prerequisite
   Gap #5 alias resolver + profile fields  (Gap #4 recognizer optional next)
        │
        ▼  .rga is now agent-writable portable memory
Stage 3 — BUILD THE AGENT HARNESS                  the Filmustageation AI phase
   LLM integration on the platform seam, agents read+write the .rga memory,
   Filmustage-parity surfaces (stripboard/schedule/reports) built on SceneCatalog
```

**You were right to stop.** Starting the harness today would build on an unlocked foundation *and* a read-only memory — the agent would have nowhere to persist what it learns.

---

## PART D — Immediate next actions (this week)

1. **Revert the dirty fixtures** → clean 30-red baseline. `git checkout -- tests/fixtures/*.rga`
2. **QG-01 test-hygiene slice** → re-point the ~24 stale shell ownership tests + quarantine the parenthetical cosmetic → green suite. (Unblocks QG-12.)
3. **LR-01 installer** → enable Windows Developer Mode / run elevated → `npm run pack:win` → launch the `.exe`.
4. **Schedule the QA sweeps** (lifecycle + RTL visual + geometry) — the bulk of the remaining P0s; RTL first (highest product value).
5. **Decide the Stage-2 design** in parallel (no code until foundation lock): the `Rga.Contribution` write-API brief is the single most important design artifact for your AI ambitions — it defines how future agents' memory travels in the `.rga`.

---

*Evidence: live test run + git forensics at HEAD `829faa74` (2026-07-02); `RWANGA_IDE_LAUNCH_CHECKLIST.md` (verified accurate); Filmustageation code audit (paths cited in B.2/B.3). No production code changed in this pass.*
