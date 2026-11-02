const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Database IDs are UUIDs. Anything else names no record, so it's turned away before a
 * query (where Postgres would throw).
 */
export const isUuid = (value: string) => UUID.test(value);
