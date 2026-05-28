// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.3 — Rga.Shell.Inspector unit tests.
//
// Validates the inspector registration + lifecycle contract.
// F1A.3 is frame-only — no panel is registered by any production
// module. The tests below install fake panels to exercise every
// branch of the lifecycle.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// HTML mirrors renderer/index.html's inspector subtree, including the
// static empty-state markup the F1A.3 module captures + restores.
const HTML = '<!DOCTYPE html><html><body>' +
  '<aside id="inspector-panel" aria-label="Inspector">' +
    '<button id="inspector-toggle"></button>' +
    '<div class="inspector-header">Inspector</div>' +
    '<div class="inspector-body" aria-live="polite">' +
      '<div class="inspector-empty">' +
        '<div class="inspector-empty-icon" aria-hidden="true">◌</div>' +
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
  const modPath = require.resolve('../../../renderer/js/shell/inspector.js');
  delete require.cache[modPath];
  require(modPath);
  const Inspector = global.window.Rga.Shell.Inspector;
  Inspector._reset();
  Inspector.setHost(global.document.querySelector('.inspector-body'));
  return { Inspector, dom };
}

function emptyStateHtml(dom) {
  return dom.window.document.querySelector('.inspector-body').innerHTML;
}

function fakePanel(opts) {
  opts = opts || {};
  return {
    id:           opts.id || 'fake',
    label:        opts.label || 'Fake',
    isApplicable: opts.isApplicable,   // optional (undefined → default true)
    mount: function(container, context) {
      this.mountCalls = (this.mountCalls || 0) + 1;
      this.lastContext = context;
      this.lastContainer = container;
      if (opts.mountThrows) throw new Error('mount-boom');
      if (container && opts.mountHtml) container.innerHTML = opts.mountHtml;
    },
    unmount: function(container) {
      this.unmountCalls = (this.unmountCalls || 0) + 1;
      this.lastUnmountContainer = container;
      if (opts.unmountThrows) throw new Error('unmount-boom');
    }
  };
}

// ----------------------------------------------------------------
// §1 — Public API surface
// ----------------------------------------------------------------

test('F1A.3 — Rga.Shell.Inspector exposes the documented public API', () => {
  const { Inspector } = boot();
  ['setHost', 'getHost',
   'registerPanel', 'unregisterPanel', 'registered', 'getController',
   'activate', 'deactivate', 'current', 'isActive', 'isApplicable',
   'onChange', '_reset'].forEach(function(fn) {
    assert.equal(typeof Inspector[fn], 'function', fn + ' must be a function');
  });
});

// ----------------------------------------------------------------
// §2 — Registration semantics
// ----------------------------------------------------------------

test('F1A.3 — registerPanel returns true for a valid controller', () => {
  const { Inspector } = boot();
  assert.equal(Inspector.registerPanel(fakePanel({ id: 'a' })), true);
});

test('F1A.3 — registered() returns insertion order', () => {
  const { Inspector } = boot();
  Inspector.registerPanel(fakePanel({ id: 'a' }));
  Inspector.registerPanel(fakePanel({ id: 'b' }));
  Inspector.registerPanel(fakePanel({ id: 'c' }));
  assert.deepEqual(Inspector.registered(), ['a', 'b', 'c']);
});

test('F1A.3 — duplicate registration is rejected (Sidebar parity)', () => {
  const { Inspector } = boot();
  assert.equal(Inspector.registerPanel(fakePanel({ id: 'dup' })), true);
  assert.equal(Inspector.registerPanel(fakePanel({ id: 'dup' })), false);
  assert.deepEqual(Inspector.registered(), ['dup']);
});

test('F1A.3 — invalid controllers are rejected without throwing', () => {
  const { Inspector } = boot();
  assert.equal(Inspector.registerPanel(null), false);
  assert.equal(Inspector.registerPanel(undefined), false);
  assert.equal(Inspector.registerPanel({}), false);                                 // no id
  assert.equal(Inspector.registerPanel({ id: '' }), false);                         // empty id
  assert.equal(Inspector.registerPanel({ id: 42 }), false);                         // non-string id
  assert.equal(Inspector.registerPanel({ id: 'x' }), false);                        // no mount
  assert.equal(Inspector.registerPanel({ id: 'x', mount: 'not-fn' }), false);       // mount not callable
  assert.deepEqual(Inspector.registered(), []);
});

test('F1A.3 — getController returns the registered controller; null for unknown', () => {
  const { Inspector } = boot();
  const a = fakePanel({ id: 'a' });
  Inspector.registerPanel(a);
  assert.equal(Inspector.getController('a'), a);
  assert.equal(Inspector.getController('unknown'), null);
  assert.equal(Inspector.getController(undefined), null);
  assert.equal(Inspector.getController(null), null);
});

test('F1A.3 — unregisterPanel removes the controller; deactivates first if active', () => {
  const { Inspector, dom } = boot();
  const a = fakePanel({ id: 'a', mountHtml: '<div class="panel-a">A</div>' });
  Inspector.registerPanel(a);
  Inspector.activate('a');
  assert.equal(Inspector.current(), 'a');
  assert.equal(Inspector.unregisterPanel('a'), true);
  assert.equal(Inspector.current(), null);
  assert.equal(a.unmountCalls, 1, 'unmount called as part of unregister');
  // Empty state restored.
  assert.ok(dom.window.document.querySelector('.inspector-body .inspector-empty'));
});

test('F1A.3 — unregisterPanel returns false for unknown / invalid input', () => {
  const { Inspector } = boot();
  assert.equal(Inspector.unregisterPanel('unknown'), false);
  assert.equal(Inspector.unregisterPanel(''), false);
  assert.equal(Inspector.unregisterPanel(42), false);
  assert.equal(Inspector.unregisterPanel(null), false);
});

// ----------------------------------------------------------------
// §3 — setHost + empty-state capture
// ----------------------------------------------------------------

test('F1A.3 — setHost captures the original empty-state markup once', () => {
  const { Inspector, dom } = boot();
  const captured = dom.window.document.querySelector('.inspector-body').innerHTML;
  assert.ok(/inspector-empty/.test(captured), 'captured HTML contains empty state');
  // A second setHost with a fresh element should NOT re-capture from
  // a panel-modified body. We simulate by mutating the body THEN
  // calling setHost again on the same element — capture is one-shot.
  dom.window.document.querySelector('.inspector-body').innerHTML = '<div>panel-content</div>';
  Inspector.setHost(dom.window.document.querySelector('.inspector-body'));
  // Activate + deactivate to round-trip; expect the ORIGINAL empty
  // state, not the panel content we just stuffed in.
  Inspector.registerPanel(fakePanel({ id: 'p', mountHtml: '<div>m</div>' }));
  Inspector.activate('p');
  Inspector.deactivate();
  assert.equal(dom.window.document.querySelector('.inspector-body').innerHTML, captured);
});

test('F1A.3 — setHost(null) clears the host reference without throwing', () => {
  const { Inspector } = boot();
  Inspector.setHost(null);
  assert.equal(Inspector.getHost(), null);
});

// ----------------------------------------------------------------
// §4 — activate / deactivate lifecycle
// ----------------------------------------------------------------

test('F1A.3 — activate calls mount once with the host as container and context as 2nd arg', () => {
  const { Inspector, dom } = boot();
  const p = fakePanel({ id: 'p' });
  Inspector.registerPanel(p);
  Inspector.activate('p', { selection: 'foo' });
  assert.equal(p.mountCalls, 1);
  assert.equal(p.lastContainer, dom.window.document.querySelector('.inspector-body'));
  assert.deepEqual(p.lastContext, { selection: 'foo' });
});

test('F1A.3 — activate returns false for an unknown id (no mount called)', () => {
  const { Inspector } = boot();
  assert.equal(Inspector.activate('unknown'), false);
  assert.equal(Inspector.current(), null);
});

test('F1A.3 — re-activate against the same id re-mounts (re-render) without unmount', () => {
  const { Inspector } = boot();
  const p = fakePanel({ id: 'p' });
  Inspector.registerPanel(p);
  Inspector.activate('p', { v: 1 });
  Inspector.activate('p', { v: 2 });
  assert.equal(p.mountCalls, 2, 'two mount calls — re-activation re-renders');
  assert.equal(p.unmountCalls, undefined, 'unmount not called on re-activate');
  assert.deepEqual(p.lastContext, { v: 2 });
});

test('F1A.3 — switching active id calls unmount on the prior panel', () => {
  const { Inspector } = boot();
  const a = fakePanel({ id: 'a' });
  const b = fakePanel({ id: 'b' });
  Inspector.registerPanel(a);
  Inspector.registerPanel(b);
  Inspector.activate('a');
  Inspector.activate('b');
  assert.equal(a.unmountCalls, 1);
  assert.equal(b.mountCalls, 1);
  assert.equal(Inspector.current(), 'b');
});

test('F1A.3 — deactivate calls unmount and restores the empty state', () => {
  const { Inspector, dom } = boot();
  const captured = emptyStateHtml(dom);
  const p = fakePanel({ id: 'p', mountHtml: '<div class="panel-p">P</div>' });
  Inspector.registerPanel(p);
  Inspector.activate('p');
  assert.ok(dom.window.document.querySelector('.panel-p'), 'panel content rendered');
  Inspector.deactivate();
  assert.equal(p.unmountCalls, 1);
  assert.equal(Inspector.current(), null);
  assert.equal(emptyStateHtml(dom), captured, 'empty state restored verbatim');
});

test('F1A.3 — deactivate when nothing is active is a safe no-op', () => {
  const { Inspector } = boot();
  assert.equal(Inspector.deactivate(), false);
  assert.equal(Inspector.current(), null);
});

test('F1A.3 — current() + isActive() track the active id correctly', () => {
  const { Inspector } = boot();
  Inspector.registerPanel(fakePanel({ id: 'a' }));
  Inspector.registerPanel(fakePanel({ id: 'b' }));
  assert.equal(Inspector.current(), null);
  assert.equal(Inspector.isActive('a'), false);
  Inspector.activate('a');
  assert.equal(Inspector.current(), 'a');
  assert.equal(Inspector.isActive('a'), true);
  assert.equal(Inspector.isActive('b'), false);
});

// ----------------------------------------------------------------
// §5 — Fail-safe behaviour
// ----------------------------------------------------------------

test('F1A.3 — a throwing mount restores the empty state and is logged', () => {
  const { Inspector, dom } = boot();
  const captured = emptyStateHtml(dom);
  const originalError = console.error;
  const logged = [];
  console.error = function() { logged.push(Array.from(arguments)); };
  try {
    const p = fakePanel({ id: 'p', mountThrows: true });
    Inspector.registerPanel(p);
    Inspector.activate('p');
    // The host should NOT be blank — restore engaged.
    assert.equal(emptyStateHtml(dom), captured);
    assert.ok(logged.length >= 1, 'mount throw is logged');
    assert.ok(/mount threw for "p"/.test(logged[0][0]), 'log names the panel id');
  } finally {
    console.error = originalError;
  }
});

test('F1A.3 — a throwing unmount does not block deactivate or activate switching', () => {
  const { Inspector } = boot();
  const a = fakePanel({ id: 'a', unmountThrows: true });
  const b = fakePanel({ id: 'b' });
  Inspector.registerPanel(a);
  Inspector.registerPanel(b);
  Inspector.activate('a');
  // Switching activates 'b' even though a's unmount throws.
  const originalError = console.error;
  console.error = function() {};
  try {
    Inspector.activate('b');
  } finally {
    console.error = originalError;
  }
  assert.equal(Inspector.current(), 'b');
  assert.equal(b.mountCalls, 1);
});

test('F1A.3 — activate without a host is a safe no-op (no throw)', () => {
  const { Inspector } = boot();
  Inspector.setHost(null);                       // explicit
  Inspector.registerPanel(fakePanel({ id: 'p' }));
  // mount never called because there is no host; current() should
  // still flip though, so a later setHost-and-re-activate path works.
  // Sidebar parity: current() does flip. The visible delta is the
  // mount call, not the registry state — which is also why this is
  // a no-op against the DOM.
  Inspector.activate('p');
  // No throw; current set; mount not called (no host).
  assert.equal(Inspector.current(), 'p');
});

// ----------------------------------------------------------------
// §6 — isApplicable defaulting
// ----------------------------------------------------------------

test('F1A.3 — isApplicable defaults to true when the controller omits it', () => {
  const { Inspector } = boot();
  Inspector.registerPanel(fakePanel({ id: 'p' }));   // no isApplicable
  assert.equal(Inspector.isApplicable('p', { anything: true }), true);
});

test('F1A.3 — isApplicable returns the controller\'s decision when provided', () => {
  const { Inspector } = boot();
  Inspector.registerPanel(fakePanel({
    id: 'p',
    isApplicable: function(ctx) { return ctx && ctx.kind === 'scene'; }
  }));
  assert.equal(Inspector.isApplicable('p', { kind: 'scene' }), true);
  assert.equal(Inspector.isApplicable('p', { kind: 'tag' }), false);
  assert.equal(Inspector.isApplicable('p', null), false);
});

test('F1A.3 — isApplicable returns false (and logs) when the controller throws', () => {
  const { Inspector } = boot();
  Inspector.registerPanel(fakePanel({
    id: 'p',
    isApplicable: function() { throw new Error('boom'); }
  }));
  const originalError = console.error;
  console.error = function() {};
  try {
    assert.equal(Inspector.isApplicable('p', {}), false);
  } finally {
    console.error = originalError;
  }
});

test('F1A.3 — isApplicable returns false for unknown id', () => {
  const { Inspector } = boot();
  assert.equal(Inspector.isApplicable('unknown', {}), false);
});

// ----------------------------------------------------------------
// §7 — onChange notifications
// ----------------------------------------------------------------

test('F1A.3 — onChange fires (newId, prevId) on activate / deactivate', () => {
  const { Inspector } = boot();
  const events = [];
  const off = Inspector.onChange(function(newId, prevId) { events.push([newId, prevId]); });
  Inspector.registerPanel(fakePanel({ id: 'a' }));
  Inspector.registerPanel(fakePanel({ id: 'b' }));
  Inspector.activate('a');
  Inspector.activate('b');
  Inspector.deactivate();
  off();
  Inspector.activate('a');   // post-unsubscribe — should not fire
  assert.deepEqual(events, [
    ['a', null],
    ['b', 'a'],
    [null, 'b']
  ]);
});

test('F1A.3 — a throwing listener does not break the dispatch loop', () => {
  const { Inspector } = boot();
  const reached = [];
  const originalError = console.error;
  console.error = function() {};
  try {
    Inspector.onChange(function() { throw new Error('listener-boom'); });
    Inspector.onChange(function(newId) { reached.push(newId); });
    Inspector.registerPanel(fakePanel({ id: 'a' }));
    Inspector.activate('a');
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(reached, ['a']);
});

// ----------------------------------------------------------------
// §8 — F1A.3 dormancy — no production module registers an inspector panel
// ----------------------------------------------------------------

test('F1A.3 — after _reset (fresh boot), registry is empty (frame-only contract)', () => {
  const { Inspector } = boot();
  // boot() calls _reset before setHost, so we're at the canonical
  // "fresh boot" state. F1A.3 ships no production registrations.
  assert.deepEqual(Inspector.registered(), []);
  assert.equal(Inspector.current(), null);
});
