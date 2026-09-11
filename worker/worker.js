// Shared leaderboard. GET → top 10. POST {name, n} → insert, then top 10.
// ponytail: no auth, anyone can post any score; add a per-run HMAC if cheating becomes a problem.
const H = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: H });
    if (req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const name = String(b.name || '').trim().slice(0, 12), n = b.n;
      if (!name || !Number.isInteger(n) || n < 1 || n > 10000) return new Response('bad', { status: 400, headers: H });
      await env.DB.prepare('INSERT INTO scores (name, n, t) VALUES (?, ?, ?)').bind(name, n, Date.now()).run();
    }
    const { results } = await env.DB.prepare('SELECT name, n FROM scores ORDER BY n DESC, t ASC LIMIT 10').all();
    return new Response(JSON.stringify(results), { headers: H });
  }
};
