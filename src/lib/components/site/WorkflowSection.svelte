<script>
  import { onMount } from 'svelte';
  import HeadingLetters from './HeadingLetters.svelte';
  import { WORKFLOW_DEMO_SECONDS, workflowStepAt, workflowProgressAt } from './workflow-steps.js';
  export let paused=false;

  const captions=['Let your imagination run wild','Generate your project','Make edits with AI or directly in blender.'];
  let video,fill,step=0,visible=false,reducedMotion=false,raf=0;

  // MediaRecorder-style WebM files can report an Infinity duration, so fall
  // back to the known length of the demo cut.
  const duration=()=>Number.isFinite(video?.duration)&&video.duration>0?video.duration:WORKFLOW_DEMO_SECONDS;
  function paint(){
    if(!video||!fill)return;
    const time=video.currentTime;
    fill.style.transform=`scaleX(${workflowProgressAt(time,duration())})`;
    const next=workflowStepAt(time);
    if(next!==step)step=next;
  }
  function loop(){paint();raf=video&&!video.paused?requestAnimationFrame(loop):0;}
  function start(){if(!raf)raf=requestAnimationFrame(loop);}
  $: shouldPlay=visible&&!paused&&!reducedMotion;
  $: if(video){if(shouldPlay)video.play()?.catch(()=>{});else video.pause();}

  onMount(()=>{
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion=()=>reducedMotion=motion.matches;syncMotion();motion.addEventListener('change',syncMotion);
    const observer=new IntersectionObserver(([entry])=>visible=entry.isIntersecting,{rootMargin:'300px 0px',threshold:0});observer.observe(video);
    return ()=>{motion.removeEventListener('change',syncMotion);observer.disconnect();cancelAnimationFrame(raf);};
  });
</script>
<section class="dsec workflow" id="workflow" style="--h:998" aria-labelledby="workflow-title">
  <div class="dstage">
    <h2 class="subhead wf-title" id="workflow-title" aria-label="The Nalana Workflow"><HeadingLetters text="The Nalana Workflow" /></h2>
    <div class="wf-player">
      <div class="wf-track" aria-hidden="true"><i class="wf-fill" bind:this={fill}></i></div>
      <p class="wf-caption">{captions[step]}</p>
      <!-- svelte-ignore a11y_media_has_caption -->
      <video class="wf-video" bind:this={video} src="/assets/site/workflow-demo.webm" poster="/assets/site/workflow-demo-poster.jpg" muted loop playsinline preload="auto" controls={reducedMotion}
        aria-label="Nalana demo: describe an idea, generate the project, then make edits with AI or directly in Blender"
        on:play={start} on:seeked={paint} on:timeupdate={paint} on:loadedmetadata={paint}></video>
    </div>
  </div>
</section>
