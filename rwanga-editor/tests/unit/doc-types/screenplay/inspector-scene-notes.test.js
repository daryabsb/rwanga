// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.5 — screenplay inspector-scene-notes panel.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const HTML = '<!DOCTYPE html><html><body>' +
  '<aside id="inspector-panel">' +
    '<div class="inspector-body" aria-live="polite">' +
      '<div class="inspector-empty">' +
        '<div class="inspector-empty-icon">◌</div>' +
        '<div class="inspector-empty-title">No details to show.</div>' +
        '<div class="inspector-empty-help">Select a tag or a scene heading to inspect it.</div>' +
      '</div>' +
    '</div>' +
  '</aside>' +
  '</body></html>';

function boot() {
  const dom = new JSDOM(HTML, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  // Load order: Inspector host first, then shared source, then the
  // screenplay inspector-scene-notes panel (matches index.html).
  const files = [
    '../../../../renderer/js/shell/inspector.js',
    '../../../../renderer/js/doc-types/screenplay/scene-notes.js',
    '../../../../renderer/js/doc-types/screenplay/inspector-scene-notes.js'
  ];
  files.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  const Rga = global.window.Rga;
  Rga.Shell.Inspector._reset();
  Rga.SceneNotes._reset();
  Rga.Shell.Inspector.setHost(global.document.querySelector('.inspector-body'));
  // The IIFE registered the panel before _reset wiped the registry —
  // re-require the panel file so it re-registers against the fresh
  // Inspector registry state.
  delete require.cache[require.resolve(
    '../../../../renderer/js/doc-types/screenplay/inspector-scene-notes.js')];
  require('../../../../renderer/js/doc-types/screenplay/inspector-scene-notes.js');
  return { Rga, dom };
}

// ----------------------------------------------------------------
// §1 — Registration
// ----------------------------------------------------------------

test('F1A.5 — inspector-scene-notes registers a panel with id "scene-notes"', () => {
  const { Rga } = boot();
  const ids = Rga.Shell.Inspector.registered();
  assert.ok(ids.indexOf('scene-notes') >= 0,
    'scene-notes must appear in the inspector registry');
  const ctrl = Rga.Shell.Inspector.getController('scene-notes');
  assert.ok(ctrl);
  assert.equal(ctrl.label, 'Scene Notes');
  assert.equal(typeof ctrl.mount, 'function');
  assert.equal(typeof ctrl.unmount, 'function');
  assert.equal(typeof ctrl.isApplicable, 'function');
});

// ----------------------------------------------------------------
// §2 — F1A.5 does NOT auto-activate (invocation-based)
// ----------------------------------------------------------------

test('F1A.5 — inspector panel is registered but NOT active by default', () => {
  const { Rga, dom } = boot();
  assert.equal(Rga.Shell.Inspector.current(), null,
    'no panel auto-activated — empty state must remain');
  // The empty-state markup is still in the inspector body.
  assert.ok(dom.window.document.querySelector('.inspector-body .inspector-empty'));
  assert.equal(dom.window.document.querySelector(
    '.inspector-body .rga-inspector-scene-notes'), null);
});

// ----------------------------------------------------------------
// §3 — isApplicable depends on whether a current scene exists
// ----------------------------------------------------------------

test('F1A.5 — isApplicable returns false when no current scene is set', () => {
  const { Rga } = boot();
  assert.equal(Rga.Shell.Inspector.isApplicable('scene-notes', {}), false);
});

test('F1A.5 — isApplicable returns true once a current scene exists', () => {
  const { Rga } = boot();
  Rga.SceneNotes.setCurrentScene('s1', 'INT. KITCHEN');
  assert.equal(Rga.Shell.Inspector.isApplicable('scene-notes', {}), true);
});

// ----------------------------------------------------------------
// §4 — Activation renders the current scene's notes
// ----------------------------------------------------------------

test('F1A.5 — activating the panel with no current scene shows the no-scene state', () => {
  const { Rga, dom } = boot();
  Rga.Shell.Inspector.activate('scene-notes');
  const root = dom.window.document.querySelector('.rga-inspector-scene-notes');
  assert.ok(root, 'panel root rendered');
  const label = root.querySelector('.rga-inspector-scene-notes-label');
  assert.equal(label.textContent, 'Scene Notes — no scene selected');
  const ta = root.querySelector('.rga-inspector-scene-notes-textarea');
  assert.equal(ta.disabled, true);
});

test('F1A.5 — activating renders the current scene\'s notes from the shared source', () => {
  const { Rga, dom } = boot();
  Rga.SceneNotes.setCurrentScene('s1', 'INT. KITCHEN');
  Rga.SceneNotes.set('s1', 'first note');
  Rga.Shell.Inspector.activate('scene-notes');
  const root = dom.window.document.querySelector('.rga-inspector-scene-notes');
  const label = root.querySelector('.rga-inspector-scene-notes-label');
  assert.equal(label.textContent, 'Scene Notes — Scene INT. KITCHEN');
  const ta = root.querySelector('.rga-inspector-scene-notes-textarea');
  assert.equal(ta.disabled, false);
  assert.equal(ta.value, 'first note');
});

// ----------------------------------------------------------------
// §5 — Cross-surface sync (the F1A.5 raison d'être)
// ----------------------------------------------------------------

test('F1A.5 — external write to Rga.SceneNotes updates the inspector textarea', () => {
  const { Rga, dom } = boot();
  Rga.SceneNotes.setCurrentScene('s1', 'A');
  Rga.Shell.Inspector.activate('scene-notes');
  const ta = dom.window.document.querySelector(
    '.rga-inspector-scene-notes-textarea');
  // Simulate an external writer (bottom panel, future surface).
  Rga.SceneNotes.set('s1', 'from-elsewhere');
  assert.equal(ta.value, 'from-elsewhere');
});

test('F1A.5 — changing the current scene re-renders the inspector for the new scene', () => {
  const { Rga, dom } = boot();
  Rga.SceneNotes.set('s1', 'note for one');
  Rga.SceneNotes.set('s2', 'note for two');
  Rga.SceneNotes.setCurrentScene('s1', 'A');
  Rga.Shell.Inspector.activate('scene-notes');
  let ta = dom.window.document.querySelector(
    '.rga-inspector-scene-notes-textarea');
  assert.equal(ta.value, 'note for one');
  // Cursor moves to scene 2 — shared source publishes, inspector
  // re-renders for the new scene.
  Rga.SceneNotes.setCurrentScene('s2', 'B');
  ta = dom.window.document.querySelector(
    '.rga-inspector-scene-notes-textarea');
  assert.equal(ta.value, 'note for two');
});

test('F1A.5 — changing scene to null disables the textarea + shows no-scene label', () => {
  const { Rga, dom } = boot();
  Rga.SceneNotes.set('s1', 'a note');
  Rga.SceneNotes.setCurrentScene('s1', 'A');
  Rga.Shell.Inspector.activate('scene-notes');
  Rga.SceneNotes.setCurrentScene(null);
  const ta = dom.window.document.querySelector(
    '.rga-inspector-scene-notes-textarea');
  assert.equal(ta.disabled, true);
  assert.equal(ta.value, '');
  const label = dom.window.document.querySelector(
    '.rga-inspector-scene-notes-label');
  assert.equal(label.textContent, 'Scene Notes — no scene selected');
});

// ----------------------------------------------------------------
// §6 — Deactivate restores the host's empty state (F1A.3 host contract)
// ----------------------------------------------------------------

test('F1A.5 — deactivating the panel restores the inspector empty state', () => {
  const { Rga, dom } = boot();
  const beforeHtml = dom.window.document.querySelector('.inspector-body').innerHTML;
  Rga.SceneNotes.setCurrentScene('s1', 'A');
  Rga.Shell.Inspector.activate('scene-notes');
  Rga.Shell.Inspector.deactivate();
  const afterHtml = dom.window.document.querySelector('.inspector-body').innerHTML;
  assert.equal(afterHtml, beforeHtml,
    'inspector empty state restored verbatim after deactivate');
});
