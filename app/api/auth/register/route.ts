import { apiError, readJsonObject } from '@/lib/api'
import { POST as authenticate } from '@/app/api/auth/route'

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request)
    const headers = new Headers(request.headers)
    headers.delete('content-length')
    headers.set('content-type', 'application/json')
    return authenticate(new Request(request.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, action: 'register' }),
    }))
  } catch (error) {
    return apiError(error, 'Unable to register.')
  }
}
