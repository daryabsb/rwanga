// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Atomically write `content` to `targetPath`: a complete temp file is
 * written and fsync'd, then renamed over the target. The target is never
 * opened for truncation, so a crash mid-write cannot corrupt it
 * (Persistence Safety Contract §3 — PF-04).
 *
 * @param {string} targetPath  full destination path
 * @param {string} content     file content
 * @param {{backup?: boolean}} [options]  backup:true rolls the previous
 *        version of an existing target into `<targetPath>.bak` before the
 *        rename. A failed backup copy is non-fatal (Contract §3, Amendment 1):
 *        the save still proceeds and the error is returned in `backupError`.
 * @returns {Promise<{backupError: Error|null}>}
 */
async function writeFileAtomic(targetPath, content, options) {
  options = options || {};
  const tmpPath = targetPath + '.tmp';

  // Ensure the destination directory exists.
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  // 1. Write the full content to the temp file and flush it to disk.
  const fh = await fs.open(tmpPath, 'w');
  try {
    await fh.writeFile(content, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }

  // 2. Roll the previous version into <target>.bak. Non-fatal (Amendment 1):
  //    a missing target is not an error; any other failure is recorded and
  //    the save still proceeds.
  let backupError = null;
  if (options.backup) {
    try {
      await fs.copyFile(targetPath, targetPath + '.bak');
    } catch (err) {
      if (!err || err.code !== 'ENOENT') backupError = err;
    }
  }

  // 3. Atomically replace the target.
  try {
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch (_) { /* temp already gone */ }
    throw err;
  }

  return { backupError };
}

module.exports = { writeFileAtomic };
