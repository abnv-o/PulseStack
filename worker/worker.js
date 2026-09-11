// Shared leaderboard.
//   GET  /        → top 10, one row per player (their best)
//   POST /start   {pid}                        → {tok, seed}  a run token + rhythm seed; rate-limited per IP
//   POST /score   {tok, pid, name, n, taps}    → top 10       taps = [[beat, phase], ...] one per tap, replayed against the seed
// The replay checks: n matches the tap count, wall time covers the beats, and tap timing has human jitter.
// Ceiling: a bot that adds realistic jitter still passes. Next step would be a per-run signature from the APK.
const H = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: H });
const STARTS_PER_MIN = 10, TOKEN_TTL = 12 * 3600e3, SLACK = .9, MIN_JITTER_MS = 6, JITTER_FROM = 12;
// Mirrors mulberry32 + periodFor() in index.html exactly, so the beat sequence of a run is reproducible from its seed.
const mulberry32 = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const periodFor = (n, rng) => { const b = Math.max(430, 1200 * Math.pow(.992, n)); return n >= 30 ? b * (.55 + .9 * rng()) : b; };
// Replays a tap log. Returns {ms, jitter} or a string naming why it is invalid.
function replay(seed, taps) {
  if (!Array.isArray(taps) || taps.length < 1 || taps.length > 10001) return 'bad taps';
  const rng = mulberry32(seed); let blocks = 1, beat = 0, L = periodFor(1, rng), ms = 0, last = -1; const dev = [];
  for (const t of taps) {
    if (!Array.isArray(t) || !Number.isInteger(t[0]) || t[0] <= last || typeof t[1] !== 'number' || !(t[1] >= 0 && t[1] < 1)) return 'bad taps';
    while (beat < t[0]) { ms += L; beat++; L = periodFor(blocks, rng); }   // beats that passed, tapped or not
    dev.push((t[1] - .5) * L); blocks++; last = t[0];
  }
  ms += taps[taps.length - 1][1] * L;
  const m = dev.reduce((a, b) => a + b, 0) / dev.length, jitter = Math.sqrt(dev.reduce((a, b) => a + (b - m) ** 2, 0) / dev.length);
  return { ms, jitter };
}
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
      const tok = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0];
      await db.prepare('INSERT INTO tokens (tok, pid, ip, t0, seed) VALUES (?, ?, ?, ?, ?)').bind(tok, pid, ip, now, seed).run();
      return J({ tok, seed });
    }
    if (path === '/score') {
      const name = String(b.name || '').trim().slice(0, 12), n = b.n, tok = String(b.tok || '');
      if (!name || !Number.isInteger(n) || n < 1 || n > 10000) return J({ error: 'bad score' }, 400);
      const row = await db.prepare('SELECT pid, t0, used, seed FROM tokens WHERE tok = ?').bind(tok).first();
      if (!row || row.used || row.pid !== pid || now - row.t0 > TOKEN_TTL) return J({ error: 'bad token' }, 403);
      const r = replay(row.seed, b.taps);
      if (typeof r === 'string' || b.taps.length !== n + 1) return J({ error: 'bad taps' }, 403);   // score = taps before the fatal one
      if (now - row.t0 < r.ms * SLACK) return J({ error: 'too fast' }, 403);
      if (n >= JITTER_FROM && r.jitter < MIN_JITTER_MS) return J({ error: 'too perfect' }, 403);
      await db.batch([
        db.prepare('UPDATE tokens SET used = 1 WHERE tok = ?').bind(tok),
        db.prepare('INSERT INTO scores (pid, name, n, t) VALUES (?, ?, ?, ?)').bind(pid, name, n, now),
      ]);
      return J(await top(db));
    }
    return J({ error: 'not found' }, 404);
  }
};
