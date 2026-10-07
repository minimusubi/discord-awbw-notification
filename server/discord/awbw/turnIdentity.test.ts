import assert from 'node:assert/strict';
import { getTurnIdentity } from './turnIdentity.ts';
import { test } from 'node:test';

test('distinguishes a later turn for the same player', () => {
	const previousTurn = getTurnIdentity('23:4175663:2026-10-07 00:39:16');
	const currentTurn = getTurnIdentity('24:4175663:2026-10-07 01:39:16');
	assert.notEqual(currentTurn, previousTurn);
});

test('distinguishes another player and ignores timer changes within a turn', () => {
	const playerATurn = getTurnIdentity('23:4175663:2026-10-07 00:39:16');
	const playerBTurn = getTurnIdentity('23:4179028:2026-10-07 00:41:16');
	const updatedTimer = getTurnIdentity('23:4175663:2026-10-07 00:40:16');
	assert.notEqual(playerBTurn, playerATurn);
	assert.equal(updatedTimer, playerATurn);
});

test('uses turn start as a fallback when the game day is unavailable', () => {
	assert.notEqual(
		getTurnIdentity('unknown:4175663:2026-10-07 00:39:16'),
		getTurnIdentity('unknown:4175663:2026-10-07 01:39:16'),
	);
});
