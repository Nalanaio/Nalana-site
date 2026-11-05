// The backend reads this self-reported header on account creation and login to tell
// which client produced the event (site, ide, or unknown). It is for segmentation
// only and carries no trust: the account service decides nothing from it.
export const CLIENT_HEADER = 'X-Nalana-Client';
export const CLIENT_LABEL = 'site';
const LABELLED_PATHS = new Set(['/v1/auth/register', '/v1/auth/login']);

/** Headers to add to a backend request; empty for every other endpoint. */
export function clientLabelHeaders(path) {
  return LABELLED_PATHS.has(path) ? { [CLIENT_HEADER]: CLIENT_LABEL } : {};
}
