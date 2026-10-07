import { ActivityType, Client, Partials, REST, Routes } from 'discord.js';
import { GatewayIntentBits, MessageFlags } from 'discord-api-types/v10';
import { basename, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import loadCommands from './load/loadActions.js';
import { config as loadEnv } from '@dotenvx/dotenvx';
import loadSingletons from './load/loadSingletons.js';
// import {generateDependencyReport} from '@discordjs/voice';
// console.log(generateDependencyReport());

interface DiscordBotState {
	client?: Client;
	startPromise?: Promise<Client>;
}

const stateKey = Symbol.for('discord-awbw-notifier.bot');
const globalState = globalThis as typeof globalThis & {
	[stateKey]?: DiscordBotState;
};
const state = (globalState[stateKey] ??= {});

function loadParentEnvironmentDuringMigration() {
	if (process.env.DISCORD_TOKEN || basename(process.cwd()) !== 'nuxt') {
		return;
	}

	const parentEnv = resolve(process.cwd(), '..', '.env');
	if (existsSync(parentEnv)) {
		loadEnv({
			path: parentEnv,
			envKeysFile: resolve(process.cwd(), '..', '.env.keys'),
			quiet: true,
		});
	}
}

function registerInteractionHandlers(client: Client) {
	client.once('clientReady', () => {
		client.singletons.awbw.start();
		console.log(
			`Discord bot ready as ${client.user?.tag ?? 'unknown user'}.`,
		);
	});

	client.on('interactionCreate', async (interaction) => {
		// All guilds should be cached, so long as the bot has guilds intent
		// Returns false if the bot wasn't invited with the bot scope
		if (!interaction.inCachedGuild()) {
			return;
		}

		try {
			if (interaction.isChatInputCommand()) {
				const command = client.botActions.get(interaction.commandName);

				if (!command?.onCommand) {
					console.error(
						'No command handler available to handle interaction.',
					);
					console.error(`Command: ${interaction.commandName}`);
					return;
				}

				await command.onCommand(interaction);
			} else if (interaction.isButton()) {
				const metadata = JSON.parse(interaction.customId);
				const command = client.botActions.get(metadata.command);

				if (!command?.onButton) {
					console.error(
						'No button handler available to handle interaction!',
					);
					console.error(`Metadata: ${JSON.stringify(metadata)}`);
					return;
				}

				await command.onButton(interaction, metadata.data);
			}
		} catch (error: any) {
			console.error(error);
			if (interaction.isRepliable()) {
				try {
					await interaction.reply({
						content: 'Something happened while processing that.',
						flags: MessageFlags.Ephemeral,
					});
				} catch (error: any) {
					if (error.code === 'InteractionAlreadyReplied') {
						try {
							await interaction.editReply(
								'Something happened while processing that.',
							);
						} catch {
							// The interaction token may already be invalid; nothing else can be sent.
						}
					}
				}
			}
		}
	});

	client.on('interactionCreate', async (interaction) => {
		if (!interaction.inCachedGuild()) {
			return;
		}

		try {
			if (interaction.isModalSubmit()) {
				let metadata: any;
				try {
					metadata = JSON.parse(interaction.customId);
				} catch {
					return; // Not our modal
				}

				const command = client.botActions.get(metadata.command);
				if (!command?.onModal) {
					return;
				}

				await command.onModal(interaction, metadata.data);
			}
		} catch (error: any) {
			console.error(error);
		}
	});
}

export function startDiscordBot() {
	if (state.startPromise) {
		return state.startPromise;
	}

	state.startPromise = (async () => {
		loadParentEnvironmentDuringMigration();
		const token = process.env.DISCORD_TOKEN;
		if (!token) {
			throw new Error(
				'Missing DISCORD_TOKEN. Copy .env.example to .env and configure it.',
			);
		}

		const client = new Client({
			intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
			partials: [Partials.User],
			presence: {
				activities: [{ name: 'you 💕', type: ActivityType.Watching }],
				status: 'online',
			},
		});
		state.client = client;

		try {
			await loadCommands(client);
			await loadSingletons(client);
			const applicationId = process.env.DISCORD_APPLICATION_ID;
			if (!applicationId) {
				throw new Error('Missing DISCORD_APPLICATION_ID.');
			}
			const rest = new REST().setToken(token);
			await rest.put(Routes.applicationCommands(applicationId), {
				body: [...client.botActions.values()]
					.map((action) => action.data?.toJSON())
					.filter(Boolean),
			});
			registerInteractionHandlers(client);
			await client.login(token);
			return client;
		} catch (error) {
			client.destroy();
			state.client = undefined;
			state.startPromise = undefined;
			throw error;
		}
	})();

	return state.startPromise;
}

export async function stopDiscordBot() {
	const client =
		state.client ?? (await state.startPromise?.catch(() => undefined));
	client?.singletons.awbw.dispose();
	client?.destroy();
	state.client = undefined;
	state.startPromise = undefined;
}

export async function getDiscordBotClient() {
	return state.client ?? (await startDiscordBot());
}
