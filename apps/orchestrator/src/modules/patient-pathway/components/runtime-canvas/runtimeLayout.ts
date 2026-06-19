export interface LayoutInput {
  id: string
  width: number
  height: number
}

export interface LayoutEdge {
  source: string
  target: string
}

export interface RuntimeLayout {
  positions: Map<string, { x: number; y: number }>
  width: number
  height: number
}

const GAP_X = 72
const GAP_Y = 40

// Layered ("Sugiyama-lite") auto-layout computed purely from the flow graph —
// not the builder's block coordinates. Longest-path ranking gives the columns
// (left → right); within a column, nodes are placed to align their vertical
// centre with their parents, so a sequential chain renders as one straight
// line. Greedy bottom packing keeps siblings from overlapping. Wide blocks
// (e.g. Luscii) get their own column width.
export function computeRuntimeLayout(nodes: LayoutInput[], edges: LayoutEdge[]): RuntimeLayout {
  if (nodes.length === 0) return { positions: new Map(), width: 0, height: 0 }

  const ids = new Set(nodes.map((n) => n.id))
  const dim = new Map(nodes.map((n) => [n.id, n]))
  const outs = new Map<string, string[]>()
  const ins = new Map<string, string[]>()
  for (const n of nodes) {
    outs.set(n.id, [])
    ins.set(n.id, [])
  }
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target) && e.source !== e.target) {
      outs.get(e.source)?.push(e.target)
      ins.get(e.target)?.push(e.source)
    }
  }

  // Longest-path rank via Kahn's algorithm.
  const indeg = new Map(nodes.map((n) => [n.id, ins.get(n.id)?.length ?? 0]))
  const rank = new Map<string, number>()
  const queue: string[] = []
  for (const n of nodes) {
    if ((indeg.get(n.id) ?? 0) === 0) {
      rank.set(n.id, 0)
      queue.push(n.id)
    }
  }
  while (queue.length > 0) {
    const u = queue.shift() as string
    const ru = rank.get(u) ?? 0
    for (const v of outs.get(u) ?? []) {
      rank.set(v, Math.max(rank.get(v) ?? 0, ru + 1))
      const d = (indeg.get(v) ?? 0) - 1
      indeg.set(v, d)
      if (d === 0) queue.push(v)
    }
  }
  for (const n of nodes) if (!rank.has(n.id)) rank.set(n.id, 0) // cycle fallback

  const maxRank = Math.max(0, ...nodes.map((n) => rank.get(n.id) ?? 0))
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => [])
  for (const n of nodes) layers[rank.get(n.id) ?? 0]?.push(n.id)

  // Column x from cumulative max widths per rank.
  const rankWidth = layers.map((layer) =>
    Math.max(0, ...layer.map((id) => dim.get(id)?.width ?? 0)),
  )
  const rankX: number[] = []
  for (let r = 0; r <= maxRank; r++) {
    rankX[r] = r === 0 ? 0 : (rankX[r - 1] ?? 0) + (rankWidth[r - 1] ?? 0) + GAP_X
  }

  // Y: align centres to parents (straightens chains), then greedy-pack to avoid
  // overlap within a column.
  const centerY = new Map<string, number>()
  const top = new Map<string, number>()
  for (let r = 0; r <= maxRank; r++) {
    const layer = layers[r] ?? []
    const desired = new Map<string, number>()
    for (const id of layer) {
      const parents = (ins.get(id) ?? []).filter((p) => centerY.has(p))
      const d = parents.length
        ? parents.reduce((s, p) => s + (centerY.get(p) ?? 0), 0) / parents.length
        : 0
      desired.set(id, d)
    }
    const ordered = [...layer].sort((a, b) => (desired.get(a) ?? 0) - (desired.get(b) ?? 0))
    let lastBottom = Number.NEGATIVE_INFINITY
    for (const id of ordered) {
      const h = dim.get(id)?.height ?? 0
      const t = Math.max((desired.get(id) ?? 0) - h / 2, lastBottom + GAP_Y)
      top.set(id, t)
      centerY.set(id, t + h / 2)
      lastBottom = t + h
    }
  }

  const positions = new Map<string, { x: number; y: number }>()
  let width = 0
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0
    const x = (rankX[r] ?? 0) + ((rankWidth[r] ?? 0) - n.width) / 2
    const y = top.get(n.id) ?? 0
    positions.set(n.id, { x, y })
    width = Math.max(width, x + n.width)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y + n.height)
  }
  // Normalise so the topmost node sits at y = 0.
  if (minY !== Number.POSITIVE_INFINITY && minY !== 0) {
    for (const [id, p] of positions) positions.set(id, { x: p.x, y: p.y - minY })
    maxY -= minY
  }

  return { positions, width, height: maxY === Number.NEGATIVE_INFINITY ? 0 : maxY }
}
