import { Capacitor } from '@capacitor/core';
import { env } from '$env/dynamic/public';

export const Cap = {
	get isNative() {
		return Capacitor.isNativePlatform();
	}
};

export const LB_URL =
	env.PUBLIC_LB_URL?.replace(/\/$/, '') || 'https://pulsestack-lb.lotusquants.workers.dev';

export function appVersionLabel(): string {
	if (typeof window !== 'undefined' && window.Android?.version) {
		return 'v' + window.Android.version();
	}
	if (Cap.isNative) {
		return 'v' + (env.PUBLIC_APP_VERSION || '1.0.0');
	}
	return 'web';
}
