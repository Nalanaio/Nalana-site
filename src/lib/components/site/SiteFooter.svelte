<script>
  import { onMount } from 'svelte';
  import { FOOTER_MATERIALS, FOOTER_MATERIAL_FRAME_HEIGHT, FOOTER_MATERIAL_MS, nextFooterMaterial } from './footer-materials.js';
  // -1 is the plain white N.
  let active=-1,shown=0,touchEnd=0,raf=0,startedAt=0,reducedMotion=false,root;
  function stop(){cancelAnimationFrame(raf);raf=0;active=-1;touchEnd=0;}
  function frame(now){
    if(touchEnd&&now>=touchEnd){stop();return;}
    // A frame's timestamp can precede the pointer event that started the run; the helper clamps it.
    const next=nextFooterMaterial(active,now-startedAt,shown);
    if(next!==active){active=next;shown++;}
    raf=requestAnimationFrame(frame);
  }
  // Every hover starts from the first material and loops until the pointer leaves.
  function enter(){if(reducedMotion)return;stop();startedAt=performance.now();active=0;shown=1;raf=requestAnimationFrame(frame);}
  // A tap fires pointerleave right after pointerup; on touch, a run lasts one full cycle.
  function leave(event){if(event.pointerType!=='touch')stop();else touchEnd=performance.now()+(FOOTER_MATERIALS.length-shown)*FOOTER_MATERIAL_MS;}
  onMount(()=>{
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>{reducedMotion=motion.matches;if(reducedMotion)stop();};sync();motion.addEventListener('change',sync);
    // Fetch and decode the two material sheets before the N is reachable, so the first hover never stalls.
    const warm=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting))return;warm.disconnect();
      root.querySelectorAll('.footer-n-material img').forEach(img=>{img.loading='eager';img.decode?.().catch(()=>{});});},{rootMargin:'1200px 0px'});
    warm.observe(root);
    return ()=>{motion.removeEventListener('change',sync);warm.disconnect();stop();};
  });
  function privacySettings(event){window.dispatchEvent(new CustomEvent('nalana:privacy-settings', { detail: { opener: event.currentTarget } }));}
</script>
<footer class="dsec footer" id="contact" style="--h:864">
  <div class="dstage">
    <div class="footer-river" aria-hidden="true"><img src="/assets/site/figma-river-footer.png" alt="" /><div class="footer-caustic"></div><canvas class="footer-ripples"></canvas></div>
    <div class="footer-bar"><img class="footer-logo" src="/assets/site/figma-logo-footer.svg" width="58" height="58" alt="Nalana" /><nav class="footer-links" aria-label="Contact"><a href="https://x.com/nalanaio">Twitter</a><a href="https://discord.gg/GXjbwrcwFz">Discord</a><a href="mailto:clarence@nalana.io">clarence@nalana.io</a></nav></div>
    <nav class="footer-legal" aria-label="Legal"><span>Legal</span><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/eula">EULA</a><a href="/refund">Refund</a><a href="/cookies">Cookies</a><a href="/open-source">Open Source</a><button type="button" on:click={privacySettings}>Privacy settings</button></nav>
    <div class="footer-n" bind:this={root} class:is-material={active!==-1} data-material={active===-1?'white':FOOTER_MATERIALS[active].name} aria-hidden="true"
      on:pointerenter={enter} on:pointerleave={leave}>
      <img class="footer-n-white" src="/assets/site/footer-n-white.svg" alt="" width="194" height="196" />
      {#each FOOTER_MATERIALS as material,index}
        <div class="footer-n-material" class:is-active={active===index} style={'width:'+(material.width/FOOTER_MATERIAL_FRAME_HEIGHT*196).toFixed(2)+'px'}>
          <img src={material.sheet} alt="" loading="lazy" decoding="async"
            style={'left:'+material.crop[0]+'%;top:'+material.crop[1]+'%;width:'+material.crop[2]+'%;height:'+material.crop[3]+'%'} />
        </div>
      {/each}
    </div>
  </div>
</footer>
