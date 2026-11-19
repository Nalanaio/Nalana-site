<script>
  import { onMount } from 'svelte';
  import { mountMarketingVisuals } from '#lib/animations/marketing.js';
  import '#lib/styles/grace-site.css';
  export let featureIndex=0;
  export let userPaused=false;
  export let onFeatureAdvance=(_index)=>{};
  let root,handle;
  onMount(()=>{handle=mountMarketingVisuals(root,{featureIndex,userPaused,onFeatureAdvance});return ()=>handle.destroy();});
  $: handle?.updateOptions({featureIndex,userPaused});
  export function selectFeature(index){handle?.updateOptions({featureIndex:index,manualFeature:true});}
</script>
<div class="grace-site" bind:this={root} style="--s:min(calc(100vw / 1440px),1.25);--ox:0px">
  <div class="cursor" aria-hidden="true"><div class="cursor-dot"></div><div class="cursor-ring"></div></div>
  <slot />
</div>
