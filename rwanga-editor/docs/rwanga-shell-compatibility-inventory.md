# Rwanga Shell — Compatibility Inventory

**Status:** Living document. Created at the close of Slice 1.
**Owner of this document:** Shell maintainer (whoever lands the next slice updates this doc in the same PR).
**Pairs with:** `docs/rwanga-shell-slice-1-plan.md`, `docs/rwanga-app-shell-master-plan.md`.

---

## 0. Purpose

Every time a new shell layer ships alongside a legacy implementation of the same concern, a **temporary coexistence layer** is created — an adapter, a guard, a no-op fallback, or simply two systems sharing a DOM region with a documented divide. These layers are not bugs; they are how we ship a new shell incrementally without breaking the running app.

This inventory tracks every one of them. The discipline is simple: **no temporary coexistence layer is allowed to exist without an entry here, an owner, and a planned removal slice.** The phrase *"harmless dead code"* is not used anywhere in shell discussion — coexistence is named, accounted for, and put on the clock.

---

## 1. Rules

The rules below govern this inventory and every coexistence layer it tracks.

1. **Every temporary coexistence layer must have an owner.** The owner is the human (or named role) accountable for the layer's eventual removal. The owner field is never empty.

2. **Every temporary coexistence layer must have a removal slice.** Vague "later" doesn't count. The removal slice names the planned Slice (Slice 2, Slice 3, etc.) — or the explicit milestone that gates it.

3. **Every entry must have a removal condition.** A removal condition is the **specific, observable state of the codebase** that must be true before the entry can be deleted. It's the test the shell maintainer applies before crossing the entry off.

4. **No "harmless dead code" wording.** If something is in the codebase and not currently executed against its intended target, it is either (a) tracked here with the four required fields, or (b) genuine dead code on a removal PR. There is no third category.

5. **Inventory entries are added in the same PR that introduces the coexistence layer.** A new shell slice that needs to coexist with an existing system updates this document as part of the slice — never in a "we'll document it later" follow-up.

6. **Removed entries are not deleted from this document.** When an entry is retired, its section is annotated `RESOLVED in <slice> on <date>` with a one-line note. The history of past coexistence stays visible so future slices learn from it.

7. **Cross-references with the source.** Every code location named in an entry must include a file path; line numbers are best-effort (they drift, so the inventory entry is the canonical pointer, not the line).

---

## 2. Inventory

### Entry #1 — Legacy `Rga.StatusBar` (app-shell.js)

| Field | Value |
|---|---|
| **Component** | `Rga.StatusBar` — the existing status-bar module at `renderer/js/app-shell.js` (`Rga.StatusBar = { init, update, ... }`). Populates the `#status-bar` element's hardcoded children (`#status-words`, `#status-pages`, `#status-scene`, `#status-theme`, `#status-block-type`, `#status-units`). |
| **Reason for existence** | Slice 1 introduced `Rga.Shell.StatusBar` (the new 5-segment Scene/Page/View/Lang/Local status bar reading from `Rga.ScriptSession`). The new module mounts into a dedicated `#rga-shell-statusbar` container that **does not yet exist in the live `index.html`**. The legacy `Rga.StatusBar` continues to populate `#status-bar` in the running app so the user-visible status bar isn't blanked between Slice 1 and Slice 2. |
| **Consumers** | (1) The bootstrap script in `renderer/index.html` calls `Rga.StatusBar.init()` at app startup. (2) `Rga.StatusBar.update()` is called from elsewhere in app-shell.js on doc/cursor change. (3) The legacy element IDs (`#status-words` etc.) appear inside `#status-bar` in the live HTML. |
| **Owner** | Shell maintainer (Slice 1 author). |
| **Removal slice** | Slice 2. |
| **Removal condition** | All four of: (a) `#rga-shell-statusbar` exists in `index.html` AND `Rga.Shell.StatusBar.init` is called against it from the live bootstrap; (b) the Slice 2 status bar surfaces equivalent or better information than the legacy one (Scene, Page, View, Language, Local — already covered — PLUS any segments the legacy uniquely showed that the team agrees to preserve: word count, block type, units indicator); (c) no other module in the codebase calls `Rga.StatusBar.update()` or reads `#status-words`/`#status-pages`/`#status-scene`/`#status-block-type`/`#status-units`; (d) the legacy `#status-bar` hardcoded children are removed from `index.html`. When all four are true, `Rga.StatusBar` and its bootstrap call are deleted in one PR. |
| **RESOLVED** | Slice 2 commits 8 + 9 (2026-05-16). Resolution: (a) the conditional adapter was replaced — `Rga.Shell.StatusBar` now mounts unconditionally into `#status-bar`; (b) the Slice 2 status bar surfaces scene + page + blockType + wordCount + viewMode + language + offline, covering everything the legacy showed except theme/units toggles (deferred to a future Settings slot — neither is writer-context); (c) the legacy `Rga.StatusBar.update()` call from `Rga.Theme.apply` was deleted (theme changes propagate via CSS, no status-bar refresh needed); (d) `#status-words / #status-pages / #status-scene / #status-block-type / #status-units / #status-theme / #status-language / #status-sync / #status-problems / #view-pill` children deleted from `#status-bar`; (e) `Rga.StatusBar.init()` bootstrap call deleted; (f) `Rga.StatusBar = { ... }` module definition deleted from `app-shell.js`. Verification: `grep -r "Rga.StatusBar" renderer/ tests/` returns zero matches; `grep -r "#status-words\|#status-pages\|#status-scene\|#status-block-type" renderer/` returns zero matches; full test suite green. |

---

### Entry #2 — Legacy `Rga.Sidebar` (app-shell.js)

| Field | Value |
|---|---|
| **Component** | `Rga.Sidebar` — the existing sidebar switcher at `renderer/js/app-shell.js` (`Rga.Sidebar = { activePanel, init, switchTo, toggleCollapse, ... }`). On `init` it wires click handlers to `.activity-icon[data-panel]` and `.sidebar-panel` selectors. On `switchTo` it toggles `.active` on matching elements and updates `#sidebar-header-text`. |
| **Reason for existence** | Slice 1 removed the hardcoded `.activity-icon` and `.sidebar-panel` elements from `#activity-bar` and `#sidebar` (those are now built dynamically by `Rga.Shell.ActivityRail.init` + `Rga.Shell.Sidebar.activate`). `Rga.Sidebar.init`'s `querySelectorAll` calls return empty NodeLists in the post-Slice-1 DOM, so its click-handler wiring binds to zero elements. The module isn't called from removed code; it remains so any not-yet-audited callsite that invokes `Rga.Sidebar.switchTo('explorer')` or `Rga.Sidebar.toggleCollapse()` still finds a function to invoke (no-op on the new DOM but no thrown reference error). |
| **Consumers** | Suspected: command palette entries / menu actions / keyboard shortcuts registered in `index.html`'s bootstrap (around `registerCommands` / `registerShortcuts`) that may invoke `Rga.Sidebar.switchTo` or `Rga.Sidebar.toggleCollapse`. Slice 1 did not audit those exhaustively. |
| **Owner** | Shell maintainer (Slice 1 author). |
| **Removal slice** | Slice 2. |
| **Removal condition** | (a) Audit complete — every callsite of `Rga.Sidebar.activePanel` / `init` / `switchTo` / `toggleCollapse` has either been migrated to `Rga.Shell.Sidebar.*` or removed. (b) No menu/command/shortcut binding references `Rga.Sidebar.*`. (c) The bootstrap's `Rga.Sidebar.init()` line has been deleted. When all three are true, the `Rga.Sidebar` module definition is removed from `app-shell.js`. |
| **BLOCKED** | Slice 2 commit 10 (2026-05-16). Reason: the engine plugin `renderer/js/doc-types/screenplay/plugins/tags.js:206` contains `Rga.Sidebar.switchTo('tags')` — an engine-side dependency on the legacy module. The Slice 2 rule "no editor engine changes" forbids modifying engine code; the legacy 'tags' panel concept is also not yet replaced (the Characters panel + Breakdown tab subsume it in Slice 3). Resolution path (Slice 3): when the Characters panel ships AND `tags.js:206` is updated to route through the new shell (`Rga.Shell.Sidebar.activate('characters')`) or removed, the `Rga.Sidebar` shim can finally be deleted. Until then: shim retained in `app-shell.js` (reduced from ~50 LOC to 5 LOC of no-op methods) so the engine plugin's invocation is harmless. **Partial resolution committed:** (a) all index.html callsites migrated to `Rga.Shell.Sidebar.activate` / `Rga.Shell.Layout.set`; (b) bootstrap `Rga.Sidebar.init()` removed; (c) legacy DOM wiring (`.activity-icon` / `.sidebar-panel` click handlers) removed from the shim. Only the API shim remains. Removal slice updated: **Slice 3** (was Slice 2). |

---

### Entry #3 — `#sidebar-header` placeholder element

| Field | Value |
|---|---|
| **Component** | The DOM element `<div id="sidebar-header"><span id="sidebar-header-text"></span><div id="sidebar-header-actions"></div></div>` inside `#sidebar` in `renderer/index.html`. Slice 1 emptied the inner `<span>` (was "Explorer") but left the wrapper element in place. |
| **Reason for existence** | `Rga.Sidebar.switchTo(panelName)` (entry #2) reads `Rga.$('#sidebar-header-text')` and writes the panel's display name into it. Removing the element would cause `Rga.Sidebar.switchTo` to silently fail on the `header.textContent =` assignment. Until `Rga.Sidebar` itself is removed (entry #2), keeping the element prevents any latent caller from throwing. The new shell does NOT use `#sidebar-header`; `Rga.Shell.Sidebar.activate` does not touch it. |
| **Consumers** | `Rga.Sidebar.switchTo` (entry #2) only. |
| **Owner** | Shell maintainer (Slice 1 author). |
| **Removal slice** | Slice 2. |
| **Removal condition** | Same condition as entry #2's removal. Once `Rga.Sidebar` is deleted, `#sidebar-header` and `#sidebar-header-text` have no remaining consumers and are deleted from `index.html` in the same PR. |
| **RESOLVED** | Slice 2 commit 10 (2026-05-16). Resolution: Even though entry #2 only partially resolved (Rga.Sidebar shim retained for engine consumer), the shim's `switchTo` was reduced to a no-op that does NOT touch `#sidebar-header-text`. With no remaining DOM reads on the element, `#sidebar-header` + `#sidebar-header-text` + `#sidebar-header-actions` were deleted from `index.html`. Verification: `grep -r "sidebar-header" renderer/` returns zero matches in source. |

---

### Entry #4 — Conditional shell-status-bar mount adapter in `shell/index.js`

| Field | Value |
|---|---|
| **Component** | The optional-mount block inside `Rga.Shell.init` at `renderer/js/shell/index.js`: `const shellStatusBar = document.getElementById('rga-shell-statusbar'); if (shellStatusBar && Rga.Shell.StatusBar...) { Rga.Shell.StatusBar.init(shellStatusBar); }`. |
| **Reason for existence** | Without this guard, calling `Rga.Shell.StatusBar.init(document.getElementById('status-bar'))` would `innerHTML = ''` the legacy `#status-bar` element and wipe `Rga.StatusBar`'s hardcoded children, breaking entry #1. The guard lets the new status bar mount only when a dedicated container exists — which currently it does **only in unit tests**, not in the live `index.html`. This is the adapter that lets entry #1 and `Rga.Shell.StatusBar` coexist without conflict. |
| **Consumers** | The Slice 1 plan §10 acceptance test for the status bar (assumes the new module is functional and tested) plus the future Slice-2 work that will introduce the live `#rga-shell-statusbar` container. |
| **Owner** | Shell maintainer (Slice 1 author). |
| **Removal slice** | Slice 2. |
| **Removal condition** | Once entry #1 is resolved (legacy `Rga.StatusBar` removed; `#status-bar` re-purposed as the new shell's container OR a new `#rga-shell-statusbar` container has fully replaced `#status-bar`), the conditional guard becomes unnecessary. The `if (shellStatusBar && ...)` block is replaced by an unconditional `Rga.Shell.StatusBar.init(...)` call. The conditional check is removed in the same Slice 2 PR that lands entry #1's resolution. |
| **RESOLVED** | Slice 2 commit 8 (2026-05-16). Resolution: the `if (shellStatusBar && ...)` conditional in `Rga.Shell.init` was replaced by an unconditional `Rga.Shell.StatusBar.init(document.getElementById('status-bar'))` — the new status bar now mounts directly into the live `#status-bar`. Verification: `grep -r "#rga-shell-statusbar" renderer/` returns zero matches in source code; full test suite green. |

---

### Entry #5 — `#bottom-panel` (Studio Panel) shared ownership

| Field | Value |
|---|---|
| **Component** | The `#bottom-panel` DOM element in `renderer/index.html` and the existing `Rga.BottomPanel` module that initialises it (via `Rga.BottomPanel.init()` in the bootstrap). The Slice 1 master plan calls this surface the **Studio Panel** internally; the live UI label is still "Bottom Panel" (master plan §7). |
| **Reason for existence** | Slice 1 scaffolds the Studio Panel as a planned new-shell surface (master plan §7) but does NOT yet take ownership of `#bottom-panel`. The existing `Rga.BottomPanel` continues to render the Notes / Flags / Problems / Breakdown tabs into it (these are driven by engine plugins like `Rga.Annotations`, `Rga.RevisionFlags` — which the Slice 1 plan §3.7 leaves alone). When Slice 2+ introduces `Rga.Shell.StudioPanel` as a registered shell surface, ownership of `#bottom-panel` transfers from `Rga.BottomPanel` to the new module, and the legacy is retired. |
| **Consumers** | (1) Bootstrap call `Rga.BottomPanel.init()` in `index.html`. (2) Engine-side plugins (annotation-notes.js, revision-flags.js, etc.) render into `#annotation-notes-list`, `#revision-flags-list` inside `#bottom-panel`. (3) Any keyboard binding that toggles `#bottom-panel` visibility. |
| **Owner** | Shell maintainer (Slice 1 author). |
| **Removal slice** | Slice 3 (deferred a slice beyond #1–#4 because Studio Panel isn't on the Slice 2 critical path; Slice 2 focuses on real panel content for the sidebar surfaces). |
| **Removal condition** | (a) `Rga.Shell.StudioPanel` exists with the same tab surfaces (Scene / Notes / Flags / Problems / Breakdown) the engine plugins expect. (b) Engine-side plugins' DOM target IDs (`#annotation-notes-list`, `#revision-flags-list`) are either preserved by the new Studio Panel's tab content OR the plugin code is updated to read its target from a new shell-provided API. (c) `Rga.BottomPanel.init()` bootstrap call is removed. (d) No menu/command binding references `Rga.BottomPanel`. When all four are true, `Rga.BottomPanel` is deleted in the same Slice 3 PR. |

---

### Entry #6 — `Rga.ScriptSession.wordCount` + `Rga.ScriptSession.currentBlockType` (analytics on writer-context layer)

| Field | Value |
|---|---|
| **Component** | Two fields on the `Rga.ScriptSession` snapshot — `wordCount` (number \| null) and `currentBlockType` (string \| null) — currently defined in `renderer/js/shell/script-session.js`, computed by the same recompute pipeline as the seven writer-context fields, and exposed in the value returned by `Rga.ScriptSession.get()`. |
| **Reason for existence** | Slice 2 §2.1 added these as **extensions to the writer-context snapshot** in order to feed two new status-bar segments and the Outline panel's Story Progress section. The post-Slice-2 architectural review recognised this as a **layer-misplacement**: both fields are **derived analytics**, not **writer-context**, so they belong on a separate sibling layer rather than on `Rga.ScriptSession`. The corrected design (master plan §20, §24) adds a new `Rga.ScriptMetrics` module whose sole purpose is derived script statistics. Until Slice 3 implements that module and migrates consumers, the two fields live on the wrong layer. |
| **Consumers** | (1) `Rga.Shell.StatusBar` reads `wordCount` for the "N words" segment and `currentBlockType` for the block-type segment (`renderer/js/shell/status-bar.js`). (2) `Rga.Shell.Outline` reads `wordCount` for the Story Progress section's statistics (`renderer/js/shell/panels/outline.js`). (3) `tests/unit/shell/script-session.test.js` asserts shape including these two fields (the 5 tests added in Slice 2). (4) `tests/unit/shell/integration.test.js` asserts `'wordCount' in snap` and `'currentBlockType' in snap` after init. |
| **Owner** | Shell maintainer (Slice 2 author). |
| **Removal slice** | Slice 3. |
| **Removal condition** | **(a) DONE in Slice 5 §A:** `Rga.ScriptMetrics` module exists with `wordCount` + `currentBlockType` fields plus reserved fields. **(b) DONE in Slice 5 §A:** `Rga.Shell.StatusBar` reads both values from `Rga.ScriptMetrics.get()`. **(c) OPEN:** `Rga.Shell.Outline` still reads `wordCount` from `Rga.ScriptSession.get()`. **(d) OPEN:** Both fields still present on `Rga.ScriptSession`'s snapshot shape (would break Outline if removed before (c) lands). **(e) OPEN:** Shape assertions will move once (d) lands. The remaining steps (c → d → e) are a future single-slice migration. |

---

## 3. Update protocol

When a new shell slice introduces a coexistence layer:

1. **Add the entry** in the same PR as the slice's main code, following the seven-field schema in §2.
2. **Number the entry** with the next available `#N` — never reuse a number, even after resolution.
3. **Cross-link from the slice plan.** The slice plan's risk register or scope section should reference the new entry by number.
4. **Pick a removal slice deliberately.** "Slice 2" is fine when the cleanup is the next slice's responsibility; "Slice 3" is fine when the cleanup logically follows a later capability. Don't write "later TBD."

When a slice resolves a coexistence layer:

1. **Leave the entry in place.**
2. **Append a `RESOLVED` block** at the end of the entry's last field:
   ```
   | **RESOLVED** | Slice N (YYYY-MM-DD) — one-line note on how the removal was executed and what verification confirmed the consumers were gone. |
   ```
3. **Move the entry** to the bottom of §2 under a `--- Resolved entries ---` divider when this document next gets touched (so active entries are always at the top).

When an entry's removal condition can't be fully met (e.g., a legacy consumer turns out to still depend on the layer):

1. **Do NOT change the removal condition silently.** Add a `BLOCKED` annotation describing what's preventing removal, and re-evaluate the planned removal slice. The original condition stays as the target; the blocker becomes its own short note.

---

## 4. Field definitions

| Field | Meaning |
|---|---|
| **Component** | The thing that exists. A module name, an element, a code block, or an adapter. Always with at least one file path. |
| **Reason for existence** | Why this layer was created. The architectural decision being deferred — usually "introducing two systems is fine; removing the old one in the same PR isn't." |
| **Consumers** | Who currently depends on it. Without consumers, the layer is dead code, not coexistence. |
| **Owner** | The role (and, in larger teams, the person) accountable for the layer's eventual removal. The "I will lose sleep when this isn't gone by its removal slice" name. |
| **Removal slice** | The named Slice (Slice 2, Slice 3, etc.) in which removal is planned to land. Not a date; a slice. |
| **Removal condition** | The specific, observable state of the codebase that must be true before the entry can be deleted. Phrased as a test the shell maintainer applies, not as a list of intentions. |

A new field — **`Notes`** — may be appended to any entry when context useful to a future reader doesn't fit in the six required fields. Notes are optional and aren't load-bearing for removal decisions.

---

## 5. Cross-reference index

| Coexistence area | Entries |
|---|---|
| Status bar | #1 (`Rga.StatusBar`), #4 (conditional shell mount adapter) |
| Sidebar | #2 (`Rga.Sidebar`), #3 (`#sidebar-header` placeholder) |
| Studio Panel / Bottom Panel | #5 (`Rga.BottomPanel`) |
| State-ownership layering | #6 (analytics on `Rga.ScriptSession`) |

Total entries: **6**.
Active count: **3** (entry #2 BLOCKED — partial resolution; entry #5 still open for Slice 3; entry #6 open for Slice 3).
Resolved count: **3** (entries #1 + #3 + #4, all resolved Slice 2 / 2026-05-16).
Blocked count: **1** (entry #2 — see annotation for the engine-side dependency forcing the shim to remain until Slice 3).

End of inventory.
