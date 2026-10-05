import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, listUpdateSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { deleteList, getList, updateList } from '@/services/list.service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireCustomer(await requireAuth())
    const { id } = await params
    return NextResponse.json({ success: true, data: await getList(user.id, id) })
  } catch (error) {
    return apiError(error, 'Unable to load the list.')
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'list-update', limit: 60, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = listUpdateSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const { id } = await params
    return NextResponse.json({ success: true, data: await updateList(user.id, id, parsed.data) })
  } catch (error) {
    return apiError(error, 'Unable to update the list.')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const user = requireCustomer(await requireAuth())
    const { id } = await params
    await deleteList(user.id, id)
    return NextResponse.json({ success: true, data: { id, deleted: true } })
  } catch (error) {
    return apiError(error, 'Unable to delete the list.')
  }
}
