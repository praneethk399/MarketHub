'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { useStorefront } from './storefront'
import { Chapter, ViteButton } from './vite-shell'

const AUTH_IMAGE = '/images/bookstore-couple.jpg'

const ROLES = {
  customer: { label: 'Customer', title: 'Your reading room, wherever you are.', copy: 'Save books, follow orders, and get a more personal shelf every time you visit.', destination: '/library' },
} as const

/** Auth, in the Vite split-screen look, performing the real register/login. */
export function ViteAuthPage({ kind }: { kind: 'login' | 'register' }) {
  const { authenticate } = useStorefront()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const role = ROLES.customer
  const isRegister = kind === 'register'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await authenticate(isRegister ? 'register' : 'login', {
        name: isRegister ? String(fields.get('name') ?? '') : undefined,
        email: String(fields.get('email') ?? ''),
        password: String(fields.get('password') ?? ''),
      })
      router.push(role.destination)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not authenticate.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page auth-page-roles">
      <div className="auth-visual" style={{ backgroundImage: `linear-gradient(145deg, rgba(11,11,12,.14), rgba(11,11,12,.93)), url(${AUTH_IMAGE})` }}>
        <Link href="/" className="wordmark wordmark-light" aria-label="MarketHub home">
          <span className="book-mark" aria-hidden="true">
            <svg viewBox="0 0 34 26" role="presentation">
              <path d="M3 4.5c5.1-1.9 9.6-.9 14 3.1 4.4-4 8.9-5 14-3.1v16.8c-5-1.8-9.6-.8-14 3.2-4.4-4-9-5-14-3.2V4.5Z" />
              <path d="M17 7.6v16.9" />
              <path d="M7.1 9.1c2.9-.4 5.9.4 8.3 2.1M26.9 9.1c-2.9-.4-5.9.4-8.3 2.1" />
            </svg>
          </span>
          MARKETHUB
        </Link>
        <div>
          <span className="auth-kicker">Shop smarter</span>
          <h1>{role.title}</h1>
          <p>{role.copy}</p>
        </div>
        <div className="auth-visual-footer"><span>MARKETHUB IDENTITY</span><span>Secure access</span></div>
      </div>
      <div className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <Chapter>MarketHub / {isRegister ? 'Create account' : 'Sign in'}</Chapter>
          <h2>{isRegister ? 'Create your account.' : 'Welcome back, reader.'}</h2>
          <p className="auth-note">{isRegister
            ? 'One account keeps your bag, saved shelf and reading progress in step across devices.'
            : 'Your bag and shelves, exactly where you left them.'}</p>
          {isRegister && (
            <div className="field"><label htmlFor="auth-name">Full name</label><input id="auth-name" name="name" autoComplete="name" minLength={2} maxLength={80} required /></div>
          )}
          <div className="field"><label htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" autoComplete="email" maxLength={254} required /></div>
          <div className="field"><label htmlFor="auth-password">Password</label><input id="auth-password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required /></div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="btn-row">
            <ViteButton type="submit" variant="primary" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</ViteButton>
            <ViteButton to={isRegister ? '/login' : '/register'} variant="ghost">
              {isRegister ? 'Already have an account? Sign in' : 'New to MarketHub? Create an account'}
            </ViteButton>
          </div>
          <p className="auth-fineprint">Sessions are cookie-based and same-origin. Passwords are hashed server-side; no third-party identity provider is involved.</p>
        </form>
      </div>
    </div>
  )
}
