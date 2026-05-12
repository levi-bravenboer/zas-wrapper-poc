type KeySegment = string | number | boolean | null | undefined | Record<string, unknown>

type KeyFactories = Record<string, (...args: KeySegment[]) => readonly unknown[]>

export function createQueryKeys<TFactories extends KeyFactories>(
  scope: string,
  factories: (scope: string) => TFactories,
): TFactories & { all: readonly [string] } {
  return { all: [scope] as const, ...factories(scope) }
}
