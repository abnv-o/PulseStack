import { audio, chordStab, coolCue, tick, tone } from './audio';
import {
	BH,
	COOL,
	HOT,
	INK,
	MIN_PERIOD,
	P,
	REST,
	SHAPES,
	TIER_NAME,
	headlineFor,
	tierOf,
	type PlayMode,
	type ShapeId
} from './constants';
import { drawPulse } from './draw';
import { haptic } from './haptics';
import { fetchBoard, lbAddLocal, lbGet, lbRank, post, type LbEntry } from './lb';
import { periodFor, makeCryptoRng, mulberry32, type Rng } from './rng';
import { shareCard } from './share';
import { hideSheet, prefersReducedMotion, setCoach, showSheet } from './sheets';
import {
	ensurePid,
	loadBestTower,
	loadUnlocks,
	pref,
	save,
	saveUnlocks,
	utcDay,
	type Unlocks
} from './storage';

type Block = { w: number; hue: number; q: number };
type Shard = { x: number; y: number; w: number; vx: number; vy: number; a: number; hue: number };
type Float = { text: string; y: number; a: number; col: string };

export type HudState = {
	score: number;
	best: number;
	streakText: string;
	dayStreak: string;
	coachOn: boolean;
	sheet: 'start' | 'options' | 'over' | 'lb' | 'menu' | null;
	name: string;
	shape: ShapeId;
	sound: boolean;
	vers: string;
	over: {
		final: number;
		headline: string;
		delta: string;
		peakPct: number;
		maxStreak: number;
		feverLabel: string;
		unlockNote: string;
		board: string;
		shareOn: boolean;
	};
	lb: {
		title: string;
		modeLabel: string;
		entries: LbEntry[];
		pidShort: string;
	};
};

export type EngineHooks = {
	getCanvas: () => HTMLCanvasElement;
	getStage: () => HTMLElement;
	getEl: (id: string) => HTMLElement | null;
	onHud: (patch: Partial<HudState>) => void;
	getName: () => string;
};

export class GameEngine {
	private hooks: EngineHooks;
	private ctx!: CanvasRenderingContext2D;
	private W = 0;
	private H = 0;
	private rnd = makeCryptoRng();
	private rng: Rng = this.rnd;
	private taps: [number, number][] = [];
	private beat0 = 0;
	private pid = '';
	private unlocks: Unlocks = { skins: new Set(), palette: false };
	private shape: ShapeId = 'ghost';
	private sound = true;
	private best = 0;
	private taught = false;
	private teaching = false;
	private playMode: PlayMode = 'endless';
	private lastScore = 0;
	private lastPerfectPct = 0;
	private lastMaxStreak = 0;
	private lastTier = 0;
	private lastDelta = '';
	private lastUnlockNote = '';
	private bestTower: number[] = [];
	private tok: string | null = null;
	private lbView: PlayMode = 'endless';
	private lbBack: 'start' | 'over' = 'start';
	private paused = false;
	private lastNow = 0;
	private reduceMotion = false;
	private blocks: Block[] = [];
	private shards: Shard[] = [];
	private floats: Float[] = [];
	private beatStart = 0;
	private beatLen = REST;
	private beatIdx = 0;
	private tapped = false;
	private alive = false;
	private flash = 0;
	private camKick = 0;
	private shakeX = 0;
	private shakeY = 0;
	private chromaX = 0;
	private cam = 0;
	private camTarget = 0;
	private perfects = 0;
	private streak = 0;
	private maxStreak = 0;
	private feverTier = 0;
	private edgeGlow = 0;
	private pastPeak = false;
	private running = false;
	private pulseNow = 0;
	private tNow = 0;
	private holdArmed = false;
	private holdBeat = false;
	private holdDone = false;
	private raf = 0;
	private optCards: {
		s: (typeof SHAPES)[number];
		el: HTMLElement;
		c: HTMLCanvasElement;
		ctx: CanvasRenderingContext2D;
		w: number;
		h: number;
	}[] = [];
	private prevW = 0;
	private prevH = 0;
	private destroyed = false;

	constructor(hooks: EngineHooks) {
		this.hooks = hooks;
	}

	init() {
		this.pid = ensurePid();
		this.unlocks = loadUnlocks();
		let shape = pref('shape', 'ghost') as ShapeId;
		if (shape !== 'ghost' && shape !== 'circle') {
			shape = 'ghost';
			save('shape', shape);
		}
		this.shape = shape;
		this.sound = pref('sound', '1') === '1';
		this.best = +pref('best', '0');
		this.taught = pref('taught', '') === '1';
		this.bestTower = loadBestTower();

		const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
		this.reduceMotion = motionMq.matches;
		motionMq.addEventListener?.('change', (e) => {
			this.reduceMotion = e.matches;
		});

		const cv = this.hooks.getCanvas();
		this.ctx = cv.getContext('2d')!;
		for (const id of ['options', 'over', 'lb', 'menu', 'coach']) {
			const el = this.el(id);
			if (el) el.hidden = true;
		}
		this.buildOptCards();
		this.size();
		this.reset();
		this.patchHud({
			score: 0,
			best: this.best,
			streakText: '',
			dayStreak: this.dayStreakText(),
			coachOn: false,
			sheet: 'start',
			name: pref('name', ''),
			shape: this.shape,
			sound: this.sound,
			vers: this.versionLabel(),
			over: this.emptyOver(),
			lb: { title: 'Leaderboard', modeLabel: 'Daily', entries: [], pidShort: this.pid.slice(0, 4) }
		});
		this.syncDayStreakHud();
		this.raf = requestAnimationFrame((n) => this.frame(n));
		addEventListener('resize', this.onResize);
	}

	destroy() {
		this.destroyed = true;
		cancelAnimationFrame(this.raf);
		removeEventListener('resize', this.onResize);
	}

	private onResize = () => this.size();

	private versionLabel() {
		if (typeof window !== 'undefined' && window.Android?.version) return 'v' + window.Android.version();
		return 'web';
	}

	private emptyOver(): HudState['over'] {
		return {
			final: 0,
			headline: 'The tower is a thread.',
			delta: '',
			peakPct: 0,
			maxStreak: 0,
			feverLabel: '—',
			unlockNote: '',
			board: '',
			shareOn: false
		};
	}

	private patchHud(p: Partial<HudState>) {
		this.hooks.onHud(p);
	}

	private el(id: string) {
		return this.hooks.getEl(id);
	}

	private dayStreakText() {
		const s = +pref('dayStreak', '0');
		return s > 1 ? s + ' day streak' : s === 1 ? '1 day streak' : '';
	}

	private syncDayStreakHud() {
		this.patchHud({ dayStreak: this.dayStreakText() });
	}

	private bumpDayStreak() {
		const today = utcDay(),
			last = pref('lastDay', '');
		let s = +pref('dayStreak', '0');
		if (last === today) {
			/* already counted */
		} else if (last) {
			const prev = new Date(last + 'T00:00:00Z'),
				cur = new Date(today + 'T00:00:00Z');
			const gap = Math.round((+cur - +prev) / 864e5);
			s = gap === 1 ? s + 1 : 1;
		} else s = 1;
		save('lastDay', today);
		save('dayStreak', String(s));
		this.syncDayStreakHud();
	}

	private who() {
		return this.hooks.getName().trim() || 'Player';
	}

	setName(v: string) {
		save('name', v.trim());
		this.patchHud({ name: v });
	}

	setSound(on: boolean) {
		this.sound = on;
		save('sound', on ? '1' : '0');
		this.patchHud({ sound: on });
		if (on) audio();
	}

	setShape(id: ShapeId) {
		if (id !== 'ghost' && id !== 'circle') return;
		this.shape = id;
		save('shape', id);
		this.patchHud({ shape: id });
		this.syncShapeUI();
	}

	private unlockPalette() {
		if (this.unlocks.palette) return null;
		this.unlocks.palette = true;
		saveUnlocks(this.unlocks);
		return 'Aurora palette';
	}

	private blockHue(n: number) {
		return this.unlocks.palette ? (200 + n * 7) % 360 : (30 + n * 4) % 360;
	}

	private snapThresh(n: number) {
		const bonus = Math.min(this.streak, 8) * 0.008 * (n >= 30 ? 0.5 : 1);
		return Math.max(0.85, 0.94 - bonus);
	}

	private syncStreakHud() {
		const streakText =
			this.streak >= 2
				? this.feverTier
					? '×' + this.streak + ' ' + TIER_NAME[this.feverTier]
					: '×' + this.streak
				: '';
		this.patchHud({ streakText });
	}

	private pushFloat(text: string, y: number, col: string) {
		this.floats.push({ text, y, a: 1, col });
	}

	private impulseKick(amount: number) {
		if (!this.reduceMotion) this.camKick = amount;
	}
	private impulseShake() {
		if (this.reduceMotion) return;
		this.shakeX = (Math.random() < 0.5 ? -1 : 1) * 6;
		this.shakeY = (Math.random() < 0.5 ? -1 : 1) * 4;
	}
	private impulseChroma() {
		if (this.reduceMotion) return;
		this.chromaX = (Math.random() < 0.5 ? -1 : 1) * 3;
	}

	private groundY = () => this.H * 0.78;
	private towerTopY = (i: number) => this.groundY() - i * BH;

	private reset() {
		this.blocks = [{ w: this.W * 0.62, hue: this.blockHue(0), q: 1 }];
		this.shards = [];
		this.floats = [];
		this.perfects = 0;
		this.streak = 0;
		this.maxStreak = 0;
		this.feverTier = 0;
		this.edgeGlow = 0;
		this.pastPeak = false;
		this.alive = true;
		this.flash = 0;
		this.camKick = 0;
		this.shakeX = 0;
		this.shakeY = 0;
		this.chromaX = 0;
		this.holdArmed = false;
		this.holdBeat = false;
		this.holdDone = false;
		this.beatStart = performance.now();
		this.beatLen = periodFor(1, this.rng, MIN_PERIOD, REST);
		this.tapped = false;
		this.cam = this.camTarget = 0;
		this.patchHud({ score: 0 });
		this.syncStreakHud();
	}

	private resolveHoldSuccess() {
		const i = this.blocks.length - 1,
			floor = this.blocks[i].w,
			cap = i > 0 ? this.blocks[i - 1].w : floor;
		this.blocks[i].w = Math.min(cap, floor * 1.15);
		this.pushFloat('HOLD', this.towerTopY(this.blocks.length), COOL);
		this.holdBeat = false;
		this.holdDone = true;
		this.holdArmed = false;
	}

	private applyFeverEnter(tier: number, y: number) {
		this.feverTier = tier;
		if (tier >= 2) this.edgeGlow = 1;
		if (tier >= 3) this.impulseChroma();
		this.pushFloat(TIER_NAME[tier], y - 20, tier >= 4 ? '#FFE8A8' : HOT);
		chordStab(tier, this.sound);
	}

	private onStreakBreak(y: number) {
		if (this.feverTier > 0) {
			coolCue(this.sound);
			this.pushFloat('cooled', y, COOL);
		}
		this.feverTier = 0;
		this.streak = 0;
		this.edgeGlow *= 0.4;
	}

	tap() {
		if (!this.running || !this.alive || this.tapped) return;
		this.tapped = true;
		const phase = Math.min(
			0.9999,
			Math.round(((performance.now() - this.beatStart) / this.beatLen) * 1e4) / 1e4
		);
		const n = this.blocks.length,
			floor = this.blocks[n - 1].w;
		let q = this.pulseNow;
		if (this.holdBeat && !this.teaching) {
			q = 0.04;
		} else {
			if (q > this.snapThresh(n)) q = 1;
			q = Math.max(q, 0.04);
		}
		const w = floor * q,
			kind = q === 1 ? 'perfect' : q > 0.7 ? 'ok' : 'bad';

		if (this.teaching) {
			tone(kind, n, this.sound, this.feverTier);
			if (kind === 'perfect') {
				this.taught = true;
				save('taught', '1');
				this.teaching = false;
				setCoach(this.el('coach'), false);
				this.patchHud({ coachOn: false });
				haptic(12);
				this.reset();
				this.flash = 1;
				this.impulseKick(14);
				this.pushFloat('Early or late shrinks the block.', this.groundY() - 48, P);
				this.taps = [];
				this.beat0 = this.beatIdx;
				this.tok = null;
				this.rng = this.rnd;
				post(this.pid, '/start', { mode: this.playMode })
					.then((j) => {
						this.tok = j.tok || null;
						if (Number.isInteger(j.seed)) this.rng = mulberry32(j.seed);
					})
					.catch(() => {});
			} else {
				this.onStreakBreak(this.towerTopY(n));
				this.syncStreakHud();
				if (kind === 'bad') this.impulseShake();
				if (q > 0.55)
					this.pushFloat(
						phase < 0.5 ? 'EARLY' : 'LATE',
						this.towerTopY(n),
						phase < 0.5 ? COOL : 'rgba(242,166,90,.85)'
					);
				haptic(kind === 'bad' ? [30, 20, 30] : 6);
			}
			return;
		}

		if (this.holdBeat) {
			this.holdBeat = false;
			this.holdDone = true;
			this.holdArmed = false;
		}

		this.taps.push([this.beatIdx - this.beat0, phase]);
		tone(kind, n, this.sound, this.feverTier);
		if (kind === 'perfect') {
			this.streak++;
			this.perfects++;
			this.maxStreak = Math.max(this.maxStreak, this.streak);
			const next = tierOf(this.streak);
			if (next > this.feverTier) this.applyFeverEnter(next, this.towerTopY(n));
			this.flash = Math.min(1.5, 1 + Math.min(this.streak, 12) * 0.05 + this.feverTier * 0.04);
			this.impulseKick(14 + this.feverTier * 3);
		} else {
			this.onStreakBreak(this.towerTopY(n));
			if (kind === 'bad') this.impulseShake();
			if (q > 0.55)
				this.pushFloat(
					phase < 0.5 ? 'EARLY' : 'LATE',
					this.towerTopY(n),
					phase < 0.5 ? COOL : 'rgba(242,166,90,.85)'
				);
		}
		this.syncStreakHud();
		haptic(kind === 'perfect' ? 12 : kind === 'bad' ? [30, 20, 30] : 6);
		if (w < floor - 1) {
			const side = (floor - w) / 2,
				y = this.towerTopY(n);
			this.shards.push({
				x: this.W / 2 - floor / 2,
				y,
				w: side,
				vx: -1.4,
				vy: -1.5,
				a: 1,
				hue: this.blocks[n - 1].hue
			});
			this.shards.push({
				x: this.W / 2 + w / 2,
				y,
				w: side,
				vx: 1.4,
				vy: -1.5,
				a: 1,
				hue: this.blocks[n - 1].hue
			});
		}
		this.blocks.push({ w, hue: this.blockHue(n), q });
		this.patchHud({ score: n });
		if (n === 10 || n === 25 || n === 50) this.pushFloat(String(n), this.towerTopY(n) - 18, P);
		if (n === this.best + 1)
			this.pushFloat(
				'NEW BEST',
				this.towerTopY(n) - (n === 10 || n === 25 || n === 50 ? 34 : 18),
				HOT
			);
		if (w < 7) this.end(n);
	}

	private end(n: number) {
		this.alive = false;
		setCoach(this.el('coach'), false);
		this.patchHud({ coachOn: false });
		this.holdBeat = false;
		this.holdArmed = false;
		const prevBest = this.best;
		this.lastScore = n;
		this.lastPerfectPct = Math.round((100 * this.perfects) / Math.max(1, n));
		this.lastMaxStreak = this.maxStreak;
		this.lastTier = this.feverTier || tierOf(this.maxStreak);
		if (n > this.best) {
			this.best = n;
			save('best', this.best);
			this.bestTower = this.blocks.map((b) => +(b.w / this.W).toFixed(5));
			save('bestTower', JSON.stringify(this.bestTower));
		}
		this.bumpDayStreak();
		const unlocked: string[] = [];
		if (this.maxStreak >= 10) {
			const u = this.unlockPalette();
			if (u) unlocked.push(u);
		}
		unlocked.forEach((name) => this.pushFloat('Unlocked: ' + name, this.groundY() - 60, HOT));

		let delta = '';
		if (n <= 0) delta = '';
		else if (n > prevBest) delta = '+' + (n - prevBest) + ' over best';
		else if (n === prevBest && n > 0) delta = 'Matched best';
		else delta = prevBest - n + ' from best';
		this.lastDelta = delta;
		this.lastUnlockNote = unlocked.length ? 'Unlocked: ' + unlocked.join(' · ') : '';

		const tierLabel = this.lastTier ? TIER_NAME[this.lastTier] : '—';
		this.patchHud({
			best: this.best,
			over: {
				final: n,
				headline: headlineFor(n),
				delta,
				peakPct: this.lastPerfectPct,
				maxStreak: this.lastMaxStreak,
				feverLabel: tierLabel,
				unlockNote: this.lastUnlockNote,
				board: '',
				shareOn: n > 0
			}
		});
		if (n > 0) this.lbAdd(this.who(), n);
		this.syncShapeUI();
		setTimeout(() => {
			showSheet(this.el('over'));
			this.patchHud({ sheet: 'over' });
		}, 700);
	}

	private lbAdd(name: string, n: number) {
		const mode = this.playMode;
		lbAddLocal(this.pid, mode, name, n);
		const t = this.tok;
		this.tok = null;
		if (!t) {
			this.patchBoard('Offline · local only');
			return;
		}
		this.patchBoard('Submitting…');
		post(this.pid, '/score', { tok: t, name, n, taps: this.taps })
			.then((list) => {
				if (!Array.isArray(list)) {
					this.patchBoard("Couldn't reach the board");
					return;
				}
				save(mode === 'daily' ? 'lbDaily' : 'lb', JSON.stringify(list));
				const r = lbRank(list, this.pid, n);
				const tag = mode === 'daily' ? 'daily' : 'worldwide';
				this.patchBoard(r ? `Submitted · #${r} ${tag}` : 'Submitted · outside top 10');
			})
			.catch(() => this.patchBoard("Couldn't reach the board"));
	}

	private patchBoard(board: string) {
		this.patchHud({
			over: {
				final: this.lastScore,
				headline: headlineFor(this.lastScore),
				delta: this.lastDelta,
				peakPct: this.lastPerfectPct,
				maxStreak: this.lastMaxStreak,
				feverLabel: this.lastTier ? TIER_NAME[this.lastTier] : '—',
				unlockNote: this.lastUnlockNote,
				board,
				shareOn: this.lastScore > 0
			}
		});
	}

	private frame(now: number) {
		if (this.destroyed) return;
		if (this.paused) this.beatStart += now - this.lastNow;
		this.lastNow = now;
		if (this.alive)
			while (now - this.beatStart >= this.beatLen) {
				if (this.running && this.holdBeat && !this.tapped && !this.teaching) this.resolveHoldSuccess();
				this.beatStart += this.beatLen;
				this.beatIdx++;
				this.beatLen = periodFor(this.running ? this.blocks.length : 1, this.rng, MIN_PERIOD, REST);
				this.tapped = false;
				this.pastPeak = false;
				if (this.holdArmed && !this.holdDone && !this.teaching) {
					this.holdBeat = true;
					this.holdArmed = false;
				} else this.holdBeat = false;
			}
		this.tNow = (now - this.beatStart) / this.beatLen;
		this.pulseNow = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.tNow);
		if (this.running && this.alive && !this.paused && this.tNow >= 0.5 && !this.pastPeak) {
			this.pastPeak = true;
			tick(this.sound, this.feverTier, this.holdBeat);
		}
		this.camTarget = Math.max(0, this.H * 0.45 - this.towerTopY(this.blocks.length));
		this.cam += (this.camTarget - this.cam) * 0.12;
		if (!this.reduceMotion && this.camKick) {
			this.cam += this.camKick;
			this.camKick = 0;
		}
		this.flash *= 0.86;
		this.shakeX *= 0.78;
		this.shakeY *= 0.78;
		this.chromaX *= 0.85;
		this.edgeGlow *= 0.94;

		const fw = this.blocks[this.blocks.length - 1].w;
		const atRisk = this.running && this.alive && !this.teaching && fw * 0.04 < 7;
		if (atRisk && !this.holdDone && !this.holdArmed && !this.holdBeat) this.holdArmed = true;

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.W, this.H);
		const glow = 0.1 + this.flash * (0.35 + Math.min(this.streak, 8) * 0.02 + this.feverTier * 0.03);
		const g = ctx.createRadialGradient(this.W / 2, this.H * 0.85, 10, this.W / 2, this.H * 0.85, this.H * 0.7);
		if (atRisk) {
			g.addColorStop(0, `rgba(111,175,198,${0.08 + glow * 0.35})`);
			g.addColorStop(1, 'rgba(111,175,198,0)');
		} else {
			g.addColorStop(0, `rgba(242,166,90,${glow})`);
			g.addColorStop(1, 'rgba(242,166,90,0)');
		}
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, this.W, this.H);
		const edgeOn = this.edgeGlow > 0.02;
		if (edgeOn) {
			const eg = ctx.createLinearGradient(0, 0, 0, this.H);
			eg.addColorStop(0, `rgba(255,210,122,${this.edgeGlow * 0.2})`);
			eg.addColorStop(0.5, 'rgba(255,210,122,0)');
			eg.addColorStop(1, `rgba(255,210,122,${this.edgeGlow * 0.18})`);
			ctx.fillStyle = eg;
			ctx.fillRect(0, 0, this.W, this.H);
			ctx.strokeStyle = `rgba(255,210,122,${this.edgeGlow * 0.35})`;
			ctx.lineWidth = 3;
			ctx.strokeRect(2, 2, this.W - 4, this.H - 4);
		}

		const ox = this.reduceMotion ? 0 : this.shakeX + this.chromaX;
		const oy = this.reduceMotion ? 0 : this.shakeY;
		ctx.save();
		ctx.translate(ox, this.cam + oy);
		ctx.strokeStyle = INK + '.07)';
		ctx.lineWidth = 1;
		ctx.font = '10px ui-monospace, monospace';
		ctx.fillStyle = 'rgba(140,147,168,.7)';
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';
		for (let i = 10; i <= this.blocks.length + 20; i += 10) {
			const y = this.towerTopY(i) + 0.5;
			ctx.beginPath();
			ctx.moveTo(14, y);
			ctx.lineTo(this.W - 14, y);
			ctx.stroke();
			ctx.fillText(String(i), 16, y - 8);
		}
		if (this.bestTower.length && this.running) {
			ctx.strokeStyle = INK + '.14)';
			ctx.lineWidth = 1;
			for (let i = 0; i < this.bestTower.length; i++) {
				const gw = this.bestTower[i] * this.W,
					y = this.towerTopY(i + 1);
				ctx.strokeRect(
					Math.round(this.W / 2 - gw / 2) + 0.5,
					y + 0.5,
					Math.max(1, Math.round(gw)) - 1,
					BH - 2
				);
			}
		}
		for (let i = 0; i < this.blocks.length; i++) {
			const b = this.blocks[i];
			ctx.fillStyle = `hsl(${b.hue} 72% ${b.q === 1 ? 62 : b.q > 0.7 ? 56 : 44}%)`;
			ctx.fillRect(
				Math.round(this.W / 2 - b.w / 2),
				this.towerTopY(i + 1),
				Math.max(1, Math.round(b.w)),
				BH - 1
			);
		}
		for (const s of this.shards) {
			s.x += s.vx;
			s.vy += 0.35;
			s.y += s.vy;
			s.a -= 0.025;
			ctx.globalAlpha = Math.max(0, s.a);
			ctx.fillStyle = `hsl(${s.hue} 60% 40%)`;
			ctx.fillRect(s.x, s.y, s.w, BH - 1);
		}
		ctx.globalAlpha = 1;
		this.shards = this.shards.filter((s) => s.a > 0);
		for (const f of this.floats) {
			f.a -= 0.018;
			if (!this.reduceMotion) f.y -= 0.55;
			ctx.globalAlpha = Math.max(0, f.a);
			ctx.fillStyle = f.col;
			ctx.font = '700 14px "Iowan Old Style",Palatino,Georgia,serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(f.text, this.W / 2, f.y);
		}
		ctx.globalAlpha = 1;
		this.floats = this.floats.filter((f) => f.a > 0);
		ctx.restore();

		drawPulse(
			ctx,
			this.shape,
			this.W,
			this.H,
			this.pulseNow,
			this.tNow,
			fw,
			this.towerTopY(this.blocks.length) + this.cam,
			this.tapped || !this.alive,
			atRisk || this.holdBeat
		);
		ctx.fillStyle = INK + '.25)';
		ctx.fillRect(this.W / 2 - fw / 2, this.H - 6, fw, 2);
		if (this.flash > 0.01 && !edgeOn) {
			ctx.fillStyle = `rgba(255,210,122,${Math.min(0.32, this.flash * (0.18 + Math.min(this.streak, 8) * 0.01 + this.feverTier * 0.015))})`;
			ctx.fillRect(0, 0, this.W, this.H);
		}
		if (atRisk) {
			ctx.fillStyle = 'rgba(111,175,198,.06)';
			ctx.fillRect(0, 0, this.W, this.H);
		}

		const options = this.el('options');
		const start = this.el('start');
		if (options && !options.hidden) this.drawOptions();
		if (start && !start.hidden) this.drawPulsePrev();
		this.raf = requestAnimationFrame((n) => this.frame(n));
	}

	private buildOptCards() {
		const opts = this.el('opts');
		if (!opts) return;
		opts.innerHTML = '';
		this.optCards = SHAPES.map((s) => {
			const el = document.createElement('div');
			el.className = 'opt';
			el.innerHTML = `<canvas></canvas><span>${s.name}</span>`;
			opts.appendChild(el);
			const c = el.querySelector('canvas')!;
			el.addEventListener('click', () => this.setShape(s.id));
			return { s, el, c, ctx: c.getContext('2d')!, w: 0, h: 0 };
		});
		this.syncShapeUI();
	}

	private syncShapeUI() {
		this.optCards.forEach((o) => {
			o.el.classList.toggle('on', o.s.id === this.shape);
			o.el.querySelector('span')!.textContent = o.s.name;
		});
	}

	private sizePulsePrev() {
		const prev = this.el('pulsePrev') as HTMLCanvasElement | null;
		if (!prev) return;
		const dpr = Math.min(2, devicePixelRatio || 1),
			r = prev.getBoundingClientRect();
		this.prevW = r.width;
		this.prevH = r.height;
		prev.width = r.width * dpr;
		prev.height = r.height * dpr;
		prev.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	private drawPulsePrev() {
		const prev = this.el('pulsePrev') as HTMLCanvasElement | null;
		if (!prev) return;
		if (!this.prevW) this.sizePulsePrev();
		const w = this.prevW,
			h = this.prevH,
			c = prev.getContext('2d')!;
		c.clearRect(0, 0, w, h);
		const floor = w * 0.58,
			bh = Math.round(h / 36),
			gy = h * 0.78;
		for (let i = 0; i < 3; i++) {
			c.fillStyle = `hsl(${this.blockHue(i)} 72% ${56 - i}%)`;
			c.fillRect(w / 2 - floor / 2, gy - (i + 1) * bh, floor, bh - 1);
		}
		drawPulse(c, this.shape, w, h, this.pulseNow, this.tNow, floor, gy - 3 * bh, false);
	}

	sizeOpts() {
		const dpr = Math.min(2, devicePixelRatio || 1);
		this.optCards.forEach((o) => {
			const r = o.c.getBoundingClientRect();
			o.w = r.width;
			o.h = r.height;
			o.c.width = r.width * dpr;
			o.c.height = r.height * dpr;
			o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		});
	}

	private drawOptions() {
		for (const o of this.optCards) {
			const { ctx: c, w, h } = o;
			if (!w) continue;
			c.clearRect(0, 0, w, h);
			const floor = w * 0.58,
				bh = Math.round(h / 36),
				gy = h * 0.74;
			for (let i = 0; i < 3; i++) {
				c.fillStyle = `hsl(${this.blockHue(i)} 72% ${56 - i}%)`;
				c.fillRect(w / 2 - floor / 2, gy - (i + 1) * bh, floor, bh - 1);
			}
			drawPulse(c, o.s.id, w, h, this.pulseNow, this.tNow, floor, gy - 3 * bh, false);
		}
	}

	size() {
		const stage = this.hooks.getStage();
		const cv = this.hooks.getCanvas();
		const dpr = Math.min(2, devicePixelRatio || 1),
			r = stage.getBoundingClientRect(),
			sc = this.W ? r.width / this.W : 1;
		this.W = r.width;
		this.H = r.height;
		cv.width = this.W * dpr;
		cv.height = this.H * dpr;
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (this.blocks && sc !== 1) this.blocks.forEach((b) => (b.w *= sc));
		const start = this.el('start');
		if (start && !start.hidden) this.sizePulsePrev();
	}

	async showOptions() {
		await Promise.all([hideSheet(this.el('start')), hideSheet(this.el('over'))]);
		showSheet(this.el('options'));
		this.patchHud({ sheet: 'options', sound: this.sound, shape: this.shape });
		this.syncShapeUI();
		requestAnimationFrame(() => this.sizeOpts());
	}

	async hideOptions() {
		await hideSheet(this.el('options'));
		if (this.paused) {
			showSheet(this.el('menu'));
			this.patchHud({ sheet: 'menu' });
		} else if (!this.running) {
			showSheet(this.el('start'));
			this.patchHud({ sheet: 'start' });
			requestAnimationFrame(() => this.sizePulsePrev());
		} else if (!this.alive) {
			showSheet(this.el('over'));
			this.patchHud({ sheet: 'over' });
		} else {
			this.patchHud({ sheet: null });
		}
	}

	async showLb(back: 'start' | 'over', mode: PlayMode = this.lbView) {
		this.lbView = mode === 'daily' ? 'daily' : 'endless';
		this.lbBack = back;
		await Promise.all([
			hideSheet(this.el('start')),
			hideSheet(this.el('over')),
			hideSheet(this.el('menu'))
		]);
		showSheet(this.el('lb'));
		const entries = lbGet(this.lbView);
		this.patchHud({
			sheet: 'lb',
			lb: {
				title: this.lbView === 'daily' ? 'Daily board' : 'Leaderboard',
				modeLabel: this.lbView === 'daily' ? 'Endless' : 'Daily',
				entries,
				pidShort: this.pid.slice(0, 4)
			}
		});
		const remote = await fetchBoard(this.lbView);
		if (remote) {
			this.patchHud({
				lb: {
					title: this.lbView === 'daily' ? 'Daily board' : 'Leaderboard',
					modeLabel: this.lbView === 'daily' ? 'Endless' : 'Daily',
					entries: remote,
					pidShort: this.pid.slice(0, 4)
				}
			});
		}
	}

	async hideLb() {
		await hideSheet(this.el('lb'));
		showSheet(this.el(this.lbBack));
		this.patchHud({ sheet: this.lbBack });
	}

	toggleLbMode() {
		this.showLb(this.lbBack, this.lbView === 'daily' ? 'endless' : 'daily');
	}

	pause() {
		if (!this.running || !this.alive || this.paused || this.teaching) return;
		this.paused = true;
		showSheet(this.el('menu'));
		this.patchHud({ sheet: 'menu' });
	}

	resume() {
		this.paused = false;
		hideSheet(this.el('menu'));
		this.patchHud({ sheet: null });
	}

	async restart() {
		this.paused = false;
		await hideSheet(this.el('menu'));
		this.begin(this.playMode);
	}

	async quit() {
		this.paused = false;
		this.running = false;
		this.alive = false;
		this.teaching = false;
		setCoach(this.el('coach'), false);
		this.patchHud({ coachOn: false });
		this.reset();
		await hideSheet(this.el('menu'));
		showSheet(this.el('start'));
		this.patchHud({ sheet: 'start' });
	}

	begin(mode: PlayMode = 'endless') {
		if (this.sound) audio();
		hideSheet(this.el('start'));
		hideSheet(this.el('over'));
		hideSheet(this.el('options'));
		hideSheet(this.el('menu'));
		hideSheet(this.el('lb'));
		this.reset();
		this.running = true;
		this.playMode = mode === 'daily' ? 'daily' : 'endless';
		this.tok = null;
		this.rng = this.rnd;
		this.taps = [];
		this.beat0 = this.beatIdx;
		this.teaching = !this.taught;
		setCoach(this.el('coach'), this.teaching);
		this.patchHud({ sheet: null, coachOn: this.teaching });
		if (!this.teaching) {
			post(this.pid, '/start', { mode: this.playMode })
				.then((j) => {
					this.tok = j.tok || null;
					if (Number.isInteger(j.seed)) this.rng = mulberry32(j.seed);
				})
				.catch(() => {});
		}
	}

	again() {
		this.begin(this.playMode);
	}

	share() {
		shareCard({
			lastScore: this.lastScore,
			lastPerfectPct: this.lastPerfectPct,
			playMode: this.playMode,
			shape: this.shape,
			who: this.who()
		});
	}

	onBack(): boolean {
		const options = this.el('options');
		const lb = this.el('lb');
		if (options && !options.hidden) {
			this.hideOptions();
			return true;
		}
		if (lb && !lb.hidden) {
			this.hideLb();
			return true;
		}
		if (this.paused) {
			this.resume();
			return true;
		}
		if (this.running && this.alive) {
			this.pause();
			return true;
		}
		return false;
	}

	get isPaused() {
		return this.paused;
	}
	get isRunning() {
		return this.running;
	}
	get isAlive() {
		return this.alive;
	}
	get startHidden() {
		const s = this.el('start');
		return !s || s.hidden;
	}
	get overHidden() {
		const o = this.el('over');
		return !o || o.hidden;
	}
}
