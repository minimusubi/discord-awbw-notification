import type { Adapter, Low } from 'lowdb';
import { dirname, join } from 'node:path';
import { JSONFilePreset } from 'lowdb/node';
import type { ParsedJSON } from '../types.js';
import { mkdir } from 'node:fs/promises';

const SAVE_DELAY = 500;

function isPlainObject(
	value: ParsedJSON,
): value is { [key: string]: ParsedJSON } {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone<T extends ParsedJSON>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((v) => deepClone(v)) as T;
	}
	if (isPlainObject(value)) {
		const out: Record<string, ParsedJSON> = {};
		for (const [k, v] of Object.entries(value)) {
			out[k] = deepClone(v);
		}
		return out as T;
	}
	return value;
}

export function ensureDefaults<Type>(
	target: Record<string, ParsedJSON>,
	defaults: Record<string, ParsedJSON>,
): Type {
	for (const [key, defVal] of Object.entries(defaults)) {
		const hasKey = Object.prototype.hasOwnProperty.call(target, key);
		if (!hasKey || target[key] === undefined) {
			// Only add missing keys, using a deep clone of the default
			target[key] = deepClone(defVal);
			continue;
		}

		// If both sides are plain objects, recurse to fill in nested defaults
		const current = target[key];
		if (isPlainObject(defVal) && isPlainObject(current)) {
			ensureDefaults(current, defVal);
		}
		// Otherwise, leave existing values as-is (do not overwrite)
	}

	return target as Type;
}

export interface StoreOptions {
	saveDelayMilliseconds?: number;
}

export class Store<Type extends object> {
	private readonly database: Low<Type>;
	private readonly proxyCache = new WeakMap<object, object>();
	private readonly proxyTargets = new WeakMap<object, object>();
	private readonly saveDelayMilliseconds: number;
	private saveTimeout: NodeJS.Timeout | null = null;
	private pendingWrite: Promise<void> = Promise.resolve();

	constructor(database: Low<Type>, options: StoreOptions = {}) {
		this.database = database;
		this.saveDelayMilliseconds =
			options.saveDelayMilliseconds ?? SAVE_DELAY;
	}

	static async create<Type extends object>(
		filePath: string,
		defaultData: Type,
		options: StoreOptions = {},
	): Promise<Store<Type>> {
		await mkdir(dirname(filePath), { recursive: true });
		const database = await JSONFilePreset<Type>(filePath, defaultData);
		return new Store(database, options);
	}

	get adapter(): Adapter<Type> {
		return this.database.adapter;
	}

	get data(): Type {
		return this.getProxyFor(this.database.data);
	}

	set data(value: Type) {
		this.database.data = this.unwrapProxy(value);
		this.scheduleWrite();
	}

	async read(): Promise<void> {
		const data = await this.database.adapter.read();
		if (data !== null) {
			this.database.data = data;
		}
	}

	async write(): Promise<void> {
		this.clearSaveTimeout();
		const write = this.pendingWrite
			.catch(() => undefined)
			.then(() => this.database.write());
		this.pendingWrite = write;
		await write;
	}

	async update(updateData: (data: Type) => unknown): Promise<void> {
		updateData(this.data);
		await this.write();
	}

	private unwrapProxy<Value>(value: Value): Value {
		if (value === null || typeof value !== 'object') {
			return value;
		}

		return (this.proxyTargets.get(value) ?? value) as Value;
	}

	private clearSaveTimeout() {
		if (this.saveTimeout !== null) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
	}

	private scheduleWrite() {
		this.clearSaveTimeout();

		const currentTimeout = setTimeout(() => {
			if (this.saveTimeout === currentTimeout) {
				this.saveTimeout = null;
			}

			void this.write().catch((error: unknown) => {
				console.error('Failed to automatically save database', {
					error,
				});
			});
		}, this.saveDelayMilliseconds);
		this.saveTimeout = currentTimeout;
	}

	private getProxyFor<Value extends object>(destination: Value): Value {
		const cached = this.proxyCache.get(destination);
		if (cached !== undefined) {
			return cached as Value;
		}

		const proxy = new Proxy(destination, {
			get: (target, property, receiver) => {
				const value = Reflect.get(target, property, receiver);

				if (value !== null && typeof value === 'object') {
					return this.getProxyFor(value);
				}

				return value;
			},

			set: (target, property, value, receiver) => {
				const result = Reflect.set(
					target,
					property,
					this.unwrapProxy(value),
					receiver,
				);

				if (result) {
					this.scheduleWrite();
				}
				return result;
			},

			deleteProperty: (target, property) => {
				const result = Reflect.deleteProperty(target, property);

				if (result) {
					this.scheduleWrite();
				}
				return result;
			},

			ownKeys(target) {
				return Reflect.ownKeys(target);
			},
		});

		this.proxyCache.set(destination, proxy);
		this.proxyTargets.set(proxy, destination);
		return proxy;
	}
}

const defaultData = {
	awbw: { subscriptions: [] },
};
const filePath = join(process.env.ASDF_PERSISTENT_DIR ?? 'data', 'db.json');
const db = await Store.create<Record<string, ParsedJSON>>(
	filePath,
	defaultData,
);

export default db;
