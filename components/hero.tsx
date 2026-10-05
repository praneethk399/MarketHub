'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { books } from '@/data/books'

export function Hero() {
  const figureRef = useRef<HTMLElementTagNameMap['figure']>(null)
  const featuredBooks = [
    books.find((book) => book.id === 'great-gatsby'),
    books.find((book) => book.id === 'secret-garden')
  ].filter((book) => book !== undefined)

  useEffect(() => {
    const figure = figureRef.current
    if (!figure) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0

    const renderDepth = () => {
      currentX += (targetX - currentX) * .08
      currentY += (targetY - currentY) * .08
      figure.style.setProperty('--background-x', `${currentX * .25}px`)
      figure.style.setProperty('--background-y', `${currentY * .25}px`)
      figure.style.setProperty('--stack-x', `${currentX * .55}px`)
      figure.style.setProperty('--stack-y', `${currentY * .55}px`)
      figure.style.setProperty('--foreground-x', `${currentX}px`)
      figure.style.setProperty('--foreground-y', `${currentY}px`)
      figure.style.setProperty('--book-tilt', `${currentX * .08}deg`)

      if (Math.abs(targetX - currentX) > .04 || Math.abs(targetY - currentY) > .04) {
        frame = window.requestAnimationFrame(renderDepth)
      } else {
        currentX = targetX
        currentY = targetY
        frame = 0
      }
    }

    const moveDepth = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || reducedMotion.matches) return
      const bounds = figure.getBoundingClientRect()
      targetX = ((event.clientX - bounds.left) / bounds.width - .5) * 12
      targetY = ((event.clientY - bounds.top) / bounds.height - .5) * 12
      if (!frame) frame = window.requestAnimationFrame(renderDepth)
    }

    const resetDepth = () => {
      targetX = 0
      targetY = 0
      if (!frame) frame = window.requestAnimationFrame(renderDepth)
    }

    const resetForReducedMotion = () => {
      if (!reducedMotion.matches) return
      targetX = 0
      targetY = 0
      if (!frame) frame = window.requestAnimationFrame(renderDepth)
    }

    figure.addEventListener('pointermove', moveDepth)
    figure.addEventListener('pointerleave', resetDepth)
    reducedMotion.addEventListener('change', resetForReducedMotion)

    return () => {
      figure.removeEventListener('pointermove', moveDepth)
      figure.removeEventListener('pointerleave', resetDepth)
      reducedMotion.removeEventListener('change', resetForReducedMotion)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <section className="hero" id="top">
    <div className="hero-copy">
      <div className="breadcrumb">MARKETHUB <span>/</span> BOOKS</div>
      <h1>A practical shelf<br />for every kind of<br /><em>reader.</em></h1>
      <p>Discover new worlds, timeless classics, and ideas that inspire. Buy from trusted sellers, support local authors, and build your perfect library.</p>
      <div className="hero-actions"><a className="button button-primary" href="#books">Explore Books</a><a className="button button-outline" href="#bestsellers">Bestsellers</a></div>
    </div>
    <figure className="hero-figure" ref={figureRef} aria-label="A warmly lit library bookshelf">
      <div className="hero-photo-depth">
        <div className="hero-photo-drift">
          <Image className="hero-image" src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1800&q=90" alt="Warmly lit library shelves filled with well-loved books" fill priority sizes="(max-width: 900px) 100vw, 55vw" />
        </div>
      </div>
      <div className="hero-books" aria-hidden="true">
        {featuredBooks.map((book, index) => <div className={`hero-book ${index === 0 ? 'hero-book-back' : 'hero-book-front'}`} key={book.id}>
          <span className="hero-book-pages" />
          <Image src={book.cover} alt="" fill sizes="(max-width: 580px) 22vw, 90px" />
        </div>)}
      </div>
    </figure>
  </section>
}
