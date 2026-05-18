// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase B — Rga.ManuscriptGeometry unit tests.
//
// Tests 1–9 are the required specification tests.
// Tests 10–13 are self-review additions (documented in the Phase B report).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// ----------------------------------------------------------------
// Boot helper — loads layout-profile.js then manuscript-geometry.js
// into a fresh jsdom window, returns { MG, LP, window }.
// ----------------------------------------------------------------
function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};

  const lpPath = '../../../renderer/js/framework/layout-profile.js';
  const mgPath = '../../../renderer/js/framework/manuscript-geometry.js';

  delete require.cache[require.resolve(lpPath)];
  delete require.cache[require.resolve(mgPath)];

  require(lpPath);
  require(mgPath);

  return {
    MG:  global.window.Rga.ManuscriptGeometry,
    LP:  global.window.Rga.LayoutProfile,
    Rga: global.window.Rga,
    win: global.window
  };
}

// ----------------------------------------------------------------
// Helper — build a minimal doc with a given margins object.
// ----------------------------------------------------------------
function makeDoc(margins, screenplayProfile) {
  return {
    metadata: {
      screenplayProfile: screenplayProfile || { language: 'en', screenplayConvention: 'hollywood' }
    },
    settings: {
      pageSetup: { margins: margins ? Object.assign({}, margins) : undefined }
    }
  };
}

// ----------------------------------------------------------------
// Test 1 — resolve(doc) delegates to LayoutProfile.compose with
//           the doc's screenplayProfile + settings.
// ----------------------------------------------------------------
test('[manuscript-geometry] resolve(doc) calls through to LayoutProfile.compose with correct inputs', () => {
  const { MG, LP } = boot();
  const profile = { language: 'en', screenplayConvention: 'hollywood' };
  const settings = {
    pageSetup: {
      size: 'Letter',
      margins: { top: 1.0, bottom: 1.0, left: 1.5, right: 1.0, unit: 'in' }
    }
  };
  const doc = { metadata: { screenplayProfile: profile }, settings };

  const fromResolve  = MG.resolve(doc);
  const fromCompose  = LP.compose(profile, settings);

  assert.deepEqual(
    JSON.parse(JSON.stringify(fromResolve)),
    JSON.parse(JSON.stringify(fromCompose)),
    'resolve(doc) must match compose(screenplayProfile, settings)'
  );
});

// ----------------------------------------------------------------
// Test 2 — resolveFrom(screenplayProfile, settings) delegates correctly.
// ----------------------------------------------------------------
test('[manuscript-geometry] resolveFrom(screenplayProfile, settings) delegates correctly to LayoutProfile.compose', () => {
  const { MG, LP } = boot();
  const profile  = { language: 'en', screenplayConvention: 'hollywood' };
  const settings = {
    pageSetup: {
      margins: { top: 0.75, bottom: 0.75, left: 1.25, right: 0.75, unit: 'in' }
    }
  };

  const fromResolveFrom = MG.resolveFrom(profile, settings);
  const fromCompose     = LP.compose(profile, settings);

  assert.deepEqual(
    JSON.parse(JSON.stringify(fromResolveFrom)),
    JSON.parse(JSON.stringify(fromCompose)),
    'resolveFrom must match compose with same inputs'
  );
});

// ----------------------------------------------------------------
// Test 3 — applyPreset(doc, 'normal') writes correct margins.
// ----------------------------------------------------------------
test('[manuscript-geometry] applyPreset(doc, "normal") writes {top:1.0, right:1.0, bottom:1.0, left:1.5} into doc.settings.pageSetup.margins', () => {
  const { MG } = boot();
  const doc = makeDoc({ top: 0, bottom: 0, left: 0, right: 0, unit: 'in' });

  MG.applyPreset(doc, 'normal');

  const m = doc.settings.pageSetup.margins;
  assert.equal(m.top,    1.0);
  assert.equal(m.bottom, 1.0);
  assert.equal(m.left,   1.5);
  assert.equal(m.right,  1.0);
});

// ----------------------------------------------------------------
// Test 4 — presetOf returns 'normal' for normal margins.
// ----------------------------------------------------------------
test('[manuscript-geometry] presetOf returns "normal" for a doc with normal margins', () => {
  const { MG } = boot();
  const doc = makeDoc({ top: 1.0, bottom: 1.0, left: 1.5, right: 1.0, unit: 'in' });
  assert.equal(MG.presetOf(doc), 'normal');
});

// ----------------------------------------------------------------
// Test 5 — presetOf returns 'compact' for compact margins.
// ----------------------------------------------------------------
test('[manuscript-geometry] presetOf returns "compact" for a doc with compact margins', () => {
  const { MG } = boot();
  const doc = makeDoc({ top: 0.75, bottom: 0.75, left: 1.25, right: 0.75, unit: 'in' });
  assert.equal(MG.presetOf(doc), 'compact');
});

// ----------------------------------------------------------------
// Test 6 — presetOf returns 'veryCompact' for veryCompact margins.
// ----------------------------------------------------------------
test('[manuscript-geometry] presetOf returns "veryCompact" for a doc with veryCompact margins', () => {
  const { MG } = boot();
  const doc = makeDoc({ top: 0.5, bottom: 0.5, left: 1.0, right: 0.5, unit: 'in' });
  assert.equal(MG.presetOf(doc), 'veryCompact');
});

// ----------------------------------------------------------------
// Test 7 — presetOf returns 'expanded' for expanded margins.
// ----------------------------------------------------------------
test('[manuscript-geometry] presetOf returns "expanded" for a doc with expanded margins', () => {
  const { MG } = boot();
  const doc = makeDoc({ top: 1.25, bottom: 1.25, left: 1.75, right: 1.25, unit: 'in' });
  assert.equal(MG.presetOf(doc), 'expanded');
});

// ----------------------------------------------------------------
// Test 8 — presetOf returns 'custom' for non-preset margins.
// ----------------------------------------------------------------
test('[manuscript-geometry] presetOf returns "custom" for a doc with arbitrary non-preset margins (e.g. top:0.9)', () => {
  const { MG } = boot();
  const doc = makeDoc({ top: 0.9, bottom: 0.9, left: 1.4, right: 0.9, unit: 'in' });
  assert.equal(MG.presetOf(doc), 'custom');
});

// ----------------------------------------------------------------
// Test 9 — IDENTITY: resolveFrom(p, s) deepEquals LayoutProfile.compose(p, s)
//           for at least 3 distinct (profile, settings) input combinations.
// ----------------------------------------------------------------
test('[manuscript-geometry] IDENTITY: resolveFrom deepEquals LayoutProfile.compose for multiple input combinations', () => {
  const { MG, LP } = boot();

  const combos = [
    // Combination A: null inputs (default Hollywood)
    [null, null],
    // Combination B: Hollywood profile + compact margins
    [
      { language: 'en', screenplayConvention: 'hollywood' },
      { pageSetup: { margins: { top: 0.75, bottom: 0.75, left: 1.25, right: 0.75, unit: 'in' } } }
    ],
    // Combination C: no profile + A4 paper
    [
      null,
      { pageSetup: { size: 'A4', margins: { top: 1.0, bottom: 1.0, left: 1.5, right: 1.0, unit: 'in' } } }
    ],
    // Combination D: custom font size
    [
      { language: 'en', screenplayConvention: 'hollywood' },
      { font_size: 14 }
    ]
  ];

  combos.forEach(function([profile, settings], i) {
    const fromMG = MG.resolveFrom(profile, settings);
    const fromLP = LP.compose(profile, settings);
    assert.deepEqual(
      JSON.parse(JSON.stringify(fromMG)),
      JSON.parse(JSON.stringify(fromLP)),
      'IDENTITY failed for combination ' + i + ': resolveFrom must equal compose'
    );
  });
});

// ----------------------------------------------------------------
// Test 10 (self-review) — applyPreset is a no-op for invalid preset name.
// ----------------------------------------------------------------
test('[manuscript-geometry] applyPreset is a no-op when presetName is invalid (no throw, no mutation)', () => {
  const { MG } = boot();
  const doc = makeDoc({ top: 0.9, bottom: 0.9, left: 1.4, right: 0.9, unit: 'in' });
  const originalMargins = Object.assign({}, doc.settings.pageSetup.margins);

  // Must not throw; must not mutate.
  MG.applyPreset(doc, 'nonexistent');
  MG.applyPreset(doc, '');
  MG.applyPreset(doc, null);
  MG.applyPreset(doc, undefined);
  MG.applyPreset(doc, 42);

  assert.deepEqual(doc.settings.pageSetup.margins, originalMargins,
    'margins must be unchanged after invalid applyPreset');
});

// ----------------------------------------------------------------
// Test 11 (self-review) — applyPreset is a no-op when doc or
//           doc.settings.pageSetup is missing.
// ----------------------------------------------------------------
test('[manuscript-geometry] applyPreset is a no-op when doc or doc.settings.pageSetup is missing', () => {
  const { MG } = boot();

  // None of these must throw.
  MG.applyPreset(null,      'normal');
  MG.applyPreset(undefined, 'normal');
  MG.applyPreset({},        'normal');
  MG.applyPreset({ settings: {} }, 'normal');
  MG.applyPreset({ settings: { pageSetup: null } }, 'normal');
  // If we get here, no throw — pass.
});

// ----------------------------------------------------------------
// Test 12 (self-review) — applyPreset calls Rga.Doc.markDirty(doc) if available.
// ----------------------------------------------------------------
test('[manuscript-geometry] applyPreset calls Rga.Doc.markDirty(doc) when Rga.Doc.markDirty is available', () => {
  const { MG, Rga } = boot();
  const doc = makeDoc({ top: 0, bottom: 0, left: 0, right: 0, unit: 'in' });

  // Install a spy.
  let spyCalled = false;
  let spyCalledWith = null;
  Rga.Doc = {
    markDirty: function(d) {
      spyCalled = true;
      spyCalledWith = d;
    }
  };

  MG.applyPreset(doc, 'compact');

  assert.equal(spyCalled, true, 'Rga.Doc.markDirty must be called');
  assert.equal(spyCalledWith, doc, 'Rga.Doc.markDirty must be called with the doc');
});

// ----------------------------------------------------------------
// Test 13 (self-review) — presetOf(null) returns 'custom'.
// ----------------------------------------------------------------
test('[manuscript-geometry] presetOf(null) returns "custom"', () => {
  const { MG } = boot();
  assert.equal(MG.presetOf(null),      'custom');
  assert.equal(MG.presetOf(undefined), 'custom');
  // doc with no pageSetup
  assert.equal(MG.presetOf({}),        'custom');
  // doc with pageSetup but no margins
  assert.equal(MG.presetOf({ settings: { pageSetup: {} } }), 'custom');
});
