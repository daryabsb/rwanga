/* ============================================================
   RWANGA SCRIPT EDITOR — utils.js
   Shared utilities: ID generation, debounce, throttle,
   text helpers, cursor management, color helpers, formatters.
   ============================================================ */

window.Rga = window.Rga || {};

/* ============================================================
   ID GENERATION
   ============================================================ */
Rga._idCounter = 0;

/**
 * Generate a unique ID with a prefix.
 * @param {string} prefix - e.g. 'scene', 'tag', 'el', 'tab'
 * @returns {string}
 */
Rga.generateId = function(prefix) {
  prefix = prefix || 'id';
  return prefix + '-' + Date.now().toString(36) + '-' + (++Rga._idCounter).toString(36);
};

/* ============================================================
   DEBOUNCE & THROTTLE
   ============================================================ */

/**
 * Debounce: delay execution until `ms` after the last call.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
Rga.debounce = function(fn, ms) {
  var timer;
  return function() {
    var context = this;
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() {
      fn.apply(context, args);
    }, ms);
  };
};

/**
 * Throttle: execute at most once per `ms`.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
Rga.throttle = function(fn, ms) {
  var last = 0;
  return function() {
    var now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, arguments);
    }
  };
};

/* ============================================================
   TEXT HELPERS
   ============================================================ */

/**
 * Truncate text to maxLength, adding ellipsis.
 */
Rga.truncate = function(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '\u2026';
};

/**
 * Format a number with commas: 4231 → "4,231"
 */
Rga.formatNumber = function(n) {
  return n.toLocaleString('en-US');
};

/**
 * Convert a block type key to a display name.
 */
Rga.formatBlockTypeName = function(type) {
  var names = {
    'scene-header': 'Scene Header',
    'action': 'Action',
    'character': 'Character',
    'dialogue': 'Dialogue',
    'parenthetical': 'Parenthetical',
    'transition': 'Transition',
    'shot': 'Shot'
  };
  return names[type] || type;
};

/* ============================================================
   CURSOR UTILITIES (ContentEditable)
   ============================================================ */
Rga.Cursor = {};

/**
 * Get the .editor-block element that contains the current cursor.
 * @returns {HTMLElement|null}
 */
Rga.Cursor.getCurrentBlock = function() {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  var node = sel.anchorNode;
  if (!node) return null;
  var el = node.nodeType === 3 ? node.parentElement : node;
  if (!el) return null;
  return el.closest('.editor-block');
};

/**
 * Place the cursor at the very start of an element.
 * @param {HTMLElement} element
 */
Rga.Cursor.setToStart = function(element) {
  var range = document.createRange();
  var sel = window.getSelection();
  range.setStart(element, 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
};

/**
 * Place the cursor at the very end of an element.
 * @param {HTMLElement} element
 */
Rga.Cursor.setToEnd = function(element) {
  var range = document.createRange();
  var sel = window.getSelection();
  if (element.childNodes.length > 0) {
    var lastChild = element.childNodes[element.childNodes.length - 1];
    if (lastChild.nodeType === 3) {
      range.setStart(lastChild, lastChild.length);
    } else {
      range.setStartAfter(lastChild);
    }
  } else {
    range.setStart(element, 0);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
};

/**
 * Split the text content of a block at the current cursor position.
 * @param {HTMLElement} block
 * @returns {{ before: string, after: string }}
 */
Rga.Cursor.splitAtCursor = function(block) {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    return { before: block.textContent, after: '' };
  }

  var range = sel.getRangeAt(0);

  var beforeRange = document.createRange();
  beforeRange.setStart(block, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  var afterRange = document.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  if (block.childNodes.length > 0) {
    afterRange.setEndAfter(block.lastChild);
  } else {
    afterRange.setEnd(block, 0);
  }

  return {
    before: beforeRange.toString(),
    after: afterRange.toString()
  };
};

/**
 * Check if the cursor is at the very start of a block.
 * @param {HTMLElement} block
 * @returns {boolean}
 */
Rga.Cursor.isAtStart = function(block) {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  var range = sel.getRangeAt(0);
  if (!range.collapsed) return false;

  var testRange = document.createRange();
  testRange.setStart(block, 0);
  testRange.setEnd(range.startContainer, range.startOffset);
  return testRange.toString().length === 0;
};

/**
 * Check if the cursor is at the very end of a block.
 * @param {HTMLElement} block
 * @returns {boolean}
 */
Rga.Cursor.isAtEnd = function(block) {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  var range = sel.getRangeAt(0);
  if (!range.collapsed) return false;

  var testRange = document.createRange();
  testRange.setStart(range.endContainer, range.endOffset);
  if (block.childNodes.length > 0) {
    testRange.setEndAfter(block.lastChild);
  } else {
    testRange.setEnd(block, 0);
  }
  return testRange.toString().length === 0;
};

/**
 * Get the currently selected text.
 * @returns {string}
 */
Rga.Cursor.getSelectedText = function() {
  var sel = window.getSelection();
  if (!sel || sel.isCollapsed) return '';
  return sel.toString().trim();
};

/* ============================================================
   COLOR HELPERS
   ============================================================ */
Rga.Color = {};

/**
 * Parse a hex color to { r, g, b }.
 * @param {string} hex - e.g. '#4FC1FF'
 * @returns {{ r: number, g: number, b: number }}
 */
Rga.Color.hexToRgb = function(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
};

/**
 * Create an rgba string from hex + opacity.
 * @param {string} hex
 * @param {number} opacity - 0 to 1
 * @returns {string}
 */
Rga.Color.hexToRgba = function(hex, opacity) {
  var c = Rga.Color.hexToRgb(hex);
  return 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + (opacity || 0.18) + ')';
};

/**
 * Get the tag color for a type, respecting current theme.
 * @param {string} tagType - e.g. 'character', 'prop'
 * @returns {string} hex color
 */
Rga.Color.getTagColor = function(tagType) {
  var style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--tag-' + tagType).trim() || '#999999';
};

/**
 * Create a small colored dot element.
 * @param {string} color - hex color
 * @returns {HTMLElement}
 */
Rga.Color.createDot = function(color) {
  var dot = document.createElement('span');
  dot.className = 'menu-color-dot';
  dot.style.background = color;
  return dot;
};

/* ============================================================
   WORD & PAGE COUNT
   ============================================================ */

/**
 * Count words in the editor.
 * @param {HTMLElement} editorEl - the #editor element
 * @returns {number}
 */
Rga.getWordCount = function(editorEl) {
  var text = editorEl.textContent || '';
  var words = text.trim().split(/\s+/).filter(function(w) { return w.length > 0; });
  return words.length;
};

/**
 * Estimate page count. Industry standard: ~250 words per screenplay page.
 * @param {number} wordCount
 * @returns {number}
 */
Rga.estimatePageCount = function(wordCount) {
  return Math.max(1, Math.ceil(wordCount / 250));
};

/* ============================================================
   DOM HELPERS
   ============================================================ */

/**
 * Shortcut for querySelector.
 */
Rga.$ = function(selector, parent) {
  return (parent || document).querySelector(selector);
};

/**
 * Shortcut for querySelectorAll returning real Array.
 */
Rga.$$ = function(selector, parent) {
  return Array.from((parent || document).querySelectorAll(selector));
};

/**
 * Create an element with optional className and textContent.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
Rga.createElement = function(tag, className, text) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
};
