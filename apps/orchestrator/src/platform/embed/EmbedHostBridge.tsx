import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'

import {
  observeResize,
  postNavigate,
  postReady,
  postResize,
  subscribeToHost,
} from '@/platform/embed/host'

interface EmbedHostBridgeProps {
  children: ReactNode
}

export function EmbedHostBridge({ children }: EmbedHostBridgeProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { location } = useRouterState()

  useEffect(() => {
    postReady()
  }, [])

  useEffect(() => {
    const target = containerRef.current
    if (!target) return
    return observeResize(target, postResize)
  }, [])

  useEffect(() => {
    postNavigate(location.pathname + (location.searchStr ?? ''))
  }, [location.pathname, location.searchStr])

  useEffect(() => {
    return subscribeToHost((msg) => {
      if (msg.type === 'host-navigate') {
        void router.navigate({ to: msg.path })
      }
    })
  }, [router])

  return <div ref={containerRef}>{children}</div>
}
