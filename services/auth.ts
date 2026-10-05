import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, createMockId, type MockUser } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'

const scrypt = promisify(scryptCallback)
const cookieName = 'markethub_session'
const sessionLifetime = 60 * 60 * 24 * 7

export type SessionUser = { id: string; name: string; email: string; role: 'CUSTOMER' | 'VENDOR' | 'ADMIN' }
type SessionPayload = SessionUser & { expiresAt: number }

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 32) return secret
  if (secret) throw new Error('SESSION_SECRET must contain at least 32 characters.')
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be configured in production.')
  return 'local-development-only-market-hub-session-secret'
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${derived.toString('hex')}`
}

async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, expectedHex] = passwordHash.split(':')
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = await scrypt(password, salt, expected.length) as Buffer
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function toSessionUser(user: SessionUser): SessionUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

function sign(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = { ...toSessionUser(user), expiresAt: Date.now() + sessionLifetime * 1000 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName)?.value
  if (!token) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  const expected = Buffer.from(sign(encoded))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  let payload: SessionPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload
  } catch {
    return null
  }
  if (!payload.id || !payload.email || payload.expiresAt <= Date.now()) return null
  const currentUser = isDatabaseConfigured
    ? await prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, name: true, email: true, role: true } })
    : mockStore.users.get(payload.id) ?? null
  return currentUser ? toSessionUser(currentUser) : null
}

export function setSessionCookie(response: Response, user: SessionUser) {
  const token = createSessionToken(user)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.headers.append('Set-Cookie', `${cookieName}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionLifetime}${secure}`)
  return response
}

export function clearSessionCookie(response: Response) {
  response.headers.append('Set-Cookie', `${cookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`)
  return response
}

export async function registerUser(name: string, email: string, password: string): Promise<SessionUser> {
  const normalizedEmail = email.trim().toLowerCase()
  const passwordHash = await hashPassword(password)
  if (isDatabaseConfigured) {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
    if (existing) throw new DomainError('An account with this email already exists.', 409)
    return prisma.user.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash },
      select: { id: true, name: true, email: true, role: true },
    })
  }

  if ([...mockStore.users.values()].some((user) => user.email === normalizedEmail)) {
    throw new DomainError('An account with this email already exists.', 409)
  }
  const user: MockUser = { id: createMockId(), name: name.trim(), email: normalizedEmail, passwordHash, role: 'CUSTOMER' }
  mockStore.users.set(user.id, user)
  return toSessionUser(user)
}

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase()
  const user = isDatabaseConfigured
    ? await prisma.user.findUnique({ where: { email: normalizedEmail } })
    : [...mockStore.users.values()].find((entry) => entry.email === normalizedEmail) ?? null
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null
  return toSessionUser(user)
}

export { cookieName }
