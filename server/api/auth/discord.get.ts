import {
	getDiscordRedirectURI,
	getSafeReturnTo,
	useDiscordAuthSession,
} from '../../utils/discordAuth.js';
import { getQuery, sendRedirect } from 'h3';
import { randomUUID } from 'node:crypto';

export default defineEventHandler(async (event) => {
	const applicationId = process.env.DISCORD_APPLICATION_ID;
	if (!applicationId) {
		throw createError({
			statusCode: 500,
			statusMessage: 'DISCORD_APPLICATION_ID is not configured.',
		});
	}
	const state = randomUUID();
	const session = await useDiscordAuthSession(event);
	await session.update({
		oauthState: state,
		returnTo: getSafeReturnTo(getQuery(event).returnTo),
	});

	const authorizationURL = new URL('https://discord.com/oauth2/authorize');
	authorizationURL.search = new URLSearchParams({
		response_type: 'code',
		client_id: applicationId,
		scope: 'identify guilds',
		state,
		redirect_uri: getDiscordRedirectURI(event),
		prompt: 'consent',
	}).toString();
	return sendRedirect(event, authorizationURL.toString());
});
