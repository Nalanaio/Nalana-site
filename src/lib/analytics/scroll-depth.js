// Same milestones the legacy static page reported to GA4 as scroll_depth.
export const SCROLL_MILESTONES = [25, 50, 75, 90];

/**
 * Reports each milestone once per page. Only a real scroll can report; a short
 * page that never scrolls reports nothing. Call reset() on in-app navigation.
 * @param {{ window: { scrollY: number, innerHeight: number }, document: { documentElement: { scrollHeight: number } }, report: (depth: number) => void }} options
 */
export function createScrollDepthTracker({ window, document, report }) {
  const fired = new Set();
  return {
    check() {
      const total = document.documentElement.scrollHeight;
      if (!(total > 0)) return;
      const percent = Math.round(((window.scrollY + window.innerHeight) / total) * 100);
      for (const milestone of SCROLL_MILESTONES) {
        if (percent >= milestone && !fired.has(milestone)) { fired.add(milestone); report(milestone); }
      }
    },
    reset() { fired.clear(); }
  };
}
