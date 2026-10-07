<template>
	<div
		ref="pickerElement"
		class="member-picker"
	>
		<button
			ref="triggerElement"
			class="member-picker__trigger form-control"
			type="button"
			aria-haspopup="listbox"
			:aria-label="triggerAccessibleName"
			:aria-expanded="pickerOpen"
			:aria-controls="listboxId"
			@click="togglePicker"
		>
			<span
				v-if="selectedMember"
				class="member-picker__selected"
			>
				<img
					v-if="selectedMember.avatarURL"
					:src="selectedMember.avatarURL"
					alt=""
				/>
				<span
					v-else
					class="member-picker__avatar member-picker__avatar--fallback"
				>
					{{ getInitials(selectedMember.displayName) }}
				</span>
				<span>
					<strong>{{ selectedMember.displayName }}</strong>
					<small>@{{ selectedMember.username }}</small>
				</span>
			</span>
			<span
				v-else-if="model"
				class="member-picker__selected"
			>
				<span
					class="member-picker__avatar member-picker__avatar--fallback"
				>
					<span class="material-symbols-outlined">person</span>
				</span>
				<span>
					<strong>Unknown server member</strong>
					<small>{{ model }}</small>
				</span>
			</span>
			<span
				v-else
				class="member-picker__placeholder"
				>Choose a server member</span
			>
			<span class="material-symbols-outlined member-picker__chevron"
				>expand_more</span
			>
		</button>

		<div
			v-if="pickerOpen"
			class="member-picker__menu"
		>
			<label class="member-picker__search">
				<span class="material-symbols-outlined">search</span>
				<span class="visually-hidden">Search server members</span>
				<input
					ref="searchElement"
					v-model="searchQuery"
					type="search"
					placeholder="Search by name or username…"
					autocomplete="off"
					:aria-controls="listboxId"
					@keydown.down.prevent="moveHighlightedMember(1)"
					@keydown.up.prevent="moveHighlightedMember(-1)"
					@keydown.enter.prevent="selectHighlightedMember"
					@keydown.esc.prevent="closePicker(true)"
				/>
			</label>

			<div
				:id="listboxId"
				class="member-picker__list"
				role="listbox"
			>
				<div
					v-if="loading"
					class="member-picker__status"
				>
					<span class="spinner-border spinner-border-sm"></span>
					Loading server members…
				</div>
				<div
					v-else-if="loadErrorMessage"
					class="member-picker__status is-error"
				>
					{{ loadErrorMessage }}
				</div>
				<div
					v-else-if="filteredMembers.length === 0"
					class="member-picker__status"
				>
					No server members match “{{ searchQuery }}”.
				</div>
				<button
					v-for="(member, memberIndex) in filteredMembers"
					v-else
					:key="member.id"
					class="member-picker__option"
					:class="{
						'is-highlighted':
							memberIndex === highlightedMemberIndex,
					}"
					type="button"
					role="option"
					:aria-selected="member.id === model"
					@mouseenter="highlightedMemberIndex = memberIndex"
					@click="selectMember(member)"
				>
					<img
						v-if="member.avatarURL"
						:src="member.avatarURL"
						alt=""
					/>
					<span
						v-else
						class="member-picker__avatar member-picker__avatar--fallback"
					>
						{{ getInitials(member.displayName) }}
					</span>
					<span class="member-picker__identity">
						<span>
							<strong>{{ member.displayName }}</strong>
							<span
								v-if="member.bot"
								class="member-picker__bot-badge"
								>Bot</span
							>
						</span>
						<small>@{{ member.username }}</small>
					</span>
					<span
						v-if="member.id === model"
						class="material-symbols-outlined member-picker__check"
					>
						check
					</span>
				</button>
			</div>

			<button
				v-if="model"
				class="member-picker__clear"
				type="button"
				@click="clearSelection"
			>
				<span class="material-symbols-outlined">person_off</span>
				Remove Discord user
			</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
	const props = defineProps<{ guildId: string }>();
	const model = defineModel<string>({ default: '' });
	const pickerElement = ref<HTMLElement | null>(null);
	const triggerElement = ref<HTMLButtonElement | null>(null);
	const searchElement = ref<HTMLInputElement | null>(null);
	const members = ref<DiscordGuildMemberSummary[]>([]);
	const pickerOpen = ref(false);
	const searchQuery = ref('');
	const loading = ref(true);
	const loadErrorMessage = ref('');
	const highlightedMemberIndex = ref(0);
	const listboxId = useId();

	const selectedMember = computed(
		() => members.value.find((member) => member.id === model.value) ?? null,
	);

	const triggerAccessibleName = computed(() =>
		selectedMember.value ?
			`Discord user: ${selectedMember.value.displayName}, @${selectedMember.value.username}`
		:	'Choose a Discord user',
	);

	const filteredMembers = computed(() => {
		const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase();
		if (!normalizedQuery) {
			return members.value;
		}
		return members.value.filter(
			(member) =>
				member.displayName.toLocaleLowerCase().includes(normalizedQuery)
				|| member.username.toLocaleLowerCase().includes(normalizedQuery)
				|| member.id.includes(normalizedQuery),
		);
	});

	watch(filteredMembers, () => {
		highlightedMemberIndex.value = 0;
	});

	onMounted(() => {
		void loadMembers();
		document.addEventListener('pointerdown', handleOutsidePointerDown);
	});

	onBeforeUnmount(() => {
		document.removeEventListener('pointerdown', handleOutsidePointerDown);
	});

	async function loadMembers() {
		loading.value = true;
		loadErrorMessage.value = '';
		try {
			const response = await $fetch<DiscordGuildMembersResponse>(
				`/api/guilds/${props.guildId}/members`,
			);
			members.value = response.members;
		} catch {
			loadErrorMessage.value = 'Server members could not be loaded.';
		} finally {
			loading.value = false;
		}
	}

	function togglePicker() {
		pickerOpen.value = !pickerOpen.value;
		if (pickerOpen.value) {
			searchQuery.value = '';
			highlightedMemberIndex.value = Math.max(
				0,
				members.value.findIndex((member) => member.id === model.value),
			);
			void nextTick(() => searchElement.value?.focus());
		}
	}

	function closePicker(focusTrigger = false) {
		pickerOpen.value = false;
		if (focusTrigger) {
			void nextTick(() => triggerElement.value?.focus());
		}
	}

	function selectMember(member: DiscordGuildMemberSummary) {
		model.value = member.id;
		closePicker(true);
	}

	function clearSelection() {
		model.value = '';
		closePicker(true);
	}

	function moveHighlightedMember(direction: number) {
		const memberCount = filteredMembers.value.length;
		if (memberCount === 0) {
			return;
		}
		highlightedMemberIndex.value =
			(highlightedMemberIndex.value + direction + memberCount)
			% memberCount;
	}

	function selectHighlightedMember() {
		const highlightedMember =
			filteredMembers.value[highlightedMemberIndex.value];
		if (highlightedMember) {
			selectMember(highlightedMember);
		}
	}

	function handleOutsidePointerDown(event: PointerEvent) {
		if (!pickerElement.value?.contains(event.target as Node)) {
			closePicker();
		}
	}

	function getInitials(displayName: string) {
		return displayName
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((namePart) => namePart[0])
			.join('')
			.toLocaleUpperCase();
	}
</script>
