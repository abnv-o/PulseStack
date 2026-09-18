let ac: AudioContext | null = null;

export function audio(): AudioContext {
	if (!ac) ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
	if (ac.state === 'suspended') ac.resume();
	return ac;
}

function noiseBurst(a: AudioContext, dur: number, lpHz: number, gain: number, t: number) {
	const buf = a.createBuffer(1, Math.max(1, (a.sampleRate * dur) | 0), a.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
	const src = a.createBufferSource(),
		lp = a.createBiquadFilter(),
		g = a.createGain();
	src.buffer = buf;
	lp.type = 'lowpass';
	lp.frequency.value = lpHz;
	src.connect(lp).connect(g).connect(a.destination);
	g.gain.setValueAtTime(gain, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);
	src.start(t);
	src.stop(t + dur);
}

function hihat(a: AudioContext, t: number, gain: number) {
	const buf = a.createBuffer(1, (a.sampleRate * 0.04) | 0, a.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
	const src = a.createBufferSource(),
		hp = a.createBiquadFilter(),
		g = a.createGain();
	src.buffer = buf;
	hp.type = 'highpass';
	hp.frequency.value = 6000;
	src.connect(hp).connect(g).connect(a.destination);
	g.gain.setValueAtTime(gain, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
	src.start(t);
	src.stop(t + 0.04);
}

function playKick(a: AudioContext, t: number, gain: number) {
	const o = a.createOscillator(),
		g = a.createGain();
	o.type = 'sine';
	o.frequency.setValueAtTime(140, t);
	o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
	g.gain.setValueAtTime(gain, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
	o.connect(g).connect(a.destination);
	o.start(t);
	o.stop(t + 0.14);
	noiseBurst(a, 0.06, 220, gain * 0.45, t);
}

export function tone(kind: string, n: number, sound: boolean, feverTier: number) {
	if (!sound) return;
	const a = audio(),
		t = a.currentTime,
		g = a.createGain();
	g.connect(a.destination);
	if (kind === 'bad') {
		noiseBurst(a, 0.18, 160, 0.5, t);
		return;
	}
	const bias = kind === 'perfect' ? 1 + feverTier * 0.04 : 1;
	const o = a.createOscillator(),
		f = 330 * Math.pow(2, n / 24) * bias;
	o.type = kind === 'perfect' ? 'sine' : 'triangle';
	o.frequency.setValueAtTime(f, t);
	const len = kind === 'perfect' ? 0.45 : 0.14;
	g.gain.setValueAtTime(kind === 'perfect' ? 0.35 : 0.18, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + len);
	o.connect(g);
	o.start(t);
	o.stop(t + len);
	if (kind === 'perfect') {
		const o2 = a.createOscillator(),
			g2 = a.createGain();
		o2.frequency.value = f * 3;
		g2.gain.setValueAtTime(0.08, t);
		g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
		o2.connect(g2).connect(a.destination);
		o2.start(t);
		o2.stop(t + 0.2);
	} else if (kind === 'ok') hihat(a, t, 0.06 + feverTier * 0.02);
}

export function tick(sound: boolean, feverTier: number, holdBeat: boolean) {
	if (!sound) return;
	const a = audio(),
		t = a.currentTime,
		tier = feverTier;
	if (holdBeat) {
		const o = a.createOscillator(),
			g = a.createGain();
		o.type = 'triangle';
		o.frequency.setValueAtTime(220, t);
		g.gain.setValueAtTime(0.08, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
		o.connect(g).connect(a.destination);
		o.start(t);
		o.stop(t + 0.18);
		return;
	}
	if (tier === 0) {
		const o = a.createOscillator(),
			g = a.createGain();
		o.type = 'sine';
		o.frequency.setValueAtTime(880, t);
		g.gain.setValueAtTime(0.05, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
		o.connect(g).connect(a.destination);
		o.start(t);
		o.stop(t + 0.04);
		return;
	}
	playKick(a, t, tier === 1 ? 0.18 : tier === 2 ? 0.26 : 0.34);
	if (tier >= 2) hihat(a, t + 0.02, tier === 2 ? 0.05 : 0.09);
	if (tier >= 3) hihat(a, t + 0.08, 0.07);
}

export function chordStab(tier: number, sound: boolean) {
	if (!sound) return;
	const a = audio(),
		t = a.currentTime,
		base = 220 * Math.pow(1.2, tier);
	[1, 5 / 4, 3 / 2].forEach((r, i) => {
		const o = a.createOscillator(),
			g = a.createGain();
		o.type = 'sine';
		o.frequency.value = base * r;
		g.gain.setValueAtTime(0.12 - i * 0.02, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
		o.connect(g).connect(a.destination);
		o.start(t);
		o.stop(t + 0.35);
	});
}

export function coolCue(sound: boolean) {
	if (!sound) return;
	const a = audio(),
		t = a.currentTime,
		o = a.createOscillator(),
		g = a.createGain();
	o.type = 'triangle';
	o.frequency.setValueAtTime(180, t);
	o.frequency.exponentialRampToValueAtTime(90, t + 0.2);
	g.gain.setValueAtTime(0.12, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
	o.connect(g).connect(a.destination);
	o.start(t);
	o.stop(t + 0.22);
}
