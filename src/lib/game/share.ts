import { Cap } from './platform';
import { SHAPES, type PlayMode, type ShapeId } from './constants';

export async function shareCard(opts: {
	lastScore: number;
	lastPerfectPct: number;
	playMode: PlayMode;
	shape: ShapeId;
	who: string;
}) {
	const { lastScore, lastPerfectPct, playMode, shape, who } = opts;
	const c = document.createElement('canvas');
	c.width = 720;
	c.height = 900;
	const g = c.getContext('2d')!;
	g.fillStyle = '#070A12';
	g.fillRect(0, 0, 720, 900);
	const rg = g.createRadialGradient(360, 720, 20, 360, 720, 420);
	rg.addColorStop(0, 'rgba(242,166,90,.22)');
	rg.addColorStop(1, 'rgba(242,166,90,0)');
	g.fillStyle = rg;
	g.fillRect(0, 0, 720, 900);
	g.fillStyle = '#F4F0E8';
	g.font = '700 54px "Iowan Old Style",Palatino,Georgia,serif';
	g.textAlign = 'center';
	g.fillText('Pulse', 318, 120);
	g.fillStyle = '#F2A65A';
	g.fillText('Stack', 458, 120);
	g.fillStyle = '#F2A65A';
	g.font = '600 160px ui-monospace,monospace';
	g.fillText(String(lastScore), 360, 380);
	g.fillStyle = '#8C93A8';
	g.font = '12px ui-monospace,monospace';
	g.fillText('HEIGHT', 360, 420);
	g.fillStyle = '#F3EEE4';
	g.font = '600 28px system-ui,sans-serif';
	g.fillText(lastPerfectPct + '% on the peak', 360, 500);
	const sn = SHAPES.find((s) => s.id === shape);
	g.fillStyle = '#8C93A8';
	g.font = '14px ui-monospace,monospace';
	g.fillText((playMode === 'daily' ? 'Daily · ' : '') + (sn ? sn.name : shape) + ' · ' + who, 360, 560);
	g.fillStyle = '#8C93A8';
	g.font = '12px ui-monospace,monospace';
	g.fillText('pulsestack', 360, 820);

	const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
	if (!blob) return;
	const file = new File([blob], 'pulsestack.png', { type: 'image/png' });
	const text =
		`PulseStack ${lastScore} · ${lastPerfectPct}% peak` + (playMode === 'daily' ? ' · Daily' : '');

	if (Cap.isNative) {
		try {
			const { Share } = await import('@capacitor/share');
			const dataUrl = await new Promise<string>((resolve) => {
				const r = new FileReader();
				r.onload = () => resolve(String(r.result));
				r.readAsDataURL(blob);
			});
			await Share.share({ title: 'PulseStack', text, url: dataUrl, dialogTitle: 'Share run' });
			return;
		} catch {
			/* fall through */
		}
	}

	try {
		if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
			await navigator.share({ files: [file], title: 'PulseStack', text });
			return;
		}
	} catch {
		/* fall through */
	}
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = 'pulsestack.png';
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 2e3);
}
