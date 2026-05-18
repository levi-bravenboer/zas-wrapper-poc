type DragGhostOptions = {
  label: string
  iconText: string
  width: number
  height: number
  zoom: number
}

export function createBlockDragGhost(options: DragGhostOptions): HTMLDivElement {
  const { label, iconText, width: w, height: h, zoom } = options
  const accentCol = Math.max(2, Math.round(4 * zoom))
  const iconCol = Math.max(20, Math.round(36 * zoom))
  const iconSize = Math.max(16, Math.round(28 * zoom))
  const titleFs = Math.max(9, 13 * zoom)
  const subFs = Math.max(8, 11.5 * zoom)
  const padTop = Math.max(4, 8 * zoom)

  const wrapper = document.createElement('div')
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.style.position = 'fixed'
  wrapper.style.top = '-9999px'
  wrapper.style.left = '-9999px'
  wrapper.style.pointerEvents = 'none'
  wrapper.style.width = `${w}px`
  wrapper.style.height = `${h}px`
  wrapper.style.display = 'grid'
  wrapper.style.gridTemplateColumns = `${accentCol}px ${iconCol}px 1fr`
  wrapper.style.gridTemplateRows = 'auto auto'
  wrapper.style.borderRadius = `${Math.max(3, 6 * zoom)}px`
  wrapper.style.border = '1px solid var(--color-border, #d4d8de)'
  wrapper.style.background = 'var(--card, #ffffff)'
  wrapper.style.boxShadow = '0 8px 24px rgba(11,26,23,0.18)'
  wrapper.style.font = `600 ${titleFs}px Inter, system-ui, sans-serif`
  wrapper.style.color = '#0b1a17'

  const accentBar = document.createElement('div')
  accentBar.style.gridRow = '1 / span 2'
  accentBar.style.background = 'var(--color-primary, #2f7d6b)'
  accentBar.style.borderTopLeftRadius = `${Math.max(2, 5 * zoom)}px`
  accentBar.style.borderBottomLeftRadius = `${Math.max(2, 5 * zoom)}px`
  wrapper.appendChild(accentBar)

  const iconWrap = document.createElement('div')
  iconWrap.style.gridRow = '1 / span 2'
  iconWrap.style.margin = `auto 0 auto ${Math.max(2, 4 * zoom)}px`
  iconWrap.style.height = `${iconSize}px`
  iconWrap.style.width = `${iconSize}px`
  iconWrap.style.borderRadius = `${Math.max(2, 4 * zoom)}px`
  iconWrap.style.background = 'color-mix(in srgb, var(--color-primary, #2f7d6b) 12%, #ffffff)'
  iconWrap.style.display = 'inline-flex'
  iconWrap.style.alignItems = 'center'
  iconWrap.style.justifyContent = 'center'
  iconWrap.style.color = 'var(--color-primary, #2f7d6b)'
  iconWrap.style.fontSize = `${Math.max(10, 14 * zoom)}px`
  iconWrap.textContent = iconText
  wrapper.appendChild(iconWrap)

  const text = document.createElement('div')
  text.style.padding = `${padTop}px ${Math.max(4, 10 * zoom)}px 0 0`
  text.style.display = 'flex'
  text.style.flexDirection = 'column'
  text.style.gap = `${Math.max(1, 2 * zoom)}px`
  text.style.minWidth = '0'
  const title = document.createElement('span')
  title.textContent = label
  title.style.fontWeight = '600'
  title.style.fontSize = `${titleFs}px`
  title.style.overflow = 'hidden'
  title.style.textOverflow = 'ellipsis'
  title.style.whiteSpace = 'nowrap'
  text.appendChild(title)
  const sub = document.createElement('span')
  sub.textContent = label
  sub.style.fontSize = `${subFs}px`
  sub.style.color = '#6b7480'
  text.appendChild(sub)
  wrapper.appendChild(text)

  return wrapper
}
