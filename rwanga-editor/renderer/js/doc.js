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
    const current = parseVersion(C.CURRENT_RGA_VERSION);
    return parsed.major > current.major || (parsed.major === current.major && parsed.minor > current.minor);
  }

  function basenameFromHandle(handle) {
    if (!handle) return null;
    const parts = String(handle).split(/[\\/]/);
    return parts[parts.length - 1] || handle;
  }

  function getSchema() {
    return (typeof window !== 'undefined')
      && window.Rga
      && window.Rga.DocTypes
      && window.Rga.DocTypes.screenplay
      && window.Rga.DocTypes.screenplay.schema
      || null;
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
      export_settings: doc.exportSettings,
      runtime: doc.runtime,
    };
    return JSON.stringify(fileObj, null, 2);
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

    const schema = (opts && opts.schema) || getSchema();
    let pmBody = null;

    const isV2 = fileVersion && String(fileVersion).startsWith('2.');

    if (isV2 && parsed.body && schema) {
      try {
        pmBody = schema.nodeFromJSON(parsed.body);
      } catch (err) {
        throw new Error('Document body is invalid: ' + err.message);
      }
    }
    // v1.x files: pmBody stays null; tab-manager will supply emptyDoc()

    // Migrate v1.x metadata fields
    const metadata = parsed.metadata || {};
    if (!metadata.production_type) metadata.production_type = C.DEFAULT_PRODUCTION_TYPE;

    return {
      docId: nextDocId(),
      handle: handle || null,
      displayName: basenameFromHandle(handle) || 'Untitled.rga',
      origin: handle ? 'disk' : 'untitled',
      dirty: false,
      lastSavedAt: null,
      rgaVersion: C.CURRENT_RGA_VERSION,
      documentType: parsed.document_type || 'screenplay',
      metadata,
      settings: parsed.settings || defaultSettings(),
      tagRegistry: parsed.tag_registry || emptyTagRegistry(),
      exportSettings: parsed.export_settings || defaultExportSettings(),
      runtime: parsed.runtime || defaultRuntime(),
      body: pmBody,
    };
  }

  function markDirty(doc) {
    doc.dirty = true;
    if (doc.metadata) {
      doc.metadata.modified = new Date().toISOString();
    }
  }

  function clearDirty(doc, savedAt) {
    doc.dirty = false;
    doc.lastSavedAt = savedAt || Date.now();
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
    _isAcceptedVersion: isAcceptedVersion,
    _isNewerThanSupported: isNewerThanSupported,
    _basenameFromHandle: basenameFromHandle,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rga.Doc;
  }
})();
