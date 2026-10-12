import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	findPlayerIds,
	isGameOverMessage,
	parseGamePage,
	parseGameUrl,
	parseNextTurnMessage,
} from './gamePage.ts';

test('maps an AWBW username to its per-game player ID and current turn', () => {
	const html = `<script>
		let gameDay = 23;
		let currentTurn = 4175646;
		let playersInfo = {
			"4175646": {"users_username":"Cymbalkid3000","users_id":390403,"players_id":4175646,"players_turn_start":"2026-10-06 23:47:21"},
			"4175663": {"users_username":"bloopybopp","users_id":390275,"players_id":4175663,"players_turn_start":"2026-10-06 23:40:26"}
		};
	</script>
	<div class="bold underline game-header-header"><a href="game.php?games_id=1741266">me me and me</a></div>`;
	const gameState = parseGamePage(html);

	assert.equal(gameState.gameName, 'me me and me');
	assert.deepEqual(findPlayerIds(gameState, 'BLOOPYBOPP'), ['4175663']);
	assert.equal(gameState.currentPlayerId, '4175646');
	assert.equal(gameState.turnKey, '23:4175646:2026-10-06 23:47:21');
});

test('decodes HTML entities in a game name', () => {
	const gameState = parseGamePage(`<div class="game-header-header">
		<a href="game.php?games_id=5">Me &amp; You &#x2764;</a>
	</div><script>
		let gameDay = 1;
		let currentTurn = 1;
		let playersInfo = {"1":{"users_username":"solo","players_id":1}};
	</script>`);
	assert.equal(gameState.gameName, 'Me & You ❤');
});

test('includes every seat held by the same AWBW username', () => {
	const gameState = parseGamePage(`<script>
		let gameDay = 1;
		let currentTurn = 1;
		let playersInfo = {
			"1": {"users_username":"solo","players_id":1,"players_turn_start":"2026-10-06 12:00:00"},
			"2": {"users_username":"solo","players_id":2,"players_turn_start":"2026-10-06 12:00:00"}
		};
	</script>`);
	assert.deepEqual(findPlayerIds(gameState, 'solo'), ['1', '2']);
});

test('accepts only canonical AWBW game links', () => {
	assert.deepEqual(
		parseGameUrl('https://awbw.amarriner.com/game.php?games_id=1741266'),
		{
			gameId: '1741266',
			gameUrl: 'https://awbw.amarriner.com/game.php?games_id=1741266',
		},
	);
	assert.throws(() =>
		parseGameUrl('https://example.com/game.php?games_id=1741266'),
	);
});

test('reads the live NextTurn websocket envelope', () => {
	assert.deepEqual(
		parseNextTurnMessage(
			JSON.stringify({
				NextTurn: {
					action: 'NextTurn',
					day: 1,
					nextPId: 4179028,
					nextTurnStart: '2026-10-07 00:39:16',
				},
			}),
		),
		{
			currentPlayerId: '4179028',
			turnKey: '1:4179028:2026-10-07 00:39:16',
			turnStartedAt: '2026-10-07 00:39:16',
		},
	);
	assert.equal(parseNextTurnMessage('{"Build":{}}'), null);
});

test('detects a completed game even when the page retains a current player', () => {
	const gamePage = (gameEndDate: string) => `<script>
		let gameDay = 6;
		let currentTurn = 4179027;
		let gameEndDate = "${gameEndDate}";
		let playersInfo = {"4179027":{"users_username":"solo","players_id":4179027}};
	</script>`;
	assert.equal(parseGamePage(gamePage('2026-10-07')).isCompleted, true);
	assert.equal(parseGamePage(gamePage('')).isCompleted, false);
});

test('recognizes the AWBW GameOver websocket action', () => {
	assert.equal(isGameOverMessage('{"GameOver":{"action":"GameOver"}}'), true);
	assert.equal(
		isGameOverMessage('{"NextTurn":{"action":"NextTurn"}}'),
		false,
	);
	assert.equal(isGameOverMessage('not JSON'), false);
});
