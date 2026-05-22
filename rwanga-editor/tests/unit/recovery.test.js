// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Load recovery.js (a renderer IIFE) against a fresh JSDOM window with stubs.
function loadRecovery(opts) {
  opts = opts || {};
  const calls = { opened: [], dirtied: [], discarded: [] };
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {
    Modal: { showRecovery: async () => opts.choice || 'discard' },
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
