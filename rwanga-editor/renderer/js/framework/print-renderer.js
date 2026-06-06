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
    // Print Truth Unification V1 — token context for header/footer banners.
    // title/version come from the RenderModel (doc metadata); the date is
    // stamped here at render time. Per-page {{page}}/{{pages}} are merged in
    // _buildPageSheet. opts.tokenCtx lets a caller/test inject a fixed date.
    const tokenCtx = Object.assign({
      title:   title,
      version: (renderModel && renderModel.version) ? renderModel.version : '',
      date:    _todayStr()
    }, opts.tokenCtx || {});
    if (!renderModel || !Array.isArray(renderModel.pages) || renderModel.pages.length === 0) {
      // Empty doc → render a single blank sheet so the writer sees the page.
      container.appendChild(_buildPageSheet({ pageNumber: 1, blocks: [] }, 1, lp, opts, title, tokenCtx));
      return;
    }
    for (let p = 0; p < renderModel.pages.length; p += 1) {
      container.appendChild(_buildPageSheet(renderModel.pages[p], renderModel.totalPages, lp, opts, title, tokenCtx));
    }
  }

  // Render-time date string for the {{date}} token. Locale-formatted; the app
  // runtime permits Date (only workflow scripts forbid it). Callers/tests can
  // override via opts.tokenCtx.date for determinism.
  function _todayStr() {
    try { return new Date().toLocaleDateString(); }
    catch (e) { return ''; }
  }

  function sheetCount(container) {
    if (!container) return 0;
    return container.querySelectorAll('.rga-page-sheet').length;
  }

  // ----------------------------------------------------------------
  // Sheet builders
  // ----------------------------------------------------------------

  function _buildPageSheet(page, totalPages, layoutProfile, opts, title, tokenCtx) {
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

    // Print Truth Unification V1, SCOPE B — sheet leading from the single
    // resolved source (layoutProfile.font.leading). Overrides the CSS-hardcoded
    // 1.0 so RTL gets its relaxed leading; because PageMap's linesPerPage was
    // computed from this exact value, the painted leading and the pagination
    // agree by construction. LTR resolves to 1.0 → visually unchanged.
    if (layoutProfile && layoutProfile.font && typeof layoutProfile.font.leading === 'number') {
      sheet.style.lineHeight = String(layoutProfile.font.leading);
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

    // Print Truth Unification V1 — page number, header banner and footer banner
    // are now driven by the resolved Print Contract carried on the layout
    // profile (layoutProfile.printContract). When no contract is attached
    // (pure-pipeline tests that hand-build a profile), behavior falls back to
    // the legacy always-on top-right "N." so those tests stay byte-identical.
    const contract = (layoutProfile && layoutProfile.printContract) || null;
    const m = (layoutProfile && layoutProfile.margins) || null;
    const isRtl = !!(layoutProfile && layoutProfile.direction === 'rtl');
    const pageCtx = Object.assign({}, tokenCtx || {}, {
      page:  page.pageNumber,
      pages: totalPages
    });

    // Page number — honor the contract's enabled flag + position. Legacy
    // (no contract) → enabled, top_right (the traditional "N.").
    const pageNumEnabled  = contract ? contract.pageNumbering.enabled  : true;
    const pageNumPosition = contract ? contract.pageNumbering.position : 'top_right';
    if (pageNumEnabled) {
      const header = document.createElement('div');
      header.className = 'rga-page-sheet-header';
      header.textContent = page.pageNumber + '.';
      _positionBanner(header, pageNumPosition, m, isRtl);
      sheet.appendChild(header);
    }

    // Header banner text — owned page truth (contract.header.text), with
    // {{title}}/{{date}}/{{version}}/{{page}}/{{pages}} tokens resolved. Placed
    // at the top reading-start side so it does not collide with a top-right
    // page number. Rendered only when non-empty.
    const headerText = _resolveBannerText(contract && contract.header && contract.header.text, pageCtx);
    if (headerText) {
      const hb = document.createElement('div');
      hb.className = 'rga-page-sheet-running-header';
      hb.textContent = headerText;
      _positionBanner(hb, isRtl ? 'top_right' : 'top_left', m, isRtl);
      sheet.appendChild(hb);
    }

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

    // Print Truth Unification V1, SCOPE D — effective mark visibility. A
    // per-review override (opts.marks, set from the Print Preview Marks control)
    // wins for THIS render/export only; otherwise the document's contract marks;
    // otherwise the doctrine default. Resolved once per sheet and threaded down.
    const marksVis = (opts.marks && typeof opts.marks === 'object')
      ? opts.marks
      : ((contract && contract.marks) || DEFAULT_MARKS);

    const content = document.createElement('div');
    content.className = 'rga-page-sheet-content';
    if (Array.isArray(page.blocks)) {
      for (let i = 0; i < page.blocks.length; i += 1) {
        content.appendChild(_buildBlockEl(page.blocks[i], i === 0, layoutProfile, marksVis));
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

    // Footer banner text — owned page truth (contract.footer.text), tokens
    // resolved, placed bottom-center. Rendered only when non-empty.
    const footerText = _resolveBannerText(contract && contract.footer && contract.footer.text, pageCtx);
    if (footerText) {
      const fb = document.createElement('div');
      fb.className = 'rga-page-sheet-footer-banner';
      fb.textContent = footerText;
      _positionBanner(fb, 'bottom_center', m, isRtl);
      sheet.appendChild(fb);
    }

    return sheet;
  }

  // Resolve header/footer banner text through the token resolver. Returns ''
  // for empty/missing text so the caller can skip rendering. Guarded so the
  // renderer still works if print-tokens.js failed to load (returns raw text).
  function _resolveBannerText(text, ctx) {
    if (typeof text !== 'string' || text.length === 0) return '';
    if (Rga.PrintTokens && typeof Rga.PrintTokens.resolve === 'function') {
      return Rga.PrintTokens.resolve(text, ctx);
    }
    return text;
  }

  // Position an absolutely-positioned banner element inside the page margin
  // band from a position name ('top_right' | 'top_center' | 'top_left' |
  // 'bottom_right' | 'bottom_center' | 'bottom_left'). Inline styles only —
  // no measurement. RTL mirrors the physical left/right edges so 'right'
  // lands on the binding side, consistent with the sheet padding mirror.
  // No margins → leave the CSS fallback positions in place.
  function _positionBanner(el, position, m, isRtl) {
    if (!m) return;
    const pos = String(position || 'top_right');
    const isBottom = pos.indexOf('bottom') === 0;
    const half = isBottom ? (m.bottom * 0.5) : (m.top * 0.5);
    // Clear any prior vertical pin (CSS fallback) before setting ours.
    el.style.top = ''; el.style.bottom = '';
    if (isBottom) el.style.bottom = half + 'in'; else el.style.top = half + 'in';
    el.style.left = ''; el.style.right = '';
    if (pos.indexOf('center') !== -1) {
      el.style.left  = m.left + 'in';
      el.style.right = m.right + 'in';
      el.style.textAlign = 'center';
    } else if (pos.indexOf('left') !== -1) {
      // physical left edge: in RTL the binding (wider) margin is on the right,
      // so the physical-left content edge uses the right margin value.
      el.style.left = (isRtl ? m.right : m.left) + 'in';
      el.style.textAlign = 'start';
    } else { // right (default)
      el.style.right = (isRtl ? m.left : m.right) + 'in';
      el.style.textAlign = isBottom ? 'right' : 'end';
    }
  }

  function _buildBlockEl(block, isFirstOnPage, layoutProfile, marksVis) {
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
      _appendHeadingDisplay(el, block.heading, layoutProfile, block.sceneNumber);
    } else {
      const runs = (block.inlineRuns && block.inlineRuns.length > 0)
        ? block.inlineRuns
        : [{ text: block.text || '', marks: [] }];
      // Print Truth Unification V1, SCOPE D — mark visibility resolved by the
      // caller (_buildPageSheet): per-review override → document contract →
      // doctrine default. Contract-less renders (pure pipeline tests) fall back
      // to DEFAULT_MARKS here, byte-identical to the legacy behavior.
      const vis = marksVis || DEFAULT_MARKS;
      for (let r = 0; r < runs.length; r += 1) {
        el.appendChild(_renderRun(runs[r], vis));
      }
    }
    return el;
  }

  // The structured heading becomes a display string via the SINGLE canonical
  // slug projection (Rga.SlugResolver, SLUG_TRUTH_DOCTRINE_V1). The convention
  // (token order + separators) comes from the layout profile — the same
  // convention PageMap measures with — so Print display === PageMap measure by
  // construction. When no profile is available (empty-doc / preload path) the
  // resolver's default convention is used, which equals the legacy Print
  // composition exactly, keeping output byte-identical.
  function _appendHeadingDisplay(el, heading, layoutProfile, sceneNumber) {
    if (!heading) return;
    const spec = (layoutProfile && layoutProfile.blocks && layoutProfile.blocks.sceneHeading) || null;
    const convention = spec
      ? { order: spec.order, separators: spec.separators }
      : undefined;
    const slugText = Rga.SlugResolver.compose(heading, convention).text;

    // Print Truth Unification V1, SCOPE E — when scene numbering is enabled
    // (Print Contract truth, the same flag Flow honors), prefix the slug with
    // the scene number as a separable marker. Contract-less renders (pure
    // pipeline tests) carry no number — byte-identical to the legacy slug.
    const contract = layoutProfile && layoutProfile.printContract;
    const showScene = !!(contract && contract.sceneNumbering && contract.sceneNumbering.enabled);
    if (showScene && sceneNumber !== null && sceneNumber !== undefined) {
      const num = document.createElement('span');
      num.className = 'rga-print-scene-number';
      num.textContent = String(sceneNumber);
      el.appendChild(num);
      el.appendChild(document.createTextNode(slugText));
    } else {
      el.textContent = slugText;
    }
  }

  // ----------------------------------------------------------------
  // Inline run rendering (mark wrappers)
  // ----------------------------------------------------------------
  //   strong/bold/em/italic/underline/strikethrough/link/color/highlight:
  //     decorated for visual fidelity
  //   annotation/tag/revisionFlag: working-state marks; print-preview
  //     intentionally ignores them so the preview reads like a clean
  //     production script. A future toggle could surface them.
  // Doctrine default mark visibility for contract-less renders: highlights
  // survive into the deliverable; tags / notes / flags do not (Print Truth
  // Doctrine, Decision 2). Matches the legacy hardcoded behavior exactly.
  const DEFAULT_MARKS = { tags: false, notes: false, flags: false, highlights: true };

  function _renderRun(run, marksVis) {
    marksVis = marksVis || DEFAULT_MARKS;
    let node = document.createTextNode(run.text || '');
    if (!run.marks || run.marks.length === 0) return node;
    for (let i = run.marks.length - 1; i >= 0; i -= 1) {
      const wrap = _markWrapper(run.marks[i], marksVis);
      if (wrap) {
        wrap.appendChild(node);
        node = wrap;
      }
    }
    return node;
  }

  function _markWrapper(mark, marksVis) {
    if (!mark || !mark.type) return null;
    marksVis = marksVis || DEFAULT_MARKS;
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
        if (!marksVis.highlights) return null;       // hidden when toggled off
        const sp = document.createElement('span');
        if (mark.attrs && mark.attrs.color) sp.style.backgroundColor = mark.attrs.color;
        return sp;
      }
      // Working-state marks — off by default (doctrine), shown only when the
      // writer turns them on for a marked review/export. The TEXT is always
      // rendered regardless; these wrappers only add the mark's decoration.
      // Minimal, class-based + mark-own-color decoration so the wiring is real
      // and verifiable; final visual treatment is a designer call (deferred).
      case 'tag': {
        if (!marksVis.tags) return null;
        // Decoration is the CSS brand-pink dotted underline (.rga-print-mark-tag).
        // No per-entity color — tags are a simple, uniform print marker.
        const sp = document.createElement('span');
        sp.className = 'rga-print-mark-tag';
        return sp;
      }
      case 'annotation': {
        if (!marksVis.notes) return null;
        const sp = document.createElement('span');
        sp.className = 'rga-print-mark-note';
        return sp;
      }
      case 'revisionFlag': {
        if (!marksVis.flags) return null;
        const sp = document.createElement('span');
        sp.className = 'rga-print-mark-revision';
        return sp;
      }
      default:
        return null;
    }
  }

  Rga.PrintRenderer.render      = render;
  Rga.PrintRenderer.sheetCount  = sheetCount;
})();
