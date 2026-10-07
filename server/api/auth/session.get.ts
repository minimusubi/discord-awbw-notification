import type { AuthSessionResponse } from '#shared/types/dashboard';
import { useDiscordAuthSession } from '../../utils/discordAuth.js';

export default defineEventHandler(
	async (event): Promise<AuthSessionResponse> => {
		const session = await useDiscordAuthSession(event);
		return {
			authenticated: Boolean(
				session.data.user && session.data.accessToken,
			),
			user: session.data.user ?? null,
		};
	},
);
