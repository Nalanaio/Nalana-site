import { createLifetime, createScheduler } from './lifetime.js';

const owners=new WeakMap();

/** All real browser API access occurs after a component mounts. */
export function browserPlatform(root) {
  const document=root.ownerDocument,window=document.defaultView;
  return {document,window,requestFrame:fn=>window.requestAnimationFrame(fn),cancelFrame:id=>window.cancelAnimationFrame(id),
    listen(target,type,fn,options){target.addEventListener(type,fn,options);return ()=>target.removeEventListener(type,fn,options);},
    media:query=>window.matchMedia(query),
    observe(regions,callback){
      if(!window.IntersectionObserver)return ()=>{};
      const observer=new window.IntersectionObserver(entries=>entries.forEach(entry=>callback(entry.target,entry.isIntersecting)),{threshold:0});
      regions.forEach(el=>observer.observe(el));return ()=>observer.disconnect();
    },
    resize(root,callback){if(!window.ResizeObserver)return ()=>{};const observer=new window.ResizeObserver(callback);observer.observe(root);return ()=>observer.disconnect();}
  };
}

/** One page owner, with injectable boundaries for deterministic lifecycle tests.
 * @param {any} root @param {any} options
 */
export function mountVisualOwner(root,options={}) {
  if(owners.has(root))return owners.get(root);
  const platform=options.platform||browserPlatform(root),life=createLifetime();
  const document=platform.document,window=platform.window;
  // Components can update while imports/fonts/devices are still pending. Keep the
  // newest semantic state and replay it only after this owner adopts its effects.
  const latestOptions={...options};
  let effects=null,dirty=true,reducedMotion=false,userPaused=!!options.userPaused,finePointer=false,hidden=false;
  let pointer={cx:-10000,cy:-10000};const visibility=new Map();
  const regions=options.regions||{};
  const sync=()=>{
    if(!life.alive)return;
    life.pause('reduced-motion',reducedMotion);life.pause('user',userPaused);life.pause('hidden',hidden);
    root.classList?.toggle('is-static',reducedMotion||userPaused);
    root.dataset&&(root.dataset.motion=life.paused?'paused':'running');
    effects?.policy?.({reducedMotion,userPaused,finePointer,hidden,paused:life.paused});
    scheduler.stop();dirty=true;scheduler.request();
  };
  const state=()=>({reducedMotion,userPaused,finePointer,hidden,paused:life.paused,pointer,
    visible:key=>visibility.get(key)!==false});
  const scheduler=createScheduler(life,platform,(dt)=>{
    if(dirty){dirty=false;effects?.resize?.(state());}
    return !!effects?.frame?.(dt,state());
  });
  const invalidate=()=>{if(life.alive){dirty=true;scheduler.request();}};
  const measure=()=>{
    for(const [key,el] of Object.entries(regions)){
      const box=el?.getBoundingClientRect?.();
      if(box)visibility.set(key,box.bottom>0&&box.top<(window?.innerHeight||1000)&&box.right>0&&box.left<(window?.innerWidth||1440));
    }
  };
  const handle={
    get destroyed(){return !life.alive;},get pending(){return scheduler.pending;},
    updateOptions(next){if(!life.alive)return;Object.assign(latestOptions,next);effects?.updateOptions?.(next);if('userPaused'in next)userPaused=next.userPaused;
      if('reducedMotion'in next)reducedMotion=next.reducedMotion;if('finePointer'in next)finePointer=next.finePointer;sync();},
    invalidate,
    destroy(){if(!life.alive)return;life.destroy();effects=null;owners.delete(root);
      root.classList?.remove('is-static');if(root.dataset)delete root.dataset.motion;}
  };
  owners.set(root,handle);
  if(document&&window){
    const motion=platform.media('(prefers-reduced-motion: reduce)'),pointerQuery=platform.media('(hover: hover) and (pointer: fine)');
    reducedMotion=motion.matches;finePointer=pointerQuery.matches;hidden=document.hidden;
    life.own(platform.listen(motion,'change',()=>{reducedMotion=motion.matches;sync();}));
    life.own(platform.listen(pointerQuery,'change',()=>{finePointer=pointerQuery.matches;sync();}));
    life.own(platform.listen(document,'visibilitychange',()=>{hidden=document.hidden;sync();}));
    life.own(platform.listen(window,'resize',()=>{measure();invalidate();},{passive:true}));
    life.own(platform.listen(window,'scroll',()=>{measure();effects?.scroll?.(state());invalidate();},{passive:true}));
    // Account art cannot receive events because it sits behind interactive forms.
    // Its passive window sampling still belongs to this root's terminal lifetime.
    const pointerTarget=options.pointerTarget==='window'?window:root;
    life.own(platform.listen(pointerTarget,'pointermove',event=>{pointer={cx:event.clientX,cy:event.clientY};effects?.pointer?.(event,state());},{passive:true}));
    life.own(platform.listen(pointerTarget,'pointerleave',()=>{pointer={cx:-10000,cy:-10000};effects?.pointerLeave?.();},{passive:true}));
    life.own(platform.observe(Object.values(regions),(target,visible)=>{
      if(!life.alive)return;for(const [key,el]of Object.entries(regions))if(el===target)visibility.set(key,visible);sync();
    }));
    life.own(platform.resize(root,invalidate));measure();
  }
  const initialized=options.init?.({life,platform,invalidate,state,regions});
  life.adopt(Promise.resolve(initialized),value=>value.destroy?.()).then(value=>{
    if(!life.alive||!value)return;
    effects=value;effects.updateOptions?.(latestOptions);sync();
  });
  sync();return handle;
}
