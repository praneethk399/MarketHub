import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, listCreateSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { createList, listLists } from '@/services/list.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = requireCustomer(await requireAuth())
    return NextResponse.json({ success: true, data: await listLists(user.id) })
  } catch (error) {
    return apiError(error, 'Unable to load lists.')
  }
}

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'list-create', limit: 20, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = listCreateSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const list = await createList(user.id, parsed.data)
    return NextResponse.json({ success: true, data: list }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to create the list.')
  }
}
