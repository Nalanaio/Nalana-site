<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';

  export let data;

  let checkingAccount = true;
  let authorized = false;

  onMount(async () => {
    authorized = await auth.refreshSession();
    checkingAccount = false;

    if (!authorized) {
      goto('/login?next=%2Fdev');
    }
  });

  function logout() {
    auth.logout();
    authorized = false;
    goto('/login?next=%2Fdev');
  }

  function formatDate(value) {
    if (!value) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function shortSha(value) {
    return value ? value.slice(0, 8) : 'unknown';
  }

  function platformLabel(platform) {
    if (!platform) return 'Unknown';
    if (platform.startsWith('Windows')) return 'Windows';
    if (platform.startsWith('macOS')) return 'Mac';
    return platform;
  }

  function buildTitle(build, runNumber) {
    return `Nalana - ${platformLabel(build.platform)} - Dev Build ${runNumber}`;
  }
</script>

<svelte:head>
  <title>Dev Builds — Nalana</title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<main class="shell">
  <a class="wordmark" href="/">Nalana</a>

  {#if checkingAccount}
    <section class="card login-card">
      <span class="eyebrow">Dev channel</span>
      <h1>Checking your Nalana account.</h1>
      <p>One moment while we verify your sign-in.</p>
    </section>
  {:else if authorized}
    <section class="intro">
      <div>
        <span class="eyebrow">Private dev channel</span>
        <h1>Download the latest Nalana build.</h1>
        <p class="lede">These installers are published automatically after the <code>dev</code> branch build passes.</p>
      </div>
      <button class="logout" type="button" on:click={logout}>Sign out</button>
    </section>

    {#if data.error}
      <section class="card message-card">
        <h2>No build available</h2>
        <p>{data.error}</p>
      </section>
    {:else if data.manifest}
      <section class="meta card">
        <div>
          <span class="meta-label">Published</span>
          <strong>{formatDate(data.manifest.created_at)}</strong>
        </div>
        <div>
          <span class="meta-label">Commit</span>
          <strong><code>{shortSha(data.manifest.commit)}</code></strong>
        </div>
        <div>
          <span class="meta-label">Actions run</span>
          <strong>#{data.manifest.run_number}</strong>
        </div>
        {#if data.manifest.workflow_url}
          <a class="run-link" href={data.manifest.workflow_url} target="_blank" rel="noopener">View build run ↗</a>
        {/if}
      </section>

      <section class="downloads">
        {#each data.manifest.builds ?? [] as build}
          <article class="download card">
            <div>
              <span class="platform">{build.platform}</span>
              <h2>{buildTitle(build, data.manifest.run_number)}</h2>
              <p>{Math.round((build.size_bytes ?? 0) / 1024 / 1024)} MB · SHA-256 <code>{build.sha256}</code></p>
            </div>
            <a class="download-button" href={build.download_url}>Download <span>↓</span></a>
          </article>
        {/each}
      </section>

      <p class="note">These are development builds. Expect rough edges, and report the commit shown above with any feedback.</p>
    {/if}
  {:else}
    <section class="card login-card">
      <span class="eyebrow">Dev channel</span>
      <h1>Sign in to access dev builds.</h1>
      <p>Use the Nalana account you already have. No separate dev-page password is needed.</p>
      <a class="download-button" href="/login?next=%2Fdev">Log in to Nalana</a>
    </section>
  {/if}
</main>

<style>
  :global(body) { cursor: auto; background: #f7f8fb; }
  :global(code) { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  .shell { width: min(960px, 90vw); margin: 0 auto; padding: 38px 0 96px; }
  .wordmark { color: var(--primary); font-family: 'KonkhmerSleokchher', sans-serif; font-size: 20px; text-decoration: none; }
  .intro { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin: 100px 0 42px; }
  .eyebrow { color: var(--primary); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  h1 { max-width: 680px; margin-top: 12px; color: var(--ink-deep); font-family: 'Amulya', sans-serif; font-size: clamp(34px, 6vw, 66px); letter-spacing: -.035em; line-height: 1.02; }
  h2 { color: var(--ink-deep); font-family: 'Amulya', sans-serif; font-size: 20px; line-height: 1.2; }
  p { color: var(--muted); line-height: 1.6; }
  .lede { margin-top: 18px; font-size: 16px; }
  .card { border: 1px solid rgba(20, 30, 50, .09); border-radius: 22px; background: rgba(255, 255, 255, .8); box-shadow: 0 14px 40px rgba(27, 36, 58, .07); }
  .meta { display: flex; align-items: center; gap: 30px; padding: 22px 26px; flex-wrap: wrap; }
  .meta > div { display: grid; gap: 3px; }
  .meta-label { color: #8b93a2; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .meta strong { color: var(--ink-deep); font-size: 14px; }
  .run-link { margin-left: auto; color: var(--primary); font-size: 13px; font-weight: 600; text-decoration: none; }
  .downloads { display: grid; gap: 14px; margin-top: 18px; }
  .download { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 26px; }
  .platform { display: block; margin-bottom: 8px; color: var(--primary); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .download p { margin-top: 9px; font-size: 12px; overflow-wrap: anywhere; }
  .download-button, button { border: 0; border-radius: 999px; background: var(--primary); color: white; cursor: pointer; font: inherit; font-size: 14px; font-weight: 700; padding: 12px 18px; text-decoration: none; white-space: nowrap; }
  .download-button span { margin-left: 7px; font-size: 18px; line-height: 0; }
  .note { margin-top: 18px; font-size: 13px; }
  .logout { background: transparent; color: var(--muted); font-size: 13px; padding: 8px 0; }
  .login-card, .message-card { max-width: 520px; margin: 18vh auto 0; padding: 42px; }
  .login-card h1 { font-size: clamp(34px, 6vw, 52px); }
  .login-card p, .message-card p { margin-top: 16px; }
  .login-card .download-button { display: inline-block; margin-top: 24px; }
  .message-card h2 { margin-top: 10px; }

  @media (max-width: 640px) {
    .shell { width: min(92vw, 960px); padding-top: 26px; }
    .intro { align-items: start; flex-direction: column; margin-top: 72px; }
    .download { align-items: start; flex-direction: column; }
    .download-button { width: 100%; text-align: center; }
    .run-link { margin-left: 0; }
    .login-card, .message-card { padding: 28px; }
  }
</style>
