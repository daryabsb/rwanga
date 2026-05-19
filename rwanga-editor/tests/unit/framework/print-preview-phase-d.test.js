// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase D tests — Print Preview reachability + page-stack restoration.
//
// Covers acceptance gates for D.1–D.5:
//   D.1 — menu entry + dropdown option + open() helper + IPC routing
//   D.2 — sheet padding from layoutProfile.margins + dimensions from pageSize
//   D.3 — optional bottom-center page number (footerStyle opt-in)
//   D.4 — optional running header (headerStyle opt-in, title from metadata)
//   D.5 — PageDown/PageUp keyboard registration + Esc-to-exit
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs   = require('node:fs');
const path = require('node:path');

const RENDERER_ROOT = path.resolve(__dirname, '../../../renderer');
const ELECTRON_ROOT = path.resolve(__dirname, '../../../electron');

// ================================================================
// D.1 — electron/menu.js File menu contains "Print Preview" entry
// ================================================================

test('D.1 menu: electron/menu.js File menu has a "Print Preview" item', () => {
  const src = fs.readFileSync(path.join(ELECTRON_ROOT, 'menu.js'), 'utf8');
  assert.ok(src.includes('Print Preview'), 'menu.js must contain "Print Preview" label');
  assert.ok(src.includes("'view.printPreview'"), 'menu.js must use action view.printPreview');
});

test('D.1 menu: electron/menu.js "Print Preview" item has NO accelerator property', () => {
  const src = fs.readFileSync(path.join(ELECTRON_ROOT, 'menu.js'), 'utf8');
  // Find the Print Preview line and confirm no accelerator key adjacent.
  // Extract the object literal containing 'Print Preview' by looking at
  // the surrounding context (the label + click lines, no accelerator).
  const lines = src.split('\n');
  const ppLineIdx = lines.findIndex(function(l) {
    return l.includes('Print Preview') && l.includes('view.printPreview');
  });
  assert.ok(ppLineIdx >= 0, 'Print Preview entry must exist in menu.js');
  // The line itself must not contain 'accelerator'.
  assert.equal(lines[ppLineIdx].includes('accelerator'), false,
    'Print Preview entry must have no accelerator (SP-17: Ctrl+Shift+P reserved)');
  // No 'CommandOrControl+Shift+P' anywhere near it (±3 lines).
  const ctx = lines.slice(Math.max(0, ppLineIdx - 1), ppLineIdx + 2).join('\n');
  assert.equal(ctx.includes('CommandOrControl+Shift+P'), false,
    'No Ctrl+Shift+P binding must appear near the Print Preview entry');
});

// ================================================================
// D.1 — status-bar dropdown: printPreview option is NOT disabled/hidden
// ================================================================

function bootStatusBar(opts) {
  opts = opts || {};
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><footer id="status-bar"></footer></body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  // Stubs for dependencies.
  global.window.Rga.TabManager = {
    activeDoc: function() { return opts.activeDoc || null; },
    _editorView: function() { return opts.activeView || null; }
  };
  global.window.Rga.ViewManager = {
    current: function() { return 'flow'; },
    onChange: function() { return function() {}; },
    activate: function() {}
  };
  global.window.Rga.ViewMode = {
    setCalledWith: null,
    set: function(m) { this.setCalledWith = m; },
    get: function() { return 'flow'; }
  };
  // D.1 — PrintPreview stub to verify dropdown routing.
  global.window.Rga.PrintPreview = {
    openCalled: false,
    open: function() { this.openCalled = true; return true; },
    isActive: function() { return false; }
  };
  global.window.Rga.Nav = { getIndex: function() { return { scenes: [], pages: [] }; }, getPageMap: function() { return []; }, getOutline: function() { return { statistics: { words: 0, sceneCount: 0, pages: 0 } }; } };
  global.window.Rga.Theme = { current: 'dark', _listeners: [], toggle: function() {}, onChange: function(fn) { this._listeners.push(fn); return function() {}; } };

  [
    path.join(RENDERER_ROOT, 'js/shell/layout.js'),
    path.join(RENDERER_ROOT, 'js/shell/sidebar.js'),
    path.join(RENDERER_ROOT, 'js/shell/script-session.js'),
    path.join(RENDERER_ROOT, 'js/shell/script-metrics.js'),
    path.join(RENDERER_ROOT, 'js/shell/status-bar.js')
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.Shell.StatusBar._reset();
  Rga.ScriptSession.init();
  Rga.Shell.StatusBar.init(dom.window.document.getElementById('status-bar'));
  return { Rga, dom, status: dom.window.document.getElementById('status-bar') };
}

test('D.1 dropdown: printPreview <option> is NOT disabled', () => {
  const { status } = bootStatusBar();
  const sel = status.querySelector('select.rga-shell-status-viewmode-select');
  const ppOpt = Array.from(sel.options).find(function(o) { return o.value === 'printPreview'; });
  assert.ok(ppOpt, 'printPreview option must exist in the dropdown');
  assert.equal(ppOpt.disabled, false, 'printPreview option must NOT be disabled (D.1)');
});

test('D.1 dropdown: printPreview <option> is NOT hidden', () => {
  const { status } = bootStatusBar();
  const sel = status.querySelector('select.rga-shell-status-viewmode-select');
  const ppOpt = Array.from(sel.options).find(function(o) { return o.value === 'printPreview'; });
  assert.ok(ppOpt, 'printPreview option must exist in the dropdown');
  assert.equal(ppOpt.hidden, false, 'printPreview option must NOT be hidden (D.1)');
});

test('D.1 dropdown: selecting printPreview calls Rga.PrintPreview.open() (not ViewMode.set)', () => {
  const { Rga, status } = bootStatusBar();
  const sel = status.querySelector('select.rga-shell-status-viewmode-select');
  sel.value = 'printPreview';
  sel.dispatchEvent(new global.window.Event('change'));
  assert.equal(Rga.PrintPreview.openCalled, true,
    'change event for printPreview must call Rga.PrintPreview.open()');
  assert.equal(Rga.ViewMode.setCalledWith, null,
    'change event for printPreview must NOT call Rga.ViewMode.set');
});

// ================================================================
// D.1 — Rga.PrintPreview.open() helper
// ================================================================

function bootPrintPreview(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};

  const PM = require('prosemirror-state');
  const PMview = require('prosemirror-view');
  const PMmodel = require('prosemirror-model');
  global.window.RgaProseMirror = {
    EditorState: PM.EditorState, EditorView: PMview.EditorView,
    Schema: PMmodel.Schema, PMNode: PMmodel.Node, Plugin: PM.Plugin,
    PluginKey: PM.PluginKey, TextSelection: PM.TextSelection,
    Decoration: PMview.Decoration, DecorationSet: PMview.DecorationSet
  };

  [
    path.join(RENDERER_ROOT, 'js/framework/base-outer-marks.js'),
    path.join(RENDERER_ROOT, 'js/framework/screenplay-normalizer.js'),
    path.join(RENDERER_ROOT, 'js/framework/layout-profile.js'),
    path.join(RENDERER_ROOT, 'js/framework/pagemap-engine.js'),
    path.join(RENDERER_ROOT, 'js/framework/view-manager.js'),
    path.join(RENDERER_ROOT, 'js/framework/render-model.js'),
    path.join(RENDERER_ROOT, 'js/framework/print-renderer.js'),
    path.join(RENDERER_ROOT, 'js/framework/print-preview.js'),
    path.join(RENDERER_ROOT, 'js/doc-types/screenplay/schema-v3.js')
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  const sp = Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();

  // TabManager stub.
  Rga.TabManager = {
    _view: opts.view || null,
    _editorView: function() { return this._view; },
    activeDoc: function() { return opts.activeDoc || null; }
  };

  return { Rga, schema, PM: global.window.RgaProseMirror, dom };
}

function buildSimpleView(schema, PM) {
  const heading = schema.nodes.sceneHeading.create(
    { setting: 'INT.', time: 'DAY', headingStyle: null },
    schema.text('ROOM')
  );
  const action = schema.nodes.action.create(null, schema.text('Action.'));
  const scene = schema.nodes.scene.create(
    { id: 'sc1', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading, action]
  );
  const body = schema.nodes.body.create(null, [scene]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const doc = schema.nodes.doc.create(null, [title, body]);
  const state = PM.EditorState.create({ schema, doc, plugins: [] });
  return new PM.EditorView(document.getElementById('editor'), { state });
}

test('D.1 open(): returns false when TabManager is unavailable', () => {
  const { Rga } = bootPrintPreview();
  delete Rga.TabManager;
  const result = Rga.PrintPreview.open();
  assert.equal(result, false, 'open() returns false when TabManager is not available');
});

test('D.1 open(): returns false when _editorView() returns null', () => {
  const { Rga } = bootPrintPreview({ view: null });
  const result = Rga.PrintPreview.open();
  assert.equal(result, false, 'open() returns false when _editorView() is null');
});

test('D.1 open(): returns true and shows preview when editor view is available', () => {
  const { Rga, schema, PM } = bootPrintPreview();
  const view = buildSimpleView(schema, PM);
  Rga.TabManager._view = view;
  const result = Rga.PrintPreview.open();
  assert.equal(result, true, 'open() returns true when editor view is available');
  assert.equal(Rga.PrintPreview.isActive(), true, 'preview must be active after open()');
  Rga.PrintPreview.hide();
  view.destroy();
});

// ================================================================
// D.2 — sheet padding from layoutProfile.margins
// ================================================================

function bootRenderer() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  [
    path.join(RENDERER_ROOT, 'js/framework/print-renderer.js')
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return { PR: global.window.Rga.PrintRenderer };
}

function fakeModel(pages, layoutProfile) {
  return {
    totalPages: pages.length,
    pages: pages.map(function(p, i) {
      return {
        pageNumber: p.pageNumber || (i + 1),
        usedLines: 0,
        availableLines: 54,
        blocks: p.blocks || []
      };
    }),
    layoutProfile: layoutProfile || null,
    title: ''
  };
}

test('D.2 sheet padding: renders inline padding from layoutProfile.margins', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  const lp = {
    margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 1.0 },
    pageSize: { w: 8.5, h: 11.0 },
    direction: 'ltr'
  };
  PR.render(fakeModel([{ blocks: [] }], lp), container);
  const sheet = container.querySelector('.rga-page-sheet');
  assert.ok(sheet, 'sheet must exist');
  // Inline padding must reflect the layoutProfile margins (T R B L).
  assert.equal(sheet.style.padding, '0.5in 0.5in 0.5in 1in',
    'sheet padding must reflect layoutProfile.margins (top right bottom left)');
});

test('D.2 sheet dimensions: renders inline width from layoutProfile.pageSize (A4)', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  const lp = {
    margins: { top: 1.0, right: 1.0, bottom: 1.0, left: 1.5 },
    pageSize: { w: 8.2677, h: 11.6929 },
    direction: 'ltr'
  };
  PR.render(fakeModel([{ blocks: [] }], lp), container);
  const sheet = container.querySelector('.rga-page-sheet');
  assert.ok(sheet, 'sheet must exist');
  assert.equal(sheet.style.width, '8.2677in',
    'sheet width must reflect A4 pageSize.w from layoutProfile');
});

test('D.2 sheet dimensions: sheet never gets an inline height override', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  const lp = {
    margins: { top: 1.0, right: 1.0, bottom: 1.0, left: 1.5 },
    pageSize: { w: 8.5, h: 11.0 },
    direction: 'ltr'
  };
  PR.render(fakeModel([{ blocks: [] }, { blocks: [] }], lp), container);
  container.querySelectorAll('.rga-page-sheet').forEach(function(s) {
    assert.equal(s.style.height, '',
      'sheet must never carry an inline height — CSS-fixed only');
  });
});

test('D.2 RTL mirror: wider binding margin sits on the right for RTL layoutProfile', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  // LTR convention: left=1.5in (binding), right=1.0in.
  // RTL convention: the SAME numeric margin values but mirrored;
  // Hollywood-default RTL would have right=1.5in, left=1.0in visually.
  // We model this as: direction='rtl' with margins {left:1.0, right:1.5}.
  // The renderer should put the larger value (1.5in) on the visual right
  // for the binding (i.e. CSS padding-right = m.left = 1.0... wait,
  // RTL mirror means swap left↔right: paddingLeft=m.right, paddingRight=m.left).
  // With margins {left:1.0, right:1.5, top:1, bottom:1} and direction='rtl':
  //   paddingLeft  = m.right = 1.5in  (binding side in RTL = visual right)
  //   paddingRight = m.left  = 1.0in
  // Actual CSS: padding = 1in 1in 1in 1.5in (T R B L) → but with RTL swap.
  // Let's use margins {left:1.5, right:1.0} for clear LTR default.
  // RTL mirror: paddingLeft=m.right=1.0, paddingRight=m.left=1.5.
  // So the wider binding margin (1.5in) moves to CSS padding-right (the
  // visual right side in RTL where the binding is).
  const lp = {
    margins: { top: 1.0, right: 1.0, bottom: 1.0, left: 1.5 },
    pageSize: { w: 8.5, h: 11.0 },
    direction: 'rtl'
  };
  PR.render(fakeModel([{ blocks: [] }], lp), container);
  const sheet = container.querySelector('.rga-page-sheet');
  // With direction=rtl, left and right are swapped.
  // paddingLeft = m.right = 1.0in; paddingRight = m.left = 1.5in.
  // CSS shorthand: 1in (top) 1.5in (right) 1in (bottom) 1in (left).
  assert.equal(sheet.style.padding, '1in 1.5in 1in 1in',
    'RTL: wider binding margin (1.5in) must appear as padding-right in CSS shorthand');
});

test('D.2 fallback: no layoutProfile → no inline padding or width override', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [] }], null), container);
  const sheet = container.querySelector('.rga-page-sheet');
  assert.equal(sheet.style.padding, '', 'without layoutProfile, no inline padding should be set');
  assert.equal(sheet.style.width, '', 'without layoutProfile, no inline width should be set');
});

// ================================================================
// D.3 — optional bottom-center page number
// ================================================================

test('D.3 default: rendering without opts.footerStyle produces NO .rga-page-sheet-footer', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [] }, { blocks: [] }]), container);
  const footers = container.querySelectorAll('.rga-page-sheet-footer');
  assert.equal(footers.length, 0,
    'default render must produce no .rga-page-sheet-footer elements');
});

test('D.3 opt-in: footerStyle="bottom-center" produces one .rga-page-sheet-footer per sheet', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  PR.render(
    fakeModel([{ pageNumber: 1, blocks: [] }, { pageNumber: 2, blocks: [] }]),
    container,
    { footerStyle: 'bottom-center' }
  );
  const footers = container.querySelectorAll('.rga-page-sheet-footer');
  assert.equal(footers.length, 2, 'one footer per sheet when footerStyle="bottom-center"');
  assert.equal(footers[0].textContent, '1', 'footer on page 1 must show page number "1"');
  assert.equal(footers[1].textContent, '2', 'footer on page 2 must show page number "2"');
});

test('D.3 default header unchanged: top-right "N." header always present regardless of opts', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  PR.render(
    fakeModel([{ pageNumber: 3, blocks: [] }]),
    container,
    { footerStyle: 'bottom-center' }
  );
  const header = container.querySelector('.rga-page-sheet-header');
  assert.ok(header, '.rga-page-sheet-header must always exist');
  assert.equal(header.textContent, '3.', 'top-right header shows "N." regardless of footerStyle');
});

// ================================================================
// D.4 — optional running header
// ================================================================

test('D.4 default: rendering without opts.headerStyle produces NO .rga-page-sheet-running-header', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [] }, { blocks: [] }]), container);
  const headers = container.querySelectorAll('.rga-page-sheet-running-header');
  assert.equal(headers.length, 0,
    'default render must produce no .rga-page-sheet-running-header elements');
});

test('D.4 opt-in: headerStyle="running" produces one .rga-page-sheet-running-header per sheet', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  const model = Object.assign(
    fakeModel([{ blocks: [] }, { blocks: [] }]),
    { title: 'The Last Light' }
  );
  PR.render(model, container, { headerStyle: 'running' });
  const headers = container.querySelectorAll('.rga-page-sheet-running-header');
  assert.equal(headers.length, 2, 'one running header per sheet when headerStyle="running"');
  headers.forEach(function(h) {
    assert.equal(h.textContent, 'The Last Light',
      'running header must contain doc.metadata.title text');
  });
});

test('D.4 opt-in with empty title: running header renders empty (no error)', () => {
  const { PR } = bootRenderer();
  const container = document.createElement('div');
  const model = Object.assign(fakeModel([{ blocks: [] }]), { title: '' });
  PR.render(model, container, { headerStyle: 'running' });
  const headers = container.querySelectorAll('.rga-page-sheet-running-header');
  assert.equal(headers.length, 1, 'running header element must still be rendered');
  assert.equal(headers[0].textContent, '', 'empty title renders empty text (no error)');
});

// ================================================================
// D.5 — PageUp/PageDown keyboard registration + Esc-to-exit
// ================================================================

function bootKeyboardPrintPreview() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};

  [
    path.join(RENDERER_ROOT, 'js/shell/keyboard-registry.js'),
    path.join(RENDERER_ROOT, 'js/framework/view-manager.js'),
    path.join(RENDERER_ROOT, 'js/framework/render-model.js'),
    path.join(RENDERER_ROOT, 'js/framework/print-renderer.js'),
    path.join(RENDERER_ROOT, 'js/framework/print-preview.js')
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.KeyboardRegistry.init();

  // Minimal TabManager stub.
  Rga.TabManager = { _editorView: function() { return null; }, activeDoc: function() { return null; } };

  return { Rga, dom };
}

test('D.5 PageDown: KeyboardRegistry has a PageDown binding for print-preview', () => {
  const { Rga } = bootKeyboardPrintPreview();
  const all = Rga.KeyboardRegistry._all();
  // The combo key is 'pagedown' (KeyboardEvent.key lowercased, no modifiers).
  assert.ok(all['pagedown'], 'KeyboardRegistry must have a "pagedown" binding');
  assert.ok(all['pagedown'].source.includes('PrintPreview') || all['pagedown'].source.includes('PgDn'),
    'PageDown binding source must identify Rga.PrintPreview');
});

test('D.5 PageUp: KeyboardRegistry has a PageUp binding for print-preview', () => {
  const { Rga } = bootKeyboardPrintPreview();
  const all = Rga.KeyboardRegistry._all();
  assert.ok(all['pageup'], 'KeyboardRegistry must have a "pageup" binding');
  assert.ok(all['pageup'].source.includes('PrintPreview') || all['pageup'].source.includes('PgUp'),
    'PageUp binding source must identify Rga.PrintPreview');
});

test('D.5 PageDown: when() predicate is false when Print Preview is not active', () => {
  const { Rga } = bootKeyboardPrintPreview();
  const all = Rga.KeyboardRegistry._all();
  const entry = all['pagedown'];
  assert.ok(entry && entry.opts && typeof entry.opts.when === 'function',
    'PageDown binding must have a when predicate');
  // isActive() returns false when no preview is shown.
  assert.equal(entry.opts.when(), false,
    'PageDown when() must return false when Print Preview is not active');
});

test('D.5 PageUp: when() predicate is false when Print Preview is not active', () => {
  const { Rga } = bootKeyboardPrintPreview();
  const all = Rga.KeyboardRegistry._all();
  const entry = all['pageup'];
  assert.ok(entry && entry.opts && typeof entry.opts.when === 'function',
    'PageUp binding must have a when predicate');
  assert.equal(entry.opts.when(), false,
    'PageUp when() must return false when Print Preview is not active');
});

test('D.5 Esc: KeyboardRegistry has an Escape binding for print-preview exit', () => {
  const { Rga } = bootKeyboardPrintPreview();
  const all = Rga.KeyboardRegistry._all();
  assert.ok(all['escape'], 'KeyboardRegistry must have an "escape" binding');
  // The last-registered Escape wins. Verify it belongs to PrintPreview.
  assert.ok(all['escape'].source.includes('PrintPreview'),
    'Escape binding source must identify Rga.PrintPreview (it is the last-registered Esc)');
});

test('D.5 Esc: when() predicate gates on isActive() — false when inactive', () => {
  const { Rga } = bootKeyboardPrintPreview();
  const all = Rga.KeyboardRegistry._all();
  const entry = all['escape'];
  assert.ok(entry && entry.opts && typeof entry.opts.when === 'function',
    'Esc binding must have a when predicate');
  assert.equal(entry.opts.when(), false,
    'Esc when() must return false when Print Preview is not active');
});

// ================================================================
// D.3/D.4 — options API: setOptions / getOptions
// ================================================================

test('D.3/D.4 options API: getOptions() returns default {footerStyle:"none", headerStyle:"none"}', () => {
  const { Rga } = bootPrintPreview();
  const opts = Rga.PrintPreview.getOptions();
  assert.equal(opts.footerStyle, 'none', 'default footerStyle must be "none"');
  assert.equal(opts.headerStyle, 'none', 'default headerStyle must be "none"');
});

test('D.3/D.4 options API: setOptions() updates the stored options', () => {
  const { Rga } = bootPrintPreview();
  Rga.PrintPreview.setOptions({ footerStyle: 'bottom-center' });
  const opts = Rga.PrintPreview.getOptions();
  assert.equal(opts.footerStyle, 'bottom-center', 'setOptions must update footerStyle');
  assert.equal(opts.headerStyle, 'none', 'setOptions must preserve unset keys');
});

test('D.3/D.4 options API: setOptions() is a merge (does not erase unset keys)', () => {
  const { Rga } = bootPrintPreview();
  Rga.PrintPreview.setOptions({ headerStyle: 'running' });
  Rga.PrintPreview.setOptions({ footerStyle: 'bottom-center' });
  const opts = Rga.PrintPreview.getOptions();
  assert.equal(opts.headerStyle, 'running', 'setOptions merge must preserve headerStyle');
  assert.equal(opts.footerStyle, 'bottom-center', 'setOptions merge must preserve footerStyle');
});

// ================================================================
// D.4 — render-model.js carries title from doc.metadata.title
// ================================================================

function bootRenderModel() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  [
    path.join(RENDERER_ROOT, 'js/framework/render-model.js')
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return { RM: global.window.Rga.RenderModel };
}

test('D.4 render-model: build() carries title from doc.metadata.title', () => {
  const { RM } = bootRenderModel();
  const fakeDoc = {
    metadata: { title: 'The Last Light' },
    nodeAt: function() { return null; }
  };
  const model = RM.build(fakeDoc, [], []);
  assert.equal(model.title, 'The Last Light',
    'RenderModel.title must reflect doc.metadata.title');
});

test('D.4 render-model: build() title is empty string when doc.metadata.title is absent', () => {
  const { RM } = bootRenderModel();
  const fakeDoc = {
    metadata: {},
    nodeAt: function() { return null; }
  };
  const model = RM.build(fakeDoc, [], []);
  assert.equal(model.title, '', 'RenderModel.title must be empty string when absent');
});

// ================================================================
// D.2 — layout-profile.js: compose() carries direction field
// ================================================================

function bootLayoutProfile() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  [
    path.join(RENDERER_ROOT, 'js/framework/layout-profile.js')
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return { LP: global.window.Rga.LayoutProfile };
}

test('D.2 layout-profile: compose() with ltr screenplayProfile returns direction="ltr"', () => {
  const { LP } = bootLayoutProfile();
  const profile = LP.compose({ direction: 'ltr' }, null);
  assert.equal(profile.direction, 'ltr', 'compose() must carry direction="ltr"');
});

test('D.2 layout-profile: compose() with rtl screenplayProfile returns direction="rtl"', () => {
  const { LP } = bootLayoutProfile();
  const profile = LP.compose({ direction: 'rtl' }, null);
  assert.equal(profile.direction, 'rtl', 'compose() must carry direction="rtl"');
});

test('D.2 layout-profile: compose() with no screenplayProfile defaults to direction="ltr"', () => {
  const { LP } = bootLayoutProfile();
  const profile = LP.compose(null, null);
  assert.equal(profile.direction, 'ltr', 'compose() must default to direction="ltr"');
});
