import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, createMockId, type MockReadingProgress } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'
import { requireTarget, type SocialTargetType } from '@/services/social-targets'
import { getFriendIds } from '@/services/friend.service'

/**
 * Reading progress (spec §24) — private by default. Private notes are only
 * ever returned to their owner.
 */

const noteVisibility = (entry: { userId: string; visibility: string }, viewerId: string | null, friendIds: Set<string>) => {
  if (!viewerId) return entry.visibility === 'PUBLIC'
  if (entry.userId === viewerId) return true
  if (entry.visibility === 'PUBLIC') return true
  if (entry.visibility === 'FRIENDS') return friendIds.has(entry.userId)
  return false
}

export async function upsertReadingProgress(userId: string, input: {
  targetType: SocialTargetType
  targetId: string
  status?: MockReadingProgress['status']
  progressPercentage?: number
  notes?: string
  visibility?: MockReadingProgress['visibility']
}) {
  await requireTarget(input.targetType, input.targetId)
  const progress = Math.min(Math.max(input.progressPercentage ?? 0, 0), 100)
  const status = input.status ?? (progress === 0 ? 'NOT_STARTED' : progress >= 100 ? 'FINISHED' : 'CURRENTLY_READING')
  const timestamp = new Date().toISOString()

  if (!isDatabaseConfigured) {
    const existing = mockStore.readingProgress.find((entry) =>
      entry.userId === userId && entry.targetType === input.targetType && entry.targetId === input.targetId)
    if (existing) {
      Object.assign(existing, {
        status, progressPercentage: progress,
        notes: input.notes !== undefined ? input.notes.slice(0, 2000) : existing.notes,
        visibility: input.visibility ?? existing.visibility, updatedAt: timestamp,
      })
      return toDto(existing, userId, new Set([userId]))
    }
    const created: MockReadingProgress = {
      id: createMockId(), userId, targetType: input.targetType, targetId: input.targetId,
      status, progressPercentage: progress, notes: input.notes?.slice(0, 2000) ?? null,
      visibility: input.visibility ?? 'PRIVATE', createdAt: timestamp, updatedAt: timestamp,
    }
    mockStore.readingProgress.push(created)
    return toDto(created, userId, new Set([userId]))
  }

  const data = {
    status, progressPercentage: progress, visibility: input.visibility ?? undefined,
    ...(input.notes !== undefined ? { notes: input.notes.slice(0, 2000) } : {}),
  }
  const existing = await prisma.readingProgress.findUnique({
    where: { userId_targetType_targetId: { userId, targetType: input.targetType, targetId: input.targetId } },
  })
  const row = existing
    ? await prisma.readingProgress.update({ where: { id: existing.id }, data })
    : await prisma.readingProgress.create({ data: { userId, targetType: input.targetType, targetId: input.targetId, ...data } })
  return toDto({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }, userId, new Set([userId]))
}

function toDto(entry: MockReadingProgress, viewerId: string, friendIds: Set<string>) {
  const canSee = noteVisibility(entry, viewerId, friendIds)
  return {
    id: entry.id,
    targetType: entry.targetType,
    targetId: entry.targetId,
    status: entry.status,
    progressPercentage: entry.progressPercentage,
    visibility: entry.visibility,
    isOwner: entry.userId === viewerId,
    notes: entry.userId === viewerId ? entry.notes : null, // private notes never leak
    updatedAt: entry.updatedAt,
    ...(canSee ? {} : {}),
  }
}

export async function getReadingProgress(viewerId: string | null, targetType: SocialTargetType, targetId: string) {
  const friendIds = viewerId ? await getFriendIds(viewerId) : new Set<string>()
  if (!isDatabaseConfigured) {
    return mockStore.readingProgress
      .filter((entry) => entry.targetType === targetType && entry.targetId === targetId)
      .filter((entry) => noteVisibility(entry, viewerId, friendIds))
      .map((entry) => toDto(entry, viewerId ?? '', friendIds))
  }
  const rows = await prisma.readingProgress.findMany({
    where: { targetType, targetId, OR: [{ visibility: { not: 'PRIVATE' } }, ...(viewerId ? [{ userId: viewerId }] : [])] },
  })
  return rows
    .filter((row) => noteVisibility(row, viewerId, friendIds))
    .map((row) => toDto({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }, viewerId ?? '', friendIds))
}

export async function listReadingProgress(viewerId: string, targetUserId?: string) {
  const subjectId = targetUserId ?? viewerId
  const friendIds = await getFriendIds(viewerId)
  if (!isDatabaseConfigured) {
    return mockStore.readingProgress
      .filter((entry) => entry.userId === subjectId)
      .filter((entry) => noteVisibility(entry, viewerId, friendIds))
      .map((entry) => toDto(entry, viewerId, friendIds))
  }
  const rows = await prisma.readingProgress.findMany({
    where: { userId: subjectId, OR: [{ visibility: { not: 'PRIVATE' } }, { userId: viewerId }] },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })
  return rows
    .filter((row) => noteVisibility(row, viewerId, friendIds))
    .map((row) => toDto({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }, viewerId, friendIds))
}

export function assertReadingInput(body: Record<string, unknown>) {
  if (typeof body.targetId !== 'string' || !body.targetId.trim()) throw new DomainError('A target item is required.', 400)
  const targetType = body.targetType === 'PRODUCT' ? 'PRODUCT' : 'BOOK'
  const status = ['NOT_STARTED', 'CURRENTLY_READING', 'FINISHED'].includes(String(body.status))
    ? body.status as MockReadingProgress['status'] : undefined
  const visibility = ['PRIVATE', 'FRIENDS', 'PUBLIC'].includes(String(body.visibility))
    ? body.visibility as MockReadingProgress['visibility'] : undefined
  const progress = typeof body.progressPercentage === 'number' ? body.progressPercentage : undefined
  return {
    targetType: targetType as SocialTargetType,
    targetId: body.targetId.trim(),
    status,
    progressPercentage: progress,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
    visibility,
  }
}
