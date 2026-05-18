export type DataTableFilter<T> =
  | {
      type: 'select'
      key: keyof T & string
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
    }
  | {
      type: 'multi'
      key: keyof T & string
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
    }
  | { type: 'date-range'; key: keyof T & string; label: string }
  | { type: 'text'; key: keyof T & string; label: string }
