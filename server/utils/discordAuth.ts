import type {
	DiscordUserSummary,
	ManagedGuildSummary,
} from '#shared/types/dashboard';
import {
	type H3Event,
	createError,
	getHeader,
	getRequestURL,
	useSession,
} from 'h3';
import type { Guild } from 'discord.js';
import { getDiscordBotClient } from '../discord/index.js';

const DISCORD_API_URL = 'https://discord.com/api/v10';
const MANAGE_GUILD_PERMISSION = 1n << 5n;
const ADMINISTRATOR_PERMISSION = 1n << 3n;
const MANAGED_GUILD_GRANT_DURATION_MILLISECONDS = 10 * 60 * 1000;
const MANAGED_GUILD_CACHE_DURATION_MILLISECONDS = 5 * 1000;
const MAX_DISCORD_RATE_LIMIT_RETRY_MILLISECONDS = 60 * 1000;

interface ManagedGuildGrantState {
	expiresAtByUserAndGuild: Map<string, number>;
}

const managedGuildGrantStateKey = Symbol.for(
	'discord-awbw-notifier.managed-guild-grants',
);
const globalState = globalThis as typeof globalThis & {
	[managedGuildGrantStateKey]?: ManagedGuildGrantState;
};
const managedGuildGrantState = (globalState[managedGuildGrantStateKey] ??= {
	expiresAtByUserAndGuild: new Map<string, number>(),
});

interface DiscordOAuthToken {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
}

interface DiscordUser {
	id: string;
	username: string;
	global_name: string | null;
	avatar: string | null;
}

interface DiscordGuild {
	id: string;
	name: string;
	icon: string | null;
	owner: boolean;
	permissions: string;
}

interface CachedDiscordGuilds {
	expiresAt: number;
	guilds: DiscordGuild[];
}

interface ManagedGuildRequestState {
	cacheByUserId: Map<string, CachedDiscordGuilds>;
	inFlightByUserId: Map<string, Promise<DiscordGuild[]>>;
}

interface DiscordErrorResponse {
	code?: number | string;
	message?: string;
	retry_after?: number;
}

const managedGuildRequestStateKey = Symbol.for(
	'discord-awbw-notifier.managed-guild-requests',
);
const managedGuildRequestGlobal = globalThis as typeof globalThis & {
	[managedGuildRequestStateKey]?: ManagedGuildRequestState;
};
const managedGuildRequestState = (managedGuildRequestGlobal[
	managedGuildRequestStateKey
] ??= {
	cacheByUserId: new Map<string, CachedDiscordGuilds>(),
	inFlightByUserId: new Map<string, Promise<DiscordGuild[]>>(),
});

export interface DiscordAuthSession {
	oauthState?: string;
	returnTo?: string;
	accessToken?: string;
	refreshToken?: string;
	tokenExpiresAt?: number;
	user?: DiscordUserSummary;
}

function getSessionPassword() {
	const password =
		process.env.SESSION_PASSWORD
		?? (process.env.NODE_ENV !== 'production' ?
			process.env.DISCORD_TOKEN
		:	undefined);
	if (!password || password.length < 32) {
		throw createError({
			statusCode: 500,
			statusMessage:
				'SESSION_PASSWORD must be configured with at least 32 characters.',
		});
	}
	return password;
}

export function useDiscordAuthSession(event: H3Event) {
	return useSession<DiscordAuthSession>(event, {
		name: 'awbw-dashboard',
		password: getSessionPassword(),
		maxAge: 60 * 60 * 24 * 30,
		cookie: {
			httpOnly: true,
			secure: getRequestURL(event).protocol === 'https:',
			sameSite: 'lax',
			path: '/',
		},
	});
}

function getOAuthCredentials() {
	const applicationId = process.env.DISCORD_APPLICATION_ID;
	const clientSecret = process.env.DISCORD_CLIENT_SECRET;
	if (!applicationId || !clientSecret) {
		throw createError({
			statusCode: 500,
			statusMessage:
				'Discord OAuth requires DISCORD_APPLICATION_ID and DISCORD_CLIENT_SECRET.',
		});
	}
	return { applicationId, clientSecret };
}

export function getDiscordRedirectURI(event: H3Event) {
	return (
		process.env.DISCORD_REDIRECT_URI
		?? `${getRequestURL(event).origin}/api/auth/discord/callback`
	);
}

export function getSafeReturnTo(value: unknown, fallback = '/dashboard') {
	return (
			typeof value === 'string'
				&& value.startsWith('/')
				&& !value.startsWith('//')
		) ?
			value
		:	fallback;
}

async function requestDiscord<Type>(
	path: string,
	accessToken: string,
	rateLimitRetryCount = 0,
): Promise<Type> {
	const response = await fetch(`${DISCORD_API_URL}${path}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok) {
		const errorResponse = await readDiscordErrorResponse(response);
		const retryAfterMilliseconds = getRetryAfterMilliseconds(
			response,
			errorResponse,
		);
		if (
			response.status === 429
			&& rateLimitRetryCount === 0
			&& retryAfterMilliseconds
				<= MAX_DISCORD_RATE_LIMIT_RETRY_MILLISECONDS
		) {
			console.warn('Discord API request was rate limited; retrying', {
				path,
				retryAfterMilliseconds,
			});
			await waitFor(retryAfterMilliseconds);
			return requestDiscord<Type>(
				path,
				accessToken,
				rateLimitRetryCount + 1,
			);
		}
		console.error('Discord API request failed', {
			path,
			status: response.status,
			statusText: response.statusText,
			discordCode: errorResponse?.code,
			discordMessage: errorResponse?.message,
			retryAfterMilliseconds:
				response.status === 429 ? retryAfterMilliseconds : undefined,
		});
		throw createError({
			statusCode: response.status === 401 ? 401 : 502,
			statusMessage: 'Discord could not complete the request.',
		});
	}
	return (await response.json()) as Type;
}

async function readDiscordErrorResponse(response: Response) {
	const responseBody = await response.text();
	if (!responseBody) {
		return null;
	}
	try {
		return JSON.parse(responseBody) as DiscordErrorResponse;
	} catch {
		return null;
	}
}

function getRetryAfterMilliseconds(
	response: Response,
	errorResponse: DiscordErrorResponse | null,
) {
	const retryAfterSeconds = Number.parseFloat(
		response.headers.get('retry-after')
			?? response.headers.get('x-ratelimit-reset-after')
			?? '',
	);
	const fallbackRetryAfterSeconds = errorResponse?.retry_after;
	const delaySeconds =
		Number.isFinite(retryAfterSeconds) ? retryAfterSeconds
		: typeof fallbackRetryAfterSeconds === 'number' ?
			fallbackRetryAfterSeconds
		:	1;
	return Math.max(0, Math.ceil(delaySeconds * 1000));
}

function waitFor(milliseconds: number) {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}

function getDiscordGuildsForUser(
	userId: string,
	accessToken: string,
	allowCachedGuilds: boolean,
) {
	const now = Date.now();
	for (const [
		cachedUserId,
		cachedGuilds,
	] of managedGuildRequestState.cacheByUserId) {
		if (cachedGuilds.expiresAt <= now) {
			managedGuildRequestState.cacheByUserId.delete(cachedUserId);
		}
	}
	const cachedGuilds = managedGuildRequestState.cacheByUserId.get(userId);
	if (allowCachedGuilds && cachedGuilds) {
		return Promise.resolve(cachedGuilds.guilds);
	}

	const inFlightRequest =
		managedGuildRequestState.inFlightByUserId.get(userId);
	if (inFlightRequest) {
		return inFlightRequest;
	}

	const request = requestDiscord<DiscordGuild[]>(
		'/users/@me/guilds',
		accessToken,
	)
		.then((guilds) => {
			managedGuildRequestState.cacheByUserId.set(userId, {
				expiresAt:
					Date.now() + MANAGED_GUILD_CACHE_DURATION_MILLISECONDS,
				guilds,
			});
			return guilds;
		})
		.finally(() => {
			managedGuildRequestState.inFlightByUserId.delete(userId);
		});
	managedGuildRequestState.inFlightByUserId.set(userId, request);
	return request;
}

async function requestToken(body: URLSearchParams) {
	const { applicationId, clientSecret } = getOAuthCredentials();
	body.set('client_id', applicationId);
	body.set('client_secret', clientSecret);

	const response = await fetch(`${DISCORD_API_URL}/oauth2/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	});
	if (!response.ok) {
		throw createError({
			statusCode: 502,
			statusMessage: 'Discord sign-in could not be completed.',
		});
	}
	return (await response.json()) as DiscordOAuthToken;
}

export function exchangeDiscordCode(code: string, redirectURI: string) {
	return requestToken(
		new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectURI,
		}),
	);
}

function toUserSummary(user: DiscordUser): DiscordUserSummary {
	return {
		id: user.id,
		username: user.username,
		displayName: user.global_name ?? user.username,
		avatarURL:
			user.avatar ?
				`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
			:	null,
	};
}

export async function getDiscordUser(accessToken: string) {
	const user = await requestDiscord<DiscordUser>('/users/@me', accessToken);
	return toUserSummary(user);
}

async function refreshDiscordToken(event: H3Event) {
	const session = await useDiscordAuthSession(event);
	if (!session.data.refreshToken) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Sign in required.',
		});
	}
	const token = await requestToken(
		new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: session.data.refreshToken,
		}),
	);
	await session.update({
		accessToken: token.access_token,
		refreshToken: token.refresh_token,
		tokenExpiresAt: Date.now() + token.expires_in * 1000,
	});
	return token.access_token;
}

export async function requireDiscordAccessToken(event: H3Event) {
	const session = await useDiscordAuthSession(event);
	if (!session.data.user || !session.data.accessToken) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Sign in required.',
		});
	}
	if ((session.data.tokenExpiresAt ?? 0) <= Date.now() + 60_000) {
		return refreshDiscordToken(event);
	}
	return session.data.accessToken;
}

function canManageGuild(guild: DiscordGuild) {
	const permissions = BigInt(guild.permissions);
	return (
		guild.owner
		|| (permissions & MANAGE_GUILD_PERMISSION) !== 0n
		|| (permissions & ADMINISTRATOR_PERMISSION) !== 0n
	);
}

function createManagedGuildSummary(guild: Guild): ManagedGuildSummary {
	return {
		id: guild.id,
		name: guild.name,
		iconURL: guild.iconURL({ size: 128 }),
		memberCount: guild.memberCount,
	};
}

export async function getManagedGuilds(
	event: H3Event,
	allowCachedGuilds = true,
) {
	const accessToken = await requireDiscordAccessToken(event);
	const session = await useDiscordAuthSession(event);
	const userId = session.data.user?.id;
	if (!userId) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Sign in required.',
		});
	}
	const discordGuilds = await getDiscordGuildsForUser(
		userId,
		accessToken,
		allowCachedGuilds,
	);
	const client = await getDiscordBotClient();

	const managedGuilds = discordGuilds
		.filter(
			(guild) =>
				canManageGuild(guild) && client.guilds.cache.has(guild.id),
		)
		.map<ManagedGuildSummary>((guild) => {
			const botGuild = client.guilds.cache.get(guild.id);
			return {
				id: guild.id,
				name: guild.name,
				iconURL:
					guild.icon ?
						`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
					:	null,
				memberCount: botGuild?.memberCount ?? null,
			};
		});
	for (const guild of managedGuilds) {
		grantTemporaryGuildAccess(userId, guild.id);
	}
	return managedGuilds;
}

export async function requireManagedGuild(event: H3Event, guildId: string) {
	const managedGuilds = await getManagedGuilds(event, false);
	const guildSummary = managedGuilds.find((guild) => guild.id === guildId);
	if (!guildSummary) {
		throw createError({
			statusCode: 403,
			statusMessage: 'You cannot manage this Discord server.',
		});
	}
	const client = await getDiscordBotClient();
	const guild = client.guilds.cache.get(guildId);
	if (!guild) {
		throw createError({
			statusCode: 404,
			statusMessage: 'The bot is not installed in this server.',
		});
	}
	const session = await useDiscordAuthSession(event);
	if (session.data.user) {
		grantTemporaryGuildAccess(session.data.user.id, guildId);
	}
	return { client, guild, guildSummary };
}

export async function requireRecentlyAuthorizedGuild(
	event: H3Event,
	guildId: string,
) {
	const session = await useDiscordAuthSession(event);
	const user = session.data.user;
	if (!user) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Sign in required.',
		});
	}

	if (!hasTemporaryGuildAccess(user.id, guildId)) {
		return requireManagedGuild(event, guildId);
	}

	const client = await getDiscordBotClient();
	const guild = client.guilds.cache.get(guildId);
	if (!guild) {
		throw createError({
			statusCode: 404,
			statusMessage: 'The bot is not installed in this server.',
		});
	}
	return {
		client,
		guild,
		guildSummary: createManagedGuildSummary(guild),
	};
}

function grantTemporaryGuildAccess(userId: string, guildId: string) {
	const now = Date.now();
	for (const [
		grantKey,
		expiresAt,
	] of managedGuildGrantState.expiresAtByUserAndGuild) {
		if (expiresAt <= now) {
			managedGuildGrantState.expiresAtByUserAndGuild.delete(grantKey);
		}
	}
	managedGuildGrantState.expiresAtByUserAndGuild.set(
		createManagedGuildGrantKey(userId, guildId),
		now + MANAGED_GUILD_GRANT_DURATION_MILLISECONDS,
	);
}

function hasTemporaryGuildAccess(userId: string, guildId: string) {
	const grantKey = createManagedGuildGrantKey(userId, guildId);
	const expiresAt =
		managedGuildGrantState.expiresAtByUserAndGuild.get(grantKey) ?? 0;
	if (expiresAt <= Date.now()) {
		managedGuildGrantState.expiresAtByUserAndGuild.delete(grantKey);
		return false;
	}
	return true;
}

function createManagedGuildGrantKey(userId: string, guildId: string) {
	return `${userId}:${guildId}`;
}

export function assertSameOrigin(event: H3Event) {
	const origin = getHeader(event, 'origin');
	if (origin && origin !== getRequestURL(event).origin) {
		throw createError({
			statusCode: 403,
			statusMessage: 'Invalid request origin.',
		});
	}
}
