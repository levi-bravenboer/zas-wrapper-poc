import { useEffect } from 'react'

import { useSidebar } from '@/components/ui/sidebar'

export function useCollapsedSidebar(): void {
  const { open, setOpen } = useSidebar()
  useEffect(() => {
    const previous = open
    setOpen(false)
    return () => setOpen(previous)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
