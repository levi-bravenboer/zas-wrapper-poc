import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'

interface UseTableSelectionControlled {
  selectedIds: ReadonlySet<string>
  onSelectionChange: (next: Set<string>) => void
}

interface UseTableSelectionParams<T> {
  data: ReadonlyArray<T>
  getRowId?: (row: T) => string
  selectable: boolean
  controlled?: UseTableSelectionControlled
  filterIdentity: string
  page: number
}

interface UseTableSelectionApi {
  selectedIds: ReadonlySet<string>
  toggleRow: (id: string) => void
  togglePage: () => void
  pageSelectionState: 'all' | 'some' | 'none'
  cancel: () => void
}

export function useTableSelection<T>({
  data,
  getRowId,
  selectable,
  controlled,
  filterIdentity,
  page,
}: UseTableSelectionParams<T>): UseTableSelectionApi {
  const [internal, setInternal] = useState<Set<string>>(() => new Set())
  const isControlled = controlled !== undefined
  const selectedIds: ReadonlySet<string> = isControlled ? controlled.selectedIds : internal

  const update: Dispatch<SetStateAction<Set<string>>> = useCallback(
    (updater) => {
      const prev = isControlled ? new Set(controlled.selectedIds) : new Set(internal)
      const next = typeof updater === 'function' ? updater(prev) : new Set(updater)
      if (isControlled) controlled.onSelectionChange(next)
      else setInternal(next)
    },
    [controlled, internal, isControlled],
  )

  const lastIdentity = useRef(filterIdentity)
  useEffect(() => {
    if (lastIdentity.current !== filterIdentity) {
      lastIdentity.current = filterIdentity
      update(() => new Set<string>())
    }
  }, [filterIdentity, update])

  const currentIds = useMemo(() => {
    if (!getRowId) return new Set<string>()
    return new Set(data.map(getRowId))
  }, [data, getRowId])
  const prevIds = useRef<Set<string>>(currentIds)
  const prevPage = useRef<number>(page)
  useEffect(() => {
    if (!selectable || !getRowId) return
    const before = prevIds.current
    const beforePage = prevPage.current
    prevIds.current = currentIds
    prevPage.current = page
    if (beforePage !== page) return
    const stale: string[] = []
    before.forEach((id) => {
      if (!currentIds.has(id) && selectedIds.has(id)) stale.push(id)
    })
    if (stale.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    update((prev) => {
      const next = new Set(prev)
      stale.forEach((id) => next.delete(id))
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIds, selectable, page])

  const toggleRow = useCallback(
    (id: string) => {
      update((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [update],
  )

  const pageSelectionState = useMemo<'all' | 'some' | 'none'>(() => {
    if (!selectable || !getRowId || data.length === 0) return 'none'
    let count = 0
    for (const row of data) if (selectedIds.has(getRowId(row))) count += 1
    if (count === 0) return 'none'
    if (count === data.length) return 'all'
    return 'some'
  }, [data, getRowId, selectable, selectedIds])

  const togglePage = useCallback(() => {
    if (!getRowId) return
    update((prev) => {
      const next = new Set(prev)
      if (pageSelectionState === 'all') for (const row of data) next.delete(getRowId(row))
      else for (const row of data) next.add(getRowId(row))
      return next
    })
  }, [data, getRowId, pageSelectionState, update])

  const cancel = useCallback(() => update(() => new Set<string>()), [update])

  return { selectedIds, toggleRow, togglePage, pageSelectionState, cancel }
}
