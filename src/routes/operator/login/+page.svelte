<script>
  export let data;
  export let form;
</script>

<svelte:head><title>Operator sign in — Nalana</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<main>
  <a href="/" data-sveltekit-reload>← Nalana</a>
  <h1>Operator sign in</h1>
  <p>Use your verified operator account. Access lasts 15 minutes after password confirmation.</p>
  {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
  <form method="POST" action="?/login">
    <input type="hidden" name="csrf" value={data.csrf} />
    <label>Email <input type="email" name="email" autocomplete="username" maxlength="320" required /></label>
    <label>Password <input type="password" name="password" autocomplete="current-password" maxlength="1024" required /></label>
    <button type="submit">Confirm operator access</button>
  </form>
</main>
<style>
  main { max-width: 480px; margin: 5rem auto; padding: 2rem; color: #222; }
  h1 { margin: 1.5rem 0 1rem; } p { line-height: 1.6; }
  form, label { display: grid; gap: .6rem; } form { gap: 1.3rem; margin-top: 2rem; }
  input, button { padding: .85rem; border: 1px solid #bbb; border-radius: .5rem; font: inherit; }
  button { background: #252a70; color: white; cursor: pointer; }.error { color: #9b1c1c; }
</style>
