import { type LucideIcon } from 'lucide-react'

export type CommandEntry = {
  id: string
  label: string
  group: string
  icon?: LucideIcon
  shortcut?: string
  keywords?: readonly string[]
  perform: () => void | Promise<void>
}
