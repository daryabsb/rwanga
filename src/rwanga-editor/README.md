# Rwanga Script Editor

A professional, structured screenplay editor purpose-built for Kurdish and Arabic cinema. Open source under Apache 2.0.

## What it is

A VS Code–style desktop editor that writes a structured `.rga` (JSON) screenplay format. Built for the Kurdish/MENA film industry where standardization has been missing.

## Status

**Sub-project A v0.1 (alpha)** — Electron desktop app for Windows + macOS. Standalone use only; sign-in / sync with the Rwanga platform comes in sub-project B.

## Run from source

Requires Node.js 20+ and npm.

```
npm install
npm start
```

## Run tests

```
npm run test:unit
npm run test:e2e
```

## Package

```
npm run pack:win   # Windows NSIS installer
npm run pack:mac   # macOS .dmg + .zip
```

## Architecture

- **Electron main process** (`electron/`) — file I/O, OS dialogs, autosave, PDF export, auto-update.
- **Renderer** (`renderer/`) — vanilla HTML/CSS/JS prototype, multi-tab Document-scoped.
- **Cross-platform contract** — renderer only ever calls `window.rwanga.*`. The Electron preload bridge implements it locally; a future Rwanga platform web bridge will implement the same contract over the network.

See `docs/superpowers/specs/2026-05-12-rwanga-editor-subproject-a-design.md` in the parent repo for the full design.

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
