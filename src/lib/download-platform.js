/** Unknown desktops retain both links; tablets and phones always get both. */
export function downloadPlatform({ userAgent = '', platform = '', mobile = false, maxTouchPoints = 0 } = {}) {
  const device = `${platform} ${userAgent}`;
  if (mobile || /android|iphone|ipad|ipod|mobile|tablet|silk|kindle/i.test(device) ||
      (/mac/i.test(platform) && maxTouchPoints > 1)) return 'both';
  if (/win/i.test(device)) return 'windows';
  if (/mac/i.test(device)) return 'mac';
  return 'both';
}
