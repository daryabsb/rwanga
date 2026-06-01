// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SlugResolver — the single canonical scene-heading slug projection.
//
// Doctrine: SLUG_TRUTH_DOCTRINE_V1 — a scene heading is a structured record;
// the `.rga` document owns its truth; Flow and Print are projections. This
// module is the ONE place that composes the structured record
// ({setting, location, time}) into a visible slug string. Print, PageMap
// (measurement), and Nav-index all route through it; Flow convergence is a
// later, separate slice (it consumes the `tokens` contract — see
// SLUG_RESOLVER_DESIGN_BRIEF.md §7) and is NOT wired here.
//
// Hard rules:
//   * PURE — no DOM, no ProseMirror, no Store, no globals except attaching
//     to `Rga`. Same (heading, convention) → byte-identical output.
//   * V1 default convention === today's behavior exactly, so routing the
//     three consumers through it changes NO visible output and NO geometry
//     (PageMap measures `text`, whose length is unchanged by construction).
//
// Public API:
//   Rga.SlugResolver.compose(heading, convention?) →
//     { text: string,
//       tokens: Array<{ kind: 'setting'|'location'|'time'|'sep', value: string }>,
//       length: number }
//   Rga.SlugResolver.DEFAULT_CONVENTION — the canonical convention constant.
//
// Invariants (guaranteed by construction, asserted by tests):
//   length === text.length
//   tokens.map(t => t.value).join('') === text
//
// Input:
//   heading    = { setting: string, location: string, time: string }
//                (the normalizer's heading shape; missing/empty fields are
//                 omitted and their adjacent separator collapses)
//   convention = { order: ['setting','location','time'],
//                  separators: { settingLocation: ' ', locationTime: ' — ' } }
//                (optional / partial; falls back to DEFAULT_CONVENTION)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.SlugResolver = Rga.SlugResolver || {};

  // The canonical V1 convention. Matches the pre-resolver behavior of all
  // three composers exactly: setting → location joined by a space, time
  // appended after an em-dash. Order is explicit so a future non-Hollywood
  // convention (or RTL) can re-sequence at projection time without touching
  // this logic or the stored record.
  const DEFAULT_CONVENTION = {
    order: ['setting', 'location', 'time'],
    separators: {
      settingLocation: ' ',
      locationTime: ' — '
    }
  };

  // The separator that LEADS INTO a token, keyed by the token's kind. This
  // reproduces the legacy composers exactly: nothing precedes `setting`;
  // `settingLocation` precedes `location`; `locationTime` precedes `time`.
  // A separator is emitted only when the token is not the first PRESENT
  // token (so an absent setting collapses the leading space, etc.).
  const SEP_BEFORE = {
    location: 'settingLocation',
    time: 'locationTime'
  };

  function _fieldValue(heading, kind) {
    const v = heading[kind];
    return (v == null) ? '' : String(v);
  }

  function _normalizeConvention(convention) {
    const order = (convention && Array.isArray(convention.order))
      ? convention.order
      : DEFAULT_CONVENTION.order;
    // Merge so a partial separators object still inherits the defaults.
    const separators = Object.assign(
      {},
      DEFAULT_CONVENTION.separators,
      (convention && convention.separators) || {}
    );
    return { order: order, separators: separators };
  }

  function compose(heading, convention) {
    heading = heading || {};
    const conv = _normalizeConvention(convention);
    const tokens = [];
    let text = '';

    for (let i = 0; i < conv.order.length; i += 1) {
      const kind = conv.order[i];
      const value = _fieldValue(heading, kind);
      if (!value) continue; // empty-field collapse

      // A separator only between two PRESENT tokens.
      if (text.length > 0) {
        const sepKey = SEP_BEFORE[kind];
        const sepVal = (sepKey && conv.separators[sepKey] != null)
          ? conv.separators[sepKey]
          : '';
        if (sepVal) {
          tokens.push({ kind: 'sep', value: sepVal });
          text += sepVal;
        }
      }

      tokens.push({ kind: kind, value: value });
      text += value;
    }

    return { text: text, tokens: tokens, length: text.length };
  }

  Rga.SlugResolver.compose            = compose;
  Rga.SlugResolver.DEFAULT_CONVENTION = DEFAULT_CONVENTION;
})();
