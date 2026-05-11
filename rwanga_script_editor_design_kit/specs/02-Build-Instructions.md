# Rwanga Script Editor — Build Instructions

> **Audience:** This document is the step-by-step construction guide for the agent/designer building the Rwanga Script Editor as an HTML prototype. Read `01-Implementation-Plan.md` first for architecture and feature specs. Read `03-Component-Library.md` for all CSS tokens, component styles, and JS class APIs.

---

## 0. Prerequisites & Constraints

- **Output:** A single-page HTML application (or HTML + imported CSS/JS files)
- **No frameworks:** Pure vanilla JS, HTML5, CSS3. No React, Vue, Angular.
- **No bundlers:** Script tags with ES6 modules or classic scripts
- **Font:** Use Google Fonts `Courier Prime` for the editor surface, system stack for UI chrome
- **Icons:** Draw simple inline SVGs or use a minimal icon set. Do NOT use icon font libraries.
- **Browser target:** Modern Chromium (Electron wraps Chromium)
- **RTL awareness:** Use CSS logical properties (`inline-start`, `inline-end`) where possible for future RTL support
- **ContentEditable:** This is the hardest part. Follow instructions precisely.
- **Refer to `03-Component-Library.md`** for all CSS custom properties, component CSS, and JS utilities

---

## 1. Build the Application Shell

The shell is the VS Code-like frame. Build it FIRST as an empty skeleton, then fill panels incrementally.

### 1.1 HTML Structure

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rwanga Script Editor</title>
  <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <!-- Load CSS files -->
</head>
<body>
  <div id="app">
    <!-- 1. Menu Bar -->
    <header id="menu-bar">...</header>

    <!-- 2. Main workspace (everything below menu bar, above status bar) -->
    <div id="workspace">

      <!-- 2a. Activity Bar (leftmost) -->
      <nav id="activity-bar">...</nav>

      <!-- 2b. Sidebar (collapsible) -->
      <aside id="sidebar">
        <div id="sidebar-header">...</div>
        <div id="sidebar-content">
          <div class="sidebar-panel" data-panel="explorer">...</div>
          <div class="sidebar-panel" data-panel="scenes">...</div>
          <div class="sidebar-panel" data-panel="tags">...</div>
          <div class="sidebar-panel" data-panel="sync">...</div>
          <div class="sidebar-panel" data-panel="extensions">...</div>
        </div>
      </aside>

      <!-- 2c. Resize handle: sidebar ↔ editor -->
      <div class="resize-handle" data-resize="sidebar"></div>

      <!-- 2d. Center (editor area + bottom panel) -->
      <div id="center-column">

        <!-- Editor area -->
        <div id="editor-area">
          <div id="tab-bar">...</div>
          <div id="editor-container">
            <div id="gutter">...</div>
            <div id="editor" contenteditable="true" spellcheck="true" data-block-type="action">
              <!-- Content blocks go here -->
            </div>
          </div>
        </div>

        <!-- Resize handle: editor ↔ bottom panel -->
        <div class="resize-handle" data-resize="bottom-panel"></div>

        <!-- Bottom panel -->
        <div id="bottom-panel">
          <div id="bottom-panel-tabs">...</div>
          <div id="bottom-panel-content">...</div>
        </div>

      </div>

      <!-- 2e. Resize handle: editor ↔ inspector -->
      <div class="resize-handle" data-resize="inspector"></div>

      <!-- 2f. Inspector panel (toggleable) -->
      <aside id="inspector-panel">...</aside>

    </div>

    <!-- 3. Status Bar -->
    <footer id="status-bar">...</footer>

    <!-- 4. Overlays -->
    <div id="context-menu" class="overlay-menu" hidden>...</div>
    <div id="command-palette" class="overlay-palette" hidden>...</div>
  </div>
</body>
</html>
```

### 1.2 Layout CSS Strategy

The shell uses CSS Grid for the main layout:

```css
#app {
  display: grid;
  grid-template-rows: var(--menu-bar-height) 1fr var(--status-bar-height);
  height: 100vh;
  overflow: hidden;
}

#workspace {
  display: grid;
  grid-template-columns:
    var(--activity-bar-width)       /* Activity Bar: 48px fixed */
    var(--sidebar-width)            /* Sidebar: 260px default, resizable */
    4px                             /* Resize handle */
    1fr                             /* Center column: flex */
    4px                             /* Resize handle */
    var(--inspector-width);         /* Inspector: 280px, 0 when hidden */
  overflow: hidden;
}

#center-column {
  display: grid;
  grid-template-rows: 1fr 4px var(--bottom-panel-height);
  overflow: hidden;
}

#editor-area {
  display: grid;
  grid-template-rows: var(--tab-bar-height) 1fr;
  overflow: hidden;
}

#editor-container {
  display: grid;
  grid-template-columns: var(--gutter-width) 1fr;
  overflow-y: auto;
}
```

### 1.3 Resize Handles

Resize handles are 4px-wide strips that change cursor on hover and are draggable:

```js
// Resize handle behavior
// On mousedown: record starting position and panel size
// On mousemove: calculate delta, update CSS custom property
// On mouseup: stop tracking

// For sidebar resize:
// Update --sidebar-width on :root via style.setProperty()

// For bottom panel resize:
// Update --bottom-panel-height on :root

// For inspector resize:
// Update --inspector-width on :root

// Minimum sizes: sidebar 180px, bottom-panel 100px, inspector 200px
// Collapse threshold: if dragged below 60px, collapse to 0
```

---

## 2. Activity Bar

A 48px-wide vertical icon strip on the far left. Each icon activates a sidebar panel.

### 2.1 Structure

```html
<nav id="activity-bar">
  <div class="activity-bar-top">
    <button class="activity-icon active" data-panel="explorer" title="Explorer">
      <!-- SVG: file/folder icon -->
    </button>
    <button class="activity-icon" data-panel="scenes" title="Scenes">
      <!-- SVG: clapperboard or film strip icon -->
    </button>
    <button class="activity-icon" data-panel="tags" title="Tags">
      <!-- SVG: tag/label icon -->
    </button>
    <button class="activity-icon" data-panel="sync" title="Rwanga Sync">
      <!-- SVG: cloud/sync icon -->
    </button>
  </div>
  <div class="activity-bar-bottom">
    <button class="activity-icon" data-panel="extensions" title="Extensions">
      <!-- SVG: puzzle piece icon -->
    </button>
    <button class="activity-icon" id="btn-settings" title="Settings">
      <!-- SVG: gear icon -->
    </button>
  </div>
</nav>
```

### 2.2 Behavior

```js
// When an activity icon is clicked:
// 1. Remove .active from all activity icons
// 2. Add .active to clicked icon
// 3. Hide all .sidebar-panel elements
// 4. Show the .sidebar-panel matching data-panel
// 5. Update #sidebar-header text
// 6. If clicking the already-active icon, toggle sidebar collapsed/expanded
```

---

## 3. Theme System

### 3.1 Implementation

Define ALL colors as CSS custom properties. See `03-Component-Library.md` for the complete token list.

```css
:root, [data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d30;
  /* ... all tokens ... */
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f3f3f3;
  --bg-tertiary: #e8e8e8;
  /* ... all tokens ... */
}
```

### 3.2 Toggle Logic

```js
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('rga-theme', next);
  updateStatusBarThemeIndicator(next);
}

// On page load:
const saved = localStorage.getItem('rga-theme') || 'dark';
document.documentElement.setAttribute('data-theme', saved);
```

---

## 4. Editor Tabs

### 4.1 Tab Bar Structure

```html
<div id="tab-bar">
  <div class="tab active" data-tab-id="tab-1">
    <span class="tab-icon"><!-- .rga icon --></span>
    <span class="tab-title">Untitled.rga</span>
    <span class="tab-dirty" hidden>●</span>
    <button class="tab-close" title="Close">×</button>
  </div>
  <button id="tab-new" title="New Tab">+</button>
</div>
```

### 4.2 Tab State Model

```js
// Each tab owns an independent editor state:
const tabState = {
  id: 'tab-1',
  title: 'Untitled.rga',
  filePath: null,          // null = unsaved
  fileType: 'rga',         // 'rga', 'txt', 'md'
  isDirty: false,
  scenes: [],              // Parsed scene objects
  tagRegistry: {},         // Tag store for this document
  editorHTML: '',           // Serialized contenteditable innerHTML
  scrollPosition: 0,
  cursorPosition: null,
  notes: {},               // scene-id → note text
  problems: []             // Validation results
};

// Tab switching:
// 1. Serialize current editor state (innerHTML, scroll, cursor)
// 2. Store in current tab's state object
// 3. Load new tab's state into editor
// 4. Restore scroll and cursor position
// 5. Update sidebar panels (scenes, tags) for new tab's data
```

---

## 5. The Writing Surface (ContentEditable) — CRITICAL SECTION

This is the most complex part. ContentEditable is notoriously difficult. Follow these patterns precisely.

### 5.1 Block Architecture

The editor uses a **block-based model**. Each line/paragraph is a `<div>` with a `data-block-type` attribute. The editor should NEVER contain bare text nodes at the top level.

```html
<div id="editor" contenteditable="true" spellcheck="true">
  <!-- Scene Header (special widget, NOT a simple div) -->
  <div class="editor-block scene-header" data-block-type="scene-header" data-scene-id="scene-001" contenteditable="false">
    <span class="sh-number">#1</span>
    <span class="sh-separator">—</span>
    <select class="sh-setting"><option>INT</option><option>EXT</option>...</select>
    <span class="sh-dot">.</span>
    <input class="sh-location" type="text" value="CAFÉ" placeholder="Location..." />
    <span class="sh-separator">—</span>
    <select class="sh-time"><option>DAY</option><option>NIGHT</option>...</select>
  </div>

  <!-- Action block -->
  <div class="editor-block" data-block-type="action">
    A dimly lit café. Rain streaks the windows. The sound of jazz drifts from a corner speaker.
  </div>

  <!-- Character block -->
  <div class="editor-block" data-block-type="character">
    SARAH
  </div>

  <!-- Dialogue block -->
  <div class="editor-block" data-block-type="dialogue">
    I've been waiting for an hour.
  </div>

  <!-- Parenthetical block -->
  <div class="editor-block" data-block-type="parenthetical">
    (checking her watch)
  </div>

  <!-- Character block -->
  <div class="editor-block" data-block-type="character">
    JOHN
  </div>

  <!-- Dialogue block -->
  <div class="editor-block" data-block-type="dialogue">
    Traffic. You know how it is.
  </div>

  <!-- Transition block -->
  <div class="editor-block" data-block-type="transition">
    CUT TO:
  </div>
</div>
```

### 5.2 Block Type Styling Rules

Apply these CSS rules based on `data-block-type`. Use a centered page model (like a real screenplay page) within the editor area:

```css
.editor-block {
  /* Base: all blocks share these */
  font-family: 'Courier Prime', 'Courier New', monospace;
  font-size: 12pt;
  line-height: 1.5;
  color: var(--text-primary);
  padding: 2px 0;
  outline: none;
  /* Page model: 6" text area within the editor (matching screenplay standard) */
  max-width: 6in;
  margin-left: auto;
  margin-right: auto;
}

/* The editor container itself should feel like a page */
#editor {
  padding: 1in 0;
  min-height: 100%;
  background: var(--editor-bg);
}

[data-block-type="action"] {
  /* Full width within the 6" page, left-aligned */
  padding-left: 1.5in;
  padding-right: 1in;
}

[data-block-type="character"] {
  padding-left: 3.7in;
  text-transform: uppercase;
  color: var(--text-primary);
}

[data-block-type="dialogue"] {
  padding-left: 2.5in;
  padding-right: 2in;
}

[data-block-type="parenthetical"] {
  padding-left: 3.1in;
  padding-right: 2.5in;
  font-style: italic;
  color: var(--text-secondary);
}

[data-block-type="transition"] {
  text-align: right;
  padding-right: 1in;
  text-transform: uppercase;
}

[data-block-type="shot"] {
  padding-left: 1.5in;
  text-transform: uppercase;
  color: var(--tag-color-location);
}

.scene-header {
  /* Scene header has a distinct background band */
  background: var(--scene-header-bg);
  border-left: 3px solid var(--accent-gold);
  padding: 8px 16px;
  margin: 16px 0 8px 0;
  border-radius: 2px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}
```

### 5.3 Block Type Indicator

Show the current block type in the status bar AND as a subtle label at the left edge of the active block:

```js
// On cursor position change (selectionchange event):
function updateBlockTypeIndicator() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const node = sel.anchorNode;
  const block = node.nodeType === 3
    ? node.parentElement.closest('.editor-block')
    : node.closest('.editor-block');

  if (block) {
    const type = block.dataset.blockType;
    // Update status bar
    document.getElementById('status-block-type').textContent = formatBlockTypeName(type);
    // Highlight in gutter
    updateGutterHighlight(block);
  }
}

document.addEventListener('selectionchange', updateBlockTypeIndicator);
```

### 5.4 Tab Key — Block Type Cycling

**CRITICAL:** Prevent default Tab behavior (focus change) inside the editor. Instead, cycle block types:

```js
const BLOCK_TYPE_ORDER = [
  'scene-header', 'action', 'character', 'dialogue',
  'parenthetical', 'transition', 'shot'
];

editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();

    const block = getCurrentBlock(); // helper: find .editor-block at cursor
    if (!block) return;

    const currentType = block.dataset.blockType;
    const currentIndex = BLOCK_TYPE_ORDER.indexOf(currentType);
    const direction = e.shiftKey ? -1 : 1;
    const nextIndex = (currentIndex + direction + BLOCK_TYPE_ORDER.length) % BLOCK_TYPE_ORDER.length;
    const nextType = BLOCK_TYPE_ORDER[nextIndex];

    if (nextType === 'scene-header') {
      // Convert block to scene header widget (complex — see Scene Header section)
      convertToSceneHeader(block);
    } else {
      block.dataset.blockType = nextType;
      block.className = 'editor-block'; // Reset classes
      // Scene header to regular block: extract text, replace widget with div
      if (currentType === 'scene-header') {
        convertFromSceneHeader(block, nextType);
      }
    }

    updateBlockTypeIndicator();
  }
});
```

### 5.5 Enter Key — Context-Aware New Block

```js
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    // BLOCK: Shift+Enter → flag as problem, but allow (insert <br> within block)
    if (e.shiftKey) {
      // Allow default behavior (line break within block)
      // But register a Problem: "Shift+Enter used — screenplay format prefers Enter"
      registerProblem('shift-enter', block, 'Shift+Enter used. Screenplay format requires Enter for new elements.');
      return;
    }

    e.preventDefault();

    const block = getCurrentBlock();
    if (!block) return;

    const currentType = block.dataset.blockType;

    // Determine next block type based on context
    const nextType = getNextBlockType(currentType, block);

    // Split text at cursor if cursor is in middle of block
    const { before, after } = splitBlockAtCursor(block);

    // Current block keeps 'before' text
    block.textContent = before;

    // Create new block with 'after' text
    const newBlock = document.createElement('div');
    newBlock.className = 'editor-block';
    newBlock.dataset.blockType = nextType;
    newBlock.textContent = after;

    block.after(newBlock);

    // Move cursor to start of new block
    setCursorToStart(newBlock);
    updateBlockTypeIndicator();
  }
});

function getNextBlockType(currentType, block) {
  const text = block.textContent.trim();
  switch (currentType) {
    case 'scene-header': return 'action';
    case 'action':
      // If text is ALL CAPS and short, likely a character name
      return (text === text.toUpperCase() && text.length < 40 && text.length > 0)
        ? 'dialogue' // Treat as if it was a character block
        : 'action';
    case 'character': return 'dialogue';
    case 'dialogue': return 'action';
    case 'parenthetical': return 'dialogue';
    case 'transition': return 'scene-header';
    case 'shot': return 'action';
    default: return 'action';
  }
}
```

### 5.6 ContentEditable Hygiene

ContentEditable creates messy HTML. Enforce cleanliness:

```js
// MutationObserver to enforce block structure
const editorObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Prevent bare text nodes at top level
    for (const node of mutation.addedNodes) {
      if (node.nodeType === 3 && node.parentElement === editor) {
        // Wrap in a block
        const wrapper = document.createElement('div');
        wrapper.className = 'editor-block';
        wrapper.dataset.blockType = 'action';
        node.replaceWith(wrapper);
        wrapper.textContent = node.textContent;
      }
      // Prevent <span>, <font>, <b> etc. from paste
      if (node.nodeType === 1 && !node.classList.contains('editor-block') && !node.classList.contains('tag-highlight')) {
        // Flatten to text within parent block
        const text = node.textContent;
        const textNode = document.createTextNode(text);
        node.replaceWith(textNode);
      }
    }
  }
});

editorObserver.observe(editor, { childList: true, subtree: true });

// Paste handler: strip all formatting
editor.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  // Insert as plain text, one block per line
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i === 0) {
      // Insert into current block at cursor
      document.execCommand('insertText', false, line);
    } else {
      // Create new action block for each line
      const block = document.createElement('div');
      block.className = 'editor-block';
      block.dataset.blockType = 'action';
      block.textContent = line;
      // Insert after current cursor block
      const current = getCurrentBlock();
      current.after(block);
    }
  });
});
```

### 5.7 Gutter (Scene Numbers)

The gutter sits to the left of the editor. It displays scene numbers aligned with scene headers.

```js
function updateGutter() {
  const gutter = document.getElementById('gutter');
  gutter.innerHTML = '';

  const blocks = editor.querySelectorAll('.editor-block');
  let currentSceneNumber = 0;

  blocks.forEach(block => {
    const gutterLine = document.createElement('div');
    gutterLine.className = 'gutter-line';
    gutterLine.style.height = block.offsetHeight + 'px';

    if (block.dataset.blockType === 'scene-header') {
      currentSceneNumber++;
      gutterLine.textContent = currentSceneNumber;
      gutterLine.classList.add('gutter-scene-number');
    }

    gutter.appendChild(gutterLine);
  });
}

// Call updateGutter on any content change (use debounce)
// Also call on window resize and scroll sync
```

The gutter must scroll in sync with the editor:
```js
const editorContainer = document.getElementById('editor-container');
const editorEl = document.getElementById('editor');

editorContainer.addEventListener('scroll', () => {
  gutter.style.transform = `translateY(-${editorContainer.scrollTop}px)`;
});
```

---

## 6. Scene Header Widget

Scene headers are NOT simple contenteditable divs. They are structured inline forms embedded within the editor. This is the recommended hybrid approach.

### 6.1 Creating a Scene Header

When the user triggers a new scene header (Tab cycling to scene-header, or typing `#` at the start of an empty block, or via command palette):

```js
function createSceneHeader(afterBlock) {
  const sceneId = generateId('scene');
  const sceneNumber = getNextSceneNumber();

  const header = document.createElement('div');
  header.className = 'editor-block scene-header';
  header.dataset.blockType = 'scene-header';
  header.dataset.sceneId = sceneId;
  header.contentEditable = 'false'; // The widget itself is not contenteditable

  header.innerHTML = `
    <span class="sh-number">#${sceneNumber}</span>
    <span class="sh-separator">—</span>
    <select class="sh-setting">
      <option value="INT">INT</option>
      <option value="EXT">EXT</option>
      <option value="INT/EXT">INT/EXT</option>
      <option value="EXT/INT">EXT/INT</option>
    </select>
    <span class="sh-dot">.</span>
    <input class="sh-location" type="text" placeholder="LOCATION..."
           list="location-suggestions" autocomplete="off" />
    <span class="sh-separator">—</span>
    <select class="sh-time">
      <option value="DAY">DAY</option>
      <option value="NIGHT">NIGHT</option>
      <option value="DAWN">DAWN</option>
      <option value="DUSK">DUSK</option>
      <option value="MORNING">MORNING</option>
      <option value="EVENING">EVENING</option>
      <option value="AFTERNOON">AFTERNOON</option>
      <option value="CONTINUOUS">CONTINUOUS</option>
      <option value="LATER">LATER</option>
      <option value="SAME TIME">SAME TIME</option>
      <option value="MOMENTS LATER">MOMENTS LATER</option>
    </select>
    <button class="sh-menu-btn" title="Scene options">⋯</button>
  `;

  if (afterBlock) {
    afterBlock.after(header);
  } else {
    editor.prepend(header);
  }

  // Focus the location input
  header.querySelector('.sh-location').focus();

  // Register scene in state
  registerScene(sceneId, sceneNumber);

  // Update sidebar
  updateSceneNavigator();

  return header;
}
```

### 6.2 Location Autocomplete

Maintain a `<datalist>` element with all known locations:

```html
<datalist id="location-suggestions">
  <!-- Dynamically populated from all scene locations in the document -->
</datalist>
```

```js
function updateLocationSuggestions() {
  const datalist = document.getElementById('location-suggestions');
  const locations = new Set();

  document.querySelectorAll('.sh-location').forEach(input => {
    if (input.value.trim()) locations.add(input.value.trim().toUpperCase());
  });

  datalist.innerHTML = [...locations]
    .map(loc => `<option value="${loc}">`)
    .join('');
}
```

### 6.3 Scene Header Events

```js
// When scene header fields change, update the scene model:
editor.addEventListener('change', (e) => {
  if (e.target.closest('.scene-header')) {
    const header = e.target.closest('.scene-header');
    const sceneId = header.dataset.sceneId;
    updateSceneModel(sceneId, {
      setting: header.querySelector('.sh-setting').value,
      location: header.querySelector('.sh-location').value,
      time: header.querySelector('.sh-time').value
    });
    updateSceneNavigator();
    updateLocationSuggestions();
  }
});

// Navigate past scene headers with arrow keys:
// When cursor is at end of block ABOVE scene header and Down is pressed,
// or at start of block BELOW and Up is pressed, skip to next editable block.
```

---

## 7. Tag System — CRITICAL SECTION

### 7.1 Tag Data Model

```js
const TAG_TYPES = {
  character:  { label: 'Character',  color: { dark: '#4FC1FF', light: '#0070C0' } },
  prop:       { label: 'Prop',       color: { dark: '#FFB347', light: '#D48000' } },
  wardrobe:   { label: 'Wardrobe',   color: { dark: '#C586C0', light: '#9B30FF' } },
  location:   { label: 'Location',   color: { dark: '#4EC9B0', light: '#008060' } },
  sfx:        { label: 'SFX',        color: { dark: '#F44747', light: '#CC0000' } },
  vfx:        { label: 'VFX',        color: { dark: '#FF79C6', light: '#D63384' } },
  vehicle:    { label: 'Vehicle',    color: { dark: '#56B6C2', light: '#0D6EFD' } },
  animal:     { label: 'Animal',     color: { dark: '#D19A66', light: '#8B5E3C' } },
  makeup:     { label: 'Makeup',     color: { dark: '#E06C9F', light: '#C71585' } },
  music:      { label: 'Music',      color: { dark: '#7C6EF6', light: '#5B21B6' } }
};

// Tag registry (per-document):
// Map<tagId, { id, name, type, color, notes, occurrences: Set<elementId> }>
```

### 7.2 Right-Click Context Menu

```js
// Detect right-click within editor
editor.addEventListener('contextmenu', (e) => {
  e.preventDefault();

  const sel = window.getSelection();
  const hasSelection = sel && !sel.isCollapsed;
  const clickedTag = e.target.closest('.tag-highlight');

  const menu = document.getElementById('context-menu');

  // Build menu items based on context
  let items = [];

  if (hasSelection) {
    const selectedText = sel.toString().trim();
    items.push({
      label: `Tag "${truncate(selectedText, 20)}" as...`,
      submenu: Object.entries(TAG_TYPES).map(([type, info]) => ({
        label: info.label,
        icon: createColorDot(info.color),
        action: () => tagSelection(type, selectedText)
      })).concat([
        { separator: true },
        { label: 'Custom Tag...', action: () => showCustomTagDialog(selectedText) }
      ])
    });
  }

  if (clickedTag) {
    const tagId = clickedTag.dataset.tagId;
    items.push(
      { label: 'View Tag Details', action: () => showTagInInspector(tagId) },
      { label: 'Remove Tag', action: () => removeTag(tagId, clickedTag) },
      { label: 'Change Tag Type...', submenu: /* type options */ },
      { label: 'Rename...', action: () => renameTag(tagId) }
    );
  }

  // Always include:
  items.push(
    { separator: true },
    { label: 'Change Block Type', submenu: BLOCK_TYPE_ORDER.map(type => ({
      label: formatBlockTypeName(type),
      action: () => setBlockType(getCurrentBlock(), type)
    }))},
    { separator: true },
    { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
    { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
    { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') }
  );

  renderContextMenu(menu, items, e.clientX, e.clientY);
});
```

### 7.3 Applying a Tag (Inline Highlight)

When the user tags a selection:

```js
function tagSelection(tagType, text) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const range = sel.getRangeAt(0);

  // Create or find existing tag entity
  let tagEntity = findTagByNameAndType(text, tagType);
  if (!tagEntity) {
    tagEntity = createTagEntity(text, tagType);
  }

  // Wrap selection in a <span class="tag-highlight">
  const span = document.createElement('span');
  span.className = 'tag-highlight';
  span.dataset.tagId = tagEntity.id;
  span.dataset.tagType = tagType;
  span.style.setProperty('--tag-color', getTagColor(tagType));
  span.title = `${TAG_TYPES[tagType].label}: ${tagEntity.name}`;

  range.surroundContents(span);

  // Record occurrence
  tagEntity.occurrences.add(span.closest('.editor-block')?.dataset?.id);

  // Update sidebar
  updateTagManager();

  // Clear selection
  sel.removeAllRanges();
}
```

### 7.4 Tag Highlight CSS

```css
.tag-highlight {
  background: oklch(from var(--tag-color) l c h / 0.18);
  border-bottom: 2px solid var(--tag-color);
  border-radius: 2px;
  padding: 0 2px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.tag-highlight:hover {
  background: oklch(from var(--tag-color) l c h / 0.30);
}
```

Note: Since CSS `oklch(from ...)` relative color syntax may not be universally supported, use JS to compute the rgba background from the tag color:

```js
function getTagHighlightBG(hexColor, opacity = 0.18) {
  const r = parseInt(hexColor.slice(1,3), 16);
  const g = parseInt(hexColor.slice(3,5), 16);
  const b = parseInt(hexColor.slice(5,7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
```

### 7.5 Custom Tag Creation

```js
function showCustomTagDialog(selectedText) {
  // Show a small dialog/modal:
  // - Tag Name (pre-filled with selectedText)
  // - Tag Type dropdown (includes all defaults + "New Type...")
  // - Color picker (preset swatches + custom hex input)
  // On confirm: create tag entity, apply to selection
}
```

---

## 8. Sidebar Panel Contents

### 8.1 Scene Navigator

```html
<div class="sidebar-panel" data-panel="scenes">
  <div class="sidebar-section-header">
    <span>SCENES</span>
    <span class="badge">12</span>
    <button class="sidebar-action" title="Add Scene">+</button>
  </div>
  <div class="scene-list">
    <!-- Dynamically generated -->
    <div class="scene-item active" data-scene-id="scene-001">
      <span class="scene-item-number">#1</span>
      <span class="scene-item-text">INT. CAFÉ — NIGHT</span>
    </div>
    <div class="scene-item" data-scene-id="scene-002">
      <span class="scene-item-number">#2</span>
      <span class="scene-item-text">EXT. STREET — DAY</span>
    </div>
    <!-- ... -->
  </div>
</div>
```

Click behavior:
```js
document.querySelector('.scene-list').addEventListener('click', (e) => {
  const item = e.target.closest('.scene-item');
  if (!item) return;

  const sceneId = item.dataset.sceneId;
  const header = editor.querySelector(`[data-scene-id="${sceneId}"]`);
  if (header) {
    // Scroll editor to scene header
    header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Note: In the actual implementation, use editorContainer.scrollTop
    // calculation instead of scrollIntoView to avoid issues.

    // Highlight active scene in sidebar
    document.querySelectorAll('.scene-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  }
});
```

**IMPORTANT: Do NOT use `scrollIntoView` in the actual implementation.** Instead, calculate the target offset and set `editorContainer.scrollTop` directly:

```js
function scrollToScene(sceneId) {
  const header = editor.querySelector(`[data-scene-id="${sceneId}"]`);
  if (!header) return;
  const container = document.getElementById('editor-container');
  const headerTop = header.offsetTop - container.offsetTop;
  container.scrollTop = headerTop - 20; // 20px padding above
}
```

### 8.2 Tag Manager

```html
<div class="sidebar-panel" data-panel="tags">
  <div class="sidebar-search">
    <input type="text" placeholder="Filter tags..." />
  </div>

  <!-- One section per tag type -->
  <div class="tag-group" data-tag-type="character">
    <div class="tag-group-header" data-collapsed="false">
      <span class="collapse-chevron">▾</span>
      <span class="tag-group-dot" style="background: var(--tag-color-character)"></span>
      <span>Characters</span>
      <span class="badge">4</span>
    </div>
    <div class="tag-group-items">
      <div class="tag-item" data-tag-id="tag-sarah">
        <span class="tag-dot" style="background: #4FC1FF"></span>
        <span class="tag-name">SARAH</span>
        <span class="tag-count">12</span>
      </div>
      <div class="tag-item" data-tag-id="tag-john">
        <span class="tag-dot" style="background: #4FC1FF"></span>
        <span class="tag-name">JOHN</span>
        <span class="tag-count">8</span>
      </div>
    </div>
  </div>

  <!-- Repeat for props, wardrobe, locations, etc. -->

  <button class="sidebar-btn-full" id="btn-create-tag-type">
    + Create Custom Tag Type
  </button>
</div>
```

### 8.3 Explorer Panel

```html
<div class="sidebar-panel" data-panel="explorer">
  <div class="sidebar-section-header">
    <span>EXPLORER</span>
    <div class="sidebar-actions">
      <button title="New Script"><!-- new file icon --></button>
      <button title="New Folder"><!-- new folder icon --></button>
    </div>
  </div>
  <div class="file-tree">
    <div class="tree-item folder open">
      <span class="tree-chevron">▾</span>
      <span class="tree-icon"><!-- folder icon --></span>
      <span class="tree-label">My Project</span>
    </div>
    <div class="tree-item file active" style="padding-left: 24px">
      <span class="tree-icon"><!-- .rga icon --></span>
      <span class="tree-label">Episode 1.rga</span>
    </div>
    <div class="tree-item file" style="padding-left: 24px">
      <span class="tree-icon"><!-- .rga icon --></span>
      <span class="tree-label">Episode 2.rga</span>
    </div>
  </div>
</div>
```

### 8.4 Sync Panel

```html
<div class="sidebar-panel" data-panel="sync">
  <!-- Not logged in state -->
  <div class="sync-login">
    <div class="sync-logo"><!-- Rwanga logo --></div>
    <p>Sign in to Rwanga to sync your scripts across devices and access version history.</p>
    <button class="btn-primary">Sign In</button>
    <button class="btn-secondary">Create Account</button>
  </div>

  <!-- Logged in state (hidden by default) -->
  <div class="sync-connected" hidden>
    <div class="sync-status">
      <span class="sync-dot synced"></span>
      <span>All changes synced</span>
    </div>
    <div class="sidebar-section-header">
      <span>VERSION HISTORY</span>
    </div>
    <div class="version-list">
      <div class="version-item">
        <span class="version-date">May 11, 2026 2:30 PM</span>
        <span class="version-note">Added Scene 5</span>
      </div>
      <!-- ... -->
    </div>
    <div class="sync-actions">
      <button class="btn-secondary">Push Changes</button>
      <button class="btn-secondary">Pull Latest</button>
    </div>
  </div>
</div>
```

### 8.5 Extensions Panel

```html
<div class="sidebar-panel" data-panel="extensions">
  <div class="sidebar-search">
    <input type="text" placeholder="Search extensions..." />
  </div>

  <div class="extension-card locked">
    <div class="extension-icon"><!-- Claude icon --></div>
    <div class="extension-info">
      <div class="extension-name">Claude AI Assistant</div>
      <div class="extension-desc">AI-powered script writing, analysis, and suggestions</div>
    </div>
    <span class="pro-badge">PRO</span>
  </div>

  <div class="extension-card locked">
    <div class="extension-icon"><!-- ChatGPT icon --></div>
    <div class="extension-info">
      <div class="extension-name">ChatGPT</div>
      <div class="extension-desc">OpenAI writing assistant for dialogue and story</div>
    </div>
    <span class="pro-badge">PRO</span>
  </div>

  <div class="extensions-cta">
    <p>AI extensions require a Pro plan.</p>
    <button class="btn-primary">Upgrade to Pro</button>
  </div>
</div>
```

---

## 9. Bottom Panel

### 9.1 Tab Structure

```html
<div id="bottom-panel">
  <div id="bottom-panel-tabs">
    <button class="bp-tab active" data-bp-tab="notes">
      Notes
    </button>
    <button class="bp-tab" data-bp-tab="problems">
      Problems <span class="badge warning">3</span>
    </button>
    <button class="bp-tab" data-bp-tab="breakdown">
      Breakdown
    </button>
    <div class="bp-tab-spacer"></div>
    <button class="bp-tab-action" id="btn-close-bottom-panel" title="Close">×</button>
  </div>
  <div id="bottom-panel-content">
    <div class="bp-content" data-bp-tab="notes">
      <div class="notes-header">Notes — Scene #3</div>
      <textarea class="notes-textarea" placeholder="Add notes for this scene..."></textarea>
    </div>
    <div class="bp-content" data-bp-tab="problems" hidden>
      <div class="problems-list">
        <!-- Dynamically populated -->
      </div>
    </div>
    <div class="bp-content" data-bp-tab="breakdown" hidden>
      <table class="breakdown-table"><!-- Populated from tags --></table>
    </div>
  </div>
</div>
```

### 9.2 Problems Engine

```js
// Run validation on content changes (debounced, 500ms)
function runValidation() {
  const problems = [];

  const blocks = editor.querySelectorAll('.editor-block');
  blocks.forEach((block, index) => {
    const text = block.textContent;
    const type = block.dataset.blockType;

    // Check 1: Shift+Enter (contains <br> inside a block)
    if (block.querySelector('br')) {
      problems.push({
        severity: 'warning',
        message: 'Line break within block. Use Enter to create a new screenplay element.',
        blockIndex: index,
        block: block
      });
    }

    // Check 2: Scene header text in a non-header block
    if (type !== 'scene-header' && /^#\d+\s*[-—]/.test(text)) {
      problems.push({
        severity: 'error',
        message: 'This looks like a scene header but is formatted as ' + formatBlockTypeName(type) + '. Use Tab to change block type.',
        blockIndex: index,
        block: block
      });
    }

    // Check 3: Character name in dialogue/action that's not tagged
    if (type === 'action') {
      const untaggedCharacters = findUntaggedCharacterNames(text);
      untaggedCharacters.forEach(name => {
        problems.push({
          severity: 'info',
          message: `"${name}" appears to be a character but is not tagged.`,
          blockIndex: index,
          block: block
        });
      });
    }

    // Check 4: Empty scene (header followed immediately by another header)
    if (type === 'scene-header') {
      const next = block.nextElementSibling;
      if (next && next.dataset.blockType === 'scene-header') {
        problems.push({
          severity: 'warning',
          message: 'Empty scene — no content between scene headers.',
          blockIndex: index,
          block: block
        });
      }
    }

    // Check 5: Dialogue without a character
    if (type === 'dialogue') {
      const prev = block.previousElementSibling;
      if (prev && prev.dataset.blockType !== 'character' && prev.dataset.blockType !== 'parenthetical') {
        problems.push({
          severity: 'warning',
          message: 'Dialogue block without a preceding character name.',
          blockIndex: index,
          block: block
        });
      }
    }
  });

  renderProblems(problems);
  updateProblemsBadge(problems.length);
}
```

---

## 10. Inspector Panel

Shows contextual details based on what's selected in the editor.

### 10.1 When a Tag is Selected

```html
<div class="inspector-section">
  <div class="inspector-title">Character</div>
  <div class="inspector-field">
    <label>Name</label>
    <input type="text" value="SARAH" class="inspector-input" />
  </div>
  <div class="inspector-field">
    <label>Color</label>
    <div class="color-swatches">
      <button class="swatch active" style="background: #4FC1FF"></button>
      <button class="swatch" style="background: #FF6B6B"></button>
      <button class="swatch" style="background: #4EC9B0"></button>
      <!-- ... -->
    </div>
  </div>
  <div class="inspector-field">
    <label>Occurrences (12)</label>
    <div class="occurrence-list">
      <div class="occurrence-item">Scene #1 — Line 3</div>
      <div class="occurrence-item">Scene #1 — Line 15</div>
      <div class="occurrence-item">Scene #3 — Line 2</div>
      <!-- ... -->
    </div>
  </div>
  <div class="inspector-field">
    <label>Notes</label>
    <textarea class="inspector-textarea" placeholder="Character notes..."></textarea>
  </div>
</div>
```

### 10.2 When a Scene Header is Selected

```html
<div class="inspector-section">
  <div class="inspector-title">Scene #3</div>
  <div class="inspector-field">
    <label>Setting</label>
    <span>INT</span>
  </div>
  <div class="inspector-field">
    <label>Location</label>
    <span>CAFÉ</span>
  </div>
  <div class="inspector-field">
    <label>Time</label>
    <span>NIGHT</span>
  </div>
  <div class="inspector-field">
    <label>Elements</label>
    <div class="scene-stats">
      <span>3 Characters</span>
      <span>2 Props</span>
      <span>1 SFX</span>
    </div>
  </div>
  <div class="inspector-field">
    <label>Scene Length</label>
    <span>2.5 pages (est. 2.5 min)</span>
  </div>
</div>
```

---

## 11. Command Palette

### 11.1 Structure

```html
<div id="command-palette" class="overlay-palette" hidden>
  <div class="palette-backdrop"></div>
  <div class="palette-dialog">
    <input type="text" class="palette-input" placeholder="Type a command..." autofocus />
    <div class="palette-results">
      <!-- Dynamically populated -->
      <div class="palette-item active">
        <span class="palette-label">Go to Scene...</span>
        <span class="palette-shortcut">Ctrl+P</span>
      </div>
      <div class="palette-item">
        <span class="palette-label">Toggle Theme</span>
        <span class="palette-shortcut">Ctrl+Shift+T</span>
      </div>
    </div>
  </div>
</div>
```

### 11.2 Fuzzy Search

```js
function fuzzyMatch(query, text) {
  const lq = query.toLowerCase();
  const lt = text.toLowerCase();

  // Simple subsequence match with score
  let qi = 0, score = 0, consecutive = 0;
  for (let ti = 0; ti < lt.length && qi < lq.length; ti++) {
    if (lt[ti] === lq[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2; // Bonus for consecutive matches
      if (ti === 0 || lt[ti - 1] === ' ') score += 5; // Bonus for word start
    } else {
      consecutive = 0;
    }
  }

  return qi === lq.length ? score : -1; // -1 = no match
}
```

---

## 12. Status Bar

```html
<footer id="status-bar">
  <div class="status-left">
    <span class="status-item" id="status-sync">
      <span class="sync-dot synced"></span> Synced
    </span>
    <span class="status-item" id="status-scene">Scene 3/12</span>
    <span class="status-item" id="status-problems" title="Problems">
      ⚠ 3
    </span>
  </div>
  <div class="status-right">
    <span class="status-item" id="status-words">4,231 words</span>
    <span class="status-item" id="status-pages">42 pages</span>
    <span class="status-item" id="status-block-type">Action</span>
    <button class="status-item status-btn" id="status-theme" onclick="toggleTheme()">
      🌙 Dark
    </button>
    <button class="status-item status-btn" id="status-language">EN</button>
  </div>
</footer>
```

Page count estimation:
```js
function estimatePageCount() {
  // Industry standard: 1 page ≈ 55 lines of Courier 12pt
  // Or approximately 250 words per page
  const wordCount = getWordCount();
  return Math.ceil(wordCount / 250);
}
```

---

## 13. File Operations

### 13.1 Serialization to .rga

```js
function serializeToRGA() {
  const scenes = [];
  let currentScene = null;

  editor.querySelectorAll('.editor-block').forEach(block => {
    const type = block.dataset.blockType;

    if (type === 'scene-header') {
      // Start new scene
      currentScene = {
        id: block.dataset.sceneId,
        number: parseInt(block.querySelector('.sh-number').textContent.replace('#', '')),
        setting: block.querySelector('.sh-setting').value,
        location: block.querySelector('.sh-location').value,
        time: block.querySelector('.sh-time').value,
        notes: getNoteForScene(block.dataset.sceneId),
        elements: []
      };
      scenes.push(currentScene);
    } else if (currentScene) {
      const element = {
        id: block.dataset.id || generateId('el'),
        type: type,
        text: block.textContent,
        tags: extractTagsFromBlock(block)
      };
      currentScene.elements.push(element);
    }
    // Blocks before first scene header are "pre-scene" (title page elements, etc.)
  });

  return {
    rga_version: '1.0',
    metadata: getCurrentMetadata(),
    settings: getCurrentSettings(),
    scenes: scenes,
    tag_registry: serializeTagRegistry(),
    export_settings: getExportSettings()
  };
}

function saveAsRGA() {
  const data = serializeToRGA();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/x-rwanga-script' });
  // Trigger download (Electron would use dialog.showSaveDialog)
  downloadBlob(blob, `${data.metadata.title}.rga`);
}
```

### 13.2 Deserialization from .rga

```js
function loadFromRGA(json) {
  const data = JSON.parse(json);

  // Clear editor
  editor.innerHTML = '';

  // Apply settings
  applySettings(data.settings);

  // Load tag registry
  loadTagRegistry(data.tag_registry);

  // Render scenes
  data.scenes.forEach(scene => {
    // Create scene header
    const header = createSceneHeaderFromData(scene);
    editor.appendChild(header);

    // Create element blocks
    scene.elements.forEach(el => {
      const block = document.createElement('div');
      block.className = 'editor-block';
      block.dataset.blockType = el.type;
      block.dataset.id = el.id;

      // Apply tag highlights within text
      block.innerHTML = applyTagHighlightsToText(el.text, el.tags);

      editor.appendChild(block);
    });
  });

  // Update all panels
  updateSceneNavigator();
  updateTagManager();
  updateGutter();
  runValidation();
}
```

---

## 14. RTL & i18n Notes

### 14.1 i18n Architecture

```js
// Locale files are JSON:
// { "menu.file": "File", "menu.edit": "Edit", "sidebar.scenes": "SCENES", ... }

let currentLocale = 'en';
let translations = {};

async function loadLocale(locale) {
  const resp = await fetch(`locales/${locale}.json`);
  translations = await resp.json();
  currentLocale = locale;
  document.documentElement.lang = locale;
  document.documentElement.dir = (locale === 'ku' || locale === 'ar') ? 'rtl' : 'ltr';
  updateAllText(); // Re-render all UI text
}

function t(key) {
  return translations[key] || key;
}
```

### 14.2 RTL Layout

When `dir="rtl"`:
- Activity bar stays on the right (or left — follow OS convention)
- Sidebar opens on the right
- Editor gutter moves to the right
- All CSS using `padding-left` / `margin-left` must use logical properties:
  - `padding-inline-start` instead of `padding-left`
  - `margin-inline-end` instead of `margin-right`
  - `text-align: start` instead of `text-align: left`

### 14.3 Scene Header Keywords by Locale

```js
const SCENE_KEYWORDS = {
  en: { int: 'INT', ext: 'EXT' },
  ku: { int: 'ناوەوە', ext: 'دەرەوە' },
  ar: { int: 'داخلي', ext: 'خارجي' }
};
```

---

## 15. Validation Rules for the Prototype

Before considering the prototype complete, verify:

- [ ] Dark and light themes toggle correctly; all panels respect theme
- [ ] Activity bar switches sidebar panels; double-click collapses sidebar
- [ ] All resize handles work; panels collapse when dragged below threshold
- [ ] Typing in the editor creates properly typed blocks
- [ ] Tab cycles block types visually
- [ ] Enter creates new blocks with correct context-aware type
- [ ] Scene header widget renders with dropdowns, location input works
- [ ] Right-click context menu appears with tag options when text is selected
- [ ] Tagging wraps selection in colored highlight
- [ ] Tags appear in the Tags sidebar panel
- [ ] Scene navigator populates from scene headers in editor
- [ ] Clicking a scene in navigator scrolls editor to that scene
- [ ] Notes tab shows per-scene notes
- [ ] Problems tab shows at least 2-3 validation warnings
- [ ] Status bar shows scene count, word count, page estimate, current block type
- [ ] Command palette opens, filters commands, executes on Enter
- [ ] Multiple tabs can be created and switched
- [ ] Inspector panel shows contextual info for tags and scenes

---

*End of Build Instructions — see `03-Component-Library.md` for all CSS and JS code to use.*
