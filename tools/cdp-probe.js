// CDP probe: evaluate JS inside a target. Usage: node cdp-probe.js <wsUrl> <exprFile|expr>
const fs = require('fs');
const ws = new WebSocket(process.argv[2]);
const expr = process.argv[3] && fs.existsSync(process.argv[3]) ? fs.readFileSync(process.argv[3], 'utf8') : (process.argv[3] || 'document.title');
let id = 0;
const send = (method, params) => ws.send(JSON.stringify({ id: ++id, method, params }));
ws.onopen = () => send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id === id) { console.log(JSON.stringify(m.result?.result?.value ?? m.result?.exceptionDetails?.exception?.description ?? m.result ?? m, null, 1)?.slice(0, 6000)); process.exit(0); }
};
setTimeout(() => { console.log('timeout'); process.exit(1); }, 15000);
