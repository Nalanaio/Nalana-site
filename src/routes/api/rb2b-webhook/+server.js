import { json } from '@sveltejs/kit';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function GET() {
  return json({ ok: true });
}

export async function POST({ request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  if (!DISCORD_WEBHOOK_URL) {
    return json({ ok: true });
  }

  const name = payload.name || 'Unknown';
  const company = payload.company || payload.organization || '';
  const title = payload.title || '';
  const linkedin = payload.linkedin || '';
  const email = payload.email || '';
  const page = payload.pageUrl || payload.page_url || '';

  const lines = [`**Visitor identified** via RB2B`];
  if (name !== 'Unknown') lines.push(`**Name:** ${name}`);
  if (company) lines.push(`**Company:** ${company}`);
  if (title) lines.push(`**Title:** ${title}`);
  if (email) lines.push(`**Email:** ${email}`);
  if (linkedin) lines.push(`**LinkedIn:** ${linkedin}`);
  if (page) lines.push(`**Page:** ${page}`);

  const content = lines.join('\n');

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    console.error('Discord webhook failed:', err);
  }

  return json({ ok: true });
}
