'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { useStorefront } from '@/components/storefront'

type FriendDto = { friendshipId: string; status: string; direction: string; since: string; user: { id: string; name: string } }
type FriendsPayload = { friends: FriendDto[]; incoming: FriendDto[]; outgoing: FriendDto[]; blocked: FriendDto[] }
type Privacy = { reviews: string; purchases: string; reading: string; defaultListVisibility: string; recommendations: string }
type ListItem = { id: string; targetType: string; targetId: string; note: string | null; preferred: boolean; addedBy: { id: string; name: string } | null; target: { title: string; author: string } | null }
type SocialList = { id: string; title: string; description: string | null; visibility: string; myRole: string | null; itemCount: number; items: ListItem[]; owner: { id: string; name: string }; members?: { userId: string; name: string; role: string }[] }
type Recommendation = { id: string; message: string | null; createdAt: string; target: { id: string; title: string; price: number | null } | null; sender?: { name: string }; recipient?: { name: string } }

const privacyOptions: Record<string, string[]> = {
  reviews: ['PRIVATE', 'FRIENDS', 'PUBLIC'],
  purchases: ['PRIVATE', 'LIMITED'],
  reading: ['PRIVATE', 'FRIENDS', 'PUBLIC'],
  defaultListVisibility: ['PRIVATE', 'SHARED', 'PUBLIC'],
}

const privacyCopy: Record<string, { title: string; who: string; why: string }> = {
  reviews: { title: 'Reviews', who: 'Who can see this?', why: 'Controls who can read the reviews you write. Private reviews are only visible to you.' },
  purchases: { title: 'Purchases', who: 'Who can see this?', why: 'LIMITED lets your purchases power anonymous counts like “5 people in your network own this” without ever showing what you bought.' },
  reading: { title: 'Reading activity', who: 'Who can see this?', why: 'Controls who can see your reading progress. Your private notes are never shown to anyone.' },
  defaultListVisibility: { title: 'New lists', who: 'Who can see this?', why: 'The visibility applied to lists you create. You can change it per list at any time.' },
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const payload = await response.json().catch(() => ({})) as {
    data?: T
    error?: string | { message?: string }
  }
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
    throw new Error(message ?? `Request failed (${response.status}).`)
  }
  return payload.data as T
}

/** Settings → Privacy & Social (spec §37/§38) plus friends, lists and recommendations. */
export default function SocialHubPage() {
  const { addToCart } = useStorefront()
  const [tab, setTab] = useState<'friends' | 'privacy' | 'lists' | 'recommendations'>('friends')
  const [friends, setFriends] = useState<FriendsPayload | null>(null)
  const [privacy, setPrivacy] = useState<Privacy | null>(null)
  const [lists, setLists] = useState<SocialList[]>([])
  const [recommendations, setRecommendations] = useState<{ received: Recommendation[]; sent: Recommendation[] } | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [friendData, privacyData, listData, recommendationData] = await Promise.all([
        api<FriendsPayload>('/api/social/friends'),
        api<Privacy>('/api/privacy'),
        api<SocialList[]>('/api/lists'),
        api<{ received: Recommendation[]; sent: Recommendation[] }>('/api/social/recommendations'),
      ])
      setFriends(friendData)
      setPrivacy(privacyData)
      setLists(listData)
      setRecommendations(recommendationData)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in to use social features.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const act = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action()
      setStatus(success)
      setError('')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That action could not be completed.')
    }
  }

  const addFriend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const email = String(new FormData(form).get('email') ?? '')
    void act(async () => api('/api/social/friends', { method: 'POST', body: JSON.stringify({ email }) }), 'Friend request sent.')
    form.reset()
  }

  const savePrivacy = (key: string, value: string) => {
    void act(async () => api('/api/privacy', { method: 'PATCH', body: JSON.stringify({ [key]: value }) }), 'Privacy updated.')
  }

  const createList = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const title = String(data.get('title') ?? '')
    const visibility = String(data.get('visibility') ?? 'PRIVATE')
    const description = String(data.get('description') ?? '')
    void act(async () => api('/api/lists', { method: 'POST', body: JSON.stringify({ title, visibility, description: description || undefined }) }), 'List created.')
    form.reset()
  }

  const addBookToList = (listId: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const targetId = String(new FormData(form).get('bookId') ?? '')
    void act(async () => api(`/api/lists/${listId}/items`, { method: 'POST', body: JSON.stringify({ targetType: 'BOOK', targetId }) }), 'Book added to the list.')
    form.reset()
  }

  const invite = (listId: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    void act(async () => api(`/api/lists/${listId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email: String(data.get('email') ?? ''), role: String(data.get('role') ?? 'VIEWER') }),
    }), 'Member invited.')
    form.reset()
  }

  const recommend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    void act(async () => api('/api/social/recommendations', {
      method: 'POST',
      body: JSON.stringify({
        recipientEmail: String(data.get('email') ?? ''),
        targetType: 'BOOK',
        targetId: String(data.get('bookId') ?? ''),
        message: String(data.get('message') ?? '') || undefined,
      }),
    }), 'Recommendation sent to your friend.')
    form.reset()
  }

  return <div className="site-shell">
    <Navbar />
    <main>
      <div className="page-container social-hub">
        <h1>Privacy &amp; Social<span className="heading-period">.</span></h1>
        <p className="social-meta">Your network, your rules. Every setting explains who can see what and why.</p>

        <div className="social-tabs" role="tablist" aria-label="Social sections">
          {(['friends', 'privacy', 'lists', 'recommendations'] as const).map((name) => (
            <button key={name} role="tab" aria-selected={tab === name} type="button" onClick={() => setTab(name)}>
              {name === 'friends' ? 'Friends' : name === 'privacy' ? 'Privacy' : name === 'lists' ? 'Shared lists' : 'Recommendations'}
            </button>
          ))}
        </div>

        {(status || error) && <p className={error ? 'social-empty' : 'social-meta'} role="status">{error || status}</p>}

        {tab === 'friends' && <section className="social-panel" aria-label="Friends">
          <form className="advisor-form" onSubmit={addFriend}>
            <label className="sr-only" htmlFor="friend-email">Friend email</label>
            <input id="friend-email" name="email" type="email" required placeholder="friend@example.com" />
            <button className="button" type="submit">Send request</button>
          </form>
          <h3>Your friends<span className="heading-period">.</span></h3>
          {friends?.friends.length
            ? <ul className="social-people">{friends.friends.map((friend) => <li key={friend.friendshipId}>
                <span>{friend.user.name}</span>
                <button type="button" onClick={() => void act(async () => api(`/api/social/friends/${friend.friendshipId}`, { method: 'DELETE' }), 'Connection removed.')}>Remove</button>
              </li>)}</ul>
            : <p className="social-empty">No friends yet. Requests you accept will show up here.</p>}
          {friends?.incoming.length ? <div>
            <h4 className="social-subhead">Requests waiting for you</h4>
            <ul className="social-people">{friends.incoming.map((friend) => <li key={friend.friendshipId}>
              <span>{friend.user.name}</span>
              <span className="social-actions">
                <button type="button" onClick={() => void act(async () => api(`/api/social/friends/${friend.friendshipId}`, { method: 'PATCH', body: JSON.stringify({ action: 'accept' }) }), 'Friend added.')}>Accept</button>
                <button type="button" onClick={() => void act(async () => api(`/api/social/friends/${friend.friendshipId}`, { method: 'PATCH', body: JSON.stringify({ action: 'decline' }) }), 'Request declined.')}>Decline</button>
                <button type="button" onClick={() => void act(async () => api(`/api/social/friends/${friend.friendshipId}`, { method: 'PATCH', body: JSON.stringify({ action: 'block' }) }), 'Person blocked.')}>Block</button>
              </span>
            </li>)}</ul>
          </div> : null}
          {friends?.outgoing.length ? <p className="social-meta">Pending invitations you sent: {friends.outgoing.map((friend) => friend.user.name).join(', ')}</p> : null}
        </section>}

        {tab === 'privacy' && privacy && <section className="social-panel" aria-label="Privacy settings">
          {Object.entries(privacyOptions).map(([key, options]) => (
            <div className="privacy-row" key={key}>
              <div>
                <strong>{privacyCopy[key].title}</strong>
                <small>{privacyCopy[key].who} {privacyCopy[key].why}</small>
              </div>
              <label className="select-shell">
                <span className="sr-only">{privacyCopy[key].title} visibility</span>
                <select value={privacy[key as keyof Privacy]} onChange={(event) => savePrivacy(key, event.target.value)}>
                  {options.map((option) => <option key={option} value={option}>{option.replace('_', ' ')}</option>)}
                </select>
              </label>
            </div>
          ))}
          <p className="social-meta">Recommendations are always visible only to the friend you send them to ({privacy.recommendations.replace(/_/g, ' ').toLowerCase()}).</p>
        </section>}

        {tab === 'lists' && <section className="social-panel" aria-label="Shared lists">
          <form className="advisor-form" onSubmit={createList}>
            <label className="sr-only" htmlFor="list-title">List title</label>
            <input id="list-title" name="title" required minLength={2} placeholder="Cybersecurity Starter Pack" />
            <label className="sr-only" htmlFor="list-visibility">Visibility</label>
            <select id="list-visibility" name="visibility" defaultValue="PRIVATE">
              <option value="PRIVATE">PRIVATE</option>
              <option value="SHARED">SHARED</option>
              <option value="PUBLIC">PUBLIC</option>
            </select>
            <button className="button" type="submit">Create list</button>
          </form>
          {lists.length ? lists.map((list) => <article className="social-list" key={list.id}>
            <header>
              <h3>{list.title}</h3>
              <span className="social-chip">{list.visibility} · you are {list.myRole ?? 'not a member'}</span>
            </header>
            {list.description && <p>{list.description}</p>}
            {list.items.length
              ? <ul>{list.items.map((item) => <li key={item.id}>
                  <span>{item.target?.title ?? item.targetId}{item.preferred ? ' · preferred' : ''}{item.note ? ` — ${item.note}` : ''}</span>
                  {(list.myRole === 'OWNER' || list.myRole === 'EDITOR') && <button type="button" onClick={() => void act(async () => api(`/api/lists/${list.id}/items/${item.id}`, { method: 'DELETE' }), 'Item removed.')}>Remove</button>}
                </li>)}</ul>
              : <p className="social-empty">Nothing on this list yet.</p>}
            {(list.myRole === 'OWNER' || list.myRole === 'EDITOR') && <form className="advisor-form" onSubmit={addBookToList(list.id)}>
              <label className="sr-only" htmlFor={`book-${list.id}`}>Book id</label>
              <input id={`book-${list.id}`} name="bookId" required placeholder="Book id (e.g. atomic-habits)" />
              <button className="button button-outline" type="submit">Add book</button>
            </form>}
            {list.myRole === 'OWNER' && <form className="advisor-form" onSubmit={invite(list.id)}>
              <label className="sr-only" htmlFor={`invite-${list.id}`}>Friend email</label>
              <input id={`invite-${list.id}`} name="email" type="email" required placeholder="Invite a friend by email" />
              <select name="role" defaultValue="VIEWER"><option value="VIEWER">Viewer</option><option value="EDITOR">Editor</option></select>
              <button className="button button-outline" type="submit">Invite</button>
            </form>}
            {list.members?.length ? <p className="social-meta">Members: {list.members.map((member) => `${member.name} (${member.role})`).join(', ')}</p> : null}
          </article>) : <p className="social-empty">You have no lists yet.</p>}
        </section>}

        {tab === 'recommendations' && recommendations && <section className="social-panel" aria-label="Recommendations">
          <form className="advisor-form" onSubmit={recommend}>
            <label className="sr-only" htmlFor="rec-email">Friend email</label>
            <input id="rec-email" name="email" type="email" required placeholder="friend@example.com" />
            <label className="sr-only" htmlFor="rec-book">Book id</label>
            <input id="rec-book" name="bookId" required placeholder="Book id (e.g. hobbit)" />
            <button className="button" type="submit">Recommend</button>
          </form>
          <h3>Shared with you<span className="heading-period">.</span></h3>
          {recommendations.received.length
            ? <ul className="social-people">{recommendations.received.map((recommendation) => <li key={recommendation.id}>
                <span>{recommendation.sender?.name} recommended {recommendation.target?.title ?? 'a book'}{recommendation.message ? ` — “${recommendation.message}”` : ''}</span>
                {recommendation.target && <button type="button" onClick={() => addToCart(recommendation.target!.id, recommendation.target!.title)}>Add to cart</button>}
              </li>)}</ul>
            : <p className="social-empty">No recommendations from friends yet.</p>}
          <h3>You shared<span className="heading-period">.</span></h3>
          {recommendations.sent.length
            ? <ul className="social-people">{recommendations.sent.map((recommendation) => <li key={recommendation.id}><span>{recommendation.target?.title ?? 'A book'} → {recommendation.recipient?.name}</span></li>)}</ul>
            : <p className="social-empty">You have not recommended anything yet.</p>}
          <p className="social-meta">Recommendations are private to the friend you send them to — they never become public automatically.</p>
        </section>}
      </div>
    </main>
    <Footer />
  </div>
}
