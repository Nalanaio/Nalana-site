<script>
  export let data;
  const label = (value) => String(value).replaceAll('_', ' ');
  const rate = (value) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
  const details = (value) => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
</script>
<svelte:head><title>Acquisition report — Nalana</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<main>
  <header><div><a href="/" data-sveltekit-reload>← Nalana</a><h1>Acquisition report</h1></div>
    <form method="POST" action="/operator/login?/logout"><input type="hidden" name="csrf" value={data.operator.csrf} /><button>Sign out of operator access</button></form>
  </header>
  <p>Generated {data.report.generated_at}. Access expires {data.operator.expiresAt}.</p>
  <form method="GET" class="filters">
    <label>Start (UTC) <input name="start" value={data.report.window.start} required /></label>
    <label>End (UTC) <input name="end" value={data.report.window.end} required /></label>
    <label>Platform <select name="platform"><option value="">All platforms</option><option>windows</option><option>macos</option><option>web</option><option>unknown</option></select></label>
    <button type="submit">Apply window</button>
  </form>
  <p class="notice">Counts describe observed activity. A server body write does not prove a completed download or installation. App opened means consented startup or confirmed current UI readiness. Devices and downloads are not unique people.</p>
  <p>Time basis: {label(data.report.window.time_basis)}. Deployment and filters: {details(data.report.filters)}</p>
  {#each [{ title: 'Independent counts', rows: data.report.independent_counts }, { title: 'Explicitly joined cohorts', rows: data.report.joined_cohorts }] as group}
    <h2>{group.title}</h2>
    <div class="table-wrap"><table><thead><tr><th>Stage</th><th>Unit</th><th>Count</th><th>Denominator</th><th>Conversion</th><th>Join rule</th></tr></thead>
      <tbody>{#each group.rows as row}<tr><td>{label(row.stage)}</td><td>{label(row.unit)}</td><td>{row.count}</td><td>{row.denominator_count === null ? '—' : `${row.denominator_count} ${label(row.denominator_stage)}`}</td><td>{rate(row.conversion_rate)}</td><td>{row.join_rule}</td></tr>{/each}</tbody>
    </table></div>
    {#if !group.rows.length}<p>No matching observations in this window.</p>{/if}
  {/each}
  <h2>Coverage</h2><pre>{details(data.report.coverage)}</pre>
  <h2>Email delivery</h2><p>Queued, provider accepted, delivered and bounced are separate facts. Delivered means recipient server accepted; it does not prove inbox placement or reading.</p><pre>{details(data.report.delivery_summary)}</pre>
  <h2>Unknowns and limitations</h2><pre>{details(data.report.unknowns)}</pre>
  <p>Backend completion, visible result, concept preview/import and intentional save are separate milestones. Legacy, declined, unlinked, direct fallback, missing-cookie and late observations must remain visible in coverage; absent tracking does not establish abandonment.</p>
</main>
<style>
  main { max-width: 1300px; margin: 2rem auto; padding: 2rem; color: #222; } header { display: flex; gap: 2rem; justify-content: space-between; align-items: center; }
  h1 { margin: 1rem 0; } h2 { margin-top: 2rem; } p { line-height: 1.6; } .filters { display: flex; gap: 1rem; flex-wrap: wrap; align-items: end; } label { display: grid; gap: .4rem; }
  input, select, button { padding: .7rem; border: 1px solid #aaa; border-radius: .4rem; font: inherit; } button { cursor: pointer; }.notice { background: #edf0ff; padding: 1rem; border-radius: .5rem; }
  .table-wrap { overflow: auto; } table { border-collapse: collapse; width: 100%; } th,td { padding: .8rem; text-align: left; border-bottom: 1px solid #ddd; } pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f4f4f5; padding: 1rem; }
</style>
