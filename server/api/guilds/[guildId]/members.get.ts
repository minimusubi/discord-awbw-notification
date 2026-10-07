import type { DiscordGuildMembersResponse } from '#shared/types/dashboard';
import { getGuildMembersWithCache } from '../../../utils/discordMembers.js';
import { getRouterParam } from 'h3';
import { requireRecentlyAuthorizedGuild } from '../../../utils/discordAuth.js';

export default defineEventHandler(
	async (event): Promise<DiscordGuildMembersResponse> => {
		const guildId = getRouterParam(event, 'guildId');
		if (!guildId) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Missing server ID.',
			});
		}

		const { guild } = await requireRecentlyAuthorizedGuild(event, guildId);
		const guildMembers = await getGuildMembersWithCache(guild);

		return {
			members: [...guildMembers.values()]
				.map((member) => ({
					id: member.id,
					username: member.user.username,
					displayName: member.displayName,
					avatarURL: member.displayAvatarURL({ size: 64 }),
					bot: member.user.bot,
				}))
				.sort((firstMember, secondMember) =>
					firstMember.displayName.localeCompare(
						secondMember.displayName,
					),
				),
		};
	},
);
