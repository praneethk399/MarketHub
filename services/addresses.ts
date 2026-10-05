import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { createMockId, mockStore, type MockAddress } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'
import type { z } from 'zod'
import type { addressSchema, addressUpdateSchema } from '@/lib/validation'

type AddressInput = z.infer<typeof addressSchema>
type AddressUpdate = z.infer<typeof addressUpdateSchema>

const selectAddress = {
  id: true, label: true, recipient: true, line1: true, line2: true, city: true,
  region: true, postalCode: true, country: true, phone: true, isDefault: true,
  createdAt: true, updatedAt: true,
} as const

export async function listAddresses(userId: string) {
  if (!isDatabaseConfigured) {
    return [...mockStore.addresses.values()]
      .filter((address) => address.userId === userId)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt))
      .map(toPublicAddress)
  }
  return prisma.address.findMany({
    where: { userId },
    select: selectAddress,
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  })
}

export async function createAddress(userId: string, input: AddressInput) {
  if (!isDatabaseConfigured) {
    const userAddresses = [...mockStore.addresses.values()].filter((address) => address.userId === userId)
    const isDefault = input.isDefault || userAddresses.length === 0
    if (isDefault) userAddresses.forEach((address) => { address.isDefault = false })
    const now = new Date().toISOString()
    const address: MockAddress = {
      ...input,
      id: createMockId(),
      userId,
      label: input.label ?? null,
      line2: input.line2 ?? null,
      phone: input.phone ?? null,
      isDefault,
      createdAt: now,
      updatedAt: now,
    }
    mockStore.addresses.set(address.id, address)
    return toPublicAddress(address)
  }
  return prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } })
    const isDefault = input.isDefault || count === 0
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    return tx.address.create({
      data: { ...input, userId, isDefault },
      select: selectAddress,
    })
  })
}

export async function updateAddress(userId: string, addressId: string, input: AddressUpdate) {
  if (!isDatabaseConfigured) {
    const address = mockStore.addresses.get(addressId)
    if (!address || address.userId !== userId) throw new DomainError('Address not found.', 404)
    if (input.isDefault) {
      for (const current of mockStore.addresses.values()) {
        if (current.userId === userId) current.isDefault = false
      }
    }
    Object.assign(address, input, { updatedAt: new Date().toISOString() })
    return toPublicAddress(address)
  }
  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: addressId, userId }, select: { id: true } })
    if (!address) throw new DomainError('Address not found.', 404)
    if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    return tx.address.update({ where: { id: addressId }, data: input, select: selectAddress })
  })
}

export async function deleteAddress(userId: string, addressId: string) {
  if (!isDatabaseConfigured) {
    const address = mockStore.addresses.get(addressId)
    if (!address || address.userId !== userId) throw new DomainError('Address not found.', 404)
    mockStore.addresses.delete(addressId)
    if (address.isDefault) {
      const next = [...mockStore.addresses.values()].find((entry) => entry.userId === userId)
      if (next) {
        next.isDefault = true
        next.updatedAt = new Date().toISOString()
      }
    }
    return { id: addressId, deleted: true }
  }
  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: addressId, userId }, select: { id: true, isDefault: true } })
    if (!address) throw new DomainError('Address not found.', 404)
    await tx.address.delete({ where: { id: addressId } })
    if (address.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' }, select: { id: true } })
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } })
    }
    return { id: addressId, deleted: true }
  })
}

function toPublicAddress(address: MockAddress) {
  const { userId: _userId, ...safeAddress } = address
  return safeAddress
}
