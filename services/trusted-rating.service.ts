import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'
import {
  aggregatePublicRating, filterVisibleReviews, getAuthorReviewPrivacy, getPrivacyMany, DEFAULT_PRIVACY,
} from '@/services/privacy.service'
import { getFriendIds } from '@/services/friend.service'
import {
  getTargetPurchasers, getTargetReviews, requireTarget, type ResolvedTarget, type SocialTargetType, type TargetReviewRow,
} from '@/services/social-targets'

/**
 * Trusted rating (spec §8) and friends' reviews (spec §7), plus the friend
 * recommendation badge (§9) and privacy-preserving "friends also bought"
 * aggregate (§10).
 *
 * Community and network signals are computed separately and never mixed.
 * Every query is scoped by the authenticated viewer (spec §44).
 */

export type ReviewDto = {
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

function toReviewDto(row: TargetReviewRow, finished: boolean): ReviewDto {
  return {
    id: row.id, rating: row.rating, title: row.title, content: row.content,
    verified: row.verified, containsSpoilers: row.containsSpoilers, createdAt: row.createdAt,
    finished,
    // Safe DTO (spec §46): no email, phone, addresses or account data.
    author: { id: row.user.id, name: row.user.name, avatar: row.user.avatar },
  }
}

async function getFinishedReaderIds(viewerId: string | null, authorIds: string[], target: ResolvedTarget): Promise<Set<string>> {
  if (!viewerId || !authorIds.length) return new Set()
  const friendIds = await getFriendIds(viewerId)
  if (!isDatabaseConfigured) {
    return new Set(
      mockStore.readingProgress
        .filter((entry) => authorIds.includes(entry.userId)
          && entry.targetType === target.type && entry.targetId === target.id
          && entry.status === 'FINISHED'
          && (entry.visibility === 'PUBLIC'
            || entry.userId === viewerId
            || (entry.visibility === 'FRIENDS' && friendIds.has(entry.userId))))
        .map((entry) => entry.userId),
    )
  }
  const rows = await prisma.readingProgress.findMany({
    where: {
      userId: { in: [...new Set(authorIds)] },
      targetType: target.type, targetId: target.id, status: 'FINISHED',
      OR: [
        { visibility: 'PUBLIC' },
        { visibility: 'FRIENDS', userId: { in: [...friendIds] } },
        { userId: viewerId },
      ],
    },
    select: { userId: true },
  })
  return new Set(rows.map((row) => row.userId))
}

export async function getTrustedSummary(options: { targetType: SocialTargetType; targetId: string; viewerId?: string | null }) {
  const { targetType, targetId } = options
  const viewerId = options.viewerId ?? null
  const target = await requireTarget(targetType, targetId)

  const friendIds = viewerId ? await getFriendIds(viewerId) : new Set<string>()
  const viewer = viewerId ? { id: viewerId, friendIds } : null

  const reviews = await getTargetReviews(targetType, target.id)
  const authorPrivacy = await getAuthorReviewPrivacy(reviews.map((review) => review.userId))

  // What an anonymous visitor may see = effective public reviews.
  const publicVisible = filterVisibleReviews(reviews, null, authorPrivacy)
  const community = aggregatePublicRating(publicVisible.map((review) => ({ ...review, visibility: review.visibility })))

  // What this viewer may see (public + friends-only from accepted friends + own).
  const viewerVisible = filterVisibleReviews(reviews, viewer, authorPrivacy)
  const friendReviews = viewer ? viewerVisible.filter((review) => friendIds.has(review.userId)) : []
  const finishedReaders = await getFinishedReaderIds(
    viewerId,
    friendReviews.filter((review) => review.verified).map((review) => review.userId),
    target,
  )

  const network = friendReviews.length
    ? (() => {
        const rating = friendReviews.reduce((sum, review) => sum + review.rating, 0) / friendReviews.length
        return { rating: Math.round(rating * 10) / 10, count: friendReviews.length }
      })()
    : viewer && friendIds.size > 0 ? { rating: null, count: 0 } : null

  // Friend recommendation badge: recommendations addressed to this viewer by
  // accepted friends. Recommendations are always intended-recipient-only.
  let friendRecommended = { count: 0 }
  let friendsAlsoBought: { count: number } | null = null

  if (viewer) {
    if (!isDatabaseConfigured) {
      friendRecommended = {
        count: new Set(
          mockStore.recommendations
            .filter((rec) => rec.targetType === targetType && rec.targetId === target.id
              && rec.recipientId === viewerId && friendIds.has(rec.senderId))
            .map((rec) => rec.senderId),
        ).size,
      }
    } else {
      const rows = await prisma.recommendation.findMany({
        where: { targetType, targetId, recipientId: viewer.id, senderId: { in: [...friendIds] } },
        select: { senderId: true },
      })
      friendRecommended = { count: new Set(rows.map((row) => row.senderId)).size }
    }

    if (friendIds.size > 0) {
      const purchasers = await getTargetPurchasers(targetType, target.id)
      const privacyById = await getPrivacyMany([...friendIds])
      // Only purchases the owner allows to be used for aggregates count.
      const count = [...friendIds].filter((friendId) =>
        purchasers.has(friendId) && (privacyById.get(friendId) ?? DEFAULT_PRIVACY).purchases === 'LIMITED').length
      friendsAlsoBought = { count }
    }
  }

  return {
    target: {
      type: target.type, id: target.id, title: target.title, author: target.author,
      cover: target.cover, price: target.price, isbn: target.isbn, vendorId: target.vendorId,
    },
    community,
    network,
    friendReviews: friendReviews.map((review) => toReviewDto(review, finishedReaders.has(review.userId))),
    friendRecommended,
    friendsAlsoBought,
    viewer: { authenticated: Boolean(viewerId), friendCount: friendIds.size },
  }
}

/**
 * Visibility-filtered community review list for a target. Used by the general
 * reviews endpoint so private reviews never leak there either.
 */
export async function listVisibleReviews(options: { targetType: SocialTargetType; targetId: string; viewerId?: string | null }) {
  const viewerId = options.viewerId ?? null
  const reviews = await getTargetReviews(options.targetType, options.targetId)
  const authorPrivacy = await getAuthorReviewPrivacy(reviews.map((review) => review.userId))
  const viewer = viewerId ? { id: viewerId, friendIds: await getFriendIds(viewerId) } : null
  const visible = filterVisibleReviews(reviews, viewer, authorPrivacy)
  const finishedReaders = await getFinishedReaderIds(viewerId, visible.filter((review) => review.verified).map((review) => review.userId),
    await requireTarget(options.targetType, options.targetId))
  return visible.map((review) => toReviewDto(review, finishedReaders.has(review.userId)))
}

export { DEFAULT_PRIVACY }
