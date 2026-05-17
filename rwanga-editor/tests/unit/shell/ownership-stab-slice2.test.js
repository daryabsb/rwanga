// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Runtime Ownership Stabilization Slice 2 — regression tests.
// Covers acceptance for sections A (Keyboard) and B (Theme).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '../../..');
const APP_SHELL_JS    = path.join(REPO, 'renderer', 'js', 'app-shell.js');
const SHELL_INDEX_JS  = path.join(REPO, 'renderer', 'js', 'shell', 'index.js');
const VIEW_MODE_JS    = path.join(REPO, 'renderer', 'js', 'view-mode.js');
const INDEX_HTML      = path.join(REPO, 'renderer', 'index.html');
const KEYBOARD_REG_JS = path.join(REPO, 'renderer', 'js', 'shell', 'keyboard-registry.js');

function readText(file) { return fs.readFileSync(file, 'utf8'); }

function freshJSDOM(html) {
  const dom = new JSDOM(html || '<!DOCTYPE html><html><body></body></html>',
                        { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.window.Rga = {};
  global.Rga = global.window.Rga;
  // app-shell.js's Rga.Toast.show consults Rga.$ — provide the shim
  // so Theme.toggle (which calls Toast.show) doesn't throw in tests.
  global.window.Rga.$  = function(sel, root) { return (root || document).querySelector(sel); };
  global.window.Rga.$$ = function(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  return dom;
}

function reloadModules(paths) {
  paths.forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
}

function fireKey(opts) {
  const e = new global.KeyboardEvent('keydown',
    Object.assign({ bubbles: true, cancelable: true }, opts));
  document.dispatchEvent(e);
  return e;
}

// ================================================================
// A — Keyboard ownership consolidation
// ================================================================

test('A: Rga.KeyboardRegistry exists with the documented public API', () => {
  freshJSDOM();
  reloadModules(['../../../renderer/js/shell/keyboard-registry.js']);
  const Rga = global.window.Rga;
  assert.ok(Rga.KeyboardRegistry, 'Rga.KeyboardRegistry must be exposed');
  ['init', 'register', '_reset', '_all'].forEach(function(name) {
    assert.equal(typeof Rga.KeyboardRegistry[name], 'function',
      'Rga.KeyboardRegistry.' + name + ' must be a function');
  });
});

test('A: register → fire → handler runs; unregister stops further dispatch', () => {
  freshJSDOM();
  reloadModules(['../../../renderer/js/shell/keyboard-registry.js']);
  const Rga = global.window.Rga;
  Rga.KeyboardRegistry._reset();
  Rga.KeyboardRegistry.init();

  let calls = 0;
  const off = Rga.KeyboardRegistry.register('p', { ctrl: true, shift: true },
    function() { calls += 1; }, 'test');

  fireKey({ key: 'p', ctrlKey: true, shiftKey: true });
  assert.equal(calls, 1, 'handler fires once');

  fireKey({ key: 'p', ctrlKey: true, shiftKey: true });
  assert.equal(calls, 2, 'handler fires again on second keydown');

  off();
  fireKey({ key: 'p', ctrlKey: true, shiftKey: true });
  assert.equal(calls, 2, 'after unregister: no further dispatch');
});

test('A: only ONE document.keydown listener after full app boot (no duplicate listeners)', () => {
  // Count addEventListener calls for keydown by patching the document
  // method before any module loads.
  freshJSDOM();
  let keydownAttaches = 0;
  const originalAdd = global.document.addEventListener;
  global.document.addEventListener = function(type) {
    if (type === 'keydown') keydownAttaches += 1;
    return originalAdd.apply(this, arguments);
  };

  reloadModules([
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/app-shell.js'
  ]);
  // Rga.Keyboard.init is what app-shell's boot() would call.
  const Rga = global.window.Rga;
  Rga.KeyboardRegistry._reset();
  Rga.KeyboardRegistry.init();
  // The legacy Rga.Keyboard.init (now a shim) re-calls registry.init —
  // which is idempotent. Two calls, ONE attach.
  Rga.Keyboard.init();
  Rga.Keyboard.init();
  // ViewMode.init also registers via the registry (no extra listener).
  // We don't load view-mode.js here to keep the test minimal — the
  // registry's idempotency is what we're asserting.

  assert.equal(keydownAttaches, 1,
    'exactly ONE document.keydown listener after init (got ' + keydownAttaches + ')');
});

test('A: duplicate registration on the SAME combo emits a console.warn', () => {
  freshJSDOM();
  reloadModules(['../../../renderer/js/shell/keyboard-registry.js']);
  const Rga = global.window.Rga;
  Rga.KeyboardRegistry._reset();
  Rga.KeyboardRegistry.init();

  let warned = false;
  const originalWarn = console.warn;
  console.warn = function(msg) {
    if (typeof msg === 'string' && msg.indexOf('duplicate registration') >= 0) warned = true;
  };
  try {
    Rga.KeyboardRegistry.register('q', { ctrl: true }, function() {}, 'first');
    Rga.KeyboardRegistry.register('q', { ctrl: true }, function() {}, 'second');
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warned, true,
    'a duplicate registration on the same combo must emit a console.warn for the audit trail');
});

test('A: `when` predicate gates dispatch (Esc only fires when condition true)', () => {
  freshJSDOM();
  reloadModules(['../../../renderer/js/shell/keyboard-registry.js']);
  const Rga = global.window.Rga;
  Rga.KeyboardRegistry._reset();
  Rga.KeyboardRegistry.init();

  let mode = 'flow';
  let calls = 0;
  Rga.KeyboardRegistry.register('escape',
    { when: function() { return mode === 'draft'; } },
    function() { calls += 1; }, 'test');

  fireKey({ key: 'Escape' });
  assert.equal(calls, 0, 'gate false → no dispatch');

  mode = 'draft';
  fireKey({ key: 'Escape' });
  assert.equal(calls, 1, 'gate true → dispatch');
});

test('A: legacy Rga.Keyboard.register is a shim that delegates to the registry', () => {
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/app-shell.js'
  ]);
  const Rga = global.window.Rga;
  Rga.KeyboardRegistry._reset();
  Rga.KeyboardRegistry.init();
  Rga.Keyboard.init();
  let calls = 0;
  Rga.Keyboard.register('p', { ctrl: true, shift: true, alt: false },
    function() { calls += 1; });
  fireKey({ key: 'p', ctrlKey: true, shiftKey: true });
  assert.equal(calls, 1,
    'Rga.Keyboard.register must dispatch via the registry (legacy shim back-compat)');
  // The registration must show up in the registry snapshot.
  const all = Rga.KeyboardRegistry._all();
  assert.ok(all['cmd+shift+p'], 'registry snapshot must include the combo registered via the shim');
});

test('A: no source-level Ctrl+J or Ctrl+B duplicates (deduplication landed)', () => {
  // Count distinct call sites that register the same combo.
  const indexHtml  = readText(INDEX_HTML);
  const appShell   = readText(APP_SHELL_JS);
  const shellIndex = readText(SHELL_INDEX_JS);

  // Ctrl+J — should be registered EXACTLY ONCE.
  // Look for K.register('j', { ctrl: true ... in init script,
  // Rga.Keyboard.register('j', { ctrl: true ... or
  // Rga.KeyboardRegistry.register('j', { ctrl: true ... in app code.
  function countCtrlReg(text, key) {
    const re = new RegExp(
      "(?:K|Rga\\.Keyboard|Rga\\.KeyboardRegistry|KR)\\s*\\.register\\s*\\(\\s*['\"]" + key + "['\"]\\s*,\\s*\\{\\s*ctrl\\s*:\\s*true",
      'g');
    return (text.match(re) || []).length;
  }
  const totalJ = countCtrlReg(indexHtml, 'j') + countCtrlReg(appShell, 'j') + countCtrlReg(shellIndex, 'j');
  assert.equal(totalJ, 1, 'Ctrl+J must be registered exactly once across the renderer; got ' + totalJ);

  const totalB = countCtrlReg(indexHtml, 'b') + countCtrlReg(appShell, 'b') + countCtrlReg(shellIndex, 'b');
  assert.equal(totalB, 1, 'Ctrl+B must be registered exactly once across the renderer; got ' + totalB);
});

test('A: source audit — only the registry attaches document.keydown for global shortcuts', () => {
  // app-shell.js (post-Slice-2) must NOT have its own document.add
  // EventListener('keydown', ...). The legacy Rga.Keyboard.init now
  // delegates to KeyboardRegistry.init.
  const appShell = readText(APP_SHELL_JS);
  // The CommandPalette's keydown listener is on the palette ELEMENT,
  // not on document — that's allowed.
  const docAdds = appShell.match(/document\.addEventListener\(\s*['"]keydown['"]/g) || [];
  assert.equal(docAdds.length, 0,
    'app-shell.js must not attach document.keydown listeners after Slice 2');

  // shell/index.js must NOT have its own document.addEventListener('keydown').
  const shellIndex = readText(SHELL_INDEX_JS);
  const shellDocAdds = shellIndex.match(/document\.addEventListener\(\s*['"]keydown['"]/g) || [];
  assert.equal(shellDocAdds.length, 0,
    'shell/index.js must not attach document.keydown listeners after Slice 2');

  // view-mode.js may keep a fallback for early-boot tests, but the
  // KeyboardRegistry path must be primary. We assert the registry
  // path is called.
  const viewMode = readText(VIEW_MODE_JS);
  assert.ok(
    /Rga\.KeyboardRegistry\.register\s*\(\s*['"]escape['"]/.test(viewMode),
    'view-mode.js must register Escape via Rga.KeyboardRegistry'
  );
});

// ================================================================
// B — Theme ownership stabilization
// ================================================================

test('B: Rga.Theme exposes onChange and notifies subscribers on apply', () => {
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/app-shell.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Theme._reset();
  Rga.Theme.init();

  const events = [];
  const off = Rga.Theme.onChange(function(next, prev) { events.push({ next: next, prev: prev }); });

  Rga.Theme.apply('light');
  assert.deepEqual(events, [{ next: 'light', prev: 'dark' }],
    'apply(light) from dark must notify with (light, dark)');

  Rga.Theme.apply('dark');
  assert.equal(events.length, 2);
  assert.deepEqual(events[1], { next: 'dark', prev: 'light' });

  // Re-applying the same theme must NOT notify (no-op).
  Rga.Theme.apply('dark');
  assert.equal(events.length, 2, 'apply(same) must be a no-op for subscribers');

  off();
  Rga.Theme.apply('light');
  assert.equal(events.length, 2, 'unsubscribed listener must not receive further notifications');
});

test('B: toggle flips theme + persists to localStorage + notifies onChange', () => {
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/app-shell.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Theme._reset();
  Rga.Theme.init();
  // Stub Toast.show to a no-op so toggle's UX side-effect doesn't drag
  // in Rga.Icons / DOM container assumptions we don't need here.
  Rga.Toast = { show: function() {} };
  let saw = null;
  Rga.Theme.onChange(function(next) { saw = next; });

  Rga.Theme.toggle();
  assert.equal(Rga.Theme.current, 'light');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light',
    'DOM data-theme follows');
  assert.equal(localStorage.getItem('rga-theme'), 'light',
    'localStorage persists');
  assert.equal(saw, 'light', 'subscriber sees the new theme');
});

test('B: reload preserves theme via localStorage (two-session simulation)', () => {
  // Session 1 — toggle to light, leave the persisted value.
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/app-shell.js'
  ]);
  let Rga = global.window.Rga;
  Rga.Theme._reset();
  Rga.Theme.init();
  Rga.Toast = { show: function() {} };
  Rga.Theme.toggle();  // dark → light
  assert.equal(localStorage.getItem('rga-theme'), 'light');
  const persisted = localStorage.getItem('rga-theme');

  // Session 2 — fresh DOM, fresh modules, seed localStorage.
  freshJSDOM();
  localStorage.setItem('rga-theme', persisted);
  reloadModules([
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/app-shell.js'
  ]);
  Rga = global.window.Rga;
  Rga.Theme._reset();
  Rga.Theme.init();
  assert.equal(Rga.Theme.current, 'light',
    'session 2 boots with the persisted theme (light)');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
});

test('B: only Rga.Theme writes data-theme / rga-theme — no duplicate writers in renderer/js', () => {
  // Source audit: walk renderer/js/**/*.js (excluding bundle.js, editor/,
  // framework/, doc-types/ which are off-limits) and assert ONLY
  // app-shell.js (Rga.Theme) writes those identifiers.
  const FORBIDDEN_PATHS = [/[\\/]editor[\\/]/, /[\\/]framework[\\/]/, /[\\/]doc-types[\\/]/, /bundle\.js$/, /bundle\.js\.map$/];
  function walk(dir, out) {
    fs.readdirSync(dir).forEach(function(name) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full, out);
      else if (/\.js$/.test(name)) out.push(full);
    });
  }
  const files = [];
  walk(path.join(REPO, 'renderer', 'js'), files);
  const writers = [];
  files.forEach(function(f) {
    if (FORBIDDEN_PATHS.some(function(re) { return re.test(f); })) return;
    const src = fs.readFileSync(f, 'utf8');
    if (/setAttribute\(\s*['"]data-theme['"]/.test(src) ||
        /localStorage\.setItem\(\s*['"]rga-theme['"]/.test(src)) {
      writers.push(path.relative(REPO, f));
    }
  });
  // Only app-shell.js may write these. (renderer/index.html sets the
  // initial data-theme attribute statically — that's the HTML default,
  // not a runtime write.)
  assert.deepEqual(writers, ['renderer\\js\\app-shell.js'.replace(/\\/g, path.sep)],
    'only renderer/js/app-shell.js (Rga.Theme) may write data-theme / rga-theme. Got: ' + writers.join(', '));
});
