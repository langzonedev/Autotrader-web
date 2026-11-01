# AutoTrader Web — Lang Systems

Public-source PWA presentation for a private paper-trading research backend. It contains no strategies, exchange credentials, password verifier, live order capability or actual account data. The backend supplies authenticated observed markets and explicitly simulated balances/trades.

## Launch

Use the same-origin launch in the private `langzonedev/Autotrader` README. Set its `AUTOTRADER_WEB_ROOT` to this checkout and open `http://localhost:8765/` for local development, or the configured trusted HTTPS origin for private staging. The frontend requests relative `/api/*` paths. A separate static HTTP server/GitHub Pages cannot provide the authenticated backend.

The dashboard restores server sessions, displays observed bid/ask quotes and their observation time, simulated total P&L/cash, fills and recent decisions. Pause/resume applies only to paper trading. It polls while visible every 30 seconds. Connection failure removes financial values; private responses never enter localStorage, sessionStorage or Cache Storage. Logout is confirmed by the server; stale in-flight responses cannot redisplay the signed-out dashboard.

The service worker caches only an exact allowlist of public shell assets. API data requires network access; offline shell does not mean an available engine or live quotes. Close existing tabs then reopen for a waiting shell update. Icons include 192/512 PNGs. Physical Android installation and upgrade from the previous cache remain acceptance gates, not established by a manifest check.

## Checks

```bash
node --check app.js
node --check sw.js
node tests/privacy.cjs
node tests/session-races.cjs
```

CI runs these checks. Tests use generic synthetic response fixtures only. The cloud-browser preview inspected the disconnected public shell; it did not run on a Samsung phone or verify hosted backend authentication. No remote deployment was created by this commit.

The login form protects no static source. Real authorisation is server-side. Keep private data, provider account configuration and proprietary trading logic in the private repository. See its operations/evidence documents for TLS, sessions, backup and paper-model limitations.
