// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Search — Slice 3B.
//
// Pure functions over registry entries. The only public surface is
// searchSettings(query, entries?). When entries is omitted, the
// search runs against Rga.Settings.Registry.all().
//
// Matching rules:
//   - case-insensitive
//   - punctuation-tolerant (id "editor.fontSize" matches a query of
//     "editor font size" or "editor.font-size" or "EditorFontSize")
//   - multi-token query is AND across all tokens
//   - tokens are matched against id, label, description, keywords,
//     aliases — each token must hit at least one field
//
// Ranking (deterministic):
//   weight = exact-id-match:100 + keyword-token:50 + alias-token:50
//          + label-prefix:30   + label-substring:20
//          + description-substring:10 + id-token:5
//   results sorted by weight DESC, then by id ASC (stable tiebreak).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Settings = Rga.Settings || {};

  // --------------------------------------------------------------
  // Tokenization. Punctuation, camelCase, and digits are split into
  // whitespace; everything is lowercased. "editor.fontSize" → ["editor",
  // "font", "size"]. Empty tokens are dropped.
  // --------------------------------------------------------------

  function _tokenize(text) {
    if (text == null) return [];
    const str = String(text);
    // Insert space between lowercase→uppercase boundaries to split camelCase.
    const split = str.replace(/([a-z])([A-Z])/g, '$1 $2');
    // Replace anything non-alphanumeric with a space.
    const normalized = split.replace(/[^A-Za-z0-9]+/g, ' ').toLowerCase();
    const tokens = normalized.split(/\s+/).filter(function(t) { return t.length > 0; });
    return tokens;
  }

  function _joinTokens(parts) {
    // Tokenize each part and join with a single space — gives one
    // searchable string per entry the caller can substring-match
    // against if it needs a quick "does any token appear" check.
    const all = [];
    parts.forEach(function(p) {
      _tokenize(p).forEach(function(t) { all.push(t); });
    });
    return all;
  }

  // --------------------------------------------------------------
  // Per-entry indexer. Builds a tiny searchable shape once per call;
  // the entries can be a fresh array (e.g. test fixtures), so we do
  // not memoize across calls.
  // --------------------------------------------------------------

  function _index(entry) {
    const idTokens          = _tokenize(entry.id);
    const labelTokens       = _tokenize(entry.label);
    const descTokens        = _tokenize(entry.description);
    const keywordTokens     = _joinTokens(entry.keywords || []);
    const aliasTokens       = _joinTokens(entry.aliases  || []);
    const labelString       = labelTokens.join(' ');
    const descString        = descTokens.join(' ');
    const idString          = idTokens.join(' ');
    return {
      entry: entry,
      idTokens: idTokens,
      keywordTokens: new Set(keywordTokens),
      aliasTokens:   new Set(aliasTokens),
      labelString:   labelString,
      descString:    descString,
      idString:      idString,
      // Combined set of every token from every field — used by the
      // AND check to confirm a query token matches somewhere.
      anyToken: new Set(
        idTokens.concat(labelTokens, descTokens, keywordTokens, aliasTokens)
      )
    };
  }

  // --------------------------------------------------------------
  // Scoring for one (indexed entry, list of query tokens).
  // Returns 0 if any query token fails to appear anywhere on the
  // entry (AND semantics). Otherwise returns the summed weight.
  // --------------------------------------------------------------

  function _score(idx, queryTokens, rawQueryNorm) {
    let total = 0;
    // AND check first — every token must appear in at least one field.
    for (let i = 0; i < queryTokens.length; i += 1) {
      const t = queryTokens[i];
      if (!_tokenAppears(idx, t)) return 0;
    }
    // Exact-id match (the raw normalized query equals the id-token string).
    if (rawQueryNorm.length > 0 && rawQueryNorm === idx.idString) {
      total += 100;
    }
    // Per-token contributions.
    queryTokens.forEach(function(t) {
      if (idx.keywordTokens.has(t)) total += 50;
      if (idx.aliasTokens.has(t))   total += 50;
      if (_isLabelPrefix(idx, t))   total += 30;
      else if (idx.labelString.indexOf(t) >= 0) total += 20;
      if (idx.descString.indexOf(t) >= 0) total += 10;
      if (idx.idTokens.indexOf(t) >= 0) total += 5;
    });
    return total;
  }

  function _tokenAppears(idx, token) {
    if (idx.anyToken.has(token)) return true;
    // Allow partial / substring matches on label + description so a
    // query of "paper" still matches an entry whose label has "Paper Size"
    // (tokenized to ["paper", "size"] — the strict-token path already
    // covers that; this branch handles cases like "page" matching a
    // word like "Pagination" if it ever shows up).
    if (idx.labelString.indexOf(token) >= 0) return true;
    if (idx.descString.indexOf(token)  >= 0) return true;
    if (idx.idString.indexOf(token)    >= 0) return true;
    return false;
  }

  function _isLabelPrefix(idx, token) {
    // Token starts a label word.
    if (idx.labelString.length === 0) return false;
    if (idx.labelString.indexOf(token) === 0) return true;
    return idx.labelString.indexOf(' ' + token) >= 0;
  }

  // --------------------------------------------------------------
  // Public: searchSettings(query, entries?)
  // --------------------------------------------------------------

  function searchSettings(query, entries) {
    if (typeof query !== 'string') return [];
    const queryTokens = _tokenize(query);
    if (queryTokens.length === 0) return [];
    const rawQueryNorm = queryTokens.join(' ');

    if (!Array.isArray(entries)) {
      const reg = Rga.Settings && Rga.Settings.Registry;
      entries = (reg && typeof reg.all === 'function') ? reg.all() : [];
    }

    const scored = [];
    entries.forEach(function(e) {
      const idx = _index(e);
      const s = _score(idx, queryTokens, rawQueryNorm);
      if (s > 0) scored.push({ entry: e, score: s });
    });

    scored.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      // Stable tiebreak: id ascending.
      if (a.entry.id < b.entry.id) return -1;
      if (a.entry.id > b.entry.id) return  1;
      return 0;
    });

    return scored.map(function(r) { return r.entry; });
  }

  Rga.Settings.Search = { searchSettings };
})();
