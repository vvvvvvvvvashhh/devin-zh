// Batch-translate todo-en.json -> api-zh.json via an Anthropic-compatible API.
// Resumable: merges into api-zh.json incrementally; rerun continues.
// Usage: node tools/translate-batch.js [concurrency]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validPair } = require('../lib/rules');
const D = path.join(__dirname, '..', 'translations');
const TODO_FILE = process.argv[3] ? '/' + process.argv[3] : (fs.existsSync(D + '/todo-en.filtered.json') ? '/todo-en.filtered.json' : '/todo-en.json');
const todo = JSON.parse(fs.readFileSync(D + TODO_FILE, 'utf8'));
console.log('todo file:', TODO_FILE);
const seed = { ...JSON.parse(fs.readFileSync(D + '/built-in.json', 'utf8')),
  ...JSON.parse(fs.readFileSync(D + '/corrections.json', 'utf8')) };
let done = {};
try { done = JSON.parse(fs.readFileSync(D + '/api-zh.json', 'utf8')); } catch (e) { }
for (const [en, zh] of Object.entries(done)) if (!validPair(en, zh)) delete done[en];
const queue = todo.filter(s => seed[s] === undefined && done[s] === undefined);
console.log('todo:', todo.length, '| seeded:', Object.keys(seed).length, '| already done:', Object.keys(done).length, '| queued:', queue.length);
if (!queue.length) { console.log('nothing to do'); process.exit(0); }

// 优先读环境变量，缺省时回退 ~/.claude/settings.json 的 env 段
let senv = {};
try { senv = JSON.parse(fs.readFileSync(os.homedir() + '/.claude/settings.json', 'utf8')).env || {}; } catch (e) { }
const pick = k => process.env[k] || senv[k] || '';
const BASE = (pick('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com').replace(/\/$/, '');
const KEY = pick('ANTHROPIC_AUTH_TOKEN') || pick('ANTHROPIC_API_KEY');
const MODEL = pick('DEVIN_ZH_MODEL') || pick('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';
if (!KEY) { console.log('缺少 ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY'); process.exit(1); }
const BATCH = 40, CONC = parseInt(process.argv[2] || '6', 10);
if (!Number.isInteger(CONC) || CONC < 1 || CONC > 32) throw new Error('并发必须为 1–32 的整数');
const OUT = D + '/api-zh.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(batch, attempt) {
  const prompt = '你是软件 UI 本地化专家。把下列 VS Code 风格界面英文翻成简体中文，要求简洁、符合中文软件习惯（如 Session→会话、Setup→设置/初始化按语境）。原样保留 {0}、{1}、{{name}} 等占位符与 \\n 转义。只输出 JSON 对象 {"原串":"译文"}，不要多余文字，不要代码围栏。\n' + JSON.stringify(batch);
  const r = await fetch(BASE + '/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const text = (j.content || []).map(c => c.text || '').join('');
  const translated = extractJson(text);
  for (const en of batch) if (!validPair(en, translated[en])) throw new Error('机翻缺项或占位符损坏：' + en);
  return translated;
}

// Never salvage fragments from invalid JSON: quoted labels were silently cut
// off by the old regular-expression recovery and then persisted as successes.
function extractJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const out = JSON.parse(t);
  if (!out || typeof out !== 'object' || Array.isArray(out)) throw new Error('机翻结果必须是完整 JSON 对象');
  return out;
}

let wrote = 0, failed = 0, idx = 0;
const t0 = Date.now();
function save() { fs.writeFileSync(OUT + '.tmp', JSON.stringify(done)); fs.renameSync(OUT + '.tmp', OUT); }
async function worker(id) {
  while (idx < queue.length) {
    const batch = queue.slice(idx, idx + BATCH); idx += batch.length;
    for (let a = 0; a < 4; a++) {
      try {
        const res = await call(batch, a);
        for (const [k, v] of Object.entries(res)) { if (batch.includes(k) && typeof v === 'string' && v && v !== k) done[k] = v; }
        const missed = batch.filter(k => done[k] === undefined);
        if (missed.length) for (const s of missed) { // per-item fallback once
          try { const r2 = await call([s], 0); for (const [k, v] of Object.entries(r2)) if (k === s && v && v !== s) done[k] = v; } catch (e) { }
        }
        wrote += batch.length;
        if (wrote % 200 < BATCH) { save(); console.log(`done ${Object.keys(done).length}/${todo.length} elapsed ${(Date.now() - t0) / 60000 | 0}m`); }
        break;
      } catch (e) {
        if (a === 3) {
          // last resort: split in halves — usually one poison string kills the batch
          if (batch.length > 1) {
            for (const half of [batch.slice(0, batch.length >> 1), batch.slice(batch.length >> 1)]) {
              try {
                const res = await call(half, 0);
                for (const [k, v] of Object.entries(res)) { if (half.includes(k) && typeof v === 'string' && v && v !== k) done[k] = v; }
              } catch (e2) { failed += half.length; }
            }
          } else failed += batch.length;
          console.log('batch failed:', e.message);
        }
        else await sleep(1500 * (a + 1));
      }
    }
    if (idx % (BATCH * CONC * 3) === 0) save();
  }
}
(async () => {
  await Promise.all(Array.from({ length: CONC }, (_, i) => worker(i)));
  save();
  console.log('FINISHED translated:', Object.keys(done).length, 'failed-batches:', failed);
  if (queue.some(en => !validPair(en, done[en]))) process.exitCode = 1;
})();
