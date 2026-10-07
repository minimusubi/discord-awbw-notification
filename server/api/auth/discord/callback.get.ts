import {
	exchangeDiscordCode,
	getDiscordRedirectURI,
	getDiscordUser,
	getSafeReturnTo,
	useDiscordAuthSession,
} from '../../../utils/discordAuth.js';
import { getQuery, sendRedirect } from 'h3';

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const session = await useDiscordAuthSession(event);
	if (
		typeof query.code !== 'string'
		|| typeof query.state !== 'string'
		|| query.state !== session.data.oauthState
	) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Discord returned an invalid sign-in response.',
		});
	}

	const token = await exchangeDiscordCode(
		query.code,
		getDiscordRedirectURI(event),
	);
	const user = await getDiscordUser(token.access_token);
	const returnTo = getSafeReturnTo(session.data.returnTo);
	await session.update({
		oauthState: undefined,
		returnTo: undefined,
		accessToken: token.access_token,
		refreshToken: token.refresh_token,
		tokenExpiresAt: Date.now() + token.expires_in * 1000,
		user,
	});
	return sendRedirect(event, returnTo);
});
