export interface DiscordUserSummary {
	id: string;
	username: string;
	displayName: string;
	avatarURL: string | null;
}

export interface AuthSessionResponse {
	authenticated: boolean;
	user: DiscordUserSummary | null;
}

export interface ManagedGuildSummary {
	id: string;
	name: string;
	iconURL: string | null;
	memberCount: number | null;
}

export interface GuildChannelSummary {
	id: string;
	name: string;
}

export interface GuildChannelGroupSummary {
	id: string | null;
	name: string | null;
	channels: GuildChannelSummary[];
}

export interface DiscordGuildMemberSummary {
	id: string;
	username: string;
	displayName: string;
	avatarURL: string | null;
	bot: boolean;
}

export interface DiscordGuildMembersResponse {
	members: DiscordGuildMemberSummary[];
}

export interface AWBWGameSubscription {
	id: string;
	gameId: string;
	gameName?: string;
	gameUrl: string;
	awbwUsername: string;
	discordUserId: string;
	channelId: string;
	playerId?: string;
	playerIds?: string[];
	lastNotifiedTurn?: string | number | null;
	channelName?: string | null;
	discordUserDisplayName?: string | null;
}

export interface GuildGameSubscriptionsResponse {
	guild: ManagedGuildSummary;
	subscriptions: AWBWGameSubscription[];
	channelGroups: GuildChannelGroupSummary[];
}

export interface CreateAWBWGameSubscriptionInput {
	gameUrl: string;
	awbwUsername: string;
	channelId: string;
	discordUserId?: string;
}
