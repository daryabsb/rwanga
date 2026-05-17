// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Icons.Lucide — registry of the seven Lucide glyphs used by the
// activity rail. Authored as the single icon family per
// docs/rwanga-activity-rail-doctrine.md (Rule 1).
//
// Vendoring: the canonical SVG files live at
//   renderer/static/vendor/icons/lucide/*.svg
// licensed under ISC (see the LICENSE file alongside them). The path
// data below is reproduced verbatim from those files so the rail can
// inject SVG inline without an async fetch — the renderer runs from
// file:// on Electron and inline SVG keeps `currentColor` styling
// working without CSP gymnastics.
//
// Every glyph satisfies Rule 2:
//   viewBox 0 0 24 24, fill="none", stroke="currentColor",
//   stroke-width="2", stroke-linecap="round", stroke-linejoin="round".
//
// To add a new rail icon: add the .svg to the vendor directory AND a
// matching entry below. Anything in the rail that resolves to a name
// not present here will render a fallback dot (·) and the rail audit
// tests will catch the regression.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Icons = Rga.Icons || {};

  const WRAP_OPEN  = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const WRAP_CLOSE = '</svg>';

  // Path data only — wrapped at lookup time. Keeping the registry as
  // path fragments (not full SVG strings) makes the registry trivial
  // to audit (no duplicated SVG attribute boilerplate) and keeps
  // every glyph guaranteed to share the same wrapper attributes.
  const PATHS = {
    'clapperboard':
      '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/>' +
      '<path d="m6.2 5.3 3.1 3.9"/>' +
      '<path d="m12.4 3.4 3.1 4"/>' +
      '<path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Z"/>',
    'folder-open':
      '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
    'list-tree':
      '<path d="M21 12h-8"/>' +
      '<path d="M21 6H8"/>' +
      '<path d="M21 18h-8"/>' +
      '<path d="M3 6v4c0 1.1.9 2 2 2h3"/>' +
      '<path d="M3 10v6c0 1.1.9 2 2 2h3"/>',
    'search':
      '<circle cx="11" cy="11" r="8"/>' +
      '<path d="m21 21-4.3-4.3"/>',
    'users':
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7" r="4"/>' +
      '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'history':
      '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>' +
      '<path d="M3 3v5h5"/>' +
      '<path d="M12 7v5l4 2"/>',
    'settings':
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
      '<circle cx="12" cy="12" r="3"/>'
  };

  function svgFor(name) {
    const body = PATHS[name];
    if (!body) return '';
    return WRAP_OPEN + body + WRAP_CLOSE;
  }

  function has(name) {
    return Object.prototype.hasOwnProperty.call(PATHS, name);
  }

  function names() {
    return Object.keys(PATHS);
  }

  Rga.Icons.Lucide = {
    svgFor: svgFor,
    has: has,
    names: names
  };
})();
