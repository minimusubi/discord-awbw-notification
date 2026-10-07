import type {
	AnySelectMenuInteraction,
	ButtonInteraction,
	ChatInputCommandInteraction,
	ModalSubmitInteraction,
} from 'discord.js';

export interface Action {
	name: string;
	data?: { toJSON(): unknown };
	onCommand?: (
		interaction: ChatInputCommandInteraction<'cached'>,
	) => Promise<void>;
	onButton?: (
		interaction: ButtonInteraction<'cached'>,
		customData: any,
	) => Promise<void>;
	onModal?: (
		interaction: ModalSubmitInteraction<'cached'>,
		customData: any,
	) => Promise<void>;
	onSelect?: (
		interaction: AnySelectMenuInteraction<'cached'>,
		customData: any,
	) => Promise<void>;
}

export type ParsedJSON =
	| string
	| number
	| boolean
	| null
	| { [key: string]: ParsedJSON }
	| Array<ParsedJSON>;
