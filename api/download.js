export default function handler(req, res) {
  const { platform } = req.query;

  const urls = {
    mac:     process.env.NALANA_MAC_URL,
    windows: process.env.NALANA_WIN_URL,
  };

  const url = urls[platform];

  if (!url) {
    return res.status(400).send('Unknown platform. Use ?platform=mac or ?platform=windows');
  }

  // 302 so the browser re-checks on next visit (useful when SAS URLs rotate)
  res.redirect(302, url);
}
