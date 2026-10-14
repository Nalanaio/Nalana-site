import { env } from '$env/dynamic/private';
import { readEnrollment } from '$lib/server/funnel-api.js';
import { handlePairing } from '$lib/server/download-pairing.js';

export async function POST(event) {
  return handlePairing({ ...event, enrollment: readEnrollment(event.cookies), env });
}
