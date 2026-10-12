import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removeOlderGameNotifications } from './notificationHistory.ts';

test('removes only older bot alerts for the requested game', async () => {
	const deletedIds: string[] = [];
	const messages = [
		{ id: 'new', authorId: 'bot', gameId: '123' },
		{ id: 'old-123', authorId: 'bot', gameId: '123' },
		{ id: 'other-game', authorId: 'bot', gameId: '1234' },
		{ id: 'other-author', authorId: 'human', gameId: '123' },
		{ id: 'other-bot-message', authorId: 'bot', gameId: '123' },
		...Array.from({ length: 97 }, (_, index) => ({
			id: `unrelated-${index}`,
			authorId: 'human',
			gameId: '123',
		})),
		{ id: 'older-123', authorId: 'bot', gameId: '123' },
	];
	const history = {
		async fetch({ limit, before }: { limit: number; before?: string }) {
			const startIndex =
				before ? messages.findIndex(({ id }) => id === before) + 1 : 0;
			return new Map(
				messages
					.slice(startIndex, startIndex + limit)
					.map(({ id, authorId, gameId }) => [
						id,
						{
							id,
							author: { id: authorId },
							content:
								id === 'other-bot-message' ?
									`Game details: https://awbw.amarriner.com/game.php?games_id=${gameId}`
								:	`<@42> it is your turn in [AWBW game name](https://awbw.amarriner.com/game.php?games_id=${gameId}).`,
							async delete() {
								deletedIds.push(id);
							},
						},
					]),
			);
		},
	};

	await removeOlderGameNotifications(history, 'bot', '123', 'new');
	assert.deepEqual(deletedIds, ['old-123', 'older-123']);
});

test('removes the last bot alert when a game ends', async () => {
	const deletedIds: string[] = [];
	const messages = {
		async fetch() {
			return new Map([
				[
					'last-alert',
					{
						id: 'last-alert',
						author: { id: 'bot' },
						content:
							'<@42> it is your turn in [AWBW game name](https://awbw.amarriner.com/game.php?games_id=123).',
						async delete() {
							deletedIds.push('last-alert');
						},
					},
				],
			]);
		},
	};

	await removeOlderGameNotifications(messages, 'bot', '123');
	assert.deepEqual(deletedIds, ['last-alert']);
});
