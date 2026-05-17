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

  // Layout.set({ studioPanel: ... }) — allowed writers (post-Slice-9):
  //   - renderer/js/shell/layout.js (the SSOT module itself)
  //   - renderer/js/shell/studio-panel.js (the public mutator — Slice 9 §A)
  //   - renderer/js/shell/index.js (Cmd+` shortcut → StudioPanel.toggle
  //     fallback uses Layout.set when StudioPanel not yet booted)
  //   - renderer/js/shell/workspace-state.js (legacy migration path
  //     converts old scoped key into the workspace blob)
  // (app-shell.js dropped off this list in Slice 9 §A — the BottomPanel
  // shim delegates to StudioPanel which writes Layout.)
  const studioWriters = findWriters(
    /Rga\.Shell\.Layout\.set\s*\(\s*\{\s*studioPanel/,
    ['renderer/js/shell/layout.js',
     'renderer/js/shell/studio-panel.js',
     'renderer/js/shell/index.js',
     'renderer/js/shell/workspace-state.js']
  );
  assert.deepEqual(studioWriters, [],
    'G2 — only Layout / StudioPanel / shell/index.js / WorkspaceState may write Layout.studioPanel. ' +
    'Unexpected writers: ' + studioWriters.join(', '));

  // Layout.set({ sidebar: { visible: ... } }) — allowed:
  //   - renderer/js/shell/layout.js
  //   - renderer/js/shell/index.js (Cmd+B handler + boot restore)
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

  // Layout.set({ sidebar: { activePanel: ... } }) — allowed:
  //   - renderer/js/shell/layout.js
  //   - renderer/js/shell/sidebar.js (Slice 5 §B: _syncLayoutMirror keeps
  //     Layout's mirror in sync with Sidebar's runtime SSOT so
  //     WorkspaceState persists the user's actual choice, not the
  //     boot default)
  const sidebarActiveWriters = findWriters(
    /Rga\.Shell\.Layout\.set\s*\(\s*\{\s*sidebar\s*:\s*\{\s*activePanel/,
    ['renderer/js/shell/layout.js',
     'renderer/js/shell/sidebar.js']
  );
  assert.deepEqual(sidebarActiveWriters, [],
    'G2 — only Layout / sidebar.js may write Layout.sidebar.activePanel. ' +
    'Unexpected writers: ' + sidebarActiveWriters.join(', '));
});

// ----------------------------------------------------------------
// G3 — no direct DOM ownership for shell state
// ----------------------------------------------------------------

test('G3: no shell-state classes (bottom-collapsed, sidebar-collapsed, view-*-active) are toggled outside their owner', () => {
  const files = shellJsFiles();
  const checks = [
    { cls: 'bottom-collapsed',          owner: 'renderer/js/shell/studio-panel.js' /* Slice 9 §A: StudioPanel._syncVisibilityFromLayout */ },
    { cls: 'sidebar-collapsed',         owner: null /* CSS-driven only; no JS owner needed */ },
    // Slice 6 §B: view-* body classes are owned EXCLUSIVELY by
    // Rga.ViewManager (renderer/js/framework/view-manager.js), which
    // sits in the framework/ off-limits scan path. No file in the
    // audited shell-js paths may toggle them — owner: null means
    // "any toggle outside the framework owner is a violation".
    { cls: 'view-draft-active',         owner: null /* ViewManager only — framework-owned */ },
    { cls: 'view-print-active',         owner: null /* ViewManager only — framework-owned */ },
    { cls: 'view-print-preview-active', owner: null /* ViewManager only — framework-owned (Rga.PrintPreview controller) */ }
  ];

  checks.forEach(function(check) {
    const offenders = [];
    files.forEach(function(file) {
      const src = stripComments(readText(file));
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
      'G3 — only ' + (check.owner || '(framework owner only — no shell-js writer allowed)') +
      ' may toggle the ' + check.cls + ' class on the DOM. Unexpected toggles in: ' +
      offenders.join(', ') + '. Route through the layer that owns this state.');
  });
});

// ----------------------------------------------------------------
// G4 — no direct localStorage writes outside named owner modules
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Storage ownership registry — referenced by G4 / G5 / G6 / G7.
// Slice 4 §C: pull this out of the G4 closure so the new guards can
// share it; keep here so the registry lives next to the guards that
// enforce it. The canonical doc is
// docs/design-system/rwanga-storage-ownership.md.
// ----------------------------------------------------------------
const STORAGE_OWNERS = {
  'rga-theme':              { writers: ['renderer/js/app-shell.js'],     restoreIn: ['renderer/js/app-shell.js']     },
  'rga-view-mode':          { writers: ['renderer/js/view-mode.js'],     restoreIn: ['renderer/js/view-mode.js']     },
  'rga-script-lang':        { writers: ['renderer/js/shell/script-language.js'], restoreIn: ['renderer/js/shell/script-language.js'] },
  'rga-session-tabs':       { writers: ['renderer/js/tab-manager.js'],   restoreIn: ['renderer/js/tab-manager.js']   },
  'rga-workspace-layout':   { writers: ['renderer/js/shell/workspace-state.js'], restoreIn: ['renderer/js/shell/workspace-state.js'] }
};

// Legacy keys: WorkspaceState READS these once during migration; no
// module is allowed to WRITE them anymore. Listed so the unknown-key
// guard knows they're known-but-deprecated rather than truly unknown.
const LEGACY_KEYS = {
  'rga-shell-studio-panel-visible': { migratedTo: 'rga-workspace-layout', migratedIn: 'Slice 4 §A' }
};

test('G4: every localStorage write key is claimed by exactly one owner module', () => {
  const files = shellJsFiles();
  const offenders = [];

  files.forEach(function(file) {
    const src = stripComments(readText(file));
    const re = /localStorage\.setItem\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      const key = m[1];
      const rel = relativeFromRepo(file);
      const owner = STORAGE_OWNERS[key];
      if (!owner) {
        if (LEGACY_KEYS[key]) {
          offenders.push(rel + ' writes LEGACY key "' + key +
            '" — migrated to "' + LEGACY_KEYS[key].migratedTo + '" in ' +
            LEGACY_KEYS[key].migratedIn + '. Read-only allowed during migration; no writes.');
        } else {
          offenders.push(rel + ' writes UNREGISTERED key "' + key +
            '". Add it to STORAGE_OWNERS + docs/design-system/rwanga-storage-ownership.md.');
        }
        continue;
      }
      if (owner.writers.indexOf(rel) < 0) {
        offenders.push(rel + ' writes key "' + key + '" which is owned by ' + owner.writers.join(' / '));
      }
    }
  });

  assert.deepEqual(offenders, [],
    'G4 violations:\n  - ' + offenders.join('\n  - ') + '\n' +
    'All localStorage writes must come from the module that owns the key per the storage-ownership doc.');
});

test('G4: no shell module reads localStorage for keys it does not own', () => {
  // Read-side variant — narrower; we only enforce for the keys
  // whose READS are also single-owner.
  const files = shellJsFiles();
  const offenders = [];
  // Keys whose reads must come from a single module. rga-theme reads
  // in TitleBar etc. are not blocked because reading is harmless;
  // writes are the ownership-determining act.
  const RESTRICTED_READS = {
    'rga-session-tabs':     ['renderer/js/tab-manager.js'],
    'rga-workspace-layout': ['renderer/js/shell/workspace-state.js']
  };
  files.forEach(function(file) {
    const src = stripComments(readText(file));
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

// ----------------------------------------------------------------
// G5 — no duplicate persistence ownership (Slice 4 §C)
// ----------------------------------------------------------------

test('G5: every storage key has exactly one writer module', () => {
  // The STORAGE_OWNERS registry above defines a one-module writer
  // list per key. This guard re-asserts it as a structural property
  // (no key may declare a multi-element `writers` array) — a future
  // contributor cannot quietly relax single-owner semantics.
  const offenders = [];
  Object.keys(STORAGE_OWNERS).forEach(function(key) {
    const writers = STORAGE_OWNERS[key].writers;
    if (!Array.isArray(writers) || writers.length !== 1) {
      offenders.push(key + ' has ' + (writers ? writers.length : 0) +
        ' writers; must be exactly 1');
    }
  });
  assert.deepEqual(offenders, [],
    'G5 — storage-ownership registry violations: ' + offenders.join('; '));
});

// ----------------------------------------------------------------
// G6 — no unregistered storage keys (Slice 4 §C)
// ----------------------------------------------------------------

test('G6: every localStorage key touched by renderer JS is either OWNED or LEGACY', () => {
  // Catches the "new contributor added a key without updating the
  // registry" case. Scans BOTH reads and writes; flags any key not
  // in STORAGE_OWNERS and not in LEGACY_KEYS.
  const files = shellJsFiles();
  const unknown = new Set();
  const re = /localStorage\.(?:getItem|setItem|removeItem)\s*\(\s*['"]([^'"]+)['"]/g;
  files.forEach(function(file) {
    const src = stripComments(readText(file));
    let m;
    while ((m = re.exec(src))) {
      const key = m[1];
      if (STORAGE_OWNERS[key]) continue;
      if (LEGACY_KEYS[key]) continue;
      unknown.add(key + '  (in ' + relativeFromRepo(file) + ')');
    }
  });
  assert.deepEqual(Array.from(unknown), [],
    'G6 — unregistered storage keys: ' + Array.from(unknown).join('; ') +
    '. Each must be registered in STORAGE_OWNERS + the storage-ownership doc, ' +
    'or — if it is a migration target — in LEGACY_KEYS.');
});

// ----------------------------------------------------------------
// G7 — restore path must exist for owned keys (Slice 4 §C)
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Session-Boundary registry — referenced by G8 / G9 / G10 (Slice 7).
// Mirror of Rga.SessionBoundary._MANIFEST. Kept in sync by hand;
// G8 below also asserts that the mirror matches the JS source so the
// two cannot drift in opposite directions silently.
// ----------------------------------------------------------------
const SESSION_BOUNDARY = {
  ScriptSession: {
    semantic: 'writer-context',
    module:   'renderer/js/shell/script-session.js',
    fields:   [
      'activeScript', 'currentScene', 'currentPage', 'currentView',
      'currentSelection', 'openPanels', 'activePanel'
    ]
  },
  ScriptMetrics: {
    semantic: 'derived-analytics',
    module:   'renderer/js/shell/script-metrics.js',
    fields:   [
      'wordCount', 'currentBlockType',
      'dialogueWords', 'actionWords', 'sceneCount', 'estimatedRuntime'
    ]
  },
  ViewManager: {
    semantic: 'view-mode',
    module:   'renderer/js/framework/view-manager.js',
    fields:   ['current']
  },
  WorkspaceState: {
    semantic: 'workspace-persistence',
    module:   'renderer/js/shell/workspace-state.js',
    fields:   ['sidebar', 'studioPanel', 'inspector', 'titleBar', 'statusBar']
  }
};

// ----------------------------------------------------------------
// G8 — ScriptSession snapshot shape stays writer-context-only
// ----------------------------------------------------------------

test('G8: Rga.ScriptSession snapshot exposes EXACTLY the SessionBoundary writer-context fields', () => {
  // Source audit on the live module: scan EMPTY_SNAPSHOT for the
  // key set and assert it matches SessionBoundary.ScriptSession.fields.
  // A future contributor adding e.g. `wordCount: null` to
  // EMPTY_SNAPSHOT fails this guard with a clear pointer to
  // Rga.ScriptMetrics.
  const src = stripComments(readText(path.join(REPO, 'renderer/js/shell/script-session.js')));
  const m = src.match(/EMPTY_SNAPSHOT\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'script-session.js must declare EMPTY_SNAPSHOT');
  const body = m[1];
  // Extract field names: lines like `  activeScript: null,` → 'activeScript'.
  const fieldMatches = body.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm) || [];
  const found = fieldMatches.map(function(s) { return s.replace(/[\s:]/g, ''); }).sort();
  const expected = SESSION_BOUNDARY.ScriptSession.fields.slice().sort();
  assert.deepEqual(found, expected,
    'G8 — Rga.ScriptSession.EMPTY_SNAPSHOT must contain EXACTLY the SessionBoundary writer-context fields.\n' +
    '  expected: ' + expected.join(', ') + '\n' +
    '  found:    ' + found.join(', ') + '\n' +
    'If you need a new field, decide its OWNER (Rga.SessionBoundary) and put it on the right snapshot. ' +
    'Analytics fields belong on Rga.ScriptMetrics.');
});

// ----------------------------------------------------------------
// G9 — ScriptMetrics snapshot stays derived-analytics-only
// ----------------------------------------------------------------

test('G9: Rga.ScriptMetrics get() snapshot exposes EXACTLY the SessionBoundary analytics fields', () => {
  // Source-level: scan get()'s returned object literal and the
  // RESERVED constant; the union must match SessionBoundary.fields.
  // (We don't execute the module here to avoid JSDOM setup; the
  // boundary tests in ownership-stab-slice7.test.js do that.)
  const src = stripComments(readText(path.join(REPO, 'renderer/js/shell/script-metrics.js')));
  // Live fields: appear in `const snap = { wordCount: ..., currentBlockType: ... };`
  const liveMatch = src.match(/const\s+snap\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(liveMatch, 'script-metrics.js must declare a `const snap = { ... }` literal in get()');
  const liveBody = liveMatch[1];
  const liveFields = (liveBody.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm) || [])
    .map(function(s) { return s.replace(/[\s:]/g, ''); });
  // Reserved fields: appear in `const RESERVED = ['...', '...', ...];`
  const resMatch = src.match(/const\s+RESERVED\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(resMatch, 'script-metrics.js must declare a RESERVED array');
  const resFields = (resMatch[1].match(/['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g) || [])
    .map(function(s) { return s.replace(/['"]/g, ''); });
  const found = liveFields.concat(resFields).sort();
  const expected = SESSION_BOUNDARY.ScriptMetrics.fields.slice().sort();
  assert.deepEqual(found, expected,
    'G9 — Rga.ScriptMetrics get() + RESERVED must contain EXACTLY the SessionBoundary analytics fields.\n' +
    '  expected: ' + expected.join(', ') + '\n' +
    '  found:    ' + found.join(', ') + '\n' +
    'If you need a new field, decide its OWNER (Rga.SessionBoundary). ' +
    'Writer-context fields belong on Rga.ScriptSession.');
});

// ----------------------------------------------------------------
// G10 — consumers may not read fields from the wrong owner
// ----------------------------------------------------------------

test('G10: no shell-js consumer reads an analytics field from Rga.ScriptSession.get()', () => {
  // Source audit. Walk shell-js, skipping ScriptSession's own module
  // (it owns its snapshot shape; this guard targets CONSUMERS).
  // Pattern: `<ident>.<field>` where <ident> resolves to a
  // ScriptSession.get() snapshot. We use a generous regex that catches
  // the common patterns:
  //   • Rga.ScriptSession.get().<analyticsField>
  //   • const ss = Rga.ScriptSession.get(); ... ss.<analyticsField>
  // The second pattern needs flow analysis; we approximate by matching
  // the FIELD NAME as a property access within a file that ALSO
  // contains a ScriptSession.get() call.
  const files = shellJsFiles().filter(function(f) {
    return relativeFromRepo(f) !== 'renderer/js/shell/script-session.js' &&
           relativeFromRepo(f) !== 'renderer/js/shell/script-metrics.js' &&
           relativeFromRepo(f) !== 'renderer/js/shell/session-boundary.js';
  });
  const offenders = [];
  const analyticsFields = SESSION_BOUNDARY.ScriptMetrics.fields;
  files.forEach(function(file) {
    const src = stripComments(readText(file));
    // Direct pattern: Rga.ScriptSession.get().<analyticsField>
    analyticsFields.forEach(function(f) {
      const direct = new RegExp(
        'Rga\\.ScriptSession\\.get\\(\\)\\.' + f + '\\b', 'g');
      if (direct.test(src)) {
        offenders.push(relativeFromRepo(file) +
          ' reads "' + f + '" via Rga.ScriptSession.get() — that field is owned by Rga.ScriptMetrics');
      }
    });
    // Indirect pattern: file binds ScriptSession.get() to a local
    // variable, then accesses an analytics field on it. We catch the
    // most common shape: `<var>.<analyticsField>` where the file
    // also has a `ScriptSession.get()` call AND no `ScriptMetrics.get()`
    // call. Conservative — only fires when we're confident the field
    // access is on a ScriptSession snapshot.
    const hasSessionGet = /Rga\.ScriptSession\.get\s*\(/.test(src);
    const hasMetricsGet = /Rga\.ScriptMetrics\.get\s*\(/.test(src);
    if (hasSessionGet && !hasMetricsGet) {
      analyticsFields.forEach(function(f) {
        // Look for `<ident>.<field>` patterns (not preceded by `.`).
        const re = new RegExp('(?:^|[^.\\w])([A-Za-z_][A-Za-z0-9_]*)\\.' + f + '\\b', 'g');
        let m;
        while ((m = re.exec(src))) {
          // Skip the ScriptSession.foo / ScriptMetrics.foo patterns
          // (they're API namespace lookups, not field reads).
          if (m[1] === 'ScriptSession' || m[1] === 'ScriptMetrics' ||
              m[1] === 'Rga' || m[1] === 'Shell' ||
              m[1] === 'Object' || m[1] === 'Array') continue;
          offenders.push(relativeFromRepo(file) +
            ' contains "' + m[1] + '.' + f + '" while reading ScriptSession.get() — ' +
            'likely a ScriptSession-snapshot consumer reading an analytics field. ' +
            'Read it via Rga.ScriptMetrics.get() instead.');
        }
      });
    }
  });
  assert.deepEqual(offenders, [],
    'G10 violations:\n  - ' + offenders.join('\n  - ') + '\n' +
    'Consumers must read each field from its SessionBoundary-declared owner. ' +
    'Analytics fields → Rga.ScriptMetrics; writer-context fields → Rga.ScriptSession.');
});

test('G10 (reverse): no shell-js consumer reads a writer-context field from Rga.ScriptMetrics.get()', () => {
  const files = shellJsFiles().filter(function(f) {
    return relativeFromRepo(f) !== 'renderer/js/shell/script-session.js' &&
           relativeFromRepo(f) !== 'renderer/js/shell/script-metrics.js' &&
           relativeFromRepo(f) !== 'renderer/js/shell/session-boundary.js';
  });
  const offenders = [];
  const writerFields = SESSION_BOUNDARY.ScriptSession.fields;
  files.forEach(function(file) {
    const src = stripComments(readText(file));
    writerFields.forEach(function(f) {
      const direct = new RegExp(
        'Rga\\.ScriptMetrics\\.get\\(\\)\\.' + f + '\\b', 'g');
      if (direct.test(src)) {
        offenders.push(relativeFromRepo(file) +
          ' reads "' + f + '" via Rga.ScriptMetrics.get() — that field is owned by Rga.ScriptSession');
      }
    });
  });
  assert.deepEqual(offenders, [],
    'G10 reverse violations:\n  - ' + offenders.join('\n  - '));
});

// ----------------------------------------------------------------
// G11 — extraction drift guards (Slice 8 §B)
// ----------------------------------------------------------------
//
// Lock app-shell.js's allowed top-level Rga.* declarations. The list
// below is the EXACT set of modules permitted to live in
// renderer/js/app-shell.js after Runtime Ownership Stab. Slice 8.
// Adding a new module here (instead of creating a new file under
// renderer/js/shell/) fails G11; moving an extracted module back
// INTO app-shell.js fails G11; growing the responsibility count
// fails G11.
//
// To EXTRACT a module: delete it from app-shell.js, create
// renderer/js/shell/<name>.js with the same IIFE+Rga.* assignment,
// load it in renderer/index.html, then REMOVE its name from this
// list. CI will then enforce the smaller surface.
//
// To ADD a new module: open a new file under renderer/js/shell/.
// Do NOT add it to app-shell.js. (If the addition is unavoidable —
// e.g. tightly coupled to existing legacy code — amend this list
// in the same PR with a one-paragraph justification.)
const APP_SHELL_ALLOWED_MODULES = [
  'Theme',                  // single-owner per Slice 2 §B
  'Sidebar',                // 5-LOC no-op shim for engine consumer tags.js:206
  'Keyboard',               // 12-LOC delegating shim → Rga.KeyboardRegistry
  'BottomPanel',            // post-Slice-9 §A: thin shim → Rga.Shell.StudioPanel
                            //   (engine consumers annotations.js, revision-flags.js)
  'Inspector'               // post-Slice-9 §A: thin shim → Rga.Shell.StudioPanel
                            //   (engine consumer context-menu.js)
  // SceneNotesConnector — DELETED in Slice 9 §A (zero callers; folded
  // into Rga.Shell.StudioPanel's _wireSceneNotesConnector).
];

test('G11: app-shell.js declares ONLY the allow-listed Rga.* modules', () => {
  const src = readText(path.join(REPO, 'renderer/js/app-shell.js'));
  // Match top-level `Rga.<Name> = {` declarations. Comments stripped
  // so deletion-pointer comments don't trigger false positives.
  const code = stripComments(src);
  const re = /^Rga\.([A-Z][A-Za-z0-9_]*)\s*=\s*\{/gm;
  const found = [];
  let m;
  while ((m = re.exec(code))) found.push(m[1]);
  const foundSorted = found.slice().sort();
  const allowedSorted = APP_SHELL_ALLOWED_MODULES.slice().sort();
  assert.deepEqual(foundSorted, allowedSorted,
    'G11 — app-shell.js module surface drift:\n' +
    '  expected (allow-list): ' + allowedSorted.join(', ') + '\n' +
    '  found:                 ' + foundSorted.join(', ') + '\n' +
    'New modules belong in renderer/js/shell/<name>.js, not app-shell.js. ' +
    'If you extracted a module, update APP_SHELL_ALLOWED_MODULES in the same PR. ' +
    'If you re-introduced a previously-extracted module, that is a regression — ' +
    'extracted responsibilities cannot move back to app-shell.js.');
});

test('G11: extracted modules (Toast / Modal / CommandPalette / Resize / ScriptLanguage / FileTree / Tabs) do NOT appear in app-shell.js', () => {
  // Explicit denylist — names that have been extracted or deleted
  // and must never come back. Pairs with G11 above to give a clear
  // error message when a regression is attempted.
  const FORBIDDEN_IN_APP_SHELL = [
    'Toast',               // extracted Slice 8 §A → shell/toast.js
    'Modal',               // extracted Slice 8 §A → shell/modal.js
    'CommandPalette',      // extracted Slice 8 §A → shell/command-palette.js
    'Resize',              // extracted Slice 8 §A → shell/resize.js
    'ScriptLanguage',      // extracted Slice 8 §A → shell/script-language.js
    'SceneNotesConnector', // deleted Slice 9 §A (zero callers; folded into StudioPanel)
    'FileTree',            // deleted Slice 3 §A (zero consumers; dead DOM target)
    'Tabs'                 // deleted Slice 3 §A (zero consumers; replaced by Rga.TabManager)
  ];
  const code = stripComments(readText(path.join(REPO, 'renderer/js/app-shell.js')));
  const violations = [];
  FORBIDDEN_IN_APP_SHELL.forEach(function(name) {
    const re = new RegExp('^Rga\\.' + name + '\\s*=\\s*\\{', 'm');
    if (re.test(code)) violations.push(name);
  });
  assert.deepEqual(violations, [],
    'G11 — these modules were extracted/deleted and must NOT reappear in app-shell.js: ' +
    violations.join(', ') + '. ' +
    'Each name maps to a documented destination in the legacy-extraction-roadmap.');
});

test('G11: app-shell.js stays at or under its post-Slice-8 size ceiling', () => {
  // Soft ceiling — prevents stealth re-growth. The ceiling grows the
  // file's then-current size by a small headroom. Bump deliberately
  // when a justified addition lands (and document why in the same PR).
  // Post-Slice-8 §A: 397 LOC. Ceiling: 450 LOC (~13% headroom).
  const CEILING = 450;
  const src = readText(path.join(REPO, 'renderer/js/app-shell.js'));
  const lineCount = src.split('\n').length;
  assert.ok(lineCount <= CEILING,
    'G11 — app-shell.js exceeds the post-Slice-8 line-count ceiling of ' + CEILING +
    ' (currently ' + lineCount + '). If the growth is justified, raise the ceiling in this guard ' +
    'AND document the addition in the legacy-extraction-roadmap.');
});

test('G11: every ownership-matrix module-path reference points at an existing file', () => {
  // Walks the ownership matrix + extraction roadmap + runtime audit
  // for `renderer/js/...` paths in backtick-quoted form and asserts
  // each path exists on disk. Prevents matrix drift when a file
  // moves but the docs don't.
  //
  // ASPIRATIONAL_PATHS: file paths the roadmap names as a FUTURE
  // destination for a planned extraction. Listed here so the guard
  // doesn't fail until the extraction lands. Remove a path from
  // this set when the file is created.
  const ASPIRATIONAL_PATHS = new Set([
    'renderer/js/shell/panels/notes-connector.js'  // SceneNotesConnector — bundled with StudioPanel migration
  ]);
  const DOC_FILES = [
    'docs/design-system/rwanga-ownership-matrix.md',
    'docs/design-system/rwanga-legacy-extraction-roadmap.md',
    'docs/design-system/rwanga-runtime-audit.md',
    'docs/design-system/rwanga-storage-ownership.md'
  ];
  const missing = [];
  DOC_FILES.forEach(function(docRel) {
    const docPath = path.join(REPO, docRel);
    if (!fs.existsSync(docPath)) return;
    const src = readText(docPath);
    const re = /`(renderer\/js\/[A-Za-z0-9_\-./]+\.js)`/g;
    const seen = new Set();
    let m;
    while ((m = re.exec(src))) {
      const p = m[1];
      if (seen.has(p)) continue;
      seen.add(p);
      if (ASPIRATIONAL_PATHS.has(p)) continue;  // future destination — allowed
      const full = path.join(REPO, p);
      if (!fs.existsSync(full)) missing.push(docRel + '  →  ' + p);
    }
  });
  assert.deepEqual(missing, [],
    'G11 — ownership docs reference non-existent files:\n  ' + missing.join('\n  ') + '\n' +
    'Either the file was renamed/extracted (update the doc) or the doc has a typo. ' +
    'If the path is a planned future destination, add it to ASPIRATIONAL_PATHS.');
});

// ----------------------------------------------------------------
// G12 — StudioPanel ownership lock (Slice 9 §B)
// ----------------------------------------------------------------
//
// After Slice 9 §A, Rga.Shell.StudioPanel is the sole owner of
// bottom-panel + inspector + scene-notes routing. The G12 quadruplet
// prevents the consolidated ownership from breaking up again:
//
//   • BottomPanel implementation cannot move back into app-shell.js
//     (the shim is allowed; the body is not).
//   • Inspector implementation cannot move back.
//   • SceneNotesConnector cannot return (was deleted).
//   • StudioPanel stays the sole owner of bottom-collapsed +
//     inspector-hidden DOM classes.

test('G12: Rga.BottomPanel in app-shell.js is a thin shim (delegates to StudioPanel; not an owner)', () => {
  const src = stripComments(readText(path.join(REPO, 'renderer/js/app-shell.js')));
  // Extract the Rga.BottomPanel = { ... } block.
  const m = src.match(/Rga\.BottomPanel\s*=\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, 'app-shell.js must declare Rga.BottomPanel (as a shim)');
  const body = m[1];
  // The shim's methods must all call into Rga.Shell.StudioPanel.
  // Count delegating call sites — there must be one for each shim method.
  const delegates = (body.match(/Rga\.Shell\.StudioPanel\.\w+\(/g) || []).length;
  assert.ok(delegates >= 4,
    'Rga.BottomPanel shim must delegate to Rga.Shell.StudioPanel — found only ' +
    delegates + ' delegate call(s). Each shim method (init / open / switchTo / toggleCollapse) ' +
    'must route through StudioPanel.');
  // Forbidden: Layout.set inside the shim body (that would mean the
  // shim is reaching past the SSOT it's supposed to delegate through).
  assert.equal(/Rga\.Shell\.Layout\.set/.test(body), false,
    'Rga.BottomPanel shim must NOT call Layout.set directly — delegate to StudioPanel instead.');
});

test('G12: Rga.Inspector in app-shell.js is a thin shim (delegates to StudioPanel; not an owner)', () => {
  const src = stripComments(readText(path.join(REPO, 'renderer/js/app-shell.js')));
  const m = src.match(/Rga\.Inspector\s*=\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, 'app-shell.js must declare Rga.Inspector (as a shim)');
  const body = m[1];
  const delegates = (body.match(/Rga\.Shell\.StudioPanel\.\w+\(/g) || []).length;
  assert.ok(delegates >= 2,
    'Rga.Inspector shim must delegate to Rga.Shell.StudioPanel — found only ' +
    delegates + ' delegate call(s). Both methods (toggle / open) must route through StudioPanel.');
  // Forbidden: directly touching the #workspace classList inside the
  // shim — that's StudioPanel's job.
  assert.equal(/classList\.(add|remove|toggle)\s*\(\s*['"]inspector-hidden['"]/.test(body), false,
    'Rga.Inspector shim must NOT toggle the inspector-hidden class directly — delegate to StudioPanel.');
});

test('G12: Rga.SceneNotesConnector cannot return to app-shell.js (deleted Slice 9 §A)', () => {
  // Already covered by G11's deny-list, but G12 keeps the boundary
  // explicit alongside the rest of the StudioPanel ownership story.
  const src = stripComments(readText(path.join(REPO, 'renderer/js/app-shell.js')));
  assert.equal(/^Rga\.SceneNotesConnector\s*=\s*\{/m.test(src), false,
    'Rga.SceneNotesConnector was deleted in Slice 9 §A; its scene-notes-routing ' +
    'behavior lives in Rga.Shell.StudioPanel now. Do not re-introduce.');
});

test('G12: Rga.Shell.StudioPanel is the SOLE writer of inspector-hidden class', () => {
  // Walk shell-js. Only studio-panel.js (and inspector-hidden CSS
  // rules, which don't appear in JS) may toggle / add / remove it.
  const files = shellJsFiles();
  const offenders = [];
  files.forEach(function(file) {
    const src = stripComments(readText(file));
    if (/classList\.(?:add|remove|toggle)\s*\(\s*['"]inspector-hidden['"]/.test(src)) {
      const rel = relativeFromRepo(file);
      if (rel !== 'renderer/js/shell/studio-panel.js') offenders.push(rel);
    }
  });
  assert.deepEqual(offenders, [],
    'G12 — only Rga.Shell.StudioPanel may toggle the inspector-hidden class. ' +
    'Unexpected writers: ' + offenders.join(', ') + '. Route through ' +
    'StudioPanel.toggleInspector / StudioPanel.openInspector.');
});

test('G7: every owned key has a corresponding restore (getItem) call in its restoreIn module', () => {
  // A persistence key is only useful if SOMETHING reads it back on
  // boot. This guard scans each registered key's restoreIn module
  // for evidence of a restore path:
  //   (a) the literal key string appears somewhere in the file
  //       (typically a `const KEY = '<key>'` declaration), AND
  //   (b) the file contains at least one localStorage.getItem(...)
  //       call (with any argument shape — literal, variable, etc.).
  // Both together are strong evidence that the module reads the key
  // on boot; an enforced literal-only regex was too strict (modules
  // legitimately store keys in constants).
  const offenders = [];
  Object.keys(STORAGE_OWNERS).forEach(function(key) {
    const owner = STORAGE_OWNERS[key];
    if (!owner.restoreIn || owner.restoreIn.length === 0) {
      offenders.push(key + ' has no restoreIn module declared');
      return;
    }
    owner.restoreIn.forEach(function(rel) {
      const full = path.join(REPO, rel);
      if (!fs.existsSync(full)) {
        offenders.push(key + ': restoreIn file ' + rel + ' does not exist');
        return;
      }
      const src = stripComments(readText(full));
      const hasKeyLiteral = src.indexOf("'" + key + "'") >= 0 || src.indexOf('"' + key + '"') >= 0;
      const hasGetItem    = /localStorage\.getItem\s*\(/.test(src);
      if (!hasKeyLiteral) {
        offenders.push(key + ': restoreIn ' + rel + ' does NOT contain the key literal "' + key + '"');
        return;
      }
      if (!hasGetItem) {
        offenders.push(key + ': restoreIn ' + rel + ' contains the key literal but no localStorage.getItem(...) call — no restore path exists');
      }
    });
  });
  assert.deepEqual(offenders, [],
    'G7 — owned keys without a restore path:\n  - ' + offenders.join('\n  - '));
});
