// Shared leaderboard.
//   GET  /        → top 10, one row per player (their best)
//   POST /start   {pid}                → {tok}   a run token; rate-limited per IP
//   POST /score   {tok, pid, name, n}  → top 10  token must be unused, match pid, and be old enough for n blocks
// Cheating is still possible with a real-time bot; this only blocks fake-score scripts.
const H = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: H });
const STARTS_PER_MIN = 10, TOKEN_TTL = 12 * 3600e3, SLACK = .85;
// Mirrors periodFor() in index.html: anchor beat per block, and the shortest random beat after 30 is 55% of it.
const anchor = k => Math.max(430, 1200 * Math.pow(.992, k));
const minMs = n => { let s = 0; for (let k = 1; k <= n; k++) s += k >= 30 ? .55 * anchor(k) : anchor(k); return s * SLACK; };
const top = async db => (await db.prepare('SELECT substr(pid,1,4) id, name, MAX(n) n, t FROM scores GROUP BY pid ORDER BY n DESC, t ASC LIMIT 10').all()).results.map(({ t, ...r }) => r);

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: H });
    const db = env.DB, path = new URL(req.url).pathname, now = Date.now();
    if (req.method === 'GET') return J(await top(db));
    const b = await req.json().catch(() => ({}));
    const pid = String(b.pid || '');
    if (!/^[0-9a-f-]{16,40}$/.test(pid)) return J({ error: 'bad pid' }, 400);

    if (path === '/start') {
      const ip = req.headers.get('cf-connecting-ip') || '?';
      const { c } = await db.prepare('SELECT COUNT(*) c FROM tokens WHERE ip = ? AND t0 > ?').bind(ip, now - 60e3).first();
      if (c >= STARTS_PER_MIN) return J({ error: 'slow down' }, 429);
      const tok = crypto.randomUUID();
      await db.prepare('INSERT INTO tokens (tok, pid, ip, t0) VALUES (?, ?, ?, ?)').bind(tok, pid, ip, now).run();
      return J({ tok });
    }
    if (path === '/score') {
      const name = String(b.name || '').trim().slice(0, 12), n = b.n, tok = String(b.tok || '');
      if (!name || !Number.isInteger(n) || n < 1 || n > 10000) return J({ error: 'bad score' }, 400);
      const row = await db.prepare('SELECT pid, t0, used FROM tokens WHERE tok = ?').bind(tok).first();
      if (!row || row.used || row.pid !== pid || now - row.t0 > TOKEN_TTL) return J({ error: 'bad token' }, 403);
      if (now - row.t0 < minMs(n)) return J({ error: 'too fast' }, 403);
      await db.batch([
        db.prepare('UPDATE tokens SET used = 1 WHERE tok = ?').bind(tok),
        db.prepare('INSERT INTO scores (pid, name, n, t) VALUES (?, ?, ?, ?)').bind(pid, name, n, now),
      ]);
      return J(await top(db));
    }
    return J({ error: 'not found' }, 404);
  }
};
