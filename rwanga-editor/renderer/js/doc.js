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
    const current = parseVersion(C.CURRENT_RGA_VERSION);
    return parsed.major > current.major || (parsed.major === current.major && parsed.minor > current.minor);
  }

  function basenameFromHandle(handle) {
    if (!handle) return null;
    const parts = String(handle).split(/[\\/]/);
    return parts[parts.length - 1] || handle;
  }

  function getSchema(documentType) {
    if (typeof window === 'undefined' || !window.Rga) return null;
    const rga = window.Rga;
    documentType = documentType || 'screenplay';
    if (rga.Editor && typeof rga.Editor.activeSchema === 'function') {
      return rga.Editor.activeSchema(documentType);
    }
    return null;
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

    const documentType = (opts && opts.documentType) || (parsed && parsed.document_type) || 'screenplay';
    const schema = (opts && opts.schema) || getSchema(documentType);
    let pmBody = null;

    const isV2 = fileVersion && String(fileVersion).startsWith('2.');

    if (isV2 && parsed.body && schema) {
      try {
        const sceneMigrated = _migrateScenesToFrames(parsed.body);
        const fullyMigrated = _migrateSceneLineLocations(sceneMigrated);
        pmBody = schema.nodeFromJSON(fullyMigrated);
      } catch (err) {
        throw new Error('Document body is invalid: ' + err.message);
      }
    }
    // v1.x files: pmBody stays null; tab-manager will supply emptyDoc()

    // Migrate v1.x metadata fields
    const metadata = parsed.metadata || {};
    if (!metadata.production_type) metadata.production_type = C.DEFAULT_PRODUCTION_TYPE;

    const settings = parsed.settings || defaultSettings();
    if (!settings.pageSetup) settings.pageSetup = defaultSettings().pageSetup;
    if (!settings.vocabulary) settings.vocabulary = defaultSettings().vocabulary;
    if (!settings.sceneHeadingStyle) settings.sceneHeadingStyle = 'twoLine';
    if (!settings.units) settings.units = 'in';

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
      settings: settings,
      tagRegistry: parsed.tag_registry || emptyTagRegistry(),
      flagLog: parsed.flag_log || [],
      exportSettings: parsed.export_settings || defaultExportSettings(),
      runtime: parsed.runtime || defaultRuntime(),
      body: pmBody,
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
    addEntity,
    findEntity,
    removeEntity,
    addFlagLogEntry,
    _isAcceptedVersion: isAcceptedVersion,
    _isNewerThanSupported: isNewerThanSupported,
    _basenameFromHandle: basenameFromHandle,
    _registryKey,
    _migrateScenesToFrames: _migrateScenesToFrames,
    _migrateSceneLineLocations: _migrateSceneLineLocations,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rga.Doc;
  }
})();
