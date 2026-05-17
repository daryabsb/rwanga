// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// DocumentOutline builder (Phase 5) — pure function over PM doc state.
// Spec: docs/phase0-final-schema-contract.md §6.2.
//
// Used by future explorer / navigator panes, AI context window, export
// summaries, and cross-script tooling. Distinct from NavigationIndex
// (positional, used for jumping + numbering) — the Outline is shape-only
// and built for summarisation.
//
// Public API:
//   Rga.Outline.build(doc, opts?) → DocumentOutline
//     opts: { tagRegistry?, screenplayProfile?, title?, pageCount? }
//
// DocumentOutline shape:
//   {
//     title:             string,
//     screenplayProfile: { language, direction, screenplayConvention },
//     scenes: [
//       { nodeId, sceneNumber, headingDisplay, summary }, ...
//     ],
//     characters: [{ nodeId, name, appearances }, ...],
//     tags: { character:[], prop:[], ... },     // per registry / mentions
//     statistics: {
//       pages:         number,   // 0 in Phase 5; PageMap fills in Phase 6
//       words:         number,
//       dialogueWords: number,
//       actionWords:   number,
//       sceneCount:    number
//     }
//   }
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Outline = Rga.Outline || {};

  const SUMMARY_MAX_CHARS = 120;

  function build(doc, opts) {
    opts = opts || {};
    const profile = opts.screenplayProfile || _profileFromDoc(doc) || _defaultProfile();
    const title = opts.title || _titleFromDoc(doc) || '';

    const out = {
      title: title,
      screenplayProfile: profile,
      scenes: [],
      characters: [],
      tags: _emptyTagBuckets(),
      statistics: _newStats(opts.pageCount)
    };

    if (!doc || typeof doc.descendants !== 'function') return out;

    // The Outline reuses NavigationIndex output when available (single
    // walk, two views). Falls back to a local walk for the unit case
    // where Outline is built standalone.
    const navIndex = (Rga.Nav && typeof Rga.Nav.buildIndex === 'function')
      ? Rga.Nav.buildIndex(doc, opts) : null;

    if (navIndex) {
      for (let i = 0; i < navIndex.scenes.length; i += 1) {
        const s = navIndex.scenes[i];
        out.scenes.push({
          nodeId:         s.nodeId,
          sceneNumber:    s.sceneNumber,
          headingDisplay: s.headingDisplay,
          summary:        _sceneSummary(doc, s.pmPos)
        });
      }
      // Character summary: name + unique-scene appearance count.
      for (let i = 0; i < navIndex.characters.length; i += 1) {
        const c = navIndex.characters[i];
        out.characters.push({
          nodeId:      c.nodeId,
          name:        c.name,
          appearances: c.sceneAppearances ? c.sceneAppearances.length : 0
        });
      }
      // Tags summary: same shape, grouped by type.
      const types = Object.keys(navIndex.tags);
      for (let ti = 0; ti < types.length; ti += 1) {
        const type = types[ti];
        const list = navIndex.tags[type] || [];
        out.tags[type] = list.map(function(t) {
          return {
            nodeId:      t.nodeId,
            name:        t.name,
            appearances: t.sceneAppearances ? t.sceneAppearances.length : 0
          };
        });
      }
    }

    _fillStatistics(out.statistics, doc);
    return out;
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  function _emptyTagBuckets() {
    const TAG_TYPES = (Rga.Nav && Rga.Nav._TAG_TYPES) ||
      ['character','prop','wardrobe','location','sfx','vfx','vehicle','animal','custom'];
    const out = {};
    TAG_TYPES.forEach(function(t) { out[t] = []; });
    return out;
  }

  function _newStats(pageCount) {
    return {
      pages:         (typeof pageCount === 'number' ? pageCount : 0),
      words:         0,
      dialogueWords: 0,
      actionWords:   0,
      sceneCount:    0
    };
  }

  function _defaultProfile() {
    return { language: 'en', direction: 'ltr', screenplayConvention: 'hollywood' };
  }

  function _profileFromDoc(doc) {
    // Profile lives on the .rga file's metadata, not on the PM doc directly
    // (the PM schema doesn't model file-level metadata). Caller passes it
    // via opts. Fallback returns null so caller's default takes effect.
    return null;
  }

  function _titleFromDoc(doc) {
    // titleStrip holds the title in v3 — first child of doc, content-bearing.
    if (!doc || !doc.childCount) return '';
    for (let i = 0; i < doc.childCount; i += 1) {
      const c = doc.child(i);
      if (c && c.type && c.type.name === 'titleStrip') {
        return (typeof c.textContent === 'string') ? c.textContent.trim() : '';
      }
    }
    return '';
  }

  function _sceneSummary(doc, scenePos) {
    const scene = doc.nodeAt(scenePos);
    if (!scene) return '';
    // First action block in the scene, first SUMMARY_MAX_CHARS chars.
    let summary = '';
    for (let i = 0; i < scene.childCount; i += 1) {
      const c = scene.child(i);
      if (c && c.type && c.type.name === 'action') {
        summary = (typeof c.textContent === 'string') ? c.textContent : '';
        break;
      }
    }
    if (!summary) {
      // No action — try first non-heading non-transition block of any kind.
      for (let i = 0; i < scene.childCount; i += 1) {
        const c = scene.child(i);
        if (!c || !c.type) continue;
        if (c.type.name === 'sceneHeading' || c.type.name === 'transition') continue;
        if (typeof c.textContent === 'string' && c.textContent.length > 0) {
          summary = c.textContent;
          break;
        }
      }
    }
    if (summary.length > SUMMARY_MAX_CHARS) summary = summary.slice(0, SUMMARY_MAX_CHARS - 1) + '…';
    return summary;
  }

  function _fillStatistics(stats, doc) {
    let totalWords = 0;
    let dialogueWords = 0;
    let actionWords = 0;
    let sceneCount = 0;
    doc.descendants(function(node) {
      if (!node || !node.type) return true;
      if (node.type.name === 'scene') {
        sceneCount += 1;
        return true;
      }
      // Count words at the block level (avoids double-counting nested text).
      if (node.type.name === 'action' || node.type.name === 'dialogue' ||
          node.type.name === 'character' || node.type.name === 'parenthetical' ||
          node.type.name === 'shot' || node.type.name === 'sceneHeading' ||
          node.type.name === 'transition' || node.type.name === 'paragraph' ||
          node.type.name === 'heading') {
        const text = (typeof node.textContent === 'string') ? node.textContent : '';
        const w = _wordCount(text);
        totalWords += w;
        if (node.type.name === 'dialogue') dialogueWords += w;
        else if (node.type.name === 'action') actionWords += w;
        return false; // counted at block level; don't descend into text nodes
      }
      return true;
    });
    stats.words = totalWords;
    stats.dialogueWords = dialogueWords;
    stats.actionWords = actionWords;
    stats.sceneCount = sceneCount;
  }

  function _wordCount(text) {
    if (!text) return 0;
    const matches = text.match(/\S+/g);
    return matches ? matches.length : 0;
  }

  Rga.Outline.build = build;
})();
