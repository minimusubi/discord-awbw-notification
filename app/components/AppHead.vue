<template>
	<!-- No content -->
	<!-- Slot is only used to resolve hydration mismatch issues -->
	<slot></slot>
</template>

<script lang="ts" setup>
	const appName = inject('app-name');
	useHead({
		titleTemplate: (title) =>
			title ? `${title} · ${appName}` : String(appName),
		link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
	});

	useSeoMeta({
		description:
			'Get a Discord notification when it is your turn in an Advance Wars By Web game.',
		ogDescription:
			'Sign up for AWBW game alerts and get pinged when your turn starts.',
		ogTitle: 'AWBW Turn Alerts',
		twitterCard: 'summary_large_image',
		twitterDescription:
			'Get a Discord ping when your turn starts in an AWBW game.',
		twitterTitle: 'AWBW Turn Alerts',
		themeColor: [
			{ content: '#6c5ce7', media: '(prefers-color-scheme: light)' },
			{ content: '#171525', media: '(prefers-color-scheme: dark)' },
		],
	});
</script>
