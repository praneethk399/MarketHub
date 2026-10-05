import { NextResponse } from 'next/server'
import { apiError, unauthorized } from '@/lib/api'
import { DomainError } from '@/lib/domain-error'
import { readSession } from '@/services/auth'
import { checkout } from '@/services/orders'

export async function POST() {
  try {
    const user = await readSession()
    if (!user) return unauthorized()
    return NextResponse.json({ data: await checkout(user.id) }, { status: 201 })
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return apiError(error, 'Checkout could not be completed.')
  }
}
