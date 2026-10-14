// Preload in disposable local QA only. Server network stays on loopback.
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(['127.0.0.1','localhost','[::1]'].includes(url.hostname)) return originalFetch(input,options);
  if(url.href==='https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/build-info.json') return Response.json({version:'2.1.0',channel:'stable',release_tag:'stable-latest',builds:[{platform:'Windows x64',download_url:'https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/fixture.exe'},{platform:'macOS Apple Silicon',download_url:'https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/fixture.dmg'}]});
  throw new Error('External network disabled by local QA guard.');
};
