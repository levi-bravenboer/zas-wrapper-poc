export function initials(name: string | undefined): string {
  const parts = name?.trim().split(/\s+/u).filter(Boolean) ?? []
  if (!parts.length) return '??'
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '??'
}
