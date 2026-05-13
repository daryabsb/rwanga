#!/usr/bin/env node
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
const esbuild = require('esbuild');
const path = require('path');

const entry = path.join(__dirname, '..', 'renderer', 'js', 'editor', 'bundle-entry.js');
const outfile = path.join(__dirname, '..', 'renderer', 'js', 'editor', 'bundle.js');

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [entry],
  bundle: true,
  outfile,
  format: 'iife',
  globalName: 'RgaProseMirror',
  platform: 'browser',
  target: ['chrome120'],
  sourcemap: true,
  logLevel: 'info'
};

if (watch) {
  esbuild.context(buildOptions).then(ctx => ctx.watch());
} else {
  esbuild.build(buildOptions).catch(() => process.exit(1));
}
