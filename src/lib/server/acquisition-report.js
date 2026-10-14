import { OperatorError, operatorBackendBase } from './operator-auth.js';
const FILTERS = {
  channel: ['stable', 'beta', 'dev', 'unknown'], platform: ['windows', 'macos', 'mac', 'web', 'unknown'], architecture: ['x64', 'arm64', 'unknown'], cohort: ['internal', 'test', 'external', 'unclassified'], consent: ['granted', 'denied', 'unknown', 'not_applicable'], coverage: ['consented', 'operational', 'legacy', 'unlinked', 'unknown'], delivery_mode: ['relay', 'direct_fallback'], release: null, build: null, failure: ['invalid_input', 'unauthorized', 'verification_required', 'quota_exceeded', 'rate_limited', 'timeout', 'network', 'provider_error', 'apply_failed', 'save_failed', 'delivery_unavailable', 'unknown']
};
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) throw new OperatorError(400, 'Use UTC start and end timestamps.');
  const number = Date.parse(value);
  if (!Number.isFinite(number) || new Date(number).toISOString().slice(0, 19) !== value.slice(0, 19)) throw new OperatorError(400, 'Use valid UTC timestamps.');
  return number;
}
export function reportFilters(input, now = Date.now()) {
  for (const [key] of input) if (!(key in FILTERS) && !['start', 'end'].includes(key) || input.getAll(key).length !== 1) throw new OperatorError(400, 'Unsupported report filter.');
  const end = input.has('end') ? utc(input.get('end')) : now;
  const start = input.has('start') ? utc(input.get('start')) : end - 7 * 86_400_000;
  if (start >= end || end - start > 90 * 86_400_000 || end > now + 300_000) throw new OperatorError(400, 'Choose a UTC window of at most 90 days ending no later than now.');
  const result = new URLSearchParams({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
  for (const [key, allowed] of Object.entries(FILTERS)) if (input.has(key)) {
    const value = input.get(key);
    if (value === '') continue;
    if (!value || value.length > 128 || (allowed ? !allowed.includes(value) : !/^[A-Za-z0-9._:-]+$/.test(value))) throw new OperatorError(400, 'Unsupported report filter value.');
    result.set(key, value);
  }
  return result;
}
const fields = ['schema_version', 'generated_at', 'window', 'filters', 'coverage', 'independent_counts', 'joined_cohorts', 'delivery_summary', 'unknowns'];
function safeTree(value, depth = 0) {
  if (depth > 6) throw new Error();
  if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value === 'string' && value.length <= 2000) return;
  if (Array.isArray(value) && value.length <= 500) { value.forEach((entry) => safeTree(entry, depth + 1)); return; }
  if (value && typeof value === 'object' && Object.keys(value).length <= 100) {
    for (const [key, entry] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_ .:-]{1,100}$/.test(key) || /(?:password|token|secret|email|prompt|signed_url|raw_ip|user_agent|scene_content)/i.test(key)) throw new Error();
      safeTree(entry, depth + 1);
    }
    return;
  }
  throw new Error();
}
export function validateReport(report) {
  try {
    if (!report || report.schema_version !== 1 || Object.keys(report).some((key) => !fields.includes(key)) || fields.some((key) => !(key in report))) throw new Error();
    utc(report.generated_at); utc(report.window.start); utc(report.window.end);
    if (report.window.start >= report.window.end || typeof report.window.time_basis !== 'string') throw new Error();
    for (const kind of ['independent_counts', 'joined_cohorts']) {
      if (!Array.isArray(report[kind]) || report[kind].length > 500) throw new Error();
      for (const row of report[kind]) {
        const keys = ['stage', 'unit', 'count', 'denominator_stage', 'denominator_count', 'conversion_rate', 'join_rule'];
        if (Object.keys(row).some((key) => !keys.includes(key)) || keys.some((key) => !(key in row)) || !Number.isSafeInteger(row.count) || row.count < 0 || !/^[a-z0-9_]{1,100}$/.test(row.stage) || !/^[a-z0-9_]{1,100}$/.test(row.unit) || typeof row.join_rule !== 'string' || row.join_rule.length > 2000) throw new Error();
        if (row.conversion_rate !== null && (!Number.isFinite(row.conversion_rate) || row.conversion_rate < 0 || row.conversion_rate > 1 || !Number.isSafeInteger(row.denominator_count) || row.denominator_count <= 0 || typeof row.denominator_stage !== 'string')) throw new Error();
        if (row.denominator_count !== null && (!Number.isSafeInteger(row.denominator_count) || row.denominator_count < 0)) throw new Error();
      }
    }
    safeTree(report);
    return report;
  } catch { throw new OperatorError(503, 'The acquisition report is unavailable or has an unsupported format.'); }
}
export async function loadAcquisitionReport({ operatorService, cookie, searchParams, config, fetchImpl = globalThis.fetch, now = Date.now() }) {
  const operator = await operatorService.authorize(cookie);
  const filters = reportFilters(searchParams, now);
  if (!config.RUN_VIEWER_ADMIN_TOKEN) throw new OperatorError(503, 'Operator reporting is not configured.');
  try {
    const response = await fetchImpl(`${operatorBackendBase(config)}/v1/admin/acquisition?${filters}`, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json', 'X-Admin-Token': config.RUN_VIEWER_ADMIN_TOKEN } });
    if (!response.ok || Number(response.headers.get('content-length')) > 512_000) throw new Error();
    const text = await response.text();
    if (Buffer.byteLength(text) > 512_000) throw new Error();
    return { report: validateReport(JSON.parse(text)), operator };
  } catch (error) {
    if (error instanceof OperatorError) throw error;
    throw new OperatorError(503, 'The acquisition report is unavailable. Try again later.');
  }
}
