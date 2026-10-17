/** Pause-aware demo delays. Completed jobs are released; destroy settles waiters.
 * @param {{now?:()=>number,schedule?:(run:()=>void,delay:number)=>any,cancel?:(id:any)=>void}} options
 */
export function createDemoClock({ now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  const jobs = new Set();
  let paused = true, destroyed = false;
  function arm(job) {
    if (paused || destroyed) return;
    job.started = now();
    job.id = schedule(() => { jobs.delete(job); job.run(); }, job.remaining);
  }
  function after(run, delay, abandoned = () => {}) {
    if (destroyed) { abandoned(); return; }
    const job = { run, abandoned, remaining: delay, started: 0, id: null };
    jobs.add(job); arm(job);
  }
  return {
    after,
    sleep: delay => new Promise(resolve => after(() => resolve(true), delay, () => resolve(false))),
    setPaused(value) {
      if (destroyed || paused === value) return;
      paused = value;
      for (const job of jobs) {
        if (paused) {
          cancel(job.id); job.id = null;
          job.remaining = Math.max(0, job.remaining - (now() - job.started));
        } else arm(job);
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const job of jobs) { cancel(job.id); job.abandoned(); }
      jobs.clear();
    },
  };
}
