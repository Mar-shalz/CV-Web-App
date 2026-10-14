/** Their order first (D-119); achievements never moved keep the order they were added. */
export function sortItems<T extends { position?: number | null; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = typeof a.position === "number" ? a.position : Number.POSITIVE_INFINITY;
    const pb = typeof b.position === "number" ? b.position : Number.POSITIVE_INFINITY;
    return pa !== pb ? pa - pb : a.created_at.localeCompare(b.created_at);
  });
}
