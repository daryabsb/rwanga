// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// ManuscriptGeometry — thin owner over LayoutProfile for resolution + margin presets.
//
// Phase B source-of-truth for "for this doc + this preset, what is the layoutProfile?"
// DOES NOT duplicate geometry arithmetic — all math lives in Rga.LayoutProfile.compose().
// This module composes inputs, delegates, and owns the named margin-preset catalog.
//
// Identity rule (Correction D): ManuscriptGeometry.resolveFrom(p, s) MUST produce
// the same object as Rga.LayoutProfile.compose(p, s). The identity test pins this.
// Do NOT preprocess inputs before passing to compose(). If you feel the need to, STOP.
//
// Public API:
//   Rga.ManuscriptGeometry.resolve(doc)                       → layoutProfile
//   Rga.ManuscriptGeometry.resolveFrom(screenplayProfile, settings) → layoutProfile
//   Rga.ManuscriptGeometry.PRESETS                            → frozen preset catalog
//   Rga.ManuscriptGeometry.applyPreset(doc, presetName)       → void
//   Rga.ManuscriptGeometry.presetOf(doc)                      → preset name | 'custom'
//
// PRESETS catalog (values in inches, canonical unit):
//   normal:      { top: 1.0,  bottom: 1.0,  left: 1.5,  right: 1.0  }  — Hollywood standard
//   compact:     { top: 0.75, bottom: 0.75, left: 1.25, right: 0.75 }
//   veryCompact: { top: 0.5,  bottom: 0.5,  left: 1.0,  right: 0.5  }
//   expanded:    { top: 1.25, bottom: 1.25, left: 1.75, right: 1.25 }
//
// applyPreset writes margins into doc.settings.pageSetup.margins and calls
//   Rga.Doc.markDirty(doc) if available. Invalid presetName or missing doc
//   is silently ignored (no throw).
//
// presetOf returns the matching preset name on exact match (tolerance 1e-9),
//   'custom' otherwise (including null/undefined doc).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.ManuscriptGeometry = Rga.ManuscriptGeometry || {};

  // ----------------------------------------------------------------
  // PRESETS — frozen, named margin catalog (inches).
  // ----------------------------------------------------------------
  const PRESETS = Object.freeze({
    normal:      Object.freeze({ top: 1.0,  bottom: 1.0,  left: 1.5,  right: 1.0  }),
    compact:     Object.freeze({ top: 0.75, bottom: 0.75, left: 1.25, right: 0.75 }),
    veryCompact: Object.freeze({ top: 0.5,  bottom: 0.5,  left: 1.0,  right: 0.5  }),
    expanded:    Object.freeze({ top: 1.25, bottom: 1.25, left: 1.75, right: 1.25 })
  });

  const PRESET_KEYS = Object.keys(PRESETS);

  // ----------------------------------------------------------------
  // resolve(doc) — extract screenplayProfile + settings from doc,
  //   then delegate to LayoutProfile.compose().
  // ----------------------------------------------------------------
  function resolve(doc) {
    const screenplayProfile = doc && doc.metadata && doc.metadata.screenplayProfile
      ? doc.metadata.screenplayProfile
      : null;
    const settings = doc && doc.settings ? doc.settings : null;
    return Rga.LayoutProfile.compose(screenplayProfile, settings);
  }

  // ----------------------------------------------------------------
  // resolveFrom(screenplayProfile, settings) — thin pass-through.
  // IDENTITY RULE: output must equal LayoutProfile.compose(same inputs).
  // ----------------------------------------------------------------
  function resolveFrom(screenplayProfile, settings) {
    return Rga.LayoutProfile.compose(screenplayProfile, settings);
  }

  // ----------------------------------------------------------------
  // applyPreset(doc, presetName) — write preset margins into doc.
  // ----------------------------------------------------------------
  function applyPreset(doc, presetName) {
    // Validate preset name — silently ignore unknown presets.
    if (!presetName || PRESET_KEYS.indexOf(presetName) === -1) return;
    // Validate doc structure.
    if (!doc || !doc.settings || !doc.settings.pageSetup) return;

    const preset = PRESETS[presetName];
    const margins = doc.settings.pageSetup.margins;

    if (!margins || typeof margins !== 'object') {
      // Create margins object if missing.
      doc.settings.pageSetup.margins = {
        top:    preset.top,
        bottom: preset.bottom,
        left:   preset.left,
        right:  preset.right,
        unit:   'in'
      };
    } else {
      // Write preset values; preserve existing unit field if present.
      margins.top    = preset.top;
      margins.bottom = preset.bottom;
      margins.left   = preset.left;
      margins.right  = preset.right;
      if (!margins.unit) margins.unit = 'in';
    }

    // Notify doc system if available.
    if (Rga.Doc && typeof Rga.Doc.markDirty === 'function') {
      Rga.Doc.markDirty(doc);
    }
  }

  // ----------------------------------------------------------------
  // presetOf(doc) — detect which preset the doc's margins match.
  // ----------------------------------------------------------------
  function presetOf(doc) {
    if (!doc) return 'custom';
    const m = doc.settings && doc.settings.pageSetup && doc.settings.pageSetup.margins;
    if (!m) return 'custom';
    if (typeof m.top !== 'number' || typeof m.bottom !== 'number' ||
        typeof m.left !== 'number' || typeof m.right !== 'number') {
      return 'custom';
    }

    for (let i = 0; i < PRESET_KEYS.length; i++) {
      const name = PRESET_KEYS[i];
      const p = PRESETS[name];
      if (Math.abs(m.top    - p.top)    < 1e-9 &&
          Math.abs(m.bottom - p.bottom) < 1e-9 &&
          Math.abs(m.left   - p.left)   < 1e-9 &&
          Math.abs(m.right  - p.right)  < 1e-9) {
        return name;
      }
    }

    return 'custom';
  }

  // ----------------------------------------------------------------
  // Expose API
  // ----------------------------------------------------------------
  Rga.ManuscriptGeometry.resolve      = resolve;
  Rga.ManuscriptGeometry.resolveFrom  = resolveFrom;
  Rga.ManuscriptGeometry.PRESETS      = PRESETS;
  Rga.ManuscriptGeometry.applyPreset  = applyPreset;
  Rga.ManuscriptGeometry.presetOf     = presetOf;
})();
