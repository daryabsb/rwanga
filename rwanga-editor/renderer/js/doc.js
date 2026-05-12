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

  function emptyBody(seedDefaults) {
    const now = new Date().toISOString();
    const seed = seedDefaults || {};
    return {
      rga_version: C.CURRENT_RGA_VERSION,
      metadata: {
        title: '',
        author: seed.author || '',
        created: now,
        modified: now,
        version: 1,
        revision_notes: '',
        language: seed.language || C.DEFAULT_SCRIPT_LANGUAGE,
        production_type: seed.production_type || C.DEFAULT_PRODUCTION_TYPE,
        genre: seed.genre || '',
        logline: '',
      },
      settings: {
        theme: 'dark',
        font_size: 12,
        show_scene_numbers: true,
        custom_tag_colors: {},
      },
      scenes: [],
      tag_registry: emptyTagRegistry(),
      export_settings: {
        branding: 'rwanga',
        letterhead_url: null,
        include_scene_numbers: true,
        include_revision_marks: false,
      },
      runtime: {
        last_cursor: null,
        ui_state: {},
      },
    };
  }

  function create(opts) {
    opts = opts || {};
    return {
      docId: nextDocId(),
      handle: null,
      displayName: opts.displayName || nextUntitledName(),
      origin: 'untitled',
      body: emptyBody(opts.seedDefaults),
      dirty: false,
      lastSavedAt: null,
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

  function backfill(body) {
    if (body && body.metadata) {
      if (typeof body.metadata.production_type === 'undefined') {
        body.metadata.production_type = C.DEFAULT_PRODUCTION_TYPE;
      }
    }
    return body;
  }

  function basenameFromHandle(handle) {
    if (!handle) return null;
    const parts = String(handle).split(/[\\/]/);
    return parts[parts.length - 1] || handle;
  }

  function serialize(doc) {
    return JSON.stringify(doc.body, null, 2);
  }

  function deserialize(content, handle) {
    let body;
    try {
      body = JSON.parse(content);
    } catch (err) {
      throw new Error('File is corrupt or invalid JSON: ' + err.message);
    }
    if (!body || typeof body !== 'object') {
      throw new Error('File is corrupt: not a JSON object');
    }
    if (isNewerThanSupported(body.rga_version)) {
      throw new Error(`This .rga was created with a newer Rwanga (v${body.rga_version}). Please update Rwanga to open it.`);
    }
    if (!isAcceptedVersion(body.rga_version)) {
      throw new Error(`Unsupported rga_version: ${body.rga_version}`);
    }
    backfill(body);
    return {
      docId: nextDocId(),
      handle: handle || null,
      displayName: basenameFromHandle(handle) || 'Untitled.rga',
      origin: handle ? 'disk' : 'untitled',
      body,
      dirty: false,
      lastSavedAt: null,
    };
  }

  function markDirty(doc) {
    doc.dirty = true;
    if (doc.body && doc.body.metadata) {
      doc.body.metadata.modified = new Date().toISOString();
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
