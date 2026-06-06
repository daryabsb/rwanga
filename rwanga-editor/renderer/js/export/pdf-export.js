// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PB1.B — renderer-side PDF export caller.
//
// Wires the dead PDF pipe surfaced by the Print/Export Truth Audit. The
// menu already emits the `file.exportPdf` action and the preload bridge
// already exposes `window.rwanga.export.toPDF` — this module is the middle
// that was missing.
//
// Flow (Rga.PdfExport.run):
//   1. Render the print sheets through the SAME pipeline Print Preview uses
//      (PrintPreview.buildModel → PrintRenderer.render) into a detached
//      container. This guarantees the PDF matches the preview WITHOUT
//      hijacking the writer's current view. If Print Preview is open we
//      also refresh() it so the on-screen preview stays in sync.
//   2. Resolve the layout geometry (pageSize / margins / direction) via
//      ManuscriptGeometry — the single page-truth resolver.
//   3. Assemble a standalone export HTML document: the same stylesheet
//      links the live app uses (so .rga-page-sheet / .rga-print-block-*
//      styling + RTL font chain are reproduced exactly), a small reset that
//      neutralises the on-screen overlay chrome, and an `@page` rule pinned
//      to the resolved pageSize for printToPDF parity (PB1.C).
//   4. Hand the HTML + geometry to the main process over
//      window.rwanga.export.toPDF; the main handler renders it in an
//      offscreen window and writes the chosen file.
//
// The command wiring (file.exportPdf menu action + export.pdf keyboard
// target) lives in renderer/index.html registerMenuCommands — both invoke
// Rga.PdfExport.run.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.PdfExport = Rga.PdfExport || {};

  // Letter / Hollywood fallback mirrors Rga.LayoutProfile defaults so a
  // missing resolver still produces a correctly-sized export.
  const FALLBACK_GEOMETRY = {
    pageSize: { w: 8.5, h: 11.0, unit: 'in' },
    margins:  { top: 1.0, bottom: 1.0, left: 1.5, right: 1.0, unit: 'in' },
    direction: 'ltr',
    orientation: 'portrait'
  };

  function _activeDoc() {
    return (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function')
      ? Rga.TabManager.activeDoc()
      : null;
  }

  // Geometry for both the @page rule and the main-process printToPDF
  // options. Resolved through ManuscriptGeometry — the same façade Print
  // Preview uses — so the PDF can never diverge from the preview.
  function _geometry() {
    const MG = Rga.ManuscriptGeometry;
    const lp = (MG && typeof MG.resolve === 'function') ? MG.resolve(_activeDoc()) : null;
    if (!lp || !lp.pageSize) return FALLBACK_GEOMETRY;
    return {
      pageSize:    lp.pageSize,
      margins:     lp.margins,
      direction:   lp.direction || 'ltr',
      orientation: lp.orientation || 'portrait'
    };
  }

  // Print Contract V1 — the document's canonical owned print truth, resolved
  // through the single contract resolver. Attached to the export payload so the
  // exported artifact carries the contract for the main process and (later) the
  // web Platform, which reads the same .rga and obtains identical print truth
  // without inventing new print settings.
  function _printContract() {
    const PC = Rga.PrintContract;
    return (PC && typeof PC.resolve === 'function') ? PC.resolve(_activeDoc()) : null;
  }

  // Every stylesheet the live app loads, as absolute file:// URLs. The
  // offscreen export document (a file:// origin) links the same sheets so
  // print-block layout, fonts, and the RTL font chain are reproduced
  // exactly. Font url() references inside each CSS resolve relative to the
  // CSS file's own location, so they survive regardless of where the
  // temp HTML lives.
  function _cssHrefs() {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    const out = [];
    for (let i = 0; i < links.length; i += 1) {
      if (links[i].href) out.push(links[i].href);
    }
    return out;
  }

  function _escapeAttr(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // Pure: assemble the standalone export document. Exposed for tests.
  //   args = { sheetsHTML, cssHrefs, geometry }
  function _buildExportHtml(args) {
    args = args || {};
    const geometry = args.geometry || FALLBACK_GEOMETRY;
    const ps = geometry.pageSize || FALLBACK_GEOMETRY.pageSize;
    const dir = (geometry.direction === 'rtl') ? 'rtl' : 'ltr';
    const links = (args.cssHrefs || [])
      .map(function(href) { return '<link rel="stylesheet" href="' + _escapeAttr(href) + '">'; })
      .join('');

    // Export-only reset. The on-screen #rga-print-preview-root is a fixed
    // dark overlay with inter-sheet gaps + drop shadows; for the PDF we
    // want clean white pages that stack one-per-physical-page. The @page
    // size is pinned to the resolved pageSize so printToPDF
    // (preferCSSPageSize:true) and Print Preview agree pixel-for-pixel.
    const reset =
      '@page { size: ' + ps.w + 'in ' + ps.h + 'in; margin: 0; }' +
      // The export links the app's own reset.css, which sets
      // `html, body { height: 100%; overflow: hidden }` for the on-screen
      // app shell. Linked into the offscreen print document that clips the
      // page flow to a single viewport, so printToPDF captures only the
      // first sheet (the "PDF is only 1 page" bug). Force the print
      // document to grow to its full multi-sheet height and never clip.
      'html, body { margin: 0; padding: 0; background: #fff;' +
        ' height: auto !important; overflow: visible !important; }' +
      '#rga-print-preview-root {' +
        ' display: block !important; position: static !important; inset: auto !important;' +
        ' background: #fff !important; gap: 0 !important; padding: 0 !important;' +
        ' overflow: visible !important; z-index: auto !important; }' +
      '.rga-page-sheet { box-shadow: none !important; margin: 0 !important; }' +
      '.rga-page-sheet:not(:last-child) { break-after: page; page-break-after: always; }';

    return '<!doctype html><html dir="' + dir + '"><head><meta charset="utf-8">' +
           links +
           '<style>' + reset + '</style></head>' +
           '<body><div id="rga-print-preview-root" class="rga-print-preview-root">' +
           (args.sheetsHTML || '') +
           '</div></body></html>';
  }

  // Render the print sheets into a detached container. Returns the sheets
  // innerHTML, or null when there is no active editor view to export.
  function _sheetsHTML() {
    const view = (Rga.TabManager && typeof Rga.TabManager._editorView === 'function')
      ? Rga.TabManager._editorView()
      : null;
    if (!view) return null;
    const model = (Rga.PrintPreview && typeof Rga.PrintPreview.buildModel === 'function')
      ? Rga.PrintPreview.buildModel(view)
      : null;
    if (!model) return null;
    const tmp = document.createElement('div');
    if (Rga.PrintRenderer && typeof Rga.PrintRenderer.render === 'function') {
      const opts = (Rga.PrintPreview && typeof Rga.PrintPreview.getOptions === 'function')
        ? Rga.PrintPreview.getOptions()
        : {};
      // Print Truth Unification V1 — supply the header/footer token context
      // (title/version) from the active Rga doc so the PDF matches Print Preview
      // (the RenderModel is built from the PM node, which has no metadata).
      const doc = _activeDoc();
      const md  = (doc && doc.metadata) || {};
      const tokenCtx = {
        title:   (typeof md.title === 'string') ? md.title : '',
        version: (md.version !== null && md.version !== undefined) ? String(md.version) : ''
      };
      Rga.PrintRenderer.render(model, tmp, Object.assign({}, opts, { tokenCtx: tokenCtx }));
    }
    return tmp.innerHTML;
  }

  // Default filename for the save dialog: the document name with .rga
  // swapped for .pdf, sanitised of path-illegal characters.
  function _suggestedName() {
    const doc = _activeDoc();
    let base = (doc && doc.displayName) ? doc.displayName : 'Script';
    base = String(base).replace(/\.rga$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim();
    if (!base) base = 'Script';
    return base + '.pdf';
  }

  function _toast(message, type) {
    if (Rga.Toast && typeof Rga.Toast.show === 'function') Rga.Toast.show(message, type);
  }

  function _basename(p) {
    if (!p) return '';
    return String(p).split(/[\\/]/).pop();
  }

  // Entry point invoked by the File → Export to PDF menu action
  // (file.exportPdf command) and the keyboard shortcut (export.pdf command,
  // target of the kb.exportPdf settings applicator).
  function run() {
    const api = window.rwanga && window.rwanga.export;
    if (!api || typeof api.toPDF !== 'function') {
      _toast('PDF export is only available in the desktop app.', 'warning');
      return Promise.resolve(false);
    }

    // NOTE: we deliberately do NOT call Rga.PrintPreview.refresh() here.
    // Refresh re-activates the preview, which re-runs the Review Bar's
    // fit/zoom — producing a visible zoom jump on every Export click
    // ("Export behaves like zoom"). The export captures a FRESH detached
    // render below (_sheetsHTML rebuilds the model from the live view), so
    // it is always current without disturbing the on-screen preview.
    const sheets = _sheetsHTML();
    if (sheets == null) {
      _toast('Open a script before exporting to PDF.', 'warning');
      return Promise.resolve(false);
    }

    const geometry = _geometry();
    const printContract = _printContract();
    const html = _buildExportHtml({ sheetsHTML: sheets, cssHrefs: _cssHrefs(), geometry: geometry });
    const suggestedName = _suggestedName();

    return Promise.resolve(api.toPDF(html, { suggestedName: suggestedName, geometry: geometry, printContract: printContract }))
      .then(function(result) {
        if (!result || result.canceled) return false;
        if (result.error) {
          _toast('PDF export failed: ' + result.error, 'error');
          return false;
        }
        _toast('Exported ' + (_basename(result.path) || suggestedName), 'success');
        return true;
      })
      .catch(function(err) {
        console.error('[pdf-export] toPDF failed:', err);
        _toast('PDF export failed.', 'error');
        return false;
      });
  }

  Rga.PdfExport.run              = run;
  Rga.PdfExport._buildExportHtml = _buildExportHtml;
  Rga.PdfExport._geometry        = _geometry;
  Rga.PdfExport._printContract   = _printContract;
  Rga.PdfExport._suggestedName   = _suggestedName;
  Rga.PdfExport._cssHrefs        = _cssHrefs;
})();
