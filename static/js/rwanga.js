/* ════════════════════════════════════════════════════════
   RWANGA — Platform JS
   Handles: theme, sidebar state, HTMX hooks, WebSocket
   Stack: Django + HTMX + WebSocket (Django Channels)
   ════════════════════════════════════════════════════════ */

'use strict';

// ── THEME ────────────────────────────────────────────────
const RW_THEME_KEY = 'rw-theme';

function rwThemeInit() {
  const saved = localStorage.getItem(RW_THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.documentElement.setAttribute('data-bs-theme', saved);
  rwThemeUpdateIcon(saved);
}

function rwThemeToggle() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.setAttribute('data-bs-theme', next);
  localStorage.setItem(RW_THEME_KEY, next);
  rwThemeUpdateIcon(next);
}

function rwThemeUpdateIcon(theme) {
  document.querySelectorAll('.js-theme-toggle').forEach(el => {
    el.textContent = theme === 'dark' ? '☀' : '☽';
    el.title = theme === 'dark' ? 'گۆڕین بۆ ڕووناک' : 'گۆڕین بۆ تاریک';
  });
}

// ── SIDEBAR SCENE LIST ───────────────────────────────────
function rwSceneFilter(query) {
  const q = query.toLowerCase().trim();
  const grouped = document.getElementById('rw-group-toggle')?.checked;
  document.querySelectorAll('.rw-scene-item').forEach(item => {
    const text = item.textContent.toLowerCase();
    const visible = !q || text.includes(q);
    item.style.display = visible ? '' : 'none';
  });
  if (grouped) {
    document.querySelectorAll('.rw-scene-grp-label').forEach(grp => {
      const items = grp.nextElementSibling;
      const hasVisible = grp.parentElement.querySelectorAll('.rw-scene-item:not([style*="none"])').length;
      grp.style.display = hasVisible ? '' : 'none';
    });
  }
}

// ── HTMX HOOKS ──────────────────────────────────────────
document.addEventListener('htmx:beforeRequest', e => {
  // Show AI progress bar if this is an AI endpoint
  if (e.detail.requestConfig?.path?.startsWith('/ai/')) {
    document.querySelectorAll('.rw-ai-progress').forEach(el => el.style.display = '');
  }
});

document.addEventListener('htmx:afterRequest', e => {
  document.querySelectorAll('.rw-ai-progress').forEach(el => el.style.display = 'none');
});

// Swap animation
document.addEventListener('htmx:afterSwap', e => {
  e.target.style.opacity = '0';
  requestAnimationFrame(() => {
    e.target.style.transition = 'opacity 0.15s ease';
    e.target.style.opacity = '1';
  });
});

// ── WEBSOCKET — AI JOB STATUS ────────────────────────────
// Connect to Django Channels for real-time AI job updates
// ws path: /ws/ai-jobs/<project_id>/
class RWJobSocket {
  constructor(projectId) {
    this.projectId = projectId;
    this.ws = null;
    this.reconnectDelay = 2000;
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws/ai-jobs/${this.projectId}/`);

    this.ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), this.reconnectDelay);
    };
  }

  handleMessage(data) {
    // data shape: { type, job_id, status, progress, step, result }
    switch (data.type) {
      case 'job.progress':
        this.updateProgress(data.job_id, data.progress, data.step);
        break;
      case 'job.complete':
        this.onComplete(data.job_id, data.result);
        break;
      case 'job.error':
        this.onError(data.job_id, data.error);
        break;
      case 'notification':
        rwToast(data.message, data.level || 'info');
        break;
    }
  }

  updateProgress(jobId, progress, step) {
    const bar = document.querySelector(`[data-job-id="${jobId}"] .rw-ai-progress-fill`);
    const stepEl = document.querySelector(`[data-job-id="${jobId}"] .rw-ai-step`);
    if (bar) bar.style.width = `${progress}%`;
    if (stepEl) stepEl.textContent = step || '';
  }

  onComplete(jobId, result) {
    // Trigger HTMX refresh on the target element
    const target = document.querySelector(`[data-job-id="${jobId}"]`);
    if (target && target.dataset.refreshUrl) {
      htmx.ajax('GET', target.dataset.refreshUrl, { target: target.dataset.refreshTarget });
    }
    rwToast('AI کارەکەی تەواو کرد', 'success');
  }

  onError(jobId, error) {
    rwToast(`هەڵە: ${error}`, 'error');
  }
}

// ── TOAST SYSTEM ─────────────────────────────────────────
function rwToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.rw-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'rw-toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `rw-toast ${type}`;
  const icon = { success: '✓', error: '✕', info: '·' }[type] || '·';
  toast.innerHTML = `<span style="font-size:16px;font-weight:700">${icon}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ── SHOT TABLE ───────────────────────────────────────────
function rwToggleExpanded(shotId) {
  const row = document.getElementById(`rw-exp-${shotId}`);
  if (row) row.classList.toggle('open');
}

function rwFilterShots(filter, btn) {
  document.querySelectorAll('.rw-filter-row .rw-f-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.rw-shot-row').forEach(row => {
    if (filter === 'all') { row.style.display = ''; return; }
    const type = row.dataset.type;
    const mov  = row.dataset.movement;
    const show = (filter === type) || (filter === mov);
    row.style.display = show ? '' : 'none';
    // Also hide associated expanded row
    const expId = row.dataset.shotId;
    const expRow = document.getElementById(`rw-exp-${expId}`);
    if (expRow) expRow.style.display = 'none';
  });
}

// ── FLOOR PLAN ───────────────────────────────────────────
function rwHighlightSetup(letter, btn) {
  if (btn) {
    document.querySelectorAll('.rw-fp-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  document.querySelectorAll('.rw-cam-hit circle').forEach(c => {
    c.setAttribute('fill', c.closest('[data-setup]')?.dataset.setup === letter ? '#D4A574' : '#1F497D');
  });
  const detail = document.getElementById('rw-setup-detail');
  if (detail && letter) detail.dataset.active = letter;
}

// ── MODULE TABS ───────────────────────────────────────────
function rwShowTab(tabId) {
  document.querySelectorAll('.rw-mod-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.rw-tab-pane').forEach(p => p.classList.toggle('active', p.id === `rw-pane-${tabId}`));
  // Persist active tab in URL hash (for direct linking)
  history.replaceState(null, '', `#${tabId}`);
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  rwThemeInit();

  // Restore tab from URL hash
  const hash = location.hash.replace('#', '');
  if (hash && document.getElementById(`rw-pane-${hash}`)) {
    rwShowTab(hash);
  }

  // Init WebSocket if project context exists
  const projectId = document.body.dataset.projectId;
  if (projectId && typeof WebSocket !== 'undefined') {
    const sock = new RWJobSocket(projectId);
    sock.connect();
    window.rwJobSocket = sock;
  }

  // HTMX: add CSRF token to all requests
  document.body.addEventListener('htmx:configRequest', e => {
    const csrf = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    if (csrf) e.detail.headers['X-CSRFToken'] = csrf;
  });
});

// Expose public API
window.RW = { toast: rwToast, showTab: rwShowTab, toggleExpanded: rwToggleExpanded,
              filterShots: rwFilterShots, highlightSetup: rwHighlightSetup,
              themeToggle: rwThemeToggle, sceneFilter: rwSceneFilter };
