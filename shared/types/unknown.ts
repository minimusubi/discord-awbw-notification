export type Except<Type, ExceptType, ErrorMessage = never> =
	Type extends ExceptType ? ErrorMessage : Type;

export function isObject(object: unknown): object is object {
	return typeof object === 'object' && object !== null;
}

type PossibleTypes = {
	undefined: undefined;
	null: null;
	object: object;
	boolean: boolean;
	number: number;
	bigint: bigint;
	string: string;
	symbol: symbol;
	function: (...args: unknown[]) => unknown;
};

type TypeOfUnion<T extends readonly (keyof PossibleTypes)[]> =
	PossibleTypes[T[number]];

type Schema = keyof PossibleTypes | { [key: string]: Schema };

type SchemaToType<ExpectedSchema> =
	ExpectedSchema extends keyof PossibleTypes ? PossibleTypes[ExpectedSchema]
	: ExpectedSchema extends Record<string, unknown> ?
		{ [Key in keyof ExpectedSchema]: SchemaToType<ExpectedSchema[Key]> }
	:	never;

export type PropertyTypeErrorOptions = {
	property: string;
	expected: keyof PossibleTypes;
	actual: keyof PossibleTypes;
};

export class PropertyTypeError extends TypeError {
	property: string;
	expected: keyof PossibleTypes;
	actual: keyof PossibleTypes;

	constructor(
		{ property, expected, actual }: PropertyTypeErrorOptions,
		...[message, ...args]: ConstructorParameters<typeof TypeError>
	) {
		super(
			message
				?? `'${property}' does not match the expected type (expected ${expected}, but received ${actual})`,
			...args,
		);

		this.property = property;
		this.expected = expected;
		this.actual = actual;
	}
}

/**
 * Checks whether an unknown value is a non-null object and contains a property
 * with the specified key and runtime type.
 *
 * Acts as a type guard that refines the input to an object with the given key
 * and value type, based on the result of `typeof`.
 *
 * @param object The value to validate.
 * @param key The property key to check for.
 * @param expectedValueType The expected type of the property value (as
 * returned by `typeof`). 'null' can also be used.
 * @returns `true` if the value is an object, contains the key, and the
 * property value matches the expected type; otherwise, `false`.
 * @example
 * Validate an object expected to have an 'id' property of type number
 * ```ts
 * unknownHasProperty(request.body, 'id', 'number');
 * ```
 */
export function unknownHasProperty<
	KeyType extends string | number | symbol,
	ValueType extends keyof PossibleTypes,
>(
	object: unknown,
	key: KeyType,
	expectedValueType: ValueType,
): object is Record<KeyType, PossibleTypes[ValueType]>;
/**
 * Checks whether an unknown value is a non-null object and contains a property
 * with the specified key and runtime types.
 *
 * Acts as a type guard that refines the input to an object with the given key
 * and value type, based on the result of `typeof`.
 *
 * @param object The value to validate.
 * @param key The property key to check for.
 * @param expectedValueTypes The expected types of the property value (as
 * returned by `typeof`), as an array. 'null' can also be used.
 * @returns `true` if the value is an object, contains the key, and the
 * property value matches the expected type; otherwise, `false`.
 * @example
 * Validate an object expected to have an 'id' property of type number or undefined
 * ```ts
 * unknownHasProperty(request.body, 'id', ['number', 'undefined']);
 * ```
 */
export function unknownHasProperty<
	KeyType extends string | number | symbol,
	ValueTypes extends (keyof PossibleTypes)[],
>(
	object: unknown,
	key: KeyType,
	expectedValueTypes: ValueTypes,
): object is Record<KeyType, TypeOfUnion<ValueTypes>>;
export function unknownHasProperty(
	object: unknown,
	key: KeyType,
	expectedValueTypes: string | string[],
): boolean {
	const types =
		Array.isArray(expectedValueTypes) ? expectedValueTypes : (
			[expectedValueTypes]
		);

	if (!isObject(object) || !(key in object)) {
		return false;
	}

	const value = (object as Record<KeyType, unknown>)[key];

	return types.some((expected) => {
		if (expected === 'null') {
			return value === null;
		}
		return typeof value === expected;
	});
}

/**
 * Asserts that an unknown value is a non-null object and contains all
 * specified properties with their expected runtime types. If the assertion
 * fails, an error is thrown.
 *
 * Acts as a type guard that refines the input to an object with a known set of
 * keys, each having the type specified in the mapping (based on `typeof` checks).
 *
 * @param object The value to validate.
 * @param keyTypeMapping An object whose keys are the required property names,
 * and whose values are the expected types (e.g., `'string'`, `'number'`).
 * @throws TypeError if `object` is null or undefined
 * @throws PropertyTypeError if any property is not the expected type
 * @example
 * Assert a value expected to have two strings
 * ```ts
 * assertUnknownHasProperties(request.body, {state: 'string', mode: 'string'});
 * ```
 * @example
 * Assert an object expected to have a number, a string, and a boolean
 * ```ts
 * assertUnknownHasProperties(request.body, {id: 'number', state: 'string', success: 'boolean'});
 * ```
 */
export function assertUnknownHasProperties<
	Mapping extends Record<string, keyof PossibleTypes>,
>(
	object: unknown,
	keyTypeMapping: Mapping,
): asserts object is {
	[KeyType in keyof Mapping]: PossibleTypes[Mapping[KeyType]];
} {
	if (object === null || object === undefined) {
		throw new TypeError(
			'The object provided to assertUnknownHasProperties is null or undefined',
		);
	}

	for (const [key, valueType] of Object.entries(keyTypeMapping)) {
		if (!unknownHasProperty(object, key, valueType)) {
			throw new PropertyTypeError({
				property: key,
				expected: valueType,
				actual: typeof (object as Record<string, unknown>)[key],
			});
		}
	}
}

/**
 * Recursively checks whether an unknown value matches a given schema. If it
 * doesn't match, an error is thrown.
 *
 * Acts as a runtime assertion that narrows the type of the input according to
 * the specified schema. Supports nested objects.
 *
 * If the value does not match the schema, a `PropertyTypeError` is thrown with
 * the property path, expected type, and actual type.
 *
 * @param value The value to validate.
 * @param schema The schema to validate against. Can include:
 *   - Primitive types: `'string' | 'number' | 'boolean' | 'null' | 'object'` etc.
 *   - An object whose keys are the required property names and whose values
 *     are one of the expected primitive types above, or another (nested) object
 * @param path Internal parameter used for tracking the property path for error
 * messages. Typically unused called externally.
 * @throws PropertyTypeError when the object or property does not match the
 * expected type or is missing.
 * @example
 * Basic usage with a nested object schema
 * ```ts
 * assertUnknownMatchesSchema(request.body, {
 * 	contents: {
 * 		user: {
 * 			id: 'number',
 * 			name: 'string',
 * 		},
 * 		comment: 'string'
 * 	},
 * });
 * ```
 * Now, TypeScript will infer the type of `params` as matching the provided schema
 * ```ts
 * const contents = request.body.contents;
 * contents.user.id; // number
 * contents.user.name; // string
 * ```
 */
export function assertUnknownMatchesSchema<ExpectedSchema extends Schema>(
	value: unknown,
	schema: ExpectedSchema,
	path = '',
): asserts value is SchemaToType<ExpectedSchema> {
	// Handle string schemas first
	if (typeof schema === 'string') {
		if (schema === 'null') {
			if (value !== null) {
				throw new PropertyTypeError({
					property: path,
					expected: schema,
					actual: typeof value,
				});
			}

			return;
		}

		if (typeof value !== schema) {
			throw new PropertyTypeError({
				property: path,
				expected: schema,
				actual: typeof value,
			});
		}

		return;
	}

	// Exit if the value isn't an object and the schema is an object
	// or if the value is null but the schema is an object
	if (typeof value !== 'object' || value === null) {
		throw new PropertyTypeError({
			property: path,
			expected: 'object',
			actual: typeof value,
		});
	}

	// At this point, both value and schema are objects
	for (const [key, subschema] of Object.entries(schema)) {
		const nextPath = path ? `${path}.${key}` : key;

		assertUnknownMatchesSchema(
			(value as Record<string, unknown>)[key],
			subschema,
			nextPath,
		);
	}
}
