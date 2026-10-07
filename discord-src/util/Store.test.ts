import { type Adapter, Low } from 'lowdb';
import { Store } from '../../server/discord/util/Store.js';
import assert from 'node:assert/strict';
import test from 'node:test';

function createTestDb<Type extends object>(data: Type) {
	const writes: Type[] = [];
	const adapter: Adapter<Type> = {
		read: async () => null,
		write: async (value) => {
			writes.push(JSON.parse(JSON.stringify(value)) as Type);
		},
	};
	const lowDb = new Low(adapter, data);
	return {
		db: new Store(lowDb, { saveDelayMilliseconds: 0 }),
		lowDb,
		writes,
	};
}

async function waitForAutoWrite() {
	await new Promise((resolve) => setTimeout(resolve, 10));
}

void test('only proxies data and returns stable nested proxies', () => {
	const { db, lowDb } = createTestDb({ nested: { value: 1 } });

	assert.equal(db.adapter, lowDb.adapter);
	assert.equal(db.data, db.data);
	assert.equal(db.data.nested, db.data.nested);
});

void test('keeps separate store instances isolated', async () => {
	const firstStore = createTestDb({ value: 1 });
	const secondStore = createTestDb({ value: 10 });

	firstStore.db.data.value = 2;
	await waitForAutoWrite();

	assert.deepEqual(firstStore.writes, [{ value: 2 }]);
	assert.deepEqual(secondStore.writes, []);
	assert.equal(secondStore.db.data.value, 10);
});

void test('does not proxy native array methods', () => {
	const { db } = createTestDb({ services: [{ id: 'service' }] });
	const services = db.data.services;

	assert.ok(Array.isArray(services));
	assert.doesNotThrow(() => services.map((service) => service));
});

void test('writes after nested data changes', async () => {
	const { db, writes } = createTestDb({ nested: { value: 1 } });

	db.data.nested.value = 2;
	await waitForAutoWrite();

	assert.deepEqual(writes, [{ nested: { value: 2 } }]);
});

void test('writes and re-proxies after replacing data', async () => {
	const { db, writes } = createTestDb({ nested: { value: 1 } });
	const replacement = { nested: { value: 2 } };

	db.data = replacement;
	assert.notEqual(db.data, replacement);
	await waitForAutoWrite();

	db.data.nested.value = 3;
	await waitForAutoWrite();

	assert.deepEqual(writes, [
		{ nested: { value: 2 } },
		{ nested: { value: 3 } },
	]);
});
