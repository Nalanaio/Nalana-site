/** An animation owner's terminal lifetime. Importing this file never reads browser globals. */
export function createLifetime() {
  const abort=new AbortController(); const cleanups=[];const reasons=new Set();let alive=true;
  const life={
    get alive(){return alive;},get signal(){return abort.signal;},get paused(){return reasons.size>0;},
    pause(reason,on){if(on)reasons.add(reason);else reasons.delete(reason);},
    own(cleanup){if(alive)cleanups.push(cleanup);else cleanup();return cleanup;},
    async adopt(promise,dispose){
      try{const resource=await promise;if(!resource)return null;if(!alive){dispose(resource);return null;}
        life.own(()=>dispose(resource));return resource;
      }catch{return null;}
    },
    destroy(){if(!alive)return;alive=false;abort.abort();
      for(const cleanup of cleanups.splice(0).reverse()){try{cleanup();}catch{/* other owned resources still release */}}
      reasons.clear();
    }
  };return life;
}

/** Exactly one pending frame; stopping resets time and stale callbacks cannot restart it. */
export function createScheduler(life,platform,update) {
  let frame=null,last=null,generation=0;
  const scheduler={
    request(){if(!life.alive||frame!==null)return;const epoch=generation;
      frame=platform.requestFrame(now=>{
        if(!life.alive||epoch!==generation)return;frame=null;
        const dt=last===null?0:Math.min(.05,Math.max(0,(now-last)/1000));last=now;
        if(update(dt,now)&&life.alive)scheduler.request();else last=null;
      });
    },
    stop(){generation++;if(frame!==null)platform.cancelFrame(frame);frame=null;last=null;},
    get pending(){return frame!==null;}
  };life.own(()=>scheduler.stop());return scheduler;
}

/** Active-time clock for Grace's five second workflow; no timeout can outlive its root. */
export function createWorkflowClock(onAdvance) {
  let elapsed=0,selected=0,wasEligible=false;
  return {get progress(){return elapsed/5;},select(index){selected=index;elapsed=0;},
    update(dt,eligible){
      if(!eligible){wasEligible=false;return;}
      if(!wasEligible){wasEligible=true;}
      elapsed+=dt;
      if(elapsed>=5-1e-9){elapsed=0;selected=(selected+1)%3;onAdvance(selected);}
    },reset(){elapsed=0;wasEligible=false;}
  };
}
