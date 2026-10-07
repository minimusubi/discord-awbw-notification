export function getTurnIdentity(
	turnKey: string | null | undefined,
): string | null {
	if (!turnKey) {
		return null;
	}
	const [gameDay, playerId] = turnKey.split(':');
	if (!gameDay || !playerId || gameDay === 'unknown') {
		return turnKey;
	}
	return `${gameDay}:${playerId}`;
}
