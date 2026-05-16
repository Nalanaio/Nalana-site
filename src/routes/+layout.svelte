<script>
  import '../app.css';
  import AuthModal from '$lib/components/AuthModal.svelte';
</script>

<svelte:head>
  <!-- Inter font -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-8XMNLBLH97"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-8XMNLBLH97');
  </script>
</svelte:head>

<!-- Auth modal overlay — available on every page -->
<AuthModal />

<slot />
