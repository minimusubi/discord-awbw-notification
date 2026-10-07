import { randomUUID } from 'node:crypto';
import type { Client } from 'discord.js';
import {
	fetchGameState,
	findPlayerIds,
	parseGameUrl,
	parseNextTurnMessage,
	type AwbwGameState,
} from './gamePage.js';
import db from '../util/Store.js';

export interface AwbwSubscription {
	id: string;
	guildId: string;
	channelId: string;
	discordUserId: string;
	awbwUsername: string;
	gameId: string;
	gameName?: string;
	gameUrl: string;
	playerId: string;
	playerIds?: string[];
	lastNotifiedTurn?: string;
}

interface StoredAwbwData {
	subscriptions: AwbwSubscription[];
}

interface GameConnection {
	socket?: WebSocket;
	reconnectTimer?: ReturnType<typeof setTimeout>;
	heartbeatTimer?: ReturnType<typeof setInterval>;
	refreshTimer?: ReturnType<typeof setInterval>;
	reconnectDelay: number;
	refreshPromise?: Promise<void>;
	latestTurnStartedAt?: string;
}

const MAX_RECONNECT_DELAY = 60_000;
const HEARTBEAT_INTERVAL = 45_000;
const REFRESH_INTERVAL = 60_000;

export default class AwbwMonitor {
	private readonly connections = new Map<string, GameConnection>();
	private readonly gameNameFetches = new Map<string, Promise<void>>();
	private readonly pendingNotifications = new Set<string>();
	private disposed = false;

	constructor(private readonly client: Client) {}

	start() {
		for (const gameId of new Set(
			this.getStoredData().subscriptions.map(
				(subscription) => subscription.gameId,
			),
		)) {
			this.ensureConnection(gameId);
		}
	}

	listSubscriptions(guildId: string): AwbwSubscription[] {
		return this.getStoredData()
			.subscriptions.filter(
				(subscription) => subscription.guildId === guildId,
			)
			.map((subscription) => ({ ...subscription }));
	}

	async ensureGameNames(guildId: string) {
		const missingGameIds = new Set(
			this.getStoredData()
				.subscriptions.filter(
					(subscription) =>
						subscription.guildId === guildId
						&& !subscription.gameName,
				)
				.map((subscription) => subscription.gameId),
		);
		await Promise.all(
			[...missingGameIds].map((gameId) => this.fetchGameName(gameId)),
		);
	}

	async addSubscription(input: {
		guildId: string;
		channelId: string;
		discordUserId: string;
		awbwUsername: string;
		gameUrl: string;
	}): Promise<AwbwSubscription> {
		const awbwUsername = input.awbwUsername.trim();
		if (!awbwUsername || awbwUsername.length > 100) {
			throw new Error('Enter an AWBW username.');
		}
		const { gameId, gameUrl } = parseGameUrl(input.gameUrl);
		const gameState = await fetchGameState(gameId);
		const playerIds = findPlayerIds(gameState, awbwUsername);
		if (playerIds.length === 0) {
			throw new Error(
				`${awbwUsername} is not a player in AWBW game ${gameId}.`,
			);
		}
		const playerId = playerIds[0]!;
		const storedData = this.getStoredData();
		const existing = storedData.subscriptions.find(
			(subscription) =>
				subscription.guildId === input.guildId
				&& subscription.channelId === input.channelId
				&& subscription.discordUserId === input.discordUserId
				&& subscription.gameId === gameId
				&& subscription.awbwUsername.toLocaleLowerCase()
					=== awbwUsername.toLocaleLowerCase(),
		);
		if (existing) {
			throw new Error(
				'This user already receives notifications for that game in this channel.',
			);
		}
		const subscription: AwbwSubscription = {
			id: randomUUID(),
			guildId: input.guildId,
			channelId: input.channelId,
			discordUserId: input.discordUserId,
			awbwUsername: gameState.players.get(playerId) ?? awbwUsername,
			gameId,
			gameName: gameState.gameName ?? undefined,
			gameUrl,
			playerId,
			playerIds,
			lastNotifiedTurn: gameState.turnKey ?? undefined,
		};
		storedData.subscriptions.push(subscription);
		await db.write();
		this.ensureConnection(gameId);
		return { ...subscription };
	}

	async removeSubscription(guildId: string, subscriptionId: string) {
		const storedData = this.getStoredData();
		const index = storedData.subscriptions.findIndex(
			(subscription) =>
				subscription.guildId === guildId
				&& subscription.id === subscriptionId,
		);
		if (index === -1) {
			return false;
		}
		const removed = storedData.subscriptions.splice(index, 1)[0];
		if (!removed) return false;
		const { gameId } = removed;
		if (
			!storedData.subscriptions.some(
				(subscription) => subscription.gameId === gameId,
			)
		) {
			this.closeConnection(gameId);
		}
		await db.write();
		return true;
	}

	dispose() {
		this.disposed = true;
		for (const gameId of this.connections.keys()) {
			this.closeConnection(gameId);
		}
	}

	private getStoredData(): StoredAwbwData {
		const data = db.data as typeof db.data & { awbw?: StoredAwbwData };
		data.awbw ??= { subscriptions: [] };
		return data.awbw;
	}

	private ensureConnection(gameId: string) {
		if (this.disposed || this.connections.has(gameId)) {
			return;
		}
		const connection: GameConnection = { reconnectDelay: 1_000 };
		this.connections.set(gameId, connection);
		connection.refreshTimer = setInterval(
			() => void this.refreshGame(gameId, connection),
			REFRESH_INTERVAL,
		);
		this.openSocket(gameId, connection);
	}

	private openSocket(gameId: string, connection: GameConnection) {
		if (this.disposed || this.connections.get(gameId) !== connection) {
			return;
		}
		const socket = new WebSocket(
			`wss://awbw.amarriner.com/node/game/${gameId}`,
		);
		connection.socket = socket;
		socket.addEventListener('open', () => {
			connection.reconnectDelay = 1_000;
			socket.send('');
			connection.heartbeatTimer = setInterval(() => {
				if (socket.readyState === WebSocket.OPEN) {
					socket.send('');
				}
			}, HEARTBEAT_INTERVAL);
			void this.refreshGame(gameId, connection);
		});
		socket.addEventListener('message', (event) => {
			const nextTurn =
				typeof event.data === 'string' ?
					parseNextTurnMessage(event.data)
				:	null;
			if (!nextTurn) return;
			connection.latestTurnStartedAt = nextTurn.turnStartedAt;
			void this.notifyPlayers(gameId, nextTurn);
		});
		socket.addEventListener('error', (event) => {
			console.warn('AWBW websocket error', { gameId, event });
			socket.close();
		});
		socket.addEventListener('close', () => {
			if (connection.heartbeatTimer) {
				clearInterval(connection.heartbeatTimer);
				connection.heartbeatTimer = undefined;
			}
			if (this.disposed || this.connections.get(gameId) !== connection) {
				return;
			}
			connection.socket = undefined;
			const delay = connection.reconnectDelay;
			connection.reconnectDelay = Math.min(
				delay * 2,
				MAX_RECONNECT_DELAY,
			);
			connection.reconnectTimer = setTimeout(() => {
				connection.reconnectTimer = undefined;
				this.openSocket(gameId, connection);
			}, delay);
		});
	}

	private async refreshGame(gameId: string, connection: GameConnection) {
		if (connection.refreshPromise) {
			return connection.refreshPromise;
		}
		connection.refreshPromise = this.applyGameState(gameId, connection)
			.catch((error: unknown) =>
				console.error('Failed to refresh AWBW game', { gameId, error }),
			)
			.finally(() => {
				connection.refreshPromise = undefined;
			});
		return connection.refreshPromise;
	}

	private async applyGameState(gameId: string, connection: GameConnection) {
		const gameState = await fetchGameState(gameId);
		if (this.disposed || !this.connections.has(gameId)) {
			return;
		}
		if (this.updateGameName(gameId, gameState.gameName)) {
			await db.write();
		}
		if (
			connection.latestTurnStartedAt
			&& gameState.turnStartedAt
			&& gameState.turnStartedAt < connection.latestTurnStartedAt
		) {
			return;
		}
		connection.latestTurnStartedAt = gameState.turnStartedAt ?? undefined;
		if (!gameState.turnKey) {
			return;
		}
		await this.notifyPlayers(gameId, gameState);
	}

	private fetchGameName(gameId: string) {
		const pending = this.gameNameFetches.get(gameId);
		if (pending) return pending;
		const fetchPromise = fetchGameState(gameId)
			.then(async (gameState) => {
				if (this.updateGameName(gameId, gameState.gameName)) {
					await db.write();
				}
			})
			.catch((error: unknown) => {
				console.warn('Could not load AWBW game name', {
					gameId,
					error,
				});
			})
			.finally(() => this.gameNameFetches.delete(gameId));
		this.gameNameFetches.set(gameId, fetchPromise);
		return fetchPromise;
	}

	private updateGameName(gameId: string, gameName: string | null) {
		if (!gameName) return false;
		let changed = false;
		for (const subscription of this.getStoredData().subscriptions) {
			if (
				subscription.gameId === gameId
				&& subscription.gameName !== gameName
			) {
				subscription.gameName = gameName;
				changed = true;
			}
		}
		return changed;
	}

	private async notifyPlayers(
		gameId: string,
		gameState: Pick<AwbwGameState, 'currentPlayerId' | 'turnKey'>,
	) {
		for (const subscription of this.getStoredData().subscriptions) {
			const notificationKey = `${subscription.id}:${gameState.turnKey}`;
			if (
				subscription.gameId !== gameId
				|| !(
					subscription.playerIds ?? [subscription.playerId]
				).includes(gameState.currentPlayerId ?? '')
				|| subscription.lastNotifiedTurn === gameState.turnKey
				|| this.pendingNotifications.has(notificationKey)
			) {
				continue;
			}
			this.pendingNotifications.add(notificationKey);
			try {
				const channel = await this.client.channels.fetch(
					subscription.channelId,
				);
				if (!channel?.isSendable()) {
					throw new Error('Channel is not available for messages.');
				}
				const gameLabel =
					subscription.gameName ?
						`AWBW game ${subscription.gameName}`
					:	`AWBW game ${gameId}`;
				await channel.send({
					content: `<@${subscription.discordUserId}> it is your turn in [${escapeLinkLabel(gameLabel)}](${subscription.gameUrl}).`,
					allowedMentions: { users: [subscription.discordUserId] },
				});
				subscription.lastNotifiedTurn = gameState.turnKey ?? undefined;
				await db.write();
			} catch (error) {
				console.error('Failed to send AWBW turn notification', {
					subscriptionId: subscription.id,
					error,
				});
			} finally {
				this.pendingNotifications.delete(notificationKey);
			}
		}
	}

	private closeConnection(gameId: string) {
		const connection = this.connections.get(gameId);
		if (!connection) {
			return;
		}
		this.connections.delete(gameId);
		if (connection.reconnectTimer) clearTimeout(connection.reconnectTimer);
		if (connection.heartbeatTimer) clearInterval(connection.heartbeatTimer);
		if (connection.refreshTimer) clearInterval(connection.refreshTimer);
		connection.socket?.close();
	}
}

function escapeLinkLabel(value: string) {
	return value.replace(/[\\\[\]]/g, '\\$&');
}
