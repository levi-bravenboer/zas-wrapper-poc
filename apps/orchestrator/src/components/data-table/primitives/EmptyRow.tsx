import type { ReactNode } from 'react'

import { EmptyState } from '@/components/states'

import { Cell, Row } from './Table'

export interface EmptyRowProps {
  columnCount: number
  title: ReactNode
  body?: ReactNode
}

export function EmptyRow({ columnCount, title, body }: EmptyRowProps) {
  return (
    <Row>
      <Cell colSpan={columnCount} className="p-0">
        <EmptyState title={title} body={body} />
      </Cell>
    </Row>
  )
}
