// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeJsonAtomic(filePath, value) {
  await ensureDir(filePath);
  const tmp = filePath + '.tmp';
  const content = JSON.stringify(value, null, 2);
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, filePath);
}

function timestampSuffix() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
  );
}

async function readJsonOrSeed(filePath, seed) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      const backup = filePath + '.bad-' + timestampSuffix();
      try {
        await fs.rename(filePath, backup);
      } catch (renameErr) {
        // proceed without backup if rename fails
      }
      await writeJsonAtomic(filePath, seed);
      return seed;
    }
  } catch (readErr) {
    if (readErr.code === 'ENOENT') {
      await writeJsonAtomic(filePath, seed);
      return seed;
    }
    throw readErr;
  }
}

module.exports = { readJsonOrSeed, writeJsonAtomic };
