import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePairing } from '../src/lib/server/download-pairing.js';
import { rememberDownload } from '../src/lib/server/download-cookie.js';
const id='a9ee7444-6b85-4e86-8c6b-24684e20bdd4';
const env={ NALANA_ACQUISITION_PAIRING:'true',NALANA_API_BASE:'https://api.test',NALANA_WEBSITE_SERVICE_TOKEN:'private',NALANA_ENVIRONMENT:'test',NALANA_DOWNLOAD_COOKIE_KEY_ID:'t',NALANA_DOWNLOAD_COOKIE_KEYS:JSON.stringify({t:'a'.repeat(40)}) };
function fixture(overrides={}) {
  const values=new Map();
  const cookies={get:key=>values.get(key),set:(key,value)=>values.set(key,value)};
  rememberDownload(cookies,{download_id:id,platform:'windows',artifact_id:'a',release_id:'r'},env);
  return {cookies,url:new URL('https://nalana.io/api/acquisition/pairings'),request:new Request('https://nalana.io/api/acquisition/pairings',{method:'POST',headers:{origin:'https://nalana.io','content-type':'application/json'},body:'{}'}),enrollment:{token:'private-enrollment'},env,fetch:()=>assert.fail(),...overrides};
}
test('pairing is deliberate, consented, private-cookie-owned and fixed-route',async()=>{
  const response=await handlePairing(fixture({fetch:async(url,options)=>{assert.equal(url,'https://api.test/v1/acquisition/pairings');assert.equal(options.headers['X-Funnel-Enrollment'],'private-enrollment');assert.deepEqual(JSON.parse(options.body),{schema_version:1,download_id:id});return Response.json({pairing_id:id,code:'123456789ABCDEFG',expires_at:new Date(Date.now()+900000).toISOString()});}}));
  assert.equal(response.status,201);
  const body=await response.json();
  assert.equal(body.code,'123456789ABCDEFG');
  assert.equal('token' in body,false);
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
});
test('missing consent, cookie, disabled feature and cross-origin never call backend',async()=>{
  assert.equal((await handlePairing(fixture({enrollment:null}))).status,403);
  assert.equal((await handlePairing(fixture({cookies:{get:()=>null}}))).status,404);
  assert.equal((await handlePairing(fixture({env:{...env,NALANA_ACQUISITION_PAIRING:'false'}}))).status,503);
  assert.equal((await handlePairing(fixture({request:new Request('https://nalana.io',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'})}))).status,403);
});
test('client cannot substitute a foreign download or claimed install',async()=>{
  const response=await handlePairing(fixture({request:new Request('https://nalana.io',{method:'POST',headers:{origin:'https://nalana.io'},body:JSON.stringify({download_id:id,install_id:id})})}));
  assert.equal(response.status,400);
});
test('oversized pairing body is cancelled before full buffering', async()=>{
  const request=new Request('https://nalana.io',{method:'POST',headers:{origin:'https://nalana.io'},body:'x'.repeat(2000)});
  assert.equal((await handlePairing(fixture({request}))).status,413);
});
test('provider foreign/expired/replayed claims stay generic and bounded rate limit preserved',async()=>{
  for (const status of [400,403,404,409,429]) {
    const response=await handlePairing(fixture({fetch:async()=>new Response('sensitive detail',{status,headers:{'retry-after':'30'}})}));
    assert.equal(response.status,status);
    assert.equal((await response.text()).includes('sensitive'),false);
    if(status===429) assert.equal(response.headers.get('retry-after'),'30');
  }
});
