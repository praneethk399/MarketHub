import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, createMockId, type MockFriendship } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'
import { noteFriendRequestBurst, noteSocialDenied } from '@/services/marketShield.service'

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED'

export type FriendDto = {
  friendshipId: string
  status: FriendshipStatus
  direction: 'OUTGOING' | 'INCOMING' | 'MUTUAL'
  since: string
  user: { id: string; name: string; avatar: string | null }
}

function toFriendDto(
  friendship: { id: string; requesterId: string; addresseeId: string; status: FriendshipStatus; createdAt: Date | string },
  viewerId: string,
  usersById: Map<string, { id: string; name: string; avatar?: string | null }>,
): FriendDto | null {
  const otherId = friendship.requesterId === viewerId ? friendship.addresseeId : friendship.requesterId
  const other = usersById.get(otherId)
  if (!other) return null
  const direction = friendship.status === 'ACCEPTED' || friendship.status === 'BLOCKED'
    ? 'MUTUAL' as const
    : friendship.requesterId === viewerId ? 'OUTGOING' as const : 'INCOMING' as const
  return {
    friendshipId: friendship.id,
    status: friendship.status,
    direction,
    since: typeof friendship.createdAt === 'string' ? friendship.createdAt : friendship.createdAt.toISOString(),
    user: { id: other.id, name: other.name, avatar: other.avatar ?? null },
  }
}

/** Accepted friend ids for a viewer (both directions). One query, no N+1. */
export async function getFriendIds(userId: string): Promise<Set<string>> {
  if (!isDatabaseConfigured) {
    const ids = new Set<string>()
    for (const friendship of mockStore.friendships) {
      if (friendship.status !== 'ACCEPTED') continue
      if (friendship.requesterId === userId) ids.add(friendship.addresseeId)
      else if (friendship.addresseeId === userId) ids.add(friendship.requesterId)
    }
    return ids
  }
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  })
  const ids = new Set<string>()
  for (const row of rows) ids.add(row.requesterId === userId ? row.addresseeId : row.requesterId)
  return ids
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return false
  return (await getFriendIds(a)).has(b)
}

async function loadUsers(ids: string[]) {
  const unique = [...new Set(ids)]
  const map = new Map<string, { id: string; name: string; avatar?: string | null }>()
  if (!unique.length) return map
  if (!isDatabaseConfigured) {
    for (const id of unique) {
      const user = mockStore.users.get(id)
      if (user) map.set(id, { id: user.id, name: user.name, avatar: null })
    }
    return map
  }
  const rows = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, avatar: true, isActive: true },
  })
  for (const row of rows) if (row.isActive) map.set(row.id, row)
  return map
}

export async function listFriendships(userId: string) {
  const records = !isDatabaseConfigured
    ? mockStore.friendships.filter((f) => f.requesterId === userId || f.addresseeId === userId)
    : await prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        orderBy: { updatedAt: 'desc' },
      })
  const usersById = await loadUsers(records.flatMap((f) => [f.requesterId, f.addresseeId]))
  const dtos = records
    .map((record) => toFriendDto(record, userId, usersById))
    .filter((dto): dto is FriendDto => dto !== null)
  return {
    friends: dtos.filter((dto) => dto.status === 'ACCEPTED'),
    incoming: dtos.filter((dto) => dto.status === 'PENDING' && dto.direction === 'INCOMING'),
    outgoing: dtos.filter((dto) => dto.status === 'PENDING' && dto.direction === 'OUTGOING'),
    blocked: dtos.filter((dto) => dto.status === 'BLOCKED'),
  }
}

async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!isDatabaseConfigured) {
    return [...mockStore.users.values()].find((user) => user.email === normalized) ?? null
  }
  return prisma.user.findFirst({ where: { email: normalized }, select: { id: true, name: true, isActive: true, role: true } })
}

export async function createFriendRequest(requesterId: string, email: string): Promise<FriendDto> {
  if (!email.trim()) throw new DomainError('Enter an email address to send a request.', 400)
  const target = await findUserByEmail(email)
  if (!target || ('isActive' in target && !target.isActive)) throw new DomainError('No account matches that email address.', 404)
  if (target.id === requesterId) throw new DomainError('You cannot add yourself as a friend.', 400)

  if (!isDatabaseConfigured) {
    const existing = mockStore.friendships.find((f) =>
      (f.requesterId === requesterId && f.addresseeId === target.id)
      || (f.requesterId === target.id && f.addresseeId === requesterId))
    if (existing) {
      if (existing.status === 'BLOCKED') throw new DomainError('This connection request is not available.', 403)
      if (existing.status === 'ACCEPTED') throw new DomainError('You are already connected.', 409)
      if (existing.status === 'PENDING') throw new DomainError('A friend request is already pending.', 409)
      existing.status = 'PENDING' // DECLINED can be retried
      existing.requesterId = requesterId
      existing.updatedAt = new Date().toISOString()
      await noteFriendRequestBurst(requesterId)
      const users = await loadUsers([target.id])
      return toFriendDto(existing, requesterId, users)!
    }
    const friendship: MockFriendship = {
      id: createMockId(), requesterId, addresseeId: target.id, status: 'PENDING',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    mockStore.friendships.push(friendship)
    await noteFriendRequestBurst(requesterId)
    const users = await loadUsers([target.id])
    return toFriendDto(friendship, requesterId, users)!
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: requesterId },
      ],
    },
  })
  if (existing) {
    if (existing.status === 'BLOCKED') throw new DomainError('This connection request is not available.', 403)
    if (existing.status === 'ACCEPTED') throw new DomainError('You are already connected.', 409)
    if (existing.status === 'PENDING') throw new DomainError('A friend request is already pending.', 409)
    const retried = await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: 'PENDING', requesterId, addresseeId: target.id },
    })
    await noteFriendRequestBurst(requesterId)
    const users = await loadUsers([target.id])
    return toFriendDto(retried, requesterId, users)!
  }

  const created = await prisma.friendship.create({ data: { requesterId, addresseeId: target.id, status: 'PENDING' } })
  await noteFriendRequestBurst(requesterId)
  const users = await loadUsers([target.id])
  return toFriendDto(created, requesterId, users)!
}

export type FriendAction = 'accept' | 'decline' | 'block'

export async function respondToFriendRequest(userId: string, friendshipId: string, action: FriendAction) {
  const record = !isDatabaseConfigured
    ? mockStore.friendships.find((f) => f.id === friendshipId)
    : await prisma.friendship.findUnique({ where: { id: friendshipId } })
  if (!record) throw new DomainError('Friend request not found.', 404)
  if (record.status === 'BLOCKED') throw new DomainError('This connection is blocked.', 403)

  const isAddressee = record.addresseeId === userId
  const isRequester = record.requesterId === userId
  if (action === 'accept' || action === 'decline') {
    // Only the recipient may act on an incoming request (spec §6: no
    // unauthorized relationship modification).
    if (!isAddressee) {
      await noteSocialDenied(userId, `friend_${action}`)
      throw new DomainError('You do not have permission to perform this action.', 403)
    }
    if (record.status !== 'PENDING') throw new DomainError('This request has already been handled.', 409)
  } else {
    // Either party may block.
    if (!isAddressee && !isRequester) {
      await noteSocialDenied(userId, 'friend_block')
      throw new DomainError('You do not have permission to perform this action.', 403)
    }
  }

  const status: FriendshipStatus = action === 'accept' ? 'ACCEPTED' : action === 'decline' ? 'DECLINED' : 'BLOCKED'
  if (!isDatabaseConfigured) {
    record.status = status
    record.updatedAt = new Date().toISOString()
    return { friendshipId: record.id, status }
  }
  await prisma.friendship.update({ where: { id: friendshipId }, data: { status } })
  return { friendshipId, status }
}

export async function removeFriendship(userId: string, friendshipId: string) {
  const record = !isDatabaseConfigured
    ? mockStore.friendships.find((f) => f.id === friendshipId)
    : await prisma.friendship.findUnique({ where: { id: friendshipId } })
  if (!record) throw new DomainError('Connection not found.', 404)
  const isParty = record.requesterId === userId || record.addresseeId === userId
  if (!isParty) {
    await noteSocialDenied(userId, 'friend_remove')
    throw new DomainError('You do not have permission to perform this action.', 403)
  }
  // A pending request may only be cancelled by its sender; accepted
  // connections may be removed by either side.
  if (record.status === 'PENDING' && record.requesterId !== userId) {
    await noteSocialDenied(userId, 'friend_remove_pending')
    throw new DomainError('You do not have permission to perform this action.', 403)
  }
  if (!isDatabaseConfigured) {
    mockStore.friendships = mockStore.friendships.filter((f) => f.id !== friendshipId)
    return true
  }
  await prisma.friendship.delete({ where: { id: friendshipId } })
  return true
}
