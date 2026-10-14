// Explicit opt-in: NALANA_FIXTURE_BACKEND_ROOT=<backend/nalana-api> node tests/integration/real-backend-http.mjs
// Real FastAPI + SQLite + real SvelteKit facades. Network is denied outside loopback.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { validateReport } from '../../src/lib/server/acquisition-report.js';

assert.ok(process.env.NALANA_FIXTURE_BACKEND_ROOT, 'Explicit disposable backend source path required');
const directory = await mkdtemp(join(tmpdir(), 'nalana-wire-'));
const api = 'http://127.0.0.1:4197', site = 'http://127.0.0.1:4198';
const control = randomUUID();
// Deliberately do not inherit service/database/provider credentials from the host.
const base = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|LOCALAPPDATA|APPDATA|USERPROFILE|COMSPEC|PATHEXT|PROGRAMFILES|PROGRAMFILES\(X86\)|PYTHON.*|NODE.*)$/i.test(key)));
const common = { ...base, APP_ENV:'fixture', NALANA_ENVIRONMENT:'fixture',
  NALANA_WEBSITE_SERVICE_TOKEN:'fixture-service', NALANA_FUNNEL_ENABLED:'true',
  NALANA_FUNNEL_CLIENT_INGEST:'true', NALANA_FUNNEL_SERVER_EVENTS:'true',
  NALANA_FUNNEL_ACTOR_SECRET:'fixture-actor-secret-'.repeat(3),
  NALANA_FUNNEL_COOKIE_SECRET:'fixture-cookie-seal-'.repeat(3),
  NALANA_DOWNLOAD_COOKIE_KEYS:JSON.stringify({t:'fixture-subject-key-'.repeat(3)}),
  NALANA_DOWNLOAD_COOKIE_KEY_ID:'t', NALANA_DOWNLOAD_RELAY_KEYS:JSON.stringify({t:'fixture-relay-key-'.repeat(3)}),
  NALANA_DOWNLOAD_RELAY_KEY_ID:'t', NALANA_DOWNLOAD_RELAY_BASE:api,
  NALANA_DOWNLOAD_STABLE_WINDOWS_ARTIFACT:'fixture-artifact',
  NALANA_DOWNLOAD_RELAY_ENABLED:'true', NALANA_ACQUISITION_RELAY:'true',
  NALANA_ACQUISITION_PAIRING:'true', NALANA_API_BASE:api,
  NALANA_ACQUISITION_REPORTS:'true', RUN_VIEWER_ADMIN_TOKEN:'fixture-admin',
  PUBLIC_NALANA_FUNNEL_ENABLED:'true', PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED:'false',
};
const children = [], logs = [];
function launch(command,args,env) {
  const child=spawn(command,args,{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>logs.push(String(data))); child.stderr.on('data',data=>logs.push(String(data)));
  children.push(child); return child;
}
const jar = new Map();
async function call(path,body,extra={}) {
  const response=await fetch(site+path,{redirect:'manual',method:body===undefined?'GET':'POST',
    headers:{origin:site,'content-type':'application/json',cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...extra},
    body:body===undefined?undefined:JSON.stringify(body)});
  for(const value of response.headers.getSetCookie()) { const [pair]=value.split(';');const at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1)); }
  return response;
}
async function formCall(path, body) {
  const response = await fetch(site + path, { redirect: 'manual', method: 'POST',
    headers: { origin: site, accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded', cookie: [...jar].map(([k,v])=>`${k}=${v}`).join('; ') },
    body: new URLSearchParams(body) });
  for (const value of response.headers.getSetCookie()) { const [pair]=value.split(';'); const at=pair.indexOf('='); jar.set(pair.slice(0,at),pair.slice(at+1)); }
  return response;
}
const csrfFrom = html => { const value=html.match(/name="csrf" value="([A-Za-z0-9_-]+)"/); assert.ok(value, 'rendered CSRF field'); return value[1]; };
async function ready(url,child) {
  for(let i=0;i<150;i++) { if(child.exitCode!==null) throw Error('Fixture process exited before readiness');
    try {if((await fetch(url)).ok)return;}catch{} await delay(200); }
  throw Error('Fixture readiness timeout');
}
let checks=0;
function status(response,expected,label){assert.equal(response.status,expected,label);checks++;}
try {
  const backend=launch(process.env.NALANA_FIXTURE_PYTHON || 'python',
    ['tests/integration/real-backend.py',resolve(process.env.NALANA_FIXTURE_BACKEND_ROOT),'4197'],
    {...common,DATABASE_URL:`sqlite:///${join(directory,'fixture.db').replaceAll('\\','/')}`,
      JWT_SECRET_KEY:'fixture-jwt-secret-'.repeat(3), NALANA_GATE_ENABLED:'false',
      NALANA_VERIFICATION_POLICY_ENABLED:'true', NALANA_VERIFICATION_ENFORCEMENT_ENABLED:'true',
      VERIFICATION_MAIL_ENABLED:'true', VERIFICATION_REMINDERS_ENABLED:'true', VERIFICATION_WORKER_ENABLED:'false',
      RESEND_API_KEY:'synthetic-only', AGENT_RUN_REAPER_ENABLED:'false', NALANA_M2_RETENTION_ENABLED:'false',
      FIXTURE_CONTROL_KEY:control,SITE_URL:site});
  await ready(api+'/health',backend);
  // Provision a synthetic verified operator before the real site process starts.
  const operatorAuth=await (await fetch(api+'/v1/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'fixture-operator@example.com',password:'Fixture-password-123!'})})).json();
  assert.ok(operatorAuth.user?.id, 'synthetic operator signup');
  const operatorProof=await (await fetch(api+'/_fixture/proof/'+operatorAuth.user.id,{headers:{'x-fixture-key':control}})).json();
  assert.equal((await fetch(api+'/v1/auth/verify-email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:operatorProof.token})})).status,200);
  const websiteEnvironment={...common,SITE_ACQUISITION_REPORTS_ENABLED:'true',
    OPERATOR_ALLOWED_ACCOUNT_IDS:operatorAuth.user.id,OPERATOR_SESSION_KEY:'fixture-operator-session-'.repeat(3)};
  const website=launch(process.execPath,['--import','./tests/integration/local-outbound-guard.mjs',
    'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4198','--strictPort'],websiteEnvironment);
  await ready(site,website);
  const signup=await call('/api/auth/register',{email:'fixture-user@example.com',password:'Fixture-password-123!'});
  status(signup,201,'real signup');const auth=await signup.json();assert.ok(auth.user?.id && auth.token && auth.refresh_token);
  assert.equal(auth.user.verification.state,'grace');checks++;
  assert.equal(Date.parse(auth.user.verification.grace_expires_at)-Date.parse(auth.user.verification.grace_started_at),48*3600000);checks++;
  const refresh=await call('/api/auth/refresh',{refresh_token:auth.refresh_token});status(refresh,200,'real refresh');
  const renewed=await refresh.json();assert.ok(renewed.token);assert.equal(renewed.user,undefined);assert.equal(renewed.verification.state,'grace');checks++;
  const account={authorization:`Bearer ${renewed.token}`};
  const proofResponse=await fetch(api+'/_fixture/proof/'+auth.user.id,{headers:{'x-fixture-key':control}});
  status(proofResponse,200,'encrypted outbox proof');const {token}=await proofResponse.json();
  status(await fetch(api+'/v1/auth/verify-email?token='+encodeURIComponent(token)),200,'scanner backend GET');
  const scanner=await call('/verify-email?token='+encodeURIComponent(token));status(scanner,200,'scanner website GET');
  assert.match(await scanner.text(),/Verify|Confirm/);
  let me=await (await call('/api/auth/me',undefined,account)).json();assert.equal(me.user.email_verified,false);checks++;
  const verify=await call('/api/auth/verify-email',{token});status(verify,200,'explicit verification POST');
  me=await (await call('/api/auth/me',undefined,account)).json();assert.equal(me.user.email_verified,true);checks++;
  const visitor=randomUUID(), webSession=randomUUID();
  const enrollment=await call('/api/funnel/enrollments',{consent_state:'granted',consent_version:1,web_visitor_id:visitor,web_session_id:webSession});
  status(enrollment,201,'real enrollment');const enrolled=await enrollment.json();
  assert.deepEqual(Object.keys(enrolled).sort(),['enrollment_id','expires_at']);checks++;
  const prefix='/api/funnel/enrollments/'+enrolled.enrollment_id;
  const session=await call(prefix+'/sessions',{app_session_id:null,web_session_id:webSession});status(session,200,'real session');const registered=await session.json();
  const associate=await call(prefix+'/associate',{session_id:registered.session_id},account);status(associate,200,'real association');
  assert.equal((await associate.json()).association_epoch,1);checks++;
  const resumed=await call('/api/funnel/session');status(resumed,200,'private cookie metadata resume');
  assert.equal((await resumed.json()).account_id,auth.user.id);checks++;
  const observation={event_id:randomUUID(),event_name:'website_download_clicked',occurred_at:new Date().toISOString(),web_session_id:webSession,association_epoch:1,properties:{}};
  const events=await call('/api/funnel/events',{schema_version:1,events:[observation]});status(events,200,'actual event ingest');
  const acknowledgment=await events.json();assert.ok(acknowledgment.accepted.includes(observation.event_id),'actual ingest rejection codes: '+acknowledgment.rejected.map(row=>row.code).join(','));checks++;
  const duplicates=await call('/api/funnel/events',{schema_version:1,events:[observation]});status(duplicates,200,'duplicate ingest');assert.deepEqual((await duplicates.json()).duplicates,[observation.event_id]);checks++;
  const first=await call('/api/download?platform=windows');status(first,303,'signed subject cookie bootstrap');
  const second=await call(first.headers.get('location'));status(second,302,'actual download intent relay redirect');
  const relay=new URL(second.headers.get('location'));assert.equal(relay.origin,api);assert.match(relay.searchParams.get('sig'),/^[0-9a-f]{64}$/);checks++;
  const pairing=await call('/api/acquisition/pairings',{});status(pairing,201,'real optional pairing');assert.ok(/^[0-9A-HJKMNP-TV-Z]{16}$/.test((await pairing.json()).code),'finite pairing display proof');checks++;
  const refreshed=await call('/api/download/refresh',{});status(refreshed,303,'same immutable download refresh');assert.equal(new URL(refreshed.headers.get('location')).pathname,relay.pathname);checks++;
  status(await call(prefix+'/dissociate',{session_id:registered.session_id}),204,'close account session');
  const stale=await call('/api/funnel/events',{schema_version:1,events:[{...observation,event_id:randomUUID()}]});status(stale,401,'closed session fenced');
  status(await call('/api/funnel/revoke',{}),204,'real enrollment revoke');
  status(await call('/api/funnel/session'),401,'revoked private cookie cleared');
  const report=await fetch(api+'/v1/admin/acquisition',{headers:{'x-admin-token':'fixture-admin'}});
  status(report,200,'actual protected report');assert.ok(validateReport(await report.json()));checks++;
  status(await call('/operator/acquisition'),303,'anonymous operator page redirects');
  const loginPage=await call('/operator/login');status(loginPage,200,'actual operator form');
  const challengeCookie=loginPage.headers.getSetCookie().find(value=>value.startsWith('__Host-nalana-operator-login='));
  assert.match(challengeCookie,/HttpOnly/i);assert.match(challengeCookie,/Secure/i);assert.match(challengeCookie,/SameSite=Strict/i);checks++;
  const csrf=csrfFrom(await loginPage.text());
  const credentials={csrf,email:'fixture-operator@example.com',password:'Fixture-password-123!'};
  status(await formCall('/operator/login?/login',{...credentials,csrf:'invalid'}),403,'operator CSRF denial');
  async function operatorAttempt(overrides={}) {
    const fresh=await call('/operator/login');assert.equal(fresh.status,200);
    return formCall('/operator/login?/login',{...credentials,csrf:csrfFrom(await fresh.text()),...overrides});
  }
  status(await operatorAttempt({email:'fixture-user@example.com'}),403,'verified nonoperator denied');
  status(await operatorAttempt({password:'incorrect-fixture-password'}),401,'operator incorrect password denied');
  const operatorLogin=await operatorAttempt();status(operatorLogin,303,'actual operator reauthentication');
  assert.equal(operatorLogin.headers.get('location'),'/operator/acquisition');checks++;
  const operatorPage=await call('/operator/acquisition');status(operatorPage,200,'actual operator report HTML');
  const operatorHtml=await operatorPage.text();assert.match(operatorHtml,/Independent counts/);assert.ok(!operatorHtml.includes(credentials.password)&&!operatorHtml.includes('fixture-admin')&&!operatorHtml.includes(operatorAuth.access_token));checks++;
  status(await call('/operator/acquisition?platform=invalid'),400,'unsupported report filter denied');
  status(await formCall('/operator/login?/logout',{csrf:'invalid'}),403,'operator logout CSRF denied');
  status(await call('/operator/acquisition'),200,'invalid logout preserves operator access');
  status(await formCall('/operator/login?/logout',{csrf:csrfFrom(operatorHtml)}),303,'operator logout');
  status(await call('/operator/acquisition'),303,'operator session cleared');
  console.log(JSON.stringify({result:'passed',checks,backend:'actual FastAPI',database:'disposable SQLite',provider_requests:0,
    limits:'Manual HTTP cookie jar; physical installation, browser HTTPS cookies and relay bytes are separate acceptance gates.'}));
  if(process.env.KEEP_REAL_FIXTURE==='true') {
    if(process.env.NALANA_FIXTURE_HTTPS_CERT && process.env.NALANA_FIXTURE_HTTPS_KEY) {
      launch(process.execPath,['--import','./tests/integration/local-outbound-guard.mjs','--input-type=module','-e',
        "import {createServer} from 'vite';import {readFileSync} from 'node:fs';const server=await createServer({server:{host:'127.0.0.1',port:4196,strictPort:true,https:{cert:readFileSync(process.env.NALANA_FIXTURE_HTTPS_CERT),key:readFileSync(process.env.NALANA_FIXTURE_HTTPS_KEY)}}});await server.listen();"],
        {...websiteEnvironment,NALANA_FIXTURE_HTTPS_CERT:process.env.NALANA_FIXTURE_HTTPS_CERT,NALANA_FIXTURE_HTTPS_KEY:process.env.NALANA_FIXTURE_HTTPS_KEY});
      console.log('Optional local HTTPS browser fixture on loopback port 4196; certificate validation remains enabled.');
    }
    console.log('Disposable fixture ready at loopback ports 4197/4198.');await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
  }
} catch(error) {
  // Avoid exposing response bodies, credentials, signed links or tokens in diagnostics.
  console.error(logs.join('').split('\n').filter(line=>/Error:|Traceback|ImportError|ModuleNotFoundError|RuntimeError|ValueError|AssertionError/.test(line)).join('\n'));
  throw error;
} finally {
  for(const child of children)child.kill();
  await Promise.all(children.map(child=>child.exitCode!==null?Promise.resolve():new Promise(resolve=>child.once('exit',resolve))));
  await rm(directory,{recursive:true,force:true});
}
