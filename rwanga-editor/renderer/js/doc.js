// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  const C = Rga.Constants;

  let untitledCounter = 0;
  let docIdCounter = 0;

  function nextDocId() {
    docIdCounter += 1;
    return 'doc-' + Date.now().toString(36) + '-' + docIdCounter;
  }

  function nextUntitledName() {
    untitledCounter += 1;
    return untitledCounter === 1 ? 'Untitled.rga' : `Untitled ${untitledCounter}.rga`;
  }

  function emptyTagRegistry() {
    return {
      characters: [], props: [], wardrobe: [], locations: [],
      sfx: [], vfx: [], vehicles: [], animals: [], custom: [],
    };
  }

  // Reading direction derived from language (Kurdish/Arabic read RTL). Same rule
  // as the v2→v3 and v4→v5 migrations — the single place new docs and migrated
  // docs agree on direction.
  function _directionForLanguage(language) {
    return (language === 'ku' || language === 'ar') ? 'rtl' : 'ltr';
  }

  function defaultMetadata(seed) {
    const now = new Date().toISOString();
    seed = seed || {};
    const language = seed.language || C.DEFAULT_SCRIPT_LANGUAGE;
    return {
      title: '',
      author: seed.author || '',
      created: now,
      modified: now,
      version: 1,
      revision_notes: '',
      language: language,
      // Print Contract V1: a new doc carries its print truth EXPLICITLY.
      // screenplayProfile owns reading direction; printContractVersion stamps
      // the contract schema. See docs/Filmustageation/PRINT_CONTRACT_V1.md.
      screenplayProfile: {
        language: language,
        direction: _directionForLanguage(language),
        screenplayConvention: 'hollywood',
      },
      printContractVersion: C.PRINT_CONTRACT_VERSION,
      production_type: seed.production_type || C.DEFAULT_PRODUCTION_TYPE,
      genre: '',
      logline: '',
    };
  }

  function defaultSettings() {
    return {
      // `theme` removed 2026-05-26 (H2): it is a user-tier preference
      // per the Settings Architecture Doctrine and lives in user prefs
      // via Rga.Settings.Store, not in per-script doc.settings.
      // Existing .rga files with `theme` baked into settings remain
      // tolerated — the Store ignores script-tier reads of entries
      // whose registry says persistsTo:'user'.
      font_size: 12,
      font_family: 'Courier Prime',
      show_scene_numbers: true,
      page_size: 'Letter',
      pageSetup: {
        // Print Contract V1: the owned page-truth set is seeded explicitly so a
        // new doc stores its full contract (paper + orientation + numbering),
        // not just what Page Setup happens to have touched.
        paperSize: 'Letter',
        orientation: 'portrait',
        margins: { top: 1, right: 1, bottom: 1, left: 1.5 },
        pageNumbers: true,
        pageNumberPosition: 'top_right',
      },
      vocabulary: {
        settings: ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'],
        times: ['DAY', 'NIGHT', 'CONTINUOUS', 'DUSK', 'DAWN'],
        sceneWord: 'SCENE'
      },
      sceneHeadingStyle: 'twoLine',
      units: 'in',  // measurement unit for margins/ruler/dialogs; 'in'|'cm'|'mm'|'px'
    };
  }

  function defaultExportSettings() {
    return {
      branding: 'rwanga',
      letterhead_url: null,
      include_scene_numbers: true,
      include_revision_marks: false,
    };
  }

  function defaultRuntime() {
    return {
      last_cursor: null,
      active_scene_id: null,
      ui_state: {},
    };
  }

  /**
   * Create a new in-memory doc object. `doc.body` is null until the
   * tab manager mounts an EditorState and assigns the PM Node.
   */
  function create(opts) {
    opts = opts || {};
    return {
      // System fields (not written to .rga file)
      docId: nextDocId(),
      handle: null,
      displayName: opts.displayName || nextUntitledName(),
      origin: 'untitled',
      dirty: false,
      lastSavedAt: null,
      // File fields
      rgaVersion: C.CURRENT_RGA_VERSION,
      documentType: 'screenplay',
      metadata: defaultMetadata(opts.seedDefaults),
      settings: defaultSettings(),
      tagRegistry: emptyTagRegistry(),
      flagLog: [],
      mergeLog: [],
      exportSettings: defaultExportSettings(),
      runtime: defaultRuntime(),
      // PM Node — set by tab-manager via emptyDoc() / nodeFromJSON()
      body: null,
    };
  }

  function parseVersion(v) {
    const m = /^(\d+)\.(\d+)$/.exec(String(v || ''));
    if (!m) return null;
    return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10) };
  }

  function isAcceptedVersion(version) {
    const parsed = parseVersion(version);
    if (!parsed) return false;
    const current = parseVersion(C.CURRENT_RGA_VERSION);
    if (parsed.major !== current.major) return false;
    return parsed.minor <= current.minor;
  }

  function isNewerThanSupported(version) {
    const parsed = parseVersion(version);
    if (!parsed) return false;
    const supported = C.SUPPORTED_RGA_VERSIONS || [];
    // Reject only if NO supported version's major/minor reaches this one.
    // (CURRENT_RGA_VERSION is what the writer emits; we may READ newer
    // versions in the SUPPORTED list — e.g. v3 via the Phase 3 pipeline
    // while the writer is still at v2.)
    for (let i = 0; i < supported.length; i += 1) {
      const s = parseVersion(supported[i]);
      if (!s) continue;
      if (s.major > parsed.major) return false;
      if (s.major === parsed.major && s.minor >= parsed.minor) return false;
    }
    return true;
  }

  function basenameFromHandle(handle) {
    if (!handle) return null;
    const parts = String(handle).split(/[\\/]/);
    return parts[parts.length - 1] || handle;
  }

  /**
   * Serialize a doc to .rga JSON string.
   * doc.body must be a ProseMirror Node (has .toJSON()) or null.
   */
  function serialize(doc) {
    const fileObj = {
      rga_version: doc.rgaVersion || C.CURRENT_RGA_VERSION,
      document_type: doc.documentType || 'screenplay',
      metadata: doc.metadata,
      settings: doc.settings,
      body: doc.body ? doc.body.toJSON() : null,
      tag_registry: doc.tagRegistry,
      flag_log: doc.flagLog || [],
      merge_log: doc.mergeLog || [],
      export_settings: doc.exportSettings,
      runtime: doc.runtime,
    };
    return JSON.stringify(fileObj, null, 2);
  }

  // The v3 deserialize pipeline:
  //   parsed (JSON.parse'd file content)
  //   → Rga.Migrations.detectVersion / migrate (chains v1.x → v2.x → v3)
  //   → Rga.DocTypes.detect (docType from file)
  //   → Rga.DocTypes.selectSchema (per-doctype config picks v3 schema)
  //   → schema.nodeFromJSON(parsed.body)
  //   → returns the in-memory Doc object the rest of the app uses.
  //
  // Migration / schema / doc-type detection are intentionally decoupled:
  // migration knows nothing about schemas; schemas know nothing about
  // file versions; doc-type detection is independent. Future doc-types
  // (stage play, TV episode template) register their own selectSchema
  // without touching this code.
  function _deserializeV3(parsedIn, handle) {
    let parsed = parsedIn;
    if (Rga.Migrations && typeof Rga.Migrations.migrate === 'function') {
      parsed = Rga.Migrations.migrate(parsed);
    }
    const documentType = Rga.DocTypes.detect(parsed);
    const schema = Rga.DocTypes.selectSchema(parsed);
    if (!schema) {
      throw new Error('No v3 schema available for doc-type "' + documentType + '"');
    }
    let pmBody = null;
    if (parsed.body) {
      try {
        pmBody = schema.nodeFromJSON(parsed.body);
      } catch (err) {
        throw new Error('Document body (v3) is invalid: ' + err.message);
      }
    }
    return _buildDocFromParsed(parsed, handle, pmBody);
  }

  /**
   * Deserialize a .rga JSON string into an in-memory doc.
   * @param {string} content - raw file content
   * @param {string|null} handle - file path or null
   * @param {object} [opts] - { schema } PM schema for body reconstruction
   */
  function deserialize(content, handle, opts) {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error('File is corrupt or invalid JSON: ' + err.message);
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('File is corrupt: not a JSON object');
    }

    const fileVersion = parsed.rga_version;

    if (isNewerThanSupported(fileVersion)) {
      throw new Error(`This .rga was created with a newer Rwanga (v${fileVersion}). Please update Rwanga to open it.`);
    }

    // Caller-supplied schema escape hatch — bypass the DocTypes
    // registry entirely. Used by unit tests that build minimal schemas
    // and by future non-screenplay doc-types that don't need migration.
    // This is the one explicit compatibility layer kept after Phase 9
    // retirement (Rule 12: keep only what's genuinely needed).
    if (opts && opts.schema) {
      let pmBody = null;
      if (parsed.body) {
        try { pmBody = opts.schema.nodeFromJSON(parsed.body); }
        catch (err) { throw new Error('Document body is invalid: ' + err.message); }
      }
      return _buildDocFromParsed(parsed, handle, pmBody);
    }

    // Phase 9: v3 is the only pipeline. Every screenplay file flows
    // through Migrations.migrate (v1.x / v2.x / v3 → latest v3) and
    // then nodeFromJSON against the v3 schema. selectSchema returns
    // a v3 schema for every registered doc-type that has one.
    if (Rga.Migrations && typeof Rga.Migrations.migrate === 'function'
        && Rga.DocTypes && typeof Rga.DocTypes.selectSchema === 'function') {
      const probeSchema = Rga.DocTypes.selectSchema(parsed);
      if (probeSchema) return _deserializeV3(parsed, handle);
    }

    // No schema route available — return a doc with body=null. v1.x files
    // arrive here too (they have no PM body to reconstruct); tab-manager
    // supplies an emptyDoc on mount.
    return _buildDocFromParsed(parsed, handle, null);
  }

  // Shared doc-shape assembly — same fields whether the body came from
  // the v3 pipeline, an explicit caller schema, or null (v1.x carrier files).
  function _buildDocFromParsed(parsed, handle, pmBody) {
    const metadata = parsed.metadata || {};
    if (!metadata.production_type) metadata.production_type = C.DEFAULT_PRODUCTION_TYPE;
    const settings = parsed.settings || defaultSettings();
    if (!settings.pageSetup)         settings.pageSetup       = defaultSettings().pageSetup;
    if (!settings.vocabulary)        settings.vocabulary      = defaultSettings().vocabulary;
    if (!settings.sceneHeadingStyle) settings.sceneHeadingStyle = 'twoLine';
    if (!settings.units)             settings.units           = 'in';
    // Print Contract V1 backfill — the explicit-schema load path (opts.schema)
    // bypasses the migration chain (tests + future doc-types), so ensure the
    // owned contract fields are present here too. Mirrors the v4→v5 migration so
    // every load path yields a complete, explicit print contract.
    if (typeof metadata.printContractVersion !== 'number') {
      metadata.printContractVersion = C.PRINT_CONTRACT_VERSION;
    }
    if (!metadata.screenplayProfile || typeof metadata.screenplayProfile !== 'object') {
      metadata.screenplayProfile = {
        language: typeof metadata.language === 'string' ? metadata.language : C.DEFAULT_SCRIPT_LANGUAGE,
        direction: _directionForLanguage(metadata.language),
        screenplayConvention: 'hollywood',
      };
    }
    if (typeof settings.show_scene_numbers !== 'boolean') settings.show_scene_numbers = true;
    if (settings.pageSetup) {
      const ps = settings.pageSetup;
      if (typeof ps.orientation !== 'string')        ps.orientation = 'portrait';
      if (typeof ps.pageNumbers !== 'boolean')       ps.pageNumbers = true;
      if (typeof ps.pageNumberPosition !== 'string') ps.pageNumberPosition = 'top_right';
    }
    return {
      docId: nextDocId(),
      handle: handle || null,
      displayName: basenameFromHandle(handle) || 'Untitled.rga',
      origin: handle ? 'disk' : 'untitled',
      dirty: false,
      lastSavedAt: null,
      rgaVersion: C.CURRENT_RGA_VERSION,
      documentType: parsed.document_type || 'screenplay',
      metadata: metadata,
      settings: settings,
      tagRegistry: parsed.tag_registry || emptyTagRegistry(),
      flagLog: parsed.flag_log || [],
      mergeLog: parsed.merge_log || [],
      exportSettings: parsed.export_settings || defaultExportSettings(),
      runtime: parsed.runtime || defaultRuntime(),
      body: pmBody
    };
  }

  // ---------------------------------------------------------------
  // Tag registry operations
  // ---------------------------------------------------------------

  // Map singular tagType → registry key (plural / special cases)
  const _registryKey = {
    character: 'characters', prop: 'props', wardrobe: 'wardrobe',
    location: 'locations', sfx: 'sfx', vfx: 'vfx',
    vehicle: 'vehicles', animal: 'animals', custom: 'custom',
  };

  function _registryList(doc, tagType) {
    const key = _registryKey[tagType] || (tagType + 's');
    if (!doc.tagRegistry[key]) doc.tagRegistry[key] = [];
    return doc.tagRegistry[key];
  }

  function addEntity(doc, tagType, attrs) {
    const list = _registryList(doc, tagType);
    const entity = {
      id: attrs.id || crypto.randomUUID(),
      name: attrs.name || '',
      color: attrs.color || null,
      notes: attrs.notes || '',
      // Semantic Entity Layer S0: aliases travel on the entity. Initialize an
      // empty list so every fresh entity carries the field (the resolver still
      // tolerates a missing one — see Rga.Tags.findOrCreateEntity).
      aliases: Array.isArray(attrs.aliases) ? attrs.aliases.slice() : [],
    };
    list.push(entity);
    return entity.id;
  }

  function findEntity(doc, tagType, id) {
    return _registryList(doc, tagType).find(function(e) { return e.id === id; }) || null;
  }

  function removeEntity(doc, tagType, id) {
    const key = _registryKey[tagType] || (tagType + 's');
    if (!doc.tagRegistry[key]) return false;
    const idx = doc.tagRegistry[key].findIndex(function(e) { return e.id === id; });
    if (idx === -1) return false;
    doc.tagRegistry[key].splice(idx, 1);
    return true;
    // Caller is responsible for removing tag marks from the PM document
    // via Rga.Tags.removeAllMarksForEntity(view, id)
  }

  // Semantic Entity Layer S1 — record a distinctive alias on a LIVE entity.
  // Alias ≠ Merge (DOCTRINE_LOCK Invariant IX): this NEVER creates a tombstone
  // or a second entity, NEVER writes merge_log. Uniqueness is over names ∪
  // aliases of LIVE entities within the type (DOCTRINE_LOCK §3); normalization
  // is the existing rule only (trim + case-insensitive) — no new scheme, no
  // pronoun logic (the caller/UI decides eligibility).
  // Returns { added: boolean, reason: 'added'|'duplicate'|'is-name'|'collision'
  //          |'tombstoned'|'no-entity'|'empty' }.
  function addAlias(doc, tagType, entityId, surface) {
    const trimmed = String(surface == null ? '' : surface).trim();
    if (!trimmed) return { added: false, reason: 'empty' };
    const norm = trimmed.toLowerCase();

    const entity = findEntity(doc, tagType, entityId);
    if (!entity) return { added: false, reason: 'no-entity' };
    if (entity.merged_into) return { added: false, reason: 'tombstoned' };
    if (String(entity.name || '').trim().toLowerCase() === norm) {
      return { added: false, reason: 'is-name' };
    }

    // Collision scan over LIVE entities only (tombstones never participate —
    // consumer rule C3). A hit on THIS entity's own alias is an idempotent
    // duplicate; a hit on any OTHER entity's name/alias is a collision.
    const live = liveEntities(doc, tagType);
    for (let i = 0; i < live.length; i += 1) {
      const e = live[i];
      const nameHit = String(e.name || '').trim().toLowerCase() === norm;
      const aliasHit = (Array.isArray(e.aliases) ? e.aliases : []).some(function(a) {
        return String(a || '').trim().toLowerCase() === norm;
      });
      if (nameHit || aliasHit) {
        return { added: false, reason: (e.id === entityId ? 'duplicate' : 'collision') };
      }
    }

    if (!Array.isArray(entity.aliases)) entity.aliases = [];
    entity.aliases.push(trimmed);
    markDirty(doc);
    return { added: true, reason: 'added' };
  }

  // ---------------------------------------------------------------
  // Registry merge operations — Identity Merge Slice B1.
  // Design: docs/Filmustageation/SCOPED_REGISTRY_MERGE_API_DESIGN.md
  // Policy: docs/Filmustageation/IDENTITY_MERGE_POLICY_AUDIT.md
  //
  // The controlled mutation surface for entity merging. Losers are
  // tombstoned (`merged_into` = survivor's id), NEVER deleted —
  // undo/redo can resurrect marks pointing at them, so their ids must
  // keep resolving. Compaction (final removal) is a separate, future,
  // separately-reviewed operation.
  //
  // Plugin code must never write registry state directly; every
  // registry mutation goes through these named, validated APIs.
  // ---------------------------------------------------------------

  // Entity fields the fold understands. Anything else is "unknown":
  // never copied to the survivor (survivor-wins rule for unknown
  // semantics), only reported so the merge log can preserve it.
  const _KNOWN_ENTITY_FIELDS = ['id', 'name', 'color', 'notes', 'merged_into', 'aliases'];

  function markEntityMerged(doc, tagType, loserId, survivorId) {
    if (!doc || !loserId || !survivorId || loserId === survivorId) return false;
    const loser = findEntity(doc, tagType, loserId);
    const survivor = findEntity(doc, tagType, survivorId);
    if (!loser || !survivor) return false;
    // The API never creates chains: merging INTO a tombstone is refused.
    if (survivor.merged_into) return false;
    // Idempotent re-merge into the same survivor; conflicting re-merge refused.
    if (loser.merged_into) return loser.merged_into === survivorId;
    loser.merged_into = survivorId;
    return true;
  }

  function foldEntityMetadata(doc, tagType, survivorId, loserId) {
    if (!doc || !survivorId || !loserId || survivorId === loserId) return null;
    const survivor = findEntity(doc, tagType, survivorId);
    const loser = findEntity(doc, tagType, loserId);
    if (!survivor || !loser) return null;
    // Tombstones never fold: refusing tombstoned losers is what prevents
    // double-folding (notes concatenating twice on a crash-recovery
    // re-run) and forces the documented call order: fold BEFORE mark.
    if (survivor.merged_into || loser.merged_into) return null;

    // color — survivor's stays if set; else the loser's moves over.
    let colorMoved = null;
    if (!survivor.color && loser.color) {
      survivor.color = loser.color;
      colorMoved = loser.color;
    }

    // notes — the loser's notes are never lost: appended with attribution.
    let notesAppended = false;
    if (loser.notes) {
      const attribution = '--- merged from "' + (loser.name || '') + '" (' + loserId + ') ---';
      survivor.notes = survivor.notes
        ? survivor.notes + '\n' + attribution + '\n' + loser.notes
        : attribution + '\n' + loser.notes;
      notesAppended = true;
    }

    // aliases — survivor keeps the UNION of both entities' aliases, deduped
    // case-insensitively. The loser's canonical NAME is NOT promoted to an
    // alias here (that is a merge-UX decision, deferred — see
    // SEMANTIC_ENTITY_LAYER_DOCTRINE_LOCK.md §4). Without this, aliases would
    // be classified "unknown" and silently lost on every merge.
    const _survAliases = Array.isArray(survivor.aliases) ? survivor.aliases : [];
    const _loserAliases = Array.isArray(loser.aliases) ? loser.aliases : [];
    if (_loserAliases.length > 0) {
      const seen = new Set(_survAliases.map(function(a) { return String(a).trim().toLowerCase(); }));
      const union = _survAliases.slice();
      _loserAliases.forEach(function(a) {
        const key = String(a).trim().toLowerCase();
        if (!seen.has(key)) { seen.add(key); union.push(a); }
      });
      survivor.aliases = union;
    }

    // unknown loser fields — reported, never copied.
    let unknownFields = null;
    Object.keys(loser).forEach(function(key) {
      if (_KNOWN_ENTITY_FIELDS.indexOf(key) !== -1) return;
      if (!unknownFields) unknownFields = {};
      unknownFields[key] = loser[key];
    });

    return {
      loser_name:     loser.name || '',
      color_moved:    colorMoved,
      notes_appended: notesAppended,
      unknown_fields: unknownFields
    };
  }

  function appendMergeLog(doc, record) {
    if (!doc || !record || typeof record !== 'object') return null;
    if (typeof record.tag_type !== 'string' || !record.tag_type) return null;
    if (!record.survivor || !record.survivor.id) return null;
    if (!Array.isArray(record.losers) || record.losers.length === 0) return null;
    if (!record.merged_at) record.merged_at = new Date().toISOString();
    if (!doc.mergeLog) doc.mergeLog = [];
    doc.mergeLog.push(record);
    return record;
  }

  function isEntityMerged(doc, tagType, entityId) {
    const ent = findEntity(doc, tagType, entityId);
    if (!ent) return null;
    return !!ent.merged_into;
  }

  function resolveEntityId(doc, tagType, entityId) {
    let current = findEntity(doc, tagType, entityId);
    if (!current) return null;
    // Chains can only come from hand-edited files (the API refuses to
    // create them) — follow defensively, with a cycle guard.
    const visited = new Set();
    while (current.merged_into) {
      if (visited.has(current.id)) return null;   // cycle: cannot resolve
      visited.add(current.id);
      current = findEntity(doc, tagType, current.merged_into);
      if (!current) return null;                  // dangling target: cannot resolve
    }
    return current.id;
  }

  function liveEntities(doc, tagType) {
    // The ONLY legal suggestion/listing source for UI surfaces — never
    // offer tombstones to the user (consumer rule C3).
    return _registryList(doc, tagType).filter(function(e) { return e && !e.merged_into; });
  }

  function addFlagLogEntry(doc, entry) {
    if (!doc.flagLog) doc.flagLog = [];
    doc.flagLog.push(entry);
  }

  function markDirty(doc) {
    doc.dirty = true;
    if (doc.metadata) {
      doc.metadata.modified = new Date().toISOString();
    }
    // Persistence Safety Contract §4 — autosave is triggered by every edit.
    if (Rga.Autosave && typeof Rga.Autosave.notifyChange === 'function') {
      Rga.Autosave.notifyChange(doc);
    }
  }

  function clearDirty(doc, savedAt) {
    doc.dirty = false;
    doc.lastSavedAt = savedAt || Date.now();
    // Persistence Safety Contract §4 — a manual save discards the snapshot.
    if (Rga.Autosave && typeof Rga.Autosave.notifyClean === 'function') {
      Rga.Autosave.notifyClean(doc);
    }
  }

  function rebindHandle(doc, handle) {
    doc.handle = handle;
    doc.origin = handle ? 'disk' : 'untitled';
    doc.displayName = basenameFromHandle(handle) || doc.displayName;
  }

  Rga.Doc = {
    create,
    serialize,
    deserialize,
    markDirty,
    clearDirty,
    rebindHandle,
    addEntity,
    findEntity,
    removeEntity,
    addAlias,
    markEntityMerged,
    foldEntityMetadata,
    appendMergeLog,
    isEntityMerged,
    resolveEntityId,
    liveEntities,
    addFlagLogEntry,
    _isAcceptedVersion: isAcceptedVersion,
    _isNewerThanSupported: isNewerThanSupported,
    _basenameFromHandle: basenameFromHandle,
    _registryKey,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rga.Doc;
  }
})();
