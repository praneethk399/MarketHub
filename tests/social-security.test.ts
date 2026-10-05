import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMockId, demoCredentials, mockStore } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'
import { getTrustedSummary, listVisibleReviews } from '@/services/trusted-rating.service'
import {
  createFriendRequest, getFriendIds, listFriendships, removeFriendship, respondToFriendRequest,
} from '@/services/friend.service'
import { computeSellerScore, getSellerPassport, getVendorPublicRow } from '@/services/sellerPassport.service'
import { COMPARISON_WEIGHTS, compareSellers } from '@/services/sellerComparison.service'
import { AI_TOOLS, advise, parseAdvisorRequest, runTool } from '@/services/ai.service'
import { listSecuritySignals, noteFriendRequestBurst, noteReviewCreated, noteSocialDenied } from '@/services/marketShield.service'
import { getReadingProgress, listReadingProgress, upsertReadingProgress } from '@/services/social.service'
import { addListItem, addListMember, getList, listLists, updateList } from '@/services/list.service'
import { listRecommendations, sendRecommendation } from '@/services/recommendation.service'
import { updatePrivacy } from '@/services/privacy.service'
import { getProductPassport } from '@/services/productPassport.service'

const { ava, rahul, ananya, kiran } = demoCredentials
const asViewer = (user: { id: string }) => ({ viewerId: user.id })

async function expectDomainError(run: () => Promise<unknown>, status: number) {
  await assert.rejects(run, (error: unknown) => error instanceof DomainError && error.status === status)
}

// ---------------------------------------------------------------------------
// Privacy (spec §42)
// ---------------------------------------------------------------------------

test('private review is invisible to friends', async () => {
  const summary = await getTrustedSummary({ targetType: 'BOOK', targetId: 'secret-garden', ...asViewer(rahul) })
  assert.equal(summary.friendReviews.some((review) => review.content.includes('Private demo review')), false)
  const anon = await listVisibleReviews({ targetType: 'BOOK', targetId: 'secret-garden', viewerId: null })
  assert.equal(anon.some((review) => review.content.includes('Private demo review')), false)
  assert.equal(anon.some((review) => review.author.id === kiran.id), false)
})

test('friends-only review is visible to a friend and hidden from others', async () => {
  const friendView = await getTrustedSummary({ targetType: 'BOOK', targetId: 'secret-garden', ...asViewer(ava) })
  assert.equal(friendView.friendReviews.some((review) => review.author.id === ananya.id), true)

  const strangerView = await getTrustedSummary({ targetType: 'BOOK', targetId: 'secret-garden', ...asViewer(kiran) })
  assert.equal(strangerView.friendReviews.some((review) => review.author.id === ananya.id), false)
})

test('author account-level privacy caps review visibility', async () => {
  // rahul's review row is PUBLIC but their account privacy is FRIENDS.
  const anon = await listVisibleReviews({ targetType: 'BOOK', targetId: 'secret-garden', viewerId: null })
  assert.equal(anon.some((review) => review.author.id === rahul.id), false)
  const friendView = await listVisibleReviews({ targetType: 'BOOK', targetId: 'secret-garden', viewerId: ava.id })
  assert.equal(friendView.some((review) => review.author.id === rahul.id), true)
})

test('friends-only reading completion is not exposed beside a public review to strangers', async () => {
  const priorPrivacy = mockStore.privacy.get(kiran.id)
  const priorProgress = mockStore.readingProgress.find((entry) =>
    entry.userId === kiran.id && entry.targetType === 'BOOK' && entry.targetId === 'hobbit')
  const priorProgressSnapshot = priorProgress ? { ...priorProgress } : null
  const reviewId = createMockId()
  mockStore.reviews.push({
    id: reviewId, productId: 'hobbit', bookId: 'hobbit', userId: kiran.id,
    rating: 4, title: null, content: 'A public review visible to the community.', verified: true,
    visibility: 'PUBLIC', containsSpoilers: false, createdAt: new Date().toISOString(), userName: kiran.name,
  })

  try {
    await updatePrivacy(kiran.id, { reviews: 'PUBLIC', reading: 'FRIENDS' })
    await upsertReadingProgress(kiran.id, {
      targetType: 'BOOK', targetId: 'hobbit', status: 'FINISHED',
      progressPercentage: 100, visibility: 'FRIENDS',
    })
    const reviews = await listVisibleReviews({ targetType: 'BOOK', targetId: 'hobbit', viewerId: ava.id })
    assert.equal(reviews.find((review) => review.author.id === kiran.id)?.finished, false)
    await updatePrivacy(kiran.id, { reading: 'PUBLIC' })
    await upsertReadingProgress(kiran.id, {
      targetType: 'BOOK', targetId: 'hobbit', status: 'FINISHED',
      progressPercentage: 100, visibility: 'PUBLIC',
    })
    const publicCompletion = await listVisibleReviews({ targetType: 'BOOK', targetId: 'hobbit', viewerId: ava.id })
    assert.equal(publicCompletion.find((review) => review.author.id === kiran.id)?.finished, true)
  } finally {
    mockStore.reviews = mockStore.reviews.filter((review) => review.id !== reviewId)
    await updatePrivacy(kiran.id, {
      reviews: priorPrivacy?.reviews ?? 'PRIVATE',
      reading: priorPrivacy?.reading ?? 'PRIVATE',
    })
    const progressIndex = mockStore.readingProgress.findIndex((entry) =>
      entry.userId === kiran.id && entry.targetType === 'BOOK' && entry.targetId === 'hobbit')
    if (priorProgressSnapshot && progressIndex >= 0) mockStore.readingProgress[progressIndex] = priorProgressSnapshot
    else if (progressIndex >= 0) mockStore.readingProgress.splice(progressIndex, 1)
  }
})

test('network rating never mixes with community rating', async () => {
  // atomic-habits: ananya's review is effectively public, rahul's is friends-only.
  const summary = await getTrustedSummary({ targetType: 'BOOK', targetId: 'atomic-habits', ...asViewer(ava) })
  assert.equal(summary.community.count, 1)
  assert.equal(summary.network?.count, 2)
  assert.notEqual(summary.community.rating, summary.network?.rating)
  assert.equal(summary.friendReviews.some((review) => review.author.id === rahul.id), true)
  assert.equal(summary.community.rating, 5)
})

test('private purchases never appear in friend aggregates', async () => {
  // ananya allows LIMITED aggregate use; kiran is PRIVATE.
  const before = await getTrustedSummary({ targetType: 'BOOK', targetId: 'midnight-library', ...asViewer(ava) })
  assert.equal(before.friendsAlsoBought?.count, 1)
  assert.equal(JSON.stringify(before).includes('Private demo'), false)
  assert.equal(JSON.stringify(before.friendsAlsoBought).includes('Kiran'), false)

  await updatePrivacy(ananya.id, { purchases: 'PRIVATE' })
  const after = await getTrustedSummary({ targetType: 'BOOK', targetId: 'midnight-library', ...asViewer(ava) })
  assert.equal(after.friendsAlsoBought?.count, 0)
  await updatePrivacy(ananya.id, { purchases: 'LIMITED' })
})

test('private list is not exposed and shared list requires membership', async () => {
  const rahulLists = await listLists(rahul.id)
  const privateList = rahulLists.find((list) => list.visibility === 'PRIVATE')
  assert.ok(privateList)
  await expectDomainError(() => getList(ava.id, privateList!.id), 403)
  await expectDomainError(() => getList(kiran.id, privateList!.id), 403)

  const avaLists = await listLists(ava.id)
  const sharedList = avaLists.find((list) => list.visibility === 'SHARED')
  assert.ok(sharedList)
  const member = await getList(ananya.id, sharedList!.id) // VIEWER member
  assert.equal(member.id, sharedList!.id)
  await expectDomainError(() => getList(kiran.id, sharedList!.id), 403) // not a member
})

// ---------------------------------------------------------------------------
// Social authorization (spec §42)
// ---------------------------------------------------------------------------

test('friendship rules prevent self, duplicate and unauthorized changes', async () => {
  await expectDomainError(() => createFriendRequest(ava.id, ava.email), 400)
  await expectDomainError(() => createFriendRequest(ava.id, rahul.email), 409)

  const kiranRequests = (await listFriendships(kiran.id)).incoming
  assert.equal(kiranRequests.length, 1)
  const pending = kiranRequests[0]
  // rahul is neither requester nor addressee → cannot act on it.
  await expectDomainError(() => respondToFriendRequest(rahul.id, pending.friendshipId, 'accept'), 403)
  await expectDomainError(() => removeFriendship(ava.id, pending.friendshipId), 403)
  // The addressee can decline, and the requester can retry afterwards.
  const declined = await respondToFriendRequest(kiran.id, pending.friendshipId, 'decline')
  assert.equal(declined.status, 'DECLINED')
})

test('friendship state grants network access only after acceptance', async () => {
  const avaFriends = await getFriendIds(ava.id)
  assert.equal(avaFriends.has(rahul.id), true)
  assert.equal(avaFriends.has(kiran.id), false)
  const kiranFriends = await getFriendIds(kiran.id)
  assert.equal(kiranFriends.has(rahul.id), true)
})

test('users cannot modify another user\'s list or membership', async () => {
  const avaList = (await listLists(ava.id)).find((list) => list.visibility === 'SHARED')!
  await expectDomainError(() => updateList(rahul.id, avaList.id, { title: 'Hijacked' }), 403)
  await expectDomainError(() => addListMember(rahul.id, avaList.id, { email: kiran.email, role: 'EDITOR' }), 403)
  await expectDomainError(() => addListItem(ananya.id, avaList.id, { targetType: 'BOOK', targetId: 'hobbit' }), 403) // VIEWER
  await expectDomainError(() => addListMember(ava.id, avaList.id, { email: kiran.email, role: 'EDITOR' }), 403) // not friends
  await expectDomainError(() => addListMember(ava.id, avaList.id, { email: 'nobody@markethub.test', role: 'VIEWER' }), 404)
})

test('recommendations are recipient-scoped and friend-only', async () => {
  const received = await listRecommendations(ava.id)
  assert.equal(received.received.length >= 2, true)
  const others = await listRecommendations(kiran.id)
  assert.equal(others.received.length, 0) // never leaks to non-recipients

  await expectDomainError(() => sendRecommendation({
    senderId: kiran.id, recipientEmail: ananya.email, targetType: 'BOOK', targetId: 'hobbit',
  }), 403) // pending friendship only
  await expectDomainError(() => sendRecommendation({
    senderId: rahul.id, recipientEmail: ava.email, targetType: 'BOOK', targetId: 'atomic-habits',
  }), 409) // duplicate
})

// ---------------------------------------------------------------------------
// Seller passport (spec §42)
// ---------------------------------------------------------------------------

test('seller passport metrics derive from platform rows', async () => {
  const passport = await getSellerPassport('paper-and-ink')
  assert.ok(passport)
  const satisfaction = passport!.factors.find((factor) => factor.key === 'satisfaction')
  assert.equal(satisfaction?.available, true)
  assert.match(satisfaction!.display, /reviews/)
  assert.equal(passport!.metrics.onTimeDelivery, passport!.factors.find((f) => f.key === 'delivery')!.display)
  assert.equal(JSON.stringify(passport).includes('99.4'), false) // seeded vendor column is not presented as trust
})

test('unverified reviews do not affect seller satisfaction metrics', async () => {
  const before = await getSellerPassport('paper-and-ink')
  assert.ok(before)
  const beforeSatisfaction = before!.factors.find((factor) => factor.key === 'satisfaction')!
  const book = [...mockStore.books.values()].find((entry) => entry.vendorId === 'paper-and-ink')
  assert.ok(book)
  const unverifiedReviewId = createMockId()
  mockStore.reviews.push({
    id: unverifiedReviewId, productId: book!.id, bookId: book!.id, userId: ava.id,
    rating: 1, title: null, content: 'Unverified review must not affect this trust score.',
    verified: false, visibility: 'PUBLIC', containsSpoilers: false,
    createdAt: new Date().toISOString(), userName: ava.name,
  })
  try {
    const after = await getSellerPassport('paper-and-ink')
    assert.ok(after)
    const afterSatisfaction = after!.factors.find((factor) => factor.key === 'satisfaction')!
    assert.equal(afterSatisfaction.dataPoints, beforeSatisfaction.dataPoints)
    assert.equal(afterSatisfaction.display, beforeSatisfaction.display)
  } finally {
    mockStore.reviews = mockStore.reviews.filter((review) => review.id !== unverifiedReviewId)
  }
})

test('insufficient data is reported instead of fabricated', async () => {
  const passport = await getSellerPassport('chapter-house')
  assert.ok(passport)
  const satisfaction = passport!.factors.find((factor) => factor.key === 'satisfaction')!
  assert.equal(satisfaction.display, 'Not enough data')
  const returns = passport!.factors.find((factor) => factor.key === 'returns')!
  assert.equal(returns.display, 'Not enough data')
  assert.equal(returns.available, false)

  const empty = computeSellerScore({ satisfaction: null, delivery: null, authenticity: null, disputes: null, price: null })
  assert.equal(empty.score, null)
  const thin = computeSellerScore({
    satisfaction: null, delivery: null, authenticity: { complete: 3, total: 3 }, disputes: null, price: { atOrBelowMedian: 1, groups: 1 },
  })
  assert.equal(thin.score, null) // no satisfaction/delivery → no overall score
})

test('vendor isolation holds and sensitive vendor fields are not exposed', async () => {
  const passport = await getSellerPassport('paper-and-ink')
  assert.ok(passport)
  assert.equal('email' in passport!.vendor, false)
  assert.equal('phone' in passport!.vendor, false)

  mockStore.vendors.push({
    id: 'test-suspended-vendor', name: 'Suspended Books', city: 'Nowhere', status: 'SUSPENDED',
    verified: false, booksSold: 0, authenticity: 0, onTimeDelivery: 0, returnRate: 0, disputeRate: 0,
    activeSince: '2024-01-01',
  })
  assert.equal(await getVendorPublicRow('test-suspended-vendor'), null)
  assert.equal(await getSellerPassport('test-suspended-vendor'), null)
  mockStore.vendors = mockStore.vendors.filter((vendor) => vendor.id !== 'test-suspended-vendor')
})

// ---------------------------------------------------------------------------
// Seller comparison (spec §42)
// ---------------------------------------------------------------------------

test('only equivalent ISBNs are grouped and prices come from the store', async () => {
  const comparison = await compareSellers({ targetType: 'BOOK', targetId: 'secret-garden' })
  assert.ok(comparison)
  assert.equal(comparison!.grouped, true)
  const prices = comparison!.offers.map((offer) => offer.price)
  assert.deepEqual(prices, [285, 299, 315])
  assert.equal(comparison!.offers.every((offer) => offer.sellerId), true)

  const unrelated = await compareSellers({ targetType: 'BOOK', targetId: 'forest-lullaby' })
  assert.equal(unrelated!.grouped, false)
  assert.match(unrelated!.reason ?? '', /ISBN/)
})

test('ranking is explainable and never price-only', async () => {
  const comparison = await compareSellers({ targetType: 'BOOK', targetId: 'secret-garden' })
  assert.ok(comparison)
  assert.deepEqual(comparison!.ranking.weights, COMPARISON_WEIGHTS)
  if (comparison!.recommended) assert.equal(comparison!.recommended.reasons.length > 0, true)
  assert.equal(comparison!.offers.every((offer) => offer.warranty === 'Not specified'), true)
})

test('product passport reports unavailable price history honestly', async () => {
  const passport = await getProductPassport({ targetType: 'BOOK', targetId: 'atomic-habits' })
  assert.ok(passport)
  assert.equal(passport!.priceHistory.points.length, 0)
  assert.match(passport!.priceHistory.label, /not tracked|Not enough data/)
  assert.equal(passport!.returns.detail.length > 0, true)
})

// ---------------------------------------------------------------------------
// AI advisor (spec §42)
// ---------------------------------------------------------------------------

test('AI tool allowlist rejects anything outside the five read-only tools', async () => {
  assert.deepEqual([...AI_TOOLS], ['searchProducts', 'getProductDetails', 'compareProducts', 'getSellerPassport', 'getTrustedRecommendations'])
  for (const tool of ['deleteOrders', 'executeCheckout', 'updatePrice', 'prismaRawQuery']) {
    await expectDomainError(() => runTool(tool, {}, { viewerId: null }), 403)
  }
})

test('AI cannot change orders, prices or leak private social data', async () => {
  const reviewCount = mockStore.reviews.length
  const orderCount = mockStore.orders.length
  const bookPrices = [...mockStore.books.values()].map((book) => book.price)

  const budgetAnswer = await advise('I need a bestselling book under ₹600', { viewerId: ava.id })
  const compareAnswer = await advise('Compare sellers for The Hobbit please', { viewerId: ava.id })
  const giftAnswer = await advise('Gift idea for a beginner under ₹500', { viewerId: null })

  assert.equal(mockStore.reviews.length, reviewCount)
  assert.equal(mockStore.orders.length, orderCount)
  assert.deepEqual([...mockStore.books.values()].map((book) => book.price), bookPrices)

  const serialized = JSON.stringify([budgetAnswer, compareAnswer, giftAnswer])
  assert.equal(serialized.includes('Private demo review'), false)
  assert.equal(serialized.includes('kiran@markethub.test'), false)
  assert.equal(serialized.includes('passwordHash'), false)
  assert.ok(budgetAnswer.picks.length >= 3)
})

test('advisor answers explain trade-offs and respect privacy scope for anonymous visitors', async () => {
  const answer = await advise('Recommend a mystery novel under ₹400', { viewerId: null })
  assert.ok(answer.picks.every((pick) => pick.why.length > 0))
  const anonymous = await runTool('getTrustedRecommendations', { targetType: 'BOOK', targetId: 'hobbit' }, { viewerId: null })
  assert.equal((anonymous as { authenticated: boolean }).authenticated, false)
  assert.deepEqual((anonymous as { friendReviews: unknown[] }).friendReviews, [])

  const parsed = parseAdvisorRequest('I need a cybersecurity book under ₹1,000.')
  assert.equal(parsed.budget, 1000)
  assert.equal(parsed.keywords.includes('cybersecurity'), true)
})

// ---------------------------------------------------------------------------
// MarketShield (spec §42)
// ---------------------------------------------------------------------------

test('suspicious social activity is recorded', async () => {
  await noteReviewCreated('burst-user', 'BOOK', 'atomic-habits')
  await noteReviewCreated('burst-user', 'BOOK', 'atomic-habits')
  await noteReviewCreated('burst-user', 'BOOK', 'atomic-habits')
  for (let index = 0; index < 3; index += 1) await noteSocialDenied('denied-user', 'list_update')
  for (let index = 0; index < 5; index += 1) await noteFriendRequestBurst('burst-user')

  const signals = await listSecuritySignals()
  const types = signals.map((signal) => signal.type)
  assert.equal(types.includes('REVIEW_CLUSTER'), true)
  assert.equal(types.includes('UNAUTHORIZED_ACCESS_BURST'), true)
  assert.equal(types.includes('FRIEND_REQUEST_BURST'), true)
  const cluster = signals.find((signal) => signal.type === 'REVIEW_CLUSTER')
  assert.equal(cluster?.severity, 'HIGH')
})

test('security telemetry is never returned by customer-facing payloads', async () => {
  const summary = await getTrustedSummary({ targetType: 'BOOK', targetId: 'secret-garden', ...asViewer(ava) })
  const serialized = JSON.stringify(summary)
  for (const leak of ['securitySignals', 'SecuritySignal', 'REVIEW_CLUSTER', 'severity', 'subjectId']) {
    assert.equal(serialized.includes(leak), false)
  }
})

// ---------------------------------------------------------------------------
// Reading progress (spec §24)
// ---------------------------------------------------------------------------

test('reading progress is private by default and never exposes notes', async () => {
  await upsertReadingProgress(ava.id, {
    targetType: 'BOOK', targetId: 'song-achilles', progressPercentage: 12, notes: 'Owner-only note',
  })
  const hidden = await getReadingProgress(kiran.id, 'BOOK', 'song-achilles') // not a friend
  assert.equal(hidden.length, 0)
  assert.equal((await getReadingProgress(rahul.id, 'BOOK', 'song-achilles')).length, 0) // PRIVATE default

  await upsertReadingProgress(ava.id, {
    targetType: 'BOOK', targetId: 'song-achilles', progressPercentage: 20, notes: 'Owner-only note', visibility: 'FRIENDS',
  })
  const friendView = await getReadingProgress(rahul.id, 'BOOK', 'song-achilles')
  assert.equal(friendView.length, 1)
  assert.equal(friendView[0].notes, null) // notes never leak
  const ownerView = await listReadingProgress(ava.id)
  const own = ownerView.find((entry) => entry.targetId === 'song-achilles')
  assert.equal(own?.notes, 'Owner-only note')
})
