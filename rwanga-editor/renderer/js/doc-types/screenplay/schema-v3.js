// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// v3 screenplay schema — single canonical ProseMirror document with real
// screenplay nodes (scene + sceneHeading + sceneBody+). Replaces the v2
// sceneFrame-atom + attrs.innerDoc model.
//
// Phase 1 deliverable: schema exists as a callable factory. No registration
// into mount yet (Phase 3); no migration yet (Phase 2); no UI yet.
//
// Contract reference: docs/phase0-final-schema-contract.md.
//
// Notes for future-self:
//   - Marks come from Rga.Framework.baseOuterMarks (the existing 12-mark
//     spec). Same parseDOM / toDOM / exclusion rules apply uniformly across
//     v2 and v3 — marks survive byte-for-byte through migration.
//   - scene.attrs.metadata defaults to null at the schema level (object
//     defaults are shared across PM nodes; safer to leave null and let
//     scene-creation helpers populate { linkedScenes:[], references:[],
//     production:{} } explicitly). Tests that need the structure pass it in.
//   - scene.attrs.number is intentionally absent — scene display numbers
//     are derived via NavigationIndex.visibleSceneIndex (correction A in
//     the signed contract).
//   - sceneHeading and transition both carry inline content (corrections 1
//     and 2): location text + custom transition text live in PM content,
//     not in attrs. Their pickers (Phase 3) mutate attrs while PM owns the
//     editable text.
//   - parenthetical text includes its own parens — "(barely a whisper)"
//     not "barely a whisper" (correction 3). The schema doesn't enforce
//     this; migration + UX helpers do.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  let _cachedSchema = null;

  function _buildSchema() {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.Schema) {
      console.error('[schema-v3] window.RgaProseMirror.Schema unavailable — cannot build schema');
      return null;
    }
    const marks = (Rga.Framework && Rga.Framework.baseOuterMarks) || {};

    const nodes = {
      // ----- root + outer structure -----
      doc: {
        content: 'titleStrip? body'
      },

      titleStrip: {
        content: 'inline*',
        attrs: { removable: { default: true } },
        parseDOM: [{ tag: 'div.rga-title-strip' }],
        toDOM: function(node) {
          return ['div', {
            class: 'rga-title-strip',
            'data-removable': String(node.attrs.removable)
          }, 0];
        }
      },

      body: {
        // v3: heading + paragraph (treatment) + scene siblings, no spacer
        // paragraphs between scenes (CSS handles inter-scene margin).
        content: 'outerBlock+',
        parseDOM: [{ tag: 'div.rga-body' }],
        toDOM: function() { return ['div', { class: 'rga-body' }, 0]; }
      },

      // ----- outer block group (treatment + scenes) -----
      heading: {
        content: 'inline*',
        group: 'outerBlock',
        attrs: { level: { default: 1 } },
        parseDOM: [
          { tag: 'h1', attrs: { level: 1 } },
          { tag: 'h2', attrs: { level: 2 } },
          { tag: 'h3', attrs: { level: 3 } }
        ],
        toDOM: function(node) { return ['h' + node.attrs.level, 0]; }
      },

      paragraph: {
        content: 'inline*',
        group: 'outerBlock',
        parseDOM: [{ tag: 'p' }],
        toDOM: function() { return ['p', 0]; }
      },

      scene: {
        content: 'sceneHeading sceneBody+',
        group: 'outerBlock',
        defining: true,
        selectable: true,
        attrs: {
          id:           { default: null },
          notes:        { default: '' },
          revisionFlag: { default: null },
          // Object-shape default left null at schema level on purpose; PM
          // shares attr default references across instances. Helpers in
          // later phases populate { linkedScenes:[], references:[],
          // production:{} } when creating new scene nodes.
          metadata:     { default: null }
        },
        parseDOM: [{
          tag: 'div.rga-scene',
          getAttrs: function(dom) {
            return {
              id:           dom.getAttribute('data-scene-id') || null,
              notes:        dom.getAttribute('data-scene-notes') || '',
              revisionFlag: null,
              metadata:     null
            };
          }
        }],
        toDOM: function(node) {
          return ['div', {
            class: 'rga-scene',
            'data-scene-id': node.attrs.id || ''
          }, 0];
        }
      },

      // ----- scene-internal nodes -----
      sceneHeading: {
        // Per correction 1: content-bearing, NOT a leaf. Location text lives
        // here as inline content (with marks support).
        content: 'inline*',
        attrs: {
          setting:      { default: 'INT.' },
          time:         { default: 'DAY' },
          headingStyle: { default: null }
        },
        isolating: true,
        selectable: false,
        parseDOM: [{
          tag: 'div.rga-scene-heading',
          getAttrs: function(dom) {
            return {
              setting:      dom.getAttribute('data-setting') || 'INT.',
              time:         dom.getAttribute('data-time')    || 'DAY',
              headingStyle: dom.getAttribute('data-heading-style') || null
            };
          }
        }],
        toDOM: function(node) {
          return ['div', {
            class: 'rga-scene-heading',
            'data-setting': node.attrs.setting,
            'data-time':    node.attrs.time,
            'data-heading-style': node.attrs.headingStyle || ''
          }, 0];
        }
      },

      action: {
        content: 'inline*',
        group: 'sceneBody',
        parseDOM: [{ tag: 'div.rga-block-action' }],
        toDOM: function() { return ['div', { class: 'rga-block-action' }, 0]; }
      },

      character: {
        content: 'inline*',
        group: 'sceneBody',
        parseDOM: [{ tag: 'div.rga-block-character' }],
        toDOM: function() { return ['div', { class: 'rga-block-character' }, 0]; }
      },

      dialogue: {
        content: 'inline*',
        group: 'sceneBody',
        parseDOM: [{ tag: 'div.rga-block-dialogue' }],
        toDOM: function() { return ['div', { class: 'rga-block-dialogue' }, 0]; }
      },

      parenthetical: {
        // Per correction 3: text includes its own parens. The schema does
        // not enforce parens — migration wraps, UX helper auto-inserts on
        // new-block creation. Data stores true text.
        content: 'inline*',
        group: 'sceneBody',
        parseDOM: [{ tag: 'div.rga-block-parenthetical' }],
        toDOM: function() { return ['div', { class: 'rga-block-parenthetical' }, 0]; }
      },

      shot: {
        content: 'inline*',
        group: 'sceneBody',
        parseDOM: [{ tag: 'div.rga-block-shot' }],
        toDOM: function() { return ['div', { class: 'rga-block-shot' }, 0]; }
      },

      transition: {
        // Per correction 2: NOT atom. Carries inline content. presetType
        // tags known presets ("CUT", "FADE OUT", etc.); null for custom
        // free-form transitions like "MATCH CUT TO: BLACK".
        content: 'inline*',
        group: 'sceneBody',
        selectable: true,
        attrs: { presetType: { default: null } },
        parseDOM: [{
          tag: 'div.rga-block-transition',
          getAttrs: function(dom) {
            return { presetType: dom.getAttribute('data-preset-type') || null };
          }
        }],
        toDOM: function(node) {
          return ['div', {
            class: 'rga-block-transition',
            'data-preset-type': node.attrs.presetType || ''
          }, 0];
        }
      },

      // ----- inline -----
      text: { group: 'inline' }
    };

    return new PM.Schema({ nodes: nodes, marks: marks });
  }

  function buildSchemaV3() {
    if (_cachedSchema) return _cachedSchema;
    _cachedSchema = _buildSchema();
    return _cachedSchema;
  }

  // Exposed for: future mount-routing in Phase 3, migration in Phase 2,
  // unit tests in Phase 1.
  Rga.DocTypes.screenplay.buildSchemaV3 = buildSchemaV3;
  // Test-only reset hook (clears cache so tests can rebuild after mock changes).
  Rga.DocTypes.screenplay._resetSchemaV3Cache = function() { _cachedSchema = null; };
})();
