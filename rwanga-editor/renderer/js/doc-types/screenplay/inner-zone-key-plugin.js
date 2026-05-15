// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Zone-key plugin for inner EditorViews — handles Tab/Shift-Tab/Arrow edges
// between the location zone (PM-managed) and the setting/time zones
// (NodeView-managed).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const PM = window.RgaProseMirror;
  if (!PM || !PM.Plugin) {
    console.error('[inner-zone-key-plugin] RgaProseMirror.Plugin not available');
    return;
  }

  function _findNodeView(viewDom, attrValue) {
    if (!viewDom || !viewDom.querySelector) return null;
    const sel = '.rga-scene-line[data-active-zone="' + attrValue + '"]';
    const el = viewDom.querySelector(sel);
    return el && el._rgaNodeView ? el._rgaNodeView : null;
  }

  function buildZoneKeyPlugin() {
    return new PM.Plugin({
      props: {
        handleKeyDown: function(view, event) {
          // Case A: a non-location zone is active
          const nvNonLoc = _findNodeView(view.dom, 'setting') || _findNodeView(view.dom, 'time');
          if (nvNonLoc) {
            if (event.key === 'Escape') {
              nvNonLoc.activateZone('location');
              event.preventDefault();
              return true;
            }

            if (event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              nvNonLoc.activateZone('location');
              event.preventDefault();
              return true;
            }

            // Block letter typing while a picker zone is active
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              event.preventDefault();
              return true;
            }
            return false;
          }

          // Case B: cursor is in location (or anywhere else in inner doc)
          if (event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            const sel = view.state.selection;
            const $head = sel.$head;
            if ($head.parent.type.name !== 'sceneLine') return false;

            const nvLoc = _findNodeView(view.dom, 'location');
            if (!nvLoc) return false;

            const atStart = $head.parentOffset === 0;
            const atEnd   = $head.parentOffset === $head.parent.content.size;

            if ((event.key === 'Tab' && !event.shiftKey) || event.key === 'ArrowRight') {
              if (atEnd) {
                nvLoc.activateZone('time');
                if (typeof nvLoc._showPicker === 'function') nvLoc._showPicker('time');
                event.preventDefault();
                return true;
              }
            }
            if ((event.key === 'Tab' && event.shiftKey) || event.key === 'ArrowLeft') {
              if (atStart) {
                nvLoc.activateZone('setting');
                if (typeof nvLoc._showPicker === 'function') nvLoc._showPicker('setting');
                event.preventDefault();
                return true;
              }
            }
            // Swallow Tab anywhere in sceneLine to prevent browser focus navigation
            if (event.key === 'Tab') {
              event.preventDefault();
              return true;
            }
          }

          return false;
        }
      }
    });
  }

  Rga.DocTypes.screenplay.buildZoneKeyPlugin = buildZoneKeyPlugin;
})();
