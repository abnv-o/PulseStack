/// <reference types="@sveltejs/kit" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly PUBLIC_LB_URL: string;
	readonly PUBLIC_APP_VERSION: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
