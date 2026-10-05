import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'

export async function recordAuditEvent(
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  request?: Request,
) {
  const ipAddress = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request?.headers.get('x-real-ip')
    || null
  const userAgent = request?.headers.get('user-agent') || null

  if (isDatabaseConfigured) {
    await prisma.auditLog.create({
      data: { userId, action, entity, entityId, ipAddress, userAgent },
    })
    return
  }

  mockStore.auditLogs.push({ userId, action, entity, entityId, createdAt: new Date().toISOString() })
}
