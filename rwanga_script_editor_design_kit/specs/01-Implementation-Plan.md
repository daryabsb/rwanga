# Rwanga Script Editor — Implementation Plan

## 1. Executive Summary

The Rwanga Script Editor (RSE) is a professional screenplay authoring tool modeled after VS Code/Cursor, but purpose-built for directors and screenwriters. It replaces generic word processors with a structured, tag-aware, scene-managed writing environment. The editor saves to a proprietary `.rga` format (JSON internally), supports manual tagging of screenplay entities, and enforces industry-standard formatting automatically.

**Core analogy:** VS Code is to programming languages what RSE is to screenplay format.

---

## 2. Product Architecture

### 2.1 System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        MENU BAR                                  │
│  File │ Edit │ View │ Script │ Tags │ Export │ Help              │
├────┬───────────┬──────────────────────────────┬──────────────────┤
│    │           │  Tab Bar                     │                  │
│ A  │           │  [Script1.rga] [Draft.md] [+]│                  │
│ C  │  SIDEBAR  ├──────────────────────────────┤   INSPECTOR      │
│ T  │           │                              │   PANEL          │
│ I  │ Changes   │   MAIN EDITOR               │   (toggleable)   │
│ V  │ based on  │   (Writing Surface)          │                  │
│ I  │ Activity  │                              │  - Tag props     │
│ T  │ Bar       │   contenteditable            │  - Scene meta    │
│ Y  │ selection │   with block management      │  - Entity notes  │
│    │           │   and tag highlighting        │                  │
│ B  │           │                              │                  │
│ A  │           │                              │                  │
│ R  │           │   Gutter │ Content           │                  │
├────┴───────────┼──────────────────────────────┴──────────────────┤
│                │  BOTTOM PANEL                                   │
│                │  [Notes] [Problems] [Breakdown]                 │
├────────────────┴─────────────────────────────────────────────────┤
│  STATUS BAR                                                      │
│  ● Synced │ Scene 3/12 │ 4,231 words │ 42 pages │ Dark │ EN    │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Zone Definitions

| Zone | Width | Purpose |
|------|-------|---------|
| **Activity Bar** | 48px fixed | Icon strip: Explorer, Scenes, Tags, Sync, Extensions |
| **Sidebar** | 260px default, resizable, collapsible | Context panel based on active icon |
| **Main Editor** | Flex remaining | Writing surface with tabs, gutter, contenteditable |
| **Inspector Panel** | 280px default, toggleable | Entity/scene properties, notes |
| **Bottom Panel** | 200px default, collapsible | Notes, Problems, Breakdown tabs |
| **Status Bar** | 24px fixed | Sync, scene count, word count, page estimate, theme, language |
| **Menu Bar** | 32px fixed | Application menus |

### 2.3 Technology Stack (for prototype)

- **Rendering:** Pure HTML5 + CSS3 + Vanilla JavaScript (ES6+)
- **Editor Surface:** `contenteditable="true"` div with custom block management
- **State:** In-memory JS objects, localStorage for persistence in prototype
- **Icons:** Inline SVG (Codicons-style, matching VS Code visual language)
- **Fonts:** System UI for chrome, Courier Prime for editor surface
- **No frameworks** — pure vanilla for maximum control over contenteditable behavior

---

## 3. File Format Specification (.rga)

### 3.1 Format Overview

- Extension: `.rga` (Rwanga)
- Internal format: JSON (UTF-8)
- MIME type: `application/x-rwanga-script`
- Draft formats before save: `.txt`, `.md`

### 3.2 Schema (v1.0)

```json
{
  "rga_version": "1.0",
  "metadata": {
    "title": "Untitled Script",
    "author": "Writer Name",
    "created": "2026-05-11T10:00:00Z",
    "modified": "2026-05-11T14:30:00Z",
    "version": 1,
    "revision_notes": "",
    "language": "en",
    "genre": "",
    "logline": ""
  },
  "settings": {
    "theme": "dark",
    "font_size": 12,
    "show_scene_numbers": true,
    "custom_tag_colors": {}
  },
  "scenes": [
    {
      "id": "scene-uuid-001",
      "number": 1,
      "setting": "INT",
      "location": "CAFÉ",
      "time": "NIGHT",
      "notes": "Opening scene — establish mood",
      "elements": [
        {
          "id": "el-uuid-001",
          "type": "action",
          "text": "A dimly lit café. Rain streaks the windows.",
          "tags": [
            { "start": 15, "end": 19, "tag_id": "tag-uuid-cafe", "type": "location" }
          ]
        },
        {
          "id": "el-uuid-002",
          "type": "character",
          "text": "SARAH"
        },
        {
          "id": "el-uuid-003",
          "type": "dialogue",
          "text": "I've been waiting for an hour.",
          "tags": []
        },
        {
          "id": "el-uuid-004",
          "type": "parenthetical",
          "text": "(checking her watch)"
        }
      ]
    }
  ],
  "tag_registry": {
    "characters": [
      { "id": "tag-uuid-sarah", "name": "SARAH", "color": "#4FC1FF", "notes": "" }
    ],
    "props": [],
    "wardrobe": [],
    "locations": [
      { "id": "tag-uuid-cafe", "name": "CAFÉ", "color": "#4EC9B0", "notes": "" }
    ],
    "sfx": [],
    "vfx": [],
    "vehicles": [],
    "animals": [],
    "custom": []
  },
  "export_settings": {
    "branding": "rwanga",
    "letterhead_url": null,
    "include_scene_numbers": true,
    "include_revision_marks": false
  }
}
```

---

## 4. Feature Specifications

### 4.1 Screenplay Block Types

| Block Type | Formatting | Tab Order | Enter → Next |
|------------|-----------|-----------|--------------|
| **Scene Header** | Structured widget: `#N - INT/EXT - LOCATION - TIME` | 1 | Action |
| **Action** | Full width, regular case | 2 | Action (or Character if UPPERCASE) |
| **Character** | Centered, UPPERCASE, 3.7" indent | 3 | Dialogue |
| **Dialogue** | Centered, 2.5" indent, regular case | 4 | Action |
| **Parenthetical** | 3.1" indent, italic, in parens | 5 | Dialogue |
| **Transition** | Right-aligned, UPPERCASE (CUT TO:, FADE OUT) | 6 | Scene Header |
| **Shot** | Left-aligned, UPPERCASE (CLOSE UP, WIDE SHOT) | 7 | Action |

### 4.2 Scene Header Widget (Structured Input)

When a scene header is active/focused, it renders as an inline form:

```
[#3] [▼ INT] [CAFÉ_____________] [▼ NIGHT]
 ↑       ↑          ↑                ↑
 Auto    Dropdown   Text field       Dropdown
 number  INT/EXT    w/ autocomplete  Time of Day
```

When the header loses focus, it renders as formatted text:
```
#3 — INT. CAFÉ — NIGHT
```

**INT/EXT Options:** INT, EXT, INT/EXT, EXT/INT
**Time Options:** DAY, NIGHT, DAWN, DUSK, MORNING, EVENING, AFTERNOON, CONTINUOUS, LATER, SAME TIME, MOMENTS LATER

This structured approach ensures:
- No malformed headers (parsed data from the start)
- Dropdown values prevent typos
- Location field builds autocomplete dictionary
- Clean data for production breakdown downstream

### 4.3 Tag System

**Default Tag Types & Colors (Dark Theme / Light Theme):**

| Tag Type | Dark Color | Light Color | Description |
|----------|-----------|-------------|-------------|
| Character | `#4FC1FF` | `#0070C0` | Named characters |
| Prop | `#FFB347` | `#D48000` | Physical objects |
| Wardrobe | `#C586C0` | `#9B30FF` | Clothing, costumes |
| Location | `#4EC9B0` | `#008060` | Places mentioned in action |
| SFX | `#F44747` | `#CC0000` | Sound effects |
| VFX | `#FF79C6` | `#D63384` | Visual effects |
| Vehicle | `#56B6C2` | `#0D6EFD` | Cars, boats, etc. |
| Animal | `#D19A66` | `#8B5E3C` | Animals in scene |
| Makeup | `#E06C9F` | `#C71585` | Makeup, prosthetics |
| Music | `#7C6EF6` | `#5B21B6` | Musical cues |
| Custom | User-defined | User-defined | Writer-created categories |

**Tagging Flow:**
1. Select text in editor → Right-click → "Tag As" submenu
2. Choose tag type → text becomes highlighted with tag color
3. Tag appears in Tags sidebar under its category
4. If text matches existing tag, option to "Link to existing" or "Create new"
5. All instances of tagged entity get highlighted (writer confirms each)

**Tag Rendering:** Inline colored background highlight with subtle border-bottom. On hover, tooltip shows tag type and linked entity name.

### 4.4 Sidebar Panels

**Panel 1 — Explorer (File Tree)**
- Project folders and script files
- File icons: .rga (custom icon), .txt, .md, .pdf
- Right-click: New Script, New Folder, Rename, Delete
- Drag-and-drop reorder

**Panel 2 — Scenes (Scene Navigator)**
- Ordered list of all scenes extracted from editor
- Format: `#1 INT. CAFÉ — NIGHT`
- Click to scroll editor to that scene
- Scene count badge in section header
- Drag-and-drop to reorder scenes (reorders content in editor)
- Collapsible scene summaries (first line of action)

**Panel 3 — Tags (Tag Manager)**
- Grouped by tag type (Characters, Props, Wardrobe, etc.)
- Each group collapsible, shows count badge
- Click entity → Inspector shows details + all occurrences
- Right-click entity → Rename, Change Color, Delete, Merge
- "+" button to create custom tag type
- Search/filter bar at top

**Panel 4 — Rwanga Sync**
- Login/Account section (if not logged in, show sign-in prompt)
- Version history list (date, author, revision note)
- Push/Pull buttons
- Diff viewer (show changes between versions)
- Status: Synced / Local Changes / Conflict

**Panel 5 — Extensions**
- AI/MCP extensions list
- Status badges: Installed, Available, Locked (Pro)
- For free tier: extensions visible but grayed with "Upgrade to Pro" badge
- v2.0 feature — show placeholder cards for Claude, ChatGPT, etc.

### 4.5 Bottom Panel Tabs

**Notes Tab**
- Linked to current scene (auto-switches when cursor moves to new scene)
- Header: "Notes — Scene #3"
- Textarea for free-form notes per scene
- Notes stored in `.rga` file under each scene's `notes` field

**Problems Tab**
- Real-time validation warnings
- Severity levels: Error (red), Warning (yellow), Info (blue)
- Examples:
  - ERROR: "Scene #4 — header text found in scene body (did you mean to create a new scene?)"
  - WARNING: "Line 34 — Shift+Enter used. Screenplay format requires Enter for new elements."
  - WARNING: "Scene #2 — Character 'JOHN' appears in dialogue but is not tagged."
  - INFO: "Scene #5 — No action block before dialogue."
- Click a problem → editor jumps to the line

**Breakdown Tab (v1.5)**
- Auto-generated production breakdown table
- Columns: Element, Type, Scenes
- Shows all tagged entities grouped by type, with scene occurrence counts

### 4.6 Command Palette

Trigger: `Ctrl+Shift+P` (Windows) / `Cmd+Shift+P` (Mac)

Quick search across all commands:
- `Go to Scene...` → scene picker
- `Tag Selection As...` → tag type picker
- `Toggle Theme` → switch dark/light
- `New Scene` → insert scene header at cursor
- `Export as PDF`
- `Export as DOCX`
- `Save As...`
- `Change Block Type` → block type picker
- `Find & Replace`
- `Show All Characters`
- `Toggle Sidebar`
- `Toggle Inspector`
- `Toggle Bottom Panel`

### 4.7 Keyboard Shortcuts

| Action | Windows | Mac |
|--------|---------|-----|
| New Script | Ctrl+N | Cmd+N |
| Open Script | Ctrl+O | Cmd+O |
| Save | Ctrl+S | Cmd+S |
| Save As | Ctrl+Shift+S | Cmd+Shift+S |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z | Cmd+Shift+Z |
| Find | Ctrl+F | Cmd+F |
| Replace | Ctrl+H | Cmd+H |
| Command Palette | Ctrl+Shift+P | Cmd+Shift+P |
| Quick Scene Jump | Ctrl+P | Cmd+P |
| Cycle Block Type | Tab | Tab |
| Reverse Cycle Block | Shift+Tab | Shift+Tab |
| New Block | Enter | Enter |
| Toggle Sidebar | Ctrl+B | Cmd+B |
| Toggle Inspector | Ctrl+Shift+I | Cmd+Shift+I |
| Toggle Bottom Panel | Ctrl+J | Cmd+J |
| Toggle Theme | Ctrl+Shift+T | Cmd+Shift+T |
| Bold (in action/dialogue) | Ctrl+B | Cmd+B |
| Italic (in action/dialogue) | Ctrl+I | Cmd+I |

### 4.8 Export & Branding

**PDF Export:**
- Industry-standard screenplay format (Courier 12pt, correct margins)
- Free tier: Rwanga logo in header/footer
- Paid tier: Custom letterhead/logo or no branding
- Page numbers in top-right
- Scene numbers in margin
- Title page auto-generated from metadata

**DOCX Export:**
- Same formatting as PDF but editable
- Styles mapped to Word styles (Normal, Heading, Character, Dialogue, etc.)

**TXT Export (Draft):**
- Plain text, no formatting
- Scene headers preserved as text
- Indentation preserved with spaces

**MD Export (Draft):**
- Markdown formatting
- Scene headers as `## #1 — INT. CAFÉ — NIGHT`
- Character names as `**SARAH**`
- Parentheticals as `*(checking her watch)*`

### 4.9 i18n Strategy

- Default: English
- All UI strings stored in locale JSON files
- `i18n.t('key')` function for all text
- RTL layout flips when Kurdish/Arabic locale selected
- Editor surface supports both LTR and RTL regardless of UI language
- Scene header keywords localized:
  - EN: INT / EXT
  - KU: ناوەوە / دەرەوە
  - AR: داخلي / خارجي

### 4.10 Theme System

Two themes: Dark (default) and Light. Toggle in status bar or command palette.

All colors defined as CSS custom properties on `:root` / `[data-theme="light"]`.
Theme preference persisted in localStorage and in `.rga` settings.

---

## 5. Business Model in UI

| Feature | Free | Pro | Max |
|---------|------|-----|-----|
| Full editor functionality | ✅ | ✅ | ✅ |
| Unlimited scripts | ✅ | ✅ | ✅ |
| All tag types + custom tags | ✅ | ✅ | ✅ |
| Export PDF/DOCX (Rwanga brand) | ✅ | ✅ | ✅ |
| Export PDF/DOCX (custom brand) | ❌ | ✅ | ✅ |
| Export PDF/DOCX (no brand) | ❌ | ✅ | ✅ |
| Rwanga Sync (3 scripts) | ✅ | ✅ | ✅ |
| Rwanga Sync (unlimited) | ❌ | ✅ | ✅ |
| Version History (last 5) | ✅ | ✅ | ✅ |
| Version History (unlimited) | ❌ | ✅ | ✅ |
| AI/MCP Extensions | ❌ | ✅ | ✅ |
| Team Collaboration | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |

---

## 6. Implementation Phases

### Phase 1 — Application Shell (Foundation)
**Goal:** Empty but functional VS Code-like shell with all panels and resizers.

| Task | Priority | Dependencies |
|------|----------|-------------|
| 1.1 HTML skeleton: menu bar, activity bar, sidebar, editor area, bottom panel, status bar | P0 | None |
| 1.2 CSS theme system with dark/light custom properties | P0 | None |
| 1.3 Activity bar icons and panel switching | P0 | 1.1 |
| 1.4 Resizable panel dividers (drag to resize sidebar, bottom panel, inspector) | P1 | 1.1 |
| 1.5 Collapsible panels (sidebar, bottom, inspector toggle) | P1 | 1.1, 1.4 |
| 1.6 Theme toggle in status bar | P0 | 1.2 |
| 1.7 Menu bar with dropdowns (non-functional items OK) | P1 | 1.1 |

### Phase 2 — Editor Surface (Core)
**Goal:** Functional contenteditable with block type management.

| Task | Priority | Dependencies |
|------|----------|-------------|
| 2.1 contenteditable div with basic text input | P0 | Phase 1 |
| 2.2 Block type system (action, character, dialogue, parenthetical, transition, shot) | P0 | 2.1 |
| 2.3 Block type CSS styling (indentation, alignment, case transforms) | P0 | 2.2 |
| 2.4 Tab key cycling through block types | P0 | 2.2 |
| 2.5 Context-aware Enter key behavior | P0 | 2.2 |
| 2.6 Gutter with scene numbers | P1 | 2.1 |
| 2.7 Editor font: Courier Prime, 12pt | P0 | 2.1 |
| 2.8 Block type indicator in status bar | P1 | 2.2 |

### Phase 3 — Scene Header System
**Goal:** Structured scene header widget with dropdowns and autocomplete.

| Task | Priority | Dependencies |
|------|----------|-------------|
| 3.1 Scene header inline widget (number, INT/EXT dropdown, location field, time dropdown) | P0 | Phase 2 |
| 3.2 Auto-increment scene numbers | P1 | 3.1 |
| 3.3 Location field autocomplete from existing locations | P1 | 3.1 |
| 3.4 Formatted display when header loses focus | P0 | 3.1 |
| 3.5 Scene parsing and model extraction | P0 | 3.1 |

### Phase 4 — Tag System
**Goal:** Manual tagging with right-click context menu, inline highlights, and tag manager.

| Task | Priority | Dependencies |
|------|----------|-------------|
| 4.1 Text selection detection in editor | P0 | Phase 2 |
| 4.2 Right-click context menu component | P0 | 4.1 |
| 4.3 "Tag As" submenu with all tag types | P0 | 4.2 |
| 4.4 Inline tag highlighting (colored backgrounds) | P0 | 4.3 |
| 4.5 Tag registry (in-memory store) | P0 | 4.3 |
| 4.6 Tag hover tooltips | P1 | 4.4 |
| 4.7 Tag removal (right-click tagged text → "Remove Tag") | P1 | 4.4 |
| 4.8 Custom tag type creation | P1 | 4.5 |
| 4.9 Custom tag color picker | P2 | 4.8 |

### Phase 5 — Sidebar Panels
**Goal:** All five sidebar panels populated and functional.

| Task | Priority | Dependencies |
|------|----------|-------------|
| 5.1 Explorer panel: static file tree UI | P1 | Phase 1 |
| 5.2 Scene Navigator panel: populated from scene parser | P0 | Phase 3 |
| 5.3 Scene Navigator: click to scroll | P0 | 5.2 |
| 5.4 Tag Manager panel: grouped entity lists | P0 | Phase 4 |
| 5.5 Tag Manager: click to show occurrences | P1 | 5.4 |
| 5.6 Sync panel: login UI placeholder | P2 | Phase 1 |
| 5.7 Extensions panel: placeholder cards with Pro badges | P2 | Phase 1 |

### Phase 6 — Bottom Panel & Inspector
**Goal:** Notes, Problems, and Inspector panel functional.

| Task | Priority | Dependencies |
|------|----------|-------------|
| 6.1 Notes tab: per-scene textarea | P1 | Phase 3 |
| 6.2 Problems tab: validation engine | P1 | Phase 2, 3 |
| 6.3 Problems: Shift+Enter detection | P1 | 6.2 |
| 6.4 Problems: malformed scene header detection | P1 | 6.2 |
| 6.5 Problems: click-to-navigate | P1 | 6.2 |
| 6.6 Inspector: tag properties view | P1 | Phase 4 |
| 6.7 Inspector: scene metadata view | P1 | Phase 3 |

### Phase 7 — Tabs & File Operations
**Goal:** Multiple tabs, save/open .rga, export.

| Task | Priority | Dependencies |
|------|----------|-------------|
| 7.1 Tab bar UI with close buttons, dirty indicators | P0 | Phase 2 |
| 7.2 Multiple editor instances (one per tab) | P0 | 7.1 |
| 7.3 Save to .rga (JSON serialization) | P0 | All content phases |
| 7.4 Open .rga (JSON deserialization → editor state) | P0 | 7.3 |
| 7.5 Save As draft (.txt, .md) | P1 | 7.3 |
| 7.6 Export to PDF (HTML-to-PDF, screenplay format) | P1 | 7.3 |
| 7.7 Export to DOCX | P2 | 7.3 |
| 7.8 Rwanga branding in exports | P1 | 7.6 |

### Phase 8 — Command Palette & Keyboard Shortcuts
**Goal:** Full keyboard-driven workflow.

| Task | Priority | Dependencies |
|------|----------|-------------|
| 8.1 Command palette overlay UI | P1 | Phase 1 |
| 8.2 Command registry and fuzzy search | P1 | 8.1 |
| 8.3 Quick scene jump (Ctrl+P) | P1 | Phase 3, 8.1 |
| 8.4 All keyboard shortcuts wired | P1 | All phases |

### Phase 9 — Polish & i18n
**Goal:** Internationalization, accessibility, responsive behavior.

| Task | Priority | Dependencies |
|------|----------|-------------|
| 9.1 i18n system: locale loading, t() function | P2 | All phases |
| 9.2 English locale (complete) | P2 | 9.1 |
| 9.3 Kurdish locale | P2 | 9.1 |
| 9.4 Arabic locale | P2 | 9.1 |
| 9.5 RTL layout flip for KU/AR | P2 | 9.1 |
| 9.6 Accessibility: ARIA labels, keyboard navigation | P2 | All phases |
| 9.7 Notification/toast system | P2 | Phase 1 |

---

## 7. Recommended File Structure

```
rwanga-editor/
├── index.html                    # Main app shell
├── styles/
│   ├── tokens.css                # CSS custom properties (all theme tokens)
│   ├── reset.css                 # Minimal reset/normalize
│   ├── shell.css                 # App layout (activity bar, sidebar, panels)
│   ├── editor.css                # Writing surface, blocks, gutter
│   ├── components.css            # Tabs, buttons, inputs, dropdowns, scrollbars
│   ├── context-menu.css          # Right-click menu
│   ├── command-palette.css       # Command palette overlay
│   └── tags.css                  # Tag highlighting colors
├── scripts/
│   ├── app.js                    # Initialization, event wiring
│   ├── state.js                  # Central state store
│   ├── theme-manager.js          # Theme toggle logic
│   ├── editor-engine.js          # contenteditable management
│   ├── block-manager.js          # Block type detection, formatting, cycling
│   ├── scene-manager.js          # Scene parsing, header widget, navigation
│   ├── tag-system.js             # Tag registry, highlighting, CRUD
│   ├── keyboard-handler.js       # All keyboard intercepts
│   ├── context-menu.js           # Right-click menu rendering
│   ├── command-palette.js        # Palette search and execution
│   ├── sidebar.js                # Panel switching, content rendering
│   ├── tab-manager.js            # Editor tab lifecycle
│   ├── file-manager.js           # Serialize/deserialize .rga, export
│   ├── status-bar.js             # Status bar reactive updates
│   ├── problems.js               # Validation engine
│   ├── inspector.js              # Inspector panel rendering
│   └── i18n.js                   # Internationalization
├── icons/                        # SVG icon files
├── locales/
│   ├── en.json
│   ├── ku.json
│   └── ar.json
└── fonts/
    └── CourierPrime-Regular.ttf   # Editor font
```

---

## 8. Success Criteria

### Alpha (v0.1)
- [ ] VS Code-like shell renders with dark/light theme
- [ ] contenteditable accepts text with block type formatting
- [ ] Tab cycles block types, Enter is context-aware
- [ ] Scene headers render as structured widgets
- [ ] Manual tagging via right-click works
- [ ] Scene navigator sidebar populated and click-navigable
- [ ] Tag manager sidebar shows all tagged entities
- [ ] Save/Load .rga round-trips without data loss

### Beta (v0.5)
- [ ] All sidebar panels functional
- [ ] Bottom panel (Notes, Problems) working
- [ ] Command palette with fuzzy search
- [ ] Export to PDF with Rwanga branding
- [ ] Multiple tabs with independent editor states
- [ ] Inspector panel for tags and scenes

### Release (v1.0)
- [ ] i18n (EN, KU, AR) with RTL support
- [ ] Full keyboard shortcut coverage
- [ ] DOCX export
- [ ] Rwanga Sync panel UI (placeholder for backend)
- [ ] Extensions panel UI (locked, Pro badge)
- [ ] Validation engine catching format errors
- [ ] Performance: smooth with 120+ page scripts

---

*End of Implementation Plan — see `02-Build-Instructions.md` for step-by-step construction guide.*
