<script>
  export let material=null;
  export let onMaterial=(_key)=>{};
  function privacySettings(){window.dispatchEvent(new CustomEvent('nalana:privacy-settings'));}
</script>
<footer class="dsec footer" id="contact" style="--h:864">
  <div class="dstage">
    <div class="footer-river" aria-hidden="true"><div class="footer-caustic"></div><img src="/assets/site/river-footer.svg" alt="" /><canvas class="footer-ripples"></canvas></div>
    <div class="footer-bar"><img class="footer-logo" src="/assets/site/logo-footer.svg" alt="Nalana" /><nav class="footer-links" aria-label="Contact"><a href="https://x.com/nalanaio">Twitter</a><a href="https://discord.gg/GXjbwrcwFz">Discord</a><a href="mailto:clarence@nalana.io">clarence@nalana.io</a></nav></div>
    <nav class="footer-legal" aria-label="Legal"><span>Legal</span><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/eula">EULA</a><a href="/refund">Refund</a><a href="/cookies">Cookies</a><a href="/open-source">Open Source</a><button type="button" on:click={privacySettings}>Privacy settings</button></nav>
    <div class="floating-nalana" aria-hidden="true"><img class="fn-shadow" src="/assets/site/pedestal-shadow.svg" alt="" /><img class="fn-top" src="/assets/site/pedestal-top.svg" alt="" /><img class="fn-detail" src="/assets/site/pedestal-detail.svg" alt="" /><div class="fn-float"><div class="fn-sculpt"><img class="fn-balloon" src="/assets/site/nalana-balloon.png" alt="" /></div></div></div>
    <div class="material-controls" role="group" aria-label="Balloon materials"><span>Explore materials</span>{#each ['sky','forest','flowers'] as key}<button type="button" aria-pressed={material===key} on:click={()=>onMaterial(material===key?null:key)}>{key}</button>{/each}<button type="button" aria-pressed={material===null} on:click={()=>onMaterial(null)}>Original</button></div>
  </div>
</footer>
