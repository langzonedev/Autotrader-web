/* Public presentation only; no credentials or proprietary strategy logic. */
const API_BASE = "http://127.0.0.1:8765";
const byId = (id) => document.getElementById(id);
async function request(path, options = {}) {
  const response = await fetch(API_BASE + path, {credentials:"include", cache:"no-store", ...options});
  let data = {};
  try { data = await response.json(); } catch { throw new Error("Invalid response from private backend"); }
  if (!response.ok) throw new Error(data.error || "Backend unavailable");
  return data;
}
function showLoggedIn(yes) {
  byId("login").hidden = yes;
  byId("dashboard").hidden = !yes;
  byId("connection").textContent = yes ? "Backend connected · Private" : "Offline / not connected";
}
function text(id, value) { byId(id).textContent = String(value); }
async function refresh() {
  const [status, markets, trades] = await Promise.all([
    request("/api/status"), request("/api/markets"), request("/api/trades")
  ]);
  showLoggedIn(true);
  text("equity", status.equityAud == null ? "—" : "A$" + Number(status.equityAud).toFixed(2));
  text("pnl", status.pnlAud == null ? "—" : "A$" + Number(status.pnlAud).toFixed(2));
  text("mode", status.mode === "paper" ? "Paper" : "Disabled");
  text("source", status.marketSource || "Not connected");
  text("strategy", status.strategy || "Not configured");
  text("serverMessage", status.message || "Awaiting market feed.");
  text("marketCount", markets.markets.length ? markets.markets.length + " markets" : "No market feed");
  text("tradeCount", trades.trades.length ? trades.trades.length + " paper trades" : "No trades");
}
byId("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  text("loginError", "");
  try {
    await request("/api/login", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:byId("password").value})});
    byId("password").value = "";
    await refresh();
  } catch (error) { text("loginError", error.message || "Unable to connect"); }
  finally { button.disabled = false; }
});
byId("logout").addEventListener("click", async () => {
  try { await request("/api/logout", {method:"POST"}); } catch {}
  showLoggedIn(false);
});
refresh().catch(() => showLoggedIn(false));
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
