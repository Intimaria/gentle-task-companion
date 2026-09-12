export function userPk(sub: string): string {
  return `USER#${sub}`;
}

export function moodSk(isoTimestamp: string): string {
  return `MOOD#${isoTimestamp}`;
}

/** Prefijo para consultar todos los ánimos de un usuario. */
export const MOOD_PREFIX = "MOOD#";
