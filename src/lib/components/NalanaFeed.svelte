<script>
  import { onMount, onDestroy } from 'svelte';

  let rootEl;
  let typed = '';
  let bubbles = [];

  let on = false;
  let dead = false;
  let looping = false;
  let timers = [];
  let io;

  const pairs = [
    ['model a desk lamp', 'Built it — clean, editable mesh.'],
    ['brushed steel finish', 'Applied a brushed steel material.'],
    ['make the legs taller', 'Raised the legs for you.'],
    ['walnut base', 'Swapped the base to walnut.'],
    ['bevel every edge', 'Beveled all hard edges.'],
    ['matte black', 'Done — matte black finish.'],
    ['a curved lounge chair', 'Modeled the chair shell.'],
    ['glass tabletop', 'Added a glass top, ready to refine.'],
    ['smooth the cylinders', 'Smooth-shaded the cylinders.'],
    ['chrome finish', 'Polished it to chrome.'],
  ];
  let order = [];
  let idx = 0;

  const sleep = (ms) =>
    new Promise((res) => {
      const id = setTimeout(res, ms);
      timers.push(id);
    });

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function next() {
    if (idx >= order.length) {
      order = shuffle(pairs.slice());
      idx = 0;
    }
    return order[idx++];
  }

  async function loop() {
    if (looping) return;
    looping = true;
    if (!bubbles.length) {
      const seed = next();
      bubbles = [{ who: 'user', text: seed[0] }, { who: 'nalana', text: seed[1] }];
    }
    while (on && !dead) {
      const [prompt, reply] = next();
      for (let i = 1; i <= prompt.length; i++) {
        if (!on || dead) { looping = false; return; }
        typed = prompt.slice(0, i);
        await sleep(34 + Math.random() * 28);
      }
      await sleep(480);
      if (!on || dead) { looping = false; return; }
      typed = '';
      bubbles = [...bubbles, { who: 'user', text: prompt }].slice(-4);
      await sleep(560);
      if (!on || dead) { looping = false; return; }
      bubbles = [...bubbles, { who: 'nalana', text: reply }].slice(-4);
      await sleep(1100);
    }
    looping = false;
  }

  onMount(() => {
    order = shuffle(pairs.slice());
    if (!('IntersectionObserver' in window) || !rootEl) {
      on = true;
      loop();
      return;
    }
    io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !on) { on = true; loop(); }
          else if (!e.isIntersecting) { on = false; }
        });
      },
      { threshold: 0.1 }
    );
    io.observe(rootEl);
  });

  onDestroy(() => {
    dead = true;
    on = false;
    timers.forEach((id) => clearTimeout(id));
    if (io) io.disconnect();
  });
</script>

<div class="feed" bind:this={rootEl}>
  <div class="glow-overlay"></div>

  <!-- header -->
  <div class="hdr">
    <div class="brand">
      <svg width="22" height="26" viewBox="0 0 69 82" fill="none"><path d="M68.5 69.33C68.5 71.51 66.73 73.29 64.54 73.29C62.67 73.29 61.07 71.97 60.52 70.18C59 65.25 56.25 59.81 52.4 54.57C42.79 41.47 29.98 34.54 23.78 39.09C17.59 43.63 20.36 57.93 29.97 71.03C30.65 71.95 30.01 73.29 28.86 73.29H11.75C9.54 73.29 7.75 71.5 7.75 69.29V4C7.75 1.79 9.54 0 11.75 0H15.14C17 0 18.6 1.29 19.17 3.05C20.73 7.8 23.41 12.98 27.08 17.99C36.69 31.09 49.5 38.02 55.7 33.47C61.89 28.93 59.12 14.63 49.51 1.53C49.04 0.9 49.49 0 50.27 0H64.5C66.71 0 68.5 1.79 68.5 4V69.33Z" fill="#FF8C69"/><path d="M61.75 69.33C61.75 71.51 59.98 73.29 57.79 73.29C55.92 73.29 54.32 71.97 53.77 70.18C52.25 65.25 49.5 59.81 45.65 54.57C36.04 41.47 23.23 34.54 17.03 39.09C10.84 43.63 13.61 57.93 23.22 71.03C23.9 71.95 23.26 73.29 22.11 73.29H5C2.79 73.29 1 71.5 1 69.29V4C1 1.79 2.79 0 5 0H8.39C10.25 0 11.85 1.29 12.42 3.05C13.98 7.8 16.66 12.98 20.33 17.99C29.94 31.09 42.75 38.02 48.95 33.47C55.14 28.93 52.37 14.63 42.76 1.53C42.29 0.9 42.74 0 43.52 0H57.75C59.96 0 61.75 1.79 61.75 4V69.33Z" fill="#1085EF"/></svg>
      <span class="status-dot"></span>
    </div>
    <div class="hdr-icons">
      <span class="q">?</span>
      <span class="burger"><span></span><span></span><span></span></span>
    </div>
  </div>

  <div class="model-row">
    <span class="model-pill">Select model ▾</span>
  </div>

  <!-- messages -->
  <div class="messages">
    {#each bubbles as b (b.who + b.text)}
      <div class="row" style="justify-content:{b.who === 'user' ? 'flex-end' : 'flex-start'};">
        <div class="bubble {b.who}">{b.text}</div>
      </div>
    {/each}
  </div>

  <!-- input -->
  <div class="input-wrap">
    <div class="input">
      <div class="typed-area">
        <span class="typed">{typed}</span>
        <span class="caret"></span>
      </div>
      <div class="send">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="6 11 12 5 18 11"></polyline></svg>
      </div>
    </div>
    <div class="online">
      <span class="online-dot"></span>
      <span>Online</span>
    </div>
  </div>
</div>

<style>
  .feed {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 24px;
    overflow: hidden;
    background: linear-gradient(150deg, rgba(255, 255, 255, 0.95), rgba(244, 247, 255, 0.88));
    border: 1px solid rgba(255, 255, 255, 0.85);
    box-shadow: 0 18px 44px -24px rgba(20, 30, 80, 0.4);
    font-family: 'Inter', sans-serif;
  }
  .glow-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(120% 80% at 100% 0%, rgba(255, 150, 170, 0.16), transparent 50%),
      radial-gradient(120% 90% at 0% 100%, rgba(90, 150, 255, 0.16), transparent 55%);
  }
  .hdr {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 14px 16px 6px;
    flex-shrink: 0;
  }
  .brand { display: flex; flex-direction: column; align-items: center; line-height: 1; }
  .status-dot {
    width: 5px; height: 5px; border-radius: 50%; background: #28c840;
    margin-top: 3px; box-shadow: 0 0 6px rgba(40, 200, 90, 0.65);
  }
  .hdr-icons {
    position: absolute; top: 14px; right: 16px;
    display: flex; align-items: center; gap: 12px; color: #6a6f7e;
  }
  .q {
    width: 20px; height: 20px; border-radius: 50%; border: 1.4px solid #9aa0b0;
    display: inline-flex; align-items: center; justify-content: center; font-size: 11px;
  }
  .burger { display: inline-flex; flex-direction: column; gap: 3px; }
  .burger span { width: 16px; height: 1.6px; background: #9aa0b0; }
  .model-row { position: relative; display: flex; padding: 0 16px 6px; flex-shrink: 0; }
  .model-pill {
    margin-left: auto; font-size: 11.5px; color: #3a3f4c; font-weight: 500;
    background: rgba(255, 255, 255, 0.7); border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 9px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px;
    box-shadow: 0 1px 3px rgba(10, 15, 40, 0.08);
  }
  .messages {
    position: relative; flex: 1; overflow: hidden; padding: 6px 16px 4px;
    display: flex; flex-direction: column; justify-content: flex-end; gap: 11px;
  }
  .row { display: flex; }
  .bubble {
    font-size: 13px; line-height: 1.5; animation: nfRise 0.35s ease both;
  }
  .bubble.user {
    max-width: 88%; padding: 10px 14px; border-radius: 16px; border-bottom-right-radius: 5px;
    background: #1085ef; color: #fff; box-shadow: 0 4px 14px rgba(16, 133, 239, 0.4);
  }
  .bubble.nalana {
    max-width: 90%; padding: 10px 14px; border-radius: 16px; border-bottom-left-radius: 5px;
    background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(15, 23, 42, 0.07);
    color: #27303f; box-shadow: 0 1px 4px rgba(10, 15, 40, 0.05);
  }
  .input-wrap { position: relative; padding: 8px 14px 14px; flex-shrink: 0; }
  .input {
    display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(16, 133, 239, 0.25); border-radius: 100px; padding: 7px 7px 7px 16px;
    box-shadow: 0 1px 4px rgba(10, 15, 40, 0.06);
  }
  .typed-area { flex: 1; display: flex; align-items: center; min-height: 18px; }
  .typed { font-size: 13px; color: #1a1a1a; }
  .caret {
    width: 1.5px; height: 15px; background: #1085ef; margin-left: 1px;
    animation: nfCaret 0.85s steps(1) infinite;
  }
  .send {
    width: 34px; height: 34px; border-radius: 50%; background: #1085ef;
    box-shadow: 0 2px 10px rgba(16, 133, 239, 0.45);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .online {
    display: flex; align-items: center; gap: 6px; margin-top: 9px; justify-content: flex-end;
  }
  .online-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #28c840;
    box-shadow: 0 0 7px rgba(40, 200, 90, 0.6);
  }
  .online span { font-size: 10.5px; color: #7a8090; }
  @keyframes nfCaret { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
  @keyframes nfRise {
    0% { opacity: 0; transform: translateY(9px); }
    14%, 100% { opacity: 1; transform: translateY(0); }
  }
</style>
