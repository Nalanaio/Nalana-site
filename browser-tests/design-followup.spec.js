import { test, expect, visit, noOverflow, screenshot } from './fixtures.js';

const devices=[
  {name:'Windows desktop',platform:'Win32',ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36',links:['windows'],touch:0},
  {name:'Mac desktop',platform:'MacIntel',ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',links:['mac'],touch:0},
  {name:'iPhone',platform:'iPhone',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',links:['mac','windows'],touch:5},
  {name:'Android',platform:'Linux armv8l',ua:'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile Safari/537.36',links:['mac','windows'],touch:5},
  {name:'iPad desktop mode',platform:'MacIntel',ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',links:['mac','windows'],touch:5},
];
for(const device of devices)test.describe(device.name,()=>{
  test.use({userAgent:device.ua});
  test('offers only the applicable native installers in both CTA locations',async({context,page,request})=>{
    await context.addInitScript(device=>{
      Object.defineProperties(navigator,{
        platform:{get:()=>device.platform},maxTouchPoints:{get:()=>device.touch},userAgentData:{get:()=>undefined},
      });
    },device);
    await visit(page,'/');
    for(const location of ['.hero-download','.vision-download']){
      const links=page.locator(`${location} a[href^="/api/download?platform="]`);
      await expect(links).toHaveCount(device.links.length);
      expect(await links.evaluateAll(nodes=>nodes.map(node=>new URL(node.href).searchParams.get('platform')))).toEqual(device.links);
      for(const link of await links.all())await expect(link).toHaveAttribute('data-sveltekit-reload','');
    }
    // Desktop selection is already in HTML, including when JavaScript is off.
    if(device.touch===0){
      const html=await (await request.get('/')).text();
      expect(html).toContain(`download-${device.links[0]}`);
      expect(html).not.toContain(`download-${device.links[0]==='mac'?'windows':'mac'}`);
    }
  });
});

test('workflow reuses the live 3D demo, pauses playback and stops drawing after navigation',async({context,page})=>{
  await context.addInitScript(()=>{
    window.__demoDraws={active:0,detached:0};const seen=new WeakSet();
    for(const api of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
      if(!api)continue;const original=api.prototype.drawElements;
      api.prototype.drawElements=function(...args){
        if(this.canvas.closest('.wf-shot')){seen.add(this.canvas);window.__demoDraws.active++;}
        else if(seen.has(this.canvas))window.__demoDraws.detached++;
        return original.apply(this,args);
      };
    }
  });
  await visit(page,'/');
  const demo=page.locator('.wf-shot');await demo.scrollIntoViewIfNeeded();
  await expect(demo.locator('.viewport canvas')).toHaveCount(1);
  await expect(demo).toContainText('Blocked out the full vacuum',{timeout:20000});
  await expect.poll(()=>page.evaluate(()=>window.__demoDraws.active)).toBeGreaterThan(2);
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();
  await page.waitForTimeout(150);
  const paused=await demo.innerText();const draws=await page.evaluate(()=>window.__demoDraws.active);
  await page.waitForTimeout(700);expect(await demo.innerText()).toBe(paused);expect(await page.evaluate(()=>window.__demoDraws.active)).toBe(draws);
  await page.getByRole('button',{name:'Resume motion',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__demoDraws.active)).toBeGreaterThan(draws);
  await page.locator('a[href="/privacy"]').first().click();
  await expect(page).toHaveURL(/\/privacy$/);await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.__demoDraws.detached)).toBe(0);
});

test('reduced motion retains a completed demo and fits the narrow layout',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:375,height:900});
  await visit(page,'/');await page.locator('.wf-shot').scrollIntoViewIfNeeded();
  await expect(page.locator('.wf-shot .viewport canvas')).toHaveCount(1);
  await expect(page.locator('.wf-shot .statusbar')).toContainText('34,614');
  await noOverflow(page);
  await page.locator('.wf-shot').screenshot({path:testInfo.outputPath('live-demo-mobile.png')});
});

test('laptop contains the five-app collapse frame from production and obeys pause',async({page},testInfo)=>{
  await page.setViewportSize({width:1440,height:900});await visit(page,'/');
  const frame=page.locator('.macbook .workspace-collapse');await frame.scrollIntoViewIfNeeded();
  await expect(frame.locator('.appwin')).toHaveCount(5);
  expect(await frame.locator('.appwin').allTextContents()).toEqual(['Modeler','Sculpt','UV','Render','Texture']);
  await expect(frame).toHaveClass(/is-playing/);
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();
  await expect(frame.locator('.appwin').first()).toHaveCSS('animation-play-state','paused');
  await page.locator('.macbook').screenshot({path:testInfo.outputPath('laptop-production-frame.png')});
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(frame.locator('.appwin').first()).toHaveCSS('animation-name','none');
});
