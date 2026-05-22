// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Load autosave.js (a renderer IIFE) against a fresh JSDOM window with stub
// collaborators. Returns the module plus arrays capturing IPC calls.
function loadAutosave(opts) {
  opts = opts || {};
  const writes = [];
  const discards = [];
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = { Doc: { serialize: () => opts.serialized || 'RGA-STRING' } };
  dom.window.rwanga = {
    autosave: {
      write: (docId, envelope) => writes.push({ docId, envelope }),
      discard: (docId) => discards.push(docId)
    }
  };
  delete require.cache[require.resolve('../../renderer/js/autosave.js')];
  require('../../renderer/js/autosave.js');
  return { A: dom.window.Rga.Autosave, writes, discards };
}

test('first edit writes an immediate seed snapshot — no debounce wait', () => {
  const { A, writes } = loadAutosave();
  A.notifyChange({ docId: 'd1', displayName: 'a.rga', handle: '/x/a.rga' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].docId, 'd1');
  assert.equal(writes[0].envelope.schemaVersion, 1);
  assert.equal(writes[0].envelope.rga, 'RGA-STRING');
});

test('debounce — a 2s pause after a follow-up edit triggers a snapshot', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { A, writes } = loadAutosave();
  const doc = { docId: 'd1', displayName: 'a.rga', handle: null };
  A.notifyChange(doc);                 // seed (immediate)
  assert.equal(writes.length, 1);
  A.notifyChange(doc);                 // arms the 2s debounce
  t.mock.timers.tick(1999);
  assert.equal(writes.length, 1);      // not yet
  t.mock.timers.tick(1);               // 2000ms elapsed
  assert.equal(writes.length, 2);      // debounce fired
});

test('max interval — a snapshot is forced within 10s of continuous editing', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { A, writes } = loadAutosave();
  const doc = { docId: 'd1', displayName: 'a.rga', handle: null };
  A.notifyChange(doc);                 // seed at t=0
  for (let i = 0; i < 8; i += 1) {     // edit every 1.5s for 12s
    t.mock.timers.tick(1500);
    A.notifyChange(doc);
  }
  // The debounce (2s) never fires — it is re-armed every 1.5s — yet the
  // max-interval forced at least one extra snapshot by the ~10s mark.
  assert.ok(writes.length >= 2, 'max interval should force a snapshot');
});

test('multiple documents — independent seeds and timers', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { A, writes } = loadAutosave();
  const docA = { docId: 'dA', displayName: 'a.rga', handle: null };
  const docB = { docId: 'dB', displayName: 'b.rga', handle: null };
  A.notifyChange(docA);
  A.notifyChange(docB);
  assert.deepEqual(writes.map((w) => w.docId).sort(), ['dA', 'dB']);
  A.notifyChange(docA);                // arm dA debounce
  A.notifyChange(docB);                // arm dB debounce
  t.mock.timers.tick(2000);
  const ids = writes.map((w) => w.docId);
  assert.ok(ids.filter((x) => x === 'dA').length >= 2);
  assert.ok(ids.filter((x) => x === 'dB').length >= 2);
});

test('untitled document — autosave still writes, with baseHandle null', () => {
  const { A, writes } = loadAutosave();
  A.notifyChange({ docId: 'd1', displayName: 'Untitled.rga', handle: null });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].envelope.baseHandle, null);
});

test('manual save discards the snapshot and cancels pending autosave', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { A, writes, discards } = loadAutosave();
  const doc = { docId: 'd1', displayName: 'a.rga', handle: '/x/a.rga' };
  A.notifyChange(doc);                 // seed
  A.notifyChange(doc);                 // arms debounce
  A.notifyClean(doc);                  // manual save
  assert.deepEqual(discards, ['d1']);
  t.mock.timers.tick(5000);
  assert.equal(writes.length, 1, 'no autosave write after the snapshot was discarded');
});

test('a document that is never edited produces no autosave writes', () => {
  const { A, writes } = loadAutosave();
  assert.ok(A, 'module loaded');
  assert.equal(writes.length, 0);
});
