import { useEffect, useState, type RefObject } from 'react'

export function useStickyHorizontalScroll(ref: RefObject<HTMLElement | null>): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScrolled(el.scrollLeft > 0)
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [ref])
  return scrolled
}
