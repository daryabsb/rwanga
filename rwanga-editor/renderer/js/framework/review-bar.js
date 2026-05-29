// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.ReviewBar — Print Preview Review Bar v1.
//
// Implements the persistent review-surface chrome directed by
// PRINT_PREVIEW_REVIEW_SURFACE_UX_DIRECTION.md (§2–§6): one slim top bar,
// three zones, floating above the sheet stack —
//
//   [ ← Done   Title · Letter · N pp ] [ ‹ n / total ›  Fit page  Fit width  − % + ] [ ⬇ Export PDF   ⎙ Print ]
//      context / exit                     navigation + zoom (center)                   output / commit
//
// Why this is a SEPARATE module from print-preview.js: the integration
// guard (print-preview-integration.test.js) forbids print-preview.js from
// touching getBoundingClientRect / offset* / client*. All fit/zoom
// measurement — which is presentation-only and never feeds page truth —
// lives here. PrintPreview only calls Rga.ReviewBar.show()/hide() (guarded),
// so the render pipeline and its tests are untouched.
//
// Everything the bar surfaces already exists in the engine (audit §3):
//   * page count       → count of rendered .rga-page-sheet
//   * current page     → scroll position vs sheet offsetTop (the index
//                        print-preview.js computes internally but never reports)
//   * page size / dir  → Rga.ManuscriptGeometry.resolve(activeDoc)
//   * export pipe       → Rga.PdfExport.run()
//   * exit              → Rga.PrintPreview.hide() (restores prior view)
//
// HARD CONSTRAINT: zoom/fit are CSS presentation transforms only
// (Rga... root.style.zoom). They MUST NEVER feed back into PageMap or the
// inch-true sheet geometry (single-resolver doctrine).
//
// Public API:
//   Rga.ReviewBar.show()  → mount/refresh the bar over the active preview
//   Rga.ReviewBar.hide()  → tear down the bar, reset zoom
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.ReviewBar = Rga.ReviewBar || {};

  const BAR_ID   = 'rga-review-bar';
  const ROOT_ID  = 'rga-print-preview-root';
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4.0;
  const ZOOM_STEP = 0.1;
  // Natural Letter sheet in CSS px (8.5in × 11in at 96dpi) — fallback when a
  // sheet's inline inch size can't be read.
  const FALLBACK_SHEET = { w: 8.5 * 96, h: 11 * 96 };
  // Breathing room subtracted from the viewport when computing fit scale.
  const FIT_MARGIN_X = 64;
  const FIT_MARGIN_Y = 110;   // top bar (46) + generous vertical padding

  let _bar = null;
  let _root = null;
  let _fitMode = null;       // 'page' | 'width' | null (free zoom)
  let _zoom = 1;
  let _onScroll = null;
  let _onResize = null;
  let _rafPending = false;
  let _els = null;           // cached control element references

  // ----------------------------------------------------------------
  // Pure helpers (exported for unit tests)
  // ----------------------------------------------------------------

  function _clampZoom(z) {
    if (typeof z !== 'number' || !isFinite(z) || z <= 0) return MIN_ZOOM;
    if (z < MIN_ZOOM) return MIN_ZOOM;
    if (z > MAX_ZOOM) return MAX_ZOOM;
    return z;
  }

  function _formatPct(z) {
    return Math.round(_clampZoom(z) * 100) + '%';
  }

  // Map resolved pageSize {w,h} (inches) to an industry paper label.
  function _paperLabel(pageSize) {
    if (!pageSize || typeof pageSize.w !== 'number' || typeof pageSize.h !== 'number') return 'Custom';
    const near = function(a, b) { return Math.abs(a - b) <= 0.06; };
    const w = Math.min(pageSize.w, pageSize.h);
    const h = Math.max(pageSize.w, pageSize.h);
    if (near(w, 8.5) && near(h, 11)) return 'Letter';
    if (near(w, 8.27) && near(h, 11.69)) return 'A4';
    if (near(w, 8.5) && near(h, 14)) return 'Legal';
    return 'Custom';
  }

  // Pure fit math: scale to fit `mode` given available px and natural sheet px.
  function _fitScale(mode, avail, natural) {
    if (!natural || natural.w <= 0 || natural.h <= 0) return 1;
    const availW = Math.max(1, (avail && avail.w) || 0);
    const availH = Math.max(1, (avail && avail.h) || 0);
    const sw = availW / natural.w;
    const sh = availH / natural.h;
    const raw = (mode === 'width') ? sw : Math.min(sw, sh);
    return _clampZoom(raw);
  }

  // Parse a jump-field value into a clamped 1..total page number, or null.
  function _parseJump(str, total) {
    const n = parseInt(String(str).trim(), 10);
    if (!isFinite(n) || isNaN(n) || total <= 0) return null;
    return Math.max(1, Math.min(total, n));
  }

  // ----------------------------------------------------------------
  // DOM access helpers
  // ----------------------------------------------------------------

  function _sheets() {
    return _root ? _root.querySelectorAll('.rga-page-sheet') : [];
  }
  function _total() {
    return _sheets().length;
  }

  function _activeDoc() {
    return (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function')
      ? Rga.TabManager.activeDoc()
      : null;
  }

  function _resolveGeometry() {
    const MG = Rga.ManuscriptGeometry;
    return (MG && typeof MG.resolve === 'function') ? MG.resolve(_activeDoc()) : null;
  }

  function _docTitle() {
    const doc = _activeDoc();
    if (doc && doc.metadata && typeof doc.metadata.title === 'string' && doc.metadata.title.trim()) {
      return doc.metadata.title.trim();
    }
    if (doc && doc.displayName) return String(doc.displayName).replace(/\.rga$/i, '');
    return 'Untitled';
  }

  // Natural (zoom-1) sheet size in CSS px, read from the inline inch size the
  // PrintRenderer stamps. Falls back to Letter, then to a live measurement.
  function _naturalSheetSize() {
    const sheets = _sheets();
    if (!sheets.length) return Object.assign({}, FALLBACK_SHEET);
    const s = sheets[0];
    let w = _inchesToPx(s.style && s.style.width);
    let h = _inchesToPx(s.style && s.style.height);
    if (!(w > 0)) w = s.offsetWidth || FALLBACK_SHEET.w;
    if (!(h > 0)) h = s.offsetHeight || FALLBACK_SHEET.h;
    return { w: w, h: h };
  }
  function _inchesToPx(str) {
    if (typeof str !== 'string') return 0;
    const m = str.match(/^([\d.]+)in$/);
    return m ? parseFloat(m[1]) * 96 : 0;
  }

  // ----------------------------------------------------------------
  // Page navigation
  // ----------------------------------------------------------------

  // Current page = the most-visible sheet in the viewport. We use
  // getBoundingClientRect throughout (NOT offsetTop/scrollTop): under CSS
  // `zoom`, offsetTop reports unzoomed layout px while scrollTop is zoomed px —
  // they don't share a coordinate space, which corrupts scroll-vs-offset math.
  // Rects are zoom-consistent viewport coords. (Measurement is fine here — this
  // is the presentation-only ReviewBar module; print-preview.js stays free of
  // it per the integration guard.) "Most visible" is robust at the top, middle,
  // AND bottom of the package (the last page, which can't scroll to the top,
  // still wins when it dominates the viewport).
  function _currentPage() {
    const sheets = _sheets();
    if (!sheets.length || !_root) return 0;
    const rootRect = _root.getBoundingClientRect();
    const viewTop = rootRect.top + 78;     // below the fixed bar (root padding-top)
    const viewBottom = rootRect.bottom;
    let bestIdx = 0;
    let bestVisible = -Infinity;
    for (let i = 0; i < sheets.length; i += 1) {
      const r = sheets[i].getBoundingClientRect();
      const visible = Math.min(r.bottom, viewBottom) - Math.max(r.top, viewTop);
      if (visible > bestVisible) { bestVisible = visible; bestIdx = i; }
    }
    const n = sheets[bestIdx].getAttribute('data-page-number');
    return n ? parseInt(n, 10) : (bestIdx + 1);
  }

  function _scrollToPage(n) {
    const total = _total();
    const target = Math.max(1, Math.min(total, n));
    const sheets = _sheets();
    let el = null;
    for (let i = 0; i < sheets.length; i += 1) {
      if (parseInt(sheets[i].getAttribute('data-page-number'), 10) === target) { el = sheets[i]; break; }
    }
    if (!el && sheets[target - 1]) el = sheets[target - 1];
    if (el && _root) {
      // Manual scrollTop delta from rects — both rect deltas and scrollTop are
      // in zoomed px, so this is exact under CSS `zoom` (scrollIntoView is not:
      // it undershoots mid-list when a zoom is applied). Lands the target ~86px
      // below the root top, clear of the fixed review bar.
      const delta = el.getBoundingClientRect().top - _root.getBoundingClientRect().top - 86;
      _root.scrollTop += delta;
    }
    _updateIndicator(target);
  }

  function _updateIndicator(forceCurrent) {
    if (!_els) return;
    const total = _total();
    const cur = (typeof forceCurrent === 'number') ? forceCurrent : _currentPage();
    _els.curEl.textContent = String(cur || 0);
    _els.totEl.textContent = ' / ' + total;
    const none = total <= 0;
    _els.prev.disabled = none || cur <= 1;
    _els.next.disabled = none || cur >= total;
  }

  // ----------------------------------------------------------------
  // Jump-to-page (the indicator IS the jump control)
  // ----------------------------------------------------------------

  function _beginJump() {
    if (!_els) return;
    _els.pageind.hidden = true;
    const input = _els.jumpInput;
    input.value = String(_currentPage() || 1);
    input.hidden = false;
    input.focus();
    input.select();
  }
  function _commitJump() {
    if (!_els) return;
    const n = _parseJump(_els.jumpInput.value, _total());
    _endJump();
    if (n != null) _scrollToPage(n);
  }
  function _endJump() {
    if (!_els) return;
    _els.jumpInput.hidden = true;
    _els.pageind.hidden = false;
    _updateIndicator();
  }

  // ----------------------------------------------------------------
  // Zoom / Fit — presentation only (never touches page truth)
  // ----------------------------------------------------------------

  function _availSize() {
    const w = (_root && _root.clientWidth) ? _root.clientWidth - FIT_MARGIN_X : 0;
    const h = (_root && _root.clientHeight) ? _root.clientHeight - FIT_MARGIN_Y : 0;
    return { w: w, h: h };
  }

  function _applyFit(mode) {
    _fitMode = mode;
    // Measure the viewport at zoom-neutral. CSS `zoom` on the root distorts
    // its own clientWidth/clientHeight, so computing a fit scale while a
    // previous zoom is still applied yields an inconsistent result (the same
    // content fitting to a different scale on each call). Reset, measure,
    // then apply the freshly-computed zoom.
    if (_root) _root.style.zoom = '';
    _zoom = _fitScale(mode, _availSize(), _naturalSheetSize());
    _applyZoom();
  }

  function _stepZoom(delta) {
    _fitMode = null;
    _zoom = _clampZoom(_zoom + delta);
    _applyZoom();
  }

  function _applyZoom() {
    // CSS zoom scales the rendered sheets (and the scroll metrics with them,
    // keeping current-page tracking consistent) WITHOUT mutating the inch-true
    // inline geometry the single-resolver owns.
    if (_root) _root.style.zoom = String(_zoom);
    if (_els) {
      _els.pct.textContent = _formatPct(_zoom);
      _els.fitPage.classList.toggle('is-active', _fitMode === 'page');
      _els.fitWidth.classList.toggle('is-active', _fitMode === 'width');
    }
  }

  // ----------------------------------------------------------------
  // Bar construction
  // ----------------------------------------------------------------

  function _svg(paths) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      paths.map(function(d) { return '<path d="' + d + '"/>'; }).join('') + '</svg>';
  }
  const ICON = {
    back:    ['M19 12H5', 'M12 19l-7-7 7-7'],
    prev:    ['M15 18l-6-6 6-6'],
    next:    ['M9 18l6-6-6-6'],
    fitPage: ['M8 3H5a2 2 0 0 0-2 2v3', 'M21 8V5a2 2 0 0 0-2-2h-3', 'M3 16v3a2 2 0 0 0 2 2h3', 'M16 21h3a2 2 0 0 0 2-2v-3'],
    fitWidth:['M3 12h18', 'M7 8l-4 4 4 4', 'M17 8l4 4-4 4'],
    download:['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
    printer: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2']
  };

  function _btn(cls, html, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.innerHTML = html;
    if (label) b.setAttribute('aria-label', label);
    return b;
  }
  function _sep() {
    const s = document.createElement('div');
    s.className = 'rga-review-sep';
    return s;
  }

  function _buildBar() {
    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.className = 'rga-review-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Print preview review bar');

    // ---- Context / Exit (inline-start) ----
    const context = document.createElement('div');
    context.className = 'rga-review-zone rga-review-context';
    const done = _btn('rga-review-done', _svg(ICON.back) + '<span>Done</span>', 'Exit print preview');
    const id = document.createElement('span');
    id.className = 'rga-review-id';
    context.appendChild(done);
    context.appendChild(id);

    // ---- Navigation + Zoom (center) ----
    const center = document.createElement('div');
    center.className = 'rga-review-zone rga-review-center';

    const nav = document.createElement('div');
    nav.className = 'rga-review-nav';
    const prev = _btn('rga-review-prev', _svg(ICON.prev), 'Previous page');
    const next = _btn('rga-review-next', _svg(ICON.next), 'Next page');
    const pageind = _btn('rga-review-pageind', '', 'Page indicator — click to jump to a page');
    const curEl = document.createElement('span');
    curEl.className = 'rga-review-cur';
    const totEl = document.createElement('span');
    totEl.className = 'rga-review-total';
    pageind.appendChild(curEl);
    pageind.appendChild(totEl);
    const jumpInput = document.createElement('input');
    jumpInput.type = 'text';
    jumpInput.className = 'rga-review-pageind-input';
    jumpInput.setAttribute('inputmode', 'numeric');
    jumpInput.setAttribute('aria-label', 'Jump to page');
    jumpInput.hidden = true;
    nav.appendChild(prev);
    nav.appendChild(pageind);
    nav.appendChild(jumpInput);
    nav.appendChild(next);

    const zoom = document.createElement('div');
    zoom.className = 'rga-review-zoom';
    const fitPage = _btn('rga-review-fit-page', _svg(ICON.fitPage) + '<span>Fit page</span>', 'Fit whole page');
    const fitWidth = _btn('rga-review-fit-width', _svg(ICON.fitWidth) + '<span>Fit width</span>', 'Fit page width');
    const stepper = document.createElement('div');
    stepper.className = 'rga-review-stepper';
    const zoomOut = _btn('rga-review-zoom-out', '−', 'Zoom out');
    const zoomIn = _btn('rga-review-zoom-in', '+', 'Zoom in');
    const pct = document.createElement('span');
    pct.className = 'rga-review-zoom-pct';
    pct.textContent = '100%';
    stepper.appendChild(zoomOut);
    stepper.appendChild(pct);
    stepper.appendChild(zoomIn);
    zoom.appendChild(fitPage);
    zoom.appendChild(fitWidth);
    zoom.appendChild(stepper);

    center.appendChild(nav);
    center.appendChild(_sep());
    center.appendChild(zoom);

    // ---- Output / Commit (inline-end) ----
    const output = document.createElement('div');
    output.className = 'rga-review-zone rga-review-output';
    const exportBtn = _btn('rga-review-export', _svg(ICON.download) + '<span>Export PDF</span>', 'Export PDF');
    // Print: present the slot, defer the wire (UX Direction §5). Shown disabled.
    const printBtn = _btn('rga-review-print', _svg(ICON.printer) + '<span>Print</span>', 'Print (coming soon)');
    printBtn.disabled = true;
    printBtn.setAttribute('title', 'Print — coming soon');
    output.appendChild(exportBtn);
    output.appendChild(printBtn);

    bar.appendChild(context);
    bar.appendChild(_sep());
    bar.appendChild(center);
    bar.appendChild(_sep());
    bar.appendChild(output);

    _els = {
      bar: bar, done: done, id: id,
      prev: prev, next: next, pageind: pageind, curEl: curEl, totEl: totEl, jumpInput: jumpInput,
      fitPage: fitPage, fitWidth: fitWidth, zoomOut: zoomOut, zoomIn: zoomIn, pct: pct,
      exportBtn: exportBtn, printBtn: printBtn
    };
    _wireControls();
    return bar;
  }

  function _wireControls() {
    _els.done.addEventListener('click', function() {
      if (Rga.PrintPreview && typeof Rga.PrintPreview.hide === 'function') Rga.PrintPreview.hide();
    });
    _els.prev.addEventListener('click', function() { _scrollToPage(_currentPage() - 1); });
    _els.next.addEventListener('click', function() { _scrollToPage(_currentPage() + 1); });
    _els.pageind.addEventListener('click', _beginJump);
    _els.jumpInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); _commitJump(); }
      else if (e.key === 'Escape') { e.preventDefault(); _endJump(); }
    });
    _els.jumpInput.addEventListener('blur', _endJump);
    _els.fitPage.addEventListener('click', function() { _applyFit('page'); });
    _els.fitWidth.addEventListener('click', function() { _applyFit('width'); });
    _els.zoomOut.addEventListener('click', function() { _stepZoom(-ZOOM_STEP); });
    _els.zoomIn.addEventListener('click', function() { _stepZoom(ZOOM_STEP); });
    _els.exportBtn.addEventListener('click', function() {
      if (Rga.PdfExport && typeof Rga.PdfExport.run === 'function') Rga.PdfExport.run();
    });
  }

  function _refreshIdentity() {
    if (!_els) return;
    const geo = _resolveGeometry();
    const paper = _paperLabel(geo && geo.pageSize);
    const dir = (geo && geo.direction === 'rtl') ? 'rtl' : 'ltr';
    _bar.setAttribute('dir', dir);
    const title = _docTitle();
    const total = _total();
    _els.id.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = title;
    _els.id.appendChild(b);
    _els.id.appendChild(document.createTextNode(' · ' + paper + ' · ' + total + ' pp'));
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  function show() {
    _root = document.getElementById(ROOT_ID);
    if (!_root) return;   // no preview surface — nothing to host

    const fresh = !_bar;
    if (fresh) {
      _bar = _buildBar();
      document.body.appendChild(_bar);
      _wireSurfaceListeners();
    }

    _refreshIdentity();
    _updateIndicator();

    if (fresh) {
      // UX Direction §4 — Fit page is the default on entry.
      _applyFit('page');
    } else {
      // Refresh (e.g. Page Setup change) — keep the writer's zoom/fit; just
      // recompute if a fit mode is active (page count/size may have changed).
      if (_fitMode) _applyFit(_fitMode);
      else _applyZoom();
    }
  }

  function _wireSurfaceListeners() {
    _onScroll = function() {
      if (_rafPending) return;
      _rafPending = true;
      const raf = window.requestAnimationFrame || function(fn) { return setTimeout(fn, 16); };
      raf(function() { _rafPending = false; _updateIndicator(); });
    };
    _onResize = function() { if (_fitMode) _applyFit(_fitMode); };
    if (_root) _root.addEventListener('scroll', _onScroll);
    window.addEventListener('resize', _onResize);
  }

  function _unwireSurfaceListeners() {
    if (_root && _onScroll) _root.removeEventListener('scroll', _onScroll);
    if (_onResize) window.removeEventListener('resize', _onResize);
    _onScroll = null;
    _onResize = null;
    _rafPending = false;
  }

  function hide() {
    _unwireSurfaceListeners();
    if (_root) _root.style.zoom = '';
    if (_bar && _bar.parentNode) _bar.parentNode.removeChild(_bar);
    _bar = null;
    _els = null;
    _root = null;
    _fitMode = null;
    _zoom = 1;
  }

  // ----------------------------------------------------------------
  // Exports
  // ----------------------------------------------------------------
  Rga.ReviewBar.show = show;
  Rga.ReviewBar.hide = hide;
  // Pure helpers (unit-tested)
  Rga.ReviewBar._clampZoom  = _clampZoom;
  Rga.ReviewBar._formatPct  = _formatPct;
  Rga.ReviewBar._paperLabel = _paperLabel;
  Rga.ReviewBar._fitScale   = _fitScale;
  Rga.ReviewBar._parseJump  = _parseJump;
  Rga.ReviewBar._BAR_ID     = BAR_ID;
})();
