// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PageSetupPreview — S8 single-resolver page-truth surface.
//
// Renders a live miniature of the active document's page geometry as a
// side panel inside the Settings UI's Page Setup section.
//
// Single-resolver truth rule (RC1 §10 + S8 stop condition):
//   * Geometry MUST come from Rga.ManuscriptGeometry.resolve(doc) →
//     Rga.LayoutProfile.compose(profile, settings). The preview NEVER
//     reads Rga.Settings.Store.effective(...) for geometry values.
//   * Page numbering, header text, footer text, orientation are ALSO
//     carried on the composed profile (S8 extension); the preview reads
//     them from the same compose() output.
//   * Print Preview, when it ships, MUST read from the same source.
//
// Repaint signal flow:
//   Settings.Store.set('pageSetup.*', v)
//     → pageSetup.* applicator (renderer/js/shell/shell-applicators.js)
//       → Rga.PageSetupPreview.update()
//         → rAF-debounced _renderInto reads ManuscriptGeometry.resolve
//
// The preview does NOT subscribe to Store directly — the applicator
// chain is the canonical notifier (RC1 §1A.4 wire path). Re-renders are
// coalesced through requestAnimationFrame so rapid Store.set bursts
// produce at most one repaint per frame — well inside the 100ms live-
// update budget the S8 brief sets.
//
// Public API (lifecycled by Settings workspace):
//   Rga.PageSetupPreview.mount(container)       — attach + first render
//   Rga.PageSetupPreview.update(container?)     — request a repaint
//   Rga.PageSetupPreview.unmount(container)     — detach + clean up subs
//   Rga.PageSetupPreview.isMounted()            — diagnostic
//
// The container is the host element (a div in the Settings workspace
// content area). One preview is mounted at a time; mounting into a new
// container after unmount/re-mount is supported.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const WATCHED_IDS = [
    'pageSetup.paperSize',
    'pageSetup.orientation',
    'pageSetup.margins',
    'pageSetup.pageNumbers',
    'pageSetup.pageNumberPosition',
    'pageSetup.headerText',
    'pageSetup.footerText'
  ];

  // Preview dimensions: the miniature page is scaled so its WIDTH fits
  // within MAX_PAGE_PX. Portrait Letter (8.5in) renders at MAX_PAGE_PX
  // pixels wide; landscape (11in) is wider, still capped by MAX_PAGE_PX.
  const MAX_PAGE_PX = 200;

  // Module-local state. One preview at a time — Settings workspace owns
  // the lifecycle and never mounts two in parallel.
  let _container         = null;
  let _stage             = null;   // .rga-page-setup-preview-stage div
  let _subs              = [];     // Store.unsubscribe handles
  let _tabActivatedHand  = null;
  let _rafToken          = 0;

  function _activeDoc() {
    const TM = Rga.TabManager;
    if (!TM) return null;
    if (typeof TM.activeDoc === 'function') {
      const live = TM.activeDoc();
      if (live) return live;
    }
    if (typeof TM.lastActiveDoc === 'function') return TM.lastActiveDoc();
    return null;
  }

  // The truth source. ManuscriptGeometry.resolve delegates to
  // LayoutProfile.compose — the single resolver mandated by S8.
  function _resolveProfile() {
    const doc = _activeDoc();
    if (Rga.ManuscriptGeometry && typeof Rga.ManuscriptGeometry.resolve === 'function') {
      return Rga.ManuscriptGeometry.resolve(doc);
    }
    if (Rga.LayoutProfile && typeof Rga.LayoutProfile.compose === 'function') {
      const profile  = (doc && doc.metadata && doc.metadata.screenplayProfile) || null;
      const settings = (doc && doc.settings) || null;
      return Rga.LayoutProfile.compose(profile, settings);
    }
    return null;
  }

  function _scheduleRender() {
    if (!_container) return;
    if (_rafToken) return;
    if (typeof window.requestAnimationFrame === 'function') {
      _rafToken = window.requestAnimationFrame(function() {
        _rafToken = 0;
        _renderInto(_container);
      });
    } else {
      // Fallback for jsdom — synchronous so unit tests don't have to
      // pump a microtask queue to observe the repaint.
      _rafToken = 0;
      _renderInto(_container);
    }
  }

  function _emptyStage() {
    if (!_stage) return;
    while (_stage.firstChild) _stage.removeChild(_stage.firstChild);
  }

  function _renderInto(container) {
    if (!container) return;
    const profile = _resolveProfile();
    if (!_stage) {
      _stage = document.createElement('div');
      _stage.className = 'rga-page-setup-preview-stage';
      container.appendChild(_stage);
    }
    _emptyStage();

    if (!profile || !profile.pageSize || !profile.margins) {
      // Defensive: no doc / no resolver. Render an empty pane so the
      // side panel doesn't collapse to zero height.
      const empty = document.createElement('div');
      empty.className = 'rga-page-setup-preview-empty';
      empty.textContent = 'Page preview unavailable';
      _stage.appendChild(empty);
      _stage.setAttribute('data-rendered', 'empty');
      return;
    }

    const pw = profile.pageSize.w;
    const ph = profile.pageSize.h;
    const scale = MAX_PAGE_PX / pw;
    const dispW = Math.round(pw * scale);
    const dispH = Math.round(ph * scale);

    const mTop    = profile.margins.top    * scale;
    const mRight  = profile.margins.right  * scale;
    const mBottom = profile.margins.bottom * scale;
    const mLeft   = profile.margins.left   * scale;

    // Heading.
    const heading = document.createElement('div');
    heading.className = 'rga-page-setup-preview-heading';
    heading.textContent = 'Page Preview';
    _stage.appendChild(heading);

    // Page miniature.
    const page = document.createElement('div');
    page.className = 'rga-page-setup-preview-page';
    page.setAttribute('data-test-page-preview', '');
    page.style.width  = dispW + 'px';
    page.style.height = dispH + 'px';
    _stage.appendChild(page);

    // Margin overlay (dashed rectangle inside the page).
    const overlay = document.createElement('div');
    overlay.className = 'rga-page-setup-preview-margin-overlay';
    overlay.style.top    = mTop    + 'px';
    overlay.style.right  = mRight  + 'px';
    overlay.style.bottom = mBottom + 'px';
    overlay.style.left   = mLeft   + 'px';
    page.appendChild(overlay);

    // Faux text lines — first few bold-ish (action), rest thin.
    const contentTop    = mTop + 10;
    const contentBottom = dispH - mBottom - 6;
    const lineSpacing   = 6;
    let lineIndex = 0;
    for (let y = contentTop; y < contentBottom; y += lineSpacing, lineIndex += 1) {
      const line = document.createElement('div');
      line.className = lineIndex < 3
        ? 'rga-page-setup-preview-line rga-page-setup-preview-line--bold'
        : 'rga-page-setup-preview-line';
      line.style.left  = (mLeft  + 4) + 'px';
      line.style.right = (mRight + (lineIndex % 3 === 0 ? 16 : 4)) + 'px';
      line.style.top   = y + 'px';
      page.appendChild(line);
    }

    // Page number — S8: enabled + position from profile.pageNumbers.
    if (profile.pageNumbers && profile.pageNumbers.enabled) {
      const pn = document.createElement('span');
      pn.className = 'rga-page-setup-preview-pagenum';
      pn.setAttribute('data-test-pagenum-position', profile.pageNumbers.position);
      pn.textContent = '1.';
      const pos = profile.pageNumbers.position || 'top_right';
      if (pos === 'top_right' || pos === 'top_center') {
        pn.style.top = Math.max(1, (mTop / 2) - 3) + 'px';
      } else {
        pn.style.bottom = Math.max(1, (mBottom / 2) - 3) + 'px';
      }
      if (pos === 'top_right' || pos === 'bottom_right') {
        pn.style.right = (mRight + 4) + 'px';
      } else if (pos === 'top_center' || pos === 'bottom_center') {
        pn.style.left = '50%';
        pn.style.transform = 'translateX(-50%)';
      }
      page.appendChild(pn);
    }

    // Header / footer text (truncated for the miniature).
    if (profile.header && profile.header.text) {
      const h = document.createElement('span');
      h.className = 'rga-page-setup-preview-header';
      h.style.top  = Math.max(1, (mTop / 2) - 3) + 'px';
      h.style.left = (mLeft + 4) + 'px';
      h.textContent = profile.header.text.slice(0, 22);
      page.appendChild(h);
    }
    if (profile.footer && profile.footer.text) {
      const f = document.createElement('span');
      f.className = 'rga-page-setup-preview-footer';
      f.style.bottom = Math.max(1, (mBottom / 2) - 3) + 'px';
      f.style.left   = (mLeft + 4) + 'px';
      f.textContent  = profile.footer.text.slice(0, 22);
      page.appendChild(f);
    }

    // Dim label below the miniature.
    const label = document.createElement('div');
    label.className = 'rga-page-setup-preview-label';
    const sizeName = _paperLabel(profile);
    const orient   = profile.orientation === 'landscape' ? 'Landscape' : 'Portrait';
    label.textContent = sizeName + ' · ' + orient + '   ' +
                        pw.toFixed(2) + '" × ' + ph.toFixed(2) + '"';
    _stage.appendChild(label);

    _stage.setAttribute('data-rendered', 'ok');
    _stage.setAttribute('data-paper-w-in', String(pw));
    _stage.setAttribute('data-paper-h-in', String(ph));
    _stage.setAttribute('data-orientation', profile.orientation || 'portrait');
    _stage.setAttribute('data-margin-top-in',    String(profile.margins.top));
    _stage.setAttribute('data-margin-right-in',  String(profile.margins.right));
    _stage.setAttribute('data-margin-bottom-in', String(profile.margins.bottom));
    _stage.setAttribute('data-margin-left-in',   String(profile.margins.left));
  }

  // Derive a human-readable paper-size label from the resolved profile.
  // The composed shape doesn't carry the user's chosen name (only the
  // dimensions), so the label is reconstructed from Constants.PAPER_SIZES.
  function _paperLabel(profile) {
    if (!profile || !profile.pageSize) return 'Custom';
    // After orientation rotation, the long edge may be `.w` (landscape).
    // Match against the canonical portrait dimensions stored in the
    // PAPER_SIZES table.
    const pw = profile.pageSize.w;
    const ph = profile.pageSize.h;
    const long  = Math.max(pw, ph);
    const short = Math.min(pw, ph);
    const table = (Rga.Constants && Rga.Constants.PAPER_SIZES) || null;
    if (table) {
      const keys = Object.keys(table);
      for (let i = 0; i < keys.length; i += 1) {
        const entry = table[keys[i]];
        if (entry && typeof entry.width === 'number' && typeof entry.height === 'number') {
          const eL = Math.max(entry.width, entry.height);
          const eS = Math.min(entry.width, entry.height);
          if (Math.abs(eL - long) < 0.01 && Math.abs(eS - short) < 0.01) {
            return keys[i];
          }
        }
      }
    }
    return 'Custom';
  }

  // S8 — repaint notifications come from the pageSetup.* applicators
  // (RC1 §1A.4). The preview only watches editor.tabActivated for the
  // "user switched docs while Settings is open" case where there is no
  // pageSetup.* Store write to drive an applicator fire.
  function _subscribeAll() {
    _tabActivatedHand = function() { _scheduleRender(); };
    document.addEventListener('editor.tabActivated', _tabActivatedHand);
  }

  function _unsubscribeAll() {
    _subs.forEach(function(off) { try { off(); } catch (_) {} });
    _subs = [];
    if (_tabActivatedHand) {
      document.removeEventListener('editor.tabActivated', _tabActivatedHand);
      _tabActivatedHand = null;
    }
    if (_rafToken && typeof window.cancelAnimationFrame === 'function') {
      try { window.cancelAnimationFrame(_rafToken); } catch (_) {}
    }
    _rafToken = 0;
  }

  function mount(container) {
    if (!container) return;
    if (_container && _container !== container) unmount(_container);
    _container = container;
    container.classList.add('rga-page-setup-preview');
    container.setAttribute('data-test-page-setup-preview', '');
    _subscribeAll();
    _renderInto(container);
  }

  function update(/* container */) {
    if (!_container) return;
    _scheduleRender();
  }

  function unmount(container) {
    const target = container || _container;
    if (!target) return;
    _unsubscribeAll();
    if (_stage && _stage.parentNode === target) {
      target.removeChild(_stage);
    }
    target.classList.remove('rga-page-setup-preview');
    target.removeAttribute('data-test-page-setup-preview');
    _stage = null;
    if (target === _container) _container = null;
  }

  function isMounted() { return _container !== null; }

  Rga.PageSetupPreview = {
    mount:     mount,
    update:    update,
    unmount:   unmount,
    isMounted: isMounted,
    _WATCHED_IDS: WATCHED_IDS
  };
})();
