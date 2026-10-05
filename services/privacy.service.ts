import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, type MockReview, type SocialVisibility } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'

/**
 * Social privacy model (spec §21/§22).
 *
 * - Reviews: PRIVATE / FRIENDS / PUBLIC. Default PUBLIC so the existing
 *   marketplace review experience does not regress (reviews are already
 *   marketplace-public today).
 * - Purchases: PRIVATE (default) / LIMITED. LIMITED means the purchase may be
 *   used for privacy-preserving aggregates only (e.g. "5 people in your
 *   network own this book"); it is never exposed individually.
 * - Reading activity: PRIVATE (default) / FRIENDS / PUBLIC.
 * - Lists: per-list visibility, defaulting to PRIVATE for new lists.
 * - Recommendations: always INTENDED_RECIPIENTS_ONLY (never public).
 */

export type PrivacySettings = {
  reviews: SocialVisibility
  purchases: 'PRIVATE' | 'LIMITED'
  reading: SocialVisibility
  defaultListVisibility: 'PRIVATE' | 'SHARED' | 'PUBLIC'
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  reviews: 'PUBLIC',
  purchases: 'PRIVATE',
  reading: 'PRIVATE',
  defaultListVisibility: 'PRIVATE',
}

export const RECOMMENDATION_VISIBILITY = 'INTENDED_RECIPIENTS_ONLY' as const

const opennessRank: Record<SocialVisibility, number> = { PRIVATE: 0, FRIENDS: 1, PUBLIC: 2 }

/** The stricter (less open) of two visibility levels. */
export function stricterVisibility(a: SocialVisibility, b: SocialVisibility): SocialVisibility {
  return opennessRank[a] <= opennessRank[b] ? a : b
}

export type ReviewVisibilityInput = {
  userId: string
  visibility: SocialVisibility
}

/**
 * Core privacy rule (spec §44): WHO is requesting, WHO owns the data,
 * WHAT is the visibility, IS THE REQUESTER ALLOWED.
 * Effective visibility is the stricter of the review's own visibility and the
 * author's account-level privacy setting.
 */
export function canViewReview(
  viewer: { id: string; friendIds: Set<string> } | null,
  review: ReviewVisibilityInput,
  authorPrivacy: SocialVisibility,
): boolean {
  if (viewer && viewer.id === review.userId) return true
  const effective = stricterVisibility(review.visibility, authorPrivacy)
  if (effective === 'PRIVATE') return false
  if (effective === 'FRIENDS') return Boolean(viewer && viewer.friendIds.has(review.userId))
  return true
}

/** Pure filter used by every review listing path. */
export function filterVisibleReviews<T extends ReviewVisibilityInput>(
  reviews: T[],
  viewer: { id: string; friendIds: Set<string> } | null,
  authorPrivacyById: Map<string, SocialVisibility>,
): T[] {
  return reviews.filter((review) =>
    canViewReview(viewer, review, authorPrivacyById.get(review.userId) ?? DEFAULT_PRIVACY.reviews),
  )
}

/** Community rating counts only PUBLIC reviews (spec §8: never mix signals). */
export function aggregatePublicRating(reviews: { visibility?: SocialVisibility }[]) {
  const publicReviews = reviews.filter((review) => (review.visibility ?? 'PUBLIC') === 'PUBLIC')
  if (!publicReviews.length) return { rating: null as number | null, count: 0 }
  const rating = publicReviews.reduce((sum, review) => sum + (review as { rating: number }).rating, 0) / publicReviews.length
  return { rating: Math.round(rating * 10) / 10, count: publicReviews.length }
}

export async function getPrivacy(userId: string): Promise<PrivacySettings> {
  if (!isDatabaseConfigured) {
    return mockStore.privacy.get(userId) ?? { ...DEFAULT_PRIVACY }
  }
  const row = await prisma.socialPrivacy.findUnique({ where: { userId } })
  if (!row) return { ...DEFAULT_PRIVACY }
  return {
    reviews: row.reviews,
    purchases: row.purchases,
    reading: row.reading,
    defaultListVisibility: row.defaultListVisibility,
  }
}

export async function updatePrivacy(userId: string, patch: Partial<PrivacySettings>): Promise<PrivacySettings> {
  const next = { ...(await getPrivacy(userId)), ...patch }
  if (!isDatabaseConfigured) {
    mockStore.privacy.set(userId, { ...next, userId, updatedAt: new Date().toISOString() })
    return next
  }
  await prisma.socialPrivacy.upsert({
    where: { userId },
    create: { userId, ...next },
    update: { ...next },
  })
  return next
}

/** Batch-load privacy settings (avoids N+1 in network aggregates). */
export async function getPrivacyMany(userIds: string[]): Promise<Map<string, PrivacySettings>> {
  const map = new Map<string, PrivacySettings>()
  const unique = [...new Set(userIds)]
  if (!unique.length) return map
  if (!isDatabaseConfigured) {
    for (const id of unique) map.set(id, mockStore.privacy.get(id) ?? { ...DEFAULT_PRIVACY })
    return map
  }
  const rows = await prisma.socialPrivacy.findMany({
    where: { userId: { in: unique } },
    select: { userId: true, reviews: true, purchases: true, reading: true, defaultListVisibility: true },
  })
  for (const row of rows) {
    map.set(row.userId, {
      reviews: row.reviews, purchases: row.purchases, reading: row.reading,
      defaultListVisibility: row.defaultListVisibility,
    })
  }
  for (const id of unique) if (!map.has(id)) map.set(id, { ...DEFAULT_PRIVACY })
  return map
}

/** Batch-load account-level review privacy for a set of authors (no N+1). */
export async function getAuthorReviewPrivacy(userIds: string[]): Promise<Map<string, SocialVisibility>> {
  const map = new Map<string, SocialVisibility>()
  if (!userIds.length) return map
  if (!isDatabaseConfigured) {
    for (const id of new Set(userIds)) {
      map.set(id, mockStore.privacy.get(id)?.reviews ?? DEFAULT_PRIVACY.reviews)
    }
    return map
  }
  const rows = await prisma.socialPrivacy.findMany({
    where: { userId: { in: [...new Set(userIds)] } },
    select: { userId: true, reviews: true },
  })
  for (const row of rows) map.set(row.userId, row.reviews)
  return map
}

export function assertPrivacyPatch(body: Record<string, unknown>): Partial<PrivacySettings> {
  const patch: Partial<PrivacySettings> = {}
  const visibility = ['PRIVATE', 'FRIENDS', 'PUBLIC']
  const purchases = ['PRIVATE', 'LIMITED']
  const lists = ['PRIVATE', 'SHARED', 'PUBLIC']
  if ('reviews' in body) {
    if (!visibility.includes(String(body.reviews))) throw new DomainError('Invalid reviews privacy value.', 400)
    patch.reviews = body.reviews as SocialVisibility
  }
  if ('purchases' in body) {
    if (!purchases.includes(String(body.purchases))) throw new DomainError('Invalid purchases privacy value.', 400)
    patch.purchases = body.purchases as 'PRIVATE' | 'LIMITED'
  }
  if ('reading' in body) {
    if (!visibility.includes(String(body.reading))) throw new DomainError('Invalid reading privacy value.', 400)
    patch.reading = body.reading as SocialVisibility
  }
  if ('defaultListVisibility' in body) {
    if (!lists.includes(String(body.defaultListVisibility))) throw new DomainError('Invalid list privacy value.', 400)
    patch.defaultListVisibility = body.defaultListVisibility as 'PRIVATE' | 'SHARED' | 'PUBLIC'
  }
  if (!Object.keys(patch).length) throw new DomainError('No privacy setting was provided.', 400)
  return patch
}

export type { MockReview }
