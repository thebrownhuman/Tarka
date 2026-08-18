/**
 * Converts between camelCase (TypeScript convention) and snake_case (wire/API
 * convention) recursively, so feature code never has to think about case.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof File);
}

function camelToSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

export function keysToSnake<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => keysToSnake(item)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[camelToSnakeKey(key)] = keysToSnake(value);
    }
    return result as unknown as T;
  }
  return input;
}

export function keysToCamel<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => keysToCamel(item)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[snakeToCamelKey(key)] = keysToCamel(value);
    }
    return result as unknown as T;
  }
  return input;
}
