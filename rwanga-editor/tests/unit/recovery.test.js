// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// A minimal sessionStorage stub so the reload-vs-fresh-launch flag is
// deterministic (JSDOM's storage can be unavailable for opaque origins). When
// `booted` is true we pre-seed the flag, simulating a renderer RELOAD.
function stubSessionStorage(win, booted) {
  const store = new Map();
  if (booted) store.set('rga-recovery-session-booted', '1');
  const ss = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
  try { Object.defineProperty(win, 'sessionStorage', { value: ss, configurable: true }); }
  catch (_) { win.sessionStorage = ss; }
  return ss;
}

// Load recovery.js (a renderer IIFE) against a fresh JSDOM window with stubs.
function loadRecovery(opts) {
  opts = opts || {};
  const calls = { opened: [], dirtied: [], discarded: [], prompted: 0 };
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  stubSessionStorage(dom.window, !!opts.booted);   // booted:true → simulate a reload
  dom.window.Rga = {
    Modal: { showRecovery: async () => { calls.prompted += 1; return opts.choice || 'discard'; } },
    Doc: {
      deserialize: (rga) => {
        if (opts.corrupt && rga === opts.corrupt) throw new Error('corrupt');
        return { docId: 'fresh-' + rga, displayName: 'r.rga', body: null, dirty: false };
      },
      markDirty: (d) => calls.dirtied.push(d)
    },
    TabManager: { openDocument: (d) => calls.opened.push(d) }
  };
  dom.window.rwanga = {
    autosave: {
      scanOrphans: async () => opts.orphans || [],
      discard: (id) => calls.discarded.push(id)
    }
  };
  delete require.cache[require.resolve('../../renderer/js/recovery.js')];
  require('../../renderer/js/recovery.js');
  return { R: dom.window.Rga.Recovery, calls };
}

test('run with no orphans returns restoredCount 0 and shows no prompt', async () => {
  let prompted = false;
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only' });
  global.window = dom.window; global.document = dom.window.document;
  dom.window.Rga = { Modal: { showRecovery: async () => { prompted = true; return 'discard'; } } };
  dom.window.rwanga = { autosave: { scanOrphans: async () => [] } };
  delete require.cache[require.resolve('../../renderer/js/recovery.js')];
  require('../../renderer/js/recovery.js');
  const result = await dom.window.Rga.Recovery.run();
  assert.deepEqual(result, { restoredCount: 0 });
  assert.equal(prompted, false);
});

test('run with orphans + Restore reopens each as a dirty tab', async () => {
  const { R, calls } = loadRecovery({
    choice: 'restore',
    orphans: [
      { id: 'oA', rga: 'RGA-A', baseHandle: '/x/a.rga', baseDisplayName: 'a.rga' },
      { id: 'oB', rga: 'RGA-B', baseHandle: null, baseDisplayName: 'Untitled.rga' }
    ]
  });
  const result = await R.run();
  assert.equal(result.restoredCount, 2);
  assert.equal(calls.opened.length, 2);
  assert.equal(calls.dirtied.length, 2);
});

test('a restored document reuses the orphan id as its docId', async () => {
  const { R, calls } = loadRecovery({
    choice: 'restore',
    orphans: [{ id: 'orphan-7', rga: 'RGA-A', baseHandle: null, baseDisplayName: 'a.rga' }]
  });
  await R.run();
  assert.equal(calls.opened[0].docId, 'orphan-7');
});

test('run with orphans + Discard deletes each snapshot and opens nothing', async () => {
  const { R, calls } = loadRecovery({
    choice: 'discard',
    orphans: [
      { id: 'oA', rga: 'RGA-A', baseDisplayName: 'a.rga' },
      { id: 'oB', rga: 'RGA-B', baseDisplayName: 'b.rga' }
    ]
  });
  const result = await R.run();
  assert.equal(result.restoredCount, 0);
  assert.deepEqual(calls.discarded.sort(), ['oA', 'oB']);
  assert.equal(calls.opened.length, 0);
});

// ----------------------------------------------------------------
// Reload vs fresh-launch — the idle-recovery bug fix.
// ----------------------------------------------------------------

test('fresh launch (no boot flag) PROMPTS for crash orphans', async () => {
  const { R, calls } = loadRecovery({
    booted: false, choice: 'discard',
    orphans: [{ id: 'oA', rga: 'RGA-A', baseDisplayName: 'a.rga' }]
  });
  await R.run();
  assert.equal(calls.prompted, 1, 'a fresh launch must prompt the user (crash recovery)');
});

test('in-session reload (boot flag set) does NOT prompt — restores silently', async () => {
  const { R, calls } = loadRecovery({
    booted: true,                       // simulate a renderer reload
    orphans: [
      { id: 'live-1', rga: 'RGA-A', baseHandle: '/x/a.rga', baseDisplayName: 'a.rga' },
      { id: 'live-2', rga: 'RGA-B', baseHandle: null, baseDisplayName: 'Untitled.rga' }
    ]
  });
  const result = await R.run();
  assert.equal(calls.prompted, 0, 'a reload must NEVER show the recovery prompt');
  assert.equal(result.reload, true);
  assert.equal(result.restoredCount, 2, 'the live snapshots are silently restored');
  assert.equal(calls.opened.length, 2, 'both live documents reopen (continuity)');
});

test('in-session reload NEVER discards a live snapshot (no data loss)', async () => {
  const { R, calls } = loadRecovery({
    booted: true,
    orphans: [{ id: 'live-1', rga: 'RGA-A', baseHandle: null, baseDisplayName: 'Untitled.rga' }]
  });
  await R.run();
  assert.equal(calls.discarded.length, 0, 'a reload must never delete a live (untitled) snapshot');
  assert.equal(calls.opened.length, 1, 'the untitled doc is preserved by silent restore');
});

test('the FIRST run marks the window booted; a SECOND run is treated as a reload', async () => {
  // booted:false → first run is a fresh launch (prompts). The same window's
  // sessionStorage now carries the flag, so a second run is a reload (silent).
  const { R, calls } = loadRecovery({
    booted: false, choice: 'discard',
    orphans: [{ id: 'oA', rga: 'RGA-A', baseHandle: null, baseDisplayName: 'a.rga' }]
  });
  await R.run();
  assert.equal(calls.prompted, 1);          // fresh launch prompted
  // Discard removed the orphan in the fresh run; re-arm a live orphan for the
  // reload run by calling run() again with the flag now set.
  const r2 = await R.run();
  assert.equal(calls.prompted, 1, 'the second run (reload) must not prompt again');
  // (orphans list is the same stub; on the reload run it restores silently)
  assert.equal(r2.reload, true);
});

test('a corrupt orphan is skipped — the others still restore', async () => {
  const { R, calls } = loadRecovery({
    choice: 'restore',
    corrupt: 'RGA-BAD',
    orphans: [
      { id: 'oBad', rga: 'RGA-BAD', baseDisplayName: 'bad.rga' },
      { id: 'oGood', rga: 'RGA-GOOD', baseDisplayName: 'good.rga' }
    ]
  });
  const result = await R.run();
  assert.equal(result.restoredCount, 1);
  assert.equal(calls.opened.length, 1);
  assert.equal(calls.opened[0].docId, 'oGood');
});
