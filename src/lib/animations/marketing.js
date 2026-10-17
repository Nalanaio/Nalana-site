import { mountVisualOwner } from './owner.js';
import { createWorkflowClock } from './lifetime.js';

const water={center:{x:50,y:50},scale:3.5,playhead:71.44999694824219,intensity:1,
  highlightColor:{r:.804,g:.961,b:1,a:1},waterColor:{r:.062745,y:0,g:.521568,b:.937254,a:1}};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const damp=(value,target,speed,dt)=>value+(target-value)*(1-Math.exp(-speed*dt));

/** Mount one marketing page. Semantic state is supplied by Svelte, never rewritten here.
 * @param {HTMLElement} root @param {any} options
 */
export function mountMarketingVisuals(root,options={}) {
  const q=selector=>root.querySelector(selector);
  const regions={hero:q('.hero'),workflow:q('.workflow'),vision:q('.vision'),footer:q('.footer')};
  return mountVisualOwner(root,{...options,regions,init:async({life,platform,invalidate,state})=>{
    const [{createCaustic},{createHero},{createRipple},{createTitleEffects},{createMaterials}]=await Promise.all([
      import('./caustic.js'),import('./hero.js'),import('./ripples.js'),import('./title.js'),import('./materials.js')]);
    if(!life.alive)return null;
    let s=1,heroScale=1,heroRenderer=null,footerRenderer=null,titleHandle=null,footerAttempted=false,workflowStep=options.workflowStep||0;
    let interacting=false,feature=options.featureIndex||0,material=null,seg=300,pinTop=0,pedestalRing=.5;
    let hoverMaterial=null,lastHoverMaterial=null,materialRevision=0,staticMaterialSelection=false,cursorVisible=false;
    const cursor=q('.cursor'),ring={x:-100,y:-100},causticCenter={x:50,y:50};
    const window=platform.window,document=platform.document;
    const heroCanvas=q('.river-ripples'),visionCanvas=q('.vision-ripples'),footerCanvas=q('.footer-ripples');
    const heroWater=createRipple(heroCanvas,{width:1800,height:1800,origin:{x:-180.5,y:-298.5},stage:q('.objects-layer'),scale:()=>heroScale,ambient:2.4,maxK:1.25,rotate:{a:10.54*Math.PI/180,cx:719.5,cy:601.5},signal:life.signal,platform});
    const visionWater=createRipple(visionCanvas,{width:1727.06,height:945.03,origin:{x:-172.5,y:90.4},stage:q('.vision-stage'),scale:()=>window.innerWidth<=820?1:s,ambient:1.8,signal:life.signal,platform});
    const footerWater=createRipple(footerCanvas,{width:1440,height:739,origin:{x:0,y:125},stage:q('.footer .dstage'),scale:()=>s,ambient:1.5,signal:life.signal,platform});
    const hero=createHero(root,{signal:life.signal,platform,water:heroWater,reducedMotion:state().reducedMotion});
    const materials=createMaterials({host:q('.fn-sculpt'),img:q('.fn-balloon'),getScale:()=>window.innerWidth<=820?.8:s,platform,signal:life.signal,onInvalidate:invalidate});
    const clock=createWorkflowClock(index=>{workflowStep=index;options.onWorkflowAdvance?.(index);});
    clock.select(workflowStep);
    const children=[hero,heroWater,visionWater,footerWater,materials];children.forEach(child=>life.own(()=>child?.destroy()));
    life.adopt(createTitleEffects(root,{signal:life.signal,platform}),value=>value.destroy()).then(value=>{if(life.alive){titleHandle=value;invalidate();}});
    const attachCaustic=(host,params,receive)=>life.adopt(createCaustic(host,{params,platform,signal:life.signal}),value=>value.destroy()).then(value=>{
      if(!life.alive)return;receive(value);resize(state());invalidate();
    });
    attachCaustic(q('.hero-caustic-host'),water,value=>heroRenderer=value);
    const ensureFooter=()=>{
      const box=regions.footer.getBoundingClientRect();
      if(box.top<window.innerHeight+900&&box.bottom>0)materials.preload();
      if(state().visible('footer')&&!footerAttempted){footerAttempted=true;attachCaustic(q('.footer-caustic'),{...water,scale:2.58,playhead:60.39,intensity:.48,speed:.45,waterColor:{r:0,g:.388,b:.706,a:1}},value=>footerRenderer=value);}
    };
    // Selection is semantic input, and may finish after images upload. Only the
    // newest request may schedule a completed static material while paused.
    function selectMaterial(key){
      const revision=++materialRevision;
      Promise.resolve(materials.select(key)).then(()=>{
        if(!life.alive||revision!==materialRevision)return;
        staticMaterialSelection=state().paused;invalidate();
      }).catch(()=>{});
    }
    function leaveMaterial(){
      if(hoverMaterial===null)return;
      hoverMaterial=null;selectMaterial(material);
    }
    function resize(current){
      const width=root.clientWidth||window.innerWidth,dpr=Math.min(window.devicePixelRatio||1,2);
      s=Math.min(width/1440,1.25);heroScale=width<=820?width/900:s;
      root.style.setProperty('--s',String(s));root.style.setProperty('--ox',`${(width-1440*s)/2}px`);
      regions.hero.style.setProperty('--s',String(heroScale));regions.hero.style.setProperty('--ox',width<=820?`${-200*heroScale}px`:`${(width-1440*s)/2}px`);
      hero.resize({scale:heroScale});heroWater.resize({scale:heroScale,dpr});visionWater.resize({scale:width<=820?1:s,dpr});footerWater.resize({scale:s,dpr});materials.resize();
      titleHandle?.resize();
      heroRenderer?.resize({width:2271.4*Math.min(heroScale*dpr*.6,1600/2271.4),height:2153.4*Math.min(heroScale*dpr*.6,1600/2271.4),dpr:1});
      footerRenderer?.resize({width:2254*Math.min(s*dpr*.6,1600/2254),height:1292*Math.min(s*dpr*.6,1600/2254),dpr:1});
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
        if('workflowStep'in next&&(next.workflowStep!==workflowStep||next.manualWorkflow)){workflowStep=next.workflowStep;clock.select(workflowStep);}
        if('workflowInteracting'in next){if(interacting&&!next.workflowInteracting)clock.reset();interacting=next.workflowInteracting;}
        if('featureIndex'in next)feature=next.featureIndex;
        if(next.manualFeature&&window.innerWidth>820&&!state().paused){const top=regions.vision.getBoundingClientRect().top+window.scrollY;window.scrollTo({top:top-pinTop+seg*(feature+.04),behavior:'smooth'});}
        if('material'in next&&next.material!==material){material=next.material;hoverMaterial=null;selectMaterial(material);}
      },
      policy(current){root.style.setProperty('--motion-state',current.reducedMotion||current.userPaused||current.hidden?'paused':'running');
        if(current.paused)leaveMaterial();
        if(current.reducedMotion){hero.update(0,{...current,reducedMotion:true,pointer:{cx:-10000,cy:-10000}});heroWater.renderStatic();visionWater.renderStatic();footerWater.renderStatic();}},
      pointer(event,current){
        const decorative=!event.target.closest('a,button,input,textarea,select,[role="dialog"]');
        cursorVisible=decorative&&current.finePointer&&!current.paused;
        cursor?.classList.toggle('is-visible',cursorVisible);
        if(cursorVisible){cursor.style.setProperty('--x',`${event.clientX}px`);cursor.style.setProperty('--y',`${event.clientY}px`);}
        // Keep Grace's hover grow/retract interaction as well as the explicit
        // keyboard/touch controls. This never hides the native cursor.
        if(current.finePointer&&!current.paused&&event.target.closest('.fn-sculpt')){
          if(hoverMaterial===null){const choices=['sky','forest','flowers'].filter(key=>key!==lastHoverMaterial);
            hoverMaterial=choices[Math.floor(Math.random()*choices.length)];lastHoverMaterial=hoverMaterial;selectMaterial(hoverMaterial);}
        }else leaveMaterial();
      },
      pointerLeave(){cursorVisible=false;cursor?.classList.remove('is-visible');leaveMaterial();},
      frame(dt,current){
        ensureFooter();
        const eligible=!current.paused;
        q('.fn-float').style.animationPlayState=eligible&&current.visible('footer')?'running':'paused';
        const workflowActive=eligible&&current.visible('workflow')&&!interacting;
        clock.update(dt,workflowActive);regions.workflow.style.setProperty('--workflow-progress',String(clock.progress));
        if(!eligible){
          // A manual selection and a resize still get one useful static paint.
          // No ambient frame is retained, and hidden documents draw nothing.
          if(!current.hidden&&current.visible('footer')){
            materials.update(0,{reducedMotion:current.reducedMotion||staticMaterialSelection});staticMaterialSelection=false;
          }
          return false;
        }
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
        cursor?.classList.toggle('is-hover',regions.hero.classList.contains('is-object-hover')||hoverMaterial!==null);
        if(current.visible('vision'))visionWater.update(dt,current.pointer,current);
        if(current.visible('footer')){footerWater.update(dt,current.pointer,current);footerRenderer?.draw({delta:dt});materials.update(dt,{reducedMotion:false});pedestalRing-=dt;
          if(pedestalRing<=0){pedestalRing=2.2;footerWater.addAt(723,655,{r:300,dur:3.4,a:.55,lw:2.2});}}
        return workflowActive||current.visible('hero')||current.visible('vision')||current.visible('footer');
      },
      destroy(){children.forEach(child=>child?.destroy());heroRenderer?.destroy();footerRenderer?.destroy();root.style.removeProperty('--s');root.style.removeProperty('--ox');root.style.removeProperty('--motion-state');}
    };
    handle.updateOptions(options);return handle;
  }});
}
