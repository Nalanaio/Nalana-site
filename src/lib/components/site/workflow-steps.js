/** Length of /assets/site/workflow-demo.webm in seconds. */
export const WORKFLOW_DEMO_SECONDS=19.784;
/** Caption boundaries, in seconds into the demo video. */
export const WORKFLOW_STEP_STARTS=[0,9,15];

/** Index of the caption that belongs to a playback time. @param {number} time */
export function workflowStepAt(time){
  let step=0;
  WORKFLOW_STEP_STARTS.forEach((start,index)=>{if(time>=start)step=index;});
  return step;
}

/** Fraction of the whole demo that has played, clamped to 0..1. @param {number} time @param {number} duration */
export function workflowProgressAt(time,duration){
  if(!(duration>0)||!Number.isFinite(time))return 0;
  return Math.min(1,Math.max(0,time/duration));
}
