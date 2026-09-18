import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'app.pulsestack',
	appName: 'Pulse Stack',
	webDir: 'build',
	server: {
		androidScheme: 'https'
	},
	plugins: {
		SplashScreen: {
			launchAutoHide: true,
			backgroundColor: '#070A12'
		},
		StatusBar: {
			style: 'DARK',
			backgroundColor: '#070A12'
		}
	}
};

export default config;
