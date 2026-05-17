# Rwanga App Shell — Master Plan

**Status:** Design document. No implementation in this round.
**Author:** Rwanga design — Phase 9.5 (post-engine lock)
**Date:** 2026-05-16
**Pairs with:** `docs/phase0-final-schema-contract.md` (locked editor engine contract)

---

## 0. What this document is — and isn't

This is the **architectural plan for everything around the editor**. The editor engine itself — `Rga.Nav`, `Rga.RenderModel`, `Rga.ViewManager`, `Rga.RuntimeProfile`, the v3 schema, the pagination pipeline — is **locked** as of Phase 9. The shell consumes those APIs; it does not re-shape them.

This document is a **planning artifact**. Nothing here ships until each section is reopened as its own phase with its own acceptance gates, the way the engine phases worked. The intent is to give every shell-layer subsystem a defined surface, a stated philosophy, and a placement relative to its neighbors — so that future implementation rounds can each be small, focused, and reversible.

What you will NOT find here:
- Code.
- Prescriptive CSS or component class names.
- Library/framework choices (vanilla JS vs framework — that's a future decision, deliberately deferred).
- Mockup graphics. (ASCII sketches only, where they clarify layout.)
- Anything that changes the locked editor engine.

What you WILL find:
- **Principles** that every subsystem must honor.
- **Subsystem boundaries** with what each owns and what it doesn't.
- **Decision records** for anything where there's a real choice to make (with the recommended choice stated).
- **Deferred items** explicitly called out so they don't slip into v01 by accident.
- **Glossary** at the end.

---

## 1. Vision & Constraints

### 1.1 What Rwanga is — and what it isn't

Rwanga is a **screenplay-first writing environment** built to professional standards. The shell exists to make working on a script feel **focused, calm, and powerful** — not to make Rwanga feel like a programmer's IDE that happens to open `.rga` files.

We are inspired by VSCode and Cursor — their command palette, their keyboard-first ergonomics, their density and speed — but we are emphatically **not VSCode for writers**. A writer's day is:

- One or two scripts open. Not 47 source files.
- Long stretches of typing. Not many file switches.
- A Scene Navigator they live in. Not a project tree.
- A character list. Not a class outline.
- A page count and a runtime estimate. Not a build status.

The shell's job is to reflect that reality at every layer. Every time a default favors writer over engineer, take it.

### 1.2 Hard constraints

| Constraint | Implication |
|---|---|
| **Engine is locked** | Shell consumes `Rga.*` APIs only; never reaches into PM state directly except where the engine exposes it. |
| **Platform-portable** | Same shell code base runs in Electron desktop AND the future Rwanga web editor. No Electron-only APIs in shell code; isolate them behind `window.rwanga.*` (already a project convention). |
| **Local assets only** | Every CSS, font, icon, JS dependency lives in `static/` / bundled. No CDNs. No Google Fonts. (Memory: `local_assets_only`.) |
| **Privacy as a moat** | Your content stays yours until you explicitly add it to a project. The shell never silently uploads, never silently caches user content remotely. Sync is opt-in, visible, and reversible. |
| **Free forever for the local editor** | All shell capabilities work without an account. Pro features are network-crossing only. |
| **Distribution gate** | A free signup is required to download the binary, but the binary itself doesn't gate features behind sign-in at runtime. Shell never says "sign in to write." |
| **i18n from day one** | Kurdish, Arabic, English at minimum. RTL must work at every layer — not retrofitted. |
| **OSS polish** | The repo is the storefront. Code, comments, error messages, README, contributing guide all need to read like a professional product. |

### 1.3 Inspirational benchmarks

| Quality we want | From |
|---|---|
| Command palette fluency | VSCode, Cursor, Linear |
| Layout density without noise | Sublime, VSCode |
| Calm onboarding | Linear, Things 3 |
| Outline / explorer ergonomics | Obsidian, Logseq |
| Settings transparency | VSCode (settings.json + UI side-by-side) |
| Theme craftsmanship | iA Writer, Ulysses, Drafts |
| Reading view fidelity | Final Draft, WriterDuet |
| Keyboard-first navigation | Helix, Kakoune (shell-level patterns, not the modal editing) |

Each subsystem section names its specific benchmark.

---

## 2. Design Principles

These are non-negotiable. Every subsystem must read against them.

1. **Engine is the source of truth.** The shell renders state. State lives in the engine (`Rga.Nav.getIndex`, `Rga.RuntimeProfile.current`, `Rga.ViewManager.current`, etc.) or in the per-workspace JSON config. Never in a DOM attribute or a closure variable that nobody else can see.
2. **Screenplay-first naming.** "Script" not "file". "Scene" not "section". "Character" not "entity". "Production" not "project metadata". The English vocabulary is the public-facing contract; Kurdish/Arabic translations mirror it.
3. **One way to do anything.** Every command exists in the command palette and has exactly one canonical keyboard shortcut. Menus and toolbar buttons are convenience surfaces over that single source of truth — never alternative implementations.
4. **Calm by default.** No animations longer than 200ms. No badges that bounce. No red dots unless something needs human attention. The default state of the UI is "quiet."
5. **Keyboard parity.** Every action achievable with a mouse must be achievable with the keyboard. Reverse is not required (some advanced configuration may stay in settings UI).
6. **Reversibility.** Every destructive action has an undo, a confirmation, or a recoverable trash. The user never loses work because they clicked the wrong thing.
7. **Reveal complexity progressively.** Onboarding shows the writer a script and a scene. Power features (split editor, multi-cursor in shell controls, vim mode) come from the command palette or settings — never as default visual clutter.
8. **Honor the writer's hardware.** Performance budget at 60 fps on a 5-year-old laptop. Cold start under 2 seconds. First scene visible under 500 ms after click.
9. **No surprise networks.** Anything that crosses the network shows a visible indicator while it happens. Telemetry is opt-in with a plain-English description.
10. **Accessible as a feature, not a checkbox.** Screen reader, keyboard-only, reduced-motion, high-contrast, large-text — each tested as a first-class user.

---

## 3. Window & Layout Architecture

### 3.1 Window model

**Decision:** Single primary window per workspace. "Open in new window" is supported but secondary.

Rationale: a screenwriter rarely needs three editor windows at once. They need one screen with their script, their scene list, and their notes. VSCode's multi-window pattern is power-engineer territory; we offer it but don't optimize for it.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Title bar — app name · script name · sync state ·          [👤 avatar]│
├──┬────────────────┬─────────────────────────────────────────────────────┤
│  │                │                                                     │
│ A│   SIDEBAR      │                EDITOR AREA                          │
│ C│  (one of:      │  ┌─ tabs ────────────────────────────────────────┐  │
│ T│   Scenes /     │  │ Tab1  Tab2*  Tab3+                             │  │
│ I│   Script       │  └────────────────────────────────────────────────┘  │
│ V│   Workspace /  │  ┌─ breadcrumb ──────────────────────────────────┐  │
│ I│   Outline /    │  │ MyScript › Scene 12 › ALEX › dialogue          │  │
│ T│   Characters / │  └────────────────────────────────────────────────┘  │
│ Y│   Search /     │                                                     │
│  │   Revisions)   │       [ PM editor — Flow / Print / Draft ]         │
│ R│                │                                                     │
│ A│                │                                                     │
│ I│                │                                                     │
│ L│                │  ┌─ Studio Panel (collapsible) ──────────────────┐  │
│  │                │  │ Scene · Notes · Flags · Problems · Breakdown   │  │
│  │                │  │ (Internal name "Studio Panel"; UI may say      │  │
│  │                │  │  "Bottom Panel" for now — see §7 + glossary.)  │  │
│  │                │  └────────────────────────────────────────────────┘  │
├──┴────────────────┴─────────────────────────────────────────────────────┤
│ Status bar — scene N · page N · word count · lang · sync · errors      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Zones (canonical names used throughout this doc)

| Zone | Purpose | Locked engine API it consumes |
|---|---|---|
| **Title bar** | App identity, current script name, dirty/sync state, **identity avatar (Account dropdown)**, window controls | (none — UI only) |
| **Activity rail** (left edge) | One-click switcher between sidebar contents. **Does not host identity** — Account lives in the title bar avatar. | (none — drives sidebar state only) |
| **Sidebar** (variable contents) | Scenes / Script Workspace / Outline / Characters / Search / Revisions | `Rga.Nav.getIndex`, `Rga.Nav.getOutline` |
| **Editor area** | Tabs, breadcrumbs, the PM editor | `Rga.Editor.mount`, `Rga.ViewManager.activate('flow'\|'draft'\|'printPreview')` |
| **Studio Panel** (internal name; UI label "Bottom Panel" — see §7) | Scene · Notes · Flags · Problems · Breakdown | `Rga.Nav.getIndex` (notes / flags / characters / tags) |
| **Status bar** | Live indicators | `Rga.Nav.getIndex` + `Rga.RuntimeProfile.current` |

### 3.3 Layout persistence

Layout is **per workspace**. Sidebar width, Studio Panel height, sidebar visibility, Studio Panel visibility, last-active sidebar tab, view mode, open script tabs and their order — all serialized to `.rwanga-workspace`. When the user reopens a workspace, the layout snaps back exactly.

Layout is **NOT** per user account. Different workspaces can have wildly different layouts because they reflect different scripts (one writer might want a tall script-only view for a feature; the next workspace might be a TV writers' room with the breakdown panel open).

### 3.4 Resize semantics

- Sidebar: drag the right edge. Snaps to minimum (32px = icons only) or hidden (0).
- Studio Panel: drag the top edge. Snaps to minimum (collapsed header) or hidden.
- Editor groups: drag the divider between them.

Double-click any divider to reset to default width.

### 3.5 Border-chrome integration

On macOS, the title bar overlays the window controls into the titlebar region (like VSCode). On Windows, the menu bar collapses into a single button when the window is narrow. On Linux, system-decoration is honored (no custom titlebar by default — too much DE fragmentation).

The web build (Rwanga editor in a browser) has no native chrome at all; the title bar becomes a soft top strip.

### 3.6 Identity (title bar avatar)

Identity is **not** a workspace activity — it is account state about the human, not about the script the human is writing. Putting Account in the activity rail mixes those two scopes; we keep them separate by anchoring identity in the title bar instead.

**Placement:** Far right of the title bar, just inside the OS window controls (or, on the web build, at the absolute right of the top strip). On RTL UI languages, mirrors to the far left.

**Surface — signed in:**
```
[👤 avatar] ← click opens a popover
┌──────────────────────────────────────────┐
│  Darya Ibrahim                            │
│  daryabsb@gmail.com   [ Pro · active ]   │
│                                           │
│  Sync · Last synced 3 min ago             │
│  ► Sync now                               │
│                                           │
│  ⚙ Account settings…                      │
│  💾 Cache management…  (opens §18.5)      │
│  📜 Manage subscription… (opens browser)  │
│                                           │
│  ⤴ Sign out                               │
└──────────────────────────────────────────┘
```

**Surface — signed out:**
```
[👤?] ← muted glyph, click opens a tiny popover
┌──────────────────────────────────────────┐
│  Local editing works without an account. │
│  Sign in to enable sync, AI features,    │
│  and Pro tools.                           │
│                                           │
│  ► Sign in                                │
└──────────────────────────────────────────┘
```

The avatar **never** demands attention — no red dots, no animated rings. It is calm. The status-bar sync segment (§8.2) carries the live sync state; the avatar popover is the deep-management surface.

**What lives behind the avatar (vs Settings):**
| Behind the avatar | In Settings → Account |
|---|---|
| Sign in / sign out | Connected accounts list |
| Current Pro entitlement badge | Subscription tier history |
| "Sync now" trigger | Sync provider configuration |
| Cache management entry point | Cache size limits + retention policy |

Avatar = the identity I'm using right now. Settings → Account = the configuration of identities and how they sync.

---

## 4. Activity Rail

A vertical column on the left edge, 48px wide. Each row is an icon with a tooltip and a keyboard shortcut.

### 4.1 Ordering (screenplay-first)

```
┌──┐
│📋│  Scenes              (Cmd-Shift-S)   ← FIRST. Screenplay-first.
│📁│  Script Workspace    (Cmd-Shift-E)   ← writer workspace, not file tree
│🌳│  Outline             (Cmd-Shift-O)
│👥│  Characters          (Cmd-Shift-C)   ← v0.2+ (see §5.6)
│🔍│  Search              (Cmd-Shift-F)
│📜│  Revisions           (Cmd-Shift-R)   ← v0.2+ (see §5.5)
│  │
│ ...spacer (flex)
│  │
│⚙️│  Settings            (Cmd-,)
└──┘
```

**Identity does NOT appear in the rail.** Account / sign-in / sync controls live in the title bar avatar (§3.6). Rationale: the rail switches between *workspace activities* — things you do with the script. Identity is a different scope — it's about the human, persists across workspaces, and doesn't belong in the same affordance.

**Ordering rationale:**
- **Scenes** leads because that's what the writer reaches for most.
- **Script Workspace** is second because writers carry more than scripts — references, PDFs, images, notes, storyboards, research assets all live alongside the `.rga` (see §5.3). This is the writer's workspace, not a file tree.
- **Outline** third — survey of the whole document.
- **Characters** fourth — the cast surface (deferred to v0.2 per §5.6).
- **Search** fifth — find-and-replace across the workspace.
- **Revisions** last in the writer-facing group — the long-tail "what changed when" surface, internally Git-backed but never spoken of as such (see §5.5).

### 4.2 Behavior

- Clicking an active item **collapses** the sidebar (toggle). Clicking an inactive item **switches** to it.
- Drag-and-drop to reorder items (per workspace).
- Right-click on an item: "Hide from rail", "Move to bottom".
- The hidden items live behind an overflow `···` button at the bottom of the visible list.

### 4.3 What the rail is NOT

- Not a status indicator. (Status lives in the status bar.)
- Not a notification surface. (Notifications live in their own toast / inbox layer.)
- Not a tabs-of-extensions surface. (Extensions are deferred indefinitely; if they ever land, they live in Settings → Extensions.)

---

## 5. Sidebar Panels

Each sidebar panel has the same outer chrome:

```
┌───────────────────────────┐
│ PANEL TITLE          ··· │  ← per-panel toolbar (filter / sort / add)
├───────────────────────────┤
│                           │
│   panel content           │
│                           │
└───────────────────────────┘
```

The `···` is a per-panel action overflow. Common actions: refresh, settings, hide panel.

### 5.1 Scenes (Scene Navigator) — the flagship panel

**Purpose:** The writer's primary navigation surface. A live, ordered list of every scene in the current script.

**Source of truth:** `Rga.Nav.getIndex(state).scenes` — already includes `sceneNumber`, `headingDisplay`, `setting`, `time`, `locationText`, `transitionPresetType`, `blockCount`, `hasNotes`, `hasRevisionFlag`.

**Visual:**
```
┌────────────────────────────────────┐
│ SCENES               filter ▾  + │
├────────────────────────────────────┤
│ 1  INT. ROSE GARDEN — DAWN     📝 │  ← scene 1, has note (📝)
│ 2  EXT. KITCHEN — NIGHT          │
│ 3  INT. CAR — CONTINUOUS      🚩 │  ← has revision flag (🚩)
│ 4  EXT. STREET — DAY             │
│ ...                              │
└────────────────────────────────────┘
```

**Interactions:**
- **Click** → scrolls editor to that scene's `pmFrom`, places cursor at the heading.
- **Double-click** → opens a quick-edit inline (heading text only) — saves on blur / Enter.
- **Drag** → reorders scenes in the doc. (Triggers an engine transaction; sceneNumber updates automatically via the index plugin.)
- **Right-click** → context menu: Rename / Duplicate / Delete / Add note / Open in new tab.
- **Cmd-Click** → opens the scene in a new editor tab (split view).
- **Search box** at top filters by setting + location + character.

**Sub-features (later):**
- Color-code by tag.
- Group by act (when the script has act-break decorations).
- Compact mode (one-line scene = scene number + heading only).
- Card mode (per-scene summary card with the first action line preview).

**What it does NOT do:**
- It is NOT the place to edit scene content. Scene content edits happen in the editor.
- It is NOT the place to manage character information. (That's the Outline panel.)

### 5.2 Outline panel

**Purpose:** Document-level summary, statistics, and quick navigation.

**Source of truth:** `Rga.Nav.getOutline(state)` — already includes title, screenplayProfile, scenes-with-summaries, characters-with-appearance-counts, tags grouped by type, statistics.

**Visual:**
```
┌────────────────────────────────────┐
│ OUTLINE                         ·· │
├────────────────────────────────────┤
│ ▼ The Last Light                  │
│   8 scenes · 12 pages · 3,420 wds │
│                                   │
│ ▼ Scenes                          │
│   1. INT. ROSE GARDEN — DAWN      │
│      Alex picks a rose. He smiles.│
│   2. EXT. KITCHEN — NIGHT         │
│      She places the rose in vase. │
│   ...                             │
│                                   │
│ ▼ Characters                      │
│   NALI         (4 scenes)         │
│   ALEX         (8 scenes)         │
│                                   │
│ ▼ Locations                       │
│   ROSE GARDEN  (1)                │
│   KITCHEN      (3)                │
│   CAR          (1)                │
│                                   │
│ ▼ Statistics                      │
│   Scenes:         8               │
│   Pages:          12              │
│   Action words:   1,320           │
│   Dialogue words: 1,980           │
└────────────────────────────────────┘
```

**Interactions:**
- Click any scene → jump.
- Click any character → filter Scenes panel to scenes with that character.
- Statistics are read-only.

**Distinction from Scenes panel:** Outline is for surveying the whole script. Scenes is for navigating between them.

### 5.3 Script Workspace Explorer

**Purpose:** The writer's home in the workspace. Not "a file browser" — a **production workspace surface** that organizes every asset the writer is gathering around the script: drafts, references, PDFs, images, notes, storyboards, research, contracts, location scouts. The script is the centerpiece; the assets are the supporting material the writer reaches for while writing.

**Visual:**
```
┌────────────────────────────────────────┐
│ SCRIPT WORKSPACE          new ▾   ···  │
├────────────────────────────────────────┤
│ ▼ The Last Light/                      │
│   📜 Scripts                            │
│      the-last-light.rga       (active) │
│      draft-2.rga                       │
│      outline.rga                       │
│   📖 References                         │
│      story-treatment.pdf               │
│      genre-research.md                 │
│   🖼  Images & Storyboards              │
│      rose-garden-mood.jpg              │
│      scene-3-storyboard.png            │
│      character-sheet-nali.pdf          │
│   📝 Notes                              │
│      research-notes.md                 │
│      table-read-feedback.md            │
│   📍 Locations                          │
│      slemani-house-photos/             │
│      kitchen-scout.heic                │
│   🎼 Other                              │
│      score-temp.mp3                    │
│      pitch-deck.pdf                    │
└────────────────────────────────────────┘
```

**Categorization model:**
Categories (Scripts, References, Images & Storyboards, Notes, Locations, Other) are **derived from file type by default** — not folder-structure. A writer drops a PDF anywhere in the workspace and it appears under "References." This keeps the writer out of file-organizing-software-tax territory.

Power users who want literal folder structure can toggle Settings → Workspace → Group Script Workspace by → "Folders" (default: "Type").

| Default category | File types |
|---|---|
| Scripts | `.rga`, `.fountain`, `.fdx` (read-only display for non-`.rga`; opens in OS app) |
| References | `.pdf`, `.docx`, `.epub` |
| Images & Storyboards | `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif`, `.heic` |
| Notes | `.md`, `.txt`, `.rtf` |
| Locations | sub-folders named `locations/` or images tagged with location metadata |
| Other | everything else |

**Asset interactions:**
- `.rga` files: open in editor tab (default action).
- `.pdf` / `.docx` / images: open in OS default app (the workspace doesn't build viewers for everything; respects what the writer already uses).
- `.md` / `.txt`: in v0.1 open in OS app; in v0.2+ a lightweight read-only preview panel may live in the Studio Panel.
- Right-click any asset: Rename / Duplicate / Delete to trash / Reveal in OS / Copy path / Add to favorites.

**Asset-to-script linking (v0.2+, deferred):**
A writer can "link" any asset to a scene — drag the asset onto a scene in the Scenes panel, or use the asset's right-click → "Link to scene…" Linked assets surface as small chips in the Studio Panel's Scene tab when that scene is active. This makes "the rose-garden mood image is linked to Scene 1" a discoverable, navigable connection — not a hidden bookmark the writer has to remember.

**Drag/drop:**
- Drop any file from OS onto the workspace → copies into the workspace folder, auto-categorizes.
- Drop an image directly into the Scenes panel → links to that scene (v0.2+).
- Drag a `.rga` out → exports a copy.
- Drag a non-`.rga` out → standard OS file drag.

**Favorites section:**
- Top of the workspace shows a "★ Favorites" group with assets the writer has starred. Stays at the top regardless of category. Useful for the contract PDF the writer rereads every week or the storyboard reference they paint from.

**Recent scripts:**
- Below favorites: a "Recent scripts" group (last 5 opened, across all workspaces). Convenience for the writer who lives across two projects.

**Empty workspace:**
- Empty state: "This workspace is empty. Drag in references, images, notes — or **New Script** (Cmd-N) to begin."

**What it does NOT do:**
- Not a media library (no thumbnails grid view in v0.1 — that's an Images panel concept for later).
- Not a research tool (no inline PDF reader, no annotation of non-`.rga` files).
- Not a file manager (no move-between-categories — the user moves the file on disk; the workspace re-categorizes).
- Not a backup surface (Revisions panel §5.5 owns version history).

### 5.4 Search

**Purpose:** Cross-script find/replace.

**Visual:**
```
┌────────────────────────────────────┐
│ SEARCH                       opts │
├────────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ Search…                       │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Replace… (collapsed)          │ │
│ └──────────────────────────────┘ │
│ ▼ The Last Light  (3 matches)    │
│   Scene 2 line 4 — "she sighs"   │
│   Scene 5 line 1 — "she sighs"   │
│   Scene 8 line 7 — "she sighs"   │
└────────────────────────────────────┘
```

**Scope toggles:**
- Current script
- All scripts in workspace
- Open scripts only

**Filters:**
- By block type (only dialogue, only action, only scene headings)
- By character (only ALEX's lines)
- Case sensitivity, whole word, regex

**Replace** is per-match preview, with "replace all in script" / "replace all in workspace" buttons that show a confirmation dialog with count.

### 5.5 Revisions — deferred to v0.2

Writers don't think in commits and branches. They think in **drafts, snapshots, and "what did I have last Tuesday."** This panel speaks their language. The underlying storage is Git (because Git is the right tool for content-addressable history), but every Git-ism is hidden behind writer-facing vocabulary.

**Writer-facing vocabulary (the only words the UI ever uses):**

| Writer says | (Internally Git is doing) |
|---|---|
| **Snapshot** | A commit. "Take a snapshot" creates one with a timestamp and the writer's note. |
| **Revision** | A change between two snapshots. "Show revisions since last week." |
| **Draft** | A named branch / labeled snapshot — "Draft 3 — table-read version." |
| **Version History** | The reverse-chronological list of snapshots for this script. |
| **Compare Drafts** | A side-by-side or unified diff between two snapshots. |
| **Restore** | Checkout — reverts the working file to a snapshot's state. Confirms before overwriting unsaved work. |
| **Discard changes** | Reset to last snapshot. Confirms loudly. |

**The words "commit", "branch", "merge", "checkout", "diff", "remote", "push", "pull"** never appear in writer-facing UI. They may appear in error messages from internal Git failures (with a translation: "Could not sync your snapshots — the cloud storage is offline.") but not as primary affordances.

**Visual (deferred to v0.2 — sketch only):**
```
┌────────────────────────────────────────┐
│ REVISIONS                  ⊕ snapshot │
├────────────────────────────────────────┤
│ ┌─ Current draft ───────────────────┐ │
│ │  Draft 3 — table-read version     │ │
│ │  ★ marked as current draft        │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Version history                        │
│   📌 Today 14:32   Snapshot            │
│      "After meeting with director"    │
│      +12 / −3 lines · Scene 3, 5      │
│                                        │
│   📌 Yesterday    Snapshot            │
│      "End of Tuesday session"          │
│      +47 / −12 lines · 6 scenes        │
│                                        │
│   📌 3 days ago   Snapshot ★          │
│      "Draft 3 — table-read"           │
│      +120 / −45 lines · all scenes    │
│                                        │
│   ► Compare drafts…                    │
└────────────────────────────────────────┘
```

**Surface decisions:**
- **Snapshots, not auto-commits.** The writer takes a snapshot explicitly. Auto-snapshots happen in the background (every save, hourly), but they're filed under a collapsed "Auto-saves" section, not surfaced as primary noise. Writers see snapshots they took on purpose.
- **Compare Drafts** opens a dedicated editor tab with two scripts side-by-side, color-coded for added/removed/changed lines. Honors v3 schema — diffs at the scene-block level, not raw text. (E.g. "Scene 5 dialogue changed: 2 lines added by NALI.")
- **Restore** writes the snapshot's content over the working file. Before doing so: takes an automatic snapshot of the current state ("Auto-snapshot before restore") so the writer can always undo the restore.
- **Mark as current draft** — promotes a snapshot to a named draft. The status bar carries the current draft name (when set).
- **No syncing UI in this panel.** Cloud sync of snapshots lives in Account / Settings. The Revisions panel is local-history-first.

**What it does NOT do:**
- No raw Git output anywhere in the UI.
- No merge conflict resolution surface in v0.2 (single-writer assumption; collaborative editing is a v2 IDE concern per memory `project_v2_ai_architecture`).
- No remote management.
- No commit-graph visualization.
- No author attribution UI (single-writer assumption holds).

**v0.1 carrier:** The Revisions rail slot is reserved and tooltipped, but clicking it shows: "Version history is coming in 0.2. For now, your `.rga` files are auto-saved every 30 seconds — see Storage in Settings for autosaves."

### 5.6 Characters — deferred to v0.2

(Account / sign-in lives in the title bar avatar — see §3.6. The rail's sixth slot belongs to the writer's cast, not their identity.)

**Purpose:** A first-class surface for the cast of the script — character intelligence the writer can browse, search, and (later) operate on. Same way the Scenes panel surfaces structural scenes from `Rga.Nav.getIndex(state).scenes`, this panel surfaces structural characters from `Rga.Nav.getIndex(state).characters`.

**Source of truth:** `Rga.Nav.getIndex(state).characters` (already populated in Phase 5 — `nodeId`, `name`, `color`, `cueCount`, `mentionCount`, `sceneAppearances`) plus the dialogue-line-count derivation (computable from the same doc walk).

**Visual:**
```
┌────────────────────────────────────────┐
│ CHARACTERS              filter ▾   ··· │
├────────────────────────────────────────┤
│ NALI                          ●       │
│   18 scenes · 142 lines · 1,840 words │
│   appears with: ALEX, ZARA            │
│                                        │
│ ALEX                          ●       │
│   24 scenes · 198 lines · 2,310 words │
│   appears with: NALI, ZARA, DIRECTOR  │
│                                        │
│ ZARA                          ●       │
│   12 scenes · 76 lines · 920 words    │
│   appears with: NALI, ALEX            │
│                                        │
│ DIRECTOR                      ○       │
│   3 scenes · 14 lines · 180 words     │
│                                        │
│ ▼ Background (5)                       │
│   (collapsed — characters with <3 cue │
│    blocks; tap to expand)              │
└────────────────────────────────────────┘
```

The colored dot reflects the character's tag color from `tagRegistry.characters[].color`. The filled / outlined glyph distinguishes major (5+ scenes) from supporting/background.

**Per-character row content (v0.2):**

| Field | Source |
|---|---|
| Name | `characters[].name` |
| Color | `characters[].color` |
| **Appearances** — N scenes | `characters[].sceneAppearances.length` |
| **Dialogue counts** — N lines, M words | derived (walk character→dialogue cue chains) |
| **Scene presence** — small dot row showing which of the N scenes they're in | derived from `sceneAppearances` × `scenes[].pmPos` |
| **Co-appearance** — "appears with" list | derived (intersect sceneAppearances across characters) |
| **Relationships** — explicit relations the writer added | character metadata (new attribute on registry entry; backwards-compatible) |

**Click interactions:**
- **Click character row** → filters Scenes panel to scenes that character appears in.
- **Double-click** → opens a Character Detail tab in the editor area with everything from the row plus a full dialogue browser ("show me every line NALI says").
- **Right-click** → Rename / Set color / Mark as background / Add note / Add relationship / Delete (with cascade-removal confirmation).

**"Future character intelligence" hooks (v0.3+ / v2):**

Listed so the panel architecture leaves room for them without re-design:

| Feature | What it surfaces | When |
|---|---|---|
| Voice consistency check | "NALI's dialogue uses 18% more questions than in earlier drafts" | v0.3+ AI |
| Speech-pattern profile | Per-character word frequency, average sentence length, formality score | v0.3+ |
| Arc tracker | Per-character emotional/decision beats across acts | v2 AI |
| Relationship graph | Visual diagram of who-knows-whom, who-spoke-to-whom | v2 |
| Casting prep export | Per-character sides — auto-extracted scenes-with-this-character PDF | v0.3+ |
| Continuity alerts | "ALEX says he's 30 in scene 4 but 28 in scene 19" | v2 AI |

The panel is the **single home** for all of these — they'll arrive as new sections inside the character detail view or as new filters on the rows, never as their own sidebar panels.

**What it does NOT do:**
- Not a tag-registry editor for non-character tag types. (Props, locations, etc., remain in the Studio Panel's Breakdown tab.)
- Not an arc-writing tool. (No outline-style character beat-board in v0.2; that's a v2 concept.)
- Not a casting-management surface (no actor names, no contact info — Rwanga is a writing tool, not a production-tracking tool).

**v0.1 carrier:** Rail slot reserved and tooltipped. Clicking it in v0.1 shows: "Characters panel arrives in 0.2. For now, see the Breakdown tab in the Studio Panel for tag-driven character listings."

---

## 6. Editor Area

### 6.1 Tab system

**Decision:** Conventional horizontal tab bar at the top of the editor area. Pinned tabs supported. Drag to reorder. Middle-click to close. Cmd-W to close. Cmd-Shift-T to reopen last closed.

**Tab states:**
- Clean (no indicator)
- Dirty (small dot: `●`)
- Read-only (lock icon — for print preview, or for `.rga` files opened from non-writable locations)

**Tab overflow:** when tabs exceed bar width, the rightmost overflow into a dropdown menu (`···`). Pinned tabs always stay visible. (Memory: VSCode-refactor queue mentions tab-bar overflow needing attention — this is the right resolution.)

**Tab groups (splits):** vertical split + horizontal split, like VSCode. Each editor group is independent (own tab bar). Tabs can be dragged between groups. Max recommended: 4 groups in any layout.

### 6.2 Breadcrumbs

A second strip below the tab bar showing the cursor's structural location:

```
The Last Light › Scene 3 › INT. ROSE GARDEN — DAWN › Alex
```

Each segment is clickable: clicking "Scene 3" focuses scene 3 in the Scene Navigator; clicking the script name reveals it in the Script Workspace (§5.3).

The last segment shows the block type the cursor is in (Action / Character / Dialogue / etc.) — not the text.

**Toggleable** in Settings (some writers want maximum vertical space; respect that).

### 6.3 The editor surface itself

This is where the locked engine renders. The shell provides the container `<div id="editor">` and the surrounding chrome (page sheet for Print, dim gutters for Flow). The shell does not own the editor's internal DOM.

**View-mode integration:** The shell exposes view-mode toggles (a status-bar control and a command palette entry) that call `Rga.ViewManager.activate('flow' | 'draft' | 'printPreview')`. The shell never sets `body.view-*` classes directly — `ViewManager` owns those.

### 6.4 Floating widgets inside the editor area

The editor engine may emit decoration widgets (page-break markers, scene number badges). The shell does NOT add its own floating overlays inside the editor (no minimap, no inline ghost-text per the AI memory). Anything the shell wants to show about a position in the doc goes in the Studio Panel, the sidebar, or the breadcrumbs.

### 6.5 Welcome view (no script open)

When no script is open the editor area shows a soft welcome panel:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              Rwanga Script Editor               │
│                                                 │
│  Start                                          │
│  · New Script                  Cmd-N            │
│  · Open Script…                Cmd-O            │
│  · Open Workspace…             Cmd-K Cmd-O      │
│                                                 │
│  Recent                                         │
│  · The Last Light             yesterday          │
│  · The Coffee Order           3 days ago        │
│                                                 │
│  Learn                                          │
│  · Take a tour                                  │
│  · Keyboard shortcuts                           │
│  · What's new in 0.1.0                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 7. Studio Panel (UI: "Bottom Panel")

A collapsible drawer at the bottom of the editor area. Multiple tabs.

**Naming note:** Internally and in all design / engineering discussion this surface is the **Studio Panel** — a name that reflects its actual role (the writer's "studio bench" of secondary craft surfaces around the script). The user-facing UI label remains **"Bottom Panel"** for now to match user expectations from other editors; the label can be reconsidered as the panel's identity matures (Breakdown / Notes / Flags / Problems feel more studio-bench than terminal-drawer the longer the panel exists). Switching the UI label is a one-line copy change when that decision is made.

In this document, "Studio Panel" is the canonical name. Code / class names / state ownership should adopt it from day one (e.g. `Rga.Shell.StudioPanel`, `.rga-studio-panel`).

### 7.1 Tabs

| Tab | Purpose | Source |
|---|---|---|
| **Scene** | Inspector for the scene the cursor is in (notes textarea, revision flag selector, scene-level tags) | `Rga.Nav.getIndex` + the scene node's attrs |
| **Notes** | List of annotation cards for the whole script | `Rga.Nav.getIndex(state).notes` |
| **Flags** | List of open revision flags + resolved log | `Rga.Nav.getIndex(state).flags` + `doc.flagLog` |
| **Problems** | Validation / lint warnings (orphan tags, scenes without dialogue, etc.) | derived in the shell from the index |
| **Breakdown** | Production breakdown — characters / props / locations table for the active scene | `Rga.Nav.getIndex(state).tags` |

### 7.2 Tab affordances

- Each tab has a count badge when it has items (e.g. "Flags (3)").
- Tabs persist their last-active state per workspace.
- Tab header has a context menu: "Move panel to right" (turns the Studio Panel into a right-side panel — a deferred docking feature, see §10).

### 7.3 No terminal tab

Explicit non-feature for v01. Rwanga is not a developer tool. If a power user wants a terminal, they have one in the OS.

---

## 8. Status Bar

A 22px strip at the bottom of the window. Left-aligned segments are about the document; right-aligned segments are about the app.

```
│ Scene 5 of 8 · Page 12 · 3,420 words · NALI present │ │ ku · Flow · Synced · 0 problems │
└────────── document context ──────────────────────────┘ └── app context ──────────────────┘
```

### 8.1 Segments (left side — document context)

| Segment | Click action |
|---|---|
| Current scene + total | Opens Scenes panel, highlights the row |
| Page N of M | Opens "Go to page" mini-prompt (`Cmd-G`) |
| Word count | Opens Outline panel statistics section |
| Character presence | "NALI present" — clicking opens Breakdown filtered to NALI |

### 8.2 Segments (right side — app context)

| Segment | Click action |
|---|---|
| Language | `ku` / `ar` / `en` indicator. Click to open Settings → Language. |
| View mode | "Flow" / "Draft" / "Print Preview". Click to cycle. |
| Sync state | "Synced" / "Offline" / "Syncing…" / "Sign in to sync". Click to open the title-bar identity avatar popover (§3.6). |
| Problems count | "0 problems" / "3 problems". Click to open Problems tab in Studio Panel. |

Status bar items are **never animated** beyond a 1-frame color flash. No spinners (spinners go in toasts).

---

## 9. Command Palette

The single most-used shell surface. `Cmd-K` opens it.

### 9.1 Modes (mode-prefix routing)

| Prefix | Meaning |
|---|---|
| (no prefix) | Fuzzy search across commands AND scenes AND characters (combined). Best for "I just want to find something." |
| `>` | Commands only (VSCode-compatible muscle memory). |
| `:` | Scenes — `:12` jumps to scene 12; `:rose` filters scenes whose location matches. |
| `@` | Characters — `@nali` jumps to the next scene NALI is in; second hit goes to the next, etc. |
| `#` | Tags — `#prop:lantern` jumps to scenes with that prop. |
| `?` | Help — searches keyboard shortcuts and short docs. |
| `/` | Find in current script (file-scope find). |

### 9.2 Result row anatomy

```
┌─────────────────────────────────────────────┐
│ 🎬 Scene 5  INT. CAR — CONTINUOUS  · 🚩    │
│    NALI · ALEX · prop: lantern              │
└─────────────────────────────────────────────┘
```

- Icon by result type (scene 🎬 / command ⚡ / character 👤 / file 📄 / setting ⚙️)
- Primary text (scene heading, command name, character name)
- Secondary muted text (context — characters in scene, last-used time, keyboard shortcut)
- Right-side meta (flag indicator, scene number)

### 9.3 Keyboard inside the palette

| Key | Action |
|---|---|
| Up/Down | Move selection |
| Enter | Activate |
| Cmd-Enter | Activate in new tab / split |
| Esc | Close (preserve query in history for next open) |
| Cmd-Backspace | Clear query |
| Tab | Cycle through prefix modes |

### 9.4 What the palette is NOT

- Not a chat surface. AI commands live in the palette but each AI command is a single-shot action ("Suggest a stronger transition for scene 3"), not a conversation. Conversations live in a dedicated AI panel.
- Not a file picker. (Cmd-O opens the OS file picker for that.)

### 9.5 Recent / favorites

The palette remembers the last 20 invocations per workspace. When the query is empty, the result list shows recents first. A pin icon on each result lets the writer favorite a frequently-used command (favorites then float above recents).

---

## 10. Docking & Layout

### 10.1 What's dockable

- **Sidebar:** left ↔ right (a setting, not a drag — Settings → Appearance → Sidebar position).
- **Studio Panel** (UI label: "Bottom Panel"): bottom ↔ right (so a writer using a wide monitor can stack Outline + Studio Panel vertically on the right). Drag the panel's tab header to its desired edge.
- **Editor groups:** unlimited splits (vertical, horizontal, or grid).

### 10.2 What's NOT dockable in v01

- Activity rail. Fixed left edge for now; respects sidebar position (when sidebar moves to right, rail also moves to right).
- Status bar. Fixed bottom.
- Title bar. Fixed top.
- Floating panels / detached windows. Out of scope until we hear demand.

### 10.3 Workspace layout snapshot

The layout state is captured as JSON in the workspace file:

```
layout: {
  sidebar: { position: 'left', visible: true, width: 280, activePanel: 'scenes' },
  studioPanel: { position: 'bottom', visible: false, height: 200, activeTab: 'notes' },
  editorGroups: [
    { tabs: [...], activeTab: '...', viewMode: 'flow' }
  ]
}
```

(`studioPanel` is the canonical state key; even when the UI label reads "Bottom Panel", the persisted shape uses the internal name.)

Restoring a workspace restores this snapshot exactly. Per Settings → Appearance, the user can choose "Reset layout on open" to always start clean.

---

## 11. Keyboard System

### 11.1 Philosophy

The keyboard is the writer's primary interface. Every shell action has a key binding. Every binding is discoverable (palette + tooltips + a Keyboard Shortcuts page).

### 11.2 Conventions

| Modifier scheme | Used for |
|---|---|
| `Cmd-X` | App-wide commands (Cmd-K palette, Cmd-N new, Cmd-O open, Cmd-, settings) |
| `Cmd-Shift-X` | App-wide commands with elevated context (Cmd-Shift-S Scenes panel, Cmd-Shift-O Outline) |
| `Cmd-K Cmd-X` | Multi-step "chord" commands (Cmd-K Cmd-O = open workspace; Cmd-K Cmd-T = theme picker) |
| `Cmd-Alt-X` | View-mode toggles (Cmd-Alt-1 Flow, Cmd-Alt-2 Draft, Cmd-Alt-3 Print Preview) |
| Plain keys inside editor | Owned by the engine (Tab cycle, Enter flow, Mod-Enter spawn scene). Shell never binds plain keys. |

### 11.3 Customization

A Keyboard Shortcuts page (Settings → Keyboard) shows every binding with a search box. Each row has an edit affordance — click, press the new combo, save. Conflicts are flagged in red with the conflicting command's name.

JSON-backed: shortcuts persist in `keybindings.json` per user. Per-workspace overrides supported via `.rwanga-workspace/keybindings.json`.

### 11.4 Default key map (v01)

A non-exhaustive list of the bindings every release ships with:

| Combo | Action |
|---|---|
| `Cmd-K` | Open command palette |
| `Cmd-Shift-S` | Toggle Scenes panel |
| `Cmd-Shift-E` | Toggle Script Workspace |
| `Cmd-Shift-O` | Toggle Outline panel |
| `Cmd-Shift-C` | Toggle Characters panel (v0.2+) |
| `Cmd-Shift-F` | Open Search |
| `Cmd-Shift-R` | Toggle Revisions panel (v0.2+) |
| `Cmd-,` | Open Settings |
| `Cmd-N` | New script |
| `Cmd-O` | Open script |
| `Cmd-S` | Save |
| `Cmd-Alt-S` | Save As (resolves the `Cmd-Shift-S` conflict with Scenes panel) |
| `Cmd-W` | Close tab |
| `Cmd-T` | New tab |
| `Cmd-Shift-T` | Reopen closed tab |
| `Cmd-1..9` | Switch to tab N |
| `Cmd-Alt-1/2/3` | Flow / Draft / Print Preview |
| `Cmd-G` | Go to page… |
| `Cmd-Shift-G` | Go to scene… |
| `Cmd-J` | Toggle Studio Panel (UI: "Bottom Panel") |
| `Cmd-B` | Toggle sidebar |
| `Cmd-/` | Toggle full-screen distraction-free mode |
| `Esc` | Close active overlay / exit Draft view |
| `Cmd-Z / Cmd-Shift-Z` | Undo / Redo (engine handles inside editor; shell handles for other affordances) |

**Note:** `Cmd-Shift-A` (previously assigned to Account) is unassigned — identity moved to the title bar avatar (§3.6) and is reached by clicking it; keyboard access lands in the command palette under "Account" / "Sign in" / "Sign out" entries.

Conflicts to resolve before v01 ships are tracked in a separate Keyboard Conflict Register.

### 11.5 Vim / Helix mode

Out of scope for v01. Listed here so it doesn't get assumed. The structure of the editor engine (PM commands) makes it possible later via a plugin, but Rwanga's primary audience does not ask for modal editing.

---

## 12. Notifications

### 12.1 Surfaces

Three distinct surfaces, used for three distinct purposes:

| Surface | Purpose | Lifetime |
|---|---|---|
| **Toast** (top-right) | Transient success / info / error from a discrete action | 3–6 seconds, dismissible |
| **Notification inbox** (bell icon in status bar) | Persistent items the user might want to revisit | Until manually cleared |
| **Inline panel banner** (top of editor / sidebar) | Contextual ambient info ("This script was migrated from v2 to v3 on open") | Until dismissed once |

### 12.2 Toast anatomy

```
┌────────────────────────────────────────────┐
│ ✓  Saved "the-last-light.rga"             │
│    a few seconds ago             [Undo] × │
└────────────────────────────────────────────┘
```

- Icon by severity: ✓ success, ⓘ info, ⚠ warn, ✕ error
- Title (one line)
- Subtitle (timestamp / short context — optional)
- Action button (optional — Undo, Open, Show, etc.)
- Close button always present

Maximum 3 toasts on screen at once. Excess queue.

### 12.3 What triggers what

| Event | Surface |
|---|---|
| Save success | Toast (short, with Undo for the auto-dirty-clear) |
| File rename | Toast |
| Sync conflict | Toast (red), AND inbox entry |
| Migration on open | Inline panel banner inside the editor area |
| AI completion ready | Toast with "View" button |
| App update available | Inbox entry only — never a toast (writers shouldn't be interrupted) |
| Hard error (file corrupt, save failed) | Toast (red), inbox entry, AND a modal if the user might lose work |

### 12.4 What never triggers a notification

- Cursor movements.
- Selection changes.
- Routine background sync ticks ("Synced" status appears in status bar, that's enough).
- "Welcome back!" friendliness.

---

## 13. Settings System

### 13.1 Storage layers

Three tiers, evaluated in this order at runtime (lower tier wins):

| Tier | File | Scope |
|---|---|---|
| **User** | `<userdata>/rwanga/settings.json` | Across all workspaces (theme, keybindings, AI preferences, telemetry) |
| **Workspace** | `<workspace>/.rwanga-workspace/settings.json` | Per workspace (layout, default view mode, project-specific vocabulary overrides) |
| **Script** | `<script>.rga > metadata + settings` | Per script (production type, page setup, screenplay profile / language / convention) |

### 13.2 UI surface

Settings opens as a tab in the editor area (not a modal). Two views side-by-side: a left navigation tree, and the actual settings on the right. Top-right toggle switches between **UI mode** (form controls) and **JSON mode** (raw `settings.json` with schema-driven autocomplete).

### 13.3 Categories (non-exhaustive)

- **Editor** — font, line height, page setup, vocabulary, auto-save interval
- **Appearance** — theme, sidebar position, density, font size, reduced motion
- **Keybindings** — link to the dedicated Keyboard Shortcuts page
- **AI** — provider selection (Pro), suggestion behavior, never-collect rules
- **Files** — default save location, recent files length, file association
- **Sync** — sync provider (Pro), conflict resolution policy
- **Language** — UI language (ku/ar/en), default screenplay language profile
- **Privacy** — telemetry opt-in, crash reporting opt-in, AI training opt-out
- **Updates** — auto-update channel, update notifications

### 13.4 Reset

Every category has a "Reset to defaults" link. A "Reset all settings" lives at the bottom of the Settings tab with a confirmation dialog.

### 13.5 Setting search

Top of the Settings tab: a search box that filters across category names + setting labels + setting descriptions. Cmd-, opens Settings with the search focused.

---

## 14. Themes

### 14.1 Bundled themes (v01)

| Theme | Mood | Default for |
|---|---|---|
| **Paper Light** | Writer-warm, off-white background, ink-black text, Courier accent | First-launch default for new users |
| **Paper Dark** | Dim background, paper-cream text | Users who switch to dark |
| **Studio Dark** | VSCode-Dark-style, neutral | Users coming from VSCode |
| **High Contrast Dark** | WCAG AAA, larger focus rings | Accessibility users |
| **High Contrast Light** | WCAG AAA, larger focus rings | Accessibility users |

Rationale for Paper Light as default: a writer's mental model is paper. The page sheet view in Print Preview already evokes that — extending the metaphor to the editor reduces context-switch dissonance for new writers coming from Final Draft / WriterDuet.

### 14.2 Token system

Themes are JSON files of semantic tokens:

```
{
  "name": "Paper Light",
  "type": "light",
  "tokens": {
    "color.background.primary":  "#fbf9f5",
    "color.background.secondary":"#f3f0ea",
    "color.text.primary":        "#1a1a1a",
    "color.text.secondary":      "#5a5a5a",
    "color.accent.primary":      "#8b4513",
    "color.scene.number.bg":     "#e8e2d4",
    "color.scene.heading.fg":    "#3a2a1a",
    ...
  }
}
```

Tokens are semantic (`color.scene.heading.fg`) not implementation (`#3a2a1a`). CSS variables reflect tokens. Custom themes override any subset of tokens.

### 14.3 Custom themes

Users can author their own JSON theme files dropped into `<userdata>/rwanga/themes/`. They show up in Settings → Appearance → Theme. Theme switching is instant (no reload).

### 14.4 What themes do NOT control

- Layout (panels, density) — that's Appearance separately.
- Editor rendering rules (line height, font family) — those are Editor settings.
- Print Preview paper color — always white (writers expect that).

---

## 15. Workspaces

### 15.1 What is a workspace

A workspace is a **folder** of scripts plus a `.rwanga-workspace/` sibling directory containing:

```
my-workspace/
├── the-last-light.rga
├── notes.md
├── research/
└── .rwanga-workspace/
    ├── settings.json     ← per-workspace settings
    ├── layout.json       ← UI layout snapshot
    ├── keybindings.json  ← per-workspace key overrides (optional)
    ├── session.json      ← open tabs, cursor positions
    └── cache/            ← derived/scratch (gitignored)
```

This mirrors VSCode's `.vscode/` pattern. The folder structure is opt-in: if there's no `.rwanga-workspace/`, Rwanga treats the folder as an ad-hoc workspace with defaults.

### 15.2 Workspace operations

- **Open workspace** — Cmd-K Cmd-O — OS folder picker
- **New workspace** — Cmd-Shift-N — creates a folder + scaffolds `.rwanga-workspace/`
- **Recent workspaces** — listed on the welcome view + in File menu
- **Workspace settings** — Cmd-K Cmd-S — opens `.rwanga-workspace/settings.json` in an editor tab

### 15.3 No-workspace mode

If the user opens a single `.rga` file via OS file picker (or double-click outside any workspace), Rwanga opens it in **single-script mode** — no sidebar by default, no workspace persistence, just the editor and the script. The user can promote single-script mode to a workspace with "Save as Workspace…".

### 15.4 Cloud workspaces (Pro, deferred)

When Pro lands, a workspace can be backed by Rwanga cloud (multi-device sync). The local folder remains the source of truth; cloud is the sync mirror. This is intentionally deferred — local-only is fully featured.

---

## 16. Accessibility

### 16.1 Standards

WCAG 2.1 AA as a hard minimum. AAA where the cost is low (high-contrast themes ship with AAA contrast).

### 16.2 Specific guarantees

- **Screen reader:** every interactive element has an accessible name. Sidebar panels are landmarks. Editor area announces scene transitions. Tab labels include dirty state.
- **Keyboard-only:** entire shell navigable with Tab/Shift-Tab/Arrow/Enter/Esc. Focus rings always visible (never `outline: none` without a replacement).
- **Reduced motion:** Settings → Appearance → Reduced motion. Disables all transitions, replaces toast slides with fades.
- **Font size:** Settings → Appearance → UI font size (Small / Default / Large / Extra Large). Independent from editor font size.
- **High contrast:** dedicated themes (see §14.1) with thicker focus rings and explicit borders on every interactive area.
- **Color independence:** no information conveyed by color alone (revision flag icon + color; not just color).
- **RTL:** all layouts work mirrored. Activity rail moves to the right when UI language is ku/ar.

### 16.3 Testing

Before any v01 ship, the shell must pass:
- macOS VoiceOver navigation of all primary surfaces.
- Windows Narrator navigation of all primary surfaces.
- Tab-only navigation through every command in the palette.
- High-contrast theme rendering audit (pixel-by-pixel against a checklist).

### 16.4 What we punt for v01

- Magnifier integration.
- Eye-tracking input.
- Voice command input. (Voice as DICTATION input for the editor is on the AI v2 roadmap; voice as a SHELL control surface is not.)

---

## 17. Onboarding

### 17.1 First-launch experience

```
┌─────────────────────────────────────────────────┐
│                                                 │
│             Welcome to Rwanga                   │
│        a screenplay-first writing space         │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  ► Take the 3-minute tour                 │  │
│  │  → Or, start writing now                 │  │
│  │  ↓ Open an existing script               │  │
│  │  ⓘ Open a sample script                  │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Language: [ English ▾ ] [ Kurdish ] [ Arabic ]│
│                                                 │
└─────────────────────────────────────────────────┘
```

The language picker is visible and not buried — Kurdish/Arabic writers should never feel like they're using a tool that defaulted to English and condescends to localize.

### 17.2 The 3-minute tour

Five-stop tour, overlay-based, dismissible at any stage:

1. **Your script** — a sample 2-page script is loaded. "Click anywhere to type."
2. **Scenes** — sidebar opens. "This is your Scene Navigator. Click a scene to jump."
3. **Flow / Draft / Print** — view-mode toggle. "Switch how you see your script — typing in Flow, focus in Draft, layout in Print Preview."
4. **The command palette** — Cmd-K opens. "Everything in Rwanga is here. Try typing 'theme'."
5. **You're done** — "Press Esc to dismiss. Cmd-? at any time for help."

Each stop has Skip-tour and Back/Next. The tour leaves a "Resume tour" entry in the command palette so it's findable later.

### 17.3 Sample scripts

Two bundled sample scripts:

- **Sample (English)** — a 5-page Hollywood-format scene set in a coffee shop, demonstrating scene headings, character cues, action, dialogue, parenthetical, transition.
- **Sample (Kurdish/Arabic)** — RTL-formatted, same kinds of blocks, demonstrating that the tool is bilingual at the layout layer.

These live in `<userdata>/rwanga/samples/` and can be reloaded ("Open sample…") from the command palette.

### 17.4 Empty states

Every panel has a thoughtful empty state, not "No items."

| Panel empty state copy |
|---|
| Scenes: "No scenes yet. Press `Enter` on the slug line to start one." |
| Notes: "No notes yet. Select text and right-click → Add note." |
| Flags: "No revisions open. Flag a passage to come back to it later." |
| Problems: "Nothing to fix. Your script is clean." |
| Breakdown: "No tags yet. Select a name and right-click → Tag as → Character." |
| Search (empty query): "Type to search across this script." |
| Search (no results): "No matches for '\<query\>'. Try fewer words." |
| Script Workspace (empty): "This workspace is empty. Drag in references, images, notes — or **New Script** (Cmd-N) to begin." |
| Welcome (no recent): "Your recent scripts will show up here." |

### 17.5 Help surface

`Cmd-?` opens a help drawer with:

- Keyboard shortcuts cheat sheet (searchable)
- Link to online docs (when online)
- "Show me how to…" with 10 common how-tos
- "Report a bug" → opens GitHub issues in browser

---

## 18. Offline-First Behavior

### 18.1 Defaults

Everything works without network. Cold-launching with the Wi-Fi off must take the user into a fully-functional editor inside 2 seconds.

### 18.2 What needs network

| Feature | Network requirement | Offline behavior |
|---|---|---|
| Local editing / saving | None | Works |
| Migration (v1/v2 → v3 on open) | None | Works |
| Print Preview | None | Works |
| Scene Navigator / Outline / Search | None | Works |
| Theme switching | None | Works |
| App updates | Yes | Banner: "Updates available when online" |
| AI features | Yes (per-call) | AI commands grayed out in palette; tooltip says "Connect to use" |
| Sync (Pro) | Yes (background) | Local saves queue; status bar says "Offline — N changes pending"; sync resumes on reconnect |
| Cloud workspaces (Pro, deferred) | Yes | Read-only when offline; edits queue with conflict warnings |

### 18.3 Network indicator

The sync segment of the status bar is the single network indicator. No other "you're offline" banners. The indicator must be **calm**: a small dot, not a red badge, not a popup.

### 18.4 Caching strategy

- Theme files, samples, help docs, font files: bundled with the binary. Never re-fetched.
- AI responses: never cached server-side without explicit opt-in. Locally, AI prompts/results live in the script's session brain (per memory `project_script_equals_session`) until manually cleared.
- Workspace metadata: local-first; cloud sync layer (Pro) writes through.

### 18.5 The "no silent disk bloat" rule

Per memory `project_ide_no_silent_disk_bloat`: a Cache Management UI is mandatory. Settings → Storage shows:

- Total disk used by Rwanga
- Per-category breakdown (workspaces, autosaves, AI cache, theme cache)
- "Clear category" buttons per row
- "Reveal in Finder/Explorer" link per category

The user always knows exactly what's on their disk and can clear it without uninstalling the app.

---

## 19. File System & Persistence

### 19.1 Where things live (desktop)

| Path | Contents |
|---|---|
| `<userdata>/rwanga/settings.json` | User-level settings |
| `<userdata>/rwanga/keybindings.json` | User-level keybindings |
| `<userdata>/rwanga/themes/` | User-authored themes |
| `<userdata>/rwanga/samples/` | Bundled sample scripts (initialized on first launch) |
| `<userdata>/rwanga/recents.json` | Recent workspaces + recent scripts |
| `<userdata>/rwanga/autosave/` | Autosave shadow copies (TTL: 7 days; configurable) |
| `<userdata>/rwanga/sessions/` | Script-session brain caches (TTL: 30 days) |
| `<userdata>/rwanga/logs/` | App logs (rotated, 10MB max retained) |
| `<workspace>/.rwanga-workspace/` | Workspace-level state |
| `<workspace>/*.rga` | Scripts |

### 19.2 Atomic saves

Every `.rga` save is atomic: write to `*.rga.tmp`, fsync, rename over the target. Never leave a half-written file. Autosave shadow lives at `<workspace>/.rwanga-workspace/autosave/<scriptname>-<timestamp>.rga`.

### 19.3 Crash recovery

On launch, if any autosave shadow is newer than its source `.rga`, the welcome view surfaces a "Recover unsaved changes?" banner per affected script. Recovery is non-destructive — it opens both versions side-by-side as separate tabs and lets the user choose.

### 19.4 Web build (Rwanga editor in a browser, deferred)

The web build uses the File System Access API (where supported) for desktop-like file handles. Persistence falls back to IndexedDB for browsers without FSA. The shell does not assume disk presence; the platform-portable `window.rwanga.*` IO contract abstracts this away.

---

## 20. State Management (where shell state lives)

A clear ledger of where each kind of state lives. This is critical: shell bugs in v01 will mostly be state-ownership confusion.

The shell uses a **four-layer ownership model** (post-Slice-2 correction; original three-layer model in Slice-1 plan §2.5 gained the dedicated analytics layer below):

| Layer | Owner module | What it owns | Persistence |
|---|---|---|---|
| **Document truth** | PM `EditorState` (engine) | Doc content, selections, marks, history | `.rga` files |
| **Shell truth** | `Rga.Shell.Layout` | Window-chrome state (zone visibility / dimensions / active panel + tab) | Workspace `layout.json` (Slice 4) |
| **Writer-context truth** | `Rga.ScriptSession` | Where the writer is right now — activeScript / currentScene / currentPage / currentView / currentSelection / openPanels / activePanel | Workspace `session.json` (Slice 4 — session restore) |
| **Derived analytics** *(NEW)* | `Rga.ScriptMetrics` | Derived analytic measurements of the script — wordCount, currentBlockType, future: dialogueWords / actionWords / sceneCount / estimatedRuntime | None (always re-derived) |

`Rga.ScriptSession` and `Rga.ScriptMetrics` are both **derived aggregators** that read from PM doc + engine APIs + Layout; neither owns primary state. Splitting them keeps two concerns separate:

- **Writer context** answers *"where am I and how am I working right now?"* — position-and-navigation, the answers the writer wants on the status bar's left side.
- **Derived analytics** answers *"what does this script measure as right now?"* — counts and structural-shape values, the answers tools (Story Progress, future Statistics, future Story Intelligence) consume.

Mixing them, as Slice 2 originally did, would let metrics fields creep onto ScriptSession until the writer-context surface became a junk drawer of "everything we ever computed from the doc." Two namespaces; one purpose each.

Full per-state ledger:

| State | Owner | Persisted? |
|---|---|---|
| Active view mode (Flow/Draft/PrintPreview) | `Rga.ViewManager` | No (per session) |
| Current editor selection | PM `EditorState` | No |
| Current scene index, page count, notes, flags | `Rga.Nav` plugin state (derived from doc) | No (derived) |
| Render model | `Rga.RenderModel` (derived per call) | No |
| Compatibility / future-mode flags | `Rga.RuntimeProfile` | No (per session) |
| Open tabs + their order | Tab manager (shell) | Yes — workspace `session.json` |
| Active tab | Tab manager (shell) | Yes — workspace `session.json` |
| Sidebar visibility + width | `Rga.Shell.Layout` (shell) | Yes — workspace `layout.json` |
| Active sidebar panel | `Rga.Shell.Layout` (shell) | Yes — workspace `layout.json` |
| Studio Panel visibility + height + active tab | `Rga.Shell.Layout` (shell) | Yes — workspace `layout.json` |
| Writer's current scene / current page / active view / active panel | `Rga.ScriptSession` (derived) | Snapshot only — Slice 4 session.json |
| Word count, current block type at cursor, future analytics | `Rga.ScriptMetrics` (derived) | Never persisted — always re-derived |
| Theme selection | Settings manager (shell) | Yes — user `settings.json` |
| Keybindings (overrides) | Settings manager (shell) | Yes — user / workspace `keybindings.json` |
| Recent workspaces | Recents manager (shell) | Yes — user `recents.json` |
| Toast queue + inbox | Notifications manager (shell) | Inbox only (per session for transient) |
| Auth state (signed in / Pro) | Account manager (shell) | Yes — user `auth.json` (token), refreshed |

**Rule:** no shell-level state may live in DOM attributes. A future audit should grep for shell `dataset.*` reads and prove each is for rendering, not source-of-truth.

**Cross-layer reads:**
- `ScriptMetrics` may read from PM state + engine APIs (`Rga.Nav.getOutline().statistics.words` etc.) — same posture as ScriptSession.
- Consumers (Status Bar, Outline → Story Progress's word/page-count display, future Statistics panel, future Story Intelligence) read from `ScriptMetrics`.
- `ScriptMetrics` never reads from `ScriptSession`. They are siblings, not a parent/child pair — analytics doesn't depend on writer-context.
- `ScriptSession` never reads from `ScriptMetrics` either. If a writer-context field would need an analytics value, that's a sign the field belongs on the analytics side.

---

## 21. Integration with the Locked Engine

The shell consumes these engine APIs. Anything not listed here is engine-internal and the shell must not touch it.

| Engine API | Used by |
|---|---|
| `Rga.Editor.mount(container, opts)` | Tab manager (mounts the canonical view on tab activation) |
| `Rga.Editor.emptyDoc(schema)` | New-script flow |
| `Rga.Doc.deserialize / serialize / create` | File manager |
| `Rga.DocTypes.detect / selectSchema` | (indirectly via deserialize) |
| `Rga.Migrations.migrate` | (indirectly via deserialize) |
| `Rga.Nav.getIndex(state)` | Scenes panel, Outline panel, Status bar, Breakdown tab |
| `Rga.Nav.getOutline(state)` | Outline panel |
| `Rga.Nav.getPageMap(state)` | Status bar (page count), Outline statistics |
| `Rga.Nav.findScene(doc, nodeId)` | Scenes panel (drag-reorder, navigation) |
| `Rga.RuntimeProfile.{current, set, isCompatibilityMode}` | Settings (future-mode toggles) |
| `Rga.ViewManager.{register, activate, deactivate, current, isActive, onChange}` | View-mode toggles, status bar |
| `Rga.RenderModel.build` | (consumed indirectly by print preview) |
| `Rga.PrintPreview.{show, hide, isActive, buildModel}` | View-mode toggle button → Print Preview |
| `Rga.Annotations / Rga.Tags / Rga.RevisionFlags` | Right-click menu, Notes tab, Flags tab, Breakdown tab |

**Shell-introduced wrappers:** the shell may introduce helper namespaces like `Rga.Shell.Tabs`, `Rga.Shell.Layout`, `Rga.Shell.Notifications`, `Rga.Shell.Settings`, plus the two derived aggregators **`Rga.ScriptSession`** (writer context) and **`Rga.ScriptMetrics`** (derived analytics) — these all live in the shell layer and never become engine APIs.

---

## 22. Roadmap & Phasing

A high-level sketch only. Each item below would become its own phase with its own contract when work begins.

### v0.1 (foundational shell)

1. Window + zones (title bar with identity avatar, activity rail, sidebar shell, editor area shell, Studio Panel shell, status bar).
2. Tab manager (single editor group, multi-tab, dirty state).
3. Command palette (commands mode + scenes mode + characters mode — palette mode only; full Characters panel comes in v0.2).
4. Scenes panel.
5. Outline panel.
6. Script Workspace Explorer (basic — categorized list + open; asset linking deferred).
7. Settings tab (UI mode + JSON mode).
8. Themes (Paper Light + Paper Dark + Studio Dark + High Contrast).
9. Workspaces (open / new / recent).
10. Notifications (toasts).
11. Welcome view + 3-minute tour.
12. Status bar (all segments).
13. Keyboard shortcuts page.
14. Title-bar identity avatar (signed-in popover + signed-out invite — see §3.6).
15. Accessibility audit pass 1 (screen reader + keyboard-only + high contrast).

### v0.2 (depth)

1. Editor splits (multi-group, drag-to-split).
2. Search panel (cross-script find + replace).
3. **Revisions panel** — Snapshots / Compare Drafts / Version History (writer-facing UI over internal Git; never the word "commit" — see §5.5).
4. **Characters panel** — appearances, dialogue counts, scene presence, co-appearance (see §5.6).
5. Asset-to-scene linking in Script Workspace Explorer (drag asset → scene = link chip in Studio Panel).
6. Breakdown tab in Studio Panel.
7. Cache Management UI.
8. Help drawer (Cmd-?) with searchable shortcuts + how-tos.
9. Notification inbox.
10. Auto-update flow (with the SignPath signing prerequisite — see memory `project_signpath_prep_plan`).

### v0.3 (Pro hooks)

1. Identity avatar — full Pro-aware popover (entitlement badge, manage subscription, sync controls — see §3.6 surface spec).
2. Sync engine + Pro entitlement gating.
3. AI command surfaces inside the palette (one-shot actions, not chat).
4. AI chat panel (in the Studio Panel as a 6th tab).
5. Character intelligence first wave — voice consistency check, speech-pattern profile, casting sides export (see §5.6 "future character intelligence" table).

### v0.4+ (deferred, listed so they don't surprise us)

- Cloud workspaces.
- Per-workspace AI brain (Script = Session, per memory).
- Voice dictation into the editor.
- Vim mode plugin.
- Extension API (if community demands).
- Web build of Rwanga editor.

### Cross-cutting commitments (every phase)

- Accessibility audit gate before each phase ships.
- i18n completeness check (all new strings in en/ku/ar before merge).
- Local-only assets audit.
- Privacy review (any new network call documented).

---

## 23. Open Questions

Real decisions still to make. Each is a one-paragraph statement of the choice; none are answered here.

1. **Framework choice.** Vanilla JS (matches the engine layer, smaller bundle, no churn) vs a small framework (Preact, Solid, Lit — better long-term ergonomics for the shell's nested state). Recommendation pending; lean **vanilla** to start, given the engine is vanilla and the shell's state lives mostly in `.json` files anyway.
2. **Tab persistence across crashes.** If Rwanga crashes mid-edit, do we reopen all tabs at next launch, or just the previously-active one? Recommendation: **all of them**, but every tab is restored read-only with a "Continue editing" prompt — protects against re-crashing on the same bad input.
3. **Settings UI vs JSON precedence.** When the user has both UI-edited and hand-edited the same key in the same session, which wins? VSCode favors last-write. Recommendation: **last-write** with a toast notification of the override.
4. **Default sidebar visibility.** Sidebar open at first launch, or closed? Recommendation: **open**, with Scenes active, so the writer sees the navigator immediately. Power users will close it.
5. **AI-in-palette discoverability.** Should AI commands appear in the unprefixed palette by default, or only under a `%` prefix? Recommendation: **`%` prefix** by default; setting to opt-in to unprefixed surfacing. Calm-by-default principle.
6. **Welcome view: skippable?** A "Don't show welcome" checkbox? Recommendation: **yes**, with the welcome always reachable via Cmd-K "Show welcome".
7. **Theme contrast guarantees.** Do we ship Paper Light at AA only or attempt AAA? Recommendation: **AA for the default; AAA only on the High Contrast variants.** Holding the default to AAA forces ink-black on stark white, which fights the paper metaphor.
8. **Workspace-less startup.** When no recent workspace and no script argument, where do we land? Recommendation: **Welcome view with the New / Open / Sample actions front-and-center.**
9. **RTL palette ordering.** In RTL mode, does the command palette flip its prefix UI (`>` on the right)? Recommendation: **yes** — full RTL mirroring, not selective.
10. **Telemetry.** What's the minimum opt-in telemetry that meaningfully helps us, vs the maximum the privacy principle allows? Recommendation: **app launch + crash reports + feature first-use, opt-in at first launch, never per-keystroke or per-script anything.** Plain-English explanation in the consent dialog.

---

## 24. Glossary

| Term | Definition |
|---|---|
| **Workspace** | A folder containing one or more scripts + a `.rwanga-workspace/` sibling carrying per-workspace settings, layout, and session. |
| **Script** | A single `.rga` file. The unit of writing focus (per memory `project_script_equals_session`). |
| **Tab** | A reference to one open script (or to a Settings tab, Welcome tab, etc.) shown in the editor area's tab bar. |
| **Activity rail** | The 48px left-edge column of mode-switcher icons. Hosts workspace activities only — identity is in the title bar. |
| **Sidebar** | The variable-content panel hosted by the activity rail. |
| **Editor area** | The main content area where the PM editor (or Settings, or Welcome) renders. |
| **Studio Panel** | The collapsible drawer at the bottom of the editor area. **Canonical internal name** (state keys / code / class names: `studioPanel`, `.rga-studio-panel`). UI label may currently read "Bottom Panel" — see §7. |
| **Bottom Panel** | Current user-facing label for the Studio Panel. Cosmetic only; switching to "Studio Panel" in the UI is a future copy change. |
| **Status bar** | The 22px bottom strip with document-context and app-context segments. |
| **Command palette** | The Cmd-K overlay for search-and-act across the app. |
| **Identity (avatar)** | The title-bar surface that owns sign-in / sign-out / Pro entitlement / sync controls — see §3.6. Distinct from "Account" the section because identity is an *anchor*, not a workspace activity. |
| **Script Workspace** (Explorer) | The writer's home in the workspace — scripts plus references, PDFs, images, storyboards, notes, locations. Categorized by file type, not a literal file tree. See §5.3. |
| **Snapshot** | A point-in-time saved version of a script. Internally a Git commit; the word "commit" never appears in writer-facing UI. See §5.5. |
| **Draft** | A named snapshot (e.g. "Draft 3 — table-read version"). Promoted from a snapshot via "Mark as current draft." Internally a Git branch label. See §5.5. |
| **Revision** | A change between two snapshots. Used in compound terms: "show revisions since last week", "Compare Drafts" (a diff between two snapshots). See §5.5. |
| **Version History** | The reverse-chronological list of snapshots for a script. The Revisions panel surfaces this. |
| **Characters panel** | A planned (v0.2) first-class sidebar surface for the script's cast — appearances, dialogue counts, scene presence, relationships, and (v0.3+) character intelligence. See §5.6. |
| **View mode** | One of Flow (default editable), Draft (chrome-free editable), Print Preview (fixed paper sheets, read-only). Owned by `Rga.ViewManager`. |
| **Scene** | A v3 PM `scene` structural node. Identified by stable `nodeId`; rendered with a derived `sceneNumber`. |
| **Pro** | Paid tier. Defined by network-crossing features (sync, AI, cloud workspaces). Local editing is free forever. |
| **Compatibility mode** | A `Rga.RuntimeProfile` field, reserved for future-mode use (e.g. safeMode). In Phase 9+ does not change deserialize behavior; v3 is the only path. |
| **Script-session brain** | Per-script TTL-cached AI context (per memory `project_script_equals_session`); part of the per-script state, not user-global. |
| `Rga.ScriptSession` | **Writer-context-truth** ownership layer. Holds the aggregated snapshot of "where is the writer right now?" — activeScript / currentScene / currentPage / currentView / currentSelection / openPanels / activePanel. Derived from PM doc + Layout + ViewManager + Sidebar; never owns primary state. One subscription channel for all writer-context consumers (Scene Navigator, Status Bar, Title Bar, future continuity / focus / AI context / session restore). |
| `Rga.ScriptMetrics` | **Derived-analytics-truth** ownership layer (post-Slice-2 architectural correction — split out of `ScriptSession`). Holds derived analytical measurements of the script — wordCount, currentBlockType (Slice 2 initial), with reserved future fields: dialogueWords, actionWords, sceneCount, estimatedRuntime. Sibling of `ScriptSession`, not a child; analytics doesn't depend on writer-context, and writer-context doesn't read analytics. Consumers: Status Bar's wordCount + blockType segments, Outline's statistics displays, future Statistics panel, future Story Intelligence surfaces. Never persisted — always re-derived. |

---

## 25. Document maintenance

This master plan is a **living document** for the shell era. Every shell phase contract should reference it. When a phase introduces a real decision that contradicts something here, the contradicting section gets updated in the same PR (not in a follow-up "we'll fix the doc later").

When in doubt about a shell-level question, the order of authority is:

1. Locked editor engine APIs (Phase 0 contract + Phase 9 retirement state).
2. This master plan.
3. The principles in §2.
4. User feedback memory (`feedback_*.md` in `/memory/`).
5. The phase contract being implemented at the time.

When two of these conflict, the higher-numbered one defers. When this document needs to be wrong, it's a sign the architecture has shifted and the doc needs revising before the work proceeds.

End of master plan.
