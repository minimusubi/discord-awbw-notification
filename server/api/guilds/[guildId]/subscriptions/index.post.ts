import {
	assertSubscriptionChannelIsUsable,
	assertSubscriptionUserIsInGuild,
	createAwbwSubscriptionsResponse,
	getAwbwGuildContext,
	readAwbwSubscriptionInput,
} from '../../../../utils/awbwDashboard.js';
import { assertSameOrigin } from '../../../../utils/discordAuth.js';

export default defineEventHandler(async (event) => {
	assertSameOrigin(event);
	const input = await readAwbwSubscriptionInput(event);
	const { guild, guildSummary, manager } = await getAwbwGuildContext(event);
	await assertSubscriptionChannelIsUsable(guild, input.channelId);
	await assertSubscriptionUserIsInGuild(guild, input.discordUserId);
	try {
		await manager.addSubscription({ guildId: guild.id, ...input });
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : '';
		if (errorMessage.includes(' is not a player in AWBW game ')) {
			throw createError({
				statusCode: 400,
				statusMessage:
					'That AWBW username is not part of the selected game.',
			});
		}
		if (/^AWBW game \d+ has already ended\.$/.test(errorMessage)) {
			throw createError({
				statusCode: 400,
				statusMessage: 'This AWBW game has already ended.',
			});
		}
		if (
			errorMessage
			=== 'This user already receives notifications for that game in this channel.'
		) {
			throw createError({
				statusCode: 409,
				statusMessage: errorMessage,
			});
		}
		throw createError({
			statusCode: 502,
			statusMessage:
				'AWBW could not validate the game right now. Try again later.',
			cause: error,
		});
	}
	return createAwbwSubscriptionsResponse(guild, guildSummary);
});
