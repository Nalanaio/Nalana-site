<script>
  import { openAuthModal } from '$lib/stores/modal.js';
  import { isLoggedIn, currentUser } from '$lib/stores/auth.js';

  /** @param {Event} e @param {'mac'|'windows'} platform */
  function handleDownloadClick(e, platform) {
    // Download starts via the href; show signup modal after 1.2s
    setTimeout(() => openAuthModal(platform, 'signup'), 1200);
  }
</script>

<nav>
  <!-- Logo -->
  <a href="/" class="nav-logo-pill">
    <svg class="nav-n-mark" viewBox="0 0 69 82" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M68.5 69.3278C68.5 71.5139 66.7278 73.2861 64.5416 73.2861C62.6686 73.2861 61.07 71.9671 60.5184 70.177C59.0003 65.2496 56.2489 59.8111 52.3994 54.5664C42.7884 41.472 29.9768 34.5417 23.7842 39.0869C17.5915 43.6321 20.3627 57.9319 29.9736 71.0264C30.6518 71.9503 30.0071 73.2861 28.8611 73.2861H11.75C9.54086 73.2861 7.75 71.4953 7.75 69.2861V4C7.75 1.79086 9.54086 0 11.75 0H15.1428C17.0007 0 18.5961 1.28563 19.1747 3.05109C20.7305 7.79868 23.4053 12.9832 27.0811 17.9912C36.692 31.0856 49.5037 38.0159 55.6963 33.4707C61.8888 28.9254 59.1177 14.6256 49.5068 1.53125C49.0448 0.901696 49.4862 0 50.2671 0H64.5C66.7091 0 68.5 1.79086 68.5 4V69.3278Z" fill="#FF8C69"/>
      <path d="M61.75 69.3283C61.75 71.5142 59.978 73.2861 57.7922 73.2861C55.9194 73.2861 54.321 71.9672 53.7695 70.1774C52.2511 65.25 49.499 59.8113 45.6494 54.5664C36.0384 41.4721 23.2268 34.5417 17.0342 39.0869C10.8418 43.6323 13.6129 57.932 23.2236 71.0264C23.9019 71.9505 23.2577 73.2861 22.1114 73.2861H5C2.79086 73.2861 1 71.4953 1 69.2861V4C1 1.79086 2.79086 0 5 0H8.39283C10.2507 0 11.8461 1.28563 12.4247 3.05109C13.9805 7.79868 16.6553 12.9832 20.3311 17.9912C29.942 31.0856 42.7537 38.0159 48.9463 33.4707C55.1388 28.9254 52.3677 14.6256 42.7568 1.53125C42.2948 0.901696 42.7362 0 43.5171 0H57.75C59.9591 0 61.75 1.79086 61.75 4V69.3283Z" fill="#1085EF"/>
    </svg>
    <span class="nav-wordmark">Nalana</span>
  </a>

  <!-- Center links -->
  <div class="nav-center">
    <a href="/#demo"     class="nav-link">Demo</a>
    <a href="/#features" class="nav-link">Features</a>
    <a href="/#about"    class="nav-link">About</a>
    <a href="/#download" class="nav-link">Download</a>
    {#if $isLoggedIn}
      <a href="/account" class="nav-link">Profile</a>
    {:else}
      <a href="/login"   class="nav-link">Log in</a>
    {/if}
  </div>

  <!-- Download buttons -->
  <div class="nav-downloads">
    <a
      href="/api/download?platform=mac"
      class="dl-btn dl-btn-mac"
      on:click={e => handleDownloadClick(e, 'mac')}
    >
      <svg class="dl-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      Mac
    </a>
    <a
      href="/api/download?platform=windows"
      class="dl-btn dl-btn-win"
      on:click={e => handleDownloadClick(e, 'windows')}
    >
      <svg class="dl-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.557L10.173 4.5v7.145H3V5.557zM11 4.35L20.994 3v8.645H11V4.35zM3 12.345h7.173V19.5L3 18.442v-6.097zM11 12.345h9.994v8.61L11 19.63v-7.285z"/></svg>
      Windows
    </a>
  </div>
</nav>
