<script>
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { observeDownloadClick } from '#lib/download.js';
  import { downloadPlatform } from '#lib/download-platform.js';
  import { trackChannelToggle } from '#lib/analytics/loaders.js';
  import { CHANNEL_NAMES, DOWNLOAD_CHANNELS, downloadHref, effectiveChannel, rememberChannel } from '#lib/download-channel.js';
  import ChannelToggle from './ChannelToggle.svelte';
  export let platform='both';
  /** Where on the page this block sits; reported with the CTA click. */
  export let location='hero';
  export let channel='stable';
  export let releases={};
  /** Called after an explicit choice, so every CTA on the page follows it. */
  export let onChannel=(_channel)=>{};
  const hintId=`${location}-channel-hint`;
  onMount(()=>{
    const browser=/** @type {Navigator & {userAgentData?:{platform?:string,mobile?:boolean}}} */(navigator);
    platform=downloadPlatform({userAgent:browser.userAgent,platform:browser.userAgentData?.platform||browser.platform,
      mobile:browser.userAgentData?.mobile,maxTouchPoints:browser.maxTouchPoints});
  });
  // Never swap silently: when the selected channel is down the CTA names the other one.
  $: target=effectiveChannel(channel,releases);
  $: fallback=target!==channel;
  $: down=DOWNLOAD_CHANNELS.filter(value=>releases?.[value]?.available===false);
  $: betaNote=target==='beta'&&!fallback;
  $: described=betaNote||down.length>0;
  const os={mac:'Mac',windows:'Windows'};
  const label=(value,name)=>value==='beta'?`Download Beta for ${name}`:`Download for ${name}`;
  $: text=name=>fallback?`Download ${CHANNEL_NAMES[target]} for ${name}`:label(target,name);
  // Each button reserves the width of its longest label, so switching never resizes the column.
  $: labels=name=>[...new Set([label('stable',name),label('beta',name),text(name)])];
  function select(next){
    const from=channel;
    rememberChannel(window,next,href=>replaceState(href,page.state));
    try{trackChannelToggle({window,channel:next,from,location});}catch{/* Optional analytics. */}
    onChannel(next);
  }
</script>

<div class="download-actions" class:windows-primary={platform==='windows'} class:is-beta={target==='beta'}>
  <ChannelToggle {channel} {releases} {hintId} onSelect={select} />
  {#each ['mac','windows'] as value (value)}{#if platform===value||platform==='both'}<a class="btn btn-lg download-{value}" class:secondary={value==='windows'&&platform==='both'} data-sveltekit-reload
    href={downloadHref(value,target)} data-cta-id="download_{value}" data-cta-location={location} data-channel={target} aria-describedby={described?hintId:undefined}
    on:click={event=>observeDownloadClick(value,event,target)} on:auxclick={event=>event.button===1&&observeDownloadClick(value,event,target)}><span class="cta-labels">{#each labels(os[value]) as candidate}<span class:is-current={candidate===text(os[value])} aria-hidden={candidate===text(os[value])?undefined:'true'}>{candidate}</span>{/each}</span></a>{/if}{/each}
  <div class="channel-hint" id={hintId} aria-live="polite">{#if betaNote}<p class="beta-note"><strong>Beta may be unstable.</strong> It uses a separate beta account, so your stable sign-in won't carry over.</p>{/if}{#each down as value}<p class="channel-unavailable">{CHANNEL_NAMES[value]} builds are temporarily unavailable. Try again shortly.{#if value===channel&&fallback}{' '}You can download {CHANNEL_NAMES[target]} instead.{/if}</p>{/each}</div>
</div>
