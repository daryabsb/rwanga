// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Parses sceneLine text content → updates setting/location/time attrs on the node.
// Also exposes a placeholder decoration for empty scene lines.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  const PM = window.RgaProseMirror;
  if (!PM) return;

  // ---------------------------------------------------------------
  // Slug-line parser
  // "INT. POLICE STATION - NIGHT"  →  { setting:'INT', location:'POLICE STATION', time:'NIGHT' }
  // ---------------------------------------------------------------

  const SETTING_RE = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?)\s*\.?\s*/i;

  function parseSlug(text) {
    const t = text.trim();
    if (!t) return null; // nothing typed yet — leave attrs alone

    const sm = t.match(SETTING_RE);
    const setting = sm
      ? sm[1].replace(/\./g, '').replace('/', '/').toUpperCase()
      : 'INT';
    const rest = sm ? t.slice(sm[0].length).trim() : t;

    // Split on " - " or " – " to get location and time
    const dash = rest.search(/\s[-–]\s/);
    if (dash !== -1) {
      return {
        setting: setting,
        location: rest.slice(0, dash).trim().toUpperCase(),
        time: rest.slice(dash).replace(/^\s*[-–]\s*/, '').trim().toUpperCase()
      };
    }

    return {
      setting: setting,
      location: rest.trim().toUpperCase(),
      time: ''
    };
  }

  // ---------------------------------------------------------------
  // Plugin
  // ---------------------------------------------------------------

  function sceneLineParserPlugin() {
    return new PM.Plugin({
      // After each transaction that changes the doc, re-parse any sceneLine
      // whose text content differs from what its attrs record.
      appendTransaction: function(transactions, _oldState, newState) {
        if (!transactions.some(function(tr) { return tr.docChanged; })) return null;

        const tr = newState.tr;
        let changed = false;

        newState.doc.descendants(function(node, pos) {
          if (node.type.name !== 'sceneLine') return true;

          const parsed = parseSlug(node.textContent);
          if (!parsed) return false; // empty — leave attrs alone

          if (parsed.setting  !== node.attrs.setting  ||
              parsed.location !== node.attrs.location  ||
              parsed.time     !== node.attrs.time) {
            tr.setNodeMarkup(pos, null, Object.assign({}, node.attrs, parsed));
            changed = true;
          }
          return false; // don't descend into sceneLine children
        });

        return changed ? tr : null;
      },

      // Placeholder decoration when a sceneLine is empty.
      props: {
        decorations: function(state) {
          const decos = [];
          state.doc.descendants(function(node, pos) {
            if (node.type.name !== 'sceneLine') return true;
            if (node.textContent === '') {
              decos.push(
                PM.Decoration.node(pos, pos + node.nodeSize, {
                  'data-placeholder': 'INT. LOCATION - DAY'
                })
              );
            }
            return false;
          });
          return PM.DecorationSet.create(state.doc, decos);
        }
      }
    });
  }

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.sceneLineParserPlugin = sceneLineParserPlugin;
  Rga.SceneLineParser = { parseSlug };
})();
