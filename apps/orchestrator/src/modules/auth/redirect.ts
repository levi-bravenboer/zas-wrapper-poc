export function safeRedirect(raw: string | undefined): string {
  if (!raw) return '/'
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//')) return '/'
  if (raw.includes('\\')) return '/'
  if (raw === '/login') return '/'
  return raw
}
