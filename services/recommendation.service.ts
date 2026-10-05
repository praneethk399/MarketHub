import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, createMockId } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'
import { areFriends } from '@/services/friend.service'
import { noteRecommendationBurst, noteSocialDenied } from '@/services/marketShield.service'
import { RECOMMENDATION_VISIBILITY } from '@/services/privacy.service'
import { requireTarget, resolveTargets, type SocialTargetType } from '@/services/social-targets'

/**
 * Explicit friend-to-friend product recommendations (spec §11).
 * A recommendation is always intended for its recipient only; it never
 * becomes public automatically.
 */

export type RecommendationDto = {
  id: string
  message: string | null
  createdAt: string
  visibility: typeof RECOMMENDATION_VISIBILITY
  target: { type: SocialTargetType; id: string; title: string; cover: string | null; price: number | null } | null
  sender?: { id: string; name: string }
  recipient?: { id: string; name: string }
}

export async function sendRecommendation(options: {
  senderId: string
  recipientId?: string
  recipientEmail?: string
  targetType: SocialTargetType
  targetId: string
  message?: string
}) {
  const { senderId, targetType } = options
  let recipientId = options.recipientId ?? null

  if (!recipientId && options.recipientEmail) {
    const normalized = options.recipientEmail.trim().toLowerCase()
    if (!isDatabaseConfigured) {
      recipientId = [...mockStore.users.values()].find((user) => user.email === normalized)?.id ?? null
    } else {
      recipientId = (await prisma.user.findFirst({ where: { email: normalized }, select: { id: true } }))?.id ?? null
    }
  }
  if (!recipientId) throw new DomainError('Choose the friend you want to recommend this to.', 404)
  if (recipientId === senderId) throw new DomainError('You cannot recommend an item to yourself.', 400)

  // A recommendation is only allowed between accepted friends.
  if (!(await areFriends(senderId, recipientId))) {
    await noteSocialDenied(senderId, 'recommendation')
    throw new DomainError('You can only recommend items to accepted friends.', 403)
  }

  await requireTarget(targetType, options.targetId) // target must exist

  if (!isDatabaseConfigured) {
    const existing = mockStore.recommendations.find((rec) =>
      rec.senderId === senderId && rec.recipientId === recipientId
      && rec.targetType === targetType && rec.targetId === options.targetId)
    if (existing) throw new DomainError('You already shared this recommendation.', 409)
    const created = {
      id: createMockId(), senderId, recipientId, targetType, targetId: options.targetId,
      message: options.message?.trim() ? options.message.trim().slice(0, 500) : null,
      createdAt: new Date().toISOString(),
    }
    mockStore.recommendations.unshift(created)
    await noteRecommendationBurst(senderId)
    return { id: created.id, createdAt: created.createdAt, visibility: RECOMMENDATION_VISIBILITY }
  }

  const created = await prisma.recommendation.create({
    data: {
      senderId, recipientId, targetType, targetId: options.targetId,
      message: options.message?.trim() ? options.message.trim().slice(0, 500) : null,
    },
  }).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new DomainError('You already shared this recommendation.', 409)
    }
    throw error
  })
  await noteRecommendationBurst(senderId)
  return { id: created.id, createdAt: created.createdAt.toISOString(), visibility: RECOMMENDATION_VISIBILITY }
}

export async function listRecommendations(userId: string) {
  const rows = !isDatabaseConfigured
    ? mockStore.recommendations.filter((rec) => rec.recipientId === userId || rec.senderId === userId)
    : await prisma.recommendation.findMany({
        where: { OR: [{ recipientId: userId }, { senderId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })

  const bookTargets = await resolveTargets('BOOK', rows.filter((r) => r.targetType === 'BOOK').map((r) => r.targetId))
  const productTargets = await resolveTargets('PRODUCT', rows.filter((r) => r.targetType === 'PRODUCT').map((r) => r.targetId))

  const people = new Set<string>()
  for (const row of rows) {
    people.add(row.senderId)
    people.add(row.recipientId)
  }
  const names = new Map<string, string>()
  if (people.size) {
    if (!isDatabaseConfigured) {
      for (const id of people) {
        const user = mockStore.users.get(id)
        if (user) names.set(id, user.name)
      }
    } else {
      for (const user of await prisma.user.findMany({ where: { id: { in: [...people] } }, select: { id: true, name: true } })) {
        names.set(user.id, user.name)
      }
    }
  }

  const toDto = (row: (typeof rows)[number], side: 'received' | 'sent'): RecommendationDto => {
    const target = row.targetType === 'BOOK' ? bookTargets.get(row.targetId) : productTargets.get(row.targetId)
    return {
      id: row.id,
      message: row.message ?? null,
      createdAt: (row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt),
      visibility: RECOMMENDATION_VISIBILITY,
      target: target ? { type: target.type, id: target.id, title: target.title, cover: target.cover, price: target.price } : null,
      ...(side === 'received' && names.has(row.senderId) ? { sender: { id: row.senderId, name: names.get(row.senderId)! } } : {}),
      ...(side === 'sent' && names.has(row.recipientId) ? { recipient: { id: row.recipientId, name: names.get(row.recipientId)! } } : {}),
    }
  }

  return {
    received: rows.filter((row) => row.recipientId === userId).map((row) => toDto(row, 'received')),
    sent: rows.filter((row) => row.senderId === userId).map((row) => toDto(row, 'sent')),
  }
}
