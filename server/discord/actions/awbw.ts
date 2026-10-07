import {
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

export const name = 'awbw';

export const data = new SlashCommandBuilder()
	.setName(name)
	.setDescription('Manage AWBW turn notifications')
	.addSubcommand((subcommand) =>
		subcommand
			.setName('notify')
			.setDescription(
				'Ping you in this channel when your AWBW turn starts',
			)
			.addStringOption((option) =>
				option
					.setName('username')
					.setDescription('Your AWBW username')
					.setRequired(true),
			)
			.addStringOption((option) =>
				option
					.setName('game-url')
					.setDescription('AWBW game link')
					.setRequired(true),
			),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName('list')
			.setDescription('Show your turn notifications in this server'),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName('remove')
			.setDescription('Stop a turn notification')
			.addStringOption((option) =>
				option
					.setName('subscription-id')
					.setDescription('ID shown by /awbw list')
					.setRequired(true),
			),
	);

export async function onCommand(
	interaction: ChatInputCommandInteraction<'cached'>,
) {
	const manager = interaction.client.singletons.awbw;
	const subcommand = interaction.options.getSubcommand(true);
	if (subcommand === 'list') {
		const subscriptions = manager
			.listSubscriptions(interaction.guildId)
			.filter(
				(subscription) =>
					subscription.discordUserId === interaction.user.id,
			);
		await interaction.reply({
			content:
				subscriptions.length ?
					subscriptions
						.map(
							(subscription) =>
								`${subscription.id} · ${subscription.awbwUsername} · game ${subscription.gameId} · <#${subscription.channelId}>`,
						)
						.join('\n')
						.slice(0, 1900)
				:	'You have no AWBW turn notifications in this server.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	if (subcommand === 'remove') {
		const subscriptionId = interaction.options.getString(
			'subscription-id',
			true,
		);
		const subscription = manager
			.listSubscriptions(interaction.guildId)
			.find(
				(item) =>
					item.id === subscriptionId
					&& item.discordUserId === interaction.user.id,
			);
		const removed =
			subscription ?
				await manager.removeSubscription(
					interaction.guildId,
					subscriptionId,
				)
			:	false;
		await interaction.reply({
			content:
				removed ?
					'AWBW turn notification removed.'
				:	'That notification was not found.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	if (
		!interaction.channel?.isSendable()
		|| !interaction.appPermissions?.has([
			PermissionFlagsBits.ViewChannel,
			PermissionFlagsBits.SendMessages,
		])
	) {
		await interaction.reply({
			content: 'Use this command in a channel where the bot can post.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	try {
		const subscription = await manager.addSubscription({
			guildId: interaction.guildId,
			channelId: interaction.channelId,
			discordUserId: interaction.user.id,
			awbwUsername: interaction.options.getString('username', true),
			gameUrl: interaction.options.getString('game-url', true),
		});
		await interaction.editReply(
			`I will ping you in <#${subscription.channelId}> when ${subscription.awbwUsername}'s turn starts in [game ${subscription.gameId}](${subscription.gameUrl}).`,
		);
	} catch (error) {
		await interaction.editReply(
			error instanceof Error ?
				error.message
			:	'Could not add the AWBW notification.',
		);
	}
}
