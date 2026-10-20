import sql from 'mssql';
import { allowedCampaigns, cleanCampaign } from '../campaigns/labels.js';

let poolPromise;
let poolConfig;
async function database(env) {
  if (!env.CAMPAIGN_SQL_CONFIG) throw new Error('Campaign reporting is not configured.');
  if (!poolPromise || poolConfig !== env.CAMPAIGN_SQL_CONFIG) {
    poolConfig = env.CAMPAIGN_SQL_CONFIG;
    const config = JSON.parse(poolConfig);
    // Deployment configuration only; callers cannot select hosts, tables, or credentials.
    if (!/^[a-z0-9-]+\.database\.windows\.net$/.test(config.server) || !config.database || !config.user || !config.password) throw new Error('Invalid campaign database configuration.');
    const pool = new sql.ConnectionPool({ server: config.server, database: config.database, user: config.user, password: config.password, port: 1433, connectionTimeout: 1500, requestTimeout: 1500, pool: { max: 2, min: 0, idleTimeoutMillis: 30_000 }, options: { encrypt: true, trustServerCertificate: false, appName: 'nalana-campaign-totals' } });
    pool.on('error', () => { poolPromise = null; });
    poolPromise = pool.connect().catch(() => { poolPromise = null; throw new Error('Campaign database unavailable.'); });
  }
  return poolPromise;
}

/** Only a daily increment crosses this boundary; never pass the auth payload or request. */
export async function recordCampaign({ event, campaign, platform = 'web', env = process.env, connect = database }) {
  if (env.CAMPAIGN_TOTALS_ENABLED !== 'true') return false;
  if (!['page_view', 'download_request', 'signup'].includes(event) || !['web', 'mac', 'windows'].includes(platform)) return false;
  const labels = cleanCampaign(campaign, allowedCampaigns(env.PUBLIC_CAMPAIGN_ALLOWED_LABELS));
  try {
    const pool = await connect(env);
    await pool.request().input('event', sql.VarChar(20), event).input('source', sql.NVarChar(32), labels.source).input('medium', sql.NVarChar(32), labels.medium).input('campaign', sql.NVarChar(120), labels.campaign).input('platform', sql.VarChar(8), platform).execute('dbo.record_website_campaign');
    return true;
  } catch {
    // No request, campaign label, credential, or DB error text in operational logs.
    console.error('Campaign total increment failed.');
    return false;
  }
}

export function campaignWindow(params, now = new Date()) {
  if ([...params.keys()].some(key => !['start', 'end'].includes(key) || params.getAll(key).length !== 1)) throw new Error('Use start and end dates only.');
  const today = now.toISOString().slice(0, 10);
  const end = params.get('end') || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(Date.parse(end))) throw new Error('Use valid UTC dates.');
  const start = params.get('start') || new Date(Date.parse(`${end}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  for (const value of [start, end]) if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Use valid UTC dates.');
  if (start > end || end > today || Date.parse(end) - Date.parse(start) >= 90 * 86_400_000) throw new Error('Choose at most 90 UTC days ending today or earlier.');
  return { start, end };
}
export async function readCampaignTotals({ env = process.env, window, connect = database }) {
  if (env.CAMPAIGN_TOTALS_ENABLED !== 'true') throw new Error('Campaign reporting is disabled.');
  const pool = await connect(env);
  const result = await pool.request().input('start', sql.Date, new Date(window.start)).input('end', sql.Date, new Date(window.end)).execute('dbo.read_website_campaigns');
  return result.recordset.map(row => ({ day: new Date(row.day).toISOString().slice(0, 10), source: row.source, medium: row.medium, campaign: row.campaign, platform: row.platform, page_views: Number(row.page_views), download_requests: Number(row.download_requests), signups: Number(row.signups) }));
}
