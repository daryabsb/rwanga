# Agent Prompt — Review System Implementation

> Copy everything below the line and paste it as your prompt to the engineering agent.

---

You are implementing the review system UI for Rwanga (ڕوانگە), a Kurdish cinema preproduction platform. The design work is complete — 3 pixel-perfect HTML templates exist with full brand, layout, interactions, and mock data. Your job is to convert them into live Django templates with real database data.

## Step 1 — Read these files IN THIS ORDER before writing any code:

1. `rwanga-design-kit/tasks/active/ENGINEERING-REVIEW-SYSTEM-TASK.md` — **This is your master task document.** It contains every deliverable, every model field, every view, every URL, every CSS rule, and every acceptance criterion. Follow it exactly.
2. `rwanga-design-kit/tasks/active/SESSION-MEMORY-PLATFORM-DESIGN.md` — Design principles, north star statement, engineering context. Tells you what models exist, what's built vs not.
3. `rwanga-design-kit/templates/exports/review_workbench_preview.html` — **Design reference for Template 1** (Review Workbench). Copy the CSS verbatim. Convert the JS mock data into Django template loops.
4. `rwanga-design-kit/templates/exports/chain_viewer_preview.html` — **Design reference for Template 2** (Chain Viewer). The visual escalation encoding (node heights, glows, broken borders) is non-negotiable — do not simplify.
5. `rwanga-design-kit/templates/exports/review_summary_preview.html` — **Design reference for Template 3** (Review Summary PDF). Uses the same `.pdf-page` wrapper as the existing call sheet template.
6. `rwanga-design-kit/templates/exports/preview.html` — **Existing brand system.** This is the established visual language. Your new templates must match it. Do NOT modify this file.

## Step 2 — Implement in this build order:

1. **Model changes** — Add 7 new fields to `ReviewDecision`: `expression_type`, `intensity`, `function_label`, `transition_label`, `chain_id`, `chain_name`, `chain_order`. Exact field definitions are in the task doc. Run migration.
2. **Update serializers** — Include the new fields in `ReviewDecisionSerializer` so they're readable/writable via API.
3. **Review Workbench view + template** — This is the main deliverable. Create `ReviewWorkbenchView` (Django `DetailView`), create the template by copying CSS from the design reference and converting mock data to `{% for decision in active_decisions %}` loops. Wire accept/reject buttons with HTMX (`hx-patch`).
4. **HTMX partials** — Create `LockDecisionView` and `RejectDecisionView` that return partial HTML cards. Accept/reject must work without full page reload.
5. **Chain Viewer view + template** — Create `ChainViewerView`, template loops over `chain_decisions` ordered by `chain_order`. Each node's CSS class is `intensity-{{ decision.intensity }}`. The varying heights and broken styles are in the CSS — copy them exactly.
6. **Review Summary PDF** — Create `ReviewSummaryPDFView` using WeasyPrint. Template uses `.pdf-page` wrapper, RTL, A4 dimensions. Include letterhead, decision lists with status badges, summary table.
7. **URL routes** — Wire all views into `urls.py`. Patterns are in the task doc.
8. **MCP tool updates** — Add new fields to `create_decision` and `list_decisions` tools. Add new `list_chains` tool.
9. **Navigation** — Add review links to project dashboard, chain links within workbench decisions.

## Non-negotiable rules:

- **RTL everywhere** — `direction: rtl`, `dir="rtl"` on html tag. This is a Kurdish platform.
- **Brand colors only** — Pink `#F72585`, Amber `#D4A574`, Dark `#0F0F12`. Full table in task doc. No new colors.
- **Fonts** — Cairo (Kurdish/Arabic text) + Inter (Latin/numbers). No other fonts.
- **No JS frameworks** — Vanilla JS + HTMX only. No React, Vue, Angular.
- **Copy the CSS** — The design templates have hundreds of lines of tuned CSS. Copy it. Do not rewrite it.
- **Chain viewer must show visual escalation** — Nodes grow taller at peak, collapse nodes have dashed/broken borders with hatched backgrounds. This is the core innovation. A flat list is unacceptable.
- **Do NOT touch existing templates** — `preview.html` and the call sheet/shot list/scene viewer are off limits.

## Test data:

- Project: `b7821ef2-bef1-4527-b192-625ac0977aa5`
- Review: `96f026e7-a45c-4e04-b604-c208aede15b7` (v03, 25 locked + 19 proposed decisions)

After implementing, verify all 3 views render correctly with this real data.

## What success looks like:

The director opens `/projects/{id}/reviews/{id}/workbench/` and sees the 3-tab interface. Active decisions tab shows 19 unsettled decisions with accept/reject buttons that work via HTMX. Clicking a decision highlights the bible section. The Chain Viewer shows the D15 escalation arc with nodes rising to peak and shattering at collapse. The PDF export generates a clean A4 document with letterhead, status badges, and the Rwanga footer.
