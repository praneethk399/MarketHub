import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, preferredItemSchema } from '@/lib/validation'
import { sameOriginOnly } from '@/lib/request-security'
import { removeListItem, setPreferredItem } from '@/services/list.service'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const user = requireCustomer(await requireAuth())
    const { id, itemId } = await params
    return NextResponse.json({ success: true, data: await removeListItem(user.id, id, itemId) })
  } catch (error) {
    return apiError(error, 'Unable to remove the list item.')
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = preferredItemSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const { id, itemId } = await params
    return NextResponse.json({ success: true, data: await setPreferredItem(user.id, id, itemId, parsed.data.preferred) })
  } catch (error) {
    return apiError(error, 'Unable to update the list item.')
  }
}
