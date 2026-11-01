const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname,'..');
const events = {};
const context = {URL,Set,self:{registration:{scope:'https://private.example/'},addEventListener:(name,fn)=>events[name]=fn}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
for (const url of ['https://private.example/api/status','https://private.example/api/trades',
                   'https://private.example/private.json','https://other.example/app.js',
                   'https://private.example/app.js?private=1']) {
  let intercepted = false;
  events.fetch({request:{method:'GET',url},respondWith(){intercepted=true;}});
  assert.equal(intercepted,false,'Private or non-allowlisted response intercepted: '+url);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root,icon.src)));
assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'));
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const js = fs.readFileSync(path.join(root,'app.js'),'utf8');
assert.ok(!/innerHTML|localStorage|sessionStorage|127\.0\.0\.1:8765/.test(js));
for (const match of js.matchAll(/(?:byId|text)\('([^']+)'/g)) {
  assert.ok(html.includes(`id="${match[1]}"`),'Missing DOM target '+match[1]);
}
console.log('PASS exact shell cache boundary, icons and DOM contract');
