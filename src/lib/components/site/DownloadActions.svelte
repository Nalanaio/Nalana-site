<script>
  import { onMount } from 'svelte';
  import { observeDownloadClick } from '$lib/download.js';
  import { downloadPlatform } from '$lib/download-platform.js';
  export let platform='both';
  onMount(()=>{
    const browser=/** @type {Navigator & {userAgentData?:{platform?:string,mobile?:boolean}}} */(navigator);
    platform=downloadPlatform({userAgent:browser.userAgent,platform:browser.userAgentData?.platform||browser.platform,
      mobile:browser.userAgentData?.mobile,maxTouchPoints:browser.maxTouchPoints});
  });
</script>

<div class="download-actions" class:windows-primary={platform==='windows'}>
  {#if platform!=='windows'}<a class="btn btn-lg download-mac" data-sveltekit-reload href="/api/download?platform=mac"
    on:click={event=>observeDownloadClick('mac',event)} on:auxclick={event=>event.button===1&&observeDownloadClick('mac',event)}>Download for Mac</a>{/if}
  {#if platform!=='mac'}<a class="btn btn-lg download-windows" class:secondary={platform==='both'} data-sveltekit-reload href="/api/download?platform=windows"
    on:click={event=>observeDownloadClick('windows',event)} on:auxclick={event=>event.button===1&&observeDownloadClick('windows',event)}>Download for Windows</a>{/if}
</div>
