// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Screenplay.Memory — RGA Memory Layer Phase 1 (Scene Occurrence Foundation).
// Design: docs/Filmustageation/RGA_MEMORY_LAYER_PHASE1_DESIGN.md (approved D1–D5).
//
// The derived-memory facade: the read-only layer that lets a screenplay
// document answer questions about itself ("who is tagged in scene 3",
// "which scenes has NALI been tagged in", "who speaks in scene 4").
//
// Architectural contract (design §5):
//   - MEMORY READS. MEMORY NEVER WRITES. No persistence, no schema surface,
//     no .rga change, no registry access (only the index's resolved copies).
//   - nav-index moratorium honored: framework/nav-index.js is untouched;
//     this module consumes Rga.Nav.getIndex output, never modifies the walk.
//   - Contamination triad honored: Rga.Doc.tagRegistry / addEntity /
//     schema.marks.tag are never referenced.
//   - Scene bundles delegate to Rga.Screenplay.SceneCatalog (SN-Helper-1,
//     untouched). Memory is the stable consumer-facing contract; SceneCatalog
//     is its building block.
//   - Cue derivation (D1): lazy scene-scoped sub-walk on demand, memoised per
//     (doc, sceneId). Never runs on the typing path — only when a consumer
//     asks. Not a document walk; a walk of one scene's subtree.
//   - All returns are freshly allocated. Mutating a returned bundle/array
//     never reaches back into the index or the memo cache.
//
// Tier vocabulary (audit §8, reserved for future phases):
//   'tagged'   — explicit tag mark with entityId        (Phase 1 emits this)
//   'untagged' — cue block with no character tag mark   (Phase 1 emits this)
//   'matched'  — registry-name text match, unconfirmed  (future phase)
//   'inferred' — pronoun/alias/AI inference             (future phase)
//
// Public API (design §4.3):
//   Memory.scene(sceneId, idx, doc?)          → SceneBundle (+ cues | null)
//   Memory.cuesForScene(sceneId, idx, doc)    → Cue[] | null
//   Memory.entity(tagType, entityId, idx)     → EntityBundle | null
//   Memory.entities(idx)                      → { characters:[], props:[], … all 9 }
//   Memory.coverage(idx, doc?)                → CoverageReport
//
// Null semantics (deliberate, design §4.3 + §8):
//   null  = "could not derive" (missing doc, unknown scene, unknown entity)
//   []    = "derived: there are none"
//   These are different answers and consumers must be able to tell them apart.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Screenplay = Rga.Screenplay || {};

  // Bundle-key ↔ tagType map. Single source of truth is SceneCatalog's
  // exported _TAG_KEY_MAP (itself mirroring nav-index TAG_TYPES); the local
  // fallback covers isolated test boots where load order differs.
  const FALLBACK_TAG_KEY_MAP = [
    { bundleKey: 'characters', tagType: 'character' },
    { bundleKey: 'props',      tagType: 'prop'      },
    { bundleKey: 'wardrobe',   tagType: 'wardrobe'  },
    { bundleKey: 'locations',  tagType: 'location'  },
    { bundleKey: 'sfx',        tagType: 'sfx'       },
    { bundleKey: 'vfx',        tagType: 'vfx'       },
    { bundleKey: 'vehicles',   tagType: 'vehicle'   },
    { bundleKey: 'animals',    tagType: 'animal'    },
    { bundleKey: 'custom',     tagType: 'custom'    }
  ];
  function _tagKeyMap() {
    const SC = Rga.Screenplay.SceneCatalog;
    return (SC && Array.isArray(SC._TAG_KEY_MAP)) ? SC._TAG_KEY_MAP : FALLBACK_TAG_KEY_MAP;
  }

  // ----------------------------------------------------------------
  // Cue memo — WeakMap<pmDoc, Map<sceneId, Cue[]>>.
  // PM docs are immutable: every doc-changing transaction produces a new
  // doc object, so old cache entries become unreachable and are GC'd.
  // The cache stores the canonical cue arrays; every public return is a
  // fresh copy so consumers can never corrupt the cache.
  // ----------------------------------------------------------------
  const _cueMemo = new WeakMap();

  function _copyCues(cues) {
    const out = [];
    for (let i = 0; i < cues.length; i += 1) {
      const c = cues[i];
      out.push({
        text:       c.text,
        entityId:   c.entityId,
        entityName: c.entityName,
        tier:       c.tier,
        blockIndex: c.blockIndex
      });
    }
    return out;
  }

  // First text descendant of a block node — same notion nav-index uses to
  // decide which entity a cue belongs to (the mark on the first text run).
  function _firstTextChild(blockNode) {
    let found = null;
    blockNode.descendants(function(n) {
      if (found) return false;
      if (n.isText) { found = n; return false; }
      return true;
    });
    return found;
  }

  function _characterTagEntityId(textNode) {
    if (!textNode || !Array.isArray(textNode.marks)) return null;
    for (let i = 0; i < textNode.marks.length; i += 1) {
      const m = textNode.marks[i];
      if (m && m.type && m.type.name === 'tag'
          && m.attrs && m.attrs.tagType === 'character' && m.attrs.entityId) {
        return m.attrs.entityId;
      }
    }
    return null;
  }

  function _entityNameFromIndex(idx, tagType, entityId) {
    if (!idx || !idx.tags || !Array.isArray(idx.tags[tagType])) return null;
    const arr = idx.tags[tagType];
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i] && arr[i].nodeId === entityId) {
        return arr[i].name == null ? null : arr[i].name;
      }
    }
    return null;
  }

  function _findSceneEntry(idx, sceneId) {
    if (!idx || !Array.isArray(idx.scenes)) return null;
    for (let i = 0; i < idx.scenes.length; i += 1) {
      const s = idx.scenes[i];
      if (s && s.nodeId === sceneId) return s;
    }
    return null;
  }

  // ----------------------------------------------------------------
  // cuesForScene(sceneId, idx, doc) → Cue[] | null
  // ----------------------------------------------------------------
  function cuesForScene(sceneId, idx, doc) {
    if (!sceneId || typeof sceneId !== 'string') return null;
    if (!doc || typeof doc.nodeAt !== 'function') return null;
    const scene = _findSceneEntry(idx, sceneId);
    if (!scene || typeof scene.pmPos !== 'number') return null;

    // Memo hit → fresh copy of the cached canonical array.
    let perDoc = _cueMemo.get(doc);
    if (perDoc && perDoc.has(sceneId)) return _copyCues(perDoc.get(sceneId));

    const sceneNode = doc.nodeAt(scene.pmPos);
    if (!sceneNode || !sceneNode.type || sceneNode.type.name !== 'scene') return null;

    // The lazy scene-scoped sub-walk (D1): only this scene's direct children.
    const cues = [];
    sceneNode.forEach(function(child, _offset, index) {
      if (!child.type || child.type.name !== 'character') return;
      const entityId = _characterTagEntityId(_firstTextChild(child));
      cues.push({
        text:       child.textContent || '',
        entityId:   entityId,
        entityName: entityId ? _entityNameFromIndex(idx, 'character', entityId) : null,
        tier:       entityId ? 'tagged' : 'untagged',
        blockIndex: index
      });
    });

    if (!perDoc) { perDoc = new Map(); _cueMemo.set(doc, perDoc); }
    perDoc.set(sceneId, cues);
    return _copyCues(cues);
  }

  // ----------------------------------------------------------------
  // scene(sceneId, idx, doc?) → SceneBundle (+ cues)
  // ----------------------------------------------------------------
  function scene(sceneId, idx, doc) {
    const SC = Rga.Screenplay.SceneCatalog;
    if (!SC || typeof SC.byScene !== 'function') return null;  // load-order guard
    const bundle = SC.byScene(sceneId, idx);
    // cues: null = "not derived" (no doc / unknown scene); [] = "derived, none".
    bundle.cues = doc ? cuesForScene(sceneId, idx, doc) : null;
    return bundle;
  }

  // ----------------------------------------------------------------
  // entity(tagType, entityId, idx) → EntityBundle | null
  // ----------------------------------------------------------------
  function _entityBundle(ent, tagType, cueCounts) {
    return {
      entityId:     ent.nodeId,
      tagType:      tagType,
      name:         ent.name  == null ? null : ent.name,
      color:        ent.color == null ? null : ent.color,
      mentionCount: typeof ent.mentionCount === 'number' ? ent.mentionCount : 0,
      // cueCount is a character-only concept; null (not 0) for other types.
      cueCount:     tagType === 'character'
                      ? (cueCounts.has(ent.nodeId) ? cueCounts.get(ent.nodeId) : 0)
                      : null,
      sceneIds:     Array.isArray(ent.sceneAppearances) ? ent.sceneAppearances.slice() : []
    };
  }

  function _cueCountLookup(idx) {
    const map = new Map();
    if (idx && Array.isArray(idx.characters)) {
      for (let i = 0; i < idx.characters.length; i += 1) {
        const c = idx.characters[i];
        if (c && c.nodeId) map.set(c.nodeId, typeof c.cueCount === 'number' ? c.cueCount : 0);
      }
    }
    return map;
  }

  function entity(tagType, entityId, idx) {
    if (!tagType || !entityId || !idx || !idx.tags) return null;
    const arr = idx.tags[tagType];
    if (!Array.isArray(arr)) return null;
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i] && arr[i].nodeId === entityId) {
        return _entityBundle(arr[i], tagType, _cueCountLookup(idx));
      }
    }
    return null;
  }

  // ----------------------------------------------------------------
  // entities(idx) → { characters: [], props: [], … all 9 plural keys }
  // ----------------------------------------------------------------
  function entities(idx) {
    const out = {};
    const map = _tagKeyMap();
    const cueCounts = _cueCountLookup(idx);
    for (let i = 0; i < map.length; i += 1) {
      const m = map[i];
      const arr = (idx && idx.tags && Array.isArray(idx.tags[m.tagType])) ? idx.tags[m.tagType] : [];
      const bundles = [];
      for (let j = 0; j < arr.length; j += 1) {
        if (arr[j]) bundles.push(_entityBundle(arr[j], m.tagType, cueCounts));
      }
      out[m.bundleKey] = bundles;
    }
    return out;
  }

  // ----------------------------------------------------------------
  // coverage(idx, doc?) → CoverageReport
  // The honesty metrics: how much does the script know about itself,
  // and where are the gaps (orphan entities, untagged cues).
  // ----------------------------------------------------------------
  function coverage(idx, doc) {
    const scenes = (idx && Array.isArray(idx.scenes)) ? idx.scenes : [];
    const map = _tagKeyMap();

    const taggedSceneIds = new Set();
    const orphans = [];
    for (let i = 0; i < map.length; i += 1) {
      const m = map[i];
      const arr = (idx && idx.tags && Array.isArray(idx.tags[m.tagType])) ? idx.tags[m.tagType] : [];
      for (let j = 0; j < arr.length; j += 1) {
        const ent = arr[j];
        if (!ent) continue;
        const apps = Array.isArray(ent.sceneAppearances) ? ent.sceneAppearances : [];
        if (apps.length === 0) {
          orphans.push({
            tagType:  m.tagType,
            entityId: ent.nodeId,
            name:     ent.name == null ? null : ent.name
          });
        } else {
          for (let k = 0; k < apps.length; k += 1) taggedSceneIds.add(apps[k]);
        }
      }
    }

    let scenesWithNotes = 0;
    let scenesWithFlags = 0;
    for (let i = 0; i < scenes.length; i += 1) {
      if (scenes[i] && scenes[i].hasNotes) scenesWithNotes += 1;
      if (scenes[i] && scenes[i].hasRevisionFlag) scenesWithFlags += 1;
    }

    // Cue metrics require the doc (lazy scene walks). null = "not derived".
    let cueBlocks = null;
    let taggedCueBlocks = null;
    if (doc && typeof doc.nodeAt === 'function') {
      cueBlocks = 0;
      taggedCueBlocks = 0;
      for (let i = 0; i < scenes.length; i += 1) {
        const cues = scenes[i] ? cuesForScene(scenes[i].nodeId, idx, doc) : null;
        if (!cues) continue;
        cueBlocks += cues.length;
        for (let j = 0; j < cues.length; j += 1) {
          if (cues[j].tier === 'tagged') taggedCueBlocks += 1;
        }
      }
    }

    return {
      sceneCount:      scenes.length,
      scenesWithTags:  taggedSceneIds.size,
      scenesWithNotes: scenesWithNotes,
      scenesWithFlags: scenesWithFlags,
      orphanEntities:  orphans,
      cueBlocks:       cueBlocks,
      taggedCueBlocks: taggedCueBlocks
    };
  }

  Rga.Screenplay.Memory = {
    scene:        scene,
    cuesForScene: cuesForScene,
    entity:       entity,
    entities:     entities,
    coverage:     coverage
  };
})();
