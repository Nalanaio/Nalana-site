<script>
  import DownloadActions from './DownloadActions.svelte';
  import HeadingLetters from './HeadingLetters.svelte';
  import WorkspaceCollapse from './WorkspaceCollapse.svelte';
  export let platform='both';
  export let paused=false;
  export let selected=0;
  export let onSelect=(_index)=>{};
  const features=[
    {title:'Idea to model in minutes',body:"Skip the box-modeling grind. Say what you're after and Nalana builds it: clean, editable, ready to refine.",accent:'#ff8c69'},
    {title:'Iterate in plain language',body:'Ask for a taller back, warmer wood or softer bevels. Every change lands right in your scene.',accent:'#e4b335'},
    {title:'Hands-on when you want it',body:'Jump into the Modeler, Sculpt or UV workspace any time you want direct control of the mesh.',accent:'#1085ef'},
    {title:'Built on Blender',body:'Nalana is its own software, built on Blender, so your files and your pipeline come with you.',accent:'#a78ade'}
  ];let tabs=[];
  // Semantic selection changes immediately. One decorative copy supplies Grace's
  // 160ms exit while the newly selected panel enters over 320ms. Replacements
  // overwrite this bounded copy, so rapid input cannot apply stale text later.
  let prior=selected,leaving=null;
  $: if(selected!==prior){leaving=prior;prior=selected;}
  function key(event,index){let next=event.key==='ArrowRight'?(index+1)%4:event.key==='ArrowLeft'?(index+3)%4:event.key==='Home'?0:event.key==='End'?3:null;
    if(next===null)return;event.preventDefault();onSelect(next);tabs[next]?.focus();}
</script>
<section class="dsec vision" id="vision" style="--h:1040" aria-labelledby="vision-title">
  <div class="vision-pin"><div class="dstage vision-stage">
    <div class="vision-river" aria-hidden="true"><img src="/assets/site/river-laptop.svg" alt="" /><canvas class="vision-ripples"></canvas></div>
    <h2 class="subhead vision-title" id="vision-title" aria-label="Your Vision, High-End Craft"><HeadingLetters text="Your Vision, High-End Craft" /></h2>
    <p class="vision-sub">How Nalana supports your creative 3D process</p>
    <div class="macbook" aria-hidden="true"><div class="mb-body"><img src="/assets/site/macbook-body.svg" alt="" /></div><img class="mb-screen" src="/assets/site/macbook-screen.svg" alt="" /><div class="mb-display"><WorkspaceCollapse {paused} /></div><img class="mb-notch" src="/assets/site/macbook-notch.svg" alt="" /><img class="mb-camera" src="/assets/site/macbook-camera.svg" alt="" /></div>
    <article class="feature-card" class:has-feature-change={leaving!==null} style={'--accent:'+features[selected].accent} aria-label="Nalana features">
      {#if leaving!==null}{#key leaving}<div class="fc-slide fc-exit" aria-hidden="true"><span class="fc-num">{String(leaving+1).padStart(2,'0')}</span><h3 class="fc-title">{features[leaving].title}</h3><p class="fc-body">{features[leaving].body}</p></div>{/key}{/if}
      {#each features as feature,index}<div class="fc-slide" role="tabpanel" id={'feature-panel-'+index} aria-labelledby={'feature-tab-'+index} hidden={selected!==index}>
        <span class="fc-num">{String(index+1).padStart(2,'0')}</span><h3 class="fc-title">{feature.title}</h3><p class="fc-body">{feature.body}</p>
      </div>{/each}
      <div class="fc-dots" role="tablist" aria-label="Features">{#each features as feature,index}<button bind:this={tabs[index]} class="fc-dot" class:is-active={selected===index} role="tab" type="button" id={'feature-tab-'+index} aria-label={String(index+1).padStart(2,'0')+': '+feature.title} aria-controls={'feature-panel-'+index} aria-selected={selected===index} tabindex={selected===index?0:-1} on:click={()=>onSelect(index)} on:keydown={event=>key(event,index)}><i aria-hidden="true"></i></button>{/each}</div>
    </article>
    <div class="vision-download"><DownloadActions {platform} /></div>
  </div></div>
</section>
