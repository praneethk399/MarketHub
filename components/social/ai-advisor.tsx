'use client'

import { useState, type FormEvent } from 'react'
import { Sparkles } from 'lucide-react'

type Pick = {
  label: string
  target: { type: string; id: string; title: string; author: string; price: number | null }
  why: string[]
}

const suggestions = [
  'Best value book under ₹500',
  'Recommend a mystery novel',
  'Compare sellers for The Hobbit',
  'Gift idea for a beginner reader under ₹600',
]

/** AI Shopping Advisor — decision assistant with explained trade-offs (spec §27). */
export function AiAdvisor({ bookTitle }: { bookTitle?: string }) {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [picks, setPicks] = useState<Pick[]>([])
  const [toolsUsed, setToolsUsed] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ask = async (question: string) => {
    if (question.trim().length < 2) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question.trim() }),
      })
      const payload = await response.json() as { data?: { reply: string; picks: Pick[]; toolsUsed: string[] }; error?: string }
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'The advisor could not answer.')
      setReply(payload.data.reply)
      setPicks(payload.data.picks)
      setToolsUsed(payload.data.toolsUsed)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The advisor could not answer.')
    } finally {
      setLoading(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void ask(message)
  }

  return <section className="social-panel" aria-labelledby="ai-advisor">
    <h3 id="ai-advisor"><Sparkles size={16} aria-hidden="true" /> AI Shopping Advisor<span className="heading-period">.</span></h3>
    <p className="social-meta">
      Ask for a recommendation, comparison or gift idea. Answers come from marketplace data only — your network signals are
      used only when you are signed in and your friends have shared them.
    </p>
    <form className="advisor-form" onSubmit={submit}>
      <label className="sr-only" htmlFor="advisor-input">Ask the shopping advisor</label>
      <input
        id="advisor-input"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={bookTitle ? `Ask about “${bookTitle}” or anything else…` : 'I need a cybersecurity book under ₹1,000.'}
        maxLength={1000}
      />
      <button className="button" type="submit" disabled={loading}>{loading ? 'Thinking…' : 'Ask'}</button>
    </form>
    <div className="advisor-suggestions">
      {suggestions.map((suggestion) => (
        <button key={suggestion} type="button" onClick={() => { setMessage(suggestion); void ask(suggestion) }}>{suggestion}</button>
      ))}
    </div>
    {error && <p className="social-empty" role="alert">{error}</p>}
    {reply && <div className="advisor-reply">
      <p>{reply}</p>
      <div className="advisor-picks">
        {picks.map((pick) => (
          <article key={`${pick.label}-${pick.target.id}`}>
            <span className="advisor-label">{pick.label}</span>
            <h4><a href={`/books/${pick.target.id}`}>{pick.target.title}</a></h4>
            <small>{pick.target.author}{pick.target.price !== null ? ` · ₹${pick.target.price}` : ''}</small>
            <ul>{pick.why.filter(Boolean).map((reason) => <li key={reason}>✓ {reason}</li>)}</ul>
          </article>
        ))}
      </div>
      <p className="social-meta">Tools used: {toolsUsed.join(', ')} (read-only, allowlisted).</p>
    </div>}
  </section>
}
