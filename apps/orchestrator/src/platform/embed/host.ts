import { env } from '@/config/env'

const SOURCE = 'zas-embed' as const

export type EmbedOutboundMessage =
  | { source: typeof SOURCE; type: 'ready' }
  | { source: typeof SOURCE; type: 'resize'; height: number }
  | { source: typeof SOURCE; type: 'navigate'; path: string }
  | { source: typeof SOURCE; type: 'close' }
  | { source: typeof SOURCE; type: 'error'; code: string; message: string }

export type EmbedInboundMessage =
  | { source: typeof SOURCE; type: 'host-navigate'; path: string }
  | { source: typeof SOURCE; type: 'host-context'; payload: unknown }

export type EmbedInboundHandler = (msg: EmbedInboundMessage) => void

export function isInIframe(): boolean {
  if (typeof window === 'undefined') return false
  return window.self !== window.top
}

function targetOrigin(): string | null {
  return env.EMBED_HOST_ORIGIN ?? null
}

function postToParent(message: EmbedOutboundMessage): void {
  if (!isInIframe()) return
  const origin = targetOrigin()
  if (!origin) return
  window.parent.postMessage(message, origin)
}

export function postReady(): void {
  postToParent({ source: SOURCE, type: 'ready' })
}

export function postResize(height: number): void {
  postToParent({ source: SOURCE, type: 'resize', height })
}

export function postNavigate(path: string): void {
  postToParent({ source: SOURCE, type: 'navigate', path })
}

export function postClose(): void {
  postToParent({ source: SOURCE, type: 'close' })
}

export function postError(code: string, message: string): void {
  postToParent({ source: SOURCE, type: 'error', code, message })
}

export function subscribeToHost(handler: EmbedInboundHandler): () => void {
  if (typeof window === 'undefined') return () => {}
  const allowed = targetOrigin()
  const listener = (event: MessageEvent): void => {
    if (allowed && event.origin !== allowed) return
    const data = event.data as Partial<EmbedInboundMessage> | null
    if (!data || data.source !== SOURCE) return
    if (data.type !== 'host-navigate' && data.type !== 'host-context') return
    handler(data as EmbedInboundMessage)
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}

export function observeResize(target: HTMLElement, onResize: (height: number) => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {}
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    onResize(Math.ceil(entry.contentRect.height))
  })
  observer.observe(target)
  return () => observer.disconnect()
}
