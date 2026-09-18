import { Cap } from './platform';

export async function haptic(ms: number | number[]) {
	try {
		const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
		if (Cap.isNative) {
			if (Array.isArray(ms)) {
				await Haptics.vibrate({ duration: ms.reduce((a, b) => a + b, 0) });
			} else if (ms >= 20) {
				await Haptics.impact({ style: ImpactStyle.Medium });
			} else {
				await Haptics.impact({ style: ImpactStyle.Light });
			}
			return;
		}
	} catch {
		/* fall through */
	}
	if (navigator.vibrate) navigator.vibrate(ms);
}
