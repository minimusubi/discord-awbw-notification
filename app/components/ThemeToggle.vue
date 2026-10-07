<template>
	<button
		class="theme-toggle"
		type="button"
		:aria-pressed="isDark"
		:aria-label="`Switch to ${isDark ? 'light' : 'dark'} theme`"
		:title="`Switch to ${isDark ? 'light' : 'dark'} theme`"
		@click="toggleTheme"
	>
		<span
			class="material-symbols-outlined"
			aria-hidden="true"
		>
			{{ isDark ? 'light_mode' : 'dark_mode' }}
		</span>
	</button>
</template>

<script lang="ts" setup>
	const { initialize, isDark, toggleTheme } = useThemePreference();

	onMounted(() => {
		initialize();
	});
</script>
