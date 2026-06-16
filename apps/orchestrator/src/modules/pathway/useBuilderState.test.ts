// Edge-shape tests retired in chain slot #2 §3 — `PathwayEdge` now resolves to
// the read-only `DerivedEdge` projection and the edge reducer is a no-op in §3.
// The patch-edge / delete-edge / reset suites are reauthored in §7 alongside the
// input-logic rule inspector, against the new fixtures. Placeholders kept so the
// intent stays visible without compiling against the removed edge-mutation shape.
import { describe, it } from 'vitest'

describe('useBuilderState — edge suites (retired pending §7)', () => {
  it.todo('patch-edge updates the matching edge and pushes history')
  it.todo('patch-edge undo restores the pre-patch edge')
  it.todo('read-only dispatch guard drops mutating actions when not concept')
  it.todo('read-only dispatch guard still applies select actions')
  it.todo('reset preserves an edge selection that survives the new version')
  it.todo('reset clears the selection when the selected edge is gone')
})
