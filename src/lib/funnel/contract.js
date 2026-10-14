export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const keys = new Set(['event_id', 'event_name', 'occurred_at', 'app_session_id', 'web_session_id', 'association_epoch', 'operation_id', 'download_id', 'request_id', 'properties']);
export function validBrowserEvent(event, now = Date.now()) {
  if (!event || Object.keys(event).some(key => !keys.has(key))) return false;
  if (event.event_name !== 'website_download_clicked' || !UUID.test(event.event_id) || !UUID.test(event.web_session_id)) return false;
  if (event.app_session_id != null || event.operation_id != null) return false;
  if (![0, 1].includes(event.association_epoch)) return false;
  if (event.download_id != null && !UUID.test(event.download_id)) return false;
  if (event.request_id != null && !UUID.test(event.request_id)) return false;
  if (!event.properties || typeof event.properties !== 'object' || Array.isArray(event.properties) || Object.keys(event.properties).length || typeof event.occurred_at !== 'string') return false;
  const occurred = Date.parse(event.occurred_at);
  return Number.isFinite(occurred) && occurred >= now - 7 * 86400000 && occurred <= now + 300000;
}
