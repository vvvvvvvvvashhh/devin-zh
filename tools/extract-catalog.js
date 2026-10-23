const fs = require('fs'), path = require('path');
const df = require('../lib/devin-files');
const { extractCatalogs } = require('../lib/catalogs');
const file = process.argv[2] || df.target(df.TARGETS[0]);
const source = require('../lib/patch-state').source(file).original;
const catalogs = extractCatalogs(source);
const dir = path.join(__dirname, '..', 'translations/catalogs');
fs.mkdirSync(dir, { recursive: true });
for (const [name, value] of Object.entries(catalogs)) {
  fs.writeFileSync(path.join(dir, `en.${name}.json`), JSON.stringify(value, null, 1));
  console.log(`已抽取英文目录 en.${name}.json`);
}
