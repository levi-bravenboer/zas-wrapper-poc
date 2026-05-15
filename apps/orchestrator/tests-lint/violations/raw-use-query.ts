// Fixture: useQuery against a paginated list endpoint literal.
// Must trigger `no-restricted-syntax` paginated-query heuristic (§26.4).
declare function useQuery(opts: { queryKey: unknown[]; queryFn: () => Promise<unknown> }): unknown

export const q = useQuery({
  queryKey: ['patients', 1],
  queryFn: () => fetch('/patients?page=1&size=20').then((r) => r.json()),
})
