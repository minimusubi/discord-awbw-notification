<template>
	<div>
		<div class="page-heading">
			<div>
				<span class="eyebrow">Discord servers</span>
				<h1 class="mt-2">Choose a server</h1>
				<p>Manage the AWBW turn alerts shared in each server.</p>
			</div>
		</div>

		<div
			v-if="guilds.length"
			class="guild-grid mt-4"
		>
			<NuxtLink
				v-for="guild in guilds"
				:key="guild.id"
				class="guild-card"
				:to="`/dashboard/${guild.id}`"
			>
				<img
					v-if="guild.iconURL"
					class="guild-card__icon"
					:src="guild.iconURL"
					alt=""
				/>
				<span
					v-else
					class="guild-card__icon guild-card__icon--fallback"
				>
					{{ guild.name.slice(0, 2).toUpperCase() }}
				</span>
				<span class="guild-card__copy">
					<strong>{{ guild.name }}</strong>
					<small v-if="guild.memberCount !== null">
						{{ guild.memberCount.toLocaleString() }} members
					</small>
				</span>
				<span class="guild-card__arrow material-symbols-outlined"
					>arrow_forward</span
				>
			</NuxtLink>
		</div>

		<div
			v-else
			class="empty-state mt-4"
		>
			<span class="empty-state__icon material-symbols-outlined"
				>travel_explore</span
			>
			<h2>No manageable servers found</h2>
			<p>
				Install the bot in a server where you have the Manage Server
				permission, then return here to add game alerts.
			</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
	definePageMeta({ layout: 'dashboard', middleware: 'auth' });
	useHead({ title: 'Choose a server' });

	const { data } = useNuxtData<ManagedGuildSummary[]>('managed-guilds');
	const guilds = computed(() => data.value ?? []);
</script>
