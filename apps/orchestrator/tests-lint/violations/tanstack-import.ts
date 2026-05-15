// Fixture: importing @tanstack/react-table outside src/components/data-table/**.
// Must trigger `no-restricted-imports` (§26.2).
import { useReactTable } from '@tanstack/react-table'

export const t = useReactTable
