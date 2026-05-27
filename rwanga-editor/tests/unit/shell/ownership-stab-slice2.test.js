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
  // §A4.1 — registrations migrated to KR.registerCommand. Match both
  // the legacy KR.register style AND the new KR.registerCommand spec
  // (where key + mods live inside a config object).
  const indexHtml      = readText(INDEX_HTML);
  const appShell       = readText(APP_SHELL_JS);
  const shellIndex     = readText(SHELL_INDEX_JS);
  const studioPanelJs  = readText(path.join(REPO, 'renderer/js/shell/studio-panel.js'));

  function countAllReg(text, key) {
    // Match KR.register('j', { ctrl: true ... — legacy form
    const legacy = new RegExp(
      "(?:K|Rga\\.Keyboard|Rga\\.KeyboardRegistry|KR)\\s*\\.register\\s*\\(\\s*['\"]" + key + "['\"]\\s*,\\s*\\{\\s*ctrl\\s*:\\s*true",
      'g');
    // Match KR.registerCommand({ command: ..., key: 'j', mods: { ctrl: true ... — new form
    const command = new RegExp(
      "registerCommand\\(\\{[\\s\\S]{0,200}key:\\s*['\"]" + key + "['\"][\\s\\S]{0,150}mods:\\s*\\{[^}]*ctrl:\\s*true",
      'g');
    return (text.match(legacy) || []).length + (text.match(command) || []).length;
  }
  const totalJ = countAllReg(indexHtml, 'j') + countAllReg(appShell, 'j') + countAllReg(shellIndex, 'j') + countAllReg(studioPanelJs, 'j');
  assert.equal(totalJ, 1, 'Ctrl+J must be registered exactly once across the renderer; got ' + totalJ);

  const totalB = countAllReg(indexHtml, 'b') + countAllReg(appShell, 'b') + countAllReg(shellIndex, 'b') + countAllReg(studioPanelJs, 'b');
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

test('B: toggle flips theme + notifies onChange (post-S12: persistence via Store, not localStorage)', () => {
  // Pre-S12: this test asserted localStorage('rga-theme') was written by
  // Rga.Theme.apply as the persistence backstop. S12 removed that write
  // path; user-tier persistence now flows through window.rwanga.prefs
  // via Settings.Store. With no Store loaded in this minimal harness,
  // Rga.Theme.toggle falls back to Rga.Theme.apply (DOM-only); the
  // localStorage assertion is intentionally absent. Full Store-driven
  // persistence is proven by tests/unit/shell/theme-migration.test.js.
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
  assert.equal(saw, 'light', 'subscriber sees the new theme');
});

test('B (S12): Rga.Theme.apply does NOT write localStorage("rga-theme")', () => {
  // Regression guard: pre-S12 Rga.Theme.apply wrote 'rga-theme' to
  // localStorage. S12 removed that bypass. This test inverts the prior
  // assertion — apply() must NOT write the legacy key.
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/app-shell.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Theme._reset();
  Rga.Theme.init();
  Rga.Toast = { show: function() {} };

  // No prior write.
  assert.equal(localStorage.getItem('rga-theme'), null);

  Rga.Theme.apply('light');
  assert.equal(Rga.Theme.current, 'light');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(localStorage.getItem('rga-theme'), null,
    'Rga.Theme.apply must not write the legacy "rga-theme" localStorage key post-S12');

  Rga.Theme.apply('dark');
  assert.equal(localStorage.getItem('rga-theme'), null,
    'still no legacy write after a second apply');
});

test('H2B: only the theme owner files may call Rga.Theme.toggle / Rga.Theme.apply (constitutional ownership)', () => {
  // Settings Constitution + H2B: production code outside the theme
  // owner files MUST route theme intent through Rga.SettingsTheme.toggle
  // (which writes Settings.Store), not through Rga.Theme directly.
  //
  // Permitted callers:
  //   - app-shell.js          (defines Rga.Theme itself; toggle/apply live there)
  //   - shell-applicators.js  (theme applicator + Rga.SettingsTheme.toggle helper)
  //
  // Everything else must be empty of `Rga.Theme.apply(` and
  // `Rga.Theme.toggle(` call-site patterns. This guard catches new
  // drift before review.
  const FORBIDDEN_PATHS = [/[\\/]editor[\\/]/, /[\\/]framework[\\/]/, /[\\/]doc-types[\\/]/, /bundle\.js$/, /bundle\.js\.map$/];
  const ALLOWED = new Set([
    'renderer/js/app-shell.js',
    'renderer/js/shell/shell-applicators.js'
  ]);
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
  const offenders = [];
  files.forEach(function(f) {
    if (FORBIDDEN_PATHS.some(function(re) { return re.test(f); })) return;
    const rel = path.relative(REPO, f).replace(/\\/g, '/');
    if (ALLOWED.has(rel)) return;
    const src = fs.readFileSync(f, 'utf8');
    if (/Rga\.Theme\.apply\s*\(/.test(src) || /Rga\.Theme\.toggle\s*\(/.test(src)) {
      offenders.push(rel);
    }
  });
  assert.deepEqual(offenders, [],
    'production code outside the theme owner files must route through Rga.SettingsTheme.toggle / Rga.Settings.Store.set. Drifting files: ' + offenders.join(', '));
});

test('B: only Rga.Theme writes data-theme / rga-theme — no duplicate writers in renderer/js', () => {
  // Source audit: walk renderer/js/**/*.js (excluding bundle.js, editor/,
  // framework/, doc-types/ which are off-limits) and assert ONLY
  // app-shell.js (Rga.Theme) writes those identifiers. Post-S12, no
  // file writes 'rga-theme' to localStorage — but app-shell.js still
  // owns setAttribute('data-theme') so it remains the sole writer.
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

// ================================================================
// S12 — Categorical Ownership Drift Guard
// ================================================================
//
// Five assertions enforcing the Settings Constitution §1A.6 categorical
// exemption registry. Drift is detected by owner-file enumeration, not
// by key name — renaming a key cannot bypass the rule.
//
// ALLOWED categories:
//   Category 1 (UI Session State): view-mode, workspace-state, tab-manager
//   Category 2 (Recent / History Data): file-manager
// FORBIDDEN: any configuration value (theme, units, script-language, etc.)
//
// Adding a new localStorage key in a new file requires either declaring
// the new file in S12_LOCAL_STORAGE_OWNERS below AND in RC1 §1A.6, or
// routing the value through Settings.Store.

const S12_LOCAL_STORAGE_OWNERS = {
  // owner-file relative POSIX path → category label
  'renderer/js/view-mode.js':              'cat1-ui-session-state',
  'renderer/js/shell/workspace-state.js':  'cat1-ui-session-state',
  'renderer/js/tab-manager.js':            'cat1-ui-session-state',
  'renderer/js/file-manager.js':           'cat2-recent-history'
};

// Walk renderer/js excluding ProseMirror bundle artefacts. Both the
// shell tree and the editor tree are in scope because they both contain
// configuration applicators (shell-applicators.js and
// editor-applicators.js). Returns absolute file paths.
function _walkRendererForS12() {
  const SKIP = [/bundle\.js$/, /bundle\.js\.map$/];
  const out = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function(name) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.js$/.test(name)) {
        if (SKIP.some(function(re) { return re.test(full); })) return;
        out.push(full);
      }
    });
  })(path.join(REPO, 'renderer', 'js'));
  return out;
}

test('S12 §1 — allowed exemptions pass: every localStorage.setItem call lives in a declared Category 1 / Category 2 owner', () => {
  const files = _walkRendererForS12();
  const offenders = [];
  files.forEach(function(f) {
    const src = fs.readFileSync(f, 'utf8');
    if (!/localStorage\.setItem/.test(src)) return;
    const rel = path.relative(REPO, f).replace(/\\/g, '/');
    if (!Object.prototype.hasOwnProperty.call(S12_LOCAL_STORAGE_OWNERS, rel)) {
      offenders.push(rel);
    }
  });
  assert.deepEqual(offenders, [],
    'localStorage.setItem must only appear in declared owner files (RC1 §1A.6). ' +
    'Drifting files: ' + offenders.join(', ') +
    '. If this file is legitimately a Category 1 (UI session state) or ' +
    'Category 2 (recent/history) owner, add it to S12_LOCAL_STORAGE_OWNERS ' +
    'above AND document it in RC1 §1A.6. Otherwise route the value through Settings.Store.');
});

test('S12 §2 — forbidden configuration writes fail: no localStorage write of legacy "rga-theme" / "rga-default-units" / "rga-script-lang"', () => {
  // These three keys were the pre-S12 configuration-value bypasses. After
  // S12 none of them appear as a localStorage.setItem anywhere in
  // renderer/js. settings-migrations.js reads 'rga-theme' (one-shot
  // legacy import) but does not write it.
  const FORBIDDEN_KEYS = ['rga-theme', 'rga-default-units', 'rga-script-lang'];
  const files = _walkRendererForS12();
  const violations = [];
  files.forEach(function(f) {
    const src = fs.readFileSync(f, 'utf8');
    FORBIDDEN_KEYS.forEach(function(key) {
      const re = new RegExp("localStorage\\.setItem\\(\\s*['\"]" + key + "['\"]");
      if (re.test(src)) {
        violations.push(path.relative(REPO, f).replace(/\\/g, '/') + ' writes "' + key + '"');
      }
    });
  });
  assert.deepEqual(violations, [],
    'Pre-S12 configuration-value bypasses must not return. ' +
    'Violations: ' + violations.join(', '));
});

test('S12 §3 — theme ownership path unique: setAttribute("data-theme") exists exactly once, inside Rga.Theme.apply', () => {
  // The DOM mutation that selects dark/light themes must be a single
  // location. Pre-S12 Rga.Theme.init also called apply() directly on
  // boot from outside the applicator chain. S12 removed that bypass:
  // setAttribute now fires only when the theme applicator drives
  // Rga.Theme.apply, which is the single owner of the data-theme
  // attribute. Renderer files outside app-shell.js MUST NOT call
  // setAttribute('data-theme', ...).
  const appShell = readText(APP_SHELL_JS);
  const matches = appShell.match(/setAttribute\(\s*['"]data-theme['"]/g) || [];
  assert.equal(matches.length, 1,
    'setAttribute("data-theme") must appear exactly ONCE in app-shell.js ' +
    '(inside Rga.Theme.apply, the owner service). Found ' + matches.length + ' occurrence(s).');

  // Cross-file audit — no other file may setAttribute('data-theme').
  const files = _walkRendererForS12();
  const writers = [];
  files.forEach(function(f) {
    if (f === APP_SHELL_JS) return;
    const src = fs.readFileSync(f, 'utf8');
    if (/setAttribute\(\s*['"]data-theme['"]/.test(src)) {
      writers.push(path.relative(REPO, f).replace(/\\/g, '/'));
    }
  });
  assert.deepEqual(writers, [],
    'No file outside app-shell.js may write data-theme. Offenders: ' + writers.join(', '));
});

test('S12 §4 — promoted registry values route correctly: units (user) + editor.scriptLanguage (script) are registered, no localStorage paths remain', () => {
  // Registry shape: both promoted ids exist with the correct persistsTo
  // tier and applicator-file ownership. Walks the renderer source for
  // the applicator declarations rather than booting the full registry
  // (which is exercised by settings-registry.test.js neighbors).
  const SHELL_APPS = path.join(REPO, 'renderer', 'js', 'shell', 'shell-applicators.js');
  const EDITOR_APPS = path.join(REPO, 'renderer', 'js', 'editor', 'editor-applicators.js');
  const REGISTRY    = path.join(REPO, 'renderer', 'js', 'shell', 'settings-registry.js');

  const reg = fs.readFileSync(REGISTRY, 'utf8');
  assert.ok(/id:\s*['"]units['"]/.test(reg),
    'Registry must contain the promoted entry id "units"');
  assert.ok(/id:\s*['"]editor\.scriptLanguage['"]/.test(reg),
    'Registry must contain the promoted entry id "editor.scriptLanguage"');

  // units must declare persistsTo 'user' (or fall back to the user
  // default, which entry() supplies). Regex anchors on the entry block.
  const unitsBlock = reg.match(/id:\s*['"]units['"][\s\S]{0,400}?\}/);
  assert.ok(unitsBlock, 'unable to locate units entry block');
  // editor.scriptLanguage must declare persistsTo 'script'.
  const slBlock = reg.match(/id:\s*['"]editor\.scriptLanguage['"][\s\S]{0,500}?\}/);
  assert.ok(slBlock, 'unable to locate editor.scriptLanguage entry block');
  assert.ok(/persistsTo:\s*['"]script['"]/.test(slBlock[0]),
    'editor.scriptLanguage must declare persistsTo: "script" (per-document)');

  // Applicator declarations.
  const shellApps = fs.readFileSync(SHELL_APPS, 'utf8');
  assert.ok(/register\(\s*['"]units['"]/.test(shellApps),
    'shell-applicators.js must register an applicator for "units"');

  const editorApps = fs.readFileSync(EDITOR_APPS, 'utf8');
  assert.ok(/register\(\s*['"]editor\.scriptLanguage['"]/.test(editorApps),
    'editor-applicators.js must register an applicator for "editor.scriptLanguage"');

  // The legacy module facades must no longer carry their own localStorage
  // write paths — those are retired in S12.
  const unitsJs = fs.readFileSync(
    path.join(REPO, 'renderer', 'js', 'units.js'), 'utf8');
  assert.ok(!/localStorage\.setItem/.test(unitsJs),
    'renderer/js/units.js must not write localStorage after S12 (Store user tier owns persistence)');
  const slJs = fs.readFileSync(
    path.join(REPO, 'renderer', 'js', 'shell', 'script-language.js'), 'utf8');
  assert.ok(!/localStorage\.setItem/.test(slJs),
    'renderer/js/shell/script-language.js must not write localStorage after S12 (Store script tier owns persistence)');
});

test('S12 §5 — no new bypasses exist: configuration-owned CSS custom properties are set inside applicator files only', () => {
  // Configuration-driven CSS custom properties must be set by the
  // applicator file that owns them. A renderer file outside the
  // applicator list that calls documentElement.style.setProperty for a
  // configuration-owned token is a bypass.
  const CONFIG_CSS_TOKENS = [
    '--editor-bg',
    '--page-margin-top',
    '--page-margin-right',
    '--page-margin-bottom',
    '--page-margin-left',
    '--editor-font-size',
    '--editor-line-height'
  ];
  const ALLOWED_OWNERS = new Set([
    'renderer/js/shell/shell-applicators.js',
    'renderer/js/editor/editor-applicators.js'
  ]);
  const files = _walkRendererForS12();
  const offenders = [];
  files.forEach(function(f) {
    const rel = path.relative(REPO, f).replace(/\\/g, '/');
    if (ALLOWED_OWNERS.has(rel)) return;
    const src = fs.readFileSync(f, 'utf8');
    CONFIG_CSS_TOKENS.forEach(function(tok) {
      const re = new RegExp(
        "setProperty\\(\\s*['\"]" + tok.replace(/-/g, '\\-') + "['\"]");
      if (re.test(src)) {
        offenders.push(rel + ' sets ' + tok);
      }
    });
  });
  assert.deepEqual(offenders, [],
    'Configuration-owned CSS custom properties must be set inside applicator files only. ' +
    'Offenders: ' + offenders.join(', '));
});
