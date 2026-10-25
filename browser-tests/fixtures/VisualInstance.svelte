<script>
  import { onMount } from 'svelte';
  import { mountVisualOwner } from '#lib/animations/owner.js';
  export let name;
  export let register;
  export let update;
  let root;
  onMount(() => {
    const owner = mountVisualOwner(root, {
      init: () => new Promise(resolve => register(name, () => {
        update(name, 'allocated');
        resolve({
          resize() { update(name, 'write', root.isConnected); },
          frame() { update(name, 'draw', root.isConnected); return true; },
          destroy() { update(name, 'released'); },
        });
      })),
    });
    return () => owner.destroy();
  });
</script>
<div bind:this={root} data-testid={'root-'+name}>Visual root {name}</div>
