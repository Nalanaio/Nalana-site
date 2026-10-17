import test from 'node:test';
import assert from 'node:assert/strict';
import { createLifetime, createScheduler, createWorkflowClock } from '../src/lib/animations/lifetime.js';
import { mountVisualOwner } from '../src/lib/animations/owner.js';

function clock() {
  let id=0; const queue=new Map();
  return { queue, requestFrame(fn){queue.set(++id,fn);return id;},cancelFrame(id){queue.delete(id);},
    tick(t){const jobs=[...queue.values()];queue.clear();jobs.forEach(fn=>fn(t));} };
}
test('lifetime destruction is terminal and releases late asynchronous resources',async()=>{
  const life=createLifetime(); let release=(_value)=>{}; let disposed=0;
  const pending=new Promise(resolve=>release=resolve);
  const adopted=life.adopt(pending,resource=>resource.destroy());
  life.destroy(); life.destroy(); release({destroy(){disposed++;}});
  assert.equal(await adopted,null); assert.equal(disposed,1); assert.equal(life.alive,false);
});
test('scheduler owns one frame and ignores callbacks queued before terminal destruction',()=>{
  const platform=clock();const life=createLifetime();let draws=0;
  const scheduler=createScheduler(life,platform,()=>{draws++;return true;});
  scheduler.request();scheduler.request();assert.equal(platform.queue.size,1);
  const stale=[...platform.queue.values()][0];life.destroy();stale(20);
  assert.equal(draws,0);assert.equal(platform.queue.size,0);
});
test('pause resumes with zero elapsed time rather than catching up background time',()=>{
  const platform=clock();const life=createLifetime();const deltas=[];
  const scheduler=createScheduler(life,platform,dt=>{deltas.push(dt);return true;});
  scheduler.request();platform.tick(1);platform.tick(21);scheduler.stop();
  scheduler.request();platform.tick(60000);life.destroy();
  assert.deepEqual(deltas,[0,0.02,0]);
});
test('twenty five generations return owned frame and cleanup counts to baseline',()=>{
  const platform=clock();let live=0;
  for(let n=0;n<25;n++){const life=createLifetime();live++;life.own(()=>live--);
    const scheduler=createScheduler(life,platform,()=>true);scheduler.request();platform.tick(n*20);life.destroy();}
  assert.equal(live,0);assert.equal(platform.queue.size,0);
});
test('workflow requires five eligible seconds and manual selection resets the interval',()=>{
  const advances=[];const workflow=createWorkflowClock(i=>advances.push(i));
  workflow.update(4,true);workflow.update(30,false);assert.deepEqual(advances,[]);
  workflow.select(2);workflow.update(4.99,true);assert.deepEqual(advances,[]);
  workflow.update(.01,true);assert.deepEqual(advances,[0]);
  workflow.update(100,false);assert.equal(workflow.progress,0);
});
test('independent pause reasons never clear each other',()=>{
  const life=createLifetime();life.pause('user',true);life.pause('hidden',true);life.pause('hidden',false);
  assert.equal(life.paused,true);life.pause('user',false);assert.equal(life.paused,false);life.destroy();
});
const root=()=>({dataset:{},classList:{toggle(){},remove(){}}});
test('same live root is deduplicated and independent roots release only their resources',async()=>{
  const platform=clock();const first=root(),second=root();let live=0;
  const init=()=>{live++;return {frame(){return true;},destroy(){live--;}};};
  const a=mountVisualOwner(first,{platform,init}),duplicate=mountVisualOwner(first,{platform,init});
  const b=mountVisualOwner(second,{platform,init});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(a,duplicate);assert.equal(live,2);assert.equal(platform.queue.size,2);
  a.destroy();assert.equal(live,1);assert.equal(platform.queue.size,1);b.destroy();assert.equal(live,0);
  const c=mountVisualOwner(first,{platform,init});assert.notEqual(c,a);c.destroy();
});
test('late controller initialization cannot attach, draw, or leave owned resources after unmount',async()=>{
  const platform=clock();let release=(_value)=>{},disposed=0,draws=0;
  const owner=mountVisualOwner(root(),{platform,init:()=>new Promise(resolve=>release=resolve)});
  const stale=[...platform.queue.values()][0];owner.destroy();release({frame(){draws++;return true;},destroy(){disposed++;}});
  await new Promise(resolve=>setImmediate(resolve));stale(30);
  assert.equal(draws,0);assert.equal(disposed,1);assert.equal(platform.queue.size,0);
});
test('paused owner becomes idle and clears only the selected pause reason on resume',async()=>{
  const platform=clock();let draws=0;
  const owner=mountVisualOwner(root(),{platform,init:()=>({frame(dt,state){if(state.paused)return false;draws++;return true;},destroy(){}})});
  await new Promise(resolve=>setImmediate(resolve));platform.tick(0);
  owner.updateOptions({userPaused:true,reducedMotion:true});platform.tick(20);assert.equal(platform.queue.size,0);
  owner.updateOptions({userPaused:false});platform.tick(40);assert.equal(draws,1);
  owner.updateOptions({reducedMotion:false});platform.tick(60000);assert.equal(draws,2);owner.destroy();
});
test('semantic updates arriving during deferred initialization retain the newest selection',async()=>{
  const platform=clock();let release=(_value)=>{},selected=null;
  const owner=mountVisualOwner(root(),{platform,material:null,init:()=>new Promise(resolve=>release=resolve)});
  owner.updateOptions({material:'forest'});owner.updateOptions({material:'flowers'});
  release({updateOptions(options){selected=options.material;},frame(){return false;},destroy(){}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(selected,'flowers');owner.destroy();
});
test('passive account pointer sampling reaches the owner and is removed with its lifetime',async()=>{
  const platform=clock(),window={},document={hidden:false},listeners=[];let pointer;
  Object.assign(platform,{window,document,media:()=>({matches:false}),
    listen(target,type,fn,options){const registration={target,type,fn,options};listeners.push(registration);
      return ()=>listeners.splice(listeners.indexOf(registration),1);},
    observe:()=>()=>{},resize:()=>()=>{}});
  const element=root(),owner=mountVisualOwner(element,{platform,pointerTarget:'window',
    init:()=>({frame(_dt,state){pointer=state.pointer;return false;},destroy(){}})});
  await new Promise(resolve=>setImmediate(resolve));
  const move=listeners.find(registration=>registration.type==='pointermove');
  assert.equal(move.target,window);assert.equal(move.options.passive,true);
  move.fn({clientX:250,clientY:400});platform.tick(0);
  assert.deepEqual(pointer,{cx:250,cy:400});owner.destroy();assert.equal(listeners.length,0);
});
test('effect policy receives the aggregate pause state while independent reasons change',async()=>{
  const platform=clock(),policies=[];
  const owner=mountVisualOwner(root(),{platform,init:()=>({policy(state){policies.push(state.paused);},frame(){return false;},destroy(){}})});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(policies.at(-1),false);
  owner.updateOptions({userPaused:true,reducedMotion:true});assert.equal(policies.at(-1),true);
  owner.updateOptions({userPaused:false});assert.equal(policies.at(-1),true);
  owner.updateOptions({reducedMotion:false});assert.equal(policies.at(-1),false);owner.destroy();
});
