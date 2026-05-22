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

  function defaultMetadata(seed) {
    const now = new Date().toISOString();
    seed = seed || {};
    return {
      title: '',
      author: seed.author || '',
      created: now,
      modified: now,
      version: 1,
      revision_notes: '',
      language: seed.language || C.DEFAULT_SCRIPT_LANGUAGE,
      production_type: seed.production_type || C.DEFAULT_PRODUCTION_TYPE,
      genre: '',
      logline: '',
    };
  }

  function defaultSettings() {
    return {
      theme: 'dark',
      font_size: 12,
      font_family: 'Courier Prime',
      show_scene_numbers: true,
      page_size: 'Letter',
      pageSetup: {
        paperSize: 'Letter',
        margins: { top: 1, right: 1, bottom: 1, left: 1.5 },
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
