<script>
  import { page } from '$app/state';
  import { CHANNEL_NAMES, DOWNLOAD_CHANNELS, channelPageHref } from '#lib/download-channel.js';
  export let channel='stable';
  /** { stable:{label,available}, beta:{label,available} } from the page load. */
  export let releases={};
  /** The hint explaining an unavailable channel. */
  export let hintId=null;
  export let onSelect=(_channel)=>{};
  let radios=[];
  const unavailable=(value)=>releases?.[value]?.available===false;
  function choose(value){if(!unavailable(value)&&value!==channel)onSelect(value);}
  // Without JavaScript each segment is an ordinary link to ?channel=…, rendered
  // by the server; once hydrated, the same anchors behave as a radiogroup.
  function click(event,value){event.preventDefault();choose(value);}
  function key(event,index){
    const last=DOWNLOAD_CHANNELS.length-1;
    if(event.key===' '||event.key==='Enter'){event.preventDefault();choose(DOWNLOAD_CHANNELS[index]);return;}
    const next=['ArrowRight','ArrowDown'].includes(event.key)?(index===last?0:index+1)
      :['ArrowLeft','ArrowUp'].includes(event.key)?(index===0?last:index-1)
      :event.key==='Home'?0:event.key==='End'?last:null;
    if(next===null)return;
    event.preventDefault();radios[next]?.focus();choose(DOWNLOAD_CHANNELS[next]);
  }
</script>

<div class="channel-toggle" class:is-unavailable={unavailable(channel)} role="radiogroup" aria-label="Release channel" data-channel={channel}>
  {#each DOWNLOAD_CHANNELS as value,index}<a bind:this={radios[index]} class="channel-option" role="radio" data-channel-option={value}
    href={unavailable(value)?undefined:channelPageHref(page.url,value)} data-sveltekit-reload
    aria-checked={channel===value} aria-disabled={unavailable(value)?'true':undefined}
    aria-describedby={unavailable(value)&&hintId?hintId:undefined} tabindex={channel===value?0:-1}
    on:click={event=>click(event,value)} on:keydown={event=>key(event,index)}><span class="channel-dot" aria-hidden="true"></span>{CHANNEL_NAMES[value]}</a>{/each}
</div>
