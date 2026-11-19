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

test('workflow demo video pauses with motion controls and fits the narrow layout',async({page},testInfo)=>{
  await page.setViewportSize({width:375,height:900});await visit(page,'/');
  const video=page.locator('.wf-video');await video.scrollIntoViewIfNeeded();
  await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();
  await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
  await page.getByRole('button',{name:'Resume motion',exact:true}).click();
  await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
  await noOverflow(page);
  await video.screenshot({path:testInfo.outputPath('workflow-video-mobile.png')});
});

test('laptop screen shows the Figma gradient and white N',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await visit(page,'/');
  const screen=page.locator('.macbook .mb-figma-screen');await screen.scrollIntoViewIfNeeded();
  await expect(screen).toHaveCSS('background-image',/linear-gradient\(90deg, rgb\(193, 30, 225\), rgb\(115, 86, 234\)\)/);
  await expect(screen.locator('img[src="/assets/site/figma-laptop-n.svg"]')).toBeVisible();
});
