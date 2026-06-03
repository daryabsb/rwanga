// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const TAG_TYPES = [
    'character', 'prop', 'wardrobe', 'location',
    'sfx', 'vfx', 'vehicle', 'animal', 'custom',
  ];

  const TAG_LABELS = {
    character: 'Character', prop: 'Prop', wardrobe: 'Wardrobe',
    location: 'Location', sfx: 'SFX', vfx: 'VFX',
    vehicle: 'Vehicle', animal: 'Animal', custom: 'Custom',
  };

  // ---------------------------------------------------------------
  // Transaction helpers
  // ---------------------------------------------------------------

  function applyTag(view, tagType, entityId) {
    const { schema, selection } = view.state;
    const { from, to } = selection;
    const mark = schema.marks.tag.create({ tagType, entityId });
    view.dispatch(view.state.tr.addMark(from, to, mark));
    document.dispatchEvent(new CustomEvent('editor.tagApplied', { detail: { tagType, entityId } }));
  }

  function removeTag(view, tagType, entityId) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    doc.descendants(function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.tag
            && m.attrs.tagType === tagType
            && m.attrs.entityId === entityId) {
          tr = tr.removeMark(pos, pos + node.nodeSize, m);
        }
      });
    });
    view.dispatch(tr);
    document.dispatchEvent(new CustomEvent('editor.tagRemoved', { detail: { tagType, entityId } }));
  }

  function removeAllMarksForEntity(view, entityId) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    doc.descendants(function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.tag && m.attrs.entityId === entityId) {
          tr = tr.removeMark(pos, pos + node.nodeSize, m);
        }
      });
    });
    view.dispatch(tr);
  }

  // ---------------------------------------------------------------
  // Tags Panel V1 — Visible Intelligence.
  // The screenplay-owned renderer for the sidebar tags content (hosted
  // by the shell Characters panel). A read-only lens over the registry:
  //   - every LIVE entity (tombstones never appear — consumer rule C3)
  //   - grouped by category, occurrence count per row (nav-index
  //     mentionCount — the maintained source, no extra doc walk)
  //   - click → jump the editor to the first occurrence
  //   - panel direction mirrors the script's writing direction (RTL)
  // Renders with the designed sidebar classes (components.css):
  //   .tag-group / .tag-group-header / .tag-group-items
  //   .tag-item / .tag-dot / .tag-name / .tag-count
  // ---------------------------------------------------------------

  // Group headers — the panel's plural screenplay vocabulary (parallel
  // to TAG_LABELS, which stays singular for per-mark contexts like the
  // info popup).
  const TAG_GROUP_LABELS = {
    character: 'Characters', prop: 'Props', wardrobe: 'Wardrobe',
    location: 'Locations', sfx: 'SFX', vfx: 'VFX',
    vehicle: 'Vehicles', animal: 'Animals', custom: 'Custom',
  };

  function _panelDoc() {
    const TM = Rga.TabManager;
    if (!TM) return null;
    let doc = (typeof TM.activeDoc === 'function') ? TM.activeDoc() : null;
    if (!doc && typeof TM.lastActiveDoc === 'function') doc = TM.lastActiveDoc();
    return doc;
  }

  function _panelView() {
    const TM = Rga.TabManager;
    return (TM && typeof TM._editorView === 'function') ? TM._editorView() : null;
  }

  function _scriptDirection(doc) {
    const profile = doc && doc.metadata && doc.metadata.screenplayProfile;
    return (profile && profile.direction === 'rtl') ? 'rtl' : 'ltr';
  }

  // Live entities per type — tombstone-filtered via the scoped registry
  // API; raw-list fallback for environments without the B1 APIs.
  function _liveList(doc, tagType) {
    if (doc && Rga.Doc && typeof Rga.Doc.liveEntities === 'function') {
      return Rga.Doc.liveEntities(doc, tagType);
    }
    return _entityList(doc, tagType);
  }

  // entityId → occurrence count, from the nav-index (mentionCount).
  function _countLookup(view, tagType) {
    const counts = {};
    if (!view || !view.state || !Rga.Nav || typeof Rga.Nav.getIndex !== 'function') return counts;
    const idx = Rga.Nav.getIndex(view.state);
    const arr = (idx && idx.tags && Array.isArray(idx.tags[tagType])) ? idx.tags[tagType] : [];
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i] && arr[i].nodeId) counts[arr[i].nodeId] = arr[i].mentionCount || 0;
    }
    return counts;
  }

  // Find the first tag-mark position for an entity, optionally bounded
  // to a [from, to] document range (a scene's extent). null = no mark.
  function _firstMarkPos(view, tagType, entityId, rangeFrom, rangeTo) {
    if (!view || !view.state) return null;
    let foundPos = null;
    const visit = function(node, pos) {
      if (foundPos !== null) return false;
      if (!node.isText) return;
      for (let i = 0; i < node.marks.length; i += 1) {
        const m = node.marks[i];
        if (m.type.name === 'tag' && m.attrs.tagType === tagType && m.attrs.entityId === entityId) {
          foundPos = pos;
          return false;
        }
      }
    };
    if (typeof rangeFrom === 'number' && typeof rangeTo === 'number') {
      view.state.doc.nodesBetween(rangeFrom, rangeTo, visit);
    } else {
      view.state.doc.descendants(visit);
    }
    return foundPos;
  }

  // Move the editor selection to a document position + scroll it into
  // view (PM hint + DOM backup, same pattern as SceneNavigator).
  function _jumpToPos(view, pos) {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.TextSelection) return false;
    try {
      const $pos = view.state.doc.resolve(pos);
      view.dispatch(view.state.tr.setSelection(PM.TextSelection.near($pos)).scrollIntoView());
      try {
        const ref = (typeof view.domAtPos === 'function') ? view.domAtPos(pos) : null;
        const el = ref && ref.node
          ? (ref.node.nodeType === 3 ? ref.node.parentElement : ref.node) : null;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      } catch (_) { /* domAtPos can throw on transient states */ }
      if (typeof view.focus === 'function') view.focus();
      return true;
    } catch (err) {
      console.error('[Rga.Tags] jump threw:', err);
      return false;
    }
  }

  // Jump the editor to the first occurrence (first tag mark in document
  // order) of an entity. Returns false when the entity has no marks —
  // a curated-but-untagged entity is a safe no-op.
  function jumpToFirstOccurrence(view, tagType, entityId) {
    const pos = _firstMarkPos(view, tagType, entityId);
    if (pos === null) return false;
    return _jumpToPos(view, pos);
  }

  // V1.2 — jump to the entity's first occurrence INSIDE one scene. The
  // scene's extent is resolved from the nav-index AT CLICK TIME (never
  // from positions captured at render time — those go stale the moment
  // the writer types).
  function jumpToOccurrenceInScene(view, tagType, entityId, sceneNodeId) {
    if (!view || !view.state || !sceneNodeId) return false;
    if (!Rga.Nav || typeof Rga.Nav.getIndex !== 'function') return false;
    const idx = Rga.Nav.getIndex(view.state);
    if (!idx || !Array.isArray(idx.scenes)) return false;
    let scene = null;
    for (let i = 0; i < idx.scenes.length; i += 1) {
      if (idx.scenes[i] && idx.scenes[i].nodeId === sceneNodeId) { scene = idx.scenes[i]; break; }
    }
    if (!scene || scene.pmPos == null || scene.pmEndPos == null) return false;
    const pos = _firstMarkPos(view, tagType, entityId, scene.pmPos, scene.pmEndPos);
    if (pos === null) return false;
    return _jumpToPos(view, pos);
  }

  // ---------------------------------------------------------------
  // V1.2 — Occurrence Browser
  // ---------------------------------------------------------------

  // Which entities are expanded in the panel. Module-level (the
  // scene-navigator expansion pattern) so browsing survives the
  // panel's live re-renders. Keyed `tagType:entityId`.
  const _expandedEntities = new Set();

  function _expansionKey(tagType, entityId) { return tagType + ':' + entityId; }

  // V1.3 — the ONE entity whose tagged occurrences are currently lit in the
  // editor (the "tag focus"). Single value: selecting another entity moves
  // the highlight. `{ tagType, entityId }` or null. Distinct from
  // _expandedEntities (which is multi — the V1.2 occurrence browsers).
  let _selectedEntity = null;

  function _isSelected(tagType, entityId) {
    return !!_selectedEntity && _selectedEntity.tagType === tagType && _selectedEntity.entityId === entityId;
  }

  // Clear the focus highlight + selection (panel reset / close / doc swap).
  function clearFocus() {
    _selectedEntity = null;
    const view = _panelView();
    if (view && Rga.TagFocusHighlight && typeof Rga.TagFocusHighlight.clear === 'function') {
      Rga.TagFocusHighlight.clear(view);
    }
  }

  // Per-scene occurrence data for one entity:
  //   [{ sceneNodeId, sceneNumber, headingDisplay, count }]
  // Scene membership comes from the Memory API (the designed read
  // surface for "which scenes is this entity tagged in"), falling back
  // to the nav-index sceneAppearances when Memory isn't loaded. The
  // per-scene count is a scoped walk of just that scene's subtree.
  function _occurrencesByScene(view, tagType, entityId) {
    if (!view || !view.state || !Rga.Nav || typeof Rga.Nav.getIndex !== 'function') return [];
    const idx = Rga.Nav.getIndex(view.state);
    if (!idx || !Array.isArray(idx.scenes)) return [];

    // Scene ids the entity appears in — Memory first, index fallback.
    let sceneIds = null;
    const Memory = Rga.Screenplay && Rga.Screenplay.Memory;
    if (Memory && typeof Memory.entity === 'function') {
      const bundle = Memory.entity(tagType, entityId, idx);
      if (bundle && Array.isArray(bundle.sceneIds)) sceneIds = bundle.sceneIds;
    }
    if (!sceneIds) {
      const arr = (idx.tags && Array.isArray(idx.tags[tagType])) ? idx.tags[tagType] : [];
      for (let i = 0; i < arr.length; i += 1) {
        if (arr[i] && arr[i].nodeId === entityId) {
          sceneIds = Array.isArray(arr[i].sceneAppearances) ? arr[i].sceneAppearances : [];
          break;
        }
      }
    }
    if (!sceneIds || !sceneIds.length) return [];

    const out = [];
    idx.scenes.forEach(function(scene) {
      if (!scene || sceneIds.indexOf(scene.nodeId) === -1) return;
      if (scene.pmPos == null || scene.pmEndPos == null) return;
      // Count this entity's marks inside this scene's extent.
      let count = 0;
      view.state.doc.nodesBetween(scene.pmPos, scene.pmEndPos, function(node) {
        if (!node.isText) return;
        node.marks.forEach(function(m) {
          if (m.type.name === 'tag' && m.attrs.tagType === tagType && m.attrs.entityId === entityId) {
            count += 1;
          }
        });
      });
      if (count > 0) {
        out.push({
          sceneNodeId:    scene.nodeId,
          sceneNumber:    scene.sceneNumber,
          headingDisplay: scene.headingDisplay || '',
          count:          count
        });
      }
    });
    return out;
  }

  // Render the full tags-panel content into `container`. Returns the
  // number of entity rows rendered — 0 tells the hosting panel to show
  // its empty state instead.
  function renderTagsPanel(container) {
    if (!container) return 0;
    container.innerHTML = '';
    const doc = _panelDoc();
    if (!doc) return 0;
    const view = _panelView();

    const wrapper = document.createElement('div');
    wrapper.className = 'tag-groups';
    wrapper.id = 'tag-groups-container';
    wrapper.setAttribute('dir', _scriptDirection(doc));

    let total = 0;
    TAG_TYPES.forEach(function(type) {
      const entities = _liveList(doc, type);
      if (!entities.length) return;
      const counts = _countLookup(view, type);

      // V1.1 — duplicate-identity detection: how many LIVE entities in
      // THIS category share each normalized (trimmed, case-folded) name.
      // Identity is type-scoped, so the map is per-category; tombstones
      // never reach here (the list is already live-filtered).
      const nameTally = {};
      entities.forEach(function(entity) {
        const norm = String(entity.name || '').trim().toLowerCase();
        nameTally[norm] = (nameTally[norm] || 0) + 1;
      });

      const group = document.createElement('div');
      group.className = 'tag-group';

      const header = document.createElement('div');
      header.className = 'tag-group-header';
      const label = document.createElement('span');
      label.className = 'tag-group-label';
      label.textContent = TAG_GROUP_LABELS[type] || capitalize(type);
      header.appendChild(label);
      group.appendChild(header);

      const items = document.createElement('div');
      items.className = 'tag-group-items';

      entities.forEach(function(entity) {
        const row = document.createElement('div');
        row.className = 'tag-item';
        row.setAttribute('data-entity-id', entity.id);
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        const dot = document.createElement('span');
        dot.className = 'tag-dot';
        dot.style.background = entity.color || 'var(--accent-primary)';
        row.appendChild(dot);

        const name = document.createElement('span');
        name.className = 'tag-name';
        name.textContent = entity.name || '';
        row.appendChild(name);

        // V1.1 — duplicate-identity warning: this name exists on more
        // than one live entity in this category. Lucide triangle-alert
        // with a text fallback; meaning carried on aria + title so the
        // writer (and assistive tech) knows exactly what is wrong.
        const norm = String(entity.name || '').trim().toLowerCase();
        if (nameTally[norm] > 1) {
          const warn = document.createElement('span');
          warn.className = 'tag-duplicate-warning';
          warn.setAttribute('data-icon-name', 'triangle-alert');
          const svg = (Rga.Icons && Rga.Icons.Lucide && Rga.Icons.Lucide.has('triangle-alert'))
            ? Rga.Icons.Lucide.svgFor('triangle-alert') : '';
          if (svg) { warn.innerHTML = svg; } else { warn.textContent = '⚠'; }
          const warnText = 'Duplicate identity: more than one "' + (entity.name || '')
            + '" exists in ' + (TAG_GROUP_LABELS[type] || capitalize(type));
          warn.setAttribute('aria-label', warnText);
          warn.title = warnText;
          row.appendChild(warn);
        }

        // V1.1 — honest zero treatment: the count element exists ONLY
        // when there are tagged occurrences. An untagged entity shows
        // just its name — "registered, not yet tagged in the screenplay".
        const n = counts[entity.id] || 0;
        if (n > 0) {
          const count = document.createElement('span');
          count.className = 'tag-count';
          count.textContent = String(n);
          // The number means TAGGED OCCURRENCES — not appearances, not
          // mentions, not detected references. Say so.
          const countText = n + ' tagged occurrence' + (n === 1 ? '' : 's');
          count.title = countText;
          count.setAttribute('aria-label', countText);
          row.appendChild(count);
        }

        // V1.2 — the row click opens/closes the occurrence browser.
        // (V1 jumped from here; the jump now lives on the scene rows
        // inside the expansion, so the writer first SEES where the
        // entity is used, then chooses where to go.)
        const expansionKey = _expansionKey(type, entity.id);
        const expanded = _expandedEntities.has(expansionKey);
        row.setAttribute('aria-expanded', expanded ? 'true' : 'false');

        // V1.3 — active state: the selected entity's row is visibly focused
        // (matches the lit occurrences in the editor). One row at a time.
        if (_isSelected(type, entity.id)) {
          row.classList.add('tag-item-selected');
          row.setAttribute('aria-selected', 'true');
        }

        row.addEventListener('click', function() {
          // V1.2 — toggle the occurrence browser.
          const wasExpanded = _expandedEntities.has(expansionKey);
          if (wasExpanded) _expandedEntities.delete(expansionKey);
          else _expandedEntities.add(expansionKey);
          const nowExpanded = !wasExpanded;

          // V1.3 — tag focus follows the same gesture. Opening an entity
          // selects it and lights up ALL its tagged occurrences (replacing
          // any prior focus). Closing the focused entity clears the
          // highlight. Matched by entityId, so duplicate same-named
          // entities never bleed into each other; a zero-occurrence entity
          // simply paints nothing (honest no-op).
          const view = _panelView();
          if (nowExpanded) {
            _selectedEntity = { tagType: type, entityId: entity.id };
            if (view && Rga.TagFocusHighlight && typeof Rga.TagFocusHighlight.setEntity === 'function') {
              Rga.TagFocusHighlight.setEntity(view, entity.id);
            }
          } else if (_isSelected(type, entity.id)) {
            clearFocus();
          }

          renderTagsPanel(container);
        });

        items.appendChild(row);

        // V1.2 — the occurrence browser: one row per scene the entity
        // is tagged in (scene number — heading — per-scene count).
        // Read-only navigation: clicking a scene jumps the editor to
        // the entity's first occurrence inside that scene.
        if (expanded) {
          const zone = document.createElement('div');
          zone.className = 'tag-occurrences';
          const occurrences = _occurrencesByScene(view, type, entity.id);
          if (!occurrences.length) {
            const emptyLine = document.createElement('div');
            emptyLine.className = 'tag-occurrences-empty';
            emptyLine.textContent = 'Not tagged in any scene yet.';
            zone.appendChild(emptyLine);
          } else {
            occurrences.forEach(function(occ) {
              const line = document.createElement('div');
              line.className = 'tag-occurrence';
              line.setAttribute('data-scene-node-id', occ.sceneNodeId);
              line.setAttribute('role', 'button');
              line.setAttribute('tabindex', '0');

              const label = document.createElement('span');
              label.className = 'tag-occurrence-label';
              label.textContent = 'Scene ' + occ.sceneNumber
                + (occ.headingDisplay ? ' — ' + occ.headingDisplay : '');
              line.appendChild(label);

              const occCount = document.createElement('span');
              occCount.className = 'tag-occurrence-count';
              occCount.textContent = String(occ.count);
              const occText = occ.count + ' tagged occurrence' + (occ.count === 1 ? '' : 's')
                + ' in scene ' + occ.sceneNumber;
              occCount.title = occText;
              occCount.setAttribute('aria-label', occText);
              line.appendChild(occCount);

              line.addEventListener('click', function(e) {
                e.stopPropagation();   // jump only — never collapse the browser
                jumpToOccurrenceInScene(_panelView(), type, entity.id, occ.sceneNodeId);
              });

              zone.appendChild(line);
            });
          }
          items.appendChild(zone);
        }

        total += 1;
      });

      group.appendChild(items);
      wrapper.appendChild(group);
    });

    container.appendChild(wrapper);
    return total;
  }

  // Legacy entry point — kept for the editor.tagApplied/tagRemoved
  // document listeners below and any caller still targeting the
  // #tag-groups-container id directly.
  function refreshTagsPanel() {
    const container = document.getElementById('tag-groups-container');
    if (!container || !container.parentElement) return;
    renderTagsPanel(container.parentElement);
  }

  // Listen for tag events and refresh the panel. A tag mutation is a
  // document change, which the transient focus highlight already drops; we
  // also drop the stale selection so the active row state stays honest
  // (no "selected" row without lit occurrences).
  document.addEventListener('editor.tagApplied', function() {
    _selectedEntity = null;
    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    if (activeTab && activeTab.doc) refreshTagsPanel(activeTab.doc);
  });
  document.addEventListener('editor.tagRemoved', function() {
    _selectedEntity = null;
    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    if (activeTab && activeTab.doc) refreshTagsPanel(activeTab.doc);
  });

  // ---------------------------------------------------------------
  // Apply tag from context menu
  // Uses the selected text as the entity name:
  //   - exact case-insensitive match in registry → reuse that entity
  //   - no match → create a new entity named after the selected text
  // No dialog shown — the selection IS the entity identifier.
  // ---------------------------------------------------------------

  function _entityList(doc, tagType) {
    const keyMap = Rga.Doc && Rga.Doc._registryKey;
    const key = keyMap ? (keyMap[tagType] || tagType) : tagType;
    return (doc && doc.tagRegistry && doc.tagRegistry[key]) || [];
  }

  // Registry Integrity Slice A — THE single reuse-before-create path.
  // Every tagging surface (toolbar dropdown, context-menu/Ctrl+Shift+T
  // dialog, future recognizers) must acquire entity ids through this
  // function so the lookup logic can never diverge between paths again.
  //
  //   - exact case-insensitive name match within the tagType's registry
  //     list → reuse that entity's id (curation: color/notes survive)
  //   - no match → register one new entity via Rga.Doc.addEntity
  //   - identity is type-scoped: Character:NALI ≠ Prop:NALI
  //
  // Returns the entityId, or null when name is empty.
  function findOrCreateEntity(doc, tagType, name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;

    // Registry Integrity Slice B2 (consumer rule C1): the lookup domain
    // is LIVE entities only. A tombstoned loser and its survivor share
    // the same name — matching the tombstone would point new marks at a
    // merged-away identity (the exact bug Slice A fixed, reborn). Falls
    // back to the raw list when the live-filter API is unavailable
    // (stubbed Rga.Doc in older harnesses, or no doc at all).
    const list = (doc && Rga.Doc && typeof Rga.Doc.liveEntities === 'function')
      ? Rga.Doc.liveEntities(doc, tagType)
      : _entityList(doc, tagType);

    const existing = list.find(function(e) {
      return String(e.name || '').toLowerCase() === trimmed.toLowerCase();
    });
    if (existing) return existing.id;

    const entityId = crypto.randomUUID();
    if (doc && Rga.Doc && Rga.Doc.addEntity) {
      Rga.Doc.addEntity(doc, tagType, { id: entityId, name: trimmed, color: null, notes: '' });
    }
    return entityId;
  }

  function showTagDialog(view, tagType) {
    if (Rga.ContextMenu) Rga.ContextMenu.hide();

    const { selection } = view.state;
    if (selection.empty) return;

    const selectedText = view.state.doc.textBetween(selection.from, selection.to, ' ').trim();
    if (!selectedText) return;

    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    const doc = activeTab && activeTab.doc;

    const entityId = findOrCreateEntity(doc, tagType, selectedText);
    if (!entityId) return;

    applyTag(view, tagType, entityId);
    view.focus();
  }

  // ---------------------------------------------------------------
  // Entity merge operation — Registry Integrity Slice B2.
  // Design: docs/Filmustageation/SCOPED_REGISTRY_MERGE_API_DESIGN.md §1.4
  // Policy: docs/Filmustageation/IDENTITY_MERGE_POLICY_AUDIT.md §6
  //
  // The approved 5-step order:
  //   1. rewrite loser marks → survivor (ONE PM transaction, undoable)
  //   2. fold loser metadata into survivor   (Rga.Doc.foldEntityMetadata)
  //   3. tombstone losers — never delete     (Rga.Doc.markEntityMerged)
  //   4. append merge log                    (Rga.Doc.appendMergeLog)
  //   5. mark document dirty
  //
  // Preconditions are all-or-nothing: any invalid loser refuses the
  // whole operation. Re-running a completed merge is a safe no-op.
  // Registry mutation goes exclusively through the scoped Rga.Doc APIs
  // — this function never writes registry state directly.
  // ---------------------------------------------------------------

  function mergeEntities(view, tagType, survivorId, loserIds) {
    // -- Preconditions: live view + args + B1 APIs present ----------
    if (!view || !view.state || typeof view.dispatch !== 'function') return null;
    if (!tagType || !survivorId || !Array.isArray(loserIds) || !loserIds.length) return null;
    const D = Rga.Doc;
    if (!D || typeof D.markEntityMerged !== 'function'
           || typeof D.foldEntityMetadata !== 'function'
           || typeof D.appendMergeLog !== 'function'
           || typeof D.isEntityMerged !== 'function'
           || typeof D.resolveEntityId !== 'function') return null;

    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    const doc = activeTab && activeTab.doc;
    if (!doc) return null;

    // -- Preconditions: survivor exists and is live (no chains) -----
    const survivor = D.findEntity(doc, tagType, survivorId);
    if (!survivor) return null;
    if (D.isEntityMerged(doc, tagType, survivorId)) return null;

    // -- Preconditions: every loser is mergeable (all-or-nothing) ---
    // Name-duplicate merges only: same case-folded, trimmed name.
    // Anything looser (abbreviations, aliases) is Slice C territory.
    const survivorName = String(survivor.name || '').trim().toLowerCase();
    const newLosers = [];   // live losers to merge in this run
    for (let i = 0; i < loserIds.length; i += 1) {
      const loserId = loserIds[i];
      if (loserId === survivorId) return null;
      const loser = D.findEntity(doc, tagType, loserId);
      if (!loser) return null;
      const loserName = String(loser.name || '').trim().toLowerCase();
      if (loserName !== survivorName) return null;
      if (D.isEntityMerged(doc, tagType, loserId)) {
        // Already tombstoned: into this survivor → already merged, skip.
        // Into a different survivor → conflict, refuse everything.
        if (D.resolveEntityId(doc, tagType, loserId) !== survivorId) return null;
      } else {
        newLosers.push(loser);
      }
    }

    // Re-run with nothing left to do: safe no-op, no duplicate log.
    if (!newLosers.length) {
      return { record: null, marksRewritten: 0, alreadyMerged: true };
    }

    // -- Step 1: mark rewrite — ONE transaction ----------------------
    const schema = view.state.schema;
    const tagMarkType = schema.marks.tag;
    if (!tagMarkType) return null;

    const loserIdSet = {};
    newLosers.forEach(function(l) { loserIdSet[l.id] = true; });
    const markCounts = {};
    let tr = view.state.tr;
    let rewritten = 0;
    view.state.doc.descendants(function(node, pos) {
      if (!node.isText) return;
      node.marks.forEach(function(m) {
        if (m.type === tagMarkType
            && m.attrs.tagType === tagType
            && loserIdSet[m.attrs.entityId]) {
          tr = tr.removeMark(pos, pos + node.nodeSize, m);
          tr = tr.addMark(pos, pos + node.nodeSize,
            tagMarkType.create({ tagType: tagType, entityId: survivorId }));
          markCounts[m.attrs.entityId] = (markCounts[m.attrs.entityId] || 0) + 1;
          rewritten += 1;
        }
      });
    });
    if (rewritten > 0) view.dispatch(tr);

    // -- Steps 2+3: fold metadata, then tombstone --------------------
    // Order matters: foldEntityMetadata refuses tombstoned losers, so
    // the fold must happen before the tombstone is written.
    const loserRecords = [];
    const metadataMoved = {};
    newLosers.forEach(function(loser) {
      loserRecords.push({
        id:         loser.id,
        name:       loser.name || '',
        color:      loser.color || null,
        notes:      loser.notes || '',
        mark_count: markCounts[loser.id] || 0
      });
      const summary = D.foldEntityMetadata(doc, tagType, survivorId, loser.id);
      if (summary) metadataMoved[loser.id] = summary;
      D.markEntityMerged(doc, tagType, loser.id, survivorId);
    });

    // -- Step 4: log --------------------------------------------------
    const record = D.appendMergeLog(doc, {
      tag_type: tagType,
      survivor: { id: survivorId, name: survivor.name || '' },
      losers:   loserRecords,
      metadata_moved: metadataMoved
    });

    // -- Step 5: dirty ------------------------------------------------
    if (typeof D.markDirty === 'function') D.markDirty(doc);

    return { record: record, marksRewritten: rewritten, alreadyMerged: false };
  }

  // ---------------------------------------------------------------
  // Small info popup on click of tagged text
  // ---------------------------------------------------------------

  let _infoPopup = null;

  function hideInfoPopup() {
    if (_infoPopup && _infoPopup.parentNode) _infoPopup.parentNode.removeChild(_infoPopup);
    _infoPopup = null;
  }

  function showTagInfo(view, mark, pos) {
    hideInfoPopup();

    // Look up entity name from registry
    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    const doc = activeTab && activeTab.doc;
    let entityName = mark.attrs.entityId;
    if (doc && Rga.Doc && Rga.Doc.findEntity) {
      // Slice B2 (consumer rule C7): a mark can point at a tombstoned
      // entity (undo-restored marks after a merge) — resolve it to the
      // live survivor so the user never sees a ghost identity.
      let lookupId = mark.attrs.entityId;
      if (typeof Rga.Doc.resolveEntityId === 'function') {
        const resolved = Rga.Doc.resolveEntityId(doc, mark.attrs.tagType, lookupId);
        if (resolved) lookupId = resolved;
      }
      const ent = Rga.Doc.findEntity(doc, mark.attrs.tagType, lookupId);
      if (ent) entityName = ent.name;
    }

    const popup = document.createElement('div');
    popup.className = 'rga-mark-info-popup';

    const typeClass = 'rga-info-dot rga-tag-dot-' + mark.attrs.tagType;
    const dot = document.createElement('span');
    dot.className = typeClass;
    popup.appendChild(dot);

    const label = document.createElement('span');
    label.className = 'rga-info-label';
    label.textContent = (TAG_LABELS[mark.attrs.tagType] || capitalize(mark.attrs.tagType)) + ': ' + entityName;
    popup.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'rga-info-actions';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'rga-info-btn';
    viewBtn.textContent = 'View Tags';
    viewBtn.addEventListener('click', function() {
      hideInfoPopup();
      // Tags Panel V1 — open the Characters sidebar panel (the tags
      // home; the documented Rga.Sidebar→Shell.Sidebar migration).
      if (Rga.Shell && Rga.Shell.Sidebar && typeof Rga.Shell.Sidebar.activate === 'function') {
        Rga.Shell.Sidebar.activate('characters');
        return;
      }
      // Legacy fallback (pre-shell builds).
      if (Rga.Sidebar) Rga.Sidebar.switchTo('tags');
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'rga-info-btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function() {
      hideInfoPopup();
      removeTag(view, mark.attrs.tagType, mark.attrs.entityId);
      view.focus();
    });

    actions.appendChild(viewBtn);
    actions.appendChild(removeBtn);
    popup.appendChild(actions);
    document.body.appendChild(popup);
    _infoPopup = popup;

    const coords = view.coordsAtPos(pos);
    const x = Math.min(coords.left, window.innerWidth - 260);
    const y = Math.min(coords.bottom + 6, window.innerHeight - 120);
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    setTimeout(function() {
      function onOutside(e) {
        if (_infoPopup && !_infoPopup.contains(e.target)) hideInfoPopup();
      }
      document.addEventListener('mousedown', onOutside, true);
    }, 0);
  }

  // ---------------------------------------------------------------
  // ProseMirror plugin
  // ---------------------------------------------------------------

  function tagsPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      props: {
        handleClickOn: function(view, pos) {
          const schema = view.state.schema;
          if (!schema.marks.tag) return false;
          const $pos = view.state.doc.resolve(pos);
          const tagMark = $pos.marks().find(function(m) {
            return m.type === schema.marks.tag;
          });
          if (!tagMark) return false;
          showTagInfo(view, tagMark, pos);
          return true;
        }
      }
    });
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }

  Rga.Tags = {
    applyTag,
    removeTag,
    removeAllMarksForEntity,
    findOrCreateEntity,
    mergeEntities,
    showTagDialog,
    showTagInfo,
    renderTagsPanel,
    jumpToFirstOccurrence,
    jumpToOccurrenceInScene,
    refreshTagsPanel,
    clearFocus,
    tagsPlugin,
    TAG_TYPES,
    TAG_LABELS,
  };

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.tagsPlugin = tagsPlugin;
})();
