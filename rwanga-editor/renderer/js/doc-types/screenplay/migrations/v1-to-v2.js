// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// v1.x → v2.0 migration — pure JSON → JSON.
//
// Sources the same logic as the legacy in-file helpers in doc.js
// (_migrateScenesToFrames + _migrateSceneLineLocations). doc.js stays
// untouched per Phase 2 scope ("no legacy cleanup"); both implementations
// coexist temporarily and the framework calls THIS one.
//
// Transforms:
//   - Top-level body `scene` nodes (v1.x shape) → `sceneFrame` atoms (v2.0)
//     attrs.id / number / headingStyle copy across; attrs.notes /
//     revisionFlag move into innerDoc.attrs; child blocks become
//     innerDoc.content; the inner sceneLine has its location attr migrated
//     to text content (see below).
//   - `sceneLine.attrs.location` (v1.x flat string) → `sceneLine.content`
//     (v2.0 inline text). setting + time remain in attrs.
//   - Bumps rga_version to "2.0".
//
// Contract: input JSON object → output JSON object. No mutation of input.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Migrations = Rga.Migrations || {};
  Rga.Migrations._steps = Rga.Migrations._steps || {};

  function _migrateSceneLineLocations(node) {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'sceneLine' && node.attrs && node.attrs.location !== undefined) {
      const locationText = node.attrs.location;
      const newAttrs = {};
      if (node.attrs.setting !== undefined) newAttrs.setting = node.attrs.setting;
      if (node.attrs.time !== undefined) newAttrs.time = node.attrs.time;
      const newContent = locationText ? [{ type: 'text', text: locationText }] : [];
      return { type: 'sceneLine', attrs: newAttrs, content: newContent };
    }
    let out = node;
    if (Array.isArray(node.content)) {
      out = Object.assign({}, out, { content: node.content.map(_migrateSceneLineLocations) });
    }
    if (out.attrs && out.attrs.innerDoc) {
      out = Object.assign({}, out, {
        attrs: Object.assign({}, out.attrs, {
          innerDoc: _migrateSceneLineLocations(out.attrs.innerDoc)
        })
      });
    }
    return out;
  }

  function _migrateScenesToFrames(node) {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'scene') {
      const oldAttrs = node.attrs || {};
      const migratedContent = Array.isArray(node.content)
        ? node.content.map(_migrateSceneLineLocations)
        : [];
      return {
        type: 'sceneFrame',
        attrs: {
          id:           oldAttrs.id           || null,
          number:       oldAttrs.number       || null,
          headingStyle: oldAttrs.headingStyle || null,
          innerDoc: {
            type: 'doc',
            attrs: {
              notes:        oldAttrs.notes        || '',
              revisionFlag: oldAttrs.revisionFlag || null
            },
            content: migratedContent
          }
        }
      };
    }
    if (Array.isArray(node.content)) {
      return Object.assign({}, node, { content: node.content.map(_migrateScenesToFrames) });
    }
    return node;
  }

  function migrateV1toV2(parsed) {
    if (!parsed || typeof parsed !== 'object') return parsed;
    const out = Object.assign({}, parsed);
    if (parsed.body) {
      const sceneMigrated = _migrateScenesToFrames(parsed.body);
      out.body = _migrateSceneLineLocations(sceneMigrated);
    }
    out.rga_version = '2.0';
    return out;
  }

  Rga.Migrations._steps.v1toV2 = migrateV1toV2;
  // Internal helpers exposed for tests.
  Rga.Migrations._steps._v1toV2_migrateScenesToFrames = _migrateScenesToFrames;
  Rga.Migrations._steps._v1toV2_migrateSceneLineLocations = _migrateSceneLineLocations;
})();
