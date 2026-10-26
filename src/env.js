import { defineEnvVars } from '@sveltejs/kit/env';

// SvelteKit 3 exposes only declared variables through $app/env/*. Every name the
// site reads is listed here; all are optional, so a missing value stays undefined
// exactly as it was with $env/dynamic/*.
/** @param {string | undefined} value */
const optional = (value) => value;
const pub = { public: true, schema: optional };
const priv = { schema: optional };

export const variables = defineEnvVars({
  PUBLIC_CAMPAIGN_ALLOWED_LABELS: pub,
  PUBLIC_CAMPAIGN_TOTALS_ENABLED: pub,
  PUBLIC_NALANA_FUNNEL_ENABLED: pub,
  PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED: pub,
  AZURE_API_URL: priv,
  CAMPAIGN_SQL_CONFIG: priv,
  CAMPAIGN_TOTALS_ENABLED: priv,
  DEV_ALLOWED_EMAILS: priv,
  DISCORD_WEBHOOK_URL: priv,
  DOWNLOAD_NOTIFICATION_EMAIL: priv,
  NALANA_ACQUISITION_PAIRING: priv,
  NALANA_ACQUISITION_RELAY: priv,
  NALANA_API_BASE: priv,
  NALANA_DOWNLOAD_COOKIE_KEYS: priv,
  NALANA_DOWNLOAD_COOKIE_KEY_ID: priv,
  NALANA_DOWNLOAD_RELAY_BASE: priv,
  NALANA_ENVIRONMENT: priv,
  NALANA_FUNNEL_COOKIE_SECRET: priv,
  NALANA_FUNNEL_ENABLED: priv,
  NALANA_MAC_URL: priv,
  NALANA_WEBSITE_BUILD_ID: priv,
  NALANA_WEBSITE_SERVICE_TOKEN: priv,
  NALANA_WIN_URL: priv,
  OPERATOR_ALLOWED_ACCOUNT_IDS: priv,
  OPERATOR_SESSION_KEY: priv,
  RESEND_API_KEY: priv,
  RUN_VIEWER_ADMIN_TOKEN: priv,
  SITE_ACQUISITION_REPORTS_ENABLED: priv,
  WAITLIST_SHEET_WEBHOOK: priv
});
