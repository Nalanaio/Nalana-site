# Campaign totals

`/operator/campaigns` reports UTC daily counts by source, medium, approved campaign, and platform. Counts are public page views, successful installer redirects, and backend-confirmed 201 website registrations. They are not unique visitors, completed transfers, installs, email verifications, or individual conversion journeys. Collection starts on enablement; historical traffic cannot be recovered.

## Production configuration

Apply `db/website-campaigns.sql` to the existing Azure SQL database. Create a separate contained SQL user with only EXECUTE on `dbo.record_website_campaign` and `dbo.read_website_campaigns`. Do not grant table or account access. Store its credentials only in sensitive server environment configuration.

Required environment variables:

- `CAMPAIGN_TOTALS_ENABLED=true` enables server counters and reports.
- `PUBLIC_CAMPAIGN_TOTALS_ENABLED=true` enables document-memory label propagation and client navigation observations.
- `CAMPAIGN_SQL_CONFIG` is sensitive JSON with `server`, `database`, `user`, and `password`. The host must be an Azure SQL hostname. TLS certificate validation is required.
- `PUBLIC_CAMPAIGN_ALLOWED_LABELS` is a public JSON array of at most 40 approved `{ "source": "facebook", "medium": "paid_social", "campaign": "Exact campaign name" }` triples. Use ordinary campaign names only; never personal data, secrets, or identifiers. Unsupported names become `unknown`; the approved source and medium still count. Changing this catalog requires deployment.
- Existing operator authentication requires `SITE_ACQUISITION_REPORTS_ENABLED=true`, a sensitive `OPERATOR_ALLOWED_ACCOUNT_IDS` list, and a sensitive random `OPERATOR_SESSION_KEY` of at least 32 bytes. It revalidates the allowlisted active verified account with the configured backend on report access. Sessions expire after 15 minutes.

Enable both counter flags together. Disable both to stop collection and document link decoration. Optional vendor analytics, identification, download pairing, and app linking retain their own existing flags and consent gates.

## Data and failure bounds

Counters store only day, fixed source/medium, approved campaign name, platform, and three totals. No visitor, session, account, event, IP, user-agent, credential, or click identifier is stored in this table. Unknown labels stay unknown. Labels travel through same-origin public/signup/download links using document memory with a non-sliding 30 minute lifetime; no campaign cookie or browser storage is created. A fresh document can read labels from its URL.

Known bots, HEAD, prefetch, private pages, failed downloads, retry redirects, and unsuccessful registrations do not increment. Repeated requests and unidentified bots can inflate counts. SQL failures log a fixed message and do not prevent downloads or account creation. Outages can lose counts. Public document responses use `private, no-store` so CDN caching cannot silently suppress server observations. Existing buckets increment atomically; new groups serialize briefly to enforce a 500-bucket daily cap with overflow grouping. Rows older than 365 days are deleted during counter/report maintenance. Report windows are at most 90 inclusive UTC days.

## Verification

Run `npm test`, `npm run check`, and `npm run build`. Run browser campaign tests with `CAMPAIGN_BROWSER_TEST=true` and `npx playwright test browser-tests/campaign-totals.spec.js --project=chromium --project=webkit`. Default browser regression runs leave this feature disabled and skip that dedicated file. Verify restricted SQL permissions and concurrent increments before enabling production. After deployment, use a clearly labeled approved QA campaign, verify public and private route behavior, and read back its daily counter totals. Do not label a fixture signup test as a live production account creation.
