// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Explicit config for the S3.3 / PF-13 console audit. Kept separate so the
// audit never joins the e2e suite — run it with:
//   npx playwright test --config=tests/diagnostics/s3.3-console-audit/playwright.config.js
'use strict';

const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['*.spec.js'],
  timeout: 180000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']]
});
