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
  let nextId = 0;

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
      bubbles = [{ id: nextId++, who: 'user', text: seed[0] }, { id: nextId++, who: 'nalana', text: seed[1] }];
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
      bubbles = [...bubbles, { id: nextId++, who: 'user', text: prompt }].slice(-16);
      await sleep(560);
      // A prompt bubble is now visible, so its reply must land no matter what —
      // only a real teardown (dead) should skip it; visibility toggling (on) must not.
      if (dead) { looping = false; return; }
      bubbles = [...bubbles, { id: nextId++, who: 'nalana', text: reply }].slice(-16);
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

  <!-- messages -->
  <div class="messages">
    {#each bubbles as b (b.id)}
      <div class="row" style="justify-content:{b.who === 'user' ? 'flex-end' : 'flex-start'};">
        <div class="cbub {b.who}">{b.text}</div>
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
  .messages {
    position: relative; flex: 1; overflow: hidden; margin-top: 24px; padding: 0 16px 4px;
    display: flex; flex-direction: column; justify-content: flex-end; gap: 11px;
  }
  .row { display: flex; }
  .cbub {
    font-size: 13px; line-height: 1.5; animation: nfRise 0.35s ease both;
  }
  .cbub.user {
    max-width: 88%; padding: 10px 14px; border-radius: 16px; border-bottom-right-radius: 5px;
    background: #1085ef; color: #fff; box-shadow: 0 4px 14px rgba(16, 133, 239, 0.4);
  }
  .cbub.nalana {
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
