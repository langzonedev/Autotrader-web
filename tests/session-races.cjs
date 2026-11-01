/* Independent regression harness. Run: node tests/session-races.cjs [path/to/app.js] */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2] || __dirname+'/../app.js','utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const elements = {}, pending = [], listeners = {};
  function element(id) { return elements[id] ||= {hidden:false,textContent:'',disabled:false,events:{},children:[],
    addEventListener(type,fn) { this.events[type]=fn; },replaceChildren() { this.children=[]; },append(x) { this.children.push(x); }}; }
  const context = {document:{hidden:false,getElementById:element,createElement:()=>({textContent:'',append(){}})},
    window:{addEventListener(type,fn){listeners[type]=fn;}},navigator:{},location:{protocol:'http:',hostname:'localhost'},
    Intl,AbortController,setTimeout,clearTimeout,setInterval(){},fetch:async(path,options)=> {
      if(path==='/api/session') return {ok:false,status:401,json:async()=>({error:'unauthenticated'})};
      return new Promise(resolve=>pending.push({path,resolve}));
    }};
  vm.createContext(context); vm.runInContext(source,context);
  return {elements,pending,listeners,run:code=>vm.runInContext(code,context)};
}
const payloads = {
  '/api/status':{equityAud:'74',pnlAud:'-1',cashAud:'50',paperEnabled:true,marketSource:'coinspot-v2-public',strategy:'regime-v1',message:'Private data'},
  '/api/markets':{markets:[],source:'coinspot-v2-public',asOf:1},'/api/trades':{trades:[],decisions:[]},
  '/api/logout':{authenticated:false}
};
function resolve(item) { item.resolve({ok:true,status:200,json:async()=>payloads[item.path]}); }
async function beforeLogout() {
  const h=setup(); await tick(); h.run("authenticated=true;csrf='test';refresh();"); await tick();
  const logout=h.elements.logout.events.click(); await tick();
  resolve(h.pending.find(p=>p.path==='/api/logout')); await logout;
  assert.equal(h.elements.dashboard.hidden,true);
  h.pending.filter(p=>p.path!=='/api/logout').forEach(resolve); await tick();
  assert.equal(h.elements.dashboard.hidden,true,'Older refresh resurrected private dashboard after sign-out');
  assert.equal(h.elements.equity.textContent,'—');
}
async function duringLogout() {
  const h=setup(); await tick(); h.run("authenticated=true;csrf='test';showLoggedIn(true);");
  const logout=h.elements.logout.events.click(); await tick();
  // A visible refresh button or the polling timer can start another refresh during logout.
  h.run('refresh();'); await tick();
  resolve(h.pending.find(p=>p.path==='/api/logout')); await logout;
  assert.equal(h.elements.dashboard.hidden,true);
  h.pending.filter(p=>p.path!=='/api/logout').forEach(resolve); await tick();
  assert.equal(h.elements.dashboard.hidden,true,'Refresh begun during sign-out resurrected private dashboard');
  assert.equal(h.elements.equity.textContent,'—');
}
(async()=>{await beforeLogout();console.log('PASS refresh begun before logout');await duringLogout();console.log('PASS refresh begun during logout');})().catch(error=>{console.error(error.message);process.exitCode=1;});
