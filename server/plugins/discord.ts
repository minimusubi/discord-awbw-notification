import { startDiscordBot, stopDiscordBot } from '../discord/index.js';

export default defineNitroPlugin(async (nitroApp) => {
	await startDiscordBot();

	nitroApp.hooks.hook('close', async () => {
		await stopDiscordBot();
	});
});
