import type { Guild } from 'discord.js';
import { createError } from 'h3';

const MEMBER_CACHE_DURATION_MILLISECONDS = 2 * 60 * 1000;

interface DiscordMemberCacheState {
	reuseCacheUntilByGuild: Map<string, number>;
	refreshRequestByGuild: Map<string, Promise<void>>;
}

const memberCacheStateKey = Symbol.for(
	'discord-awbw-notifier.member-cache-state',
);
const globalState = globalThis as typeof globalThis & {
	[memberCacheStateKey]?: DiscordMemberCacheState;
};
const cacheState = (globalState[memberCacheStateKey] ??= {
	reuseCacheUntilByGuild: new Map<string, number>(),
	refreshRequestByGuild: new Map<string, Promise<void>>(),
});

export async function getGuildMembersWithCache(guild: Guild) {
	const reuseCacheUntil =
		cacheState.reuseCacheUntilByGuild.get(guild.id) ?? 0;
	if (reuseCacheUntil > Date.now()) {
		return guild.members.cache;
	}

	const activeRefreshRequest = cacheState.refreshRequestByGuild.get(guild.id);
	if (activeRefreshRequest) {
		await activeRefreshRequest;
		return guild.members.cache;
	}

	const refreshRequest = refreshGuildMemberCache(guild);
	cacheState.refreshRequestByGuild.set(guild.id, refreshRequest);
	try {
		await refreshRequest;
	} finally {
		if (cacheState.refreshRequestByGuild.get(guild.id) === refreshRequest) {
			cacheState.refreshRequestByGuild.delete(guild.id);
		}
	}
	return guild.members.cache;
}

async function refreshGuildMemberCache(guild: Guild) {
	try {
		await guild.members.fetch();
		markGuildMemberCacheReusable(guild.id);
	} catch (error: unknown) {
		if (isGatewayRateLimitError(error)) {
			markGuildMemberCacheReusable(guild.id);
			console.warn(
				'Discord member fetch was rate limited; using cached members.',
				{
					guildId: guild.id,
					cachedMemberCount: guild.members.cache.size,
				},
			);
			return;
		}

		throw createError({
			statusCode: 502,
			statusMessage:
				'Discord members could not be loaded for this server.',
			cause: error,
		});
	}
}

function markGuildMemberCacheReusable(guildId: string) {
	cacheState.reuseCacheUntilByGuild.set(
		guildId,
		Date.now() + MEMBER_CACHE_DURATION_MILLISECONDS,
	);
}

function isGatewayRateLimitError(error: unknown) {
	return error instanceof Error && error.name === 'GatewayRateLimitError';
}
