// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PrintTokens — the small, safe header/footer token resolver.
//
// Print Truth Unification V1, SCOPE C. Header/footer banner text (owned by the
// document via settings.pageSetup.headerText/footerText, projected on the Print
// Contract) may carry a tiny fixed set of placeholder tokens. This module
// substitutes them. It is deliberately NOT a templating engine — no logic, no
// loops, no expressions. Just a literal {{token}} → value replacement over a
// closed, known vocabulary:
//
//   {{title}}   → script title          (ctx.title)
//   {{date}}    → today's date string    (ctx.date — caller-provided, so the
//                 result is deterministic and testable; the renderer stamps it)
//   {{version}} → draft/revision number  (ctx.version)
//   {{page}}    → this page's number     (ctx.page)
//   {{pages}}   → total page count        (ctx.pages)
//
// Rules:
//   * Case-insensitive token names; surrounding whitespace tolerated
//     ({{ Title }} == {{title}}).
//   * An UNKNOWN token is left untouched (no surprise deletion of literal
//     braces the writer typed on purpose).
//   * A known token whose ctx value is missing resolves to '' (the banner
//     simply omits it).
//   * Pure string→string; never touches the DOM.
//
// Public API:
//   Rga.PrintTokens.resolve(text, ctx) → string
//   Rga.PrintTokens.TOKENS             → frozen array of supported names
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.PrintTokens = Rga.PrintTokens || {};

  const TOKENS = Object.freeze(['title', 'date', 'version', 'page', 'pages']);

  // Matches {{ token }} with optional inner whitespace; captures the name.
  const TOKEN_RE = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;

  function resolve(text, ctx) {
    if (typeof text !== 'string' || text.length === 0) return '';
    ctx = ctx || {};
    return text.replace(TOKEN_RE, function(match, rawName) {
      const name = String(rawName).toLowerCase();
      if (TOKENS.indexOf(name) === -1) return match; // unknown → leave literal
      const v = ctx[name];
      return (v === null || v === undefined) ? '' : String(v);
    });
  }

  Rga.PrintTokens.resolve = resolve;
  Rga.PrintTokens.TOKENS  = TOKENS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rga.PrintTokens;
  }
})();
