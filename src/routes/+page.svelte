<script>
  import MarketingVisuals from '#lib/components/site/MarketingVisuals.svelte';
  import SiteHeader from '#lib/components/site/SiteHeader.svelte';
  import DownloadActions from '#lib/components/site/DownloadActions.svelte';
  import WorkflowSection from '#lib/components/site/WorkflowSection.svelte';
  import VisionSection from '#lib/components/site/VisionSection.svelte';
  import SiteFooter from '#lib/components/site/SiteFooter.svelte';
  import { HERO_OBJECTS } from '#lib/animations/hero.js';
  export let data;
  $: productLabel=data?.productLabel||'Nalana';
  $: downloadPlatform=data?.downloadPlatform||'both';
  let workflowStep=0,workflowInteracting=false,featureIndex=0,material=null,userPaused=false,visuals;
  function chooseFeature(index){featureIndex=index;visuals?.selectFeature(index);}
  function chooseWorkflow(index){workflowStep=index;visuals?.selectWorkflow(index);}
</script>
<svelte:head>
  <title>Nalana — AI 3D Workspace</title>
  <meta name="description" content="Create, iterate, and fine tune in one 3D workspace. Nalana is its own software, built on Blender." />
</svelte:head>
<MarketingVisuals bind:this={visuals} {workflowStep} {workflowInteracting} {featureIndex} {material} {userPaused}
  onWorkflowAdvance={index=>workflowStep=index} onFeatureAdvance={index=>featureIndex=index}>
  <SiteHeader />
  <button class="motion-toggle" type="button" aria-pressed={userPaused} on:click={()=>userPaused=!userPaused}>{userPaused?'Resume motion':'Pause motion'}</button>
  <main id="top">
    <section class="hero" aria-label="Nalana">
      <div class="stage">
        <div class="layer river-layer" aria-hidden="true"><div class="river"><img class="river-static" src="/assets/site/river.svg" alt="" /><div class="hero-caustic-host"></div><canvas class="river-ripples"></canvas></div></div>
        <div class="layer objects-layer" aria-hidden="true">
          {#each HERO_OBJECTS as object}<div class="obj hero-object-static" style={'left:'+object.box[0]+'px;top:'+object.box[1]+'px;width:'+object.box[2]+'px;height:'+object.box[3]+'px;display:grid;place-items:center'}><div class="obj-rot" style={'transform:rotate('+object.rot+'deg)'}><div class="obj-inner" style={'width:'+object.inner[0]+'px;height:'+object.inner[1]+'px'}><img class:cover={!object.crop} src={object.src} alt="" style={object.crop?'left:'+object.crop[0]+'%;top:'+object.crop[1]+'%;width:'+object.crop[2]+'%;height:'+object.crop[3]+'%':null} /></div></div></div>{/each}
        </div>
      </div>
      <div class="layer copy-layer"><h1 class="hero-title" aria-label="Create, iterate, and fine tune in one 3D workspace."><span aria-hidden="true"><span class="tw tw-create">Create,</span> <span class="tw tw-iterate">{#each [...'iterate,'] as character,index}<span class="ch" style={'--i:'+index}>{character}</span>{/each}</span> and <span class="tw tw-fine">{#each [...'fine tune'] as character,index}{#if character===' '}{' '}{:else}<span class="ch" style={'--i:'+index}><span class="s">{character}</span><span class="f">{character}</span></span>{/if}{/each}</span> in one <span class="amulya"><span class="tw tw-3d">3D<span class="title-overlay"></span></span> <span class="tw tw-ws">workspace.<span class="title-overlay"></span></span></span></span></h1></div>
      <div class="layer cta-layer"><div class="hero-download"><DownloadActions platform={downloadPlatform} /></div><p class="hero-sub">{productLabel} is out now.</p>
        <div class="trusted"><p class="trusted-label">Used by professionals at</p><img class="trusted-usc" src="/assets/site/logo-usc.png" alt="USC" /><span class="trusted-gda">GDA V</span><img class="trusted-wayfair" src="/assets/site/logo-wayfair.png" alt="Wayfair" /></div>
      </div>
    </section>
    <WorkflowSection selected={workflowStep} onSelect={chooseWorkflow} onInteraction={value=>workflowInteracting=value} {productLabel} paused={userPaused} />
    <VisionSection selected={featureIndex} onSelect={chooseFeature} platform={downloadPlatform} paused={userPaused} />
    <SiteFooter {material} onMaterial={key=>material=key} />
  </main>
</MarketingVisuals>
