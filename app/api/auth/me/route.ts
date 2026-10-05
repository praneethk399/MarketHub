import { GET as getAuth } from '@/app/api/auth/route'

export async function GET() {
  return getAuth()
}
