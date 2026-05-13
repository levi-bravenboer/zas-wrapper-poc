import { render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useIsEmbed, useIsSmart, useSurface, useSurfaceBasePath } from '@/platform/surface/hooks'
import { SURFACES } from '@/platform/surface/registry'
import { SurfaceProvider } from '@/platform/surface/SurfaceProvider'

describe('surface registry', () => {
  it('exposes exactly three surfaces with the documented descriptors', () => {
    expect(Object.keys(SURFACES).sort()).toEqual(['app', 'embed', 'smart'])
    expect(SURFACES.app).toEqual({
      id: 'app',
      data: 'orchestrator',
      shell: 'menu',
      basePath: '/',
    })
    expect(SURFACES.smart).toEqual({
      id: 'smart',
      data: 'fhir',
      shell: 'menu',
      basePath: '/s',
    })
    expect(SURFACES.embed).toEqual({
      id: 'embed',
      data: 'fhir',
      shell: 'bare',
      basePath: '/embed',
    })
  })

  it('freezes each surface descriptor', () => {
    expect(Object.isFrozen(SURFACES)).toBe(true)
    expect(Object.isFrozen(SURFACES.app)).toBe(true)
    expect(Object.isFrozen(SURFACES.embed)).toBe(true)
  })
})

describe('SurfaceProvider', () => {
  it('exposes the active surface via useSurface', () => {
    function Probe(): string {
      return useSurface().id
    }
    render(
      <SurfaceProvider surface={SURFACES.embed}>
        <Probe />
      </SurfaceProvider>,
    )
    expect(screen.getByText('embed')).toBeInTheDocument()
  })

  it('throws when useSurface is called without a provider', () => {
    expect(() => renderHook(() => useSurface())).toThrow(
      'useSurface called outside SurfaceProvider',
    )
  })
})

describe('surface-derived helpers', () => {
  it('useIsEmbed returns true only inside the embed surface', () => {
    const { result: embedResult } = renderHook(() => useIsEmbed(), {
      wrapper: ({ children }) => (
        <SurfaceProvider surface={SURFACES.embed}>{children}</SurfaceProvider>
      ),
    })
    expect(embedResult.current).toBe(true)

    const { result: appResult } = renderHook(() => useIsEmbed(), {
      wrapper: ({ children }) => (
        <SurfaceProvider surface={SURFACES.app}>{children}</SurfaceProvider>
      ),
    })
    expect(appResult.current).toBe(false)
  })

  it('useIsSmart returns true only inside the smart surface', () => {
    const { result: smartResult } = renderHook(() => useIsSmart(), {
      wrapper: ({ children }) => (
        <SurfaceProvider surface={SURFACES.smart}>{children}</SurfaceProvider>
      ),
    })
    expect(smartResult.current).toBe(true)

    const { result: embedResult } = renderHook(() => useIsSmart(), {
      wrapper: ({ children }) => (
        <SurfaceProvider surface={SURFACES.embed}>{children}</SurfaceProvider>
      ),
    })
    expect(embedResult.current).toBe(false)
  })

  it('useSurfaceBasePath returns the active surface base path', () => {
    const { result: appResult } = renderHook(() => useSurfaceBasePath(), {
      wrapper: ({ children }) => (
        <SurfaceProvider surface={SURFACES.app}>{children}</SurfaceProvider>
      ),
    })
    expect(appResult.current).toBe('/')

    const { result: smartResult } = renderHook(() => useSurfaceBasePath(), {
      wrapper: ({ children }) => (
        <SurfaceProvider surface={SURFACES.smart}>{children}</SurfaceProvider>
      ),
    })
    expect(smartResult.current).toBe('/s')
  })
})
