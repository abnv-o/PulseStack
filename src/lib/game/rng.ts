/** Mirrored in worker/worker.js — do not drift. */
export const mulberry32 = (a: number) => () => {
	a = (a + 0x6d2b79f5) | 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type Rng = () => number;

/** Captured at load so a patched Math.random can't make the beat predictable. */
export const makeCryptoRng = (): Rng => {
	const u = new Uint32Array(1);
	return () => {
		crypto.getRandomValues(u);
		return u[0] / 4294967296;
	};
};

/** Anchor beat shaves ~0.8% per block down to MIN_PERIOD. From 30 on, every beat is random in 55%..145% of the anchor. */
export const periodFor = (n: number, rng: Rng, minPeriod = 430, rest = 1200) => {
	const b = Math.max(minPeriod, rest * Math.pow(0.992, n));
	return n >= 30 ? b * (0.55 + 0.9 * rng()) : b;
};
