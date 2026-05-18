// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Navigation index — doc-derived structural index used by scene
// numbering, navigator/explorer panes, AI context, and pagination.
//
// Phase 4 origin: scene-number derivation via NodeDecoration.
// Phase 5 extension: richer per-scene metadata + characters, tags
// (grouped by type), pages (placeholder, populated by Phase 6 pagination),
// notes, flags. Spec: docs/phase0-final-schema-contract.md §6.1.
//
// Public API:
//   Rga.Nav.buildIndex(doc, opts?)  → NavigationIndex
//     opts: { tagRegistry?: doc.tagRegistry }  // resolves entity names+colors
//   Rga.Nav.buildIndexPlugin()      → PM Plugin (maintains index in state,
//                                     emits NodeDecorations carrying sceneNumber)
//   Rga.Nav.getIndex(state)         → NavigationIndex | null
//   Rga.Nav.readNumberFromDecorations(decorations) → number | null
//   Rga.Nav.findScene(doc, nodeId)  → pmPos | null   (stable id → ephemeral pos)
//
// NavigationIndex shape (per Phase 0 contract §6.1 + Phase 5 additions):
//   {
//     scenes: [
//       { nodeId, sceneNumber, pmPos, pmEndPos,
//         headingDisplay, setting, locationText, time,
//         transitionDisplay, transitionPresetType,
//         blockCount, hasNotes, hasRevisionFlag }, ...
//     ],
//     characters: [{ nodeId, name, color, cueCount, mentionCount, sceneAppearances }, ...],
//     tags: { character:[], prop:[], wardrobe:[], location:[],
//             sfx:[], vfx:[], vehicle:[], animal:[], custom:[] },
//     pages: [],                                // populated by Phase 6
//     notes: [{ id, color, text, status, sceneNodeId, sceneNumber, markedText }, ...],
//     flags: [{ id, color, reason, status, sceneNodeId, sceneNumber, markedText }, ...],
//     byPos: Map<pmPos, sceneNumber>,
//     byId:  Map<nodeId, sceneNumber>
//   }
//
// Stability rules (§6.1):
//   - nodeId / entityId — STABLE across edits
//   - pmPos / pmEndPos / sceneNumber — EPHEMERAL; only valid for the doc
//     state at the moment the index was built. Consumers that need to
//     jump-later should store nodeId then resolve via findScene().
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Nav = Rga.Nav || {};

  const TAG_TYPES = [
    'character', 'prop', 'wardrobe', 'location',
    'sfx', 'vfx', 'vehicle', 'animal', 'custom'
  ];
  // Map tag-mark tagType → tag_registry key (the registry uses
  // plural keys in some categories; mirrors doc.js `_registryKey`).
  const REGISTRY_KEY = {
    character: 'characters', prop: 'props', wardrobe: 'wardrobe',
    location: 'locations', sfx: 'sfx', vfx: 'vfx',
    vehicle: 'vehicles', animal: 'animals', custom: 'custom'
  };

  // ----------------------------------------------------------------
  // Pure index builder
  // ----------------------------------------------------------------
  function buildIndex(doc, opts) {
    const tagRegistry = (opts && opts.tagRegistry) || null;
    const result = _emptyIndex();
    if (!doc || typeof doc.descendants !== 'function') return result;

    // Track per-entity cue/mention/scene-appearance counts during the walk.
    const charCueCount = new Map();           // entityId → count
    const tagMentionCount = new Map();        // 'tagType:entityId' → count
    const tagSceneAppearances = new Map();    // 'tagType:entityId' → Set<sceneNodeId>
    const seenAnnotationIds = new Set();
    const seenFlagIds = new Set();

    let sceneNumber = 0;
    let currentScene = null;       // mutable rolling state during walk

    doc.descendants(function(node, pos, parent) {
      // ---- 1. Scenes ----
      if (node.type && node.type.name === 'scene') {
        sceneNumber += 1;
        const sceneEntry = _buildSceneEntry(node, pos, sceneNumber);
        result.scenes.push(sceneEntry);
        result.byPos.set(pos, sceneNumber);
        if (sceneEntry.nodeId) result.byId.set(sceneEntry.nodeId, sceneNumber);
        currentScene = sceneEntry;
        return true; // descend to collect inner marks against this scene
      }

      // ---- 2. Character cue blocks (for character.cueCount) ----
      if (node.type && node.type.name === 'character' && parent && parent.type && parent.type.name === 'scene') {
        // A character cue counts toward the entity whose tag-mark covers
        // the first text fragment in this block.
        const firstText = _firstTextChild(node);
        if (firstText) {
          const charMark = _findMarkOfType(firstText, 'tag');
          if (charMark && charMark.attrs && charMark.attrs.tagType === 'character' && charMark.attrs.entityId) {
            const id = charMark.attrs.entityId;
            charCueCount.set(id, (charCueCount.get(id) || 0) + 1);
          }
        }
      }

      // ---- 3. Text-mark scanning (annotations, tags, flags) ----
      if (node.isText && Array.isArray(node.marks) && node.marks.length > 0) {
        for (let i = 0; i < node.marks.length; i += 1) {
          const m = node.marks[i];
          if (!m || !m.type || !m.attrs) continue;
          if (m.type.name === 'annotation') {
            if (!seenAnnotationIds.has(m.attrs.id)) {
              seenAnnotationIds.add(m.attrs.id);
              result.notes.push({
                id:           m.attrs.id,
                color:        m.attrs.color || null,
                text:         m.attrs.text  || '',
                status:       m.attrs.status || 'open',
                sceneNodeId:  currentScene ? currentScene.nodeId : null,
                sceneNumber:  currentScene ? currentScene.sceneNumber : null,
                markedText:   _firstMarkText(doc, 'annotation', m.attrs.id) || node.text || ''
              });
              if (currentScene) currentScene.hasNotes = true;
            }
          } else if (m.type.name === 'revisionFlag') {
            if (!seenFlagIds.has(m.attrs.id)) {
              seenFlagIds.add(m.attrs.id);
              result.flags.push({
                id:           m.attrs.id,
                color:        m.attrs.color || null,
                reason:       m.attrs.reason || '',
                status:       m.attrs.status || 'open',
                sceneNodeId:  currentScene ? currentScene.nodeId : null,
                sceneNumber:  currentScene ? currentScene.sceneNumber : null,
                markedText:   _firstMarkText(doc, 'revisionFlag', m.attrs.id) || node.text || ''
              });
              if (currentScene) currentScene.hasRevisionFlag = true;
            }
          } else if (m.type.name === 'tag') {
            const tagType = m.attrs.tagType;
            const entityId = m.attrs.entityId;
            if (tagType && entityId) {
              const key = tagType + ':' + entityId;
              tagMentionCount.set(key, (tagMentionCount.get(key) || 0) + 1);
              if (currentScene && currentScene.nodeId) {
                if (!tagSceneAppearances.has(key)) tagSceneAppearances.set(key, new Set());
                tagSceneAppearances.get(key).add(currentScene.nodeId);
              }
            }
          }
        }
      }
      return true;
    });

    // ---- 4. Compose characters + tags-by-type using registry + counts ----
    _composeTagsAndCharacters(result, tagRegistry, charCueCount, tagMentionCount, tagSceneAppearances);

    return result;
  }

  function _emptyIndex() {
    const tags = {};
    TAG_TYPES.forEach(function(t) { tags[t] = []; });
    return {
      scenes: [],
      characters: [],
      tags: tags,
      pages: [],          // populated by Phase 6 pagination
      notes: [],
      flags: [],
      byPos: new Map(),
      byId:  new Map()
    };
  }

  function _buildSceneEntry(sceneNode, pos, sceneNumber) {
    const heading = _firstChildOfType(sceneNode, 'sceneHeading');
    const transition = _lastChildOfType(sceneNode, 'transition');
    const setting = heading && heading.attrs ? heading.attrs.setting || '' : '';
    const time    = heading && heading.attrs ? heading.attrs.time    || '' : '';
    const locationText = heading ? _textOf(heading) : '';
    const transitionDisplay = transition ? _textOf(transition) : '';
    const transitionPresetType = transition && transition.attrs ? transition.attrs.presetType : null;
    // Mid-blocks = total children minus heading + transition.
    const blockCount = Math.max(0, sceneNode.childCount - (heading ? 1 : 0) - (transition ? 1 : 0));
    const sceneNotes = sceneNode.attrs && sceneNode.attrs.notes;
    const sceneRev   = sceneNode.attrs && sceneNode.attrs.revisionFlag;
    return {
      nodeId:               sceneNode.attrs && sceneNode.attrs.id ? String(sceneNode.attrs.id) : null,
      sceneNumber:          sceneNumber,
      pmPos:                pos,
      pmEndPos:             pos + sceneNode.nodeSize,
      headingDisplay:       _composeHeadingDisplay(setting, locationText, time),
      setting:              setting,
      locationText:         locationText,
      time:                 time,
      transitionDisplay:    transitionDisplay,
      transitionPresetType: transitionPresetType || null,
      blockCount:           blockCount,
      hasNotes:             !!(sceneNotes && String(sceneNotes).length > 0),
      hasRevisionFlag:      sceneRev != null
    };
  }

  function _composeHeadingDisplay(setting, locationText, time) {
    const parts = [];
    if (setting) parts.push(setting);
    if (locationText) parts.push(locationText);
    let head = parts.join(' ');
    if (time) head += (head ? ' — ' : '') + time;
    return head;
  }

  function _firstChildOfType(node, typeName) {
    if (!node || !node.childCount) return null;
    for (let i = 0; i < node.childCount; i += 1) {
      const c = node.child(i);
      if (c.type && c.type.name === typeName) return c;
    }
    return null;
  }
  function _lastChildOfType(node, typeName) {
    if (!node || !node.childCount) return null;
    for (let i = node.childCount - 1; i >= 0; i -= 1) {
      const c = node.child(i);
      if (c.type && c.type.name === typeName) return c;
    }
    return null;
  }
  function _textOf(node) {
    if (!node || typeof node.textContent !== 'string') return '';
    return node.textContent;
  }
  function _firstTextChild(node) {
    if (!node || !node.childCount) return null;
    for (let i = 0; i < node.childCount; i += 1) {
      const c = node.child(i);
      if (c.isText) return c;
    }
    return null;
  }
  function _findMarkOfType(textNode, typeName) {
    if (!textNode || !Array.isArray(textNode.marks)) return null;
    for (let i = 0; i < textNode.marks.length; i += 1) {
      const m = textNode.marks[i];
      if (m && m.type && m.type.name === typeName) return m;
    }
    return null;
  }
  function _firstMarkText(doc, markTypeName, markId) {
    let out = '';
    doc.descendants(function(n) {
      if (out) return false;
      if (n.isText && Array.isArray(n.marks)) {
        for (let i = 0; i < n.marks.length; i += 1) {
          const m = n.marks[i];
          if (m && m.type && m.type.name === markTypeName && m.attrs && m.attrs.id === markId) {
            out = n.text || '';
            return false;
          }
        }
      }
      return true;
    });
    return out;
  }

  function _composeTagsAndCharacters(result, registry, charCueCount, tagMentionCount, tagSceneAppearances) {
    // Collect all (tagType, entityId) pairs seen anywhere — either from
    // marks during the walk, or from the registry directly (so a registry
    // entry shows up even if not yet tagged in body).
    const seenKeys = new Set();
    tagMentionCount.forEach(function(_v, k) { seenKeys.add(k); });

    if (registry) {
      TAG_TYPES.forEach(function(type) {
        const regKey = REGISTRY_KEY[type] || type;
        const list = registry[regKey] || [];
        for (let i = 0; i < list.length; i += 1) {
          const ent = list[i];
          if (ent && ent.id) seenKeys.add(type + ':' + ent.id);
        }
      });
    }

    seenKeys.forEach(function(key) {
      const colon = key.indexOf(':');
      const tagType = key.slice(0, colon);
      const entityId = key.slice(colon + 1);
      const ent = _resolveEntity(registry, tagType, entityId);
      const mentionCount = tagMentionCount.get(key) || 0;
      const scenes = tagSceneAppearances.get(key);
      const sceneAppearances = scenes ? Array.from(scenes) : [];
      const entry = {
        nodeId:           entityId,
        name:             ent ? (ent.name || null) : null,
        color:            ent ? (ent.color || null) : null,
        mentionCount:     mentionCount,
        sceneAppearances: sceneAppearances
      };
      if (tagType === 'character') {
        // characters convenience array uses cueCount, not mentionCount alone.
        const cueCount = charCueCount.get(entityId) || 0;
        result.characters.push(Object.assign({ cueCount: cueCount }, entry));
      }
      if (result.tags[tagType]) result.tags[tagType].push(entry);
    });
  }

  function _resolveEntity(registry, tagType, entityId) {
    if (!registry) return null;
    const regKey = REGISTRY_KEY[tagType] || tagType;
    const list = registry[regKey];
    if (!Array.isArray(list)) return null;
    for (let i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].id === entityId) return list[i];
    }
    return null;
  }

  // ----------------------------------------------------------------
  // Stable nodeId → ephemeral pmPos resolver
  // ----------------------------------------------------------------
  function findScene(doc, nodeId) {
    if (!doc || !nodeId || typeof doc.descendants !== 'function') return null;
    let pos = null;
    doc.descendants(function(node, p) {
      if (pos != null) return false;
      if (node.type && node.type.name === 'scene' && node.attrs && String(node.attrs.id) === String(nodeId)) {
        pos = p;
        return false;
      }
      return true;
    });
    return pos;
  }

  // ----------------------------------------------------------------
  // Decoration builder — NodeDecorations per scene carrying sceneNumber,
  // plus widget Decorations marking PageMap page breaks (Flow view only;
  // CSS hides them under .view-print-active / .view-draft-active).
  // ----------------------------------------------------------------
  function buildDecorations(index, doc, pageMap, normalizedBlocks) {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.Decoration || !PM.DecorationSet) return null;
    const decos = [];
    // 1. Scene-number NodeDecorations (Phase 4).
    for (let i = 0; i < index.scenes.length; i += 1) {
      const s = index.scenes[i];
      const node = doc.nodeAt(s.pmPos);
      if (!node) continue;
      decos.push(PM.Decoration.node(
        s.pmPos,
        s.pmPos + node.nodeSize,
        {},
        { sceneNumber: s.sceneNumber }
      ));
    }
    // 2. Page-break widget Decorations (Phase 6, Flow view only).
    if (pageMap && Array.isArray(pageMap) && Array.isArray(normalizedBlocks)) {
      for (let p = 0; p < pageMap.length - 1; p += 1) {
        const page = pageMap[p];
        if (!page.blocks || page.blocks.length === 0) continue;
        const lastIdx = page.blocks[page.blocks.length - 1];
        const lastBlock = normalizedBlocks[lastIdx];
        if (!lastBlock) continue;
        const widget = _buildPageMarkerWidget(p + 2); // marker shows the NEXT page number
        // side: 1 → widget sits AFTER content at this position (after the
        // block's closing boundary); doesn't gobble cursor placement.
        decos.push(PM.Decoration.widget(lastBlock.pmTo, widget, { side: 1, key: 'page-' + (p + 2) }));
      }
    }
    return PM.DecorationSet.create(doc, decos);
  }

  function _buildPageMarkerWidget(pageNumber) {
    // pageNumber is the page BEGINNING below this marker (p+2 at the call site).
    // pageEnds   = the page that just finished above (pageNumber - 1).
    // pageBegins = the page starting below (pageNumber).
    const pageEnds   = pageNumber - 1;
    const pageBegins = pageNumber;

    const el = document.createElement('div');
    el.className = 'rga-page-marker';
    el.contentEditable = 'false';
    // data-page-number is preserved for Print view's CSS ::after rule
    // which renders "N." right-aligned using attr(data-page-number).
    el.dataset.pageNumber = String(pageBegins);
    // New attributes carry both sides of the transition.
    el.dataset.pageEnds   = String(pageEnds);
    el.dataset.pageBegins = String(pageBegins);
    el.setAttribute('aria-label',
      'End of page ' + pageEnds + ' — page ' + pageBegins + ' begins');

    const endSpan = document.createElement('span');
    endSpan.className = 'rga-page-marker-end';
    endSpan.textContent = 'Page ' + pageEnds;

    const ruleSpan = document.createElement('span');
    ruleSpan.className = 'rga-page-marker-rule';

    const beginSpan = document.createElement('span');
    beginSpan.className = 'rga-page-marker-begin';
    beginSpan.textContent = 'Page ' + pageBegins;

    el.appendChild(endSpan);
    el.appendChild(ruleSpan);
    el.appendChild(beginSpan);
    return el;
  }

  // ----------------------------------------------------------------
  // Plugin — maintains index + outline + decorations in PM state
  // ----------------------------------------------------------------
  let _pluginKey = null;
  function _getKey() {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.PluginKey) return null;
    if (!_pluginKey) _pluginKey = new PM.PluginKey('rga-scene-index');
    return _pluginKey;
  }

  function _buildPluginState(editorState) {
    const opts = _resolveBuildOpts();
    const idx = buildIndex(editorState.doc, opts);

    // Phase 6: normalize → layout profile → PageMap. Pure pipeline.
    let normalizedBlocks = null;
    let pageMap = null;
    if (window.Rga && Rga.Normalizer && typeof Rga.Normalizer.normalize === 'function') {
      normalizedBlocks = Rga.Normalizer.normalize(editorState.doc);
    }
    const layoutProfile = (window.Rga && Rga.LayoutProfile && typeof Rga.LayoutProfile.compose === 'function')
      ? Rga.LayoutProfile.compose(opts.screenplayProfile || null, opts.settings || null)
      : null;
    if (normalizedBlocks && layoutProfile && Rga.PageMap && typeof Rga.PageMap.build === 'function') {
      pageMap = Rga.PageMap.build(normalizedBlocks, layoutProfile);
      // Populate NavigationIndex.pages from PageMap (directive rule 8).
      idx.pages = Rga.PageMap.pagesToIndexEntries(pageMap, normalizedBlocks);
    }

    // Outline.statistics.pages from PageMap length (directive rule 9).
    const outlineOpts = Object.assign({}, opts, {
      pageCount: pageMap ? pageMap.length : 0
    });
    const outline = (window.Rga && Rga.Outline && typeof Rga.Outline.build === 'function')
      ? Rga.Outline.build(editorState.doc, outlineOpts) : null;

    return {
      index: idx,
      outline: outline,
      pageMap: pageMap,
      decorations: buildDecorations(idx, editorState.doc, pageMap, normalizedBlocks)
    };
  }

  // The active tab's Rga.Doc carries tagRegistry / screenplayProfile / settings;
  // we look it up just-in-time so the plugin works in both the live app and
  // isolated tests (where TabManager may be absent — opts becomes mostly {} and
  // derived fields fall back to defaults).
  function _resolveBuildOpts() {
    const opts = {};
    if (window.Rga && Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function') {
      const d = Rga.TabManager.activeDoc();
      if (d) {
        if (d.tagRegistry) opts.tagRegistry = d.tagRegistry;
        if (d.metadata && d.metadata.screenplayProfile) opts.screenplayProfile = d.metadata.screenplayProfile;
        if (d.settings) opts.settings = d.settings;
        if (d.metadata && d.metadata.title) opts.title = d.metadata.title;
      }
    }
    return opts;
  }

  function buildIndexPlugin() {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.Plugin) return null;
    const key = _getKey();
    if (!key) return null;
    return new PM.Plugin({
      key: key,
      state: {
        init: function(_config, editorState) { return _buildPluginState(editorState); },
        apply: function(tr, prev, _old, newState) {
          if (!tr.docChanged) return prev;
          return _buildPluginState(newState);
        }
      },
      props: {
        decorations: function(state) {
          const ps = key.getState(state);
          return ps ? ps.decorations : null;
        }
      }
    });
  }

  function getIndex(state) {
    const key = _getKey();
    if (!key) return null;
    const ps = key.getState(state);
    return ps ? ps.index : null;
  }

  function getOutline(state) {
    const key = _getKey();
    if (!key) return null;
    const ps = key.getState(state);
    return ps ? ps.outline : null;
  }

  function getPageMap(state) {
    const key = _getKey();
    if (!key) return null;
    const ps = key.getState(state);
    return ps ? ps.pageMap : null;
  }

  function readNumberFromDecorations(decorations) {
    if (!decorations || typeof decorations.length !== 'number') return null;
    for (let i = 0; i < decorations.length; i += 1) {
      const d = decorations[i];
      if (d && d.spec && d.spec.sceneNumber != null) return d.spec.sceneNumber;
    }
    return null;
  }

  Rga.Nav.buildIndex                = buildIndex;
  Rga.Nav.buildIndexPlugin          = buildIndexPlugin;
  Rga.Nav.getIndex                  = getIndex;
  Rga.Nav.getOutline                = getOutline;
  Rga.Nav.getPageMap                = getPageMap;
  Rga.Nav.findScene                 = findScene;
  Rga.Nav.readNumberFromDecorations = readNumberFromDecorations;
  Rga.Nav._buildDecorations         = buildDecorations;
  Rga.Nav._TAG_TYPES                = TAG_TYPES;
  Rga.Nav._REGISTRY_KEY             = REGISTRY_KEY;
})();
