<script>
  import HeadingLetters from './HeadingLetters.svelte';
  import NalanaDemo from '#lib/components/NalanaDemo.svelte';
  export let productLabel='Nalana';
  export let paused=false;
  export let selected=0;
  export let onSelect=(_index)=>{};
  export let onInteraction=(_active)=>{};
  const steps=[
    {label:'CREATE',color:'#1085ef',title:'Start with your idea',body:'Describe the model you want to create and build it in an editable 3D workspace.'},
    {label:'ITERATE',color:'#f8d06c',title:'Make a meaningful revision',body:'Keep working in the same scene. Refine proportions, shape and details through conversation or direct editing.'},
    {label:'FINE TUNE',color:'#ff8c69',title:'Refine materials and your scene',body:'Develop the materials and assemble your scene while keeping the model available for your next edit.'}
  ];
  let tabs=[];let hovered=false,focused=false;
  $: onInteraction(hovered||focused);
  function select(index){onSelect(index);}
  function key(event,index){const delta=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
    const next=event.key==='Home'?0:event.key==='End'?2:delta?(index+delta+3)%3:null;
    if(next===null)return;event.preventDefault();select(next);tabs[next]?.focus();}
</script>
<section class="dsec workflow" id="workflow" style="--h:1150" aria-labelledby="workflow-title">
  <div class="dstage">
    <h2 class="subhead wf-title" id="workflow-title" aria-label="The Nalana Workflow"><HeadingLetters text="The Nalana Workflow" /></h2>
    <div class="wf-tabs" role="tablist" tabindex="-1" aria-label="Workflow steps" on:mouseenter={()=>hovered=true} on:mouseleave={()=>hovered=false}
      on:focusin={()=>focused=true} on:focusout={event=>{if(!event.currentTarget.contains(/** @type {Node} */(event.relatedTarget)))focused=false;}}>
      {#each steps as step,index}
        <button bind:this={tabs[index]} class="wf-tab" class:is-active={selected===index} type="button" role="tab" id={'workflow-tab-'+index}
          aria-selected={selected===index} aria-controls={'workflow-panel-'+index} tabindex={selected===index?0:-1}
          style={'--x:'+index*34.26+'%;--tab:'+step.color} on:click={()=>select(index)} on:keydown={event=>key(event,index)}>
          <span>{step.label}</span><i class="wf-bar" aria-hidden="true"></i>
        </button>
      {/each}
    </div>
    <div class="wf-card" aria-hidden="true"></div>
    <div class="wf-shot"><NalanaDemo {productLabel} {paused} /></div>
    <div class="workflow-description">
      {#each steps as step,index}<div role="tabpanel" id={'workflow-panel-'+index} aria-labelledby={'workflow-tab-'+index} hidden={selected!==index} tabindex="0"><h3>{step.title}</h3><p>{step.body}</p></div>{/each}
    </div>
  </div>
</section>
