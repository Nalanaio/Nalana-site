<script>
  import { onMount } from 'svelte';
  import { observeDownloadClick } from '#lib/download.js';
  import { downloadPlatform } from '#lib/download-platform.js';
  import { CHANNEL_NAMES, downloadHref, effectiveChannel } from '#lib/download-channel.js';
  /** 'mac', 'windows', 'mobile' (phones and tablets: no download) or 'both' (other desktops, e.g. Linux: Mac button plus a Windows link). */
  export let platform='both';
  /** Where on the page this block sits; reported with the CTA click. */
  export let location='hero';
  export let releases={};
  /** Figma writes "Download For Mac" in the hero and "Download for Mac" lower down. */
  export let joiner='for';
  /** Show the "Download Beta (unstable)" link after the slot (the hero, in Figma). */
  export let betaLink=false;
  const hintId=`${location}-download-hint`;
  onMount(()=>{
    const browser=/** @type {Navigator & {userAgentData?:{platform?:string,mobile?:boolean}}} */(navigator);
    platform=downloadPlatform({userAgent:browser.userAgent,platform:browser.userAgentData?.platform||browser.platform,
      mobile:browser.userAgentData?.mobile,maxTouchPoints:browser.maxTouchPoints});
  });
  const os={mac:'Mac',windows:'Windows'};
  $: value=platform==='windows'?'windows':'mac';
  // The button is the Stable build. If Stable is down it says so and offers Beta rather than swapping silently.
  $: target=effectiveChannel('stable',releases);
  $: stableDown=releases?.stable?.available===false;
  $: betaAvailable=releases?.beta?.available!==false;
  $: phone=platform==='mobile';
  // Linux and other desktops get the Mac button plus a plain Windows link.
  $: otherDesktop=platform==='both';
  $: label=target==='beta'?`Download Beta ${joiner} ${os[value]}`:`Download ${joiner} ${os[value]}`;
</script>

<div class="download-actions" class:is-phone={phone}>
  {#if !phone}<a class="btn btn-lg download-{value}" data-sveltekit-reload href={downloadHref(value,target)} data-cta-id="download_{value}" data-cta-location={location}
    data-channel={target} aria-describedby={stableDown?hintId:undefined}
    on:click={event=>observeDownloadClick(value,event,target)} on:auxclick={event=>event.button===1&&observeDownloadClick(value,event,target)}>{label}</a>
  {#if otherDesktop}<a class="windows-link" data-sveltekit-reload href={downloadHref('windows',target)} data-cta-id="download_windows" data-cta-location={location}
    data-channel={target} on:click={event=>observeDownloadClick('windows',event,target)} on:auxclick={event=>event.button===1&&observeDownloadClick('windows',event,target)}>{target==='beta'?'Download Beta':'Download'} for Windows</a>{/if}
  {#if stableDown}<p class="channel-unavailable" id={hintId}>{CHANNEL_NAMES.stable} builds are temporarily unavailable. Try again shortly.</p>{/if}{/if}
  <slot />
  {#if !phone&&betaLink&&betaAvailable&&target!=='beta'}<a class="beta-link" data-sveltekit-reload href={downloadHref(value,'beta')} data-cta-id="download_{value}_beta" data-cta-location={location}
    data-channel="beta" on:click={event=>observeDownloadClick(value,event,'beta')} on:auxclick={event=>event.button===1&&observeDownloadClick(value,event,'beta')}>Download Beta (unstable)</a>{/if}
</div>
