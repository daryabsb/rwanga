// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Load close-guard.js (a renderer IIFE) against a fresh JSDOM window whose
// window.Rga is pre-seeded with the given stub collaborators.
function loadCloseGuard(rgaStubs) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = rgaStubs || {};
  delete require.cache[require.resolve('../../renderer/js/close-guard.js')];
  require('../../renderer/js/close-guard.js');
  return dom.window.Rga.CloseGuard;
}

test('confirmClose on a clean document proceeds without a prompt', async () => {
  let prompted = false;
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => { prompted = true; return 'cancel'; } }
  });
  const verdict = await CG.confirmClose({ id: 't1', doc: { displayName: 'a.rga', dirty: false } });
  assert.equal(verdict, 'proceed');
  assert.equal(prompted, false);
});

test('confirmClose returns cancel when the user cancels', async () => {
  const CG = loadCloseGuard({ Modal: { showUnsaved: async () => 'cancel' } });
  const verdict = await CG.confirmClose({ id: 't1', doc: { displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'cancel');
});

test('confirmClose returns proceed on discard', async () => {
  const CG = loadCloseGuard({ Modal: { showUnsaved: async () => 'discard' } });
  const verdict = await CG.confirmClose({ id: 't1', doc: { displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'proceed');
});

test('confirmClose on save activates the tab, saves, and proceeds', async () => {
  let activated = null;
  let saved = false;
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => 'save' },
    TabManager: { activate: (id) => { activated = id; } },
    FileManager: { save: async () => { saved = true; return { savedAt: 1 }; } }
  });
  const verdict = await CG.confirmClose({ id: 't7', doc: { displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'proceed');
  assert.equal(activated, 't7');
  assert.equal(saved, true);
});

test('confirmClose returns cancel when the save fails', async () => {
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => 'save' },
    TabManager: { activate: () => {} },
    FileManager: { save: async () => null }   // save failed / cancelled
  });
  const verdict = await CG.confirmClose({ id: 't1', doc: { displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'cancel');
});

test('confirmAppClose returns true when no document is dirty', async () => {
  let prompted = false;
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => { prompted = true; return 'cancel'; } },
    TabManager: { tabs: () => [
      { id: 't1', doc: { dirty: false } },
      { id: 't2', doc: { dirty: false } }
    ] }
  });
  assert.equal(await CG.confirmAppClose(), true);
  assert.equal(prompted, false);
});

test('confirmAppClose returns false when a dirty document is cancelled', async () => {
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => 'cancel' },
    TabManager: { tabs: () => [ { id: 't1', doc: { displayName: 'a.rga', dirty: true } } ] }
  });
  assert.equal(await CG.confirmAppClose(), false);
});

test('confirmAppClose returns true when every dirty document is discarded', async () => {
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => 'discard' },
    TabManager: { tabs: () => [
      { id: 't1', doc: { displayName: 'a.rga', dirty: true } },
      { id: 't2', doc: { displayName: 'b.rga', dirty: true } }
    ] }
  });
  assert.equal(await CG.confirmAppClose(), true);
});

test('confirmAppClose stops at the first cancel — sequential per-document', async () => {
  let prompts = 0;
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => { prompts += 1; return 'cancel'; } },
    TabManager: { tabs: () => [
      { id: 't1', doc: { displayName: 'a.rga', dirty: true } },
      { id: 't2', doc: { displayName: 'b.rga', dirty: true } }
    ] }
  });
  assert.equal(await CG.confirmAppClose(), false);
  assert.equal(prompts, 1);   // did not prompt t2 after t1 cancelled
});

test('confirmClose on discard also discards the recovery snapshot', async () => {
  const CG = loadCloseGuard({ Modal: { showUnsaved: async () => 'discard' } });
  const discarded = [];
  global.window.rwanga = { autosave: { discard: (id) => discarded.push(id) } };
  const verdict = await CG.confirmClose(
    { id: 't1', doc: { docId: 'doc-9', displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'proceed');
  assert.deepEqual(discarded, ['doc-9']);
  delete global.window.rwanga;
});
