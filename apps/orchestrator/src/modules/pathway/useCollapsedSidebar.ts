import { useEffect, useRef } from 'react'

import { useSidebar } from '@/components/ui/sidebar'

export function useCollapsedSidebar(): void {
  const { open, setOpen } = useSidebar()
  const initialRef = useRef(open)
  const setOpenRef = useRef(setOpen)

  useEffect(() => {
    setOpenRef.current = setOpen
  })

  useEffect(() => {
    const restore = initialRef.current
    setOpenRef.current(false)
    return () => setOpenRef.current(restore)
  }, [])
}
