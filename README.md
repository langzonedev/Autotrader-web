# AutoTrader Web — Lang Systems

Public-source, private-data PWA for the Lang Systems AutoTrader. No trading algorithms, exchange credentials, passwords or account details are included. All sensitive data must come from the authenticated private backend.

## Local preview

1. Start private `langzonedev/Autotrader` backend using its README.
2. From this repository run `python3 -m http.server 8080`.
3. Open `http://localhost:8080`, enter backend password.
4. Dashboard will show **not connected**, not invented price, balance or profit.

The frontend defaults to `http://127.0.0.1:8765` for local development. Edit `API_BASE` in `app.js` only for a trusted HTTPS deployment; consider a same-origin reverse proxy as preferred. Never place API credentials or password hashes in public assets.

**Hosting limitation:** GitHub Pages publishes static source and assets to the public. The login UI is not a security boundary for the static content; security is enforced by the private backend. Remote cross-site cookie hosting requires carefully reviewed CORS/cookie/CSRF deployment design. Do not put sensitive information into public GitHub Pages builds or offline caches.

Brand: Lang Systems design tokens and clean phone-first UI. Current status: source-ready for local validation, not deployed, no live connection.
