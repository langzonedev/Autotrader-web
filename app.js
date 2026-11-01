/* Public presentation contract only. Private authority stays on the server. */
const byId = id => document.getElementById(id);
const text = (id, value) => { byId(id).textContent = String(value); };
const aud = value => value == null ? '—' : new Intl.NumberFormat('en-AU', {style:'currency',currency:'AUD',maximumFractionDigits:2}).format(Number(value));
let csrf = '';
let generation = 0;
let refreshing = -1;
let authenticated = false;
async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, {credentials:'same-origin',cache:'no-store',signal:controller.signal,...options});
    let data;
    try { data = await response.json(); } catch { throw new Error('Backend returned an invalid response.'); }
    if (!response.ok) {
      const error = new Error(data.error || 'Backend unavailable');
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Connection timed out. Try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
function clearPrivate() {
  ['equity','pnl','cash','asOf'].forEach(id => text(id,'—'));
  ['markets','trades','decisions'].forEach(id => byId(id).replaceChildren());
}
function showLoggedIn(yes) {
  authenticated = yes;
  byId('login').hidden = yes;
  byId('dashboard').hidden = !yes;
  if (!yes) { csrf = ''; clearPrivate(); }
  text('connection', yes ? 'Private backend connected' : 'Sign in required');
}
function rowList(id, items, build, empty) {
  const list = byId(id);
  list.replaceChildren();
  if (!items.length) { const p = document.createElement('p'); p.textContent = empty; list.append(p); return; }
  for (const item of items) {
    const li = document.createElement('li');
    for (const value of build(item)) { const p = document.createElement('span'); p.textContent = value; li.append(p); }
    list.append(li);
  }
}
async function refresh() {
  const epoch = generation;
  if (refreshing === epoch) return;
  refreshing = epoch;
  byId('refresh').disabled = true;
  try {
    const [status, markets, trades] = await Promise.all([request('/api/status'),request('/api/markets'),request('/api/trades')]);
    if (epoch !== generation) return;
    showLoggedIn(true);
    text('equity',aud(status.equityAud));
    text('pnl',aud(status.pnlAud));
    text('cash',aud(status.cashAud));
    text('mode',status.paperEnabled ? 'Paper enabled' : 'Paper paused');
    text('source',status.marketSource);
    text('strategy',status.strategy);
    text('serverMessage',status.message);
    text('asOf', markets.asOf ? new Date(markets.asOf*1000).toLocaleString() : 'Awaiting first quote');
    text('marketCount', markets.markets.length + ' AUD markets · ' + markets.source);
    text('tradeCount', trades.trades.length + ' recent simulated fills');
    byId('paperStop').hidden = !status.paperEnabled;
    byId('paperResume').hidden = status.paperEnabled;
    rowList('markets',markets.markets,m => [m.symbol, 'Bid '+aud(m.bid), 'Ask '+aud(m.ask)],'No market observations yet. Start the private worker.');
    rowList('trades',trades.trades,t => [t.side.toUpperCase()+' '+t.symbol, t.quantity+' @ '+aud(t.price), 'Fee '+aud(t.fee), new Date(t.created*1000).toLocaleString(), 'Simulated #'+t.id], 'No simulated fills. The engine may be warming up or waiting for a signal within its limits.');
    rowList('decisions',trades.decisions,d => ['Quote #'+d.quote_id, d.reason], 'Decisions appear after the worker collects data.');
    text('dashboardError','');
  } catch (error) {
    if (epoch !== generation) return;
    if (error.status===401) { showLoggedIn(false); text('loginError','Your session expired. Sign in again.'); }
    else { clearPrivate(); text('connection','Connection lost · data unavailable'); text('dashboardError',error.message); }
    throw error;
  } finally { if (refreshing === epoch) { refreshing = -1; byId('refresh').disabled = false; } }
}
async function mutate(path) {
  return request(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{}'});
}
byId('loginForm').addEventListener('submit',async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  generation++;
  text('loginError','Signing in…');
  try {
    const result = await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:byId('password').value})});
    csrf = result.csrfToken;
    byId('password').value = '';
    text('loginError','');
    await refresh();
  } catch (error) { text('loginError',error.message); }
  finally { button.disabled = false; }
});
byId('logout').addEventListener('click',async () => {
  generation++;
  authenticated = false;
  clearPrivate();
  try { await mutate('/api/logout'); generation++; showLoggedIn(false); }
  catch (error) { generation++; authenticated = true; text('dashboardError','Sign out was not confirmed: '+error.message); }
});
byId('refresh').addEventListener('click',() => refresh().catch(() => {}));
for (const [id,path] of [['paperStop','stop'],['paperResume','resume']]) {
  byId(id).addEventListener('click',async () => {
    byId(id).disabled = true;
    try { await mutate('/api/paper/'+path); generation++; await refresh(); }
    catch (error) { text('dashboardError',error.message); }
    finally { byId(id).disabled = false; }
  });
}
async function restore() {
  const epoch = ++generation;
  try { const session = await request('/api/session'); if (epoch !== generation) return; csrf = session.csrfToken; await refresh(); }
  catch (error) { if (epoch !== generation) return; if (!authenticated) { showLoggedIn(false); if (error.status!==401) text('loginError','Private backend unavailable. Open the configured application URL.'); } }
}
restore();
setInterval(() => { if (authenticated && !document.hidden) refresh().catch(() => {}); },30000);
window.addEventListener('offline',() => { generation++; clearPrivate(); text('connection','Offline · connect to view private data'); });
window.addEventListener('online',() => { if (authenticated) refresh().catch(() => {}); });
window.addEventListener('pagehide',() => { generation++; clearPrivate(); });
window.addEventListener('pageshow',event => { if (event.persisted) restore(); });
if ('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
