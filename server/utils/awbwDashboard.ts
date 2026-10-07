import {
	type CategoryChannel,
	ChannelType,
	type Guild,
	PermissionFlagsBits,
	type TextChannel,
} from 'discord.js';
import type {
	GuildChannelGroupSummary,
	ManagedGuildSummary,
} from '#shared/types/dashboard';
import { type H3Event, createError, getRouterParam, readBody } from 'h3';
import { requireManagedGuild, useDiscordAuthSession } from './discordAuth.js';

const DISCORD_SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const MAXIMUM_AWBW_USERNAME_LENGTH = 64;

interface AwbwSubscriptionInput {
	gameUrl: string;
	awbwUsername: string;
	channelId: string;
	discordUserId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireGuildId(event: H3Event) {
	const guildId = getRouterParam(event, 'guildId');
	if (!guildId) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Missing server ID.',
		});
	}
	return guildId;
}

export async function getAwbwGuildContext(event: H3Event) {
	const guildId = requireGuildId(event);
	const context = await requireManagedGuild(event, guildId);
	return {
		...context,
		manager: context.client.singletons.awbw,
	};
}

export async function readAwbwSubscriptionInput(event: H3Event) {
	const body = await readBody<unknown>(event);
	if (!isRecord(body)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid signup.',
		});
	}

	const awbwUsername =
		typeof body.awbwUsername === 'string' ? body.awbwUsername.trim() : '';
	if (
		!awbwUsername
		|| awbwUsername.length > MAXIMUM_AWBW_USERNAME_LENGTH
		|| /[\u0000-\u001f\u007f]/u.test(awbwUsername)
	) {
		throw createError({
			statusCode: 400,
			statusMessage: `AWBW username must be between 1 and ${MAXIMUM_AWBW_USERNAME_LENGTH} characters.`,
		});
	}

	const gameUrl = normalizeAwbwGameUrl(body.gameUrl);
	const channelId = requireSnowflake(
		body.channelId,
		'Choose a valid channel.',
	);
	const session = await useDiscordAuthSession(event);
	const discordUserId =
		body.discordUserId === undefined ?
			session.data.user?.id
		:	requireSnowflake(body.discordUserId, 'Choose a valid Discord user.');
	if (!discordUserId) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Sign in required.',
		});
	}

	return {
		gameUrl,
		awbwUsername,
		channelId,
		discordUserId,
	} satisfies AwbwSubscriptionInput;
}

function requireSnowflake(value: unknown, errorMessage: string) {
	if (typeof value !== 'string' || !DISCORD_SNOWFLAKE_PATTERN.test(value)) {
		throw createError({ statusCode: 400, statusMessage: errorMessage });
	}
	return value;
}

function normalizeAwbwGameUrl(value: unknown) {
	if (typeof value !== 'string' || value.length > 2048) {
		throw invalidGameUrl();
	}

	let gameUrl: URL;
	try {
		gameUrl = new URL(value);
	} catch {
		throw invalidGameUrl();
	}

	const gameIds = gameUrl.searchParams.getAll('games_id');
	const gameId = gameIds[0];
	if (
		gameUrl.protocol !== 'https:'
		|| gameUrl.hostname.toLowerCase() !== 'awbw.amarriner.com'
		|| gameUrl.port
		|| gameUrl.username
		|| gameUrl.password
		|| gameUrl.pathname !== '/game.php'
		|| gameIds.length !== 1
		|| !gameId
		|| !/^[1-9]\d{0,19}$/.test(gameId)
	) {
		throw invalidGameUrl();
	}

	return `https://awbw.amarriner.com/game.php?games_id=${gameId}`;
}

function invalidGameUrl() {
	return createError({
		statusCode: 400,
		statusMessage:
			'Enter a valid AWBW game link, such as https://awbw.amarriner.com/game.php?games_id=1741266.',
	});
}

export async function assertSubscriptionChannelIsUsable(
	guild: Guild,
	channelId: string,
) {
	const channel =
		guild.channels.cache.get(channelId)
		?? (await guild.channels.fetch(channelId).catch(() => null));
	if (!channel || channel.type !== ChannelType.GuildText) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Choose a text channel in this server.',
		});
	}

	const botMember = guild.members.me;
	if (!botMember) {
		throw createError({
			statusCode: 403,
			statusMessage: 'The bot cannot access that channel.',
		});
	}
	if (
		!channel
			.permissionsFor(botMember)
			.has([
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ReadMessageHistory,
			])
	) {
		throw createError({
			statusCode: 403,
			statusMessage:
				'The bot needs permission to view, read, and send messages in that channel.',
		});
	}
	return channel;
}

export async function assertSubscriptionUserIsInGuild(
	guild: Guild,
	discordUserId: string,
) {
	const member =
		guild.members.cache.get(discordUserId)
		?? (await guild.members.fetch(discordUserId).catch(() => null));
	if (!member || member.user.bot) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Choose a human member of this server.',
		});
	}
	return member;
}

export async function createAwbwSubscriptionsResponse(
	guild: Guild,
	guildSummary: ManagedGuildSummary,
) {
	await guild.client.singletons.awbw.ensureGameNames(guild.id);
	const subscriptions = guild.client.singletons.awbw
		.listSubscriptions(guild.id)
		.map((subscription) => ({
			...subscription,
			channelName:
				guild.channels.cache.get(subscription.channelId)?.name ?? null,
			discordUserDisplayName:
				guild.members.cache.get(subscription.discordUserId)?.displayName
				?? null,
		}));

	return {
		guild: guildSummary,
		subscriptions,
		channelGroups: createChannelGroups(guild),
	};
}

function createChannelGroups(guild: Guild): GuildChannelGroupSummary[] {
	const channels = [...guild.channels.cache.values()];
	const botMember = guild.members.me;
	const usableChannels = channels.filter(
		(channel): channel is TextChannel => {
			if (channel.type !== ChannelType.GuildText || !botMember) {
				return false;
			}
			return channel
				.permissionsFor(botMember)
				.has([
					PermissionFlagsBits.ViewChannel,
					PermissionFlagsBits.SendMessages,
					PermissionFlagsBits.ReadMessageHistory,
				]);
		},
	);
	const sortChannelsByPosition = (
		firstChannel: TextChannel,
		secondChannel: TextChannel,
	) => firstChannel.rawPosition - secondChannel.rawPosition;
	const summarizeChannel = (channel: TextChannel) => ({
		id: channel.id,
		name: channel.name,
	});
	const uncategorizedChannels = usableChannels
		.filter((channel) => channel.parentId === null)
		.sort(sortChannelsByPosition)
		.map(summarizeChannel);
	const categorizedChannelGroups = channels
		.filter(
			(channel): channel is CategoryChannel =>
				channel.type === ChannelType.GuildCategory,
		)
		.sort(
			(firstCategory, secondCategory) =>
				firstCategory.rawPosition - secondCategory.rawPosition,
		)
		.map((category) => ({
			id: category.id,
			name: category.name,
			channels: usableChannels
				.filter((channel) => channel.parentId === category.id)
				.sort(sortChannelsByPosition)
				.map(summarizeChannel),
		}))
		.filter((category) => category.channels.length > 0);

	return [
		...(uncategorizedChannels.length > 0 ?
			[
				{
					id: null,
					name: null,
					channels: uncategorizedChannels,
				},
			]
		:	[]),
		...categorizedChannelGroups,
	];
}
