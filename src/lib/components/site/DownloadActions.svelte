<script>
  import { onMount } from 'svelte';
  import { observeDownloadClick } from '#lib/download.js';
  import { downloadPlatform } from '#lib/download-platform.js';
  export let platform='both';
  /** Where on the page this block sits; reported with the CTA click. */
  export let location='hero';
  onMount(()=>{
    const browser=/** @type {Navigator & {userAgentData?:{platform?:string,mobile?:boolean}}} */(navigator);
    platform=downloadPlatform({userAgent:browser.userAgent,platform:browser.userAgentData?.platform||browser.platform,
      mobile:browser.userAgentData?.mobile,maxTouchPoints:browser.maxTouchPoints});
  });
</script>

<div class="download-actions" class:windows-primary={platform==='windows'}>
  {#if platform!=='windows'}<a class="btn btn-lg download-mac" data-sveltekit-reload href="/api/download?platform=mac" data-cta-id="download_mac" data-cta-location={location}
    on:click={event=>observeDownloadClick('mac',event)} on:auxclick={event=>event.button===1&&observeDownloadClick('mac',event)}>Download for Mac</a>{/if}
  {#if platform!=='mac'}<a class="btn btn-lg download-windows" class:secondary={platform==='both'} data-sveltekit-reload href="/api/download?platform=windows" data-cta-id="download_windows" data-cta-location={location}
    on:click={event=>observeDownloadClick('windows',event)} on:auxclick={event=>event.button===1&&observeDownloadClick('windows',event)}>Download for Windows</a>{/if}
</div>
