import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDownload } from '../src/lib/server/download-handler.js';
import { mintSubject } from '../src/lib/server/download-cookie.js';
const id = 'a9ee7444-6b85-4e86-8c6b-24684e20bdd4';
const env = { NALANA_ACQUISITION_RELAY:'true', NALANA_API_BASE:'https://api.test', NALANA_WEBSITE_SERVICE_TOKEN:'private', NALANA_DOWNLOAD_RELAY_BASE:'https://relay.test', NALANA_ENVIRONMENT:'test', NALANA_DOWNLOAD_COOKIE_KEY_ID:'t', NALANA_DOWNLOAD_COOKIE_KEYS:JSON.stringify({t:'a'.repeat(40)}), NALANA_WIN_URL:'https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/nalana.exe' };
function event(options = {}) {
  const url = new URL(options.url || 'https://nalana.io/api/download?platform=windows');
  return { url, request:new Request(url, options.request), cookies:{ get:()=>null, set:()=>{} }, fetch:()=>assert.fail('unexpected request'), env, ...options };
}
test('first GET makes exactly one same-origin cookie roundtrip without backend mail or intent', async () => {
  const response = await handleDownload(event());
  assert.equal(response.status,303);
  assert.match(response.headers.get('location'), /^\/api\/download\?platform=windows&_retry=/);
  assert.equal(response.headers.get('cache-control'),'no-store');
});
test('blocked cookies proceed once and direct fallback makes no start/mail claims', async () => {
  const calls=[];
  const response = await handleDownload(event({ url:new URL('https://nalana.io/api/download?platform=windows&_retry=invalid'), fetch:async (url)=>{ calls.push(url); return new Response('',{status:503}); } }));
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),env.NALANA_WIN_URL);
  assert.equal(calls.length,2);
  assert.ok(calls.every(url=>!url.includes('resend.com')));
});
test('valid returned cookie gets validated relay ticket and handoff only', async () => {
  const calls=[];
  const expires=Math.floor(Date.now()/1000)+900;
  const response=await handleDownload(event({cookies:{get:()=>mintSubject(env),set:()=>{}},fetch:async(url, options)=>{calls.push([url,options]);return Response.json(url.endsWith('download-intents')?{download_id:id,release_id:'r1',artifact_id:'a1',platform:'windows',observation_mode:'relay',download_url:`https://relay.test/v1/downloads/${id}?expires=${expires}&key_id=t&sig=${'a'.repeat(64)}`,expires_at:new Date(expires*1000).toISOString()}:{});}}));
  assert.equal(response.status,302);
  assert.match(response.headers.get('location'), /^https:\/\/relay.test\/v1\/downloads\//);
  assert.equal(calls.length,2);
  assert.equal(JSON.parse(calls[1][1].body).delivery_mode,'relay');
});
test('HEAD, prefetch and invalid platform cannot create intent or notify', async()=>{
  assert.equal((await handleDownload(event({request:new Request('https://nalana.io',{method:'HEAD'})}))).status,204);
  assert.equal((await handleDownload(event({request:new Request('https://nalana.io',{headers:{'sec-purpose':'prefetch'}})}))).status,204);
  assert.equal((await handleDownload(event({url:new URL('https://nalana.io/api/download?platform=linux')}))).status,400);
});
test('unsafe configured fallback fails closed', async()=>{
  const response=await handleDownload(event({env:{...env,NALANA_ACQUISITION_RELAY:'false',NALANA_WIN_URL:'https://evil.test/file.exe'},fetch:async()=>new Response('',{status:503})}));
  assert.equal(response.status,503);
});
