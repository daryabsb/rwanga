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
    return true;
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
