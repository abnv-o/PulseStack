declare global {
	namespace App {}
	interface Window {
		Android?: { version: () => string };
		onBack?: () => boolean;
	}
}

export {};
