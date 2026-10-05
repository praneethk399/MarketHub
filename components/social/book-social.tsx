'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, BookOpenCheck, Heart, Star, Users } from 'lucide-react'

type ReviewDto = {
  id: string
  rating: number
  title: string | null
  content: string
  verified: boolean
  containsSpoilers: boolean
  createdAt: string
  finished: boolean
  author: { id: string; name: string; avatar: string | null }
}

type SocialDto = {
  community: { rating: number | null; count: number }
  network: { rating: number | null; count: number } | null
  friendReviews: ReviewDto[]
  friendRecommended: { count: number }
  friendsAlsoBought: { count: number } | null
  viewer: { authenticated: boolean; friendCount: number }
  reviews: ReviewDto[]
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="social-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={14} aria-hidden="true" className={value <= Math.round(rating) ? 'social-star-on' : 'social-star-off'} />
      ))}
    </span>
  )
}

function ReviewCard({ review, relationship }: { review: ReviewDto; relationship: 'friend' | 'community' }) {
  const [revealed, setRevealed] = useState(!review.containsSpoilers)
  return <article className="social-review">
    <header>
      <strong>{review.author.name}</strong>
      {relationship === 'friend' && <span className="social-chip">You know them</span>}
    </header>
    <Stars rating={review.rating} />
    {review.title && <h4>{review.title}</h4>}
    {review.containsSpoilers && !revealed
      ? <div className="social-spoiler">
          <p>⚠ Contains possible spoilers</p>
          <button type="button" className="button button-outline" onClick={() => setRevealed(true)}>Show More</button>
        </div>
      : <p>{review.content}</p>}
    <footer>
      {review.verified && <span className="social-trust"><BadgeCheck size={14} aria-hidden="true" /> Verified Purchase</span>}
      {review.finished && <span className="social-trust"><BookOpenCheck size={14} aria-hidden="true" /> Purchased and Finished</span>}
      <span className="social-meta">{new Date(review.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}</span>
    </footer>
  </article>
}

/** Friends' reviews + trusted rating + social badges (spec §7–§10). */
export function BookSocial({ bookId }: { bookId: string }) {
  const [social, setSocial] = useState<SocialDto | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [reviewError, setReviewError] = useState('')
  const [reviewStatus, setReviewStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/books/${encodeURIComponent(bookId)}/social`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Social request failed (${response.status}).`)
        const payload = await response.json() as { data: SocialDto }
        setSocial(payload.data)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        console.error('[MarketHub] social data unavailable', cause)
        setError('Social signals are unavailable right now. Community reviews still work.')
      })
    return () => controller.abort()
  }, [bookId, refresh])

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setSubmitting(true)
    setReviewError('')
    setReviewStatus('')
    try {
      const response = await fetch(`/api/books/${encodeURIComponent(bookId)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: Number(data.get('rating')),
          title: String(data.get('title') ?? '').trim() || undefined,
          content: String(data.get('content') ?? ''),
          visibility: String(data.get('visibility') ?? 'PUBLIC'),
          containsSpoilers: data.get('containsSpoilers') === 'on',
        }),
      })
      const payload = await response.json().catch(() => ({})) as {
        error?: string | { message?: string }
      }
      if (!response.ok) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message ?? `Review could not be submitted (${response.status}).`)
      }
      form.reset()
      setReviewStatus('Your verified-purchase review has been submitted.')
      setRefresh((value) => value + 1)
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : 'Review could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <section className="social-panel" role="status"><h3>Trusted reviews</h3><p className="social-empty">{error}</p></section>
  if (!social) return <section className="social-panel"><h3>Trusted reviews</h3><p className="social-empty">Loading community and network signals…</p></section>

  const communityReviews = social.reviews.filter((review) => !social.friendReviews.some((friend) => friend.id === review.id))
  const hasNetwork = Boolean(social.network && social.network.count > 0) || social.friendReviews.length > 0

  return <section className="social-panel" aria-labelledby="trusted-reviews">
    <h3 id="trusted-reviews">Trusted reviews<span className="heading-period">.</span></h3>
    <div className="social-ratings">
      <div className="social-rating-card">
        <span>Community</span>
        <strong>{social.community.rating === null ? 'Not enough data' : `${social.community.rating} / 5`}</strong>
        <small>{social.community.count} marketplace {social.community.count === 1 ? 'review' : 'reviews'}</small>
      </div>
      <div className="social-rating-card">
        <span>Your Network</span>
        <strong>{hasNetwork ? `${social.network?.rating ?? '—'} / 5` : social.viewer.authenticated ? 'Not enough data' : 'Sign in to see'}</strong>
        <small>
          {social.viewer.authenticated
            ? social.friendReviews.length
              ? `${social.friendReviews.length} ${social.friendReviews.length === 1 ? 'person' : 'people'} you know reviewed this book`
              : 'No network reviews yet — showing community reviews'
            : 'Connect with friends to see what they think'}
        </small>
      </div>
    </div>

    <div className="social-badges">
      {social.friendRecommended.count > 0 && <span className="social-badge"><Heart size={14} aria-hidden="true" /> Friend recommended — {social.friendRecommended.count} in your network shared this with you</span>}
      {social.friendsAlsoBought && social.friendsAlsoBought.count > 0 && (
        <span className="social-badge"><Users size={14} aria-hidden="true" /> {social.friendsAlsoBought.count} people in your network own this book</span>
      )}
    </div>

    {social.friendReviews.length > 0 && <div className="social-review-list">
      <h4 className="social-subhead">From people you know</h4>
      {social.friendReviews.map((review) => <ReviewCard key={review.id} review={review} relationship="friend" />)}
    </div>}

    {social.viewer.authenticated
      ? <form className="social-review-form" onSubmit={submitReview}>
          <h4>Write a review</h4>
          <p className="social-meta">Reviews require a completed purchase. Your visibility choice is respected throughout the community.</p>
          <label>Rating
            <select name="rating" defaultValue="5" required>
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
            </select>
          </label>
          <label>Title (optional)
            <input name="title" maxLength={120} minLength={2} />
          </label>
          <label>Review
            <textarea name="content" minLength={20} maxLength={4000} required />
          </label>
          <label>Who can see this review?
            <select name="visibility" defaultValue="PUBLIC">
              <option value="PUBLIC">Everyone</option>
              <option value="FRIENDS">Friends</option>
              <option value="PRIVATE">Only me</option>
            </select>
          </label>
          <label><span><input name="containsSpoilers" type="checkbox" /> Contains spoilers</span></label>
          <button className="button" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit verified review'}</button>
          {reviewError && <p className="social-error" role="alert">{reviewError}</p>}
          {reviewStatus && <p className="social-success" role="status">{reviewStatus}</p>}
        </form>
      : <p className="social-meta">Sign in and purchase this book to leave a verified review.</p>}

    <div className="social-review-list">
      <h4 className="social-subhead">Community reviews</h4>
      {communityReviews.length
        ? communityReviews.map((review) => <ReviewCard key={review.id} review={review} relationship="community" />)
        : <p className="social-empty">No community reviews are visible to you yet.</p>}
    </div>
  </section>
}
