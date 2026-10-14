// Explicit local QA only, while real-backend-http.mjs holds its HTTPS fixture.
// Trust only the provided task certificate for these requests; verification stays on.
import assert from 'node:assert/strict';
import { request } from 'node:https';
import { readFile } from 'node:fs/promises';

assert.ok(process.env.NALANA_FIXTURE_HTTPS_CERT, 'Explicit task certificate required');
const ca = await readFile(process.env.NALANA_FIXTURE_HTTPS_CERT);
const jar = new Map();
const origin = 'https://127.0.0.1:4196';
let checks = 0;
async function call(path, fields) {
  const body = fields ? new URLSearchParams(fields).toString() : undefined;
  return new Promise((resolve, reject) => {
    const req = request(new URL(path, origin), { ca, method: body ? 'POST' : 'GET',
      headers: { accept: 'text/html', origin, cookie: [...jar].map(([k,v])=>`${k}=${v}`).join('; '),
        ...(body ? { 'content-type':'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) } : {}) } }, response => {
      const chunks = [];
      for (const value of response.headers['set-cookie'] || []) { const [pair]=value.split(';'); const at=pair.indexOf('='); jar.set(pair.slice(0,at),pair.slice(at+1)); }
      response.on('data', data => chunks.push(data));
      response.on('end', () => resolve({status:response.statusCode,headers:response.headers,text:Buffer.concat(chunks).toString('utf8')}));
    });
    req.setTimeout(15000,()=>req.destroy(new Error('Local HTTPS fixture timeout')));
    req.on('error',reject); req.end(body);
  });
}
const csrf = html => {const match=html.match(/name="csrf" value="([A-Za-z0-9_-]+)"/); assert.ok(match,'CSRF form field'); return match[1];};
const login=await call('/operator/login'); assert.equal(login.status,200); checks++;
const challenge=login.headers['set-cookie'].find(value=>value.startsWith('__Host-nalana-operator-login='));
for (const expected of [/; Secure/i,/; HttpOnly/i,/; SameSite=Strict/i,/; Path=\//i]) {assert.match(challenge,expected);checks++;}
assert.doesNotMatch(challenge,/; Domain=/i);checks++;
const authenticated=await call('/operator/login?/login',{csrf:csrf(login.text),email:'fixture-operator@example.com',password:'Fixture-password-123!'});
assert.equal(authenticated.status,303);assert.equal(authenticated.headers.location,'/operator/acquisition');checks++;
const session=authenticated.headers['set-cookie'].find(value=>value.startsWith('__Host-nalana-operator='));
assert.match(session,/; Secure/i);assert.match(session,/; HttpOnly/i);assert.match(session,/; SameSite=Strict/i);checks++;
const report=await call('/operator/acquisition');assert.equal(report.status,200);assert.match(report.text,/Independent counts/);checks++;
assert.equal((await call('/operator/login?/logout',{csrf:csrf(report.text)})).status,303);checks++;
assert.equal((await call('/operator/acquisition')).status,303);checks++;
console.log(JSON.stringify({result:'passed',checks,transport:'HTTPS, hostname and task CA verified',limits:'Explicit HTTP cookie jar; browser acceptance remains separate.'}));
