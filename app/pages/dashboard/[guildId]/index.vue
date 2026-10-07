<template>
	<div class="awbw-dashboard">
		<div class="page-heading page-heading--with-action">
			<div>
				<span class="eyebrow">AWBW game alerts</span>
				<h1 class="mt-2">Manage turn notifications</h1>
				<p v-if="dashboardData">
					Add games and manage alerts in
					{{ dashboardData.guild.name }}.
				</p>
			</div>
			<div
				v-if="dashboardData"
				class="status-chip"
			>
				<span></span>
				{{ dashboardData.subscriptions.length }}
				{{
					dashboardData.subscriptions.length === 1 ?
						'alert'
					:	'alerts'
				}}
			</div>
		</div>
		<div
			v-if="actionError"
			class="alert alert-danger mt-4"
			role="alert"
		>
			{{ actionError }}
		</div>
		<div
			v-if="feedbackMessage"
			class="alert alert-success mt-4"
			role="status"
		>
			{{ feedbackMessage }}
		</div>

		<div
			v-if="pending"
			class="panel-card mt-4"
		>
			<div class="loading-block"></div>
			<div class="loading-block is-short mt-3"></div>
		</div>

		<div
			v-else-if="loadError"
			class="alert alert-danger mt-4"
		>
			{{ getErrorMessage(loadError, 'Game alerts could not be loaded.') }}
		</div>

		<div
			v-else-if="dashboardData"
			class="awbw-dashboard__layout mt-4"
		>
			<section class="panel-card awbw-add-card">
				<div class="panel-card__heading">
					<span class="panel-card__icon is-purple">
						<span class="material-symbols-outlined">add_alert</span>
					</span>
					<div>
						<h2>Add a game alert</h2>
						<p>
							Choose who to ping and where the alert should
							appear.
						</p>
					</div>
				</div>

				<form
					class="awbw-alert-form mt-4"
					@submit.prevent="addSubscription"
				>
					<div>
						<label
							class="form-label"
							for="awbw-username"
							>AWBW username</label
						>
						<input
							id="awbw-username"
							v-model.trim="awbwUsername"
							class="form-control"
							type="text"
							maxlength="100"
							autocomplete="username"
							placeholder="Your AWBW username"
							required
						/>
					</div>

					<div>
						<label
							class="form-label"
							for="awbw-game-url"
							>Game link</label
						>
						<input
							id="awbw-game-url"
							v-model.trim="gameUrl"
							class="form-control"
							type="url"
							inputmode="url"
							placeholder="https://awbw.amarriner.com/game.php?games_id=1741266"
							required
						/>
						<p
							v-if="gameUrl && !parsedGameId"
							class="field-error mb-0 mt-2"
							role="status"
						>
							Use an AWBW game link containing a numeric games_id.
						</p>
						<p
							v-else-if="parsedGameId"
							class="field-help mb-0 mt-2"
						>
							Game ID {{ parsedGameId }}
						</p>
					</div>

					<div>
						<label class="form-label">Notify Discord member</label>
						<DiscordMemberPicker
							v-model="discordUserId"
							:guild-id="guildId"
						/>
						<p class="field-help mb-0 mt-2">
							Defaults to your Discord account. You can choose
							another server member.
						</p>
					</div>

					<div>
						<label
							class="form-label"
							for="notification-channel"
							>Notification channel</label
						>
						<select
							id="notification-channel"
							v-model="channelId"
							class="form-select"
							:disabled="availableChannelCount === 0"
							required
						>
							<option value="">Choose a channel</option>
							<template
								v-for="channelGroup in dashboardData.channelGroups"
								:key="channelGroup.id ?? 'uncategorized'"
							>
								<optgroup
									v-if="channelGroup.name"
									:label="channelGroup.name"
								>
									<option
										v-for="channel in channelGroup.channels"
										:key="channel.id"
										:value="channel.id"
									>
										# {{ channel.name }}
									</option>
								</optgroup>
								<template v-else>
									<option
										v-for="channel in channelGroup.channels"
										:key="channel.id"
										:value="channel.id"
									>
										# {{ channel.name }}
									</option>
								</template>
							</template>
						</select>
						<p
							v-if="availableChannelCount === 0"
							class="field-error mb-0 mt-2"
							role="status"
						>
							No channels where the bot can send messages were
							found.
						</p>
					</div>

					<div
						v-if="formError"
						class="alert alert-danger mb-0"
						role="alert"
					>
						{{ formError }}
					</div>
					<button
						class="btn btn-primary btn-lg w-100"
						type="submit"
						:disabled="adding || availableChannelCount === 0"
					>
						<span
							v-if="adding"
							class="spinner-border spinner-border-sm me-2"
						></span>
						<span
							v-else
							class="material-symbols-outlined me-2"
							>add</span
						>
						{{ adding ? 'Adding alert…' : 'Add game alert' }}
					</button>
				</form>
			</section>

			<section class="panel-card awbw-subscriptions-card">
				<div class="panel-card__heading">
					<span class="panel-card__icon is-mint">
						<span class="material-symbols-outlined"
							>notifications</span
						>
					</span>
					<div>
						<h2>Saved alerts</h2>
						<p>Remove an alert whenever you no longer need it.</p>
					</div>
				</div>

				<div
					v-if="dashboardData.subscriptions.length"
					class="awbw-subscription-list mt-4"
				>
					<article
						v-for="subscription in dashboardData.subscriptions"
						:key="subscription.id"
						class="awbw-subscription"
					>
						<div class="awbw-subscription__top">
							<div class="awbw-subscription__game">
								<span class="awbw-subscription__game-icon">
									<span class="material-symbols-outlined"
										>sports_esports</span
									>
								</span>
								<span>
									<strong>{{
										getGameLabel(subscription)
									}}</strong>
									<small
										>AWBW username:
										{{ subscription.awbwUsername }}</small
									>
								</span>
							</div>
							<button
								class="icon-button awbw-subscription__remove"
								type="button"
								:aria-label="`Remove alert for ${subscription.awbwUsername} in ${getGameLabel(subscription)}`"
								:title="`Remove alert for ${getGameLabel(subscription)}`"
								:disabled="removingSubscriptionId !== null"
								@click="removeSubscription(subscription)"
							>
								<span
									v-if="
										removingSubscriptionId
										=== subscription.id
									"
									class="spinner-border spinner-border-sm"
								></span>
								<span
									v-else
									class="material-symbols-outlined"
									>delete</span
								>
							</button>
						</div>
						<div class="awbw-subscription__details">
							<div>
								<span class="awbw-subscription__label"
									>Notify</span
								>
								<strong>{{
									subscription.discordUserDisplayName
									|| `User ${subscription.discordUserId}`
								}}</strong>
							</div>
							<div>
								<span class="awbw-subscription__label"
									>Channel</span
								>
								<strong
									>#{{
										subscription.channelName
										|| subscription.channelId
									}}</strong
								>
							</div>
						</div>
						<div class="awbw-subscription__footer">
							<a
								:href="subscription.gameUrl"
								target="_blank"
								rel="noreferrer"
							>
								Open AWBW game
								<span class="material-symbols-outlined"
									>open_in_new</span
								>
							</a>
							<small v-if="getPlayerIds(subscription).length">
								Player IDs
								{{ getPlayerIds(subscription).join(', ') }}
							</small>
						</div>
					</article>
				</div>
				<div
					v-else
					class="awbw-empty-state mt-4"
				>
					<span class="material-symbols-outlined"
						>notification_add</span
					>
					<strong>No game alerts yet</strong>
					<p>
						Add a game to get a Discord ping when your AWBW turn
						begins.
					</p>
				</div>
			</section>
		</div>
	</div>
</template>

<script lang="ts" setup>
	import type {
		AWBWGameSubscription,
		AuthSessionResponse,
		CreateAWBWGameSubscriptionInput,
		GuildGameSubscriptionsResponse,
	} from '#shared/types/dashboard';

	definePageMeta({ layout: 'dashboard', middleware: 'auth' });
	useHead({ title: 'Manage game alerts' });

	const route = useRoute();
	const guildId = computed(() => String(route.params.guildId));
	const requestHeaders =
		import.meta.server ? useRequestHeaders(['cookie']) : undefined;
	const {
		data: dashboardData,
		pending,
		error: loadError,
	} = await useFetch<GuildGameSubscriptionsResponse>(
		() => `/api/guilds/${guildId.value}/subscriptions`,
		{ headers: requestHeaders },
	);
	const { data: session } = await useFetch<AuthSessionResponse>(
		'/api/auth/session',
		{ headers: requestHeaders },
	);

	const awbwUsername = ref('');
	const gameUrl = ref('');
	const channelId = ref('');
	const discordUserId = ref('');
	const adding = ref(false);
	const removingSubscriptionId = ref<string | null>(null);
	const formError = ref('');
	const actionError = ref('');
	const feedbackMessage = ref('');
	const availableChannelCount = computed(
		() =>
			dashboardData.value?.channelGroups.reduce(
				(count, group) => count + group.channels.length,
				0,
			) ?? 0,
	);
	const parsedGameId = computed(() => parseAWBWGameId(gameUrl.value));

	watch(
		() => session.value?.user?.id,
		(userId) => {
			if (!discordUserId.value && userId) {
				discordUserId.value = userId;
			}
		},
		{ immediate: true },
	);

	async function addSubscription() {
		formError.value = '';
		actionError.value = '';
		feedbackMessage.value = '';
		if (!parsedGameId.value) {
			formError.value =
				'Enter an AWBW game link that includes a numeric games_id.';
			return;
		}
		if (!channelId.value) {
			formError.value = 'Choose a notification channel.';
			return;
		}

		const input: CreateAWBWGameSubscriptionInput = {
			gameUrl: gameUrl.value,
			awbwUsername: awbwUsername.value,
			channelId: channelId.value,
			...(discordUserId.value ?
				{ discordUserId: discordUserId.value }
			:	{}),
		};
		adding.value = true;
		try {
			dashboardData.value = await $fetch<GuildGameSubscriptionsResponse>(
				`/api/guilds/${guildId.value}/subscriptions`,
				{ method: 'POST', body: input },
			);
			feedbackMessage.value = `Alert added for ${awbwUsername.value}.`;
			awbwUsername.value = '';
			gameUrl.value = '';
		} catch (error) {
			formError.value = getErrorMessage(
				error,
				'Game alert could not be added.',
			);
		} finally {
			adding.value = false;
		}
	}

	async function removeSubscription(subscription: AWBWGameSubscription) {
		actionError.value = '';
		feedbackMessage.value = '';
		removingSubscriptionId.value = subscription.id;
		try {
			dashboardData.value = await $fetch<GuildGameSubscriptionsResponse>(
				`/api/guilds/${guildId.value}/subscriptions/${subscription.id}`,
				{ method: 'DELETE' },
			);
			feedbackMessage.value = `Alert removed for ${subscription.awbwUsername}.`;
		} catch (error) {
			actionError.value = getErrorMessage(
				error,
				'Game alert could not be removed.',
			);
		} finally {
			removingSubscriptionId.value = null;
		}
	}

	function parseAWBWGameId(value: string): string | null {
		if (!value.trim()) {
			return null;
		}
		try {
			const gameURL = new URL(value);
			const hostname = gameURL.hostname.replace(/^www\./, '');
			const gameId = gameURL.searchParams.get('games_id');
			if (
				gameURL.protocol !== 'https:'
				|| hostname !== 'awbw.amarriner.com'
				|| gameURL.pathname !== '/game.php'
				|| !gameId
				|| !/^\d+$/.test(gameId)
			) {
				return null;
			}
			return gameId;
		} catch {
			return null;
		}
	}

	function getPlayerIds(subscription: AWBWGameSubscription): string[] {
		const playerIds =
			subscription.playerIds?.length ? subscription.playerIds
			: subscription.playerId ? [subscription.playerId]
			: [];
		return [...new Set(playerIds)];
	}

	function getGameLabel(subscription: AWBWGameSubscription): string {
		return subscription.gameName ?
				`${subscription.gameName} (Game #${subscription.gameId})`
			:	`Game #${subscription.gameId}`;
	}

	function getErrorMessage(error: unknown, fallback: string): string {
		if (typeof error !== 'object' || error === null) {
			return fallback;
		}
		const fetchError = error as {
			data?: { message?: string; statusMessage?: string };
			statusMessage?: string;
		};
		return (
			fetchError.data?.statusMessage
			|| fetchError.data?.message
			|| fetchError.statusMessage
			|| fallback
		);
	}
</script>
