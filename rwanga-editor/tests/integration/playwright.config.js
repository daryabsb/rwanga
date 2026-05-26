// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Playwright configuration — Rwanga IDE integration (Electron) tests.
//
// Run with:  npm run test:e2e
// Prerequisite: the renderer bundle must be built first
//   (`npm run build:renderer`) — these tests launch the real Electron app.
'use strict';

const { defineConfig } = require('@playwright/test');

// H3: also discover specs under tests/e2e/ so the design constitution's
// preferred path (tests/e2e/settings/*.spec.js) is found by the same
// runner without forcing a layout migration of existing integration
// specs in this slice.
const path = require('path');

module.exports = defineConfig({
  testDir: path.resolve(__dirname, '..'),
  testMatch: ['integration/**/*.spec.js', 'e2e/**/*.spec.js'],
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']]
});
