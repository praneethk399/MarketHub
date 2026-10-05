import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, createMockId, type MockList } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'
import { areFriends } from '@/services/friend.service'
import { getPrivacy, type PrivacySettings } from '@/services/privacy.service'
import { requireTarget, resolveTargets, type SocialTargetType } from '@/services/social-targets'

/**
 * Shared / collaborative lists (spec §13/§14).
 *
 * Every operation follows:
 *   AUTHENTICATE → VISIBILITY → MEMBERSHIP → PERMISSION → SERVICE → DB → DTO
 * Ownership and membership are always enforced server-side.
 *
 * Visibility rules:
 * - PRIVATE: owner only (members beyond the owner cannot exist unless shared).
 * - SHARED:  invited members only (viewers/editors/owner).
 * - PUBLIC:  anyone may view; only OWNER/EDITOR may modify.
 * Changing members or visibility is owner-only. Ownership cannot be transferred.
 */

export type ListRole = 'OWNER' | 'EDITOR' | 'VIEWER'

type StoredList = MockList

type Access = { list: StoredList; role: ListRole | null }

function roleOf(list: StoredList, userId: string): ListRole | null {
  const member = list.members.find((entry) => entry.userId === userId)
  if (member) return member.role
  return list.ownerId === userId ? 'OWNER' : null
}

async function loadList(listId: string): Promise<StoredList | null> {
  if (!isDatabaseConfigured) {
    return mockStore.lists.find((list) => list.id === listId) ?? null
  }
  const row = await prisma.socialList.findUnique({
    where: { id: listId },
    include: { items: { orderBy: { createdAt: 'asc' } }, members: { orderBy: { createdAt: 'asc' } } },
  })
  if (!row) return null
  return {
    id: row.id, ownerId: row.ownerId, title: row.title, description: row.description,
    visibility: row.visibility, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((item) => ({
      id: item.id, targetType: item.targetType, targetId: item.targetId,
      addedById: item.addedById, note: item.note, preferred: item.preferred,
      createdAt: item.createdAt.toISOString(),
    })),
    members: row.members.map((member) => ({
      id: member.id, userId: member.userId, role: member.role, createdAt: member.createdAt.toISOString(),
    })),
  }
}

/** Visibility check: returns the caller's role or throws 403/404. */
async function requireViewAccess(userId: string, listId: string): Promise<Access> {
  const list = await loadList(listId)
  if (!list) throw new DomainError('List not found.', 404)
  const role = roleOf(list, userId)
  if (list.visibility === 'PUBLIC') return { list, role }
  if (list.visibility === 'SHARED') {
    if (!role) throw new DomainError('This shared list is only visible to its members.', 403)
    return { list, role }
  }
  if (!role || role !== 'OWNER') throw new DomainError('This list is private.', 403)
  return { list, role }
}

function requireRole(access: Access, allowed: ListRole[], userId: string) {
  if (!access.role || !allowed.includes(access.role)) {
    throw new DomainError('You do not have permission to modify this list.', 403)
  }
  return access
}

async function peopleNames(ids: string[]) {
  const unique = [...new Set(ids)]
  const map = new Map<string, string>()
  if (!unique.length) return map
  if (!isDatabaseConfigured) {
    for (const id of unique) {
      const user = mockStore.users.get(id)
      if (user) map.set(id, user.name)
    }
    return map
  }
  for (const user of await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } })) {
    map.set(user.id, user.name)
  }
  return map
}

async function toDto(list: StoredList, viewerId: string, includeMembers: boolean) {
  const targets = await resolveTargets('BOOK', list.items.filter((i) => i.targetType === 'BOOK').map((i) => i.targetId))
  const productTargets = await resolveTargets('PRODUCT', list.items.filter((i) => i.targetType === 'PRODUCT').map((i) => i.targetId))
  const people = await peopleNames([list.ownerId, ...list.items.map((i) => i.addedById ?? ''), ...list.members.map((m) => m.userId)])
  const role = roleOf(list, viewerId)
  return {
    id: list.id,
    title: list.title,
    description: list.description,
    visibility: list.visibility,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    myRole: role,
    owner: { id: list.ownerId, name: people.get(list.ownerId) ?? 'Owner' },
    itemCount: list.items.length,
    items: list.items.map((item) => {
      const target = item.targetType === 'BOOK' ? targets.get(item.targetId) : productTargets.get(item.targetId)
      return {
        id: item.id,
        targetType: item.targetType,
        targetId: item.targetId,
        note: item.note,
        preferred: item.preferred,
        createdAt: item.createdAt,
        addedBy: item.addedById ? { id: item.addedById, name: people.get(item.addedById) ?? 'Member' } : null,
        target: target
          ? { type: target.type, id: target.id, title: target.title, author: target.author, cover: target.cover, price: target.price }
          : null,
      }
    }),
    // Members are only exposed to members themselves (never to PUBLIC viewers).
    members: includeMembers && role
      ? list.members.map((member) => ({
          userId: member.userId,
          name: people.get(member.userId) ?? 'Member',
          role: member.role,
        }))
      : undefined,
  }
}

function normalizeList(row: {
  id: string; ownerId: string; title: string; description: string | null; visibility: MockList['visibility']
  createdAt: Date | string; updatedAt: Date | string
  items: { id: string; targetType: SocialTargetType; targetId: string; addedById: string | null; note: string | null; preferred: boolean; createdAt: Date | string }[]
  members: { id: string; userId: string; role: ListRole; createdAt: Date | string }[]
}): StoredList {
  const iso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value)
  return {
    id: row.id, ownerId: row.ownerId, title: row.title, description: row.description,
    visibility: row.visibility, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
    items: row.items.map((item) => ({
      id: item.id, targetType: item.targetType, targetId: item.targetId,
      addedById: item.addedById, note: item.note, preferred: item.preferred, createdAt: iso(item.createdAt),
    })),
    members: row.members.map((member) => ({
      id: member.id, userId: member.userId, role: member.role, createdAt: iso(member.createdAt),
    })),
  }
}

export async function listLists(userId: string) {
  // Only lists the caller owns or belongs to are returned, so membership
  // details are safe to include for the caller's own lists.
  if (!isDatabaseConfigured) {
    const lists = mockStore.lists.filter((list) => list.ownerId === userId || list.members.some((m) => m.userId === userId))
    return Promise.all(lists.map((list) => toDto(list, userId, true)))
  }
  const rows = await prisma.socialList.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { updatedAt: 'desc' },
    include: { items: true, members: true },
  })
  return Promise.all(rows.map((row) => toDto(normalizeList(row), userId, true)))
}

export async function getList(userId: string, listId: string) {
  const access = await requireViewAccess(userId, listId)
  return toDto(access.list, userId, Boolean(access.role))
}

export async function createList(userId: string, input: { title: string; description?: string; visibility?: MockList['visibility'] }) {
  const privacy: PrivacySettings = await getPrivacy(userId)
  const visibility = input.visibility ?? privacy.defaultListVisibility
  const timestamp = new Date().toISOString()
  const list: StoredList = {
    id: createMockId(),
    ownerId: userId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    visibility,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: [],
    members: [{ id: createMockId(), userId, role: 'OWNER', createdAt: timestamp }],
  }
  if (!isDatabaseConfigured) {
    mockStore.lists.unshift(list)
    return toDto(list, userId, true)
  }
  const created = await prisma.socialList.create({
    data: {
      ownerId: userId, title: list.title, description: list.description, visibility,
      members: { create: { userId, role: 'OWNER' } },
    },
    include: { items: true, members: true },
  })
  return toDto(normalizeList(created), userId, true)
}

export async function updateList(userId: string, listId: string, patch: { title?: string; description?: string | null; visibility?: MockList['visibility'] }) {
  const access = await requireViewAccess(userId, listId)
  // Visibility, title and description changes are owner-only.
  if (access.role !== 'OWNER') throw new DomainError('You do not have permission to modify this list.', 403)
  const list = access.list
  if (patch.title !== undefined) list.title = patch.title.trim().slice(0, 120)
  if (patch.description !== undefined) list.description = patch.description ? patch.description.trim().slice(0, 500) : null
  if (patch.visibility !== undefined) list.visibility = patch.visibility
  list.updatedAt = new Date().toISOString()
  if (!isDatabaseConfigured) return toDto(list, userId, true)
  await prisma.socialList.update({
    where: { id: listId },
    data: {
      ...(patch.title !== undefined ? { title: list.title } : {}),
      ...(patch.description !== undefined ? { description: list.description } : {}),
      ...(patch.visibility !== undefined ? { visibility: list.visibility } : {}),
    },
  })
  return toDto(list, userId, true)
}

export async function deleteList(userId: string, listId: string) {
  const access = await requireViewAccess(userId, listId)
  if (access.role !== 'OWNER') throw new DomainError('Only the owner can delete this list.', 403)
  if (!isDatabaseConfigured) {
    mockStore.lists = mockStore.lists.filter((list) => list.id !== listId)
    return true
  }
  await prisma.socialList.delete({ where: { id: listId } })
  return true
}

export async function addListItem(userId: string, listId: string, input: { targetType: SocialTargetType; targetId: string; note?: string }) {
  const access = await requireViewAccess(userId, listId)
  requireRole(access, ['OWNER', 'EDITOR'], userId)
  await requireTarget(input.targetType, input.targetId)
  const duplicate = access.list.items.find((item) => item.targetType === input.targetType && item.targetId === input.targetId)
  if (duplicate) throw new DomainError('That item is already on this list.', 409)
  const item = {
    id: createMockId(), targetType: input.targetType, targetId: input.targetId,
    addedById: userId, note: input.note?.trim().slice(0, 300) || null, preferred: false,
    createdAt: new Date().toISOString(),
  }
  if (!isDatabaseConfigured) {
    access.list.items.push(item)
    access.list.updatedAt = item.createdAt
    return toDto(access.list, userId, true)
  }
  await prisma.listItem.create({
    data: { listId, targetType: input.targetType, targetId: input.targetId, addedById: userId, note: item.note },
  })
  const refreshed = await loadList(listId)
  if (!refreshed) throw new DomainError('List not found.', 404)
  return toDto(refreshed, userId, true)
}

export async function removeListItem(userId: string, listId: string, itemId: string) {
  const access = await requireViewAccess(userId, listId)
  requireRole(access, ['OWNER', 'EDITOR'], userId)
  const item = access.list.items.find((entry) => entry.id === itemId)
  if (!item) throw new DomainError('List item not found.', 404)
  if (!isDatabaseConfigured) {
    access.list.items = access.list.items.filter((entry) => entry.id !== itemId)
    return toDto(access.list, userId, true)
  }
  await prisma.listItem.deleteMany({ where: { id: itemId, listId } })
  const refreshed = await loadList(listId)
  if (!refreshed) throw new DomainError('List not found.', 404)
  return toDto(refreshed, userId, true)
}

export async function setPreferredItem(userId: string, listId: string, itemId: string, preferred: boolean) {
  const access = await requireViewAccess(userId, listId)
  requireRole(access, ['OWNER', 'EDITOR'], userId)
  const item = access.list.items.find((entry) => entry.id === itemId)
  if (!item) throw new DomainError('List item not found.', 404)
  if (!isDatabaseConfigured) {
    item.preferred = preferred
    return toDto(access.list, userId, true)
  }
  await prisma.listItem.updateMany({ where: { id: itemId, listId }, data: { preferred } })
  const refreshed = await loadList(listId)
  if (!refreshed) throw new DomainError('List not found.', 404)
  return toDto(refreshed, userId, true)
}

export async function addListMember(userId: string, listId: string, input: { email: string; role: 'EDITOR' | 'VIEWER' }) {
  const access = await requireViewAccess(userId, listId)
  if (access.role !== 'OWNER') throw new DomainError('Only the owner can manage members.', 403)

  const email = input.email.trim().toLowerCase()
  let memberId: string | null
  if (!isDatabaseConfigured) {
    memberId = [...mockStore.users.values()].find((user) => user.email === email)?.id ?? null
  } else {
    memberId = (await prisma.user.findFirst({ where: { email }, select: { id: true } }))?.id ?? null
  }
  if (!memberId) throw new DomainError('No account matches that email address.', 404)
  if (memberId === access.list.ownerId) throw new DomainError('The owner is already a member.', 409)
  // Members must be accepted friends of the owner (trusted sharing only).
  if (!(await areFriends(access.list.ownerId, memberId))) {
    throw new DomainError('You can share lists with accepted friends only.', 403)
  }
  if (access.list.members.some((member) => member.userId === memberId)) {
    throw new DomainError('That person is already a member.', 409)
  }
  const membership = { id: createMockId(), userId: memberId, role: input.role, createdAt: new Date().toISOString() }
  if (!isDatabaseConfigured) {
    access.list.members.push(membership)
    // Sharing with members makes the list at least SHARED.
    if (access.list.visibility === 'PRIVATE') access.list.visibility = 'SHARED'
    return toDto(access.list, userId, true)
  }
  await prisma.listMember.create({ data: { listId, userId: memberId, role: input.role } })
  if (access.list.visibility === 'PRIVATE') {
    await prisma.socialList.update({ where: { id: listId }, data: { visibility: 'SHARED' } })
  }
  const refreshed = await loadList(listId)
  if (!refreshed) throw new DomainError('List not found.', 404)
  return toDto(refreshed, userId, true)
}

export async function removeListMember(userId: string, listId: string, memberId: string) {
  const access = await requireViewAccess(userId, listId)
  if (access.role !== 'OWNER') throw new DomainError('Only the owner can manage members.', 403)
  if (memberId === access.list.ownerId) throw new DomainError('The owner cannot be removed from their own list.', 400)
  if (!access.list.members.some((member) => member.userId === memberId)) {
    throw new DomainError('That person is not a member of this list.', 404)
  }
  if (!isDatabaseConfigured) {
    access.list.members = access.list.members.filter((member) => member.userId !== memberId)
    return toDto(access.list, userId, true)
  }
  await prisma.listMember.deleteMany({ where: { listId, userId: memberId } })
  const refreshed = await loadList(listId)
  if (!refreshed) throw new DomainError('List not found.', 404)
  return toDto(refreshed, userId, true)
}
