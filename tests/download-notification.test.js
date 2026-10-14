import assert from 'node:assert/strict';
import test from 'node:test';
import { notifyDownload } from '../src/lib/server/download-notification.js';

test('legacy website notification export never calls Resend regardless of configuration or request', async () => {
  for (const method of ['GET','HEAD']) {
    await notifyDownload({ platform: 'windows', request: new Request('https://nalana.io/api/download', { method }), env: { RESEND_API_KEY: 'test-key' }, fetch: () => assert.fail('website must never send mail') });
  }
});
