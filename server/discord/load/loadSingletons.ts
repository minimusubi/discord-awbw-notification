import type { Client } from 'discord.js';
import AwbwMonitor from '../awbw/AwbwMonitor.js';
import db from '../util/Store.js';

declare module 'discord.js' {
	interface Client<Ready extends boolean = boolean> {
		singletons: {
			db: typeof db;
			awbw: AwbwMonitor;
		};
	}
}

export default async function loadSingletons(client: Client) {
	client.singletons = {
		db: db,
		awbw: new AwbwMonitor(client),
	};
}
