<script>
  import { onMount } from 'svelte';
  import { mountMarketingVisuals } from '$lib/animations/marketing.js';
  import '$lib/styles/grace-site.css';
  export let workflowStep=0;
  export let workflowInteracting=false;
  export let featureIndex=0;
  export let material=null;
  export let userPaused=false;
  export let onWorkflowAdvance=(_index)=>{};
  export let onFeatureAdvance=(_index)=>{};
  let root,handle;
  onMount(()=>{handle=mountMarketingVisuals(root,{workflowStep,workflowInteracting,featureIndex,material,userPaused,onWorkflowAdvance,onFeatureAdvance});return ()=>handle.destroy();});
  $: handle?.updateOptions({workflowStep,workflowInteracting,featureIndex,material,userPaused});
  export function selectFeature(index){handle?.updateOptions({featureIndex:index,manualFeature:true});}
  export function selectWorkflow(index){handle?.updateOptions({workflowStep:index,manualWorkflow:true});}
</script>
<div class="grace-site" bind:this={root} style="--s:min(calc(100vw / 1440px),1.25);--ox:0px">
  <div class="cursor" aria-hidden="true"><div class="cursor-dot"></div><div class="cursor-ring"></div></div>
  <slot />
</div>
