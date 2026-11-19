/** 'mac' or 'windows' for those desktops; 'mobile' for phones and tablets (no download is offered);
 * 'both' for any other desktop, such as Linux, which is offered both installers. */
export function downloadPlatform({ userAgent = '', platform = '', mobile = false, maxTouchPoints = 0 } = {}) {
  const device = `${platform} ${userAgent}`;
  if (mobile || /android|iphone|ipad|ipod|mobile|tablet|silk|kindle/i.test(device) ||
      (/mac/i.test(platform) && maxTouchPoints > 1)) return 'mobile';
  if (/win/i.test(device)) return 'windows';
  if (/mac/i.test(device)) return 'mac';
  return 'both';
}
