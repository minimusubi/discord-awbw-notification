// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-11-24',
	devtools: { enabled: true },
	modules: ['@nuxt/eslint', '@nuxtjs/color-mode'],
	css: ['~/styles/global.scss'],
	nitro: {
		esbuild: {
			options: {
				target: 'esnext',
			},
		},
	},
	// https://color-mode.nuxtjs.org/usage/configuration
	colorMode: {
		preference: 'system',
		fallback: 'dark',
		dataValue: 'bs-theme',
	},
});
