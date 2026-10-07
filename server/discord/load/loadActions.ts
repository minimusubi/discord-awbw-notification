import * as awbw from '../actions/awbw.js';
import type { Action } from '../types.js';
import type { Client } from 'discord.js';
import { Collection } from 'discord.js';

declare module 'discord.js' {
	interface Client<Ready extends boolean = boolean> {
		botActions: Collection<string, Action>;
	}
}

export default async function loadCommands(client: Client) {
	client.botActions = new Collection();
	const actions: Action[] = [awbw];

	for (const action of actions) {
		client.botActions.set(action.name, action);
	}
}
