import { ViteShell } from '@/components/vite-shell'
import { ViteAuthPage } from '@/components/vite-auth'

export const metadata = {
  title: 'Create account | MarketHub',
}

export default function RegisterPage() {
  return (
    <ViteShell noFooter>
      <ViteAuthPage kind="register" />
    </ViteShell>
  )
}
