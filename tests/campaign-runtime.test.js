import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { measureDownload } from '../src/lib/server/campaign-measurement.js';

test('real SvelteKit environment boundary supplies the public campaign catalog to server counters', async () => {
  const campaign = { source: 'facebook', medium: 'paid_social', campaign: 'Runtime catalog QA' };
  const saved = process.env.PUBLIC_CAMPAIGN_ALLOWED_LABELS;
  process.env.PUBLIC_CAMPAIGN_ALLOWED_LABELS = JSON.stringify([campaign]);
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', mode: 'test', logLevel: 'error' });
  try {
    const { campaignEnvironment } = await server.ssrLoadModule('/src/lib/server/campaign-runtime.js');
    const env = campaignEnvironment();
    assert.deepEqual(JSON.parse(env.PUBLIC_CAMPAIGN_ALLOWED_LABELS), [campaign]);
    const observations = [];
    const url = new URL('https://www.nalana.io/api/download?platform=mac&utm_source=facebook&utm_medium=paid_social&utm_campaign=Runtime+catalog+QA');
    await measureDownload({ request: new Request(url), url, platform: 'mac', env, record: async value => { observations.push(value.campaign); return true; } });
    assert.deepEqual(observations, [campaign]);
  } finally {
    await server.close();
    if (saved === undefined) delete process.env.PUBLIC_CAMPAIGN_ALLOWED_LABELS;
    else process.env.PUBLIC_CAMPAIGN_ALLOWED_LABELS = saved;
  }
});
