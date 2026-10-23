const placeholders = s => (s.match(/\{\{[^{}]+\}\}|\{\d+\}/g) || []).sort().join('\0');
function validPair(en, zh) {
  return typeof zh === 'string' && !!zh && placeholders(en) === placeholders(zh);
}
function validateRules(rules) {
  const custom = rules.customTranslations || {}, exclude = rules.exclude || [];
  if (!custom || typeof custom !== 'object' || Array.isArray(custom) || !Array.isArray(exclude) ||
      exclude.some(v => typeof v !== 'string')) throw new Error('自定义词典/排除列表格式不正确');
  for (const [en, zh] of Object.entries(custom)) if (!validPair(en, zh)) throw new Error(`自定义译文类型或占位符不匹配：${en}`);
}
// Serialized into the upstream bundle: this function must be standalone.
function overlayCatalog(en, zh, rules) {
  const custom = rules.customTranslations || {}, excluded = rules.exclude || [];
  function walk(source, translated) {
    if (typeof source === 'string') {
      const names = [];
      const normalized = source.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
        let index = names.indexOf(name);
        if (index < 0) { names.push(name); index = names.length - 1; }
        return '{' + index + '}';
      });
      if (excluded.includes(source) || excluded.includes(normalized)) return source;
      if (Object.prototype.hasOwnProperty.call(custom, source)) return custom[source];
      if (Object.prototype.hasOwnProperty.call(custom, normalized)) return custom[normalized].replace(/\{(\d+)\}/g,
        (match, index) => names[index] === undefined ? match : '{{' + names[index] + '}}');
      return translated;
    }
    if (!source || typeof source !== 'object') return translated;
    const out = Array.isArray(source) ? [] : {};
    for (const key of Object.keys(source)) {
      const value = walk(source[key], translated && translated[key]);
      if (value !== undefined) Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true });
    }
    return out;
  }
  return walk(en, zh);
}
function domRules(dict, rules) {
  validateRules(rules);
  const result = { ...dict };
  for (const [en, zh] of Object.entries(rules.customTranslations || {})) {
    const [key, value] = normalizePair(en, zh);
    Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
  }
  for (const en of rules.exclude || []) {
    const [key] = normalizePair(en, en);
    Object.defineProperty(result, key, { value: key, enumerable: true, writable: true, configurable: true });
  }
  return result;
}
function normalizePair(en, zh) {
  const names = [];
  const key = en.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
    let index = names.indexOf(name);
    if (index < 0) { names.push(name); index = names.length - 1; }
    return '{' + index + '}';
  });
  return [key, zh.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
    const index = names.indexOf(name);
    return index < 0 ? match : '{' + index + '}';
  })];
}
module.exports = { placeholders, validPair, validateRules, overlayCatalog, domRules, normalizePair };
