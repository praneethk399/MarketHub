import type { SessionUser } from '@/services/auth'
import { readSession } from '@/services/auth'
import { DomainError } from './domain-error'

export async function requireAuth(): Promise<SessionUser> {
  const user = await readSession()
  if (!user) throw new DomainError('Sign in to continue.', 401)
  return user
}

export function requireRole(user: SessionUser, role: SessionUser['role']): SessionUser {
  if (user.role !== role) throw new DomainError('You do not have permission to perform this action.', 403)
  return user
}

export function requireCustomer(user: SessionUser): SessionUser {
  return requireRole(user, 'CUSTOMER')
}

export function requireVendor(user: SessionUser): SessionUser {
  return requireRole(user, 'VENDOR')
}

export function requireAdmin(user: SessionUser): SessionUser {
  return requireRole(user, 'ADMIN')
}

export function requireOwnership(ownerId: string, resourceOwnerId: string): void {
  if (ownerId !== resourceOwnerId) throw new DomainError('You do not have permission to access this resource.', 403)
}
