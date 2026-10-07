import {
	assertSameOrigin,
	useDiscordAuthSession,
} from '../../utils/discordAuth.js';

export default defineEventHandler(async (event) => {
	assertSameOrigin(event);
	const session = await useDiscordAuthSession(event);
	await session.clear();
	return { success: true };
});
