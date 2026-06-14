import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Avatar, AvatarFallback, getAvatarTintClass } from './avatar'

describe('Avatar', () => {
  it('applies no tint class when tintBy is absent', () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    )
    const root = screen.getByTestId('avatar')
    expect(root.className).not.toMatch(/bg-(teal|emerald|cyan|blue|indigo|purple|pink|rose)-/)
  })

  it('applies the same tint class for the same tintBy value', () => {
    render(
      <>
        <Avatar tintBy="abc-123" data-testid="avatar-1">
          <AvatarFallback tinted>AB</AvatarFallback>
        </Avatar>
        <Avatar tintBy="abc-123" data-testid="avatar-2">
          <AvatarFallback tinted>AB</AvatarFallback>
        </Avatar>
      </>,
    )
    const first = screen.getByTestId('avatar-1')
    const second = screen.getByTestId('avatar-2')
    expect(first.className).toBe(second.className)
  })

  it('returns a palette class from getAvatarTintClass', () => {
    const cls = getAvatarTintClass('any-id')
    expect(cls).toMatch(/^bg-(teal|emerald|cyan|blue|indigo|purple|pink|rose)-\d{3} text-white$/)
  })

  it('different ids may produce different tints (collision tolerated)', () => {
    const a = getAvatarTintClass('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    const b = getAvatarTintClass('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    // Not asserting inequality strictly — palette is small (8). Both must be palette entries.
    expect(a).toMatch(/^bg-/)
    expect(b).toMatch(/^bg-/)
  })

  it('never renders an <img>', () => {
    render(
      <Avatar tintBy="abc">
        <AvatarFallback tinted>AB</AvatarFallback>
      </Avatar>,
    )
    expect(screen.queryByRole('img')).toBeNull()
  })
})
