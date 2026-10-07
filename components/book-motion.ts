'use client'

import { useCallback, useRef } from 'react'

/* The ThreeUI documents animate a cover the same way — the board tips toward
   the pointer and a light sweep crosses it — where the tip is driven from the
   pointer's own position rather than a fixed hover pose. This is that motion,
   lifted onto the storefront's existing cards.

   Values are written as custom properties on the card's art element so the CSS
   keeps ownership of the transform; the pointer handler only reports where the
   reader is. Writes are batched to one animation frame, the tilt is capped
   small enough to read as a physical board rather than a gimmick, and a reader
   who asked for reduced motion gets the resting pose and none of the motion. */

const MAX_TILT_DEGREES = 8

export function useCoverTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const frame = useRef(0)

  const settle = useCallback(() => {
    const element = ref.current
    if (!element) return
    cancelAnimationFrame(frame.current)
    element.style.setProperty('--tilt-x', '0deg')
    element.style.setProperty('--tilt-y', '0deg')
    element.style.setProperty('--sheen-x', '50%')
    delete element.dataset.motion
  }, [])

  const track = useCallback((event: React.PointerEvent<T>) => {
    const element = ref.current
    if (!element || event.pointerType !== 'mouse') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      element.style.setProperty('--tilt-y', `${((x - .5) * 2 * MAX_TILT_DEGREES).toFixed(2)}deg`)
      element.style.setProperty('--tilt-x', `${((.5 - y) * 2 * MAX_TILT_DEGREES).toFixed(2)}deg`)
      element.style.setProperty('--sheen-x', `${(x * 100).toFixed(1)}%`)
      element.dataset.motion = 'tilt'
    })
  }, [])

  return { ref, track, settle }
}
