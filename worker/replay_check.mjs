// node worker/replay_check.mjs — fails loudly if replay() stops accepting humans or starts accepting bots.
import assert from 'node:assert/strict';
const src = await import('node:fs').then(fs => fs.readFileSync(new URL('./worker.js', import.meta.url), 'utf8'));
const { mulberry32, periodFor, replay } = new Function(src.replace('export default', 'const _d =') + '; return { mulberry32, periodFor, replay };')();
// Simulate a run the way index.html does: beat k has length periodFor(blocks, rng); tap at phase .5 + jitter.
const sim = (seed, n, jitterMs) => { const rng = mulberry32(seed); let blocks = 1, L = periodFor(1, rng); const taps = [];
  for (let k = 0; k <= n; k++) { const p = Math.min(.9999, Math.max(0, .5 + (jitterMs ? (Math.random() * 2 - 1) * jitterMs : 0) / L)); taps.push([k, p]); blocks++; L = periodFor(blocks, rng); }
  return taps; };
const human = replay(7, sim(7, 60, 40)), bot = replay(7, sim(7, 60, 0));
assert.equal(typeof human, 'object'); assert.ok(human.jitter > 6, 'human jitter ' + human.jitter);
assert.ok(bot.jitter < 6, 'bot jitter ' + bot.jitter);
assert.ok(human.ms > 30e3 && human.ms < 60e3, 'ms ' + human.ms);
assert.equal(replay(7, [[0, .5], [0, .5]]), 'bad taps');       // two taps in one beat
assert.equal(replay(7, [[0, 1]]), 'bad taps');                 // phase out of range
assert.equal(replay(7, []), 'bad taps');
assert.notDeepEqual(replay(7, sim(7, 40, 0)), replay(8, sim(7, 40, 0)), 'seed must change the timeline');
console.log('ok', { humanJitter: +human.jitter.toFixed(1), botJitter: +bot.jitter.toFixed(2), sec: +(human.ms / 1e3).toFixed(1) });
