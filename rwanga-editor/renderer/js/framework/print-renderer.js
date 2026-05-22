// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PrintRenderer — RenderModel → N fixed page-sheet DOM nodes.
//
// Phase 7 final stage in the rendering pipeline. Consumes the shared
// RenderModel and paints read-only paper sheets into a supplied container.
//
// Hard rules (from Phase 7 directive):
//   * Never read the editor DOM.
//   * Never clone the editor DOM.
//   * Never call getBoundingClientRect.
//   * Never produce one tall fake page — exactly one .rga-page-sheet
//     element per RenderModel page.
//   * Sheet dimensions are CSS-fixed; content overflow is on the next
//     sheet, not on this one's height.
//
// Output DOM (per sheet):
//   <div class="rga-page-sheet"
//        data-page-number="N" role="document" aria-label="Page N">
//     <div class="rga-page-sheet-header">N.</div>
//     <div class="rga-page-sheet-content">
//       <div class="rga-print-block rga-print-block-<type>" data-block-type="<type>">
//         …block content / inline runs…
//       </div>
//       … repeat per block on this page …
//     </div>
//   </div>
//
// The renderer composes the sceneHeading display string here (RenderModel
// gives `{setting, location, time}` separately; PrintRenderer chooses how
// to format it). Per the Phase 6 correction: composition is presentation,
// belongs in the renderer.
//
// Public API:
//   Rga.PrintRenderer.render(renderModel, container, opts?) → void
//   Rga.PrintRenderer.sheetCount(container) → number  (count of mounted sheets)
//
// opts shape (all optional, defaults to 'none'):
//   { footerStyle: 'none' | 'bottom-center',
//     headerStyle: 'none' | 'running',
//     title:       string }
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.PrintRenderer = Rga.PrintRenderer || {};

  function render(renderModel, container, opts) {
    if (!container) return;
    opts = opts || {};
    // Idempotent clear — host may re-render on doc change.
    container.innerHTML = '';
    container.classList.add('rga-print-preview-root');
    const lp = (renderModel && renderModel.layoutProfile) ? renderModel.layoutProfile : null;
    const title = (renderModel && renderModel.title) ? renderModel.title : (opts.title || '');
    if (!renderModel || !Array.isArray(renderModel.pages) || renderModel.pages.length === 0) {
      // Empty doc → render a single blank sheet so the writer sees the page.
      container.appendChild(_buildPageSheet({ pageNumber: 1, blocks: [] }, 1, lp, opts, title));
      return;
    }
    for (let p = 0; p < renderModel.pages.length; p += 1) {
      container.appendChild(_buildPageSheet(renderModel.pages[p], renderModel.totalPages, lp, opts, title));
    }
  }

  function sheetCount(container) {
    if (!container) return 0;
    return container.querySelectorAll('.rga-page-sheet').length;
  }

  // ----------------------------------------------------------------
  // Sheet builders
  // ----------------------------------------------------------------

  function _buildPageSheet(page, totalPages, layoutProfile, opts, title) {
    opts = opts || {};
    const sheet = document.createElement('div');
    sheet.className = 'rga-page-sheet';
    sheet.setAttribute('data-page-number', String(page.pageNumber));
    sheet.setAttribute('role', 'document');
    sheet.setAttribute('aria-label', 'Page ' + page.pageNumber + ' of ' + totalPages);

    // RTL — carry the document direction onto the sheet so the RTL font
    // chain (.rga-page-sheet[dir="rtl"]) reaches Print Preview and the text
    // flows right-to-left, consistent with the Flow editor.
    if (layoutProfile && layoutProfile.direction === 'rtl') {
      sheet.setAttribute('dir', 'rtl');
    }

    // D.2 — sheet dimensions from layoutProfile.pageSize (inline style
    // overrides CSS fallbacks for non-Letter paper sizes, e.g. A4 / Legal).
    // Both width and height are written inline so a single owner (layoutProfile)
    // controls the sheet geometry. CSS fallbacks (8.5in / 11in) remain valid
    // for the empty-doc / preload render path before JS has run.
    if (layoutProfile && layoutProfile.pageSize) {
      sheet.style.width  = layoutProfile.pageSize.w + 'in';
      sheet.style.height = layoutProfile.pageSize.h + 'in';
    }

    // D.2 — sheet padding from layoutProfile.margins. Overrides the CSS
    // fallback (padding: 1in 1in 1in 1.5in) which is kept in the CSS file
    // as a safe fallback for the empty/initial render before JS runs.
    // RTL mirror: for Arabic/Kurdish the binding side is the right margin,
    // so left/right padding values are swapped when direction === 'rtl'.
    if (layoutProfile && layoutProfile.margins) {
      const m = layoutProfile.margins;
      const isRtl = (layoutProfile.direction === 'rtl');
      const paddingLeft  = isRtl ? m.right : m.left;
      const paddingRight = isRtl ? m.left  : m.right;
      sheet.style.padding = m.top + 'in ' + paddingRight + 'in ' + m.bottom + 'in ' + paddingLeft + 'in';
    }

    // Page header — top-right, traditional screenplay convention "N."
    // Position is written inline from layoutProfile.margins so any paper
    // size / margin setting produces a correctly placed page number.
    //   top:   margins.top * 0.5  — page number sits at half the top margin
    //          from the sheet top edge (Hollywood: 1in → 0.5in; compact
    //          0.5in top → 0.25in — always inside the top-margin band).
    //   right: margins.right      — aligned with the right content edge
    //          (RTL mirror: use margins.left so the number sits on the
    //          binding side correctly for Arabic / Kurdish).
    // CSS fallback values (top: 0.5in; right: 1in) remain for the
    // empty-doc / preload render path before layoutProfile is available.
    const header = document.createElement('div');
    header.className = 'rga-page-sheet-header';
    header.textContent = page.pageNumber + '.';
    if (layoutProfile && layoutProfile.margins) {
      const m = layoutProfile.margins;
      const isRtl = (layoutProfile.direction === 'rtl');
      header.style.top   = (m.top * 0.5) + 'in';
      header.style.right = (isRtl ? m.left : m.right) + 'in';
    }
    sheet.appendChild(header);

    // D.4 — optional running header (opt-in only; default off).
    // When opts.headerStyle === 'running', renders the script title
    // top-left in muted type. Source: renderModel.title (from
    // doc.metadata.title). Empty title → empty element (no error).
    // top + left positions written inline from margins (same ownership
    // collapse as the page-number header). CSS fallback values remain for
    // empty-doc / preload path.
    if (opts.headerStyle === 'running') {
      const runningHeader = document.createElement('div');
      runningHeader.className = 'rga-page-sheet-running-header';
      runningHeader.textContent = title || '';
      if (layoutProfile && layoutProfile.margins) {
        const m = layoutProfile.margins;
        const isRtl = (layoutProfile.direction === 'rtl');
        runningHeader.style.top  = (m.top * 0.5) + 'in';
        runningHeader.style.left = (isRtl ? m.right : m.left) + 'in';
      }
      sheet.appendChild(runningHeader);
    }

    const content = document.createElement('div');
    content.className = 'rga-page-sheet-content';
    if (Array.isArray(page.blocks)) {
      for (let i = 0; i < page.blocks.length; i += 1) {
        content.appendChild(_buildBlockEl(page.blocks[i], i === 0));
      }
    }
    sheet.appendChild(content);

    // D.3 — optional bottom-center page number (opt-in only; default off).
    // When opts.footerStyle === 'bottom-center', renders page number
    // centered at the sheet bottom. The default top-right "N." header
    // is always rendered (unchanged); this is an additional mode only.
    // bottom position written inline from margins (same ownership collapse as
    // the page-number header). CSS fallback (bottom: 0.5in) remains for
    // empty-doc / preload path.
    if (opts.footerStyle === 'bottom-center') {
      const footer = document.createElement('div');
      footer.className = 'rga-page-sheet-footer';
      footer.textContent = String(page.pageNumber);
      if (layoutProfile && layoutProfile.margins) {
        footer.style.bottom = (layoutProfile.margins.bottom * 0.5) + 'in';
      }
      sheet.appendChild(footer);
    }

    return sheet;
  }

  function _buildBlockEl(block, isFirstOnPage) {
    const el = document.createElement('div');
    el.className = 'rga-print-block rga-print-block-' + block.type;
    if (isFirstOnPage) el.classList.add('rga-print-block-first');
    el.setAttribute('data-block-type', block.type);
    if (block.sceneNodeId)  el.setAttribute('data-scene-id', block.sceneNodeId);
    if (block.sceneNumber)  el.setAttribute('data-scene-number', String(block.sceneNumber));
    // Fork A — click-to-edit anchor: carry the block's PM document range so
    // the read-only Paper view can return the caret to Flow. Tested with
    // `typeof === 'number'` because pmFrom 0 is a valid document position.
    if (typeof block.pmFrom === 'number') el.setAttribute('data-pm-from', String(block.pmFrom));
    if (typeof block.pmTo   === 'number') el.setAttribute('data-pm-to',   String(block.pmTo));

    if (block.type === 'sceneHeading') {
      _appendHeadingDisplay(el, block.heading);
    } else {
      const runs = (block.inlineRuns && block.inlineRuns.length > 0)
        ? block.inlineRuns
        : [{ text: block.text || '', marks: [] }];
      for (let r = 0; r < runs.length; r += 1) {
        el.appendChild(_renderRun(runs[r]));
      }
    }
    return el;
  }

  // The renderer is where the structured heading becomes a display string.
  // Future conventions (Arabic / Kurdish) can override here without
  // touching the normalizer or engine.
  function _appendHeadingDisplay(el, heading) {
    if (!heading) return;
    const parts = [];
    if (heading.setting)  parts.push(heading.setting);
    if (heading.location) parts.push(heading.location);
    let display = parts.join(' ');
    if (heading.time) display += (display ? ' — ' : '') + heading.time;
    el.textContent = display;
  }

  // ----------------------------------------------------------------
  // Inline run rendering (mark wrappers)
  // ----------------------------------------------------------------
  //   strong/bold/em/italic/underline/strikethrough/link/color/highlight:
  //     decorated for visual fidelity
  //   annotation/tag/revisionFlag: working-state marks; print-preview
  //     intentionally ignores them so the preview reads like a clean
  //     production script. A future toggle could surface them.
  function _renderRun(run) {
    let node = document.createTextNode(run.text || '');
    if (!run.marks || run.marks.length === 0) return node;
    for (let i = run.marks.length - 1; i >= 0; i -= 1) {
      const wrap = _markWrapper(run.marks[i]);
      if (wrap) {
        wrap.appendChild(node);
        node = wrap;
      }
    }
    return node;
  }

  function _markWrapper(mark) {
    if (!mark || !mark.type) return null;
    switch (mark.type) {
      case 'strong':
      case 'bold':
        return document.createElement('strong');
      case 'em':
      case 'italic':
        return document.createElement('em');
      case 'underline': {
        const u = document.createElement('span');
        u.style.textDecoration = 'underline';
        return u;
      }
      case 'strikethrough':
      case 'strike': {
        const s = document.createElement('span');
        s.style.textDecoration = 'line-through';
        return s;
      }
      case 'link': {
        const a = document.createElement('a');
        if (mark.attrs && mark.attrs.href) a.setAttribute('href', mark.attrs.href);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        return a;
      }
      case 'color':
      case 'textColor': {
        const sp = document.createElement('span');
        if (mark.attrs && mark.attrs.color) sp.style.color = mark.attrs.color;
        return sp;
      }
      case 'highlight':
      case 'backgroundColor': {
        const sp = document.createElement('span');
        if (mark.attrs && mark.attrs.color) sp.style.backgroundColor = mark.attrs.color;
        return sp;
      }
      // Working-state marks — no decoration in print preview.
      case 'annotation':
      case 'tag':
      case 'revisionFlag':
        return null;
      default:
        return null;
    }
  }

  Rga.PrintRenderer.render      = render;
  Rga.PrintRenderer.sheetCount  = sheetCount;
})();
