import { DELETE } from '@/app/api/auth/route'

export async function POST(request: Request) {
  return DELETE(request)
}
