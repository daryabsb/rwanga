/*
 * settings-data.jsx — Settings schema, defaults, and scope definitions
 * for Rwanga Script Editor Settings UI
 */

// Scope types: which surface a setting affects
const SCOPE = {
  FLOW: 'flow',
  PRINT: 'print',
  EXPORT: 'export',
  ALL: 'all'
};

const SCOPE_META = {
  [SCOPE.FLOW]:   { label: 'Flow',   color: '#FFC107', desc: 'Affects writing comfort in Flow View' },
  [SCOPE.PRINT]:  { label: 'Print',  color: '#007acc', desc: 'Affects printed page geometry' },
  [SCOPE.EXPORT]: { label: 'Export',  color: '#4EC9B0', desc: 'Affects exported PDF/DOCX output' },
  [SCOPE.ALL]:    { label: 'All',    color: '#9e9e9e', desc: 'Affects all modes' },
};

// Control types
const CTRL = {
  TOGGLE: 'toggle',
  SELECT: 'select',
  NUMBER: 'number',
  TEXT: 'text',
  SLIDER: 'slider',
  COLOR: 'color',
  SHORTCUT: 'shortcut',
  READONLY: 'readonly',
  MARGIN_GROUP: 'margin_group',
  RADIO: 'radio',
};

// ── Settings schema organized by section ──

const SETTINGS_SECTIONS = [
  {
    id: 'general',
    label: 'General',
    icon: 'settings',
    labelKu: 'گشتی',
    settings: [
      { id: 'language', label: 'Interface Language', labelKu: 'زمانی ڕووکار', helper: 'Controls UI text direction and translations. Editor content language is separate.', scope: SCOPE.ALL, ctrl: CTRL.SELECT, options: [
        { value: 'en', label: 'English' }, { value: 'ku', label: 'کوردی (Sorani)' }, { value: 'ar', label: 'العربية' }
      ], default: 'en' },
      { id: 'theme', label: 'Theme', labelKu: 'ڕووکار', helper: 'Switch between dark and light appearance.', scope: SCOPE.ALL, ctrl: CTRL.RADIO, options: [
        { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }
      ], default: 'dark' },
      { id: 'windowZoom', label: 'Window Zoom', labelKu: 'قەبارەی پەنجەرە', helper: 'Scale the entire application UI. Does not affect print/export output.', scope: SCOPE.FLOW, ctrl: CTRL.SLIDER, min: 50, max: 200, step: 10, unit: '%', default: 100 },
      { id: 'recentFilesLimit', label: 'Recent Files Limit', helper: 'Maximum number of files shown in Open Recent list.', scope: SCOPE.ALL, ctrl: CTRL.NUMBER, min: 5, max: 50, default: 15 },
      { id: 'confirmBeforeClose', label: 'Confirm Before Closing', helper: 'Show a confirmation dialog when closing with unsaved changes.', scope: SCOPE.ALL, ctrl: CTRL.TOGGLE, default: true },
      { id: 'restoreLastSession', label: 'Restore Last Session', helper: 'Reopen the last active script when launching the app.', scope: SCOPE.ALL, ctrl: CTRL.TOGGLE, default: true },
    ]
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: 'editor',
    labelKu: 'دەستکاریکەر',
    settings: [
      { id: 'editor.fontFamily', label: 'Editor Font', labelKu: 'فۆنتی دەستکاریکەر', helper: 'Font used in the writing surface. Courier Prime is the screenplay standard.', scope: SCOPE.FLOW, ctrl: CTRL.SELECT, options: [
        { value: 'Courier Prime', label: 'Courier Prime' }, { value: 'Courier New', label: 'Courier New' }, { value: 'Noto Naskh Arabic', label: 'Noto Naskh Arabic' }
      ], default: 'Courier Prime' },
      { id: 'editor.fontSize', label: 'Editor Font Size', helper: 'Font size for the writing surface. Standard screenplay is 12pt.', scope: SCOPE.FLOW, ctrl: CTRL.NUMBER, min: 8, max: 24, unit: 'pt', default: 12 },
      { id: 'editor.lineHeight', label: 'Line Height', helper: 'Spacing between lines in the editor. Standard is 1.0 (single-spaced).', scope: SCOPE.FLOW, ctrl: CTRL.SELECT, options: [
        { value: '1.0', label: '1.0 — Single' }, { value: '1.15', label: '1.15 — Tight' }, { value: '1.5', label: '1.5 — One-and-half' }, { value: '2.0', label: '2.0 — Double' }
      ], default: '1.0' },
      { id: 'editor.spellcheck', label: 'Spellcheck', helper: 'Enable browser spellcheck in the editor surface.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: true },
      { id: 'editor.autocomplete', label: 'Autocomplete', helper: 'Suggest character names, locations, and transitions as you type.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: true },
      { id: 'editor.showLineNumbers', label: 'Show Line Numbers', helper: 'Display line numbers in the gutter next to the writing surface.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: false },
      { id: 'editor.highlightCurrentLine', label: 'Highlight Current Line', helper: 'Subtle background tint on the line where the cursor sits.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: true },
      { id: 'editor.wordWrap', label: 'Word Wrap', helper: 'How long lines wrap within the editor. Page-width follows page setup margins.', scope: SCOPE.FLOW, ctrl: CTRL.SELECT, options: [
        { value: 'page', label: 'Page Width' }, { value: 'viewport', label: 'Viewport Width' }, { value: 'off', label: 'Off (scroll)' }
      ], default: 'page' },
    ]
  },
  {
    id: 'screenplay',
    label: 'Screenplay',
    icon: 'screenplay',
    labelKu: 'شانۆنامە',
    settings: [
      { id: 'screenplay.profile', label: 'Screenplay Profile', labelKu: 'پرۆفایلی شانۆنامە', helper: 'Formatting standard used for margins, indents, and block spacing. Controls both Flow View layout and print/export output.', scope: SCOPE.ALL, ctrl: CTRL.SELECT, options: [
        { value: 'standard_us', label: 'US Standard (Letter)' }, { value: 'standard_eu', label: 'European (A4)' }, { value: 'bbc', label: 'BBC Format' }, { value: 'custom', label: 'Custom' }
      ], default: 'standard_us' },
      { id: 'screenplay.sceneNumbering', label: 'Scene Numbering', helper: 'Automatically number scenes in the gutter and scene headers.', scope: SCOPE.ALL, ctrl: CTRL.TOGGLE, default: true },
      { id: 'screenplay.sceneNumberPosition', label: 'Scene Number Position', helper: 'Where scene numbers appear on the printed page.', scope: SCOPE.PRINT, ctrl: CTRL.SELECT, options: [
        { value: 'left', label: 'Left Only' }, { value: 'both', label: 'Both Sides' }, { value: 'right', label: 'Right Only' }
      ], default: 'both' },
      { id: 'screenplay.dialogueContinued', label: "Dialogue CONT'D", helper: "Automatically add (CONT'D) when a character's dialogue spans a page break.", scope: SCOPE.PRINT, ctrl: CTRL.TOGGLE, default: true },
      { id: 'screenplay.moreAndContinued', label: 'MORE / CONTINUED', helper: 'Add MORE at bottom and CONTINUED at top when dialogue breaks across pages.', scope: SCOPE.PRINT, ctrl: CTRL.TOGGLE, default: true },
      { id: 'screenplay.boldSceneHeaders', label: 'Bold Scene Headers', helper: 'Render scene headers in bold typeface.', scope: SCOPE.ALL, ctrl: CTRL.TOGGLE, default: true },
      { id: 'screenplay.underlineSceneHeaders', label: 'Underline Scene Headers', helper: 'Add an underline to scene headers.', scope: SCOPE.ALL, ctrl: CTRL.TOGGLE, default: false },
    ]
  },
  {
    id: 'pageSetup',
    label: 'Page Setup',
    icon: 'page',
    labelKu: 'ڕێکخستنی پەڕە',
    settings: [
      { id: 'pageSetup.paperSize', label: 'Paper Size', helper: 'Page dimensions for print and export. US Letter (8.5×11") or A4 (210×297mm).', scope: SCOPE.PRINT, ctrl: CTRL.SELECT, options: [
        { value: 'letter', label: 'US Letter (8.5 × 11 in)' }, { value: 'a4', label: 'A4 (210 × 297 mm)' }, { value: 'custom', label: 'Custom' }
      ], default: 'letter' },
      { id: 'pageSetup.orientation', label: 'Orientation', helper: 'Page orientation for print and export output.', scope: SCOPE.PRINT, ctrl: CTRL.RADIO, options: [
        { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }
      ], default: 'portrait' },
      { id: 'pageSetup.margins', label: 'Margins', helper: 'Page margins in inches. Standard screenplay: 1.5" left, 1" top/right/bottom.', scope: SCOPE.PRINT, ctrl: CTRL.MARGIN_GROUP, default: { top: 1, bottom: 1, left: 1.5, right: 1 } },
      { id: 'pageSetup.pageNumbers', label: 'Page Numbers', helper: 'Show page numbers on printed/exported pages.', scope: SCOPE.PRINT, ctrl: CTRL.TOGGLE, default: true },
      { id: 'pageSetup.pageNumberPosition', label: 'Page Number Position', helper: 'Where the page number appears on each page.', scope: SCOPE.PRINT, ctrl: CTRL.SELECT, options: [
        { value: 'top_right', label: 'Top Right' }, { value: 'top_center', label: 'Top Center' }, { value: 'bottom_right', label: 'Bottom Right' }, { value: 'bottom_center', label: 'Bottom Center' }
      ], default: 'top_right' },
      { id: 'pageSetup.headerText', label: 'Header Text', helper: 'Custom text shown in the page header area. Leave empty for none.', scope: SCOPE.PRINT, ctrl: CTRL.TEXT, placeholder: 'e.g. CONFIDENTIAL DRAFT', default: '' },
      { id: 'pageSetup.footerText', label: 'Footer Text', helper: 'Custom text shown in the page footer area. Leave empty for none.', scope: SCOPE.PRINT, ctrl: CTRL.TEXT, placeholder: 'e.g. © 2026 Production Co.', default: '' },
    ]
  },
  {
    id: 'printExport',
    label: 'Print / Export',
    icon: 'export',
    labelKu: 'چاپ / ناردن',
    settings: [
      { id: 'export.defaultFormat', label: 'Default Export Format', helper: 'File format used when exporting without specifying.', scope: SCOPE.EXPORT, ctrl: CTRL.SELECT, options: [
        { value: 'pdf', label: 'PDF' }, { value: 'docx', label: 'DOCX (Word)' }, { value: 'fdx', label: 'Final Draft (FDX)' }, { value: 'fountain', label: 'Fountain (.fountain)' }
      ], default: 'pdf' },
      { id: 'export.includeSceneNumbers', label: 'Include Scene Numbers', helper: 'Print scene numbers in the margin of exported documents.', scope: SCOPE.EXPORT, ctrl: CTRL.TOGGLE, default: true },
      { id: 'export.includeTitlePage', label: 'Include Title Page', helper: 'Generate a title page from script metadata at the start of exported documents.', scope: SCOPE.EXPORT, ctrl: CTRL.TOGGLE, default: true },
      { id: 'export.revisionMarks', label: 'Revision Marks', helper: 'Include revision asterisks in the right margin of changed lines.', scope: SCOPE.EXPORT, ctrl: CTRL.TOGGLE, default: false },
      { id: 'export.branding', label: 'Branding', helper: 'Controls Rwanga logo placement on exported documents. Pro plan required for custom or no branding.', scope: SCOPE.EXPORT, ctrl: CTRL.SELECT, options: [
        { value: 'rwanga', label: 'Rwanga Logo' }, { value: 'custom', label: 'Custom Letterhead (Pro)' }, { value: 'none', label: 'No Branding (Pro)' }
      ], default: 'rwanga' },
      { id: 'export.watermark', label: 'Watermark Text', helper: 'Faint diagonal text overlaid on each exported page. Leave empty for none.', scope: SCOPE.EXPORT, ctrl: CTRL.TEXT, placeholder: 'e.g. DRAFT', default: '' },
      { id: 'export.colorMode', label: 'Color Mode', helper: 'Whether tag highlights and colors are preserved in the exported document.', scope: SCOPE.EXPORT, ctrl: CTRL.SELECT, options: [
        { value: 'bw', label: 'Black & White' }, { value: 'color', label: 'Color (with tag highlights)' }
      ], default: 'bw' },
    ]
  },
  {
    id: 'autosave',
    label: 'Autosave & Files',
    icon: 'autosave',
    labelKu: 'خۆپاشەکەوتکردن',
    settings: [
      { id: 'autosave.enabled', label: 'Autosave', helper: 'Automatically save the current script at regular intervals.', scope: SCOPE.ALL, ctrl: CTRL.TOGGLE, default: true },
      { id: 'autosave.interval', label: 'Autosave Interval', helper: 'How often the script is automatically saved, in seconds.', scope: SCOPE.ALL, ctrl: CTRL.NUMBER, min: 5, max: 300, unit: 's', default: 30 },
      { id: 'autosave.maxVersions', label: 'Local Version History', helper: 'Number of local save versions kept. Older versions are deleted.', scope: SCOPE.ALL, ctrl: CTRL.NUMBER, min: 1, max: 100, default: 20 },
      { id: 'files.defaultSaveFormat', label: 'Default Save Format', helper: 'File format used when saving a new script.', scope: SCOPE.ALL, ctrl: CTRL.SELECT, options: [
        { value: 'rga', label: 'Rwanga (.rga)' }, { value: 'fountain', label: 'Fountain (.fountain)' }
      ], default: 'rga' },
      { id: 'files.backupOnOpen', label: 'Backup on Open', helper: 'Create a backup copy when opening an existing script file.', scope: SCOPE.ALL, ctrl: CTRL.TOGGLE, default: false },
      { id: 'files.defaultDirectory', label: 'Default Save Location', helper: 'Starting directory when saving a new script. Click to change.', scope: SCOPE.ALL, ctrl: CTRL.TEXT, placeholder: '~/Documents/Rwanga Scripts', default: '' },
    ]
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'appearance',
    labelKu: 'دەرکەوتن',
    settings: [
      { id: 'appearance.sidebarPosition', label: 'Sidebar Position', helper: 'Which side of the window the sidebar appears on.', scope: SCOPE.FLOW, ctrl: CTRL.RADIO, options: [
        { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }
      ], default: 'left' },
      { id: 'appearance.activityBar', label: 'Activity Bar', helper: 'Show or hide the icon strip on the far left.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: true },
      { id: 'appearance.statusBar', label: 'Status Bar', helper: 'Show or hide the bottom status bar.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: true },
      { id: 'appearance.minimap', label: 'Minimap', helper: 'Show a miniature overview of the script on the right edge.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: false },
      { id: 'appearance.editorPageShadow', label: 'Page Shadow', helper: 'Show a drop shadow around the page surface in Flow and Print views.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: true },
      { id: 'appearance.editorDeskColor', label: 'Desk Color', helper: 'Background color behind the page surface.', scope: SCOPE.FLOW, ctrl: CTRL.COLOR, options: [
        { value: '#141414', label: 'Charcoal' }, { value: '#1a1a2e', label: 'Midnight' }, { value: '#1c1c1c', label: 'True Dark' }, { value: '#2d2520', label: 'Warm' }
      ], default: '#141414' },
      { id: 'appearance.formatToolbar', label: 'Format Toolbar', helper: 'Show the formatting toolbar above the editor. Hidden in Draft view regardless.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: true },
    ]
  },
  {
    id: 'shortcuts',
    label: 'Keyboard Shortcuts',
    icon: 'keyboard',
    labelKu: 'کلیلی کورتبڕ',
    settings: [
      { id: 'kb.commandPalette', label: 'Command Palette', helper: 'Open the command palette overlay.', scope: SCOPE.ALL, ctrl: CTRL.SHORTCUT, default: 'Ctrl+Shift+P' },
      { id: 'kb.save', label: 'Save', helper: 'Save the current script.', scope: SCOPE.ALL, ctrl: CTRL.SHORTCUT, default: 'Ctrl+S' },
      { id: 'kb.saveAs', label: 'Save As', helper: 'Save with a new filename.', scope: SCOPE.ALL, ctrl: CTRL.SHORTCUT, default: 'Ctrl+Shift+S' },
      { id: 'kb.find', label: 'Find', helper: 'Open find bar in the editor.', scope: SCOPE.FLOW, ctrl: CTRL.SHORTCUT, default: 'Ctrl+F' },
      { id: 'kb.replace', label: 'Find & Replace', helper: 'Open find and replace.', scope: SCOPE.FLOW, ctrl: CTRL.SHORTCUT, default: 'Ctrl+H' },
      { id: 'kb.toggleSidebar', label: 'Toggle Sidebar', helper: 'Show or hide the sidebar panel.', scope: SCOPE.FLOW, ctrl: CTRL.SHORTCUT, default: 'Ctrl+B' },
      { id: 'kb.toggleTheme', label: 'Toggle Theme', helper: 'Switch between dark and light theme.', scope: SCOPE.ALL, ctrl: CTRL.SHORTCUT, default: 'Ctrl+Shift+T' },
      { id: 'kb.exportPdf', label: 'Export PDF', helper: 'Export the current script as PDF.', scope: SCOPE.EXPORT, ctrl: CTRL.SHORTCUT, default: 'Ctrl+Shift+E' },
      { id: 'kb.sceneNavigator', label: 'Scene Navigator', helper: 'Toggle the scene navigator panel.', scope: SCOPE.FLOW, ctrl: CTRL.SHORTCUT, default: 'Ctrl+Shift+S' },
      { id: 'kb.quickSceneJump', label: 'Quick Scene Jump', helper: 'Open the quick scene jump overlay.', scope: SCOPE.FLOW, ctrl: CTRL.SHORTCUT, default: 'Ctrl+P' },
    ]
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: 'advanced',
    labelKu: 'پێشکەوتوو',
    settings: [
      { id: 'advanced.debugMode', label: 'Debug Mode', helper: 'Show developer tools, page boundaries, and block-type indicators in the editor.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: false },
      { id: 'advanced.showPageMap', label: 'Show Page Map', helper: 'Display the pagemap debug overlay showing page break calculations.', scope: SCOPE.FLOW, ctrl: CTRL.TOGGLE, default: false },
      { id: 'advanced.enableExperimental', label: 'Experimental Features', helper: 'Enable features still in development. May be unstable.', scope: SCOPE.ALL, ctrl: CTRL.TOGGLE, default: false },
      { id: 'advanced.logLevel', label: 'Console Log Level', helper: 'Controls verbosity of console logging for debugging.', scope: SCOPE.ALL, ctrl: CTRL.SELECT, options: [
        { value: 'error', label: 'Errors only' }, { value: 'warn', label: 'Warnings' }, { value: 'info', label: 'Info' }, { value: 'debug', label: 'Debug (verbose)' }
      ], default: 'warn' },
    ]
  }
];

// Build flat defaults object from schema
function buildDefaults() {
  const defaults = {};
  SETTINGS_SECTIONS.forEach(section => {
    section.settings.forEach(s => {
      defaults[s.id] = s.default;
    });
  });
  return defaults;
}

// Build JSON representation grouped by section
function buildSettingsJson(values) {
  const json = {};
  SETTINGS_SECTIONS.forEach(section => {
    const group = {};
    section.settings.forEach(s => {
      const key = s.id.includes('.') ? s.id.split('.').pop() : s.id;
      group[key] = values[s.id] ?? s.default;
    });
    json[section.id] = group;
  });
  return json;
}

window.SCOPE = SCOPE;
window.SCOPE_META = SCOPE_META;
window.CTRL = CTRL;
window.SETTINGS_SECTIONS = SETTINGS_SECTIONS;
window.buildDefaults = buildDefaults;
window.buildSettingsJson = buildSettingsJson;
