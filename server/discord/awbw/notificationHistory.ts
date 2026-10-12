interface NotificationMessage {
	id: string;
	author: { id: string };
	content: string;
	delete(): Promise<unknown>;
}

interface NotificationMessageHistory {
	fetch(options: {
		limit: number;
		before?: string;
	}): Promise<Map<string, NotificationMessage>>;
}

export async function removeOlderGameNotifications(
	messages: NotificationMessageHistory,
	botUserId: string,
	gameId: string,
	keepMessageId?: string,
): Promise<void> {
	let before: string | undefined;
	const gameUrl = `https://awbw.amarriner.com/game.php?games_id=${gameId}`;

	while (true) {
		const page = await messages.fetch({ limit: 100, before });
		for (const oldMessage of page.values()) {
			if (
				oldMessage.id !== keepMessageId
				&& oldMessage.author.id === botUserId
				&& oldMessage.content.startsWith('<@')
				&& oldMessage.content.includes(
					' it is your turn in [AWBW game ',
				)
				&& oldMessage.content.includes(`](${gameUrl}).`)
			) {
				await oldMessage.delete();
			}
		}
		if (page.size < 100) {
			return;
		}
		before = [...page.values()].at(-1)!.id;
	}
}
