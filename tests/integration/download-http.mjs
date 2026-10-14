// Run explicitly: node tests/integration/download-http.mjs
// Disposable loopback mock + actual SvelteKit handlers. No provider calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const id = randomUUID();
const requests = [];
let origin;
const projection = () => {
  const expires = Math.floor(Date.now()/1000)+900;
  return { download_id:id, release_id:'fixture-release', artifact_id:'fixture-artifact', platform:'windows', observation_mode:'relay', download_url:`${origin}/v1/downloads/${id}?expires=${expires}&key_id=t&sig=${'a'.repeat(64)}`, expires_at:new Date(expires*1000).toISOString() };
};
const backend = createServer(async(req,res) => {
  let raw=''; for await (const chunk of req) raw+=chunk;
  const body = raw ? JSON.parse(raw) : {};
  requests.push({ path:req.url, body });
  res.setHeader('content-type','application/json');
  if(req.url === '/v1/funnel/enrollments') { assert.equal(req.headers.authorization,'Bearer fixture-service'); res.statusCode=201; res.end(JSON.stringify({ enrollment_id:randomUUID(), enrollment_token:'fixture-enrollment', revoke_token:'fixture-revoke', expires_at:new Date(Date.now()+86400000).toISOString() })); }
  else if(req.url === '/v1/acquisition/download-intents' || req.url.endsWith('/refresh')) { assert.equal(req.headers.authorization,'Bearer fixture-service'); res.statusCode=201; res.end(JSON.stringify(projection())); }
  else if(req.url === '/v1/acquisition/download-handoffs') { assert.equal(body.delivery_mode,'relay'); res.end('{}'); }
  else if(req.url === '/v1/acquisition/pairings') { assert.equal(req.headers['x-funnel-enrollment'],'fixture-enrollment'); assert.equal(body.download_id,id); res.statusCode=201; res.end(JSON.stringify({ pairing_id:randomUUID(), code:'123456789ABCDEFG', expires_at:new Date(Date.now()+900000).toISOString() })); }
  else { res.statusCode=404; res.end('{}'); }
});
await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve));
origin = `http://127.0.0.1:${backend.address().port}`;
const site = 'http://127.0.0.1:4199';
const child = spawn(process.execPath, ['--import','./tests/integration/local-outbound-guard.mjs','node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4199','--strictPort'], { cwd:process.cwd(), stdio:['ignore','pipe','pipe'], env:{ ...process.env, NALANA_API_BASE:origin, NALANA_DOWNLOAD_RELAY_BASE:origin, NALANA_WEBSITE_SERVICE_TOKEN:'fixture-service', NALANA_ENVIRONMENT:'fixture', NALANA_ACQUISITION_RELAY:'true', NALANA_ACQUISITION_PAIRING:'true', NALANA_DOWNLOAD_COOKIE_KEY_ID:'t', NALANA_DOWNLOAD_COOKIE_KEYS:JSON.stringify({ t:'fixture-signing-key-'.repeat(3) }), NALANA_FUNNEL_ENABLED:'true', NALANA_FUNNEL_COOKIE_SECRET:'fixture-enrollment-seal-'.repeat(3), PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED:'false' } });
let output=''; child.stdout.on('data',chunk=>{output+=chunk;}); child.stderr.on('data',chunk=>{output+=chunk;});
const jar = new Map();
async function call(path, options={}) {
  const response = await fetch(site+path,{ redirect:'manual',...options,headers:{ cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...options.headers } });
  for(const value of response.headers.getSetCookie()) { const [pair] = value.split(';'); const at=pair.indexOf('='); jar.set(pair.slice(0,at),pair.slice(at+1)); assert.match(value,/HttpOnly/i); assert.match(value,/Secure/i); }
  return response;
}
try {
  let ready=false;
  for(let i=0;i<80;i++) { if(child.exitCode!==null) throw Error('Vite failed to start'); try { const probe=await fetch(site+'/api/download?platform=invalid'); if(probe.status===400){ready=true;break;} } catch {} await delay(200); }
  assert.ok(ready,'Vite startup timeout');
  const enroll=await call('/api/funnel/enrollments',{method:'POST',headers:{origin:site,'content-type':'application/json'},body:JSON.stringify({consent_state:'granted',consent_version:1,web_visitor_id:randomUUID(),web_session_id:randomUUID()})});
  assert.equal(enroll.status,201);
  const first=await call('/api/download?platform=windows'); assert.equal(first.status,303);
  assert.equal(requests.filter(r=>r.path.includes('download-intents')).length,0);
  const second=await call(first.headers.get('location')); assert.equal(second.status,302); assert.match(second.headers.get('location'),/\/v1\/downloads\//);
  const intent=requests.find(r=>r.path==='/v1/acquisition/download-intents'); assert.equal(intent.body.analytics_consent,'granted'); assert.ok(intent.body.dedup_subject);
  const pair=await call('/api/acquisition/pairings',{method:'POST',headers:{origin:site,'content-type':'application/json'},body:'{}'}); assert.equal(pair.status,201); assert.equal(Object.keys(await pair.json()).sort().join(','),'code,expires_at,pairing_id');
  const denied=await call('/api/acquisition/pairings',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:'{}'}); assert.equal(denied.status,403);
  const refresh=await call('/api/download/refresh',{method:'POST',headers:{origin:site}}); assert.equal(refresh.status,303); assert.match(refresh.headers.get('location'),/\/v1\/downloads\//);
  const head=await call('/api/download?platform=windows',{method:'HEAD'}); assert.equal(head.status,204);
  const page=await call('/connect-download'); assert.equal(page.status,200); assert.equal(page.headers.get('referrer-policy'),'no-referrer'); assert.equal((await page.text()).includes('123456789ABCDEFG'),false);
  assert.equal(requests.filter(r=>r.path==='/v1/acquisition/download-handoffs').length,1);
  console.log(JSON.stringify({ result:'passed', checks:12, backend_requests:requests.length, provider_requests:0, note:'HTTP handler integration; actual HTTPS/browser Secure-cookie and real relay bytes remain separate gates.' }));
  if(process.env.KEEP_FIXTURE_SITE==='true') {
    console.log('Disposable browser fixture remains at http://127.0.0.1:4199; server outbound restricted to loopback or synthetic manifest.');
    await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
  }
} catch(error) {
  // Print only compile diagnostics, never cookies, bodies, signed URLs or keys.
  console.error(output.split('\n').filter(line=>/Error:|error during|Cannot find/.test(line)).join('\n'));
  throw error;
} finally { child.kill(); await new Promise(resolve=>backend.close(resolve)); }
