import { mountVisualOwner } from './owner.js';

/** Grace's rotated account river, independent of identity, forms and account data.
 * @param {HTMLElement} root @param {any} options
 */
export function mountAccountVisuals(root,options={}) {
  return mountVisualOwner(root,{...options,pointerTarget:'window',regions:{account:root},init:async({life,platform,invalidate})=>{
    const [{createCaustic},{createRipple}]=await Promise.all([import('./caustic.js'),import('./ripples.js')]);
    if(!life.alive)return null;
    const window=platform.window,water=/** @type {HTMLElement} */(root.querySelector('.acct-water'));
    const canvas=/** @type {HTMLCanvasElement} */(root.querySelector('.acct-ripples'));let renderer=null,scale=1,inverse=null;
    const BOX={x:-473.6,y:-265,w:2345.08,h:1775.82,deg:-122.85};
    const ripple=createRipple(canvas,{width:BOX.w,height:BOX.h,stage:water,scale:()=>scale,maxK:1,ambient:1.6,signal:life.signal,platform,rotate:{a:BOX.deg*Math.PI/180,cx:0,cy:0}});
    ripple.local=(x,y)=>inverse?inverse.transformPoint(new window.DOMPoint(x,y)):{x:-10000,y:-10000};
    life.own(()=>ripple.destroy());
    life.adopt(createCaustic(root.querySelector('.acct-caustic'),{platform,signal:life.signal,params:{maxWidth:1400,center:{x:50,y:50},scale:3.5,playhead:71.45,intensity:1,highlightColor:{r:.804,g:.961,b:1,a:1},waterColor:{r:.062745,g:.521568,b:.937254,a:1}}}),value=>value.destroy()).then(value=>{if(!life.alive)return;renderer=value;resize();invalidate();});
    function resize(){
      const vw=window.innerWidth,vh=window.innerHeight,dpr=Math.min(window.devicePixelRatio||1,2);
      scale=Math.max(vw/1440,vh/945);
      const ox=(vw-1440*scale)/2,oy=(vh-945*scale)/2;
      const matrix=new window.DOMMatrix().translate(ox,oy).scale(scale).translate(BOX.x+BOX.w/2,BOX.y+BOX.h/2).rotate(BOX.deg).translate(-BOX.w/2,-BOX.h/2);
      inverse=matrix.inverse();water.style.transform=matrix.toString();
      const k=Math.min(scale*dpr*.5,1400/BOX.w);
      renderer?.resize({width:BOX.w*k,height:BOX.h*k,dpr:1});ripple.resize({scale,dpr});
    }
    return {resize,
      // Runtime preference changes remove transient rings instead of freezing a
      // half-finished pointer wake on top of the intentional static river.
      policy(state){if(state.reducedMotion)ripple.renderStatic();},
      frame(dt,state){if(state.paused||!state.visible('account'))return false;renderer?.draw({delta:dt});ripple.update(dt,state.pointer,state);return true;},
      destroy(){renderer?.destroy();ripple.destroy();}};
  }});
}
