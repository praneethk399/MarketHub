import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'

/**
 * MarketShield social abuse signals (spec §30/§31).
 *
 * SECURITY TELEMETRY — never returned from any customer-facing endpoint.
 * Only `/api/admin/security-signals` (admin role) exposes these records.
 *
 * Signals currently detected:
 * - FRIEND_REQUEST_BURST   >=5 friend requests from one actor within 5 minutes
 * - RECOMMENDATION_BURST   >=5 recommendations from one actor within 5 minutes
 * - REVIEW_CLUSTER         >=3 reviews for one target within 10 minutes
 * - UNAUTHORIZED_ACCESS_BURST >=3 denied social actions by one actor in 5 minutes
 */

type Severity = 'LOW' | 'MEDIUM' | 'HIGH'

const WINDOW_MS = 5 * 60 * 1000
const CLUSTER_WINDOW_MS = 10 * 60 * 1000

const globalForShield = globalThis as typeof globalThis & {
  marketHubShieldWindows?: Map<string, number[]>
}
const windows = globalForShield.marketHubShieldWindows ?? new Map<string, number[]>()
globalForShield.marketHubShieldWindows = windows

function recent(key: string, windowMs: number): number[] {
  const cutoff = Date.now() - windowMs
  const hits = (windows.get(key) ?? []).filter((at) => at > cutoff)
  windows.set(key, hits)
  return hits
}

async function persist(signal: {
  type: string
  severity: Severity
  subject: string
  subjectId: string | null
  details: Record<string, unknown> | null
}) {
  const now = new Date().toISOString()
  if (!isDatabaseConfigured) {
    // Deduplicate: increment count for identical recent signals.
    const existing = mockStore.securitySignals.find(
      (entry) => entry.type === signal.type && entry.subject === signal.subject && entry.subjectId === signal.subjectId
        && Date.now() - Date.parse(entry.createdAt) < WINDOW_MS,
    )
    if (existing) {
      existing.count += 1
      return
    }
    mockStore.securitySignals.unshift({
      id: randomUUID(), type: signal.type, severity: signal.severity, subject: signal.subject,
      subjectId: signal.subjectId, count: 1, details: signal.details, createdAt: now,
    })
    if (mockStore.securitySignals.length > 500) mockStore.securitySignals.length = 500
    return
  }
  const recentRow = await prisma.securitySignal.findFirst({
    where: { type: signal.type, subject: signal.subject, subjectId: signal.subjectId, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
  })
  if (recentRow) {
    await prisma.securitySignal.update({ where: { id: recentRow.id }, data: { count: { increment: 1 } } })
    return
  }
  await prisma.securitySignal.create({
    data: {
      type: signal.type, severity: signal.severity, subject: signal.subject,
      subjectId: signal.subjectId, details: (signal.details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function noteFriendRequestBurst(actorId: string) {
  const hits = recent(`friend-request:${actorId}`, WINDOW_MS)
  hits.push(Date.now())
  if (hits.length >= 5) {
    await persist({ type: 'FRIEND_REQUEST_BURST', severity: 'MEDIUM', subject: actorId, subjectId: actorId, details: { windowMinutes: 5, threshold: 5 } })
  }
}

export async function noteRecommendationBurst(actorId: string) {
  const hits = recent(`recommendation:${actorId}`, WINDOW_MS)
  hits.push(Date.now())
  if (hits.length >= 5) {
    await persist({ type: 'RECOMMENDATION_BURST', severity: 'MEDIUM', subject: actorId, subjectId: actorId, details: { windowMinutes: 5, threshold: 5 } })
  }
}

export async function noteReviewCreated(actorId: string, targetType: string, targetId: string) {
  const hits = recent(`review-cluster:${targetType}:${targetId}`, CLUSTER_WINDOW_MS)
  hits.push(Date.now())
  if (hits.length >= 3) {
    await persist({ type: 'REVIEW_CLUSTER', severity: 'HIGH', subject: `${targetType}:${targetId}`, subjectId: targetId, details: { windowMinutes: 10, threshold: 3, actors: [...new Set(hits.map(() => actorId))] } })
  }
}

export async function noteSocialDenied(actorId: string, action: string) {
  const hits = recent(`denied:${actorId}`, WINDOW_MS)
  hits.push(Date.now())
  if (hits.length >= 3) {
    await persist({ type: 'UNAUTHORIZED_ACCESS_BURST', severity: 'HIGH', subject: actorId, subjectId: actorId, details: { windowMinutes: 5, lastAction: action } })
  }
}

/** Admin-only DTO. Never part of a public response. */
export async function listSecuritySignals(limit = 100) {
  if (!isDatabaseConfigured) {
    return mockStore.securitySignals.slice(0, limit).map((signal) => ({
      id: signal.id, type: signal.type, severity: signal.severity, subject: signal.subject,
      subjectId: signal.subjectId, count: signal.count, details: signal.details, createdAt: signal.createdAt,
    }))
  }
  const rows = await prisma.securitySignal.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  })
  return rows.map((signal) => ({
    id: signal.id, type: signal.type, severity: signal.severity, subject: signal.subject,
    subjectId: signal.subjectId, count: signal.count, details: signal.details, createdAt: signal.createdAt,
  }))
}
