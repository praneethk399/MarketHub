import { randomUUID } from 'node:crypto'
import { VendorStatus } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { createMockId, mockStore, type MockVendorApplication } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'

export type VendorApplicationInput = {
  storeName: string
  description: string
  businessEmail: string
  phone?: string
}

export async function listMyVendorApplications(userId: string) {
  if (!isDatabaseConfigured) {
    return [...mockStore.vendorApplications.values()]
      .filter((application) => application.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return prisma.vendorApplication.findMany({
    where: { userId },
    select: { id: true, storeName: true, description: true, businessEmail: true, phone: true, status: true, adminNotes: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function submitVendorApplication(userId: string, input: VendorApplicationInput) {
  if (!isDatabaseConfigured) {
    const existingVendor = mockStore.vendors.some((vendor) => vendor.userId === userId)
    const existingApplication = [...mockStore.vendorApplications.values()].some((application) =>
      application.userId === userId && application.status === 'PENDING')
    if (existingVendor || existingApplication) throw new DomainError('You already have a vendor profile or pending application.', 409)
    const now = new Date().toISOString()
    const application: MockVendorApplication = {
      id: createMockId(),
      userId,
      storeName: input.storeName.trim(),
      description: input.description.trim(),
      businessEmail: input.businessEmail.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      status: 'PENDING',
      adminNotes: null,
      createdAt: now,
      updatedAt: now,
    }
    mockStore.vendorApplications.set(application.id, application)
    return application
  }

  const [vendor, pendingApplication] = await Promise.all([
    prisma.vendor.findUnique({ where: { userId }, select: { id: true } }),
    prisma.vendorApplication.findFirst({ where: { userId, status: VendorStatus.PENDING }, select: { id: true } }),
  ])
  if (vendor || pendingApplication) throw new DomainError('You already have a vendor profile or pending application.', 409)
  return prisma.vendorApplication.create({
    data: {
      userId,
      storeName: input.storeName.trim(),
      description: input.description.trim(),
      businessEmail: input.businessEmail.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
    },
    select: { id: true, storeName: true, description: true, businessEmail: true, phone: true, status: true, adminNotes: true, createdAt: true, updatedAt: true },
  })
}

export async function listVendorApplications() {
  if (!isDatabaseConfigured) {
    return [...mockStore.vendorApplications.values()].map((application) => {
      const user = mockStore.users.get(application.userId)
      return { ...application, user: user ? { id: user.id, name: user.name, email: user.email } : null }
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return prisma.vendorApplication.findMany({
    select: {
      id: true, storeName: true, description: true, businessEmail: true, phone: true,
      status: true, adminNotes: true, createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function reviewVendorApplication(
  adminId: string,
  applicationId: string,
  decision: 'approve' | 'reject',
  adminNotes?: string,
) {
  if (!isDatabaseConfigured) {
    const application = mockStore.vendorApplications.get(applicationId)
    if (!application) throw new DomainError('Vendor application not found.', 404)
    if (application.status !== 'PENDING') throw new DomainError('This application has already been reviewed.', 409)
    const now = new Date().toISOString()
    application.status = decision === 'approve' ? 'APPROVED' : 'REJECTED'
    application.adminNotes = adminNotes?.trim() || null
    application.updatedAt = now
    if (decision === 'approve') {
      const user = mockStore.users.get(application.userId)
      if (!user) throw new DomainError('The applicant account no longer exists.', 404)
      const slug = `${slugify(application.storeName)}-${randomUUID().slice(0, 8)}`
      mockStore.vendors.push({
        id: createMockId(), userId: user.id, name: application.storeName, storeName: application.storeName,
        slug, city: 'Not specified', status: 'APPROVED', verified: true, booksSold: 0,
        authenticity: 0, onTimeDelivery: 0, returnRate: 0, disputeRate: 0, activeSince: now,
      })
      user.role = 'VENDOR'
    }
    mockStore.auditLogs.push({
      userId: adminId, action: decision === 'approve' ? 'VENDOR_APPROVED' : 'VENDOR_REJECTED',
      entity: 'VendorApplication', entityId: applicationId, createdAt: now,
    })
    return { id: application.id, status: application.status, adminNotes: application.adminNotes }
  }

  return prisma.$transaction(async (tx) => {
    const application = await tx.vendorApplication.findUnique({ where: { id: applicationId } })
    if (!application) throw new DomainError('Vendor application not found.', 404)
    if (application.status !== VendorStatus.PENDING) throw new DomainError('This application has already been reviewed.', 409)

    let vendorId: string | null = null
    if (decision === 'approve') {
      const vendor = await tx.vendor.create({
        data: {
          userId: application.userId,
          name: application.storeName,
          storeName: application.storeName,
          slug: `${slugify(application.storeName)}-${randomUUID().slice(0, 8)}`,
          description: application.description,
          email: application.businessEmail,
          phone: application.phone,
          city: 'Not specified',
          status: VendorStatus.APPROVED,
          verified: true,
        },
        select: { id: true },
      })
      vendorId = vendor.id
      await tx.user.update({ where: { id: application.userId }, data: { role: 'VENDOR' } })
    }
    const status = decision === 'approve' ? VendorStatus.APPROVED : VendorStatus.REJECTED
    const updated = await tx.vendorApplication.update({
      where: { id: applicationId },
      data: { status, adminNotes: adminNotes?.trim() || null, vendorId },
      select: { id: true, status: true, adminNotes: true },
    })
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: decision === 'approve' ? 'VENDOR_APPROVED' : 'VENDOR_REJECTED',
        entity: 'VendorApplication',
        entityId: applicationId,
        metadata: vendorId ? { vendorId } : undefined,
      },
    })
    return updated
  })
}

export async function suspendVendor(adminId: string, vendorId: string) {
  if (!isDatabaseConfigured) {
    const vendor = mockStore.vendors.find((entry) => entry.id === vendorId)
    if (!vendor) throw new DomainError('Vendor not found.', 404)
    vendor.status = 'SUSPENDED'
    vendor.verified = false
    mockStore.auditLogs.push({
      userId: adminId, action: 'VENDOR_SUSPENDED', entity: 'Vendor', entityId: vendorId, createdAt: new Date().toISOString(),
    })
    return { id: vendor.id, status: vendor.status }
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.SUSPENDED, verified: false },
      select: { id: true, status: true },
    }).catch((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        throw new DomainError('Vendor not found.', 404)
      }
      throw error
    })
    await tx.auditLog.create({
      data: { userId: adminId, action: 'VENDOR_SUSPENDED', entity: 'Vendor', entityId: vendorId },
    })
    return updated
  })
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bookstore'
}
