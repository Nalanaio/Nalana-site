Local acceptance uses synthetic credentials and disposable data. Do not load production dotenv files.

Run the real cross-repository acceptance from the website worktree in PowerShell:

```powershell
$env:NALANA_FIXTURE_BACKEND_ROOT = '<backend worktree>/nalana-api'
$env:NALANA_FIXTURE_PYTHON = '<Python with backend dependencies>'
node tests/integration/real-backend-http.mjs
```

The runner starts the actual FastAPI app on loopback port 4197 and Vite on 4198. It creates a temporary SQLite database, seeds one synthetic immutable artifact, and queues encrypted verification messages with workers disabled. Child environments exclude host service credentials. Python socket/DNS and website fetch guards prevent external provider traffic. The test-only proof endpoint exists only in this wrapper, protected by a fresh random key, and never enters production application code.

Checks cover signup and the 48-hour capability, token-only refresh, scanner GET nonmutation, explicit verification POST, private consent capability projection, session association, event idempotency, signed subject cookie bootstrap, actual backend relay ticket, pairing, immutable ticket refresh, session closure, revocation, actual report DTO compatibility, verified operator reauthentication, nonoperator/wrong-password/CSRF denial, report filtering and logout fencing.

Processes and the temporary database are removed on completion. Use `KEEP_REAL_FIXTURE=true` only for deliberate local inspection, then interrupt the runner to clean up. Logs omit response bodies and capabilities.

The manual HTTP cookie jar exercises handlers over loopback. Browser HTTPS Secure-cookie enforcement, real relay body delivery, signed Windows/macOS installers, physical installation/opening, and production provider delivery require separate acceptance. This suite sends no real mail and makes no production changes.

The separate `download-http.mjs` harness exercises actual SvelteKit download handlers against a mocked loopback API. Run it explicitly with Node; it does not establish real backend contract compatibility.

For local HTTPS transport checks, provide task-only PEM certificate/key paths in `NALANA_FIXTURE_HTTPS_CERT` and `NALANA_FIXTURE_HTTPS_KEY` while `KEEP_REAL_FIXTURE=true`. The runner also starts HTTPS Vite on loopback port 4196. In a separate shell, run `node tests/integration/https-operator-http.mjs` with the same certificate path. This client explicitly trusts only that certificate for its requests, verifies the hostname, and never disables TLS validation or changes a trust store. It validates the actual operator flow and Secure/HttpOnly/Strict host-cookie headers with a manual cookie jar. A browser rejecting an untrusted test certificate is a separate gate; do not bypass its certificate interstitial.
