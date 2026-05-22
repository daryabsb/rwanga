// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { writeFileAtomic } = require('../../../electron/lib/atomic-write.js');

async function tmpDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'rwanga-atomic-'));
}

test('writeFileAtomic creates a new file with the exact content', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await writeFileAtomic(f, 'hello');
  assert.equal(await fs.readFile(f, 'utf8'), 'hello');
});

test('writeFileAtomic overwrites an existing file', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await fs.writeFile(f, 'OLD', 'utf8');
  await writeFileAtomic(f, 'NEW');
  assert.equal(await fs.readFile(f, 'utf8'), 'NEW');
});

test('writeFileAtomic leaves no .tmp file behind on success', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await writeFileAtomic(f, 'data');
  const entries = await fs.readdir(dir);
  assert.deepEqual(entries.filter((e) => e.endsWith('.tmp')), []);
});

test('writeFileAtomic overwrites a stale leftover .tmp file', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await fs.writeFile(f + '.tmp', 'STALE GARBAGE', 'utf8');
  await writeFileAtomic(f, 'clean');
  assert.equal(await fs.readFile(f, 'utf8'), 'clean');
});

test('writeFileAtomic creates missing parent directories', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'nested', 'deep', 'doc.rga');
  await writeFileAtomic(f, 'data');
  assert.equal(await fs.readFile(f, 'utf8'), 'data');
});

test('writeFileAtomic throws on a rename failure and leaves no .tmp', async () => {
  const dir = await tmpDir();
  // Target path is an existing directory — rename(file, dir) fails.
  const f = path.join(dir, 'occupied');
  await fs.mkdir(f);
  await assert.rejects(() => writeFileAtomic(f, 'data'));
  const entries = await fs.readdir(dir);
  assert.deepEqual(entries.filter((e) => e.endsWith('.tmp')), []);
});

test('writeFileAtomic with backup rolls the previous version into .bak', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await fs.writeFile(f, 'VERSION ONE', 'utf8');
  const result = await writeFileAtomic(f, 'VERSION TWO', { backup: true });
  assert.equal(await fs.readFile(f, 'utf8'), 'VERSION TWO');
  assert.equal(await fs.readFile(f + '.bak', 'utf8'), 'VERSION ONE');
  assert.equal(result.backupError, null);
});

test('writeFileAtomic with backup makes no .bak for a brand-new file', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  const result = await writeFileAtomic(f, 'first', { backup: true });
  assert.equal(await fs.readFile(f, 'utf8'), 'first');
  await assert.rejects(() => fs.access(f + '.bak'));
  assert.equal(result.backupError, null);
});

test('writeFileAtomic backup failure is non-fatal — the save still succeeds', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await fs.writeFile(f, 'OLD', 'utf8');
  // Occupy the .bak path with a directory so the backup copy must fail.
  await fs.mkdir(f + '.bak');
  const result = await writeFileAtomic(f, 'NEW', { backup: true });
  assert.equal(await fs.readFile(f, 'utf8'), 'NEW');   // save still succeeded
  assert.ok(result.backupError, 'backupError should be set');
});
