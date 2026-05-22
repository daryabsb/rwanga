// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function loadModal() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  delete require.cache[require.resolve('../../renderer/js/shell/modal.js')];
  require('../../renderer/js/shell/modal.js');
  return dom.window;
}

test('showRecovery shows a modal listing the orphans and resolves on Restore', async () => {
  const w = loadModal();
  const orphans = [
    { id: 'd1', baseDisplayName: 'one.rga', savedAt: Date.now() },
    { id: 'd2', baseDisplayName: 'two.rga', savedAt: Date.now() }
  ];
  const p = w.Rga.Modal.showRecovery(orphans);
  const modal = w.document.getElementById('recovery-modal');
  assert.ok(modal, 'the recovery modal is in the DOM');
  assert.match(modal.textContent, /one\.rga/);
  assert.match(modal.textContent, /two\.rga/);
  modal.querySelector('[data-choice="restore"]').dispatchEvent(
    new w.Event('click', { bubbles: true }));
  assert.equal(await p, 'restore');
  assert.equal(w.document.getElementById('recovery-modal'), null,
    'the modal is removed after a choice');
});

test('showRecovery resolves discard on the Discard button', async () => {
  const w = loadModal();
  const p = w.Rga.Modal.showRecovery([{ id: 'd1', baseDisplayName: 'a.rga', savedAt: Date.now() }]);
  w.document.getElementById('recovery-modal')
    .querySelector('[data-choice="discard"]')
    .dispatchEvent(new w.Event('click', { bubbles: true }));
  assert.equal(await p, 'discard');
});
