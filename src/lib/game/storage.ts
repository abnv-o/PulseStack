export const pref = (k: string, d: string): string => {
	try {
		const v = localStorage.getItem('ps-' + k);
		return v === null ? d : v;
	} catch {
		return d;
	}
};

export const save = (k: string, v: string | number) => {
	try {
		localStorage.setItem('ps-' + k, String(v));
	} catch {
		/* ignore */
	}
};

export type Unlocks = { skins: Set<string>; palette: boolean };

export function loadUnlocks(): Unlocks {
	try {
		const u = JSON.parse(pref('unlocks', '{"skins":[],"palette":false}'));
		return { skins: new Set(), palette: !!u.palette };
	} catch {
		return { skins: new Set(), palette: false };
	}
}

export function saveUnlocks(unlocks: Unlocks) {
	save('unlocks', JSON.stringify({ skins: [], palette: unlocks.palette }));
}

export function loadBestTower(): number[] {
	try {
		const a = JSON.parse(pref('bestTower', '[]'));
		return Array.isArray(a) ? a.map(Number).filter((n) => n > 0) : [];
	} catch {
		return [];
	}
}

export function ensurePid(): string {
	const existing = pref('id', '');
	if (existing) return existing;
	const v =
		crypto.randomUUID?.() ??
		[...Array(32)].map(() => ((Math.random() * 16) | 0).toString(16)).join('');
	save('id', v);
	return v;
}

export const utcDay = () => new Date().toISOString().slice(0, 10);
