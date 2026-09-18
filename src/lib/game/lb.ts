import type { PlayMode } from './constants';
import { LB_URL } from './platform';
import { pref, save } from './storage';

export type LbEntry = { id: string; name: string; n: number };

export const lbKey = (mode: PlayMode) => (mode === 'daily' ? 'lbDaily' : 'lb');

export const lbGet = (mode: PlayMode = 'endless'): LbEntry[] => {
	try {
		const l = JSON.parse(pref(lbKey(mode), '[]'));
		return Array.isArray(l) ? l : [];
	} catch {
		return [];
	}
};

export const lbRank = (l: LbEntry[], pid: string, n: number) =>
	l.findIndex((e) => e.id === pid.slice(0, 4) && e.n === n) + 1;

export const post = (pid: string, path: string, body: Record<string, unknown>) =>
	fetch(LB_URL + path, { method: 'POST', body: JSON.stringify({ pid, ...body }) }).then((r) =>
		r.json()
	);

export async function fetchBoard(mode: PlayMode): Promise<LbEntry[] | null> {
	const url = mode === 'daily' ? LB_URL + '/daily' : LB_URL;
	try {
		const l = await fetch(url).then((r) => r.json());
		if (!Array.isArray(l)) return null;
		save(lbKey(mode), JSON.stringify(l));
		return l;
	} catch {
		return null;
	}
}

export function lbAddLocal(pid: string, mode: PlayMode, name: string, n: number): number {
	const l = lbGet(mode).filter((e) => e.id !== pid.slice(0, 4) || e.n >= n);
	if (!l.some((e) => e.id === pid.slice(0, 4))) l.push({ id: pid.slice(0, 4), name, n });
	l.sort((a, b) => b.n - a.n);
	const top = l.slice(0, 10);
	save(lbKey(mode), JSON.stringify(top));
	return lbRank(top, pid, n);
}
