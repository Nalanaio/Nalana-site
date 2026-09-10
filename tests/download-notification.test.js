import assert from 'node:assert/strict';
import test from 'node:test';
import { notifyDownload } from '../src/lib/server/download-notification.js';

const env = { RESEND_API_KEY: 'test-key' };
const request = new Request('https://nalana.io/api/download?platform=mac');

test('emails the requested platform to Clarence without visitor data', async () => {
  const calls = [];
  await notifyDownload({ platform: 'mac', request, env, fetch: async (...args) => {
    calls.push(args);
    return new Response('{}');
  } });
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  const mail = JSON.parse(options.body);
  assert.equal(mail.to, 'clarence@nalana.io');
  assert.match(mail.subject, /Mac/);
  assert.match(mail.text, /not a completed download/);
  assert.ok(options.signal instanceof AbortSignal);
});

test('supports Windows and a configured recipient', async () => {
  await notifyDownload({ platform: 'windows', request,
    env: { ...env, DOWNLOAD_NOTIFICATION_EMAIL: 'test@example.com' },
    fetch: async (_, options) => {
      const mail = JSON.parse(options.body);
      assert.equal(mail.to, 'test@example.com');
      assert.match(mail.subject, /Windows/);
      return new Response('{}');
    },
  });
});

test('missing configuration, HEAD, and prefetch requests send no email', async () => {
  const fetch = async () => { assert.fail('must not send'); };
  await notifyDownload({ platform: 'mac', request, fetch, env: {} });
  for (const options of [{ method: 'HEAD' }, { headers: { purpose: 'prefetch' } },
    { headers: { 'sec-purpose': 'prefetch;prerender' } }]) {
    await notifyDownload({ platform: 'mac', request: new Request(request.url, options), fetch, env });
  }
});

test('provider rejection and network timeout never fail the download', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  for (const fetch of [async () => new Response('{}', { status: 429 }),
    async () => { throw new DOMException('Timed out', 'TimeoutError'); }]) {
    await assert.doesNotReject(notifyDownload({ platform: 'mac', request, fetch, env }));
  }
  assert.equal(log.mock.callCount(), 2);
});
