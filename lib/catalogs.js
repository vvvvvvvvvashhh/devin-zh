const acorn = require('../node_modules/acorn');
function extractCatalogs(source) {
  const needle = 'JSON.parse(', found = {};
  for (let at = source.indexOf(needle); at >= 0; at = source.indexOf(needle, at + needle.length)) {
    const start = at + needle.length;
    if (!/['"`]/.test(source[start])) continue;
    let text;
    try {
      const node = acorn.parseExpressionAt(source, start, { ecmaVersion: 'latest' });
      if (node.type === 'Literal' && typeof node.value === 'string') text = node.value;
      if (node.type === 'TemplateLiteral' && node.expressions.length === 0) text = node.quasis[0].value.cooked;
    } catch (_) { continue; }
    if (!text || text.length < 20000) continue;
    let object;
    try { object = JSON.parse(text); } catch (_) { continue; }
    if (object.manageAccess?.accessLevel === 'Access level') found.translation = object;
    if (object.tabs?.changes === 'Changes') found.review = object;
  }
  if (!found.translation || !found.review) throw new Error('未找到英文 translation/review 目录；上游 bundle 结构可能已变化');
  return found;
}
module.exports = { extractCatalogs };
