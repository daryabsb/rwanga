// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PaginatorRenderer — STUPID consumer of PageMap.
//
// Per the screenplay-layout-engine architecture: this plugin must NEVER
// calculate, measure, infer, or mutate pagination logic. Its only job is:
//   1. On doc change, ask the engine for a fresh PageMap.
//   2. Build one Decoration.widget for each page boundary (every page
//      except page 1 starts with a break before it).
//   3. Apply the decorations.
//
// The widget DOM is the same .rga-page-break element the CSS already
// styles. PM-position lookups come straight from PageMap.pages[i].startPmPos
// — never from getBoundingClientRect, posAtDOM, or any DOM walk.
//
// All complexity lives in the layout/ modules (normalizer + engine).
// This file should stay short and boring.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const DEBOUNCE_MS = 120;

  let _pluginKey = null;
  function _getKey(PM) {
    if (!_pluginKey) _pluginKey = new PM.PluginKey('rga-paginator-renderer');
    return _pluginKey;
  }

  function _buildBreakWidget(label) {
    const el = document.createElement('div');
    el.className = 'rga-page-break';
    if (label) el.dataset.pageLabel = label;
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  function _decorationsForPageMap(pageMap, PM, doc) {
    if (!pageMap || !pageMap.pages || pageMap.pages.length <= 1) {
      return PM.DecorationSet.empty;
    }
    const decos = [];
    // Skip page 1 — no break before the first page.
    for (let i = 1; i < pageMap.pages.length; i += 1) {
      const page = pageMap.pages[i];
      if (page.startPmPos == null) continue;
      const widget = _buildBreakWidget('page ' + page.pageNumber);
      decos.push(PM.Decoration.widget(page.startPmPos, widget, {
        side: -1,
        key: 'pb:' + page.pageNumber + ':' + page.startPmPos
      }));
    }
    return PM.DecorationSet.create(doc, decos);
  }

  function _decorationsEqual(a, b) {
    if (!a || !b) return false;
    const aList = a.find();
    const bList = b.find();
    if (aList.length !== bList.length) return false;
    for (let i = 0; i < aList.length; i += 1) {
      if (aList[i].from !== bList[i].from) return false;
    }
    return true;
  }

  function paginatorRendererPlugin(getPageSetup) {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.Plugin || !PM.Decoration || !PM.DecorationSet) return null;
    const layout = Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.layout;
    if (!layout || !layout.normalize || !layout.computePageMap || !layout.profiles) {
      console.warn('[paginator-renderer] layout layer missing — pagination disabled');
      return null;
    }
    const key = _getKey(PM);

    return new PM.Plugin({
      key: key,
      state: {
        init: function() { return { decorations: PM.DecorationSet.empty }; },
        apply: function(tr, prev) {
          const meta = tr.getMeta(key);
          if (meta && meta.decorations) return { decorations: meta.decorations };
          if (tr.docChanged) {
            return { decorations: prev.decorations.map(tr.mapping, tr.doc) };
          }
          return prev;
        }
      },
      props: {
        decorations: function(state) {
          return key.getState(state).decorations;
        }
      },
      view: function(view) {
        let scheduled = null;

        function recompute() {
          scheduled = null;
          const pageSetup = getPageSetup && getPageSetup();
          if (!pageSetup) return;

          const profile = layout.profiles.fromPageSetup(pageSetup);
          const blocks  = layout.normalize(view.state.doc);
          const pageMap = layout.computePageMap(blocks, profile);
          const next    = _decorationsForPageMap(pageMap, PM, view.state.doc);
          const prev    = key.getState(view.state).decorations;
          if (_decorationsEqual(prev, next)) return;
          const tr = view.state.tr.setMeta(key, { decorations: next });
          view.dispatch(tr);
        }

        function schedule() {
          if (scheduled) clearTimeout(scheduled);
          scheduled = setTimeout(recompute, DEBOUNCE_MS);
        }

        // Initial run after first paint settles.
        setTimeout(recompute, 100);

        return {
          update: function(updatedView, prevState) {
            if (updatedView.state.doc !== prevState.doc) schedule();
          },
          destroy: function() {
            if (scheduled) clearTimeout(scheduled);
          }
        };
      }
    });
  }

  Rga.DocTypes.screenplay.paginatorRendererPlugin = paginatorRendererPlugin;
})();
