import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { sameOriginOnly } from '@/lib/request-security'
import { removeListMember } from '@/services/list.service'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const user = requireCustomer(await requireAuth())
    const { id, userId } = await params
    return NextResponse.json({ success: true, data: await removeListMember(user.id, id, userId) })
  } catch (error) {
    return apiError(error, 'Unable to remove the member.')
  }
}
