import { Skeleton } from '@/components/ui/skeleton'

import { Cell, Row } from './Table'

export interface LoadingRowsProps {
  columnCount: number
  rowCount?: number
}

export function LoadingRows({ columnCount, rowCount = 5 }: LoadingRowsProps) {
  const cols = Math.max(columnCount, 1)
  return (
    <>
      {Array.from({ length: rowCount }, (_, r) => (
        <Row key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <Cell key={c}>
              <Skeleton className="h-4 w-full" />
            </Cell>
          ))}
        </Row>
      ))}
    </>
  )
}
