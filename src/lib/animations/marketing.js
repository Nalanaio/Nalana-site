import { mountVisualOwner } from './owner.js';

// Shader parameters copied from the Figma "Water caustic" fills (River Concept frame).
const water={center:{x:50,y:50},scale:1,playhead:51.5,intensity:1,
  highlightColor:{r:0,g:.5096636414527893,b:1,a:1},waterColor:{r:.05098039284348488,g:0,b:1,a:1}};
const lowerWater={center:{x:50,y:50},scale:2.4800000190734863,playhead:100,intensity:1,
  highlightColor:{r:.062745101749897,g:.5215686559677124,b:.9372549057006836,a:1},waterColor:{r:.05098039284348488,g:0,b:1,a:1}};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const damp=(value,target,speed,dt)=>value+(target-value)*(1-Math.exp(-speed*dt));

/** Mount one marketing page. Semantic state is supplied by Svelte, never rewritten here.
 * @param {HTMLElement} root @param {any} options
 */
export function mountMarketingVisuals(root,options={}) {
  const q=selector=>root.querySelector(selector);
  const regions={hero:q('.hero'),workflow:q('.workflow'),vision:q('.vision'),footer:q('.footer')};
  return mountVisualOwner(root,{...options,regions,init:async({life,platform,invalidate,state})=>{
    const [{createCaustic},{createHero},{createRipple},{createTitleEffects}]=await Promise.all([
      import('./caustic.js'),import('./hero.js'),import('./ripples.js'),import('./title.js')]);
    if(!life.alive)return null;
    let s=1,heroScale=1,heroRenderer=null,footerRenderer=null,visionRenderer=null,titleHandle=null,footerAttempted=false,visionAttempted=false;
    let feature=options.featureIndex||0,seg=300,pinTop=0,pedestalRing=.5,cursorVisible=false;
    const cursor=q('.cursor'),ring={x:-100,y:-100},causticCenter={x:50,y:50};
    const window=platform.window,document=platform.document;
    const heroCanvas=q('.river-ripples'),visionCanvas=q('.vision-ripples'),footerCanvas=q('.footer-ripples');
    const heroWater=createRipple(heroCanvas,{width:1800,height:1800,origin:{x:-180.5,y:-298.5},stage:q('.objects-layer'),scale:()=>heroScale,ambient:2.4,maxK:1.25,rotate:{a:10.54*Math.PI/180,cx:719.5,cy:601.5},signal:life.signal,platform});
    const visionWater=createRipple(visionCanvas,{width:1727.06,height:945.03,origin:{x:-172.5,y:90.4},stage:q('.vision-stage'),scale:()=>window.innerWidth<=820?1:s,ambient:1.8,signal:life.signal,platform});
    const footerWater=createRipple(footerCanvas,{width:1440,height:739,origin:{x:0,y:125},stage:q('.footer .dstage'),scale:()=>s,ambient:1.5,signal:life.signal,platform});
    const hero=createHero(root,{signal:life.signal,platform,water:heroWater,reducedMotion:state().reducedMotion});
    const children=[hero,heroWater,visionWater,footerWater];children.forEach(child=>life.own(()=>child?.destroy()));
    life.adopt(createTitleEffects(root,{signal:life.signal,platform}),value=>value.destroy()).then(value=>{if(life.alive){titleHandle=value;invalidate();}});
    const attachCaustic=(host,params,receive)=>life.adopt(createCaustic(host,{params,platform,signal:life.signal}),value=>value.destroy()).then(value=>{
      if(!life.alive)return;receive(value);resize(state());invalidate();
    });
    attachCaustic(q('.hero-caustic-host'),water,value=>heroRenderer=value);
    const ensureFooter=()=>{
      if(state().visible('footer')&&!footerAttempted){footerAttempted=true;attachCaustic(q('.footer-caustic'),{...lowerWater,speed:.45},value=>footerRenderer=value);}
      if(state().visible('vision')&&!visionAttempted){visionAttempted=true;attachCaustic(q('.vision-caustic'),{...lowerWater,speed:.45},value=>visionRenderer=value);}
    };
    function resize(current){
      const width=root.clientWidth||window.innerWidth,dpr=Math.min(window.devicePixelRatio||1,2);
      s=Math.min(width/1440,1.25);heroScale=width<=820?width/900:s;
      root.style.setProperty('--s',String(s));root.style.setProperty('--ox',`${(width-1440*s)/2}px`);
      regions.hero.style.setProperty('--s',String(heroScale));regions.hero.style.setProperty('--ox',width<=820?`${-200*heroScale}px`:`${(width-1440*s)/2}px`);
      hero.resize({scale:heroScale});heroWater.resize({scale:heroScale,dpr});visionWater.resize({scale:width<=820?1:s,dpr});footerWater.resize({scale:s,dpr});
      titleHandle?.resize();
      heroRenderer?.resize({width:2271.4*Math.min(heroScale*dpr*.6,1600/2271.4),height:2153.4*Math.min(heroScale*dpr*.6,1600/2271.4),dpr:1});
      footerRenderer?.resize({width:1440*Math.min(s*dpr*.6,1600/1440),height:600*Math.min(s*dpr*.6,1600/1440),dpr:1});
      visionRenderer?.resize({width:1727.06*Math.min(s*dpr*.6,1600/1727.06),height:945.03*Math.min(s*dpr*.6,1600/1727.06),dpr:1});
      seg=Math.round(clamp(window.innerHeight*.38,220,420));
      const available=window.innerHeight-67;
      pinTop=(797-96)*s<=available?Math.round(67+(available-(797-96)*s)/2-96*s):Math.round(window.innerHeight-797*s);
      const pinned=width>820&&!current.reducedMotion;
      regions.vision.classList.toggle('vision-pinned',pinned);
      regions.vision.style.setProperty('--pin-top',`${pinTop}px`);regions.vision.style.setProperty('--scroll',pinned?`${seg*4}px`:'0px');
      ensureFooter();
    }
    function scroll(current){
      q('.nav')?.classList.toggle('is-scrolled',window.scrollY>40);
      if(window.innerWidth>820&&!current.paused&&regions.vision.classList.contains('vision-pinned')){
        const progress=clamp((pinTop-regions.vision.getBoundingClientRect().top)/(seg*4),0,.99999);
        const next=Math.floor(progress*4);
        if(next!==feature){feature=next;options.onFeatureAdvance?.(next);}
        q('.feature-card')?.style.setProperty('--p',String(progress*4-next));
      }ensureFooter();
    }
    const handle={
      resize,scroll,
      updateOptions(next){
        if('featureIndex'in next)feature=next.featureIndex;
        if(next.manualFeature&&window.innerWidth>820&&!state().paused){const top=regions.vision.getBoundingClientRect().top+window.scrollY;window.scrollTo({top:top-pinTop+seg*(feature+.04),behavior:'smooth'});}
      },
      policy(current){root.style.setProperty('--motion-state',current.reducedMotion||current.userPaused||current.hidden?'paused':'running');
        if(current.reducedMotion){hero.update(0,{...current,reducedMotion:true,pointer:{cx:-10000,cy:-10000}});heroWater.renderStatic();visionWater.renderStatic();footerWater.renderStatic();}},
      pointer(event,current){
        const decorative=!event.target.closest('a,button,input,textarea,select,[role="dialog"]');
        cursorVisible=decorative&&current.finePointer&&!current.paused;
        cursor?.classList.toggle('is-visible',cursorVisible);
        if(cursorVisible){cursor.style.setProperty('--x',`${event.clientX}px`);cursor.style.setProperty('--y',`${event.clientY}px`);}
      },
      pointerLeave(){cursorVisible=false;cursor?.classList.remove('is-visible');},
      frame(dt,current){
        ensureFooter();
        const eligible=!current.paused;
        if(!eligible)return false;
        if(current.finePointer&&cursorVisible){
          ring.x=damp(ring.x,current.pointer.cx,14,dt);ring.y=damp(ring.y,current.pointer.cy,14,dt);
          cursor.style.setProperty('--rx',`${ring.x}px`);cursor.style.setProperty('--ry',`${ring.y}px`);
        }
        if(current.visible('hero')){
          hero.update(dt,current);heroWater.update(dt,current.pointer,current);
          const box=q('.objects-layer').getBoundingClientRect();
          const x=(current.pointer.cx-box.left)/heroScale,y=(current.pointer.cy-box.top)/heroScale;
          const inside=current.finePointer&&x>0&&x<1440&&y>0&&y<1200;
          causticCenter.x=damp(causticCenter.x,inside?50+(x/1440-.5)*2.4:50,2,dt);
          causticCenter.y=damp(causticCenter.y,inside?50+(y/1200-.5)*2.4:50,2,dt);
          heroRenderer?.draw({delta:dt,center:causticCenter});
        }
        cursor?.classList.toggle('is-hover',regions.hero.classList.contains('is-object-hover')||!!q('.footer-n:hover'));
        if(current.visible('vision')){visionWater.update(dt,current.pointer,current);visionRenderer?.draw({delta:dt});}
        if(current.visible('footer')){footerWater.update(dt,current.pointer,current);footerRenderer?.draw({delta:dt});pedestalRing-=dt;
          if(pedestalRing<=0){pedestalRing=2.2;footerWater.addAt(723,655,{r:300,dur:3.4,a:.55,lw:2.2});}}
        return current.visible('hero')||current.visible('vision')||current.visible('footer');
      },
      destroy(){children.forEach(child=>child?.destroy());heroRenderer?.destroy();footerRenderer?.destroy();visionRenderer?.destroy();root.style.removeProperty('--s');root.style.removeProperty('--ox');root.style.removeProperty('--motion-state');}
    };
    handle.updateOptions(options);return handle;
  }});
}
