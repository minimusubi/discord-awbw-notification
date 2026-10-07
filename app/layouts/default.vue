<template>
	<div class="site-shell">
		<header class="site-header">
			<div
				class="container d-flex align-items-center justify-content-between gap-3 py-3"
			>
				<BrandMark />
				<nav
					class="d-flex align-items-center gap-2"
					aria-label="Primary navigation"
				>
					<ThemeToggle />
					<NuxtLink
						v-if="session?.authenticated"
						class="btn btn-primary rounded-pill px-4"
						to="/dashboard"
					>
						Open dashboard
					</NuxtLink>
					<NuxtLink
						v-else
						class="btn btn-outline-primary rounded-pill px-4"
						to="/login"
					>
						Log in
					</NuxtLink>
				</nav>
			</div>
		</header>
		<main class="site-main">
			<slot />
		</main>
	</div>
</template>

<script lang="ts" setup>
	const requestHeaders =
		import.meta.server ? useRequestHeaders(['cookie']) : undefined;
	const { data: session } = await useFetch<AuthSessionResponse>(
		'/api/auth/session',
		{
			headers: requestHeaders,
		},
	);
</script>
