export function sortByOrd<T extends { ord: number }>(items: readonly T[]): T[] {
  return items.toSorted((a, b) => a.ord - b.ord)
}
