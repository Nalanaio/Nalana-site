/**
 * SvelteKit 2.60.1 fires speculative root imports without rejection handlers.
 * A full-document account/privacy redirect can cancel the unused error import
 * in Firefox. Own those speculative promises at their source; required route
 * loads still reject through SvelteKit's normal error handling.
 * Recheck/remove this compatibility fix when upgrading Kit. Unexpected upstream
 * source changes fail the build instead of silently dropping the fix.
 */
export function kitPreloadErrors() {
  /** @param {string} code @param {string} id @param {{ssr?: boolean}} [options] */
  function transform(code, id, options) {
    if (options?.ssr || !id.replaceAll('\\', '/').endsWith('/@sveltejs/kit/src/runtime/client/client.js')) return;
    const calls = /void (default_(?:layout|error)_loader)\(\);/g;
    if ([...code.matchAll(calls)].length !== 2) {
      throw new Error('Recheck the SvelteKit speculative-import compatibility fix against the installed runtime.');
    }
    return { code: code.replace(calls, 'void $1().catch(() => {});'), map: null };
  }
  /** @satisfies {import('vite').Plugin} */
  const plugin = {
    name: 'nalana-kit-preload-errors',
    enforce: 'pre',
    transform,
  };
  return plugin;
}
