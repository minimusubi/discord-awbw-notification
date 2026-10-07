const AWBW_ORIGIN = 'https://awbw.amarriner.com';

export interface AwbwGameState {
	gameName: string | null;
	currentPlayerId: string | null;
	players: Map<string, string>;
	turnKey: string | null;
	turnStartedAt: string | null;
}

export function parseGameUrl(value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error('Enter a full AWBW game URL.');
	}
	if (
		url.origin !== AWBW_ORIGIN
		|| url.pathname !== '/game.php'
		|| url.username
		|| url.password
		|| url.searchParams.getAll('games_id').length !== 1
	) {
		throw new Error('Enter a game link from awbw.amarriner.com/game.php.');
	}
	const gameId = url.searchParams.get('games_id');
	if (!gameId || !/^[1-9]\d{0,19}$/.test(gameId)) {
		throw new Error('The AWBW game link needs a numeric games_id.');
	}
	return { gameId, gameUrl: `${AWBW_ORIGIN}/game.php?games_id=${gameId}` };
}

export function parseGamePage(html: string): AwbwGameState {
	const gameNameMatch = html.match(
		/<div\b[^>]*class=["'][^"']*\bgame-header-header\b[^"']*["'][^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/i,
	);
	const gameName =
		gameNameMatch ? decodeGameName(gameNameMatch[1] ?? '') : null;
	const playersMatch = html.match(
		/\b(?:let|var|const)\s+playersInfo\s*=\s*(\{[\s\S]*?\})\s*;/,
	);
	if (!playersMatch) {
		throw new Error(
			'AWBW did not provide public player information for this game.',
		);
	}
	let rawPlayers: Record<
		string,
		{
			users_username?: unknown;
			players_id?: unknown;
			players_turn_start?: unknown;
		}
	>;
	try {
		rawPlayers = JSON.parse(playersMatch[1] ?? '');
	} catch {
		throw new Error('AWBW player information could not be read.');
	}
	const players = new Map<string, string>();
	for (const [key, player] of Object.entries(rawPlayers)) {
		if (typeof player.users_username === 'string') {
			players.set(
				String(player.players_id ?? key),
				player.users_username,
			);
		}
	}
	if (players.size === 0) {
		throw new Error('No players were found in this AWBW game.');
	}
	const currentTurnMatch = html.match(
		/\b(?:let|var|const)\s+currentTurn\s*=\s*(\d+|null)\s*;/,
	);
	const currentPlayerId =
		currentTurnMatch?.[1] && currentTurnMatch[1] !== 'null' ?
			currentTurnMatch[1]
		:	null;
	const currentPlayer =
		currentPlayerId ? rawPlayers[currentPlayerId] : undefined;
	const dayMatch = html.match(
		/\b(?:let|var|const)\s+gameDay\s*=\s*(\d+)\s*;/,
	);
	const turnStart =
		typeof currentPlayer?.players_turn_start === 'string' ?
			currentPlayer.players_turn_start
		:	null;
	return {
		gameName,
		currentPlayerId,
		players,
		turnKey:
			currentPlayerId ?
				`${dayMatch?.[1] ?? 'unknown'}:${currentPlayerId}:${turnStart ?? 'unknown'}`
			:	null,
		turnStartedAt: turnStart,
	};
}

function decodeGameName(value: string) {
	const decoded = value.replace(
		/&(#(?:\d+|x[\da-f]+)|amp|lt|gt|quot|apos|nbsp);/gi,
		(entity, code: string) => {
			const namedEntities: Record<string, string> = {
				amp: '&',
				lt: '<',
				gt: '>',
				quot: '"',
				apos: "'",
				nbsp: ' ',
			};
			if (!code.startsWith('#')) {
				return namedEntities[code.toLowerCase()] ?? entity;
			}
			const numericCode =
				code[1]?.toLowerCase() === 'x' ?
					Number.parseInt(code.slice(2), 16)
				:	Number.parseInt(code.slice(1), 10);
			return (
					Number.isFinite(numericCode)
						&& numericCode > 0
						&& numericCode <= 0x10ffff
				) ?
					String.fromCodePoint(numericCode)
				:	entity;
		},
	);
	return decoded.replace(/\s+/g, ' ').trim() || null;
}

export function parseNextTurnMessage(message: string) {
	let payload: unknown;
	try {
		payload = JSON.parse(message);
	} catch {
		return null;
	}
	if (
		typeof payload !== 'object'
		|| payload === null
		|| !('NextTurn' in payload)
	) {
		return null;
	}
	const nextTurn = payload.NextTurn;
	if (typeof nextTurn !== 'object' || nextTurn === null) {
		return null;
	}
	const { day, nextPId, nextTurnStart } = nextTurn as Record<string, unknown>;
	if (
		!Number.isSafeInteger(day)
		|| !/^[1-9]\d*$/.test(String(nextPId))
		|| typeof nextTurnStart !== 'string'
		|| !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(nextTurnStart)
	) {
		return null;
	}
	const currentPlayerId = String(nextPId);
	return {
		currentPlayerId,
		turnKey: `${day}:${currentPlayerId}:${nextTurnStart}`,
		turnStartedAt: nextTurnStart,
	};
}

export async function fetchGameState(gameId: string): Promise<AwbwGameState> {
	const response = await fetch(`${AWBW_ORIGIN}/game.php?games_id=${gameId}`, {
		headers: { 'User-Agent': 'AWBW Discord turn notifier' },
		signal: AbortSignal.timeout(15_000),
	});
	if (!response.ok) {
		throw new Error(
			`AWBW returned HTTP ${response.status} for game ${gameId}.`,
		);
	}
	return parseGamePage(await response.text());
}

export function findPlayerIds(gameState: AwbwGameState, username: string) {
	return [...gameState.players]
		.filter(
			([, playerUsername]) =>
				playerUsername.toLocaleLowerCase()
				=== username.toLocaleLowerCase(),
		)
		.map(([playerId]) => playerId);
}
