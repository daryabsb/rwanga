// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.TitleBar — top strip showing "Rwanga • {script name} *".
// Plan §4.2. Reads from Rga.ScriptSession.activeScript (writer-context
// truth) — no direct TabManager reads. Mirrors text to document.title
// for OS window-chrome.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};
  Rga.Shell.TitleBar = Rga.Shell.TitleBar || {};

  let _titleEl = null;
  let _unsubscribeSession = null;

  function init(titleEl) {
    if (!titleEl) return false;
    _titleEl = titleEl;
    refresh();
    if (_unsubscribeSession) _unsubscribeSession();
    if (Rga.ScriptSession && typeof Rga.ScriptSession.subscribe === 'function') {
      _unsubscribeSession = Rga.ScriptSession.subscribe(function(next, prev) {
        // Only re-render when the activeScript field changed (calm by default).
        if (_activeScriptChanged(next.activeScript, prev.activeScript)) refresh();
      });
    }
    // Studio Shell Recovery — Workstream A3: wire owned window
    // controls. Locality of behaviour: the buttons live in the
    // title bar surface, so the title-bar module manages them.
    // Idempotent — safe to call multiple times (handlers added once).
    _wireWindowControls();
    // Studio Shell Recovery — Workstream A5: double-click on the
    // drag region → maximize / restore. Same IPC bridge as the
    // window-control button; no new transport.
    _wireDoubleClickMaximize();
    return true;
  }

  // Studio Shell Recovery — Workstream A5: double-click the title
  // bar's drag surface → window.rwanga.window.maximize() (the IPC
  // handler in electron/bridge/window-controls.js toggles maximize/
  // unmaximize on each call, so a second double-click restores).
  //
  // The dblclick listener is on the titlebar root, but we must not
  // fire when the user double-clicks an interactive child (a window
  // control, theme toggle, avatar, menu item — all already declared
  // as no-drag islands). Those children handle their own clicks;
  // the dblclick path is reserved for the drag surface itself.
  function _wireDoubleClickMaximize() {
    if (typeof document === 'undefined') return;
    const titlebar = document.getElementById('rga-shell-titlebar');
    if (!titlebar || titlebar.dataset.dblclickWired) return;
    titlebar.dataset.dblclickWired = '1';
    titlebar.addEventListener('dblclick', function(e) {
      // No-drag island? Ignore — the child owns the interaction.
      if (e.target.closest(
        '.rga-shell-window-control,' +
        '.rga-shell-titlebar-action,' +
        '.rga-shell-titlebar-avatar-placeholder,' +
        '.rga-shell-menubar-item,' +
        'button, input, select'
      )) return;
      if (typeof window !== 'undefined' && window.rwanga && window.rwanga.window &&
          typeof window.rwanga.window.maximize === 'function') {
        window.rwanga.window.maximize();
      }
    });
  }

  function _wireWindowControls() {
    if (typeof document === 'undefined') return;
    const minBtn   = document.getElementById('rga-shell-window-min');
    const maxBtn   = document.getElementById('rga-shell-window-max');
    const closeBtn = document.getElementById('rga-shell-window-close');
    // Inject vendored icons (Rga.Icons.{minimize, maximize, windowClose})
    // — same pattern as toast.js + bottom-panel close.
    const Icons = (typeof window !== 'undefined' && window.Rga && window.Rga.Icons) || {};
    if (minBtn   && !minBtn.dataset.wired)   { minBtn.innerHTML   = Icons.minimize    || '−'; minBtn.dataset.wired   = '1'; minBtn.addEventListener('click',   _onWindowMinimize); }
    if (maxBtn   && !maxBtn.dataset.wired)   { maxBtn.innerHTML   = Icons.maximize    || '□'; maxBtn.dataset.wired   = '1'; maxBtn.addEventListener('click',   _onWindowMaximize); }
    if (closeBtn && !closeBtn.dataset.wired) { closeBtn.innerHTML = Icons.windowClose || '×'; closeBtn.dataset.wired = '1'; closeBtn.addEventListener('click', _onWindowClose); }
    // Regression Fix §A + §B — subscribe to window state events so
    // the maximize button flips between □ (maximize) and ❐ (restore),
    // and body.window-maximized is applied for CSS compensation of
    // the Win11 frameless-overflow right-edge clip.
    _wireWindowStateSync(maxBtn);
  }

  // Regression Fix §A + §B helpers ----------------------------------

  function _applyMaximizeOverflow(overflow) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const root = document.documentElement;
    // Final Hardening — DPI-aware OS-extension overflow as CSS custom
    // properties. Main computes these from screen.getDisplayMatching()
    // vs win.getBounds() (both CSS-pixel values, scale-factor-aware).
    // When unmaximized OR when the IPC payload is absent, the props
    // are removed so the CSS rule's 8px fallback engages.
    if (overflow && typeof overflow === 'object') {
      root.style.setProperty('--rga-max-overflow-left',  (overflow.left  || 0) + 'px');
      root.style.setProperty('--rga-max-overflow-right', (overflow.right || 0) + 'px');
    } else {
      root.style.removeProperty('--rga-max-overflow-left');
      root.style.removeProperty('--rga-max-overflow-right');
    }
  }

  function _applyMaximizeState(maxBtn, isMax, overflow) {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('window-maximized', !!isMax);
    }
    // Apply or clear the DPI-aware overflow custom properties.
    if (isMax) _applyMaximizeOverflow(overflow);
    else       _applyMaximizeOverflow(null);
    if (!maxBtn) return;
    const Icons = (typeof window !== 'undefined' && window.Rga && window.Rga.Icons) || {};
    if (isMax) {
      maxBtn.innerHTML = Icons.restore || '❐';
      maxBtn.setAttribute('title',      'Restore');
      maxBtn.setAttribute('aria-label', 'Restore');
    } else {
      maxBtn.innerHTML = Icons.maximize || '□';
      maxBtn.setAttribute('title',      'Maximize');
      maxBtn.setAttribute('aria-label', 'Maximize');
    }
  }

  function _wireWindowStateSync(maxBtn) {
    if (typeof window === 'undefined' || !window.rwanga) return;
    // Subscribe to push events from main.
    if (window.rwanga.on && typeof window.rwanga.on.windowState === 'function') {
      window.rwanga.on.windowState(function(payload) {
        _applyMaximizeState(maxBtn,
          payload && payload.maximized,
          payload && payload.overflow);
      });
    }
    // Query initial state so a window booted maximized gets the
    // correct icon + body class without waiting for a state change.
    if (window.rwanga.window && typeof window.rwanga.window.getState === 'function') {
      Promise.resolve(window.rwanga.window.getState()).then(function(state) {
        _applyMaximizeState(maxBtn,
          state && state.maximized,
          state && state.overflow);
      }).catch(function() { /* non-Electron / test harness — silent. */ });
    }
  }
  // Route through the existing preload IPC bridge (electron/preload.js
  // exposes window.rwanga.window.{minimize,maximize,close}). Defensive
  // guards mean these are no-ops in non-Electron contexts (tests, web).
  function _onWindowMinimize() {
    if (typeof window !== 'undefined' && window.rwanga && window.rwanga.window && typeof window.rwanga.window.minimize === 'function') {
      window.rwanga.window.minimize();
    }
  }
  function _onWindowMaximize() {
    if (typeof window !== 'undefined' && window.rwanga && window.rwanga.window && typeof window.rwanga.window.maximize === 'function') {
      window.rwanga.window.maximize();
    }
  }
  function _onWindowClose() {
    if (typeof window !== 'undefined' && window.rwanga && window.rwanga.window && typeof window.rwanga.window.close === 'function') {
      window.rwanga.window.close();
    }
  }

  function refresh() {
    if (!_titleEl) return;
    const snap = (Rga.ScriptSession && typeof Rga.ScriptSession.get === 'function')
      ? Rga.ScriptSession.get() : null;
    const text = _composeTitleText(snap && snap.activeScript);
    _renderTitle(text, snap && snap.activeScript);
    // Mirror to OS window title.
    if (typeof document !== 'undefined') document.title = text.plain;
  }

  function _composeTitleText(activeScript) {
    if (!activeScript) {
      return { plain: 'Rwanga', script: null, dirty: false };
    }
    const name = activeScript.displayName || 'Untitled.rga';
    const dirty = !!activeScript.dirty;
    return {
      plain: dirty ? 'Rwanga • ' + name + ' *' : 'Rwanga • ' + name,
      script: name,
      dirty: dirty
    };
  }

  function _renderTitle(text, activeScript) {
    _titleEl.innerHTML = '';
    // Studio Shell Recovery — Workstream A2: the left-zone element
    // #rga-shell-titlebar-app statically owns "Rwanga" in markup.
    // This center zone (#rga-shell-titlebar-title) renders only the
    // script-identity content: script name + dirty asterisk, or
    // nothing when no script is open. Empty center is intentional —
    // the static "Rwanga" on the left carries app identity on its own.
    // The OS window title (document.title) continues to compose the
    // full "Rwanga • {script}" string for the taskbar.
    if (activeScript) {
      _appendSpan(_titleEl, 'rga-shell-titlebar-script-name', text.script || '');
      if (text.dirty) {
        const dirty = document.createElement('span');
        dirty.className = 'rga-shell-titlebar-dirty';
        dirty.setAttribute('aria-label', 'Unsaved changes');
        dirty.textContent = '*';
        _titleEl.appendChild(dirty);
      }
    }
    // §B Shell Final Polish — full title available via hover tooltip
    // (the script-name span truncates with ellipsis when it exceeds
    // the center zone). Cleared when no script is open.
    if (activeScript) {
      _titleEl.setAttribute('title', text.plain);
    } else {
      _titleEl.removeAttribute('title');
    }
  }

  function _appendText(parent, text) {
    parent.appendChild(document.createTextNode(text));
  }
  function _appendSpan(parent, cls, text) {
    const sp = document.createElement('span');
    sp.className = cls;
    sp.textContent = text;
    parent.appendChild(sp);
  }

  function _activeScriptChanged(a, b) {
    if (a === b) return false;
    if (a == null || b == null) return true;
    return a.docId !== b.docId || a.displayName !== b.displayName || a.dirty !== b.dirty;
  }

  function _reset() {
    if (_unsubscribeSession) { _unsubscribeSession(); _unsubscribeSession = null; }
    // A2: center zone resets to empty (left-zone "Rwanga" is static
    // markup, untouched here).
    if (_titleEl) _titleEl.innerHTML = '';
    _titleEl = null;
  }

  Rga.Shell.TitleBar.init    = init;
  Rga.Shell.TitleBar.refresh = refresh;
  Rga.Shell.TitleBar._reset  = _reset;
})();
