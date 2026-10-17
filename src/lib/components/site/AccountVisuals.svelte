<script>
  import { onMount } from 'svelte';
  import { mountAccountVisuals } from '$lib/animations/account.js';
  let root,handle,userPaused=false;
  onMount(()=>{handle=mountAccountVisuals(root,{userPaused});return ()=>handle.destroy();});
  $: handle?.updateOptions({userPaused});
</script>
<div class="account-decoration" bind:this={root}>
  <div class="acct-river" aria-hidden="true"><div class="acct-water"><img class="acct-static" src="/assets/site/river-signin.svg" alt="" /><div class="acct-caustic"></div><canvas class="acct-ripples"></canvas></div></div>
</div>
<button class="account-motion-toggle" type="button" aria-pressed={userPaused} on:click={()=>userPaused=!userPaused}>{userPaused?'Resume motion':'Pause motion'}</button>
<style>
 .account-decoration{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
 .acct-river{position:absolute;inset:0;overflow:hidden;pointer-events:none}
 .acct-water{position:absolute;left:0;top:0;width:2345.08px;height:1775.82px;transform-origin:0 0;transform:translate(-473.6px,-265px) rotate(-122.85deg);mask:url('/assets/site/river-signin-mask.svg') 0 0/100% 100% no-repeat;background:#b8e8fc}
 .acct-static,.acct-caustic,.acct-ripples{position:absolute;inset:0;width:100%;height:100%}
 .acct-caustic :global(canvas){display:block;width:100%;height:100%}
 .account-motion-toggle{position:fixed;bottom:18px;right:18px;z-index:60;border:1px solid #8a6cc7;background:#fff;color:#6849a2;padding:9px 14px;border-radius:24px;font:500 12px Inter,sans-serif;cursor:pointer}
</style>
