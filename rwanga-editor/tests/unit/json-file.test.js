// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { readJsonOrSeed, writeJsonAtomic } = require('../../electron/lib/json-file.js');

async function tmpDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'rwanga-jsonfile-'));
}

test('writeJsonAtomic creates the file with formatted JSON', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'data.json');
  await writeJsonAtomic(f, { a: 1, b: 'two' });
  const raw = await fs.readFile(f, 'utf8');
  assert.match(raw, /"a": 1/);
  assert.match(raw, /"b": "two"/);
});

test('writeJsonAtomic survives an interrupted write (temp file pattern)', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'data.json');
  await writeJsonAtomic(f, { x: 1 });
  const entries = await fs.readdir(dir);
  assert.deepEqual(entries.filter(e => e.endsWith('.tmp')), []);
});

test('readJsonOrSeed returns the parsed file when present and valid', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'data.json');
  await writeJsonAtomic(f, { hello: 'world' });
  const value = await readJsonOrSeed(f, { hello: 'default' });
  assert.deepEqual(value, { hello: 'world' });
});

test('readJsonOrSeed seeds the file when absent', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'data.json');
  const seed = { fresh: true };
  const value = await readJsonOrSeed(f, seed);
  assert.deepEqual(value, seed);
  const raw = await fs.readFile(f, 'utf8');
  assert.deepEqual(JSON.parse(raw), seed);
});

test('readJsonOrSeed backs up corrupt file and seeds fresh', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'data.json');
  await fs.writeFile(f, '{not json', 'utf8');
  const value = await readJsonOrSeed(f, { fresh: true });
  assert.deepEqual(value, { fresh: true });
  const entries = await fs.readdir(dir);
  const backup = entries.find(e => e.startsWith('data.json.bad-'));
  assert.ok(backup, 'expected a .bad-<ts> backup file');
  const backupContent = await fs.readFile(path.join(dir, backup), 'utf8');
  assert.equal(backupContent, '{not json');
});
