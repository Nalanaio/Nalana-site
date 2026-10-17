<script>
  import VisualInstance from './VisualInstance.svelte';
  let showA = true, showB = true;
  const resolves = {};
  let ledger = { A: { allocated: 0, released: 0, draw: 0, write: 0 }, B: { allocated: 0, released: 0, draw: 0, write: 0 }, detached: 0 };
  function register(name, resolve) { resolves[name] = resolve; }
  function update(name, action, connected = true) {
    ledger[name][action]++;
    if (!connected) ledger.detached++;
    ledger = { ...ledger };
  }
</script>
<h1>Actual Svelte visual-owner lifetime fixture</h1>
<button on:click={() => showA = false}>Destroy A</button>
<button on:click={() => showB = false}>Destroy B</button>
<button on:click={() => resolves.A?.()}>Resolve A</button>
<button on:click={() => resolves.B?.()}>Resolve B</button>
{#if showA}<VisualInstance name="A" {register} {update} />{/if}
{#if showB}<VisualInstance name="B" {register} {update} />{/if}
<pre data-testid="ledger">{JSON.stringify(ledger)}</pre>
