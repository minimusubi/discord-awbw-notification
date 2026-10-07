export type ParsedJSON =
	| string
	| number
	| boolean
	| null
	| { [key: string]: ParsedJSON }
	| Array<ParsedJSON>;
