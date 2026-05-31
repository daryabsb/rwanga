// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Layout — Slice 3B.
//
// Presentation map for the (future) Settings UI: which sections to
// show, in what order, with which settings inside each. Layout is
// independent of the registry — it references registry ids but the
// registry knows nothing about layout. Sections + order match the
// design files at docs/rwanga-settings/settings-data.jsx.
//
// Slice 3B ships:
//   - section declaration (id, label, description, icon, settingIds)
//   - public lookup API
//   - load-time cross-validation against Rga.Settings.Registry
//
// Slice 3B explicitly does NOT ship:
//   - Settings tab content / Ctrl+, / any UI
//   - sub-grouping inside sections (settings-data.jsx didn't use them)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Settings = Rga.Settings || {};

  // --------------------------------------------------------------
  // Sections. Field values copied from docs/rwanga-settings/
  // settings-data.jsx (label + icon) with descriptions added — the
  // design file did not carry per-section descriptions; brief
  // writer-facing copy is supplied here.
  // --------------------------------------------------------------

  const SECTIONS = [
    {
      id: 'general',
      label: 'General',
      description: 'Language, theme, and session preferences that affect the whole app.',
      icon: 'settings',
      settingIds: [
        'language', 'theme', 'windowZoom', 'units',
        'recentFilesLimit', 'confirmBeforeClose', 'restoreLastSession'
      ]
    },
    {
      id: 'editor',
      label: 'Editor',
      description: 'Font, spacing, and writing-surface behavior for Flow View.',
      icon: 'editor',
      settingIds: [
        'editor.fontFamily', 'editor.fontSize', 'editor.lineHeight',
        'editor.spellcheck', 'editor.autocomplete', 'editor.showLineNumbers',
        'editor.pageColor',
        'editor.highlightCurrentLine', 'editor.wordWrap', 'editor.scriptLanguage'
      ]
    },
    {
      id: 'screenplay',
      label: 'Screenplay',
      description: 'Industry formatting profile, scene numbering, and dialogue continuations.',
      icon: 'screenplay',
      settingIds: [
        'screenplay.profile', 'screenplay.sceneNumbering',
        'screenplay.sceneNumberPosition', 'screenplay.dialogueContinued',
        'screenplay.moreAndContinued', 'screenplay.boldSceneHeaders',
        'screenplay.underlineSceneHeaders'
      ]
    },
    {
      id: 'pageSetup',
      label: 'Page Setup',
      description: 'Paper size, orientation, margins, and page-number placement.',
      icon: 'page',
      settingIds: [
        'pageSetup.paperSize', 'pageSetup.orientation', 'pageSetup.margins',
        'pageSetup.pageNumbers', 'pageSetup.pageNumberPosition',
        'pageSetup.headerText', 'pageSetup.footerText'
      ]
    },
    {
      id: 'printExport',
      label: 'Print / Export',
      description: 'Default format, branding, watermark, and color handling for exports.',
      icon: 'export',
      settingIds: [
        'export.defaultFormat', 'export.includeSceneNumbers',
        'export.includeTitlePage', 'export.revisionMarks',
        'export.branding', 'export.watermark', 'export.colorMode'
      ]
    },
    {
      id: 'autosave',
      label: 'Autosave & Files',
      description: 'Save cadence, version history, backups, and default file locations.',
      icon: 'autosave',
      settingIds: [
        'autosave.enabled', 'autosave.interval', 'autosave.maxVersions',
        'files.defaultSaveFormat', 'files.backupOnOpen', 'files.defaultDirectory'
      ]
    },
    {
      id: 'appearance',
      label: 'Appearance',
      description: 'Sidebar, status bar, minimap, and desk-color choices for the editor chrome.',
      icon: 'appearance',
      settingIds: [
        'appearance.sidebarPosition', 'appearance.activityBar',
        'appearance.statusBar', 'appearance.minimap',
        'appearance.editorPageShadow', 'appearance.editorDeskColor',
        'appearance.formatToolbar'
      ]
    },
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'Key bindings for command palette, save, find, navigation, and export.',
      icon: 'keyboard',
      settingIds: [
        'kb.commandPalette', 'kb.save', 'kb.saveAs', 'kb.find',
        'kb.replace', 'kb.toggleSidebar', 'kb.toggleTheme',
        'kb.exportPdf', 'kb.sceneNavigator', 'kb.quickSceneJump'
      ]
    },
    {
      id: 'advanced',
      label: 'Advanced',
      description: 'Debug overlays, experimental features, and console verbosity.',
      icon: 'advanced',
      settingIds: [
        'advanced.debugMode', 'advanced.showPageMap',
        'advanced.enableExperimental', 'advanced.logLevel'
      ]
    }
  ];

  // Registry ids deliberately omitted from any section. Empty in
  // Slice 3B — every registry id has a place in the UI. Future
  // entries (internal-only settings) can be listed here so the
  // cross-validator stays happy.
  const HIDDEN_IDS = [];

  // --------------------------------------------------------------
  // Validation. Runs once at module load. Throws on the first
  // mistake. The registry must already be loaded — index.html
  // enforces that load order; unit tests do the same.
  // --------------------------------------------------------------

  function _validate() {
    const reg = Rga.Settings && Rga.Settings.Registry;
    if (!reg || typeof reg.has !== 'function') {
      throw new Error('[Rga.Settings.Layout] Rga.Settings.Registry must load first');
    }

    const sectionIds = new Set();
    const settingPlacements = new Map();

    SECTIONS.forEach(function(section, i) {
      // Required fields.
      ['id', 'label', 'description', 'icon', 'settingIds'].forEach(function(f) {
        if (!Object.prototype.hasOwnProperty.call(section, f)) {
          throw new Error('[Rga.Settings.Layout] section #' + i +
            ' missing required field "' + f + '"');
        }
      });
      if (typeof section.id !== 'string' || section.id.length === 0) {
        throw new Error('[Rga.Settings.Layout] section #' + i + ' has empty id');
      }
      if (sectionIds.has(section.id)) {
        throw new Error('[Rga.Settings.Layout] duplicate section id: ' + section.id);
      }
      sectionIds.add(section.id);
      if (!Array.isArray(section.settingIds) || section.settingIds.length === 0) {
        throw new Error('[Rga.Settings.Layout] section "' + section.id +
          '" must have a non-empty settingIds array');
      }

      // Cross-validation against registry.
      section.settingIds.forEach(function(id) {
        if (!reg.has(id)) {
          throw new Error('[Rga.Settings.Layout] section "' + section.id +
            '" references unknown registry id: ' + id);
        }
        if (settingPlacements.has(id)) {
          throw new Error('[Rga.Settings.Layout] setting "' + id +
            '" appears in both "' + settingPlacements.get(id) +
            '" and "' + section.id + '"');
        }
        settingPlacements.set(id, section.id);
      });
    });

    // HIDDEN_IDS coverage: every entry must exist in the registry.
    HIDDEN_IDS.forEach(function(id) {
      if (!reg.has(id)) {
        throw new Error('[Rga.Settings.Layout] HIDDEN_IDS references unknown registry id: ' + id);
      }
    });

    // Every registry id must be covered — section or hidden.
    const hiddenSet = new Set(HIDDEN_IDS);
    reg.ids().forEach(function(id) {
      if (!settingPlacements.has(id) && !hiddenSet.has(id)) {
        throw new Error('[Rga.Settings.Layout] registry id "' + id +
          '" is in neither a section nor HIDDEN_IDS');
      }
    });
  }

  _validate();

  // --------------------------------------------------------------
  // Indexed lookup. Built once after validation.
  // --------------------------------------------------------------

  const _sectionById = new Map();
  const _sectionBySetting = new Map();
  SECTIONS.forEach(function(s) {
    _sectionById.set(s.id, s);
    s.settingIds.forEach(function(id) { _sectionBySetting.set(id, s); });
  });

  function sections()              { return SECTIONS.slice(); }
  function getSection(id)          { return _sectionById.get(id) || null; }
  function getSectionFor(settingId) {
    return _sectionBySetting.get(settingId) || null;
  }
  function hiddenIds()             { return HIDDEN_IDS.slice(); }

  Rga.Settings.Layout = { sections, getSection, getSectionFor, hiddenIds };
})();
