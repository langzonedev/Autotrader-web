/* Isolated public-client regression fixtures; no account or provider requests. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2] || __dirname + '/../app.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const profiles = [0, 50, 100].map(level => ({level, label: 'Fixture ' + level,
  maxPositionPct: '10', maxExposurePct: '20', cooldownMinutes: 60, drawdownStopPct: '5'}));
const status = (level, revision) => ({riskProfile: {...profiles.find(p => p.level === level), revision},
  riskProfiles: profiles, equityAud: '75', pnlAud: '0', cashAud: '75', paperEnabled: false,
  marketSource: 'synthetic', strategy: 'synthetic', message: 'Synthetic response only'});

function setup() {
  const elements = {}, pending = [];
  function element(id) {
    return elements[id] ||= {hidden: false, textContent: '', value: '', disabled: false, events: {},
      addEventListener(name, fn) { this.events[name] = fn; }, replaceChildren() {}, append() {}};
  }
  const context = {document: {hidden: false, getElementById: element,
    createElement: () => ({append() {}})}, window: {addEventListener() {}}, navigator: {},
    location: {protocol: 'http:', hostname: 'localhost', hash: ''},
    URL, Intl, AbortController, setTimeout, clearTimeout, setInterval() {},
    fetch: async (path, options) => path === '/api/session'
      ? {ok: false, status: 401, json: async () => ({error: 'Synthetic unauthenticated'})}
      : new Promise(resolve => pending.push({path, options, resolve}))};
  vm.createContext(context);
  vm.runInContext(source, context);
  return {elements, pending, run: code => vm.runInContext(code, context)};
}

function respond(request, body, code = 200) {
  request.resolve({ok: code >= 200 && code < 300, status: code, json: async () => body});
}
async function signedIn() {
  const harness = setup();
  await tick();
  harness.run('authenticated=true;csrf="synthetic-csrf";showLoggedIn(true)');
  harness.run('renderRisk(' + JSON.stringify(status(50, 7)) + ')');
  return harness;
}
function preview(harness, level = 100) {
  harness.elements.riskSlider.value = String(level);
  harness.elements.riskSlider.events.input();
}

async function draftPreserved() {
  const h = await signedIn();
  preview(h);
  assert.equal(h.pending.length, 0, 'Preview submitted a mutation');
  h.run('renderRisk(' + JSON.stringify(status(0, 8)) + ')');
  assert.equal(String(h.elements.riskSlider.value), '100', 'Polling discarded the unsaved choice');
  assert.equal(h.run('riskRevision'), 7, 'Polling hid a potential revision conflict');
  assert.equal(h.elements.riskApplied.textContent, 'Applied: Fixture 0');
}

async function pendingApplyThenLogout() {
  const h = await signedIn();
  preview(h);
  const apply = h.elements.riskApply.events.click();
  await tick();
  const mutation = h.pending.find(p => p.path === '/api/paper/profile');
  assert.equal(mutation.options.method, 'POST');
  assert.equal(mutation.options.headers['X-CSRF-Token'], 'synthetic-csrf');
  assert.deepEqual(JSON.parse(mutation.options.body), {level: 100, expectedRevision: 7});
  const logout = h.elements.logout.events.click();
  await tick();
  respond(h.pending.find(p => p.path === '/api/logout'), {authenticated: false});
  await logout;
  respond(mutation, {riskProfile: {...profiles[2], revision: 8}, executionEnabled: false});
  await apply;
  assert.equal(h.elements.dashboard.hidden, true);
  assert.equal(h.elements.riskCard.hidden, true);
  assert.equal(h.elements.riskName.textContent, '', 'Late mutation redisplayed private profile');
}

async function conflictRefreshesAuthority() {
  const h = await signedIn();
  preview(h);
  const apply = h.elements.riskApply.events.click();
  await tick();
  respond(h.pending.find(p => p.path === '/api/paper/profile'), {error: 'Synthetic revision conflict'}, 409);
  await tick();
  for (const request of h.pending.filter(p => p.path !== '/api/paper/profile')) {
    respond(request, request.path === '/api/status' ? status(0, 8) : request.path === '/api/markets'
      ? {markets: [], source: 'synthetic', asOf: null} : {trades: [], decisions: []});
  }
  await apply;
  assert.equal(String(h.elements.riskSlider.value), '0');
  assert.equal(h.run('riskRevision'), 8);
  assert.equal(h.run('riskDirty'), false);
  assert.equal(h.elements.riskApply.disabled, true);
  assert.equal(h.elements.riskMessage.textContent, 'Synthetic revision conflict');
}

async function expiredSessionClearsProfile() {
  const h = await signedIn();
  preview(h);
  const apply = h.elements.riskApply.events.click();
  await tick();
  respond(h.pending.find(p => p.path === '/api/paper/profile'), {error: 'Synthetic expired session'}, 401);
  await apply;
  assert.equal(h.elements.dashboard.hidden, true);
  assert.equal(h.elements.riskCard.hidden, true);
  assert.equal(h.elements.riskApplied.textContent, '');
  assert.equal(h.elements.riskApply.disabled, true);
}

(async () => {
  await draftPreserved();
  await pendingApplyThenLogout();
  await conflictRefreshesAuthority();
  await expiredSessionClearsProfile();
  console.log('PASS risk preview, authenticated revision mutation, conflict refresh, expiry and logout race');
})().catch(error => { console.error(error); process.exitCode = 1; });
