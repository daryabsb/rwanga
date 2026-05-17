// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Runtime Ownership Stabilization Slice 3 §B — drift guards.
//
// These tests prevent future contributors from silently re-introducing
// the four ownership problems Slices 1–3 just resolved:
//
//   G1: no new document.keydown listeners outside Rga.KeyboardRegistry
//   G2: no duplicate ownership surfaces (DOM-shaped state)
//   G3: no direct DOM ownership for shell state
//   G4: no direct localStorage writes outside named owner modules
//
// Each guard is a source-level audit (file inspection) rather than a
// behavioural test. They fail fast at CI time with a precise message
// pointing the contributor at the owning module they should be calling
// instead.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const RENDERER_JS = path.join(REPO, 'renderer', 'js');
const INDEX_HTML  = path.join(REPO, 'renderer', 'index.html');

// Files / paths off-limits per the slice rules. We never enforce
// drift constraints on engine source — the engine has its own
// keymap, its own DOM contracts, and its own localStorage usage
// where required.
const OFF_LIMITS = [
  /[\\/]editor[\\/]/,
  /[\\/]framework[\\/]/,
  /[\\/]doc-types[\\/]/,
  /[\\/]bundle\.js$/,
  /[\\/]bundle\.js\.map$/
];

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function(name) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.js$/.test(name)) out.push(full);
  });
}

function shellJsFiles() {
  const files = [];
  walk(RENDERER_JS, files);
  return files.filter(function(f) {
    return !OFF_LIMITS.some(function(re) { return re.test(f); });
  });
}

function relativeFromRepo(file) {
  return path.relative(REPO, file).replace(/\\/g, '/');
}

function readText(file) { return fs.readFileSync(file, 'utf8'); }

// Strip line and block comments before pattern-matching so an
// illustrative literal in a comment (e.g. `// see Layout.set(...)`)
// doesn't trigger a guard. Naive but sufficient for our renderer/
// sources, which don't embed code in template literals.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // /* … */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // // …  (avoid http:// / file://)
}

// ----------------------------------------------------------------
// G1 — no document.keydown listeners outside Rga.KeyboardRegistry
// ----------------------------------------------------------------

test('G1: only renderer/js/shell/keyboard-registry.js attaches document.keydown for global shortcuts', () => {
  const files = shellJsFiles();
  const offenders = [];
  files.forEach(function(file) {
    // Strip comments before matching — illustrative literals inside
    // comments (e.g. a Slice-3 deletion note that mentions the old
    // pattern) must not trigger the guard.
    const src = stripComments(readText(file));
    const matches = src.match(/document\.addEventListener\s*\(\s*['"]keydown['"]/g) || [];
    if (matches.length === 0) return;
    const rel = relativeFromRepo(file);
    if (rel === 'renderer/js/shell/keyboard-registry.js') return;
    offenders.push(rel + ' (' + matches.length + ' listener' + (matches.length > 1 ? 's' : '') + ')');
  });
  assert.deepEqual(offenders, [],
    'G1 — every global keyboard shortcut must register via Rga.KeyboardRegistry.register. ' +
    'These files attach their own document.keydown listeners: ' + offenders.join(', ') +
    '. Migrate them to KeyboardRegistry.register(key, opts, handler, source).');
});

test('G1: index.html init script does NOT attach document.keydown (uses K.register only)', () => {
  const html = readText(INDEX_HTML);
  // Extract the boot script body — everything between the LAST <script> open
  // tag (the boot block) and the matching </script>.
  const scriptOpens = [];
  const re = /<script(?:\s[^>]*)?>/g;
  let m;
  while ((m = re.exec(html))) scriptOpens.push(m.index + m[0].length);
  assert.ok(scriptOpens.length > 0, 'index.html must contain at least one <script> block');
  const lastStart = scriptOpens[scriptOpens.length - 1];
  const lastEnd = html.indexOf('</script>', lastStart);
  const body = html.slice(lastStart, lastEnd);
  const offending = body.match(/document\.addEventListener\s*\(\s*['"]keydown['"]/g) || [];
  assert.equal(offending.length, 0,
    'G1 — the index.html init script must NOT attach document.keydown. ' +
    'Use K.register(...) / Rga.KeyboardRegistry.register(...) instead. ' +
    'Found ' + offending.length + ' direct listener(s).');
});

// ----------------------------------------------------------------
// G2 — no duplicate ownership surfaces
// ----------------------------------------------------------------

test('G2: visibility-state setters list per concern stays singleton', () => {
  // For each owner module, only ITSELF or its public mutator API
  // may write the SSOT field. We enforce this for the three concerns
  // most prone to drift: studioPanel.visible, sidebar.visible,
  // sidebar.activePanel.
  const files = shellJsFiles();

  function findWriters(re, allowedRelPaths) {
    const offenders = [];
    files.forEach(function(file) {
      const src = stripComments(readText(file));  // exclude comment text
      if (!re.test(src)) return;
      const rel = relativeFromRepo(file);
      if (allowedRelPaths.indexOf(rel) >= 0) return;
      offenders.push(rel);
    });
    return offenders;
  }

  // Layout.set({ studioPanel: ... }) — allowed writers:
  //   - renderer/js/shell/layout.js (the SSOT module itself)
  //   - renderer/js/app-shell.js (Rga.BottomPanel — the public mutator)
  //   - renderer/js/shell/index.js (Cmd+` shortcut → BottomPanel.toggleCollapse
  //     fallback — uses Layout.set when BottomPanel not yet booted)
  const studioWriters = findWriters(
    /Rga\.Shell\.Layout\.set\s*\(\s*\{\s*studioPanel/,
    ['renderer/js/shell/layout.js',
     'renderer/js/app-shell.js',
     'renderer/js/shell/index.js']
  );
  assert.deepEqual(studioWriters, [],
    'G2 — only Layout / BottomPanel / shell/index.js may write Layout.studioPanel. ' +
    'Unexpected writers: ' + studioWriters.join(', '));

  // Layout.set({ sidebar: { visible: ... } }) — allowed:
  //   - renderer/js/shell/layout.js
  //   - renderer/js/shell/index.js (Cmd+B handler)
  //   - renderer/js/shell/activity-rail.js (rail click toggles visibility)
  const sidebarVisWriters = findWriters(
    /Rga\.Shell\.Layout\.set\s*\(\s*\{\s*sidebar\s*:\s*\{\s*visible/,
    ['renderer/js/shell/layout.js',
     'renderer/js/shell/index.js',
     'renderer/js/shell/activity-rail.js']
  );
  assert.deepEqual(sidebarVisWriters, [],
    'G2 — only Layout / shell/index.js / activity-rail.js may write Layout.sidebar.visible. ' +
    'Unexpected writers: ' + sidebarVisWriters.join(', '));
});

// ----------------------------------------------------------------
// G3 — no direct DOM ownership for shell state
// ----------------------------------------------------------------

test('G3: no shell-state classes (bottom-collapsed, sidebar-collapsed, view-*-active) are toggled outside their owner', () => {
  const files = shellJsFiles();
  const checks = [
    { cls: 'bottom-collapsed', owner: 'renderer/js/app-shell.js' /* Rga.BottomPanel._syncDomFromLayout */ },
    { cls: 'sidebar-collapsed', owner: null /* CSS-driven only; no JS owner needed */ },
    { cls: 'view-draft-active', owner: 'renderer/js/view-mode.js' /* via ViewManager controller bodyClass */ },
    { cls: 'view-print-active', owner: 'renderer/js/view-mode.js' }
  ];

  checks.forEach(function(check) {
    const offenders = [];
    files.forEach(function(file) {
      const src = readText(file);
      const re = new RegExp(
        "(?:classList\\.(?:add|remove|toggle)\\s*\\(\\s*['\"]" +
        check.cls + "['\"]|" +
        "classList\\.(?:add|remove|toggle)\\s*\\(\\s*['\"]" + check.cls + "['\"]\\s*,)",
        'g');
      if (!re.test(src)) return;
      const rel = relativeFromRepo(file);
      if (check.owner === rel) return;
      offenders.push(rel);
    });
    assert.deepEqual(offenders, [],
      'G3 — only ' + (check.owner || '(no JS owner — CSS only)') + ' may toggle the ' +
      check.cls + ' class on the DOM. Unexpected toggles in: ' + offenders.join(', ') +
      '. Route through the layer that owns this state.');
  });
});

// ----------------------------------------------------------------
// G4 — no direct localStorage writes outside named owner modules
// ----------------------------------------------------------------

test('G4: every localStorage write key is claimed by exactly one owner module', () => {
  // The ownership matrix's "Persistence keys" §2 names five keys + their
  // owners. This guard enforces the list at source level.
  const allowedOwners = {
    'rga-theme':                       ['renderer/js/app-shell.js'],
    'rga-view-mode':                   ['renderer/js/view-mode.js'],
    'rga-script-lang':                 ['renderer/js/app-shell.js'],
    'rga-session-tabs':                ['renderer/js/tab-manager.js'],
    'rga-shell-studio-panel-visible':  ['renderer/js/app-shell.js']
  };

  const files = shellJsFiles();
  const knownKeys = Object.keys(allowedOwners);
  const offenders = [];

  files.forEach(function(file) {
    const src = readText(file);
    // Match localStorage.setItem(...) calls capturing the first string arg.
    const re = /localStorage\.setItem\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      const key = m[1];
      const rel = relativeFromRepo(file);
      const allowed = allowedOwners[key];
      if (!allowed) {
        offenders.push(rel + ' writes UNREGISTERED key "' + key + '". Add it to the ownership matrix §2 + this guard.');
        continue;
      }
      if (allowed.indexOf(rel) < 0) {
        offenders.push(rel + ' writes key "' + key + '" which is owned by ' + allowed.join(' / '));
      }
    }
  });

  assert.deepEqual(offenders, [],
    'G4 violations:\n  - ' + offenders.join('\n  - ') + '\n' +
    'All localStorage writes must come from the module that owns the key per the ownership matrix.');
});

test('G4: no shell module reads localStorage for keys it does not own', () => {
  // Read-side variant — narrower; we only enforce for the four keys
  // whose READS are also single-owner. (rga-theme reads in TitleBar
  // etc. are not blocked because reading is harmless; writes are the
  // ownership-determining act.)
  const files = shellJsFiles();
  const offenders = [];
  // Today only rga-session-tabs has a strict read-side owner.
  const RESTRICTED_READS = {
    'rga-session-tabs': ['renderer/js/tab-manager.js']
  };
  files.forEach(function(file) {
    const src = readText(file);
    const re = /localStorage\.getItem\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      const key = m[1];
      const allowed = RESTRICTED_READS[key];
      if (!allowed) continue;
      const rel = relativeFromRepo(file);
      if (allowed.indexOf(rel) < 0) {
        offenders.push(rel + ' reads "' + key + '" which is owned by ' + allowed.join(' / '));
      }
    }
  });
  assert.deepEqual(offenders, [],
    'G4 read-side violations:\n  - ' + offenders.join('\n  - '));
});
