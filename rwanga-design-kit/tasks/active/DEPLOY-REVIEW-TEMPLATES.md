# Deploy Review System Templates — Copy-Paste Only

> **For the engineering agent.** This is a file-copy task. Zero interpretation. Zero modifications.

---

## What happened

The design agent built 3 production-ready Django templates with correct base.html extension, `var(--rw-*)` tokens, proper split-panel architecture, and all Kurdish labels encoded in UTF-8. Your previous attempt to convert the design references broke fonts, layout, encoding, and dark/light mode. These new files fix all of that.

## Your task

Copy these 3 files **verbatim** to the Django server. Do not modify a single character.

### File 1 — Review Workbench

**Source:** `rwanga-design-kit/templates/reviews/workbench.html`  
**Destination:** `src/reviews/templates/reviews/workbench.html` (or wherever your review templates live — replace whatever is there now)

### File 2 — Chain Viewer

**Source:** `rwanga-design-kit/templates/reviews/chain_viewer.html`  
**Destination:** `src/reviews/templates/reviews/chain_viewer.html`

### File 3 — Review Summary PDF

**Source:** `rwanga-design-kit/templates/reviews/summary_pdf.html`  
**Destination:** `src/reviews/templates/reviews/summary_pdf.html`

## Rules

1. **Do NOT modify any CSS.** Not a single property, not a selector rename, not a color change.
2. **Do NOT modify any HTML structure.** The class names, nesting, and element types are final.
3. **Do NOT modify any Kurdish text.** The strings are UTF-8 encoded correctly. Do not re-encode, escape, or translate them.
4. **Do NOT modify any JavaScript.** The function names, DOM queries, and event handlers are final.
5. **Do NOT add any new imports, libraries, or dependencies.** Everything these templates need is already in base.html and rwanga.css.

## After copying

1. Ensure the `ChainViewerView` exists with URL name `chain-viewer` accepting `(project_id, review_id, chain_id)` — the workbench template links to it via `{% url 'chain-viewer' project.id review.id d.chain_id %}`.
2. Ensure the `ReviewSummaryPDFView` exists and uses WeasyPrint to render `reviews/summary_pdf.html` to PDF. Context must include: `review`, `project`, `locked_decisions`, `proposed_decisions`, `rejected_decisions`, `total_decisions`.
3. Restart the server.

## Verification

After copying and restarting:
- Visit `/projects/b7821ef2-bef1-4527-b192-625ac0977aa5/reviews/96f026e7-a45c-4e04-b604-c208aede15b7/workbench/`
- Confirm: dark theme renders correctly, all Kurdish text shows properly (no ?????????), split panel has decisions on the right and bible on the left (RTL), tabs switch only the left panel.

## One-liner for the agent

```
Read rwanga-design-kit/tasks/active/DEPLOY-REVIEW-TEMPLATES.md — then copy the 3 template files to their destinations exactly as specified. No modifications whatsoever.
```
