import {
	createAwbwSubscriptionsResponse,
	getAwbwGuildContext,
} from '../../../../utils/awbwDashboard.js';
import { assertSameOrigin } from '../../../../utils/discordAuth.js';
import { getRouterParam } from 'h3';

export default defineEventHandler(async (event) => {
	assertSameOrigin(event);
	const subscriptionId = getRouterParam(event, 'subscriptionId');
	if (!subscriptionId) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Missing signup ID.',
		});
	}

	const { guild, guildSummary, manager } = await getAwbwGuildContext(event);
	const removed = await manager.removeSubscription(guild.id, subscriptionId);
	if (!removed) {
		throw createError({
			statusCode: 404,
			statusMessage: 'Signup not found.',
		});
	}
	return createAwbwSubscriptionsResponse(guild, guildSummary);
});
