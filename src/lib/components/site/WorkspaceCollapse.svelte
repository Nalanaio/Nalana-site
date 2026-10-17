<script>
  import { onMount } from 'svelte';
  export let paused=false;
  let root,visible=false,hidden=false;
  // The existing site's section 02 illustration, fitted to Grace's laptop.
  onMount(()=>{
    const sync=()=>hidden=document.hidden;
    sync();document.addEventListener('visibilitychange',sync);
    const observer=window.IntersectionObserver?new IntersectionObserver(entries=>visible=entries.some(entry=>entry.isIntersecting)):null;
    if(observer)observer.observe(root);else visible=true;
    return ()=>{observer?.disconnect();document.removeEventListener('visibilitychange',sync);};
  });
</script>
<div class="workspace-collapse" class:is-playing={visible&&!hidden&&!paused} bind:this={root}>
  <div class="appwin modeler">Modeler</div>
  <div class="appwin sculpt">Sculpt</div>
  <div class="appwin uv">UV</div>
  <div class="appwin render">Render</div>
  <div class="appwin texture">Texture</div>
  <div class="appmain"><img src="/assets/site/logo.svg" alt="" /></div>
</div>
<style>
  .workspace-collapse{position:relative;width:100%;height:100%;overflow:hidden;container-type:size;background:linear-gradient(160deg,#eef2fb,#e4eaf6);border:1px solid #fffc;box-shadow:inset 0 2px 10px #ffffffb3;display:flex;align-items:center;justify-content:center}
  .appwin{position:absolute;border-radius:1.8cqw;background:#fff;border:1px solid #0f172a1a;box-shadow:0 6px 16px #141e501a;display:flex;align-items:center;justify-content:center;font-size:1.9cqw;font-weight:600;color:#9aa0ac;animation:collapse 3.2s ease-in-out infinite;animation-play-state:paused}
  .modeler{top:20%;left:13%;width:14%;height:15%;--fx:28cqw;--fy:22.4cqh}
  .sculpt{top:16%;right:14%;width:12.8%;height:14%;--fx:-27.6cqw;--fy:26.7cqh;animation-delay:.15s}
  .uv{bottom:18%;left:18%;width:13.2%;height:14.5%;--fx:24cqw;--fy:-24.2cqh;animation-delay:.3s}
  .render{bottom:15%;right:17%;width:12%;height:13.3%;--fx:-25.6cqw;--fy:-27.9cqh;animation-delay:.45s}
  .texture{top:46%;left:8%;width:11.2%;height:12.1%;--fx:34.4cqw;--fy:-1.8cqh;animation-delay:.6s}
  .appmain{position:relative;z-index:2;width:23.6%;height:24.8%;border-radius:2.6cqw;background:linear-gradient(160deg,#fff,#eaf1fd);border:1px solid #ffffffe6;box-shadow:0 14px 34px -10px #1085ef6b;display:flex;align-items:center;justify-content:center;animation:pop-main 3.2s ease-in-out infinite;animation-play-state:paused}
  .appmain img{width:4.8cqw;height:8.8cqh;object-fit:contain}
  .is-playing .appwin,.is-playing .appmain{animation-play-state:running}
  @keyframes collapse{0%,12%{transform:translate(0,0) scale(1);opacity:1}75%{transform:translate(calc(var(--fx)*.9),calc(var(--fy)*.9)) scale(.34);opacity:.95}100%{transform:translate(var(--fx),var(--fy)) scale(.06);opacity:0}}
  @keyframes pop-main{0%,18%{transform:scale(.82);opacity:.35}50%,100%{transform:scale(1);opacity:1}}
  @media(prefers-reduced-motion:reduce){.appwin,.appmain{animation:none}}
</style>
