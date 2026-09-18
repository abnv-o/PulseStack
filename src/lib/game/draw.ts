import { COOL, HOT, INK, P } from './constants';
import type { ShapeId } from './constants';

export function drawPulse(
	c: CanvasRenderingContext2D,
	id: ShapeId,
	w: number,
	h: number,
	p: number,
	_t: number,
	floor: number,
	top: number,
	dead: boolean,
	atRisk?: boolean
) {
	const cx = w / 2,
		hot = p > 0.94;
	const col = dead ? COOL : atRisk ? (hot ? '#9ED0E0' : '#6FAFC6') : hot ? HOT : P;
	const bh = Math.max(10, Math.round(h / 36));
	if (id === 'circle') {
		const cy = h * 0.88,
			rMax = w * 0.145,
			r = rMax * (0.1 + 0.9 * p);
		c.strokeStyle = INK + '.12)';
		c.lineWidth = 1.25;
		c.beginPath();
		c.arc(cx, cy, rMax, 0, 7);
		c.stroke();
		if (hot && !dead) {
			const g = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.55);
			g.addColorStop(0, 'rgba(255,210,122,.35)');
			g.addColorStop(1, 'rgba(255,210,122,0)');
			c.fillStyle = g;
			c.beginPath();
			c.arc(cx, cy, r * 1.55, 0, 7);
			c.fill();
		}
		c.fillStyle = col;
		c.globalAlpha = dead ? 0.35 : 0.92;
		c.beginPath();
		c.arc(cx, cy, Math.max(2, r), 0, 7);
		c.fill();
		c.globalAlpha = 1;
		c.strokeStyle = hot ? HOT : INK + '.22)';
		c.lineWidth = hot ? 2.5 : 1.25;
		c.beginPath();
		c.arc(cx, cy, rMax * (0.12 + 0.88 * p), 0, 7);
		c.stroke();
	} else {
		const y = top - bh;
		const gw = Math.max(2, floor * p);
		c.strokeStyle = INK + (hot ? '.28)' : '.16)');
		c.lineWidth = 1.25;
		c.setLineDash(hot ? [] : [5, 4]);
		c.strokeRect(Math.round(cx - floor / 2) + 0.5, y + 0.5, Math.max(1, Math.round(floor)) - 1, bh - 2);
		c.setLineDash([]);
		if (hot && !dead) {
			c.fillStyle = 'rgba(255,210,122,.12)';
			c.fillRect(Math.round(cx - floor / 2) - 4, y - 4, Math.round(floor) + 8, bh + 6);
		}
		c.fillStyle = col;
		c.globalAlpha = dead ? 0.22 : 0.38 + 0.55 * p;
		c.fillRect(Math.round(cx - gw / 2), y, Math.round(gw), bh - 1);
		c.globalAlpha = 1;
		if (p > 0.55) {
			c.strokeStyle = hot ? HOT : col;
			c.lineWidth = hot ? 1.75 : 1;
			c.strokeRect(Math.round(cx - gw / 2) + 0.5, y + 0.5, Math.max(1, Math.round(gw)) - 1, bh - 2);
		}
	}
}
