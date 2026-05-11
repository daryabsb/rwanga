# Rwanga Script Editor — Component Library

> **Usage:** This file contains all CSS tokens, component styles, and JS utility code for the Rwanga Script Editor. The builder agent should use these as the foundation — copy code blocks directly into the project's CSS/JS files. Organized by system.

---

## Part 1: CSS Foundation

### 1.1 Reset & Base

```css
/* reset.css */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

button {
  font: inherit;
  border: none;
  background: none;
  cursor: pointer;
  color: inherit;
}

input, select, textarea {
  font: inherit;
  border: none;
  background: none;
  color: inherit;
  outline: none;
}

:focus-visible {
  outline: 1px solid var(--accent-primary);
  outline-offset: -1px;
}

/* Custom scrollbars (Chromium) */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
::-webkit-scrollbar-corner {
  background: transparent;
}
```

### 1.2 Theme Tokens (CSS Custom Properties)

```css
/* tokens.css — the COMPLETE token set for both themes */

:root,
[data-theme="dark"] {
  /* === Layout dimensions === */
  --menu-bar-height: 32px;
  --status-bar-height: 24px;
  --activity-bar-width: 48px;
  --sidebar-width: 260px;
  --inspector-width: 280px;
  --bottom-panel-height: 200px;
  --tab-bar-height: 36px;
  --gutter-width: 52px;

  /* === Background layers (darkest → lightest surface) === */
  --bg-base: #181818;
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d30;
  --bg-quaternary: #333337;
  --bg-hover: #2a2d2e;
  --bg-active: #37373d;
  --bg-selected: #04395e;

  /* === Editor specific === */
  --editor-bg: #1e1e1e;
  --editor-page-bg: #1a1a1a;
  --editor-line-highlight: rgba(255, 255, 255, 0.04);
  --scene-header-bg: rgba(255, 193, 7, 0.08);
  --scene-header-border: #FFC107;

  /* === Text === */
  --text-primary: #cccccc;
  --text-secondary: #9e9e9e;
  --text-tertiary: #6e6e6e;
  --text-disabled: #4e4e4e;
  --text-inverse: #1e1e1e;
  --text-link: #4FC1FF;

  /* === Borders === */
  --border-primary: #3c3c3c;
  --border-secondary: #2b2b2b;
  --border-focus: #007acc;

  /* === Accent colors === */
  --accent-primary: #007acc;
  --accent-primary-hover: #1a8ad4;
  --accent-gold: #FFC107;
  --accent-success: #4EC9B0;
  --accent-warning: #FFB347;
  --accent-error: #F44747;
  --accent-info: #4FC1FF;

  /* === Tag colors (dark theme) === */
  --tag-character: #4FC1FF;
  --tag-prop: #FFB347;
  --tag-wardrobe: #C586C0;
  --tag-location: #4EC9B0;
  --tag-sfx: #F44747;
  --tag-vfx: #FF79C6;
  --tag-vehicle: #56B6C2;
  --tag-animal: #D19A66;
  --tag-makeup: #E06C9F;
  --tag-music: #7C6EF6;

  /* === Scrollbar === */
  --scrollbar-thumb: rgba(255, 255, 255, 0.15);
  --scrollbar-thumb-hover: rgba(255, 255, 255, 0.25);

  /* === Shadows === */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);
  --shadow-overlay: 0 12px 40px rgba(0, 0, 0, 0.7);

  /* === Menu / Overlays === */
  --menu-bg: #2d2d30;
  --menu-hover: #094771;
  --menu-separator: #454545;
  --menu-shadow: var(--shadow-md);

  /* === Badges === */
  --badge-bg: #007acc;
  --badge-text: #ffffff;
  --badge-warning-bg: #FFB347;
  --badge-warning-text: #1e1e1e;
  --badge-error-bg: #F44747;
  --badge-error-text: #ffffff;

  /* === Pro badge === */
  --pro-badge-bg: linear-gradient(135deg, #FFB347, #FF6B6B);
  --pro-badge-text: #ffffff;

  /* === Typography scale === */
  --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-editor: 'Courier Prime', 'Courier New', monospace;
  --font-size-xs: 10px;
  --font-size-sm: 11px;
  --font-size-base: 13px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;

  /* === Radius === */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;

  /* === Transitions === */
  --transition-fast: 0.1s ease;
  --transition-normal: 0.2s ease;
  --transition-slow: 0.3s ease;
}

/* ============================================ */
/* LIGHT THEME OVERRIDES                        */
/* ============================================ */
[data-theme="light"] {
  --bg-base: #f0f0f0;
  --bg-primary: #ffffff;
  --bg-secondary: #f3f3f3;
  --bg-tertiary: #e8e8e8;
  --bg-quaternary: #dcdcdc;
  --bg-hover: #e8e8e8;
  --bg-active: #d4d4d4;
  --bg-selected: #c8ddf1;

  --editor-bg: #ffffff;
  --editor-page-bg: #fafafa;
  --editor-line-highlight: rgba(0, 0, 0, 0.04);
  --scene-header-bg: rgba(255, 193, 7, 0.1);
  --scene-header-border: #D4A017;

  --text-primary: #333333;
  --text-secondary: #616161;
  --text-tertiary: #999999;
  --text-disabled: #bdbdbd;
  --text-inverse: #ffffff;
  --text-link: #0066bf;

  --border-primary: #d4d4d4;
  --border-secondary: #e8e8e8;
  --border-focus: #0066bf;

  --accent-primary: #0066bf;
  --accent-primary-hover: #005bb0;

  /* Tag colors (light theme) */
  --tag-character: #0070C0;
  --tag-prop: #D48000;
  --tag-wardrobe: #9B30FF;
  --tag-location: #008060;
  --tag-sfx: #CC0000;
  --tag-vfx: #D63384;
  --tag-vehicle: #0D6EFD;
  --tag-animal: #8B5E3C;
  --tag-makeup: #C71585;
  --tag-music: #5B21B6;

  --scrollbar-thumb: rgba(0, 0, 0, 0.15);
  --scrollbar-thumb-hover: rgba(0, 0, 0, 0.3);

  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.12);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);
  --shadow-overlay: 0 12px 40px rgba(0, 0, 0, 0.2);

  --menu-bg: #ffffff;
  --menu-hover: #c8ddf1;
  --menu-separator: #e0e0e0;

  --badge-bg: #0066bf;
  --badge-text: #ffffff;
}
```

---

## Part 2: Shell Component Styles

### 2.1 Application Shell Layout

```css
/* shell.css */

#app {
  display: grid;
  grid-template-rows: var(--menu-bar-height) 1fr var(--status-bar-height);
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* ---- Menu Bar ---- */
#menu-bar {
  display: flex;
  align-items: center;
  height: var(--menu-bar-height);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-secondary);
  padding: 0 8px;
  gap: 0;
  user-select: none;
  -webkit-app-region: drag; /* Electron: draggable title bar */
}

.menu-item {
  -webkit-app-region: no-drag;
  padding: 4px 10px;
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.menu-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.menu-item.active {
  background: var(--bg-active);
  color: var(--text-primary);
}

.menu-title {
  -webkit-app-region: no-drag;
  font-weight: 600;
  font-size: var(--font-size-base);
  color: var(--text-primary);
  margin-right: 16px;
  letter-spacing: 0.02em;
}

/* ---- Workspace (everything between menu bar and status bar) ---- */
#workspace {
  display: grid;
  grid-template-columns:
    var(--activity-bar-width)
    var(--sidebar-width)
    4px
    1fr
    4px
    var(--inspector-width, 0px);
  overflow: hidden;
}

#workspace.sidebar-collapsed {
  grid-template-columns:
    var(--activity-bar-width)
    0px
    0px
    1fr
    4px
    var(--inspector-width, 0px);
}

#workspace.inspector-hidden {
  grid-template-columns:
    var(--activity-bar-width)
    var(--sidebar-width)
    4px
    1fr
    0px
    0px;
}

/* ---- Activity Bar ---- */
#activity-bar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  width: var(--activity-bar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-secondary);
  padding: 4px 0;
}

.activity-bar-top,
.activity-bar-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.activity-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  transition: color var(--transition-fast), background var(--transition-fast);
  position: relative;
}
.activity-icon:hover {
  color: var(--text-primary);
}
.activity-icon.active {
  color: var(--text-primary);
}
.activity-icon.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--accent-primary);
  border-radius: 0 1px 1px 0;
}

.activity-icon svg {
  width: 22px;
  height: 22px;
}

/* ---- Sidebar ---- */
#sidebar {
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 36px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  text-transform: uppercase;
  flex-shrink: 0;
}

#sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-panel {
  display: none;
  padding: 0;
}
.sidebar-panel.active {
  display: block;
}

/* ---- Resize Handles ---- */
.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background var(--transition-fast);
  z-index: 10;
}
.resize-handle:hover,
.resize-handle.dragging {
  background: var(--accent-primary);
}
.resize-handle[data-resize="bottom-panel"] {
  width: auto;
  height: 4px;
  cursor: row-resize;
}

/* ---- Center Column ---- */
#center-column {
  display: grid;
  grid-template-rows: 1fr 4px var(--bottom-panel-height);
  overflow: hidden;
  min-width: 0;
}

#center-column.bottom-collapsed {
  grid-template-rows: 1fr 0px 0px;
}

/* ---- Editor Area ---- */
#editor-area {
  display: grid;
  grid-template-rows: var(--tab-bar-height) 1fr;
  overflow: hidden;
  min-height: 0;
}

/* ---- Bottom Panel ---- */
#bottom-panel {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ---- Inspector Panel ---- */
#inspector-panel {
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-secondary);
  overflow-y: auto;
  padding: 12px;
}

/* ---- Status Bar ---- */
#status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--status-bar-height);
  background: var(--accent-primary);
  padding: 0 12px;
  font-size: var(--font-size-xs);
  color: var(--text-inverse);
  user-select: none;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.status-item {
  padding: 0 8px;
  height: var(--status-bar-height);
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.status-btn {
  cursor: pointer;
  border-radius: 0;
  transition: background var(--transition-fast);
}
.status-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
```

### 2.2 Tab Bar

```css
/* components.css — Tab Bar */

#tab-bar {
  display: flex;
  align-items: stretch;
  height: var(--tab-bar-height);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-secondary);
  overflow-x: auto;
  overflow-y: hidden;
  user-select: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  min-width: 120px;
  max-width: 200px;
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-secondary);
  cursor: pointer;
  position: relative;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}
.tab:hover {
  background: var(--bg-hover);
}
.tab.active {
  background: var(--bg-primary);
  color: var(--text-primary);
}
.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--bg-primary);
}

.tab-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.tab-dirty {
  color: var(--text-primary);
  font-size: 18px;
  line-height: 1;
}

.tab-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity var(--transition-fast), background var(--transition-fast);
}
.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 1;
}
.tab-close:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

#tab-new {
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 16px;
  flex-shrink: 0;
}
#tab-new:hover {
  color: var(--text-primary);
}
```

---

## Part 3: Editor Surface Styles

### 3.1 Editor & Gutter

```css
/* editor.css */

#editor-container {
  display: grid;
  grid-template-columns: var(--gutter-width) 1fr;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--editor-bg);
  position: relative;
}

/* ---- Gutter ---- */
#gutter {
  background: var(--editor-bg);
  border-right: 1px solid var(--border-secondary);
  padding-top: 1in;
  user-select: none;
  position: sticky;
  left: 0;
}

.gutter-line {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 12px;
  padding-top: 2px;
  font-family: var(--font-editor);
  font-size: 10pt;
  color: var(--text-tertiary);
}

.gutter-scene-number {
  color: var(--accent-gold);
  font-weight: 700;
}

/* ---- Editor Writing Surface ---- */
#editor {
  padding: 1in 0.5in;
  min-height: 100%;
  background: var(--editor-bg);
  outline: none;
  caret-color: var(--text-primary);
  line-height: 1;
}

/* ---- Block Base ---- */
.editor-block {
  font-family: var(--font-editor);
  font-size: 12pt;
  line-height: 2;
  color: var(--text-primary);
  padding: 0;
  min-height: 1.5em;
  outline: none;
  position: relative;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Empty block placeholder */
.editor-block:empty::before {
  content: attr(data-placeholder);
  color: var(--text-tertiary);
  font-style: italic;
  pointer-events: none;
}

/* ---- Block Type Styles ---- */

/* Action — full width */
[data-block-type="action"] {
  padding-inline-start: 1.5in;
  padding-inline-end: 1in;
}
[data-block-type="action"]:empty::before {
  content: 'Action...';
}

/* Character — centered, uppercase */
[data-block-type="character"] {
  padding-inline-start: 3.7in;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
[data-block-type="character"]:empty::before {
  content: 'CHARACTER NAME';
}

/* Dialogue */
[data-block-type="dialogue"] {
  padding-inline-start: 2.5in;
  padding-inline-end: 2in;
}
[data-block-type="dialogue"]:empty::before {
  content: 'Dialogue...';
}

/* Parenthetical */
[data-block-type="parenthetical"] {
  padding-inline-start: 3.1in;
  padding-inline-end: 2.5in;
  font-style: italic;
  color: var(--text-secondary);
}
[data-block-type="parenthetical"]:empty::before {
  content: '(parenthetical)';
}

/* Transition — right-aligned, uppercase */
[data-block-type="transition"] {
  text-align: end;
  padding-inline-end: 1in;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
[data-block-type="transition"]:empty::before {
  content: 'CUT TO:';
}

/* Shot — uppercase */
[data-block-type="shot"] {
  padding-inline-start: 1.5in;
  text-transform: uppercase;
  color: var(--accent-gold);
  letter-spacing: 0.02em;
}
[data-block-type="shot"]:empty::before {
  content: 'SHOT DESCRIPTION';
}

/* ---- Scene Header ---- */
.scene-header {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--scene-header-bg);
  border-inline-start: 3px solid var(--scene-header-border);
  padding: 8px 16px;
  margin: 20px 0 8px 0;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-family: var(--font-editor);
  font-weight: 700;
  font-size: 12pt;
  user-select: none;
}

.scene-header:first-child {
  margin-top: 0;
}

.sh-number {
  color: var(--accent-gold);
  font-weight: 700;
  white-space: nowrap;
  min-width: 32px;
}

.sh-separator {
  color: var(--text-tertiary);
  margin: 0 2px;
}

.sh-dot {
  color: var(--text-tertiary);
}

.sh-setting,
.sh-time {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-family: var(--font-editor);
  font-size: 11pt;
  font-weight: 700;
  cursor: pointer;
}
.sh-setting:hover,
.sh-time:hover {
  border-color: var(--border-focus);
}

.sh-location {
  flex: 1;
  min-width: 100px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  font-family: var(--font-editor);
  font-size: 11pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.sh-location:focus {
  border-color: var(--border-focus);
  background: var(--bg-primary);
}
.sh-location::placeholder {
  color: var(--text-tertiary);
  font-weight: 400;
  text-transform: none;
}

.sh-menu-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-size: 16px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.scene-header:hover .sh-menu-btn {
  opacity: 1;
}
.sh-menu-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

### 3.2 Tag Highlighting

```css
/* tags.css */

.tag-highlight {
  border-radius: var(--radius-sm);
  padding: 0 3px;
  cursor: pointer;
  transition: background var(--transition-fast), filter var(--transition-fast);
  position: relative;
}

.tag-highlight:hover {
  filter: brightness(1.2);
}

/* Per-type tag colors — uses inline style --tag-color set by JS.
   These are fallback classes if inline style is not set. */

.tag-highlight[data-tag-type="character"] {
  background: rgba(79, 193, 255, 0.18);
  border-bottom: 2px solid var(--tag-character);
}
.tag-highlight[data-tag-type="prop"] {
  background: rgba(255, 179, 71, 0.18);
  border-bottom: 2px solid var(--tag-prop);
}
.tag-highlight[data-tag-type="wardrobe"] {
  background: rgba(197, 134, 192, 0.18);
  border-bottom: 2px solid var(--tag-wardrobe);
}
.tag-highlight[data-tag-type="location"] {
  background: rgba(78, 201, 176, 0.18);
  border-bottom: 2px solid var(--tag-location);
}
.tag-highlight[data-tag-type="sfx"] {
  background: rgba(244, 71, 71, 0.18);
  border-bottom: 2px solid var(--tag-sfx);
}
.tag-highlight[data-tag-type="vfx"] {
  background: rgba(255, 121, 198, 0.18);
  border-bottom: 2px solid var(--tag-vfx);
}
.tag-highlight[data-tag-type="vehicle"] {
  background: rgba(86, 182, 194, 0.18);
  border-bottom: 2px solid var(--tag-vehicle);
}
.tag-highlight[data-tag-type="animal"] {
  background: rgba(209, 154, 102, 0.18);
  border-bottom: 2px solid var(--tag-animal);
}
.tag-highlight[data-tag-type="makeup"] {
  background: rgba(224, 108, 159, 0.18);
  border-bottom: 2px solid var(--tag-makeup);
}
.tag-highlight[data-tag-type="music"] {
  background: rgba(124, 110, 246, 0.18);
  border-bottom: 2px solid var(--tag-music);
}

/* Light theme tag adjustments */
[data-theme="light"] .tag-highlight[data-tag-type="character"] {
  background: rgba(0, 112, 192, 0.12);
  border-bottom-color: var(--tag-character);
}
[data-theme="light"] .tag-highlight[data-tag-type="prop"] {
  background: rgba(212, 128, 0, 0.12);
  border-bottom-color: var(--tag-prop);
}
/* ... repeat pattern for all types in light theme ... */
```

---

## Part 4: Widget Component Styles

### 4.1 Buttons

```css
/* components.css — Buttons */

.btn-primary {
  background: var(--accent-primary);
  color: var(--text-inverse);
  padding: 6px 14px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 500;
  transition: background var(--transition-fast);
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--accent-primary-hover);
}

.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  padding: 6px 14px;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.btn-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast);
}
.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

### 4.2 Sidebar Shared Styles

```css
/* Sidebar section headers, items, badges */

.sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  text-transform: uppercase;
  user-select: none;
}

.sidebar-action {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-size: 16px;
}
.sidebar-action:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-search {
  padding: 8px 12px;
}
.sidebar-search input {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 5px 10px;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}
.sidebar-search input::placeholder {
  color: var(--text-tertiary);
}
.sidebar-search input:focus {
  border-color: var(--border-focus);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 600;
  background: var(--badge-bg);
  color: var(--badge-text);
}
.badge.warning {
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
}
.badge.error {
  background: var(--badge-error-bg);
  color: var(--badge-error-text);
}

.pro-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  background: var(--pro-badge-bg);
  color: var(--pro-badge-text);
  text-transform: uppercase;
}

/* ---- Scene List Items ---- */
.scene-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px;
  cursor: pointer;
  transition: background var(--transition-fast);
  font-size: var(--font-size-sm);
}
.scene-item:hover {
  background: var(--bg-hover);
}
.scene-item.active {
  background: var(--bg-selected);
}

.scene-item-number {
  color: var(--accent-gold);
  font-weight: 700;
  font-size: var(--font-size-xs);
  min-width: 24px;
}

.scene-item-text {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Tag Group ---- */
.tag-group {
  margin-bottom: 4px;
}

.tag-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  transition: background var(--transition-fast);
  user-select: none;
}
.tag-group-header:hover {
  background: var(--bg-hover);
}

.collapse-chevron {
  font-size: 10px;
  transition: transform var(--transition-fast);
  width: 12px;
  text-align: center;
}
.tag-group-header[data-collapsed="true"] .collapse-chevron {
  transform: rotate(-90deg);
}

.tag-group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-group-items {
  overflow: hidden;
}
.tag-group-header[data-collapsed="true"] + .tag-group-items {
  display: none;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 4px 36px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background var(--transition-fast);
}
.tag-item:hover {
  background: var(--bg-hover);
}

.tag-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.tag-count {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

/* ---- File Tree ---- */
.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background var(--transition-fast);
  user-select: none;
}
.tree-item:hover {
  background: var(--bg-hover);
}
.tree-item.active {
  background: var(--bg-selected);
}

.tree-chevron {
  font-size: 10px;
  width: 12px;
  text-align: center;
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}
.tree-item.folder:not(.open) .tree-chevron {
  transform: rotate(-90deg);
}

.tree-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### 4.3 Context Menu

```css
/* context-menu.css */

.overlay-menu {
  position: fixed;
  z-index: 1000;
  min-width: 200px;
  max-width: 320px;
  background: var(--menu-bg);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: 4px 0;
  box-shadow: var(--shadow-overlay);
  font-size: var(--font-size-base);
}

.menu-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 24px 6px 12px;
  cursor: pointer;
  transition: background var(--transition-fast);
  gap: 12px;
  white-space: nowrap;
}
.menu-option:hover {
  background: var(--menu-hover);
}

.menu-option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.menu-option-shortcut {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  margin-inline-start: 24px;
}

.menu-option-arrow {
  color: var(--text-tertiary);
  font-size: 10px;
}

.menu-separator {
  height: 1px;
  background: var(--menu-separator);
  margin: 4px 0;
}

.menu-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Submenu positioning */
.overlay-menu .overlay-menu {
  position: absolute;
  left: 100%;
  top: -4px;
}
```

### 4.4 Command Palette

```css
/* command-palette.css */

.overlay-palette {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
}

.palette-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.palette-dialog {
  position: relative;
  width: 540px;
  max-width: 90vw;
  background: var(--menu-bg);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-overlay);
  overflow: hidden;
}

.palette-input {
  width: 100%;
  padding: 12px 16px;
  font-size: var(--font-size-md);
  background: transparent;
  border-bottom: 1px solid var(--border-primary);
}
.palette-input::placeholder {
  color: var(--text-tertiary);
}

.palette-results {
  max-height: 320px;
  overflow-y: auto;
  padding: 4px 0;
}

.palette-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.palette-item:hover,
.palette-item.active {
  background: var(--menu-hover);
}

.palette-label {
  color: var(--text-primary);
}

.palette-shortcut {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}
```

### 4.5 Bottom Panel

```css
/* Bottom panel tabs and content */

#bottom-panel-tabs {
  display: flex;
  align-items: stretch;
  height: 32px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-secondary);
  padding: 0 8px;
  gap: 0;
  flex-shrink: 0;
}

.bp-tab {
  padding: 0 12px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  transition: color var(--transition-fast), border-color var(--transition-fast);
  display: flex;
  align-items: center;
  gap: 6px;
}
.bp-tab:hover {
  color: var(--text-primary);
}
.bp-tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-primary);
}

.bp-tab-spacer {
  flex: 1;
}

.bp-tab-action {
  width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 16px;
}
.bp-tab-action:hover {
  color: var(--text-primary);
}

#bottom-panel-content {
  flex: 1;
  overflow: auto;
}

.bp-content {
  padding: 12px 16px;
  height: 100%;
}

/* Notes */
.notes-header {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.notes-textarea {
  width: 100%;
  height: calc(100% - 28px);
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 10px;
  font-size: var(--font-size-base);
  color: var(--text-primary);
  resize: none;
}

/* Problems list */
.problem-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 0;
  cursor: pointer;
  font-size: var(--font-size-sm);
  border-bottom: 1px solid var(--border-secondary);
  transition: background var(--transition-fast);
}
.problem-item:hover {
  background: var(--bg-hover);
}

.problem-severity {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}
.problem-severity.error { background: var(--accent-error); }
.problem-severity.warning { background: var(--accent-warning); }
.problem-severity.info { background: var(--accent-info); }

.problem-message {
  color: var(--text-primary);
  line-height: 1.4;
}

.problem-location {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  margin-top: 2px;
}
```

### 4.6 Inspector Panel

```css
/* Inspector panel styles */

.inspector-section {
  margin-bottom: 20px;
}

.inspector-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-secondary);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.inspector-field {
  margin-bottom: 12px;
}

.inspector-field label {
  display: block;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.inspector-input {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 5px 8px;
  font-size: var(--font-size-base);
}
.inspector-input:focus {
  border-color: var(--border-focus);
}

.inspector-textarea {
  width: 100%;
  min-height: 80px;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 8px;
  font-size: var(--font-size-sm);
  resize: vertical;
}

.color-swatches {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color var(--transition-fast), transform var(--transition-fast);
}
.swatch:hover {
  transform: scale(1.15);
}
.swatch.active {
  border-color: var(--text-primary);
}

.occurrence-list {
  max-height: 200px;
  overflow-y: auto;
}

.occurrence-item {
  padding: 4px 8px;
  font-size: var(--font-size-sm);
  color: var(--text-link);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.occurrence-item:hover {
  background: var(--bg-hover);
}

.scene-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.scene-stats span {
  background: var(--bg-tertiary);
  padding: 3px 8px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}
```

### 4.7 Extension Cards

```css
.extension-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-secondary);
  transition: background var(--transition-fast);
}
.extension-card:hover {
  background: var(--bg-hover);
}
.extension-card.locked {
  opacity: 0.6;
}

.extension-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.extension-info {
  flex: 1;
  min-width: 0;
}

.extension-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
}

.extension-desc {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-top: 2px;
}

.extensions-cta {
  padding: 16px;
  text-align: center;
}
.extensions-cta p {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: 8px;
}
```

### 4.8 Sync Panel

```css
.sync-login {
  padding: 24px 16px;
  text-align: center;
}
.sync-login p {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 12px 0 16px;
  line-height: 1.5;
}
.sync-login .btn-primary,
.sync-login .btn-secondary {
  width: 100%;
  margin-bottom: 8px;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: var(--font-size-sm);
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.sync-dot.synced { background: var(--accent-success); }
.sync-dot.pending { background: var(--accent-warning); }
.sync-dot.error { background: var(--accent-error); }

.version-item {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-secondary);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.version-item:hover {
  background: var(--bg-hover);
}

.version-date {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}
.version-note {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.sync-actions {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
}
.sync-actions .btn-secondary {
  flex: 1;
  text-align: center;
}
```

---

## Part 5: SVG Icon Reference

Minimal inline SVGs for the activity bar and common UI elements. Each is 22×22 viewBox, stroke-based, 1.5px stroke.

```js
/* icons.js — icon SVG strings. Use: element.innerHTML = ICONS.explorer; */

const ICONS = {
  // Activity Bar
  explorer: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 4h5l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V4z"/>
    <path d="M3 4a2 2 0 012-2h3l2 2"/>
  </svg>`,

  scenes: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="5" width="16" height="12" rx="1.5"/>
    <path d="M3 9h16"/>
    <path d="M7 5V3M11 5V3M15 5V3"/>
    <path d="M7 5l4 4M11 5l-4 4"/>
  </svg>`,

  tags: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 3h6.5l8 8a1.5 1.5 0 010 2.12l-4.38 4.38a1.5 1.5 0 01-2.12 0l-8-8V3z"/>
    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
  </svg>`,

  sync: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 8a6 6 0 0111.36-1"/>
    <path d="M17 14a6 6 0 01-11.36 1"/>
    <polyline points="5 4 5 8 9 8"/>
    <polyline points="17 18 17 14 13 14"/>
  </svg>`,

  extensions: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="10" width="6" height="6" rx="1"/>
    <rect x="10" y="10" width="6" height="6" rx="1"/>
    <rect x="10" y="3" width="6" height="6" rx="1"/>
    <rect x="3" y="3" width="6" height="6" rx="1"/>
  </svg>`,

  settings: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="3"/>
    <path d="M11 2v2M11 18v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M2 11h2M18 11h2M4.22 17.78l1.42-1.42M16.36 5.64l1.42-1.42"/>
  </svg>`,

  // File types
  fileRga: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" fill="#FFC107" opacity="0.2" stroke="#FFC107" stroke-width="1"/>
    <text x="5" y="11" font-size="5" font-weight="bold" fill="#FFC107" font-family="sans-serif">R</text>
  </svg>`,

  fileTxt: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" stroke-width="1" opacity="0.5"/>
    <path d="M5 7h6M5 9h4" stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
  </svg>`,

  // UI actions
  close: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M4 4l6 6M10 4l-6 6"/>
  </svg>`,

  chevronDown: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M2 3.5l3 3 3-3"/>
  </svg>`,

  chevronRight: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M3.5 2l3 3-3 3"/>
  </svg>`,

  plus: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M7 3v8M3 7h8"/>
  </svg>`,

  search: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="6" cy="6" r="4"/>
    <path d="M9 9l3 3"/>
  </svg>`
};
```

---

## Part 6: JS Utility Functions

### 6.1 ID Generation

```js
let _idCounter = 0;
function generateId(prefix = 'el') {
  return `${prefix}-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
}
```

### 6.2 Debounce

```js
function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
```

### 6.3 Text Truncation

```js
function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}
```

### 6.4 Cursor Utilities

```js
function getCurrentBlock() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const node = sel.anchorNode;
  const el = node.nodeType === 3 ? node.parentElement : node;
  return el.closest('.editor-block');
}

function setCursorToStart(element) {
  const range = document.createRange();
  const sel = window.getSelection();
  range.setStart(element, 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function setCursorToEnd(element) {
  const range = document.createRange();
  const sel = window.getSelection();
  if (element.childNodes.length > 0) {
    const lastChild = element.childNodes[element.childNodes.length - 1];
    if (lastChild.nodeType === 3) {
      range.setStart(lastChild, lastChild.length);
    } else {
      range.setStartAfter(lastChild);
    }
  } else {
    range.setStart(element, 0);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function splitBlockAtCursor(block) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return { before: block.textContent, after: '' };

  const range = sel.getRangeAt(0);

  const beforeRange = document.createRange();
  beforeRange.setStart(block, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = document.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  afterRange.setEndAfter(block.lastChild || block);

  return {
    before: beforeRange.toString(),
    after: afterRange.toString()
  };
}
```

### 6.5 Block Type Formatter

```js
function formatBlockTypeName(type) {
  const names = {
    'scene-header': 'Scene Header',
    'action': 'Action',
    'character': 'Character',
    'dialogue': 'Dialogue',
    'parenthetical': 'Parenthetical',
    'transition': 'Transition',
    'shot': 'Shot'
  };
  return names[type] || type;
}
```

### 6.6 Word & Page Count

```js
function getWordCount() {
  const text = document.getElementById('editor').textContent;
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

function estimatePageCount() {
  return Math.max(1, Math.ceil(getWordCount() / 250));
}

function formatNumber(n) {
  return n.toLocaleString('en-US');
}
```

### 6.7 Context Menu Renderer

```js
function renderContextMenu(menuEl, items, x, y) {
  menuEl.innerHTML = '';
  menuEl.hidden = false;

  items.forEach(item => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'menu-separator';
      menuEl.appendChild(sep);
      return;
    }

    const option = document.createElement('div');
    option.className = 'menu-option';

    const label = document.createElement('span');
    label.className = 'menu-option-label';

    if (item.icon) {
      label.appendChild(item.icon);
    }

    const text = document.createElement('span');
    text.textContent = item.label;
    label.appendChild(text);
    option.appendChild(label);

    if (item.shortcut) {
      const shortcut = document.createElement('span');
      shortcut.className = 'menu-option-shortcut';
      shortcut.textContent = item.shortcut;
      option.appendChild(shortcut);
    }

    if (item.submenu) {
      const arrow = document.createElement('span');
      arrow.className = 'menu-option-arrow';
      arrow.textContent = '▸';
      option.appendChild(arrow);

      option.addEventListener('mouseenter', () => {
        // Close any sibling submenus
        menuEl.querySelectorAll('.overlay-menu').forEach(m => m.remove());
        // Render submenu
        const subMenu = document.createElement('div');
        subMenu.className = 'overlay-menu';
        renderContextMenu(subMenu, item.submenu, 0, 0);
        subMenu.style.position = 'absolute';
        subMenu.style.left = '100%';
        subMenu.style.top = `${option.offsetTop - 4}px`;
        subMenu.hidden = false;
        option.style.position = 'relative';
        option.appendChild(subMenu);
      });
    } else if (item.action) {
      option.addEventListener('click', () => {
        item.action();
        closeContextMenu();
      });
    }

    menuEl.appendChild(option);
  });

  // Position — keep within viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  menuEl.style.left = `${Math.min(x, vw - 220)}px`;
  menuEl.style.top = `${Math.min(y, vh - menuEl.offsetHeight - 10)}px`;
}

function closeContextMenu() {
  const menu = document.getElementById('context-menu');
  menu.hidden = true;
  menu.innerHTML = '';
}

// Close on click outside
document.addEventListener('click', closeContextMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeContextMenu();
});
```

### 6.8 Tag Color Utility

```js
function createColorDot(color) {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const hex = typeof color === 'object' ? color[theme] : color;

  const dot = document.createElement('span');
  dot.className = 'menu-color-dot';
  dot.style.background = hex;
  return dot;
}

function getTagColor(tagType) {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const type = TAG_TYPES[tagType];
  if (!type) return '#888888';
  return type.color[theme];
}

function getTagHighlightBG(hexColor, opacity) {
  opacity = opacity || 0.18;
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
```

### 6.9 Resize Handle Logic

```js
function initResizeHandles() {
  document.querySelectorAll('.resize-handle').forEach(handle => {
    let startPos, startSize;
    const target = handle.dataset.resize;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      handle.classList.add('dragging');

      const isVertical = target === 'bottom-panel';
      startPos = isVertical ? e.clientY : e.clientX;

      if (target === 'sidebar') {
        startSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'));
      } else if (target === 'inspector') {
        startSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--inspector-width'));
      } else if (target === 'bottom-panel') {
        startSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bottom-panel-height'));
      }

      function onMove(e2) {
        const isVert = target === 'bottom-panel';
        const delta = isVert
          ? startPos - e2.clientY    // bottom panel: drag up = larger
          : e2.clientX - startPos;   // sidebar: drag right = larger

        let newSize = startSize + delta;

        // Inspector drags left to grow
        if (target === 'inspector') {
          newSize = startSize - delta;
        }

        // Enforce minimums / collapse thresholds
        const minSize = target === 'bottom-panel' ? 100 : 180;
        const collapseThreshold = 60;

        if (newSize < collapseThreshold) {
          newSize = 0;
        } else {
          newSize = Math.max(newSize, minSize);
        }

        document.documentElement.style.setProperty(
          `--${target === 'sidebar' ? 'sidebar-width' : target === 'inspector' ? 'inspector-width' : 'bottom-panel-height'}`,
          `${newSize}px`
        );
      }

      function onUp() {
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}
```

### 6.10 Scene Navigation (without scrollIntoView)

```js
function scrollToScene(sceneId) {
  const header = document.querySelector(`[data-scene-id="${sceneId}"]`);
  if (!header) return;

  const container = document.getElementById('editor-container');
  const containerRect = container.getBoundingClientRect();
  const headerRect = header.getBoundingClientRect();
  const scrollOffset = headerRect.top - containerRect.top + container.scrollTop - 20;

  container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
}

function updateActiveSceneInSidebar() {
  const container = document.getElementById('editor-container');
  const scrollTop = container.scrollTop;
  const headers = document.querySelectorAll('.scene-header');
  let activeSceneId = null;

  headers.forEach(h => {
    if (h.offsetTop - 40 <= scrollTop + container.offsetTop) {
      activeSceneId = h.dataset.sceneId;
    }
  });

  document.querySelectorAll('.scene-item').forEach(item => {
    item.classList.toggle('active', item.dataset.sceneId === activeSceneId);
  });
}
```

### 6.11 Keyboard Shortcut Manager

```js
const shortcuts = new Map();

function registerShortcut(key, ctrl, shift, alt, action) {
  const id = `${ctrl ? 'C' : ''}${shift ? 'S' : ''}${alt ? 'A' : ''}${key.toUpperCase()}`;
  shortcuts.set(id, action);
}

document.addEventListener('keydown', (e) => {
  const id = `${e.ctrlKey || e.metaKey ? 'C' : ''}${e.shiftKey ? 'S' : ''}${e.altKey ? 'A' : ''}${e.key.toUpperCase()}`;
  const action = shortcuts.get(id);
  if (action) {
    e.preventDefault();
    action();
  }
});

// Register all shortcuts:
// registerShortcut('p', true, true, false, openCommandPalette);
// registerShortcut('p', true, false, false, openQuickSceneJump);
// registerShortcut('b', true, false, false, toggleSidebar);
// registerShortcut('j', true, false, false, toggleBottomPanel);
// registerShortcut('t', true, true, false, toggleTheme);
// registerShortcut('s', true, false, false, saveDocument);
// registerShortcut('n', true, false, false, newDocument);
// etc.
```

---

## Part 7: Sample Data for Prototyping

Use this sample screenplay content to populate the editor during development and testing:

```js
const SAMPLE_SCREENPLAY = {
  metadata: {
    title: 'The Last Light',
    author: 'Dara Rashid',
    version: 1,
    language: 'en'
  },
  scenes: [
    {
      number: 1, setting: 'INT', location: 'CAFÉ', time: 'NIGHT',
      elements: [
        { type: 'action', text: 'A dimly lit café. Rain streaks the windows. JAZZ drifts from a corner speaker. A half-empty cup of tea sits on a worn wooden table.' },
        { type: 'character', text: 'SARAH' },
        { type: 'parenthetical', text: '(checking her watch)' },
        { type: 'dialogue', text: "I've been waiting for an hour. You know I can't keep doing this." },
        { type: 'character', text: 'JOHN' },
        { type: 'dialogue', text: 'Traffic. You know how it is. The whole city shuts down when it rains.' },
        { type: 'action', text: 'Sarah pushes the ENVELOPE across the table. John stares at it but doesn\'t touch it.' },
        { type: 'character', text: 'SARAH' },
        { type: 'dialogue', text: "It's all there. Every last page. I want nothing to do with it anymore." }
      ]
    },
    {
      number: 2, setting: 'EXT', location: 'STREET', time: 'NIGHT',
      elements: [
        { type: 'action', text: 'John steps out into the rain. He holds the ENVELOPE under his JACKET. A BLACK CAR idles at the curb, headlights cutting through the downpour.' },
        { type: 'shot', text: 'CLOSE UP — JOHN\'S FACE' },
        { type: 'action', text: 'Doubt. Fear. Resolution. All passing in a single breath.' },
        { type: 'character', text: 'JOHN' },
        { type: 'parenthetical', text: '(to himself)' },
        { type: 'dialogue', text: 'No turning back now.' },
        { type: 'transition', text: 'CUT TO:' }
      ]
    },
    {
      number: 3, setting: 'INT', location: 'POLICE STATION', time: 'DAY',
      elements: [
        { type: 'action', text: 'Harsh fluorescent lights. DETECTIVE HANA sits behind a cluttered desk, a COFFEE MUG in one hand, a CASE FILE in the other. A PHONE rings in the background.' },
        { type: 'character', text: 'DETECTIVE HANA' },
        { type: 'dialogue', text: 'So let me get this straight. You found the envelope, in a café, at two in the morning. And you just... opened it.' },
        { type: 'character', text: 'JOHN' },
        { type: 'dialogue', text: 'Wouldn\'t you?' },
        { type: 'action', text: 'Hana leans back, studying him. She drops the case file on the desk with a THUD.' }
      ]
    }
  ],
  tag_registry: {
    characters: [
      { name: 'SARAH', color: '#4FC1FF' },
      { name: 'JOHN', color: '#4FC1FF' },
      { name: 'DETECTIVE HANA', color: '#4FC1FF' }
    ],
    props: [
      { name: 'ENVELOPE', color: '#FFB347' },
      { name: 'CASE FILE', color: '#FFB347' },
      { name: 'COFFEE MUG', color: '#FFB347' },
      { name: 'PHONE', color: '#FFB347' }
    ],
    vehicles: [
      { name: 'BLACK CAR', color: '#56B6C2' }
    ],
    wardrobe: [
      { name: 'JACKET', color: '#C586C0' }
    ],
    sfx: [
      { name: 'JAZZ', color: '#F44747' },
      { name: 'THUD', color: '#F44747' }
    ],
    locations: [
      { name: 'CAFÉ', color: '#4EC9B0' },
      { name: 'STREET', color: '#4EC9B0' },
      { name: 'POLICE STATION', color: '#4EC9B0' }
    ]
  }
};
```

---

*End of Component Library. Use these tokens, styles, and utilities as the building blocks for the Rwanga Script Editor. All CSS custom properties ensure theme consistency; all JS utilities handle the core contenteditable challenges.*
