import { browserStorage, readChoice, sensitivePath } from './consent.js';

const KEY = 'nalana_campaign_v1';
const SIGNUP_KEY = 'nalana_signup_measurement_v1';
const TTL = 30 * 60 * 1000;
const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_id', 'utm_term', 'utm_source_platform'];
const pending = new WeakMap();
const observed = new WeakMap();

function storage(window) { try { return window.sessionStorage; } catch { return undefined; } }
function remove(window, key) { try { storage(window)?.removeItem(key); } catch { /* Optional measurement. */ } }
export function campaignLabels(search) {
  const query = new URLSearchParams(search || '');
  const labels = {};
  for (const key of keys) {
    const values = query.getAll(key), value = values[0]?.trim();
    if (values.length === 1 && value && value.length <= 200 && /^[\p{L}\p{N} ._'"()!+\-]+$/u.test(value)) labels[key] = value;
  }
  return labels;
}

// Before consent, retain only in this document's memory. No cookie or storage
// is written until usage analytics is explicitly allowed.
export function captureCampaign(window, now = Date.now()) {
  if (sensitivePath(window.location.pathname)) return;
  const location = `${window.location.pathname}${window.location.search || ''}`;
  if (observed.get(window) === location) return;
  observed.set(window, location);
  const query = new URLSearchParams(window.location.search || '');
  if (keys.some(key => query.has(key))) pending.set(window, { at: now, labels: campaignLabels(query) });
}

export function clearCampaign(window) {
  pending.delete(window);
  observed.delete(window);
  remove(window, KEY);
  remove(window, SIGNUP_KEY);
}

export function campaignContext(window, choice, now = Date.now()) {
  if (!choice?.usage) {
    if (choice?.decided) clearCampaign(window);
    return {};
  }
  captureCampaign(window, now);
  let entry = pending.get(window);
  pending.delete(window);
  try {
    if (entry) {
      // Replace the entire touch: never mix labels from different campaigns.
      if (entry.labels.utm_source && entry.labels.utm_medium) storage(window)?.setItem(KEY, JSON.stringify(entry));
      else remove(window, KEY);
    } else entry = JSON.parse(storage(window)?.getItem(KEY) || 'null');
  } catch { return {}; }
  if (!entry || !Number.isFinite(entry.at) || now < entry.at || now - entry.at > TTL) { remove(window, KEY); return {}; }
  const labels = campaignLabels(new URLSearchParams(entry.labels));
  if (!labels.utm_source || !labels.utm_medium) return {};
  return labels;
}

export function campaignParameters(window, choice) {
  const labels = campaignContext(window, choice);
  return Object.fromEntries(Object.entries(labels).map(([key, value]) => [key === 'utm_campaign' ? 'campaign_name' : key.replace('utm_', 'campaign_'), value]));
}

// Only callers handling a confirmed registration create this short-lived,
// one-shot marker. It contains no account identifier, email or credential.
export function queueSignupMeasurement(window, now = Date.now()) {
  if (!readChoice(browserStorage(window)).usage) return false;
  try {
    const target = storage(window);
    if (!target) return false;
    target.setItem(SIGNUP_KEY, JSON.stringify({ at: now }));
    return true;
  } catch { return false; }
}

export function consumeSignupMeasurement(window, now = Date.now()) {
  let value;
  try { value = JSON.parse(storage(window)?.getItem(SIGNUP_KEY) || 'null'); } catch { /* Invalid marker. */ }
  remove(window, SIGNUP_KEY);
  return readChoice(browserStorage(window)).usage && Number.isFinite(value?.at) && now >= value.at && now - value.at <= 60000;
}
