// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Screenplay.SceneCatalog — Filmustageation SN-Helper-1.
//
// Read-only scene-level projection over the screenplay NavigationIndex.
// Given a sceneNodeId + an index (Rga.Nav.getIndex), returns a single
// flat bundle of everything the screenplay surfaces (sidebar / inspector
// / timeline / print / MCP / AI) need to know about that one scene.
//
// Architectural contract:
//   - PURE READ. Never mutates the input idx, the registry behind it, or
//     anything else. Output is freshly allocated; consumers mutating
//     the returned bundle do not reach back into nav-index.
//   - NO PERSISTENCE. Consumes only fields nav-index already projects
//     (idx.scenes, idx.notes, idx.flags, idx.tags, idx.pages). Adds no
//     storage, no schema, no .rga surface.
//   - NO NAV-INDEX MODIFICATION. The data this helper exposes is already
//     computed during nav-index's single per-walk pass (per-entity
//     sceneAppearances Set, per-mark sceneNodeId backlink, per-page
//     sceneIds list). The helper is the inverse projection — turning
//     per-entity-keyed data into a per-scene view — not a re-walk.
//   - LIVES IN doc-types/screenplay/. The output shape's tag-key names
//     (characters / props / wardrobe / locations / sfx / vfx / vehicles
//     / animals / custom) are screenplay-shaped. A future doc-type with
//     a different production vocabulary will author its own catalog
//     module under its own doc-types/<plugin>/ tree.
//
// Public API:
//   Rga.Screenplay.SceneCatalog.byScene(sceneNodeId, idx) → SceneBundle
//
// SceneBundle shape (every field always present; arrays may be empty
// but are never undefined — consumers can render unconditionally):
//   {
//     sceneId:      string | null,
//     sceneNumber:  number | null,
//     title:        string,
//     notes:        Note[],
//     flags:        Flag[],
//     characters:   Entity[],
//     props:        Entity[],
//     wardrobe:     Entity[],
//     locations:    Entity[],
//     sfx:          Entity[],
//     vfx:          Entity[],
//     vehicles:     Entity[],
//     animals:      Entity[],
//     custom:       Entity[],
//     pageInfo:     { pageNumber: number | null }
//   }
//
// When the helper is called with a falsy/non-string sceneNodeId or with
// a missing/malformed idx, the empty bundle is returned (scalars null,
// arrays empty, title ''). When the sceneNodeId is well-formed but not
// found in the index, the bundle echoes sceneId so a consumer rendering
// "what's in scene X" can still title its surface honestly while
// reporting nothing else.
//
// Performance note: each byScene call is O(N_notes + N_flags + E_total
// + N_pages) per scene. For a typical 60-scene screenplay with ~50
// entities across 9 tagTypes, this is sub-millisecond per scene; a
// nested sidebar rendering 60 rows is still ~30ms total per render —
// well inside the calm-render budget. Memoisation against idx identity
// can be added later if a hot consumer needs it.

'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Screenplay = Rga.Screenplay || {};

  // Output-bundle key → nav-index tag-type key. The bundle uses the
  // plural/registry names (characters, props, locations, vehicles,
  // animals); nav-index uses the singular tagTypes (character, prop,
  // location, vehicle, animal). The other keys (wardrobe, sfx, vfx,
  // custom) are spelled identically in both layers.
  // Source of truth: nav-index.js `TAG_TYPES` + `REGISTRY_KEY` arrays.
  const TAG_KEY_MAP = [
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

  function _emptyBundle() {
    const bundle = {
      sceneId:     null,
      sceneNumber: null,
      title:       '',
      notes:       [],
      flags:       [],
      pageInfo:    { pageNumber: null }
    };
    for (let i = 0; i < TAG_KEY_MAP.length; i += 1) {
      bundle[TAG_KEY_MAP[i].bundleKey] = [];
    }
    return bundle;
  }

  function _findScene(idx, sceneNodeId) {
    if (!idx || !Array.isArray(idx.scenes)) return null;
    for (let i = 0; i < idx.scenes.length; i += 1) {
      const s = idx.scenes[i];
      if (s && s.nodeId === sceneNodeId) return s;
    }
    return null;
  }

  function _pageInfoFor(idx, sceneNodeId) {
    if (!idx || !Array.isArray(idx.pages)) return { pageNumber: null };
    for (let i = 0; i < idx.pages.length; i += 1) {
      const pg = idx.pages[i];
      if (pg && Array.isArray(pg.sceneIds) && pg.sceneIds.indexOf(sceneNodeId) >= 0) {
        return { pageNumber: pg.pageNumber == null ? null : pg.pageNumber };
      }
    }
    return { pageNumber: null };
  }

  function _notesFor(idx, sceneNodeId) {
    if (!idx || !Array.isArray(idx.notes)) return [];
    const out = [];
    for (let i = 0; i < idx.notes.length; i += 1) {
      const n = idx.notes[i];
      if (n && n.sceneNodeId === sceneNodeId) {
        // Shallow copy so consumers mutating the bundle do not reach
        // back into the nav-index storage.
        out.push({
          id:          n.id,
          color:       n.color  == null ? null : n.color,
          text:        n.text   || '',
          status:      n.status || 'open',
          sceneNodeId: n.sceneNodeId,
          sceneNumber: n.sceneNumber,
          markedText:  n.markedText || ''
        });
      }
    }
    return out;
  }

  function _flagsFor(idx, sceneNodeId) {
    if (!idx || !Array.isArray(idx.flags)) return [];
    const out = [];
    for (let i = 0; i < idx.flags.length; i += 1) {
      const f = idx.flags[i];
      if (f && f.sceneNodeId === sceneNodeId) {
        out.push({
          id:          f.id,
          color:       f.color == null ? null : f.color,
          reason:      f.reason || '',
          status:      f.status || 'open',
          sceneNodeId: f.sceneNodeId,
          sceneNumber: f.sceneNumber,
          markedText:  f.markedText || ''
        });
      }
    }
    return out;
  }

  function _entitiesForTagType(idx, tagType, sceneNodeId) {
    if (!idx || !idx.tags || !Array.isArray(idx.tags[tagType])) return [];
    const out = [];
    const arr = idx.tags[tagType];
    for (let i = 0; i < arr.length; i += 1) {
      const ent = arr[i];
      if (!ent || !Array.isArray(ent.sceneAppearances)) continue;
      if (ent.sceneAppearances.indexOf(sceneNodeId) < 0) continue;
      // Shallow copy + slice the inner array so the bundle owns its
      // storage. nav-index's sceneAppearances array is preserved.
      out.push({
        nodeId:           ent.nodeId,
        name:             ent.name  == null ? null : ent.name,
        color:            ent.color == null ? null : ent.color,
        mentionCount:     typeof ent.mentionCount === 'number' ? ent.mentionCount : 0,
        sceneAppearances: ent.sceneAppearances.slice()
      });
    }
    return out;
  }

  // ----------------------------------------------------------------
  // Public — byScene(sceneNodeId, idx)
  // ----------------------------------------------------------------
  function byScene(sceneNodeId, idx) {
    // Defensive: missing/empty/non-string sceneNodeId, or missing idx,
    // returns the stable empty bundle. Consumers may call byScene from
    // boot paths where nav-index is not yet built and should still
    // receive a renderable shape.
    if (!sceneNodeId || typeof sceneNodeId !== 'string') return _emptyBundle();
    const scene = _findScene(idx, sceneNodeId);
    if (!scene) {
      // sceneNodeId is well-formed but not in the index — echo the id
      // so the consumer surface ("what's in scene X") can still title
      // itself honestly while reporting nothing else.
      const empty = _emptyBundle();
      empty.sceneId = sceneNodeId;
      return empty;
    }
    const bundle = _emptyBundle();
    bundle.sceneId     = scene.nodeId;
    bundle.sceneNumber = (typeof scene.sceneNumber === 'number') ? scene.sceneNumber : null;
    bundle.title       = scene.headingDisplay || '';
    bundle.notes       = _notesFor(idx, sceneNodeId);
    bundle.flags       = _flagsFor(idx, sceneNodeId);
    for (let i = 0; i < TAG_KEY_MAP.length; i += 1) {
      const m = TAG_KEY_MAP[i];
      bundle[m.bundleKey] = _entitiesForTagType(idx, m.tagType, sceneNodeId);
    }
    bundle.pageInfo = _pageInfoFor(idx, sceneNodeId);
    return bundle;
  }

  Rga.Screenplay.SceneCatalog = {
    byScene:      byScene,
    _TAG_KEY_MAP: TAG_KEY_MAP   // read-only export for tests + future helpers
  };
})();
