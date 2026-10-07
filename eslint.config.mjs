// @ts-check
import eslintConfigPrettier from 'eslint-config-prettier';
import js from '@eslint/js';
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt(
	eslintConfigPrettier,

	{
		rules: {
			curly: 'error',
			'prefer-arrow-callback': 'error',
			'prefer-const': 'error',
			'sort-imports': 'warn',
		},
	},
).prepend(js.configs.recommended);
