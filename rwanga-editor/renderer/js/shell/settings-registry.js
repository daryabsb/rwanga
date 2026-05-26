// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Registry — Slice 3A.
//
// The single source of truth for every setting in the product.
// One declarative entry per setting with a fixed 16-field shape.
// The Settings Store reads defaults from this registry; future
// slices add the Settings UI, search, and per-tier applicators
// as separate consumers of this same registry.
//
// Slice 3A explicitly ships:
//   - the full settings inventory (62 entries, from docs/rwanga-settings/)
//   - shape validation at load time (throws if malformed)
//   - the public API: has / get / getDefault / all / ids
//
// Slice 3A explicitly does NOT ship:
//   - applicators (no "would apply X" stubs)
//   - any UI
//   - search
//   - dependency enforcement (declared, not enforced)
//   - validators for user-supplied values
//   - onboarding / Pro gates
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Settings = Rga.Settings || {};

  // --------------------------------------------------------------
  // Valid enums — Settings UI and validators in later slices will
  // import these. The shape validator below uses them to fail-fast.
  // --------------------------------------------------------------

  const TYPES = ['toggle', 'select', 'number', 'text',
                 'slider', 'color', 'shortcut', 'margins', 'radio'];
  const SCOPES = ['flow', 'print', 'export', 'all'];
  const TIERS  = ['user', 'script', 'project', 'session'];
  const OWNERS = ['general', 'editor', 'screenplay', 'pageSetup',
                  'printExport', 'autosave', 'appearance',
                  'shortcuts', 'advanced'];
  const PREVIEW_KINDS = ['none', 'page'];

  const REQUIRED_FIELDS = [
    'id', 'label', 'description', 'type', 'default', 'scope',
    'persistsTo', 'owner', 'restartRequired', 'experimental',
    'dependencies', 'requiresPro', 'keywords', 'aliases',
    'previewKind', 'requiresOnboarding'
  ];

  // --------------------------------------------------------------
  // Entry helper — keeps the inventory below compact and readable.
  // Fills in safe defaults for the fields that are uniform across
  // most settings; callers override only what differs.
  // --------------------------------------------------------------

  function entry(overrides) {
    return Object.assign({
      id: '', label: '', description: '',
      type: 'toggle', default: false,
      scope: 'all', persistsTo: 'user', owner: 'general',
      restartRequired:    false,
      experimental:       false,
      dependencies:       [],
      requiresPro:        false,
      keywords:           [],
      aliases:            [],
      previewKind:        'none',
      requiresOnboarding: false
    }, overrides);
  }

  // --------------------------------------------------------------
  // The inventory.
  // 62 entries grouped by owner section. Field values are derived
  // from docs/rwanga-settings/settings-data.jsx — labels and helper
  // text match the design files verbatim. Tier and persistsTo are
  // assigned per the Settings Architecture Doctrine (per-script vs
  // per-user).
  // --------------------------------------------------------------

  const ENTRIES = [
    // ── General ──
    entry({
      id: 'language', label: 'Interface Language',
      description: 'Controls UI text direction and translations. Editor content language is separate.',
      type: 'select', default: 'en', scope: 'all', owner: 'general',
      options: ['en', 'ku', 'ar'],
      labels:  { en: 'English', ku: 'Kurdish', ar: 'Arabic' },
      restartRequired: true,
      keywords: ['ui', 'locale', 'translation', 'rtl', 'kurdish', 'arabic'],
      requiresOnboarding: true
    }),
    entry({
      id: 'theme', label: 'Theme',
      description: 'Switch between dark and light appearance.',
      type: 'radio', default: 'dark', scope: 'all', owner: 'general',
      options: ['dark', 'light', 'system'],
      labels:  { dark: 'Dark', light: 'Light', system: 'System' },
      keywords: ['dark', 'light', 'system', 'appearance', 'mode'],
      requiresOnboarding: true
    }),
    entry({
      id: 'windowZoom', label: 'Window Zoom',
      description: 'Scale the entire application UI. Does not affect print/export output.',
      type: 'slider', default: 100, scope: 'flow', owner: 'general',
      min: 50, max: 200, step: 10, unit: '%',
      keywords: ['scale', 'size', 'ui', 'zoom']
    }),
    entry({
      id: 'recentFilesLimit', label: 'Recent Files Limit',
      description: 'Maximum number of files shown in Open Recent list.',
      type: 'number', default: 15, scope: 'all', owner: 'general',
      keywords: ['recent', 'history', 'files']
    }),
    entry({
      id: 'confirmBeforeClose', label: 'Confirm Before Closing',
      description: 'Show a confirmation dialog when closing with unsaved changes.',
      type: 'toggle', default: true, scope: 'all', owner: 'general',
      keywords: ['confirm', 'close', 'unsaved', 'quit']
    }),
    entry({
      id: 'restoreLastSession', label: 'Restore Last Session',
      description: 'Reopen the last active script when launching the app.',
      type: 'toggle', default: true, scope: 'all', owner: 'general',
      keywords: ['restore', 'session', 'reopen', 'launch']
    }),

    // ── Editor ──
    entry({
      id: 'editor.fontFamily', label: 'Editor Font',
      description: 'Font used in the writing surface. Courier Prime is the screenplay standard.',
      type: 'select', default: 'Courier Prime', scope: 'flow', owner: 'editor',
      options: ['Courier Prime', 'Courier New', 'Noto Naskh Arabic'],
      keywords: ['font', 'typeface', 'courier']
    }),
    entry({
      id: 'editor.fontSize', label: 'Editor Font Size',
      description: 'Font size for the writing surface. Standard screenplay is 12pt.',
      type: 'number', default: 12, scope: 'flow', owner: 'editor',
      keywords: ['font', 'size', 'point', 'pt']
    }),
    entry({
      id: 'editor.lineHeight', label: 'Line Height',
      description: 'Spacing between lines in the editor. Standard is 1.0 (single-spaced).',
      type: 'select', default: '1.0', scope: 'flow', owner: 'editor',
      options: ['1.0', '1.15', '1.5', '2.0'],
      labels:  { '1.0': '1.0 — Single', '1.15': '1.15 — Compact',
                 '1.5': '1.5', '2.0': '2.0 — Double' },
      keywords: ['line', 'spacing', 'leading']
    }),
    entry({
      id: 'editor.spellcheck', label: 'Spellcheck',
      description: 'Enable browser spellcheck in the editor surface.',
      type: 'toggle', default: true, scope: 'flow', owner: 'editor',
      keywords: ['spell', 'check', 'spelling']
    }),
    entry({
      id: 'editor.autocomplete', label: 'Autocomplete',
      description: 'Suggest character names, locations, and transitions as you type.',
      type: 'toggle', default: true, scope: 'flow', owner: 'editor',
      keywords: ['autocomplete', 'suggest', 'character', 'location']
    }),
    entry({
      id: 'editor.showLineNumbers', label: 'Show Line Numbers',
      description: 'Display line numbers in the gutter next to the writing surface.',
      type: 'toggle', default: false, scope: 'flow', owner: 'editor',
      keywords: ['line', 'numbers', 'gutter']
    }),
    entry({
      id: 'editor.highlightCurrentLine', label: 'Highlight Current Line',
      description: 'Subtle background tint on the line where the cursor sits.',
      type: 'toggle', default: true, scope: 'flow', owner: 'editor',
      keywords: ['highlight', 'current', 'line', 'cursor']
    }),
    entry({
      id: 'editor.wordWrap', label: 'Word Wrap',
      description: 'How long lines wrap within the editor. Page-width follows page setup margins.',
      type: 'select', default: 'page', scope: 'flow', owner: 'editor',
      options: ['page', 'viewport', 'off'],
      labels:  { page: 'Page Width', viewport: 'Viewport Width', off: 'Off' },
      keywords: ['wrap', 'word', 'page', 'viewport']
    }),

    // ── Screenplay (per-script: travels with the .rga) ──
    entry({
      id: 'screenplay.profile', label: 'Screenplay Profile',
      description: 'Formatting standard used for margins, indents, and block spacing. Controls both Flow View layout and print/export output.',
      type: 'select', default: 'standard_us',
      scope: 'all', persistsTo: 'script', owner: 'screenplay',
      options: ['standard_us', 'standard_eu', 'bbc', 'custom'],
      labels:  { standard_us: 'US Standard (Letter)',
                 standard_eu: 'EU Standard (A4)',
                 bbc: 'BBC', custom: 'Custom' },
      keywords: ['profile', 'format', 'standard', 'bbc']
    }),
    entry({
      id: 'screenplay.sceneNumbering', label: 'Scene Numbering',
      description: 'Automatically number scenes in the gutter and scene headers.',
      type: 'toggle', default: true,
      scope: 'all', persistsTo: 'script', owner: 'screenplay',
      keywords: ['scene', 'number', 'numbering']
    }),
    entry({
      id: 'screenplay.sceneNumberPosition', label: 'Scene Number Position',
      description: 'Where scene numbers appear on the printed page.',
      type: 'select', default: 'both',
      scope: 'print', persistsTo: 'script', owner: 'screenplay',
      options: ['left', 'both', 'right'],
      labels:  { left: 'Left Margin', both: 'Both Margins', right: 'Right Margin' },
      dependencies: [{ id: 'screenplay.sceneNumbering', value: true }],
      keywords: ['scene', 'number', 'position', 'margin']
    }),
    entry({
      id: 'screenplay.dialogueContinued', label: "Dialogue CONT'D",
      description: "Automatically add (CONT'D) when a character's dialogue spans a page break.",
      type: 'toggle', default: true,
      scope: 'print', persistsTo: 'script', owner: 'screenplay',
      keywords: ["cont'd", 'continued', 'dialogue', 'break']
    }),
    entry({
      id: 'screenplay.moreAndContinued', label: 'MORE / CONTINUED',
      description: 'Add MORE at bottom and CONTINUED at top when dialogue breaks across pages.',
      type: 'toggle', default: true,
      scope: 'print', persistsTo: 'script', owner: 'screenplay',
      keywords: ['more', 'continued', 'page', 'break']
    }),
    entry({
      id: 'screenplay.boldSceneHeaders', label: 'Bold Scene Headers',
      description: 'Show scene headers in bold typeface.',
      type: 'toggle', default: true,
      scope: 'all', persistsTo: 'script', owner: 'screenplay',
      keywords: ['bold', 'scene', 'header', 'slug']
    }),
    entry({
      id: 'screenplay.underlineSceneHeaders', label: 'Underline Scene Headers',
      description: 'Add an underline to scene headers.',
      type: 'toggle', default: false,
      scope: 'all', persistsTo: 'script', owner: 'screenplay',
      keywords: ['underline', 'scene', 'header', 'slug']
    }),

    // ── Page Setup (per-script) ──
    entry({
      id: 'pageSetup.paperSize', label: 'Paper Size',
      description: 'Page dimensions for print and export. US Letter (8.5×11") or A4 (210×297mm).',
      type: 'select', default: 'letter',
      scope: 'print', persistsTo: 'script', owner: 'pageSetup',
      options: ['letter', 'a4', 'custom'],
      labels:  { letter: 'US Letter', a4: 'A4', custom: 'Custom' },
      previewKind: 'page',
      keywords: ['paper', 'size', 'letter', 'a4', 'page']
    }),
    entry({
      id: 'pageSetup.orientation', label: 'Orientation',
      description: 'Page orientation for print and export output.',
      type: 'radio', default: 'portrait',
      scope: 'print', persistsTo: 'script', owner: 'pageSetup',
      options: ['portrait', 'landscape'],
      labels:  { portrait: 'Portrait', landscape: 'Landscape' },
      previewKind: 'page',
      keywords: ['orientation', 'portrait', 'landscape']
    }),
    entry({
      id: 'pageSetup.margins', label: 'Margins',
      description: 'Page margins in inches. Standard screenplay: 1.5" left, 1" top/right/bottom.',
      type: 'margins', default: { top: 1, bottom: 1, left: 1.5, right: 1 },
      scope: 'print', persistsTo: 'script', owner: 'pageSetup',
      previewKind: 'page',
      keywords: ['margin', 'margins', 'spacing', 'inch']
    }),
    entry({
      id: 'pageSetup.pageNumbers', label: 'Page Numbers',
      description: 'Show page numbers on printed/exported pages.',
      type: 'toggle', default: true,
      scope: 'print', persistsTo: 'script', owner: 'pageSetup',
      previewKind: 'page',
      keywords: ['page', 'number', 'pagination']
    }),
    entry({
      id: 'pageSetup.pageNumberPosition', label: 'Page Number Position',
      description: 'Where the page number appears on each page.',
      type: 'select', default: 'top_right',
      scope: 'print', persistsTo: 'script', owner: 'pageSetup',
      options: ['top_right', 'top_center', 'bottom_right', 'bottom_center'],
      labels:  { top_right: 'Top Right', top_center: 'Top Center',
                 bottom_right: 'Bottom Right', bottom_center: 'Bottom Center' },
      dependencies: [{ id: 'pageSetup.pageNumbers', value: true }],
      previewKind: 'page',
      keywords: ['page', 'number', 'position', 'header', 'footer']
    }),
    entry({
      id: 'pageSetup.headerText', label: 'Header Text',
      description: 'Custom text shown in the page header area. Leave empty for none.',
      type: 'text', default: '',
      scope: 'print', persistsTo: 'script', owner: 'pageSetup',
      previewKind: 'page',
      keywords: ['header', 'text', 'top', 'banner']
    }),
    entry({
      id: 'pageSetup.footerText', label: 'Footer Text',
      description: 'Custom text shown in the page footer area. Leave empty for none.',
      type: 'text', default: '',
      scope: 'print', persistsTo: 'script', owner: 'pageSetup',
      previewKind: 'page',
      keywords: ['footer', 'text', 'bottom', 'copyright']
    }),

    // ── Print / Export ──
    entry({
      id: 'export.defaultFormat', label: 'Default Export Format',
      description: 'File format used when exporting without specifying.',
      type: 'select', default: 'pdf',
      scope: 'export', owner: 'printExport',
      options: ['pdf', 'docx', 'fdx', 'fountain'],
      labels:  { pdf: 'PDF', docx: 'Word (DOCX)',
                 fdx: 'Final Draft (FDX)', fountain: 'Fountain (.fountain)' },
      keywords: ['export', 'format', 'pdf', 'docx', 'fdx', 'fountain']
    }),
    entry({
      id: 'export.includeSceneNumbers', label: 'Include Scene Numbers',
      description: 'Print scene numbers in the margin of exported documents.',
      type: 'toggle', default: true,
      scope: 'export', owner: 'printExport',
      keywords: ['scene', 'number', 'export']
    }),
    entry({
      id: 'export.includeTitlePage', label: 'Include Title Page',
      description: 'Generate a title page from script metadata at the start of exported documents.',
      type: 'toggle', default: true,
      scope: 'export', owner: 'printExport',
      keywords: ['title', 'page', 'cover', 'metadata']
    }),
    entry({
      id: 'export.revisionMarks', label: 'Revision Marks',
      description: 'Include revision asterisks in the right margin of changed lines.',
      type: 'toggle', default: false,
      scope: 'export', owner: 'printExport',
      keywords: ['revision', 'mark', 'asterisk', 'change']
    }),
    entry({
      id: 'export.branding', label: 'Branding',
      description: 'Controls Rwanga logo placement on exported documents. Pro plan required for custom or no branding.',
      type: 'select', default: 'rwanga',
      scope: 'export', owner: 'printExport',
      options: ['rwanga', 'custom', 'none'],
      labels:  { rwanga: 'Rwanga Logo', custom: 'Custom Letterhead', none: 'No Branding' },
      keywords: ['branding', 'logo', 'watermark', 'pro']
    }),
    entry({
      id: 'export.watermark', label: 'Watermark Text',
      description: 'Faint diagonal text overlaid on each exported page. Leave empty for none.',
      type: 'text', default: '',
      scope: 'export', owner: 'printExport',
      keywords: ['watermark', 'draft', 'overlay']
    }),
    entry({
      id: 'export.colorMode', label: 'Color Mode',
      description: 'Whether tag highlights and colors are preserved in the exported document.',
      type: 'select', default: 'bw',
      scope: 'export', owner: 'printExport',
      options: ['bw', 'color'],
      labels:  { bw: 'Black & White', color: 'Color' },
      keywords: ['color', 'black', 'white', 'bw', 'highlight']
    }),

    // ── Autosave & Files ──
    entry({
      id: 'autosave.enabled', label: 'Autosave',
      description: 'Automatically save the current script at regular intervals.',
      type: 'toggle', default: true, scope: 'all', owner: 'autosave',
      keywords: ['autosave', 'auto', 'save']
    }),
    entry({
      id: 'autosave.interval', label: 'Autosave Interval',
      description: 'How often the script is automatically saved, in seconds.',
      type: 'number', default: 30, scope: 'all', owner: 'autosave',
      dependencies: [{ id: 'autosave.enabled', value: true }],
      keywords: ['autosave', 'interval', 'seconds']
    }),
    entry({
      id: 'autosave.maxVersions', label: 'Local Version History',
      description: 'Number of local save versions kept. Older versions are deleted.',
      type: 'number', default: 20, scope: 'all', owner: 'autosave',
      keywords: ['version', 'history', 'backup']
    }),
    entry({
      id: 'files.defaultSaveFormat', label: 'Default Save Format',
      description: 'File format used when saving a new script.',
      type: 'select', default: 'rga', scope: 'all', owner: 'autosave',
      options: ['rga', 'fountain'],
      labels:  { rga: 'Rwanga (.rga)', fountain: 'Fountain (.fountain)' },
      keywords: ['save', 'format', 'rga', 'fountain']
    }),
    entry({
      id: 'files.backupOnOpen', label: 'Backup on Open',
      description: 'Create a backup copy when opening an existing script file.',
      type: 'toggle', default: false, scope: 'all', owner: 'autosave',
      keywords: ['backup', 'open', 'copy']
    }),
    entry({
      id: 'files.defaultDirectory', label: 'Default Save Location',
      description: 'Starting directory when saving a new script. Click to change.',
      type: 'text', default: '', scope: 'all', owner: 'autosave',
      keywords: ['directory', 'folder', 'location', 'path'],
      requiresOnboarding: true
    }),

    // ── Appearance ──
    entry({
      id: 'appearance.sidebarPosition', label: 'Sidebar Position',
      description: 'Which side of the window the sidebar appears on.',
      type: 'radio', default: 'left', scope: 'flow', owner: 'appearance',
      options: ['left', 'right'],
      labels:  { left: 'Left', right: 'Right' },
      keywords: ['sidebar', 'position', 'left', 'right']
    }),
    entry({
      id: 'appearance.activityBar', label: 'Activity Bar',
      description: 'Show or hide the icon strip on the far left.',
      type: 'toggle', default: true, scope: 'flow', owner: 'appearance',
      keywords: ['activity', 'bar', 'rail', 'icons']
    }),
    entry({
      id: 'appearance.statusBar', label: 'Status Bar',
      description: 'Show or hide the bottom status bar.',
      type: 'toggle', default: true, scope: 'flow', owner: 'appearance',
      keywords: ['status', 'bar', 'bottom']
    }),
    entry({
      id: 'appearance.minimap', label: 'Minimap',
      description: 'Show a miniature overview of the script on the right edge.',
      type: 'toggle', default: false, scope: 'flow', owner: 'appearance',
      keywords: ['minimap', 'overview', 'preview']
    }),
    entry({
      id: 'appearance.editorPageShadow', label: 'Page Shadow',
      description: 'Show a drop shadow around the page surface in Flow and Print views.',
      type: 'toggle', default: true, scope: 'flow', owner: 'appearance',
      keywords: ['shadow', 'page', 'depth']
    }),
    entry({
      id: 'appearance.editorDeskColor', label: 'Desk Color',
      description: 'Background color behind the page surface.',
      type: 'color', default: '#141414', scope: 'flow', owner: 'appearance',
      // H7 — RC1 §15.9 palette. The color control surfaces these as a
      // curated swatch row; no free-form picker. Values are 6-digit
      // hex (Validators.color is the type-level gate).
      options: ['#141414', '#1a1a2e', '#1c1c1c', '#2d2520'],
      labels: {
        '#141414': 'Charcoal',
        '#1a1a2e': 'Midnight',
        '#1c1c1c': 'True Dark',
        '#2d2520': 'Warm'
      },
      keywords: ['desk', 'background', 'color']
    }),
    entry({
      id: 'appearance.formatToolbar', label: 'Format Toolbar',
      description: 'Show the formatting toolbar above the editor. Hidden in Draft view regardless.',
      type: 'toggle', default: true, scope: 'flow', owner: 'appearance',
      keywords: ['toolbar', 'format', 'top']
    }),

    // ── Keyboard Shortcuts ──
    entry({
      id: 'kb.commandPalette', label: 'Command Palette',
      description: 'Open the command palette overlay.',
      type: 'shortcut', default: 'Ctrl+Shift+P', scope: 'all', owner: 'shortcuts',
      keywords: ['command', 'palette', 'overlay']
    }),
    entry({
      id: 'kb.save', label: 'Save',
      description: 'Save the current script.',
      type: 'shortcut', default: 'Ctrl+S', scope: 'all', owner: 'shortcuts',
      keywords: ['save']
    }),
    entry({
      id: 'kb.saveAs', label: 'Save As',
      description: 'Save with a new filename.',
      type: 'shortcut', default: 'Ctrl+Shift+S', scope: 'all', owner: 'shortcuts',
      keywords: ['save', 'as', 'rename']
    }),
    entry({
      id: 'kb.find', label: 'Find',
      description: 'Open find bar in the editor.',
      type: 'shortcut', default: 'Ctrl+F', scope: 'flow', owner: 'shortcuts',
      keywords: ['find', 'search']
    }),
    entry({
      id: 'kb.replace', label: 'Find & Replace',
      description: 'Open find and replace.',
      type: 'shortcut', default: 'Ctrl+H', scope: 'flow', owner: 'shortcuts',
      keywords: ['find', 'replace', 'search']
    }),
    entry({
      id: 'kb.toggleSidebar', label: 'Toggle Sidebar',
      description: 'Show or hide the sidebar panel.',
      type: 'shortcut', default: 'Ctrl+B', scope: 'flow', owner: 'shortcuts',
      keywords: ['sidebar', 'toggle']
    }),
    entry({
      id: 'kb.toggleTheme', label: 'Toggle Theme',
      description: 'Switch between dark and light theme.',
      type: 'shortcut', default: 'Ctrl+Shift+T', scope: 'all', owner: 'shortcuts',
      keywords: ['theme', 'dark', 'light', 'toggle']
    }),
    entry({
      id: 'kb.exportPdf', label: 'Export PDF',
      description: 'Export the current script as PDF.',
      type: 'shortcut', default: 'Ctrl+Shift+E', scope: 'export', owner: 'shortcuts',
      keywords: ['export', 'pdf']
    }),
    entry({
      id: 'kb.sceneNavigator', label: 'Scene Navigator',
      description: 'Toggle the scene navigator panel.',
      type: 'shortcut', default: 'Ctrl+Shift+S', scope: 'flow', owner: 'shortcuts',
      keywords: ['scene', 'navigator']
    }),
    entry({
      id: 'kb.quickSceneJump', label: 'Quick Scene Jump',
      description: 'Open the quick scene jump overlay.',
      type: 'shortcut', default: 'Ctrl+P', scope: 'flow', owner: 'shortcuts',
      keywords: ['scene', 'jump', 'quick']
    }),

    // ── Advanced ──
    entry({
      id: 'advanced.debugMode', label: 'Debug Mode',
      description: 'Show developer tools, page boundaries, and block-type indicators in the editor.',
      type: 'toggle', default: false, scope: 'flow', owner: 'advanced',
      keywords: ['debug', 'developer', 'dev']
    }),
    entry({
      id: 'advanced.showPageMap', label: 'Show Page Map',
      description: 'Display the pagemap debug overlay showing page break calculations.',
      type: 'toggle', default: false, scope: 'flow', owner: 'advanced',
      experimental: true,
      keywords: ['pagemap', 'debug', 'overlay']
    }),
    entry({
      id: 'advanced.enableExperimental', label: 'Experimental Features',
      description: 'Enable features still in development. May be unstable.',
      type: 'toggle', default: false, scope: 'all', owner: 'advanced',
      experimental: true,
      keywords: ['experimental', 'features', 'beta']
    }),
    entry({
      id: 'advanced.logLevel', label: 'Console Log Level',
      description: 'Controls verbosity of console logging for debugging.',
      type: 'select', default: 'warn', scope: 'all', owner: 'advanced',
      options: ['error', 'warn', 'info', 'debug'],
      labels:  { error: 'Errors Only', warn: 'Warnings',
                 info: 'Info', debug: 'Debug (Verbose)' },
      keywords: ['log', 'level', 'debug', 'verbose']
    })
  ];

  // --------------------------------------------------------------
  // Shape validation. Runs once at module load. Throws on the first
  // malformed entry so registry mistakes surface immediately.
  // --------------------------------------------------------------

  function _validate(entries) {
    // Validators must have loaded first — the registry consults
    // them to ensure every default passes its type validator.
    const validators = Rga.Settings && Rga.Settings.Validators;
    if (!validators || typeof validators.validateValue !== 'function') {
      throw new Error('[Rga.Settings.Registry] Rga.Settings.Validators must load before the registry');
    }

    const seen = new Set();
    entries.forEach(function(e, i) {
      // Required fields.
      REQUIRED_FIELDS.forEach(function(f) {
        if (!Object.prototype.hasOwnProperty.call(e, f)) {
          throw new Error('[Rga.Settings.Registry] entry #' + i +
            ' missing required field "' + f + '" (id=' + e.id + ')');
        }
      });
      // Non-empty id.
      if (typeof e.id !== 'string' || e.id.length === 0) {
        throw new Error('[Rga.Settings.Registry] entry #' + i + ' has empty id');
      }
      // Uniqueness.
      if (seen.has(e.id)) {
        throw new Error('[Rga.Settings.Registry] duplicate id: ' + e.id);
      }
      seen.add(e.id);
      // Enum membership.
      if (TYPES.indexOf(e.type) < 0) {
        throw new Error('[Rga.Settings.Registry] ' + e.id + ': invalid type "' + e.type + '"');
      }
      if (SCOPES.indexOf(e.scope) < 0) {
        throw new Error('[Rga.Settings.Registry] ' + e.id + ': invalid scope "' + e.scope + '"');
      }
      if (TIERS.indexOf(e.persistsTo) < 0) {
        throw new Error('[Rga.Settings.Registry] ' + e.id + ': invalid persistsTo "' + e.persistsTo + '"');
      }
      if (OWNERS.indexOf(e.owner) < 0) {
        throw new Error('[Rga.Settings.Registry] ' + e.id + ': invalid owner "' + e.owner + '"');
      }
      if (PREVIEW_KINDS.indexOf(e.previewKind) < 0) {
        throw new Error('[Rga.Settings.Registry] ' + e.id + ': invalid previewKind "' + e.previewKind + '"');
      }
      // Type checks for the structural fields.
      ['restartRequired', 'experimental', 'requiresPro', 'requiresOnboarding'].forEach(function(f) {
        if (typeof e[f] !== 'boolean') {
          throw new Error('[Rga.Settings.Registry] ' + e.id + ': field "' + f + '" must be boolean');
        }
      });
      ['dependencies', 'keywords', 'aliases'].forEach(function(f) {
        if (!Array.isArray(e[f])) {
          throw new Error('[Rga.Settings.Registry] ' + e.id + ': field "' + f + '" must be an array');
        }
      });
      if (typeof e.label !== 'string' || e.label.length === 0) {
        throw new Error('[Rga.Settings.Registry] ' + e.id + ': label must be a non-empty string');
      }
      if (typeof e.description !== 'string' || e.description.length === 0) {
        throw new Error('[Rga.Settings.Registry] ' + e.id + ': description must be a non-empty string');
      }
      // select/radio require an options array containing the default.
      if (e.type === 'select' || e.type === 'radio') {
        if (!Array.isArray(e.options) || e.options.length === 0) {
          throw new Error('[Rga.Settings.Registry] ' + e.id +
            ': select/radio must declare a non-empty options array');
        }
        if (e.options.indexOf(e.default) < 0) {
          throw new Error('[Rga.Settings.Registry] ' + e.id +
            ': default "' + e.default + '" not in options ' +
            JSON.stringify(e.options));
        }
      }
      // Optional `labels` map: human-readable display strings keyed by
      // option value. Constitutional rule #1 — when a setting becomes
      // interactive, its labels must be human. Validator enforces that
      // every label key is a real option; missing keys are tolerated
      // (display falls back to the raw code).
      //
      // H7 — color entries also carry options + labels (the color
      // swatch control reads labels for human swatch names per RC1
      // §15.9). The validator treats select/radio/color the same way:
      // labels must key into options, every label value must be a
      // non-empty string.
      if (e.labels !== undefined) {
        if (typeof e.labels !== 'object' || e.labels === null || Array.isArray(e.labels)) {
          throw new Error('[Rga.Settings.Registry] ' + e.id +
            ': labels must be a plain object keyed by option value');
        }
        if (e.type !== 'select' && e.type !== 'radio' && e.type !== 'color') {
          throw new Error('[Rga.Settings.Registry] ' + e.id +
            ': labels are only meaningful on select/radio/color entries');
        }
        if (!Array.isArray(e.options)) {
          throw new Error('[Rga.Settings.Registry] ' + e.id +
            ': labels requires an options array');
        }
        Object.keys(e.labels).forEach(function(key) {
          if (e.options.indexOf(key) < 0) {
            throw new Error('[Rga.Settings.Registry] ' + e.id +
              ': labels key "' + key + '" is not in options ' +
              JSON.stringify(e.options));
          }
          if (typeof e.labels[key] !== 'string' || e.labels[key].length === 0) {
            throw new Error('[Rga.Settings.Registry] ' + e.id +
              ': labels["' + key + '"] must be a non-empty string');
          }
        });
      }
      // Default must pass the type validator.
      if (!validators.validateValue(e, e.default)) {
        throw new Error('[Rga.Settings.Registry] ' + e.id +
          ': default value ' + JSON.stringify(e.default) +
          ' fails the ' + e.type + ' validator');
      }
      // Each dependency must reference a registered id.
      e.dependencies.forEach(function(dep) {
        if (!dep || typeof dep.id !== 'string') {
          throw new Error('[Rga.Settings.Registry] ' + e.id +
            ': dependency must be {id, ...} object');
        }
      });
    });

    // Second pass — cross-reference dependency ids (now that every id
    // is known). This split lets self-referential or forward refs all
    // be caught uniformly without depending on declaration order.
    entries.forEach(function(e) {
      e.dependencies.forEach(function(dep) {
        if (!seen.has(dep.id)) {
          throw new Error('[Rga.Settings.Registry] ' + e.id +
            ': dependency references unknown id "' + dep.id + '"');
        }
      });
    });
  }

  _validate(ENTRIES);

  // --------------------------------------------------------------
  // Indexed lookup. Built once after validation; the public API
  // reads from this map, never re-scans ENTRIES.
  // --------------------------------------------------------------

  const _byId = new Map();
  ENTRIES.forEach(function(e) { _byId.set(e.id, e); });

  function has(id)        { return _byId.has(id); }
  function get(id)        { return _byId.get(id) || null; }
  function getDefault(id) {
    const e = _byId.get(id);
    return e ? e.default : undefined;
  }
  function all()          { return ENTRIES.slice(); }
  function ids()          { return Array.from(_byId.keys()); }

  Rga.Settings.Registry = { has, get, getDefault, all, ids };
})();
