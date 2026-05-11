# Rwanga Launch Plan

> Last updated: 2026-05-01

## Phase 1 — Complete the Platform

### Done
- Project wizard (4-step create flow)
- Scripts upload and management
- Scenes, characters, locations (CRUD)
- Project settings (form with save)
- Reviews section — list, create, detail with decisions + evaluations (delivered 2026-05-01)
- Community section — sessions, snapshots, comments, reactions, invites (delivered 2026-05-01)
- Location modal form wiring (delivered 2026-05-01)
- MCP server for progress tracking

### Still Needed
- **Bootstrap JS 404** — the file exists on disk but Django/WhiteNoise returns 404 via Cloudflare tunnel. This blocks ALL modals, dropdowns, user menu, notification panel. Must be fixed permanently (not just cache purge).
- **UI polish on Reviews** — forms lack visible labels, no status badge styling, no tab layout for decisions/evaluations/comments
- **UI polish on Community** — session create inline form needs proper layout
- **Remaining "coming soon" stubs** — grep and eliminate
- **Export pipeline** — WeasyPrint blocked by GTK/Pango native libraries
- **Landing page** — currently unauthenticated users see empty projects list

---

## Phase 2 — Seed & Test (Mysterious Guest / میوانێکی نادیار)

1. Finalize Sarwar's bible review v03 (in progress in separate session)
2. Seed full project data through MCP: script, scenes, characters, locations
3. Create a bible review in the system with real decisions (propose/lock/reject)
4. Create a community session (Darya + Sarwar closed group) — test comments and reactions
5. Run one complete e2e project to find remaining gaps
6. Fix all gaps found

---

## Phase 3 — Landing Page & Public Face

- Design a proper landing page with Claude Design
- Features showcase: script management, bible reviews, AI consultation, community review
- Value proposition for Kurdish cinema
- Clear signup/login flow
- Plan tiers (if going commercial)
- Deploy before Sarwar's shooting days

---

## Phase 4 — On-Set Launch (Sarwar's Shooting Days)

### The Event
- System live on set: smartboard showing project dashboard, iPads in crew hands
- Darya as professional director consultant, Claude as AI production intelligence
- Live-update the project through crew progress reports, notes, short meetings
- Media coverage through Sarwar's staff and regional press

### On-Set Workflow
- Real-time director assistance: what's ready, what's next, what needs attention
- Darya (former movie director, professional) + Claude (AI consultant) = integrated production intelligence
- Track progress through informal chit-chats, Sarwar's problems, shortcomings
- Live system updates as production progresses

### Producer Reports
- Print progress reports for producers: what's done, budget spent, gaps, new requests
- Goal: rich producers taste the system and say "this is what was missing from our previous productions!"
- These reports become the sales pitch — real data from a real production

### Budget Support
- Help Sarwar reduce budget limits before presenting to producers
- System tracks budget vs actuals during production

---

## Phase 5 — Director Onboarding

- After on-set launch creates buzz, directors visit the landing page
- Signup flow, create studios, load their scripts
- First external users taste the system
- Feedback loop for platform improvements

---

## Timeline Dependencies

1. Sarwar finalizes budget → presents to producers → shooting date set
2. Shooting date = hard deadline for:
   - Platform completion
   - Landing page design
   - All features tested with real data
   - System stable enough for live on-set use
