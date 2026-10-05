import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { compare, hash } from 'bcryptjs'
import { cookies } from 'next/headers'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, createMockId, type MockUser } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'

const scrypt = promisify(scryptCallback)
const cookieName = 'markethub_session'
const sessionLifetime = 60 * 60 * 24 * 7
const bcryptRounds = 12

export type SessionUser = { id: string; name: string; email: string; role: 'CUSTOMER' | 'VENDOR' | 'ADMIN' }

async function hashPassword(password: string) {
  return hash(password, bcryptRounds)
}

async function verifyPassword(password: string, passwordHash: string) {
  if (passwordHash.startsWith('$2')) return compare(password, passwordHash)

  const [algorithm, salt, expectedHex] = passwordHash.split(':')
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = await scrypt(password, salt, expected.length) as Buffer
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function toSessionUser(user: SessionUser): SessionUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName)?.value
  if (!token || token.length > 128) return null

  const tokenHash = hashSessionToken(token)
  if (isDatabaseConfigured) {
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
    })
    if (!session) return null
    if (session.expiresAt <= new Date() || !session.user.isActive) {
      await prisma.session.deleteMany({ where: { id: session.id } })
      return null
    }
    return toSessionUser(session.user)
  }

  const session = mockStore.sessions.get(tokenHash)
  if (!session) return null
  const user = mockStore.users.get(session.userId)
  if (session.expiresAt <= Date.now() || !user) {
    mockStore.sessions.delete(tokenHash)
    return null
  }
  return toSessionUser(user)
}

export async function setSessionCookie(response: Response, user: SessionUser) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashSessionToken(token)
  const expiresAt = new Date(Date.now() + sessionLifetime * 1000)

  if (isDatabaseConfigured) {
    await prisma.session.create({ data: { userId: user.id, tokenHash, expiresAt } })
  } else {
    mockStore.sessions.set(tokenHash, { userId: user.id, expiresAt: expiresAt.getTime() })
  }

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.headers.append('Set-Cookie', `${cookieName}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionLifetime}${secure}`)
  return response
}

export async function clearSessionCookie(response: Response) {
  const token = (await cookies()).get(cookieName)?.value
  if (token && token.length <= 128) {
    const tokenHash = hashSessionToken(token)
    if (isDatabaseConfigured) {
      await prisma.session.deleteMany({ where: { tokenHash } })
    } else {
      mockStore.sessions.delete(tokenHash)
    }
  }

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.headers.append('Set-Cookie', `${cookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`)
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
  if (!user || ('isActive' in user && !user.isActive) || !(await verifyPassword(password, user.passwordHash))) return null

  if (user.passwordHash.startsWith('scrypt:')) {
    const passwordHash = await hashPassword(password)
    if (isDatabaseConfigured) {
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
    } else {
      user.passwordHash = passwordHash
    }
  }
  return toSessionUser(user)
}

export { cookieName }
