// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// v2.0 → v3.0 migration — pure JSON → JSON.
//
// Contract: docs/phase0-final-schema-contract.md §4 (signed 2026-05-16).
//
// Doc-level transforms:
//   - rga_version → "3.0"
//   - metadata.language → metadata.screenplayProfile (structured)
//   - everything else preserved (settings, tag_registry, flag_log, etc.)
//   - unknown fields preserved at every level
//
// Body-level transforms:
//   - sceneFrame atoms → scene nodes (new shape)
//     - attrs.id stays
//     - attrs.number DROPPED (derived in v3)
//     - attrs.headingStyle moves into sceneHeading
//     - innerDoc.attrs.notes → scene.attrs.notes
//     - innerDoc.attrs.revisionFlag → scene.attrs.revisionFlag
//     - scene.attrs.metadata = { linkedScenes:[], references:[], production:{} }
//     - innerDoc.content[0] (sceneLine) → sceneHeading (location moves from
//       text content into... STILL content per correction 1; setting/time/
//       headingStyle in attrs)
//     - innerDoc.content[1..N-1] (mid-blocks) → preserved by type, with
//       parenthetical text wrapped in parens (correction 3; idempotent)
//     - innerDoc.content[last] (transition) → transition with content +
//       attrs.presetType derived from text (correction 2)
//   - Empty `paragraph {}` siblings BETWEEN two `scene` siblings are
//     DROPPED (v2 spacer convention retired)
//   - Empty paragraphs elsewhere (treatment area) are KEPT
//
// Mark preservation: every text node's marks array passes through
// byte-for-byte. Mark specs are byte-identical between v2.0 and v3.0.
//
// Rules: pure function, no PM schema access, no editor/DOM access,
// preserves unknown fields, idempotent on parenthetical paren-wrap.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Migrations = Rga.Migrations || {};
  Rga.Migrations._steps = Rga.Migrations._steps || {};

  const KNOWN_TRANSITION_PRESETS = [
    'CUT', 'MIX', 'FADE IN', 'FADE OUT', 'DISSOLVE',
    'MATCH CUT', 'SMASH CUT', 'JUMP CUT'
  ];

  // ----------------------------------------------------------------
  // Helpers — pure, no side effects.
  // ----------------------------------------------------------------

  function _concatTextContent(content) {
    if (!Array.isArray(content)) return '';
    let out = '';
    content.forEach(function(child) {
      if (child && child.type === 'text' && typeof child.text === 'string') out += child.text;
    });
    return out;
  }

  function _derivePresetType(text) {
    if (typeof text !== 'string') return null;
    // Normalize: trim, uppercase, strip trailing punctuation (colons,
    // periods, ellipses) so "CUT TO:" matches the "CUT TO" / "CUT" presets.
    const normalized = text.trim().toUpperCase().replace(/[\s:.…]+$/g, '');
    if (!normalized) return null;
    // Exact match first.
    for (let i = 0; i < KNOWN_TRANSITION_PRESETS.length; i += 1) {
      if (KNOWN_TRANSITION_PRESETS[i] === normalized) return KNOWN_TRANSITION_PRESETS[i];
    }
    // "CUT TO" / "MATCH CUT TO" / "FADE TO" etc. — strip a trailing
    // " TO" and try again.
    if (normalized.endsWith(' TO')) {
      const base = normalized.slice(0, -3);
      for (let i = 0; i < KNOWN_TRANSITION_PRESETS.length; i += 1) {
        if (KNOWN_TRANSITION_PRESETS[i] === base) return KNOWN_TRANSITION_PRESETS[i];
      }
    }
    return null; // custom / unrecognized
  }

  // True iff text already begins with "(" and ends with ")". Idempotent
  // guard for the parenthetical wrap migration.
  function _isAlreadyParenWrapped(text) {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    return trimmed.length >= 2 && trimmed.charAt(0) === '(' && trimmed.charAt(trimmed.length - 1) === ')';
  }

  function _wrapInParens(text) {
    if (typeof text !== 'string') return text;
    if (_isAlreadyParenWrapped(text)) return text;
    return '(' + text + ')';
  }

  // Walk a content array of text/mark nodes; rebuild with the first text
  // node's text wrapped in parens (and a trailing ")" appended to the last
  // text node if there's more than one). Marks survive byte-for-byte.
  // Idempotent: if the concatenated text already starts with "(" and ends
  // with ")", returns the original array unchanged.
  function _wrapParentheticalContent(content) {
    if (!Array.isArray(content) || content.length === 0) return content;
    const combinedText = _concatTextContent(content);
    if (_isAlreadyParenWrapped(combinedText)) return content;
    // Find first and last text children to wrap around. Non-text children
    // are passed through untouched.
    let firstTextIdx = -1, lastTextIdx = -1;
    for (let i = 0; i < content.length; i += 1) {
      if (content[i] && content[i].type === 'text') {
        if (firstTextIdx < 0) firstTextIdx = i;
        lastTextIdx = i;
      }
    }
    if (firstTextIdx < 0) {
      // No text at all — synthesize an empty parens text node.
      return [{ type: 'text', text: '()' }];
    }
    return content.map(function(child, i) {
      if (!child || child.type !== 'text') return child;
      if (i === firstTextIdx && i === lastTextIdx) {
        return Object.assign({}, child, { text: '(' + (child.text || '') + ')' });
      }
      if (i === firstTextIdx) {
        return Object.assign({}, child, { text: '(' + (child.text || '') });
      }
      if (i === lastTextIdx) {
        return Object.assign({}, child, { text: (child.text || '') + ')' });
      }
      return child;
    });
  }

  function _deriveScreenplayProfile(parsedMetadata) {
    const language = (parsedMetadata && parsedMetadata.language) || 'en';
    const direction = (language === 'ar' || language === 'ku') ? 'rtl' : 'ltr';
    return {
      language: language,
      direction: direction,
      screenplayConvention: 'hollywood'
    };
  }

  // ----------------------------------------------------------------
  // Per-block transforms inside a scene's innerDoc.content
  // ----------------------------------------------------------------

  function _sceneLineToSceneHeading(sceneLineNode, headingStyle) {
    const attrs = (sceneLineNode && sceneLineNode.attrs) || {};
    const sceneHeading = {
      type: 'sceneHeading',
      attrs: {
        setting:      attrs.setting !== undefined ? attrs.setting : 'INT.',
        time:         attrs.time    !== undefined ? attrs.time    : 'DAY',
        headingStyle: headingStyle == null ? null : headingStyle
      }
    };
    // Preserve content (location text + any marks); empty if absent.
    // Strip empty text-node fragments (v3 PM rejects them).
    if (Array.isArray(sceneLineNode.content) && sceneLineNode.content.length > 0) {
      const cleaned = _stripEmptyTextNodes(sceneLineNode.content);
      if (cleaned.length > 0) sceneHeading.content = cleaned;
    }
    return sceneHeading;
  }

  function _transitionV2toV3(transitionNode) {
    const text = _concatTextContent(transitionNode.content);
    const presetType = _derivePresetType(text);
    const contentText = text.length > 0 ? text : 'CUT';
    return {
      type: 'transition',
      attrs: { presetType: presetType || (contentText.toUpperCase() === 'CUT' ? 'CUT' : null) },
      content: [{ type: 'text', text: contentText }]
    };
  }

  function _parentheticalV2toV3(parenNode) {
    const cleaned = _stripEmptyTextNodes(parenNode.content);
    return Object.assign({}, parenNode, {
      content: _wrapParentheticalContent(cleaned)
    });
  }

  // Strip empty text-node fragments — v2 serialization sometimes emits
  // { type:'text', text:'' } as a leading or interstitial fragment in
  // multi-text blocks; the v3 PM schema rejects empty text nodes on
  // nodeFromJSON. Marks on non-empty fragments survive untouched.
  function _stripEmptyTextNodes(content) {
    if (!Array.isArray(content)) return content;
    return content.filter(function(child) {
      if (!child) return false;
      if (child.type === 'text' && (typeof child.text !== 'string' || child.text.length === 0)) return false;
      return true;
    });
  }

  // Pass-through for blocks that don't change shape (action, character,
  // dialogue, shot). Their content + marks survive byte-for-byte (except
  // empty text fragments are stripped — v3 schema rejects them).
  function _passThroughBlock(node) {
    if (!node || !Array.isArray(node.content)) return node;
    return Object.assign({}, node, { content: _stripEmptyTextNodes(node.content) });
  }

  // ----------------------------------------------------------------
  // sceneFrame → scene
  // ----------------------------------------------------------------

  function _sceneFrameToScene(sceneFrameNode) {
    const outerAttrs = sceneFrameNode.attrs || {};
    const innerDoc = outerAttrs.innerDoc || { type: 'doc', attrs: {}, content: [] };
    const innerAttrs = innerDoc.attrs || {};
    const innerContent = Array.isArray(innerDoc.content) ? innerDoc.content : [];

    // Split: sceneHeading (first sceneLine), mid blocks, transition (last
    // if present). Defensive: if structure doesn't match expectation, do
    // best-effort preservation.
    let headingChild = null;
    let transitionChild = null;
    const midChildren = [];
    innerContent.forEach(function(child, idx) {
      if (!child || !child.type) return;
      if (idx === 0 && child.type === 'sceneLine') {
        headingChild = _sceneLineToSceneHeading(child, outerAttrs.headingStyle);
      } else if (child.type === 'sceneLine') {
        // Stray non-first sceneLine — preserve as a sceneHeading; PM will
        // reject this on validation but preserving data > silently dropping.
        midChildren.push(_sceneLineToSceneHeading(child, null));
      } else if (child.type === 'transition') {
        transitionChild = _transitionV2toV3(child);
      } else if (child.type === 'parenthetical') {
        midChildren.push(_parentheticalV2toV3(child));
      } else {
        midChildren.push(_passThroughBlock(child));
      }
    });
    // Synthesize defaults for missing required pieces (no sceneHeading or no
    // transition would make the v3 schema reject the scene; v2 sample always
    // has both but other v2 docs in the wild might not).
    if (!headingChild) {
      headingChild = {
        type: 'sceneHeading',
        attrs: { setting: 'INT.', time: 'DAY', headingStyle: outerAttrs.headingStyle || null }
      };
    }
    if (!transitionChild) {
      transitionChild = {
        type: 'transition',
        attrs: { presetType: 'CUT' },
        content: [{ type: 'text', text: 'CUT' }]
      };
    }
    // A v3 scene must have at least one sceneBody child between heading and
    // transition. If the source had only a heading + transition, seed an
    // empty action block so the doc is valid.
    if (midChildren.length === 0) {
      midChildren.push({ type: 'action' });
    }

    return {
      type: 'scene',
      attrs: {
        id:           outerAttrs.id || null,
        notes:        innerAttrs.notes || '',
        revisionFlag: innerAttrs.revisionFlag != null ? innerAttrs.revisionFlag : null,
        metadata:     { linkedScenes: [], references: [], production: {} }
      },
      content: [headingChild].concat(midChildren).concat([transitionChild])
    };
  }

  // ----------------------------------------------------------------
  // Body walker: drop empty inter-scene paragraphs, convert sceneFrames
  // ----------------------------------------------------------------

  function _isEmptyParagraph(node) {
    if (!node || node.type !== 'paragraph') return false;
    if (!node.content) return true;
    if (!Array.isArray(node.content) || node.content.length === 0) return true;
    return node.content.every(function(c) {
      return !c || (c.type === 'text' && (!c.text || c.text === ''));
    });
  }

  function _isSceneOrSceneFrame(node) {
    return node && (node.type === 'scene' || node.type === 'sceneFrame');
  }

  function _migrateBodyChildren(children) {
    if (!Array.isArray(children)) return children;
    // First pass: drop empty paragraphs that sit BETWEEN two scenes (or
    // between a scene and a body-edge — leading/trailing). Keep empty
    // paragraphs in the treatment area (where neither neighbour is a scene).
    const kept = [];
    for (let i = 0; i < children.length; i += 1) {
      const node = children[i];
      if (_isEmptyParagraph(node)) {
        const prev = kept.length > 0 ? kept[kept.length - 1] : null;
        const next = children[i + 1] || null;
        const prevIsScene = _isSceneOrSceneFrame(prev);
        const nextIsScene = _isSceneOrSceneFrame(next);
        // Drop if BOTH neighbours are scenes (or scene-adjacent at edges).
        if (prevIsScene && nextIsScene) continue;
        // Leading/trailing empty between a scene + body edge → also drop.
        if (prevIsScene && next === null) continue;
        if (prev === null && nextIsScene) continue;
      }
      kept.push(node);
    }
    // Second pass: convert sceneFrame atoms to scene nodes.
    return kept.map(function(node) {
      if (node && node.type === 'sceneFrame') return _sceneFrameToScene(node);
      return node;
    });
  }

  function _migrateBodyTree(bodyNode) {
    if (!bodyNode || typeof bodyNode !== 'object') return bodyNode;
    // The outer doc structure is doc → (titleStrip?, body). We recurse to
    // find every `body` wrapper and process its children. Other nodes pass
    // through unchanged (titleStrip, etc.).
    if (bodyNode.type === 'body' && Array.isArray(bodyNode.content)) {
      return Object.assign({}, bodyNode, { content: _migrateBodyChildren(bodyNode.content) });
    }
    if (Array.isArray(bodyNode.content)) {
      return Object.assign({}, bodyNode, {
        content: bodyNode.content.map(_migrateBodyTree)
      });
    }
    return bodyNode;
  }

  // ----------------------------------------------------------------
  // Doc-level migration (metadata.language → screenplayProfile, version bump)
  // ----------------------------------------------------------------

  function _migrateMetadata(parsedMetadata) {
    const original = parsedMetadata || {};
    const out = {};
    // Preserve every key EXCEPT `language` (which is replaced by
    // screenplayProfile). Unknown keys pass through.
    Object.keys(original).forEach(function(key) {
      if (key === 'language') return;
      out[key] = original[key];
    });
    out.screenplayProfile = _deriveScreenplayProfile(original);
    return out;
  }

  function migrateV2toV3(parsed) {
    if (!parsed || typeof parsed !== 'object') return parsed;
    const out = Object.assign({}, parsed);
    out.rga_version = '3.0';
    out.metadata = _migrateMetadata(parsed.metadata);
    if (parsed.body) out.body = _migrateBodyTree(parsed.body);
    return out;
  }

  Rga.Migrations._steps.v2toV3 = migrateV2toV3;
  // Internal helpers exposed for unit tests.
  Rga.Migrations._steps._v2toV3_sceneFrameToScene = _sceneFrameToScene;
  Rga.Migrations._steps._v2toV3_derivePresetType = _derivePresetType;
  Rga.Migrations._steps._v2toV3_wrapParentheticalContent = _wrapParentheticalContent;
  Rga.Migrations._steps._v2toV3_deriveScreenplayProfile = _deriveScreenplayProfile;
  Rga.Migrations._steps._v2toV3_isAlreadyParenWrapped = _isAlreadyParenWrapped;
})();
