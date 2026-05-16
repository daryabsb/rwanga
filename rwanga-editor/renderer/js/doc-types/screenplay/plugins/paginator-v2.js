// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// V2 Paginator — measurement-based, flow-aware page-break engine.
//
// Replaces the v1 estimate-based absolute-overlay engine in page-breaks.js,
// which painted 16px strips at fixed pixel positions and visually masked
// any content that happened to fall under them.
//
// Algorithm:
//   1. Post-render (debounced 120ms), walk every top-level block under the
//      outer ProseMirror surface (titleStrip + each child of body).
//   2. Measure each block's actual rendered height via getBoundingClientRect.
//   3. Accumulate height per page; when the next block would push the
//      cumulative past the usable page area (paperHeight - top margin -
//      bottom margin), insert a page-break BEFORE that block.
//   4. Emit the breaks as Decoration.widget entries in the editor's
//      DecorationSet. The widget DOM is a real flow-block element, so
//      content below is genuinely pushed down — no overlay strips, no
//      masking.
//   5. Recompute only when the doc changes (decoration-only state updates
//      are guarded against to prevent infinite loops).
//
// Block-aware: a sceneFrame, paragraph, heading, etc. is never split across
// two pages — it either fits on the current page or pushes to the next.
// Splitting long sceneFrames with (CONTINUED) markers is deferred.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const DEBOUNCE_MS = 120;
  const PX_PER_INCH = 96;
  const SPACER_PX = 16;

  let _pluginKey = null;
  function _getKey(PM) {
    if (!_pluginKey) _pluginKey = new PM.PluginKey('rga-paginator-v2');
    return _pluginKey;
  }

  function _paperSizes() {
    return (Rga.Constants && Rga.Constants.PAPER_SIZES) || {
      Letter: { width: 8.5, height: 11 },
      A4:     { width: 8.27, height: 11.69 }
    };
  }

  function _usablePageHeightPx(pageSetup) {
    const sizes = _paperSizes();
    const paper = sizes[pageSetup.paperSize] || sizes.Letter;
    const top = (pageSetup.margins && pageSetup.margins.top) || 1;
    const bot = (pageSetup.margins && pageSetup.margins.bottom) || 1;
    return (paper.height - top - bot) * PX_PER_INCH;
  }

  // Collect every top-level block element that contributes to content flow.
  // The outer doc's structure is: titleStrip? + body (which contains the
  // actual blocks). We want the leaf-level blocks: titleStrip + each child
  // of .rga-body. SceneFrame atoms render as .rga-scene-frame-placeholder;
  // treatment paragraphs/headings render as <p>/<h2>/etc.
  function _collectBlocks(editorDom) {
    const blocks = [];
    if (!editorDom) return blocks;
    const titleStrip = editorDom.querySelector(':scope > .rga-title-strip');
    if (titleStrip) blocks.push(titleStrip);
    const body = editorDom.querySelector(':scope > .rga-body');
    const bodyRoot = body || editorDom;
    Array.prototype.slice.call(bodyRoot.children).forEach(function(child) {
      // Skip our own existing widget DOM if any
      if (child.classList && child.classList.contains('rga-page-break')) return;
      blocks.push(child);
    });
    return blocks;
  }

  // Walk blocks, find positions where a break must be inserted before the
  // next block so it doesn't overflow the current page. Returns an array
  // of {pos, label} for each break. pos is the PM position of the block
  // that starts the new page (so the widget decoration is placed there).
  function _computeBreakPositions(view, pageSetup) {
    const editorDom = view.dom;
    if (!editorDom) return [];
    const blocks = _collectBlocks(editorDom);
    if (!blocks.length) return [];
    const usable = _usablePageHeightPx(pageSetup);
    if (usable <= 0) return [];

    const result = [];
    let currentPageContentPx = 0;
    let pageNumber = 1;

    blocks.forEach(function(el) {
      const rect = el.getBoundingClientRect();
      const elHeight = rect.height || 0;
      // Block-aware rule: if adding this block would overflow AND the page
      // already has content, push it to the next page.
      if (currentPageContentPx > 0 && currentPageContentPx + elHeight > usable) {
        let pos = null;
        try { pos = view.posAtDOM(el, 0); } catch (_) { pos = null; }
        if (typeof pos === 'number' && pos >= 0) {
          pageNumber += 1;
          result.push({ pos: pos, label: 'page ' + pageNumber });
          currentPageContentPx = elHeight;
        } else {
          currentPageContentPx += elHeight;
        }
      } else {
        currentPageContentPx += elHeight;
      }
    });

    return result;
  }

  function _buildBreakWidget(label) {
    const el = document.createElement('div');
    el.className = 'rga-page-break';
    el.dataset.pageLabel = label;
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  function _decorationsEqual(a, b) {
    // Cheap equality: same number of decorations at same positions.
    if (!a || !b) return false;
    const aList = a.find();
    const bList = b.find();
    if (aList.length !== bList.length) return false;
    for (let i = 0; i < aList.length; i += 1) {
      if (aList[i].from !== bList[i].from) return false;
    }
    return true;
  }

  function paginatorV2Plugin(getPageSetup) {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.Plugin || !PM.Decoration || !PM.DecorationSet) return null;
    const key = _getKey(PM);

    return new PM.Plugin({
      key: key,
      state: {
        init: function() { return { decorations: PM.DecorationSet.empty }; },
        apply: function(tr, prev) {
          const meta = tr.getMeta(key);
          if (meta && meta.decorations) return { decorations: meta.decorations };
          // Map existing decorations through any doc changes so positions
          // stay aligned until the next recompute.
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
          const breaks = _computeBreakPositions(view, pageSetup);
          const decos = breaks.map(function(b) {
            return PM.Decoration.widget(b.pos, _buildBreakWidget(b.label), {
              side: -1,
              key: 'pb:' + b.pos + ':' + b.label
            });
          });
          const next = PM.DecorationSet.create(view.state.doc, decos);
          const prev = key.getState(view.state).decorations;
          if (_decorationsEqual(prev, next)) return;
          const tr = view.state.tr.setMeta(key, { decorations: next });
          view.dispatch(tr);
        }

        function schedule() {
          if (scheduled) clearTimeout(scheduled);
          scheduled = setTimeout(recompute, DEBOUNCE_MS);
        }

        // Initial pagination after the editor finishes its first paint.
        // Triple-paint covers slow load paths where NodeViews / inner editors
        // mount in stages.
        setTimeout(recompute, 100);
        setTimeout(recompute, 500);
        setTimeout(recompute, 1500);

        const onResize = function() { schedule(); };
        window.addEventListener('resize', onResize);

        return {
          update: function(updatedView, prevState) {
            // Doc-change recompute. Decoration-only state changes (our own
            // dispatch echo) do not trigger — that's how the loop stays
            // bounded.
            if (updatedView.state.doc !== prevState.doc) schedule();
          },
          destroy: function() {
            if (scheduled) clearTimeout(scheduled);
            window.removeEventListener('resize', onResize);
          }
        };
      }
    });
  }

  Rga.DocTypes.screenplay.paginatorV2Plugin = paginatorV2Plugin;
})();
