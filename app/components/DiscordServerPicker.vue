<template>
	<div
		ref="pickerElement"
		class="server-picker"
	>
		<button
			ref="triggerElement"
			class="server-picker__trigger"
			type="button"
			aria-haspopup="listbox"
			:aria-label="triggerAccessibleName"
			:aria-expanded="pickerOpen"
			:aria-controls="listboxId"
			@click="togglePicker"
			@keydown.down.prevent="openPicker"
			@keydown.up.prevent="openPicker"
			@keydown.esc.prevent="closePicker"
		>
			<span class="server-picker__selection">
				<template v-if="selectedGuild">
					<img
						v-if="selectedGuild.iconURL"
						:src="selectedGuild.iconURL"
						alt=""
					/>
					<span
						v-else
						class="server-picker__icon server-picker__icon--fallback"
					>
						{{ getInitials(selectedGuild.name) }}
					</span>
					<span class="server-picker__identity">
						<strong>{{ selectedGuild.name }}</strong>
						<small>{{ memberCountLabel(selectedGuild) }}</small>
					</span>
				</template>
				<template v-else>
					<span
						class="server-picker__icon server-picker__icon--fallback"
					>
						<span class="material-symbols-outlined">dns</span>
					</span>
					<span class="server-picker__placeholder"
						>Choose a server</span
					>
				</template>
			</span>
			<span class="material-symbols-outlined server-picker__chevron"
				>expand_more</span
			>
		</button>

		<div
			v-if="pickerOpen"
			class="server-picker__menu"
		>
			<label
				v-if="guilds.length > 5"
				class="server-picker__search"
			>
				<span class="material-symbols-outlined">search</span>
				<span class="visually-hidden">Search servers</span>
				<input
					ref="searchElement"
					v-model="searchQuery"
					type="search"
					placeholder="Search servers…"
					autocomplete="off"
					:aria-controls="listboxId"
					@keydown.down.prevent="moveHighlight(1)"
					@keydown.up.prevent="moveHighlight(-1)"
					@keydown.enter.prevent="selectHighlightedGuild"
					@keydown.esc.prevent="closePicker(true)"
				/>
			</label>
			<div
				:id="listboxId"
				ref="listElement"
				class="server-picker__list"
				role="listbox"
				tabindex="-1"
				@keydown.down.prevent="moveHighlight(1)"
				@keydown.up.prevent="moveHighlight(-1)"
				@keydown.enter.prevent="selectHighlightedGuild"
				@keydown.esc.prevent="closePicker(true)"
			>
				<div
					v-if="filteredGuilds.length === 0"
					class="server-picker__status"
				>
					No servers match “{{ searchQuery }}”.
				</div>
				<button
					v-for="(guild, guildIndex) in filteredGuilds"
					v-else
					:key="guild.id"
					class="server-picker__option"
					:class="{
						'is-highlighted': guildIndex === highlightedIndex,
					}"
					type="button"
					role="option"
					:aria-selected="guild.id === model"
					@mouseenter="highlightedIndex = guildIndex"
					@click="selectGuild(guild)"
				>
					<img
						v-if="guild.iconURL"
						:src="guild.iconURL"
						alt=""
					/>
					<span
						v-else
						class="server-picker__icon server-picker__icon--fallback"
					>
						{{ getInitials(guild.name) }}
					</span>
					<span class="server-picker__identity">
						<strong>{{ guild.name }}</strong>
						<small>{{ memberCountLabel(guild) }}</small>
					</span>
					<span
						v-if="guild.id === model"
						class="material-symbols-outlined server-picker__check"
					>
						check
					</span>
				</button>
			</div>
			<button
				v-if="model"
				class="server-picker__all"
				type="button"
				@click="selectAllServers"
			>
				<span class="material-symbols-outlined">grid_view</span>
				View all servers
			</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
	const props = defineProps<{ guilds: ManagedGuildSummary[] }>();
	const model = defineModel<string>({ default: '' });
	const pickerElement = ref<HTMLElement | null>(null);
	const triggerElement = ref<HTMLButtonElement | null>(null);
	const searchElement = ref<HTMLInputElement | null>(null);
	const listElement = ref<HTMLElement | null>(null);
	const pickerOpen = ref(false);
	const searchQuery = ref('');
	const highlightedIndex = ref(0);
	const listboxId = useId();

	const selectedGuild = computed(
		() => props.guilds.find((guild) => guild.id === model.value) ?? null,
	);
	const filteredGuilds = computed(() => {
		const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase();
		if (!normalizedQuery) {
			return props.guilds;
		}
		return props.guilds.filter((guild) =>
			guild.name.toLocaleLowerCase().includes(normalizedQuery),
		);
	});
	const triggerAccessibleName = computed(() =>
		selectedGuild.value ?
			`Managing server: ${selectedGuild.value.name}`
		:	'Choose a server to manage',
	);

	watch(filteredGuilds, () => {
		highlightedIndex.value = 0;
	});

	onMounted(() => {
		document.addEventListener('pointerdown', handleOutsidePointerDown);
	});

	onBeforeUnmount(() => {
		document.removeEventListener('pointerdown', handleOutsidePointerDown);
	});

	function togglePicker() {
		if (pickerOpen.value) {
			closePicker();
			return;
		}
		openPicker();
	}

	function openPicker() {
		pickerOpen.value = true;
		searchQuery.value = '';
		highlightedIndex.value = Math.max(
			0,
			props.guilds.findIndex((guild) => guild.id === model.value),
		);
		void nextTick(() => {
			(searchElement.value ?? listElement.value)?.focus();
		});
	}

	function closePicker(focusTrigger = false) {
		pickerOpen.value = false;
		if (focusTrigger) {
			void nextTick(() => triggerElement.value?.focus());
		}
	}

	function selectGuild(guild: ManagedGuildSummary) {
		model.value = guild.id;
		closePicker(true);
	}

	function selectAllServers() {
		model.value = '';
		closePicker(true);
	}

	function moveHighlight(direction: number) {
		const guildCount = filteredGuilds.value.length;
		if (guildCount === 0) {
			return;
		}
		highlightedIndex.value =
			(highlightedIndex.value + direction + guildCount) % guildCount;
	}

	function selectHighlightedGuild() {
		const highlightedGuild = filteredGuilds.value[highlightedIndex.value];
		if (highlightedGuild) {
			selectGuild(highlightedGuild);
		}
	}

	function handleOutsidePointerDown(event: PointerEvent) {
		if (!pickerElement.value?.contains(event.target as Node)) {
			closePicker();
		}
	}

	function memberCountLabel(guild: ManagedGuildSummary) {
		return guild.memberCount === null ?
				'Server details unavailable'
			:	`${guild.memberCount.toLocaleString()} members`;
	}

	function getInitials(name: string) {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((namePart) => namePart[0])
			.join('')
			.toLocaleUpperCase();
	}
</script>
