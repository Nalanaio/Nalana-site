// Preload in disposable local QA only. Server network stays on loopback.
import { AsyncLocalStorage } from 'node:async_hooks';
import http from 'node:http';

const RELEASES='https://github.com/Nalanaio/nalana-dev-builds/releases/download';
const manifests={
  [`${RELEASES}/stable-latest/build-info.json`]:{version:'2.1.0',channel:'stable',release_tag:'stable-latest',builds:[{platform:'Windows x64',download_url:`${RELEASES}/stable-latest/fixture.exe`},{platform:'macOS Apple Silicon',download_url:`${RELEASES}/stable-latest/fixture.dmg`}]},
  [`${RELEASES}/beta-latest/build-info.json`]:{channel:'beta',release_tag:'beta-latest',run_number:19,builds:[{platform:'Windows x64',download_url:`${RELEASES}/beta-latest/nalana-windows-x64-beta-b19-fixture.exe`},{platform:'macOS Apple Silicon',download_url:`${RELEASES}/beta-latest/nalana-macos-arm64-beta-b19-fixture.dmg`}]},
};

// A loopback request may name manifests to report as down for its own server
// work only (`x-qa-manifest-down: beta`), so parallel browser tests stay isolated.
const request=new AsyncLocalStorage();
const emit=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,...args){
  if(event!=='request')return emit.call(this,event,...args);
  const down=String(args[0]?.headers?.['x-qa-manifest-down']||'').split(',').map(value=>value.trim()).filter(Boolean);
  return request.run({down},()=>emit.call(this,event,...args));
};

const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(['127.0.0.1','localhost','[::1]'].includes(url.hostname)) return originalFetch(input,options);
  const manifest=manifests[url.href];
  if(manifest){
    const channel=manifest.channel;
    return request.getStore()?.down.includes(channel)?new Response('Not Found',{status:404}):Response.json(manifest);
  }
  throw new Error('External network disabled by local QA guard.');
};
