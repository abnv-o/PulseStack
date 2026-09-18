export const BH = 16;
export const REST = 1200;
export const MIN_PERIOD = 430;
export const INK = 'rgba(244,240,232,';
export const P = '#F2A65A';
export const HOT = '#FFD27A';
export const COOL = 'rgba(111,175,198,.55)';
export const TIER_NAME = ['', 'WARM', 'HOT', 'FEVER', 'OVERDRIVE'] as const;
export const SHAPES = [
	{ id: 'ghost' as const, name: 'Ghost' },
	{ id: 'circle' as const, name: 'Circle' }
];
export type ShapeId = (typeof SHAPES)[number]['id'];
export type PlayMode = 'endless' | 'daily';

export const tierOf = (s: number) => (s >= 20 ? 4 : s >= 10 ? 3 : s >= 5 ? 2 : s >= 3 ? 1 : 0);

export const headlineFor = (n: number) =>
	n <= 0
		? 'Nothing held.'
		: n < 10
			? 'A stub of a tower.'
			: n < 25
				? 'The tower is a thread.'
				: n < 50
					? 'Still climbing.'
					: n < 100
						? 'The beat held.'
						: 'A tower of peaks.';
