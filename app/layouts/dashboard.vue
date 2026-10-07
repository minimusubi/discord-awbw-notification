<template>
	<div class="dashboard-shell">
		<header class="dashboard-mobile-header">
			<button
				class="icon-button"
				type="button"
				aria-label="Open navigation"
				@click="menuOpen = true"
			>
				<span class="material-symbols-outlined">menu</span>
			</button>
			<BrandMark />
			<ThemeToggle />
		</header>

		<div
			v-if="menuOpen"
			class="sidebar-scrim"
			@click="menuOpen = false"
		></div>
		<aside
			class="dashboard-sidebar"
			:class="{ 'is-open': menuOpen }"
		>
			<div class="dashboard-sidebar__top">
				<div class="d-flex align-items-center justify-content-between">
					<BrandMark />
					<button
						class="icon-button dashboard-sidebar__close"
						type="button"
						aria-label="Close navigation"
						@click="menuOpen = false"
					>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>

				<div class="server-switcher mt-4">
					<div class="eyebrow">Managing server</div>
					<DiscordServerPicker
						class="mt-2"
						:guilds="guilds"
						:model-value="selectedGuildId"
						@update:model-value="switchGuild"
					/>
				</div>

				<nav
					class="dashboard-nav mt-4"
					aria-label="Dashboard navigation"
				>
					<NuxtLink
						class="dashboard-nav__link"
						to="/dashboard"
						@click="menuOpen = false"
					>
						<span class="material-symbols-outlined">grid_view</span>
						Server picker
					</NuxtLink>
					<NuxtLink
						v-if="selectedGuildId"
						class="dashboard-nav__link"
						:to="`/dashboard/${selectedGuildId}`"
						@click="menuOpen = false"
					>
						<span class="material-symbols-outlined"
							>notifications</span
						>
						Game alerts
					</NuxtLink>
				</nav>
			</div>

			<div class="dashboard-sidebar__footer">
				<div class="dashboard-user">
					<img
						v-if="session?.user?.avatarURL"
						class="dashboard-user__avatar"
						:src="session.user.avatarURL"
						alt=""
					/>
					<span
						v-else
						class="dashboard-user__avatar dashboard-user__avatar--fallback"
					>
						{{
							session?.user?.displayName.slice(0, 1).toUpperCase()
						}}
					</span>
					<span class="dashboard-user__copy">
						<strong>{{ session?.user?.displayName }}</strong>
						<small>@{{ session?.user?.username }}</small>
					</span>
					<ThemeToggle />
				</div>
				<button
					class="btn btn-soft w-100 mt-3"
					type="button"
					@click="logOut"
				>
					<span class="material-symbols-outlined me-2">logout</span>
					Log out
				</button>
			</div>
		</aside>

		<main class="dashboard-main">
			<div class="dashboard-content">
				<slot />
			</div>
		</main>
	</div>
</template>

<script lang="ts" setup>
	const route = useRoute();
	const menuOpen = ref(false);
	const requestHeaders =
		import.meta.server ? useRequestHeaders(['cookie']) : undefined;
	const { data: session } = await useFetch<AuthSessionResponse>(
		'/api/auth/session',
		{
			headers: requestHeaders,
		},
	);
	const { data: guildData } = await useFetch<ManagedGuildSummary[]>(
		'/api/guilds',
		{
			key: 'managed-guilds',
			headers: requestHeaders,
			default: () => [],
		},
	);
	const guilds = computed(() => guildData.value ?? []);
	const selectedGuildId = computed(() => {
		const value = route.params.guildId;
		return typeof value === 'string' ? value : '';
	});

	function switchGuild(guildId: string) {
		menuOpen.value = false;
		if (!guildId) {
			void navigateTo('/dashboard');
			return;
		}

		if (!selectedGuildId.value || !route.name) {
			void navigateTo(`/dashboard/${guildId}`);
			return;
		}

		void navigateTo({
			name: route.name,
			params: { ...route.params, guildId },
			query: route.query,
			hash: route.hash,
		});
	}

	async function logOut() {
		await $fetch('/api/auth/logout', { method: 'POST' });
		await navigateTo('/');
	}
</script>
