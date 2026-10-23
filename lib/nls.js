const isDevin = key => /^vs\/(sessions|platform\/agentHost|workbench\/contrib\/(agents|windsurf|chat|devin))/.test(key);
function extractNls(meta) {
  const result = {};
  for (const [module, messages] of Object.entries(meta.messages)) {
    if (!isDevin(module)) continue;
    const keys = meta.keys[module] || [];
    const entries = result[module] = {};
    messages.forEach((message, index) => {
      const item = keys[index], key = typeof item === 'string' ? item : item && item.key;
      if (typeof key !== 'string') throw new Error(`NLS key 缺失：${module}[${index}]`);
      entries[key] = message;
    });
  }
  return result;
}
module.exports = { extractNls };
