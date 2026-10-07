import {
	createAwbwSubscriptionsResponse,
	getAwbwGuildContext,
} from '../../../../utils/awbwDashboard.js';

export default defineEventHandler(async (event) => {
	const { guild, guildSummary } = await getAwbwGuildContext(event);
	return createAwbwSubscriptionsResponse(guild, guildSummary);
});
