/**
 * Racha de días consecutivos (hasta hoy o ayer) con al menos una actividad.
 * `days`: fechas YYYY-MM-DD (pueden repetirse/desordenarse). `today`: YYYY-MM-DD.
 * Se permite gracia de 1 día: si hoy no hay registro pero ayer sí, la racha sigue.
 */
export function computeStreak(days: string[], today: string): number {
  const set = new Set(days);
  if (set.size === 0) return 0;

  const toMs = (d: string) => Date.parse(`${d}T00:00:00.000Z`);
  const dayMs = 86_400_000;
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  const todayMs = toMs(today);
  let cursor: number;
  if (set.has(today)) cursor = todayMs;
  else if (set.has(fmt(todayMs - dayMs))) cursor = todayMs - dayMs;
  else return 0;

  let streak = 0;
  while (set.has(fmt(cursor))) {
    streak++;
    cursor -= dayMs;
  }
  return streak;
}
