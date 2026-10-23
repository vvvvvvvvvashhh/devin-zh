// Runtime DOM layer, appended to the webview bundle as an isolated IIFE.
// It only rewrites the *data* of existing text nodes and a few display attributes
// (never adds/removes/moves nodes), so React reconciliation and app logic are untouched:
// JS string values stay English, only what is painted changes. Chat content, code,
// editors and inputs are skipped. Any error disables the layer, never the app.

/* eslint-disable no-var */
function zhRuntime(D, T) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || window.__devinZhDom) return;
  window.__devinZhDom = 1;
  var SKIP = [
    'pre', 'code', 'kbd', 'textarea', 'input', 'select', 'script', 'style', 'svg',
    '[contenteditable]:not([contenteditable="false"])', '[data-engine-markdown]', '.monaco-editor',
    // devin chat/transcript surfaces: prose & message bodies — never touch.
    // NOTE: bare "chat"/"message" patterns are too broad (the app root itself is
    // "chat-client-root") — only match specific content containers.
    '[class*="markdown"]', '[class*="prose"]', '[class*="messageContent"]', '[class*="messageText"]',
    '[class*="messageBody"]', '[class*="msgBody"]', '[class*="msgText"]', '[class*="userMessage"]',
    '[class*="assistantMessage"]', '[class*="chatMessage"]', '[class*="chatBody"]',
    '[class*="chatContent"]', '[class*="chatTranscript"]', '[class*="transcript"]',
    '[class*="Transcript"]', '[class*="conversation"]',
    '[class*="thinking"]', '[class*="Thinking"]', '[class*="toolBody"]', '[class*="output_"]',
    '[class*="bashCommand_"]', '[class*="commandText_"]', '[class*="fileName_"]', '[class*="sessionName_"]',
    '[class*="sessionTitle"]', '[class*="gitOutput"]', '[class*="mentionMirror_"]', '[class*="diffEditor"]',
    '[class*="codeBlock"]', '[class*="typedAnswer_"]', '[class*="questionText"]', '[class*="selectedTextPreview"]',
    '[data-zh-skip]', '.xterm', '[role="log"]',
  ].join(',');
  // whitelist: text only translated inside obvious UI chrome (nav/sidebar/menu/tabs/labels/buttons)
  var UI = [
    'nav', 'header', 'footer', 'menu', 'button', 'a', 'label', 'li', 'th',
    '[role="navigation"]', '[role="menubar"]', '[role="menu"]', '[role="menuitem"]',
    '[role="tab"]', '[role="tablist"]', '[role="tree"]', '[role="treeitem"]',
    '[role="listbox"]', '[role="option"]', '[role="button"]', '[role="link"]',
    '[role="toolbar"]', '[role="status"]', '[role="switch"]', '[role="checkbox"]',
    '[role="heading"]', '[role="separator"]', '[role="tooltip"]', '[role="dialog"]',
    '[role="complementary"]', '[class*="nav"]', '[class*="Nav"]', '[class*="sidebar"]',
    '[class*="Sidebar"]', '[class*="menu"]', '[class*="Menu"]', '[class*="tab"]',
    '[class*="Tab"]', '[class*="title"]', '[class*="Title"]', '[class*="label"]',
    '[class*="Label"]', '[class*="header"]', '[class*="Header"]', '[class*="button"]',
    '[class*="Button"]', '[class*="btn"]', '[class*="badge"]', '[class*="Badge"]',
    '[class*="chip"]', '[class*="Chip"]', '[class*="pill"]', '[class*="crumb"]',
    '[class*="section"]', '[class*="Section"]', '[class*="item"]', '[class*="Item"]',
    '[class*="footer"]', '[class*="Footer"]', '[class*="status"]', '[class*="Status"]', '.quota-bottom-action',
  ].join(',');
  var ATTRS = ['placeholder', 'title', 'aria-label', 'data-placeholder', 'aria-description', 'alt'];
  var hasOwn = Object.prototype.hasOwnProperty;

  // templates: "{0} days ago" -> anchored regex, with a literal hint for a cheap pre-check
  var tpl = [];
  for (var key in T) {
    if (!hasOwn.call(T, key)) continue;
    var parts = key.split(/\{(\d+)\}/), re = '^', order = [], hint = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2) { re += '([\\s\\S]+?)'; order.push(parts[i]); }
      else { re += parts[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (parts[i].length > hint.length) hint = parts[i]; }
    }
    if (hint.replace(/\s/g, '').length < 3) continue; // too generic to match safely
    var count = {}, cm, cre = /\{(\d+)\}\s*[个条项次份张位台篇处行字种轮天小分秒周月年](?![目理])/g;
    while ((cm = cre.exec(T[key]))) count[cm[1]] = 1;
    var generic = hint.replace(/\s/g, '').length < 16 && !/["'“]\{\d+\}["'”]/.test(key);
    tpl.push({ re: new RegExp(re + '$'), order: order, hint: hint, zh: T[key], count: count, identity: T[key] === key, generic: generic });
  }
  tpl.sort(function (a, b) { return Number(b.identity) - Number(a.identity) || b.hint.length - a.hint.length; });

  function tr(s) {
    if (!s || s.length > 600 || !/[A-Za-z]/.test(s)) return null;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
    for (var j = 0; j < tpl.length && tpl[j].identity; j++) if (tpl[j].re.test(core)) return s;
    if (hasOwn.call(D, s)) return D[s];
    if (core !== s && hasOwn.call(D, core)) return m[1] + D[core] + m[3];
    for (var j = 0; j < tpl.length; j++) {
      var t = tpl[j];
      if (core.indexOf(t.hint) < 0) continue;
      var r = t.re.exec(core);
      if (!r) continue;
      var vals = {};
      for (var g = 0; g < t.order.length; g++) vals[t.order[g]] = r[g + 1];
      // a placeholder must be a slot (name/number), not a prose clause —
      // generic patterns like "Open {0}" otherwise swallow whole sentences.
      var prose = false;
      for (var g = 0; g < t.order.length; g++)
        if (t.generic && /[A-Za-z]+ [A-Za-z]+ [A-Za-z]+ [A-Za-z]+/.test(vals[t.order[g]])) { prose = true; break; }
      if (prose) continue;
      // a captured value that is itself a standalone dict key means the text is
      // really "label + suffix" (e.g. "{0} file" on "Open file"), not a count —
      // reject, let exact matching handle it.
      // 计数模板（"{0} rules"→"{0} 条规则"）的槽位必须含数字，
      // 否则 "Manage rules" 会被译成 "Manage 条规则"、"Clipboard context" 成 "Clipboard 个上下文"
      var badCount = false;
      for (var g = 0; g < t.order.length; g++)
        if (t.count[t.order[g]] && !/\d/.test(vals[t.order[g]])) { badCount = true; break; }
      if (badCount) continue;
      var selfKey = false;
      for (var g = 0; g < t.order.length; g++)
        if (t.generic && hasOwn.call(D, vals[t.order[g]].trim())) { selfKey = true; break; }
      if (selfKey) continue;
      var out = t.zh.replace(/\{(\d+)\}/g, function (x, n) { return hasOwn.call(vals, n) ? vals[n] : x; });
      if (out.length > core.length * 4 + 40) return null; // runaway-expansion guard
      return m[1] + out + m[3];
    }
    return null;
  }

  function skipped(el) {
    return !el || !!el.closest(SKIP);
  }
  function inUiChrome(el) {
    return !!el && !!el.closest(UI);
  }
  var textEdits = new WeakMap(), attrEdits = new WeakMap(), compounds = new WeakMap();
  function resetCompound(el) {
    var group = compounds.get(el);
    if (!group) return;
    var intact = el.childNodes.length === group.nodes.length && group.nodes.every(function (n, i) {
      return el.childNodes[i] === n && n.data === group.outputs[i];
    });
    if (intact) return;
    compounds.delete(el);
    group.nodes.forEach(function (n, i) {
      if (n.data === group.outputs[i]) n.data = group.sources[i];
      textEdits.delete(n);
    });
  }
  function setText(n, value) {
    if (n.data !== value) { textEdits.set(n, { source: n.data, out: value }); n.data = value; }
  }
  function restoreZone(root) {
    function restoreText(n) {
      var edit = textEdits.get(n);
      if (edit && n.data === edit.out) n.data = edit.source;
      textEdits.delete(n);
    }
    function restoreAttrs(el) {
      var edits = attrEdits.get(el);
      if (edits) for (var key in edits) if (el.getAttribute(key) === edits[key].out) el.setAttribute(key, edits[key].source);
      attrEdits.delete(el);
    }
    if (root.nodeType === 3) { restoreText(root); return; }
    if (root.nodeType !== 1) return;
    restoreAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT), x;
    while ((x = w.nextNode())) { if (x.nodeType === 3) restoreText(x); else restoreAttrs(x); }
  }
  function canAttrs(el) {
    return !skipped(el.parentElement) && (!el.matches(SKIP) || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }
  // Join only adjacent text nodes belonging to ONE UI element. Never traverse
  // descendant elements: links, emphasis, code and user content keep their text.
  function tryElement(n) {
    var el = n.parentElement;
    if (!el || el.childNodes.length < 2 || el.children.length || !inUiChrome(el)) return false;
    var nodes = Array.prototype.slice.call(el.childNodes);
    if (nodes.some(function (x) { return x.nodeType !== 3 || textEdits.has(x); })) return false;
    var txt = el.textContent;
    if (!txt || txt.length > 250 || !hasOwn.call(D, txt) || D[txt] === txt) return false;
    var translated = tr(txt);
    if (translated == null || translated === txt) return false;
    compounds.set(el, { nodes: nodes, sources: nodes.map(function (x) { return x.data; }),
      outputs: nodes.map(function (x, i) { return i ? '' : translated; }) });
    nodes.forEach(function (x, i) { setText(x, i ? '' : translated); });
    return true;
  }
  function doText(n) {
    resetCompound(n.parentElement);
    if (!inUiChrome(n.parentElement)) { restoreZone(n); return; }
    var previous = textEdits.get(n);
    if (previous && n.data === previous.out) { dropPluralS(n); return; }
    textEdits.delete(n);
    if (tryElement(n)) return;
    var v = tr(n.data);
    if (v != null) setText(n, v);
    dropPluralS(n);
  }
  function dropPluralS(n) {
    // plural split: "MCP server" + "s" — clear a lone trailing "s" whether it
    // sits in the next text node or in a sibling element (also on re-scan)
    if (/[一-鿿]$/.test(n.data.trim())) {
      var nx = n.nextSibling;
      if (nx && nx.nodeType === 3 && nx.data.trim() === 's') { setText(nx, ''); return; }
      var parent = n.parentElement, ne = parent && parent.nextElementSibling;
      if (parent && parent.tagName === 'SPAN' && parent.parentElement &&
          parent.parentElement.matches('button,label,[role="menuitem"]') && ne && ne.tagName === 'SPAN' &&
          !skipped(ne) && ne.childNodes.length === 1 && ne.firstChild.nodeType === 3 && ne.firstChild.data.trim() === 's') setText(ne.firstChild, '');
    }
  }
  function doAttrs(el) {
    for (var k = 0; k < ATTRS.length; k++) {
      var a = el.getAttribute(ATTRS[k]);
      if (!a) continue;
      var edits = attrEdits.get(el) || {};
      if (edits[ATTRS[k]] && edits[ATTRS[k]].out === a) continue;
      var v = tr(a);
      if (v != null && v !== a) {
        edits[ATTRS[k]] = { source: a, out: v }; attrEdits.set(el, edits);
        el.setAttribute(ATTRS[k], v);
      }
    }
  }
  var FILTER = {
    acceptNode: function (x) {
      if (x.nodeType === 1 && x.matches(SKIP)) { restoreZone(x); if (canAttrs(x)) doAttrs(x); return NodeFilter.FILTER_REJECT; }
      return NodeFilter.FILTER_ACCEPT;
    },
  };
  function scan(root) {
    if (root.nodeType === 3) { if (skipped(root.parentElement)) restoreZone(root); else doText(root); return; }
    if (root.nodeType !== 1) return;
    if (skipped(root)) { restoreZone(root); if (canAttrs(root)) doAttrs(root); return; }
    doAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, FILTER), x;
    while ((x = w.nextNode())) { if (x.nodeType === 3) doText(x); else doAttrs(x); }
  }

  var broken = false;
  var obs = new MutationObserver(function (ms) {
    if (broken) return;
    try {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'childList') { resetCompound(m.target); for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]); }
        else if (m.type === 'characterData') scan(m.target);
        else if (m.type === 'attributes') {
          if (ATTRS.indexOf(m.attributeName) < 0) scan(m.target);
          else if (canAttrs(m.target)) doAttrs(m.target);
        }
      }
    } catch (e) { broken = true; obs.disconnect(); }
  });
  try {
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['class', 'contenteditable', 'data-zh-skip', 'data-engine-markdown', 'role']) });
    if (document.body) scan(document.body);
  } catch (e) { broken = true; obs.disconnect(); }
}

const asciiJson = o => JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

// split a flat {en: zh} map into exact entries and {n}-placeholder templates
function buildRuntime(map) {
  const D = {}, T = {};
  for (const [en, zh] of Object.entries(map)) {
    if (typeof zh !== 'string' || !zh) continue;
    if (/\{\d+\}/.test(en)) T[en] = zh; else D[en] = zh;
  }
  const code = '\n;(function(){try{(' + zhRuntime.toString() + ')(' + asciiJson(D) + ',' + asciiJson(T) + ')}catch(e){}})();\n';
  return { code, exact: Object.keys(D).length, templates: Object.keys(T).length };
}

module.exports = { buildRuntime, zhRuntime };
