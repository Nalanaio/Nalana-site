import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoClock } from '../src/lib/animations/demo-clock.js';

function fixture(){
  let time=0,id=0;const pending=new Map();
  const clock=createDemoClock({now:()=>time,schedule:(fn,delay)=>{pending.set(++id,{fn,at:time+delay});return id;},cancel:key=>pending.delete(key)});
  return {clock,advance(ms){const end=time+ms;for(;;){const next=[...pending].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;pending.delete(next[0]);next[1].fn();}time=end;},pending};
}
test('demo delay resumes from the paused position without catching up',()=>{
  const {clock,advance}=fixture();let steps=0;
  clock.after(()=>steps++,100);advance(1000);assert.equal(steps,0);
  clock.setPaused(false);advance(40);clock.setPaused(true);advance(5000);assert.equal(steps,0);
  clock.setPaused(false);advance(59);assert.equal(steps,0);advance(1);assert.equal(steps,1);
  advance(1000);assert.equal(steps,1);
});
test('destroy cancels callbacks and settles asynchronous playback',async()=>{
  const {clock,advance,pending}=fixture();let called=false;
  clock.setPaused(false);const waiter=clock.sleep(50);clock.after(()=>called=true,50);
  clock.destroy();clock.destroy();advance(1000);
  assert.equal(await waiter,false);assert.equal(called,false);assert.equal(pending.size,0);
  assert.equal(await clock.sleep(1),false);
});
test('running playback releases completed jobs and advances a sequence once',async()=>{
  const {clock,advance,pending}=fixture();clock.setPaused(false);
  const first=clock.sleep(10);advance(10);assert.equal(await first,true);assert.equal(pending.size,0);
  const second=clock.sleep(20);advance(20);assert.equal(await second,true);assert.equal(pending.size,0);
  clock.destroy();
});
