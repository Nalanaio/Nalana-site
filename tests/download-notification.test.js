import assert from 'node:assert/strict';
import test from 'node:test';
import { notifyDownload } from '../src/lib/server/download-notification.js';

const env = { RESEND_API_KEY: 'fixture-key' };
const request = (options) => new Request('https://nalana.io/api/download', options);

test('eligible requests send anonymous request emails for both platforms with tracking disabled', async () => {
  for (const [platform, label] of [['windows', 'Windows'], ['mac', 'Mac']]) {
    const calls = [];
    await notifyDownload({ platform, request: new Request('https://nalana.io/api/download?email=private@example.test', { headers: { 'user-agent': 'private-browser-detail', 'x-forwarded-for': '127.0.0.1' } }), env, fetch: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ id: 'fixture-message' });
    } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.resend.com/emails');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture-key');
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    const email = JSON.parse(calls[0].options.body);
    assert.equal(email.to, 'clarence@nalana.io');
    assert.equal(email.subject, `Nalana download requested — ${label}`);
    assert.match(email.text, /not a completed download or installation/);
    assert.match(email.text, /Repeated requests do not represent unique people/);
    assert.doesNotMatch(email.text, /fixture-key|private@example|private-browser|127\.0\.0\.1/i);
  }
});

test('notification recipient comes only from server configuration', async () => {
  const emails = [];
  await notifyDownload({ platform: 'mac', request: request(), env: { ...env, DOWNLOAD_NOTIFICATION_EMAIL: 'operator@example.test' }, fetch: async (_url, options) => {
    emails.push(JSON.parse(options.body));
    return Response.json({ id: 'fixture-message' });
  } });
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'operator@example.test');
});

test('missing configuration, invalid platforms, non-GET, advertised previews and known bots send no email', async () => {
  const cases = [
    { env: {} }, { platform: 'linux' }, { request: request({ method: 'HEAD' }) },
    { request: request({ method: 'POST' }) },
    ...['purpose', 'sec-purpose'].flatMap(header => ['prefetch', 'preview', 'prerender'].map(value => ({ request: request({ headers: { [header]: value } }) }))),
    ...['Googlebot', 'Slackbot', 'facebookexternalhit/1.1', 'crawler', 'spider'].map(ua => ({ request: request({ headers: { 'user-agent': ua } }) })),
  ];
  for (const overrides of cases) {
    let sends = 0;
    await notifyDownload({ platform: 'windows', request: request(), env, fetch: async () => { sends++; return Response.json({ id: 'unexpected' }); }, ...overrides });
    assert.equal(sends, 0);
  }
});

test('provider rejection and timeout are contained without logging credentials or response bodies', async (t) => {
  const messages = [];
  t.mock.method(console, 'error', (...args) => messages.push(args.join(' ')));
  for (const fetch of [async () => new Response('private provider detail', { status: 429 }), async () => { throw Error('fixture-key private provider detail'); }]) {
    await assert.doesNotReject(notifyDownload({ platform: 'windows', request: request(), env, fetch }));
  }
  assert.equal(messages.length, 2);
  assert.doesNotMatch(messages.join(' '), /fixture-key|private provider detail/);
});
