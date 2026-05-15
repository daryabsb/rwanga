// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INDEX_HTML = path.join(__dirname, '..', '..', '..', 'renderer', 'index.html');

test('index.html loads doc-type-registry before screenplay/index.js', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const reg  = html.indexOf('framework/doc-type-registry.js');
  const sp   = html.indexOf('doc-types/screenplay/index.js');
  assert.ok(reg > -1, 'doc-type-registry.js tag missing');
  assert.ok(sp  > -1, 'screenplay/index.js tag missing');
  assert.ok(reg < sp, 'doc-type-registry must load before screenplay/index.js');
});

test('index.html loads outer-schema-additions and scene-frame-placeholder before screenplay/index.js', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const out  = html.indexOf('outer-schema-additions.js');
  const ph   = html.indexOf('scene-frame-placeholder.js');
  const sp   = html.indexOf('doc-types/screenplay/index.js');
  assert.ok(out < sp, 'outer-schema-additions must load before screenplay/index.js');
  assert.ok(ph  < sp, 'scene-frame-placeholder must load before screenplay/index.js');
});

test('index.html does NOT reference the deleted screenplay files', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  assert.equal(html.indexOf('screenplay/schema.js'), -1, 'schema.js must be removed');
  assert.equal(html.indexOf('screenplay/keymap.js'), -1, 'keymap.js must be removed');
  assert.equal(html.indexOf('plugins/active-scene.js'), -1, 'active-scene.js must be removed');
  assert.equal(html.indexOf('plugins/scene-line-node-view.js'), -1, 'scene-line-node-view.js must be removed');
});
