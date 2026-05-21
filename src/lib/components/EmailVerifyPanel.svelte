<script>
  import { resendVerificationEmail, RESEND_SUCCESS_MESSAGE } from '$lib/authClient.js';

  /** @type {'signup' | 'error' | 'banner'} */
  export let variant = 'signup';
  export let email = '';
  export let title = 'Check your email';
  export let subtitle = '';

  let resending = false;
  let resendMsg = '';
  let resendError = '';

  $: displaySubtitle =
    subtitle ||
    (email
      ? `If your account exists, we will send a verification link to ${email}. Click the link in that email, then log in.`
      : 'We will send a verification link to your inbox. Click the link in that email, then log in.');

  async function handleResend() {
    if (!email || resending) return;
    resending = true;
    resendError = '';
    resendMsg = '';
    try {
      const result = await resendVerificationEmail(email);
      if (result.ok) {
        resendMsg = result.message || RESEND_SUCCESS_MESSAGE;
      } else {
        resendError = result.message || 'Could not send email. Try again.';
      }
    } catch {
      resendError = 'Network error. Please try again.';
    } finally {
      resending = false;
    }
  }
</script>

<div class="panel" class:banner={variant === 'banner'}>
  <div class="icon" aria-hidden="true">✉</div>
  <h2 class="title">{title}</h2>
  <p class="subtitle">{displaySubtitle}</p>
  <p class="hint">Didn't get it? Check spam or promotions.</p>

  {#if email}
    <button type="button" class="btn-secondary" disabled={resending} on:click={handleResend}>
      {resending ? 'Sending…' : 'Resend verification email'}
    </button>
  {/if}

  {#if resendMsg}<p class="msg success">{resendMsg}</p>{/if}
  {#if resendError}<p class="msg error">{resendError}</p>{/if}

  <slot name="actions" />
</div>

<style>
  .panel {
    text-align: center;
    padding: 8px 0;
  }
  .panel.banner {
    text-align: left;
    padding: 20px 24px;
    background: rgba(16, 133, 239, 0.08);
    border: 1px solid rgba(16, 133, 239, 0.25);
    border-radius: 16px;
    margin-bottom: 24px;
  }
  .icon {
    font-size: 36px;
    margin-bottom: 12px;
    line-height: 1;
  }
  .banner .icon {
    font-size: 24px;
    display: inline-block;
    margin-right: 8px;
    margin-bottom: 0;
    vertical-align: middle;
  }
  .title {
    font-family: 'Amulya', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #0a0a0a;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }
  .banner .title {
    font-size: 16px;
    display: inline;
    vertical-align: middle;
  }
  .subtitle {
    font-size: 14px;
    color: #666;
    line-height: 1.55;
    margin-bottom: 8px;
  }
  .hint {
    font-size: 12px;
    color: #999;
    margin-bottom: 20px;
  }
  .btn-secondary {
    display: inline-block;
    padding: 12px 22px;
    border-radius: 100px;
    border: 1.5px solid rgba(16, 133, 239, 0.4);
    background: #fff;
    color: #1085ef;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    margin-bottom: 8px;
  }
  .btn-secondary:hover:not(:disabled) {
    background: rgba(16, 133, 239, 0.06);
  }
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .msg {
    font-size: 13px;
    margin-top: 10px;
  }
  .msg.success {
    color: #1085ef;
  }
  .msg.error {
    color: #e53e3e;
  }
</style>
