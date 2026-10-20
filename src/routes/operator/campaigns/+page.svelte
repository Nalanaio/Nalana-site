<script>
  export let data;
  $: campaigns = Object.values(data.rows.reduce((groups, row) => {
    const key = JSON.stringify([row.source, row.medium, row.campaign]);
    const group = groups[key] ||= { source: row.source, medium: row.medium, campaign: row.campaign, page_views: 0, windows: 0, mac: 0, signups: 0 };
    group.page_views += row.page_views;
    group.signups += row.signups;
    if (row.platform === 'windows' || row.platform === 'mac') group[row.platform] += row.download_requests;
    return groups;
  }, {})).sort((a, b) => b.page_views - a.page_views || b.signups - a.signups);
  $: totals = data.rows.reduce((sum, row) => ({ views: sum.views + row.page_views, downloads: sum.downloads + row.download_requests, signups: sum.signups + row.signups }), { views: 0, downloads: 0, signups: 0 });
</script>
<svelte:head><title>Campaign totals — Nalana</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<main>
  <header><div><a href="/" data-sveltekit-reload>← Nalana</a><h1>Campaign totals</h1></div>
    <form method="POST" action="/operator/login?/logout"><input type="hidden" name="csrf" value={data.operator.csrf} /><button>Sign out</button></form>
  </header>
  <p>First-party daily totals, including visitors who decline optional analytics. No visitor or account history is stored in this report.</p>
  <form method="GET" class="filters">
    <label>Start (UTC) <input type="date" name="start" value={data.window.start} required /></label>
    <label>End (UTC, included) <input type="date" name="end" value={data.window.end} required /></label>
    <button>Apply dates</button>
  </form>
  <p class="summary">{totals.views} page views · {totals.downloads} download requests · {totals.signups} new website accounts</p>
  <div class="table-wrap"><table>
    <caption>Totals by campaign</caption>
    <thead><tr><th>Source</th><th>Medium</th><th>Campaign</th><th>Page views</th><th>Windows requests</th><th>Mac requests</th><th>Website signups</th></tr></thead>
    <tbody>{#each campaigns as row}<tr><td>{row.source}</td><td>{row.medium}</td><td>{row.campaign}</td><td>{row.page_views}</td><td>{row.windows}</td><td>{row.mac}</td><td>{row.signups}</td></tr>{/each}</tbody>
  </table></div>
  {#if !campaigns.length}<p>No campaign observations in this window. Collection begins when this feature is enabled; earlier traffic cannot be reconstructed.</p>{/if}
  <details><summary>Daily breakdown</summary><div class="table-wrap"><table>
    <thead><tr><th>Day (UTC)</th><th>Source</th><th>Medium</th><th>Campaign</th><th>Platform</th><th>Views</th><th>Download requests</th><th>Website signups</th></tr></thead>
    <tbody>{#each data.rows as row}<tr><td>{row.day}</td><td>{row.source}</td><td>{row.medium}</td><td>{row.campaign}</td><td>{row.platform}</td><td>{row.page_views}</td><td>{row.download_requests}</td><td>{row.signups}</td></tr>{/each}</tbody>
  </table></div></details>
  <p>Page views are successful public page requests and client navigations, not unique visitors or ad clicks. Known bots, prefetches and private account pages are excluded. Download requests are successful installer redirects, not completed transfers or installs. Signups are accounts the backend successfully created through this website, not form submissions or email verifications.</p>
  <p>Sources come from campaign tags or an available referring domain. Only approved campaign names appear; other names remain unknown until added to the reporting catalog. Campaign labels travel through public website links for up to 30 minutes in the current document, without cookies or browser storage. Missing tags, stripped referrers, expired context and unsupported labels remain unknown. JavaScript is needed to carry labels through internal links. More than 500 daily campaign/platform buckets are grouped as overflow. Counts can include repeat requests and undetected bots; outages can lose observations. These totals do not establish that the same people visited, downloaded and signed up, so no individual conversion rate is shown.</p>
  <p>Optional Google Analytics and visitor identification still follow the visitor’s privacy choices. Access expires {data.operator.expiresAt}.</p>
</main>
<style>
  main { max-width:1300px; margin:2rem auto; padding:1.5rem; color:#222; } header { display:flex; justify-content:space-between; gap:1rem; align-items:center; } h1 { margin:1rem 0; } p { line-height:1.6; } .filters { display:flex; flex-wrap:wrap; gap:1rem; align-items:end; } label { display:grid; gap:.4rem; } input,button { font:inherit; padding:.7rem; border:1px solid #aaa; border-radius:.4rem; } button,summary { cursor:pointer; } .summary { background:#edf0ff; padding:1rem; font-weight:600; } .table-wrap { overflow:auto; } table { border-collapse:collapse; width:100%; } th,td { padding:.8rem; text-align:left; border-bottom:1px solid #ddd; } caption { text-align:left; font-size:1.25rem; font-weight:600; padding:1rem 0; } details { margin-top:1.5rem; }
</style>
