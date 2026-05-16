// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Text-wrapping helper for the screenplay layout engine.
//
// Computes the number of logical lines a string of text would occupy when
// rendered at a fixed column width. "Logical lines" means visual rows the
// reader sees — Courier 12pt being a fixed-width font, a column is
// expressible as a character count, so the wrap is purely character-based.
// For variable-width fonts (or RTL scripts with conjoined glyphs) future
// LayoutProfiles can swap this implementation; engine consumes the result
// via a profile-supplied widths.* mapping.
//
// Rules:
//   - Empty / whitespace-only text → 1 line (the block still occupies one
//     row visually — an empty character cue is still a line on paper).
//   - Single word longer than the column width → still 1 line (the writer
//     accepted the overflow when they typed an un-breakable string).
//     This matches Final Draft / Highland behaviour.
//   - Wrapping is greedy on space boundaries: accumulate words, break when
//     the next word would push past the column. No hyphenation.
//   - Explicit newlines in the source split into hard line breaks first,
//     then each subsequent paragraph wraps independently.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.layout = Rga.DocTypes.screenplay.layout || {};

  function _wrapParagraph(text, columnWidth) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return 1;
    if (!columnWidth || columnWidth <= 0) return 1;

    const words = trimmed.split(/\s+/);
    let lines = 1;
    let currentLineLength = 0;
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      if (!word) continue;
      // The space between this word and the previous one costs 1 char
      // (except at start of line).
      const needed = (currentLineLength === 0 ? 0 : 1) + word.length;
      if (currentLineLength === 0) {
        // First word on this logical line; even if it's longer than the
        // column, it occupies one line.
        currentLineLength = word.length;
      } else if (currentLineLength + needed <= columnWidth) {
        currentLineLength += needed;
      } else {
        lines += 1;
        currentLineLength = word.length;
      }
    }
    return lines;
  }

  // Public entry — wrapText(text, columnWidth) → number of logical lines.
  // Handles explicit newlines as paragraph breaks; sums each paragraph's
  // wrap separately.
  function wrapText(text, columnWidth) {
    const src = String(text || '');
    if (!src) return 1;
    const paragraphs = src.split(/\r?\n/);
    let total = 0;
    for (let i = 0; i < paragraphs.length; i += 1) {
      total += _wrapParagraph(paragraphs[i], columnWidth);
    }
    return Math.max(1, total);
  }

  Rga.DocTypes.screenplay.layout.wrapText = wrapText;
})();
