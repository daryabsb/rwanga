// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Playwright configuration — Rwanga IDE integration (Electron) tests.
//
// Run with:  npm run test:e2e
// Prerequisite: the renderer bundle must be built first
//   (`npm run build:renderer`) — these tests launch the real Electron app.
'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.js',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']]
});
