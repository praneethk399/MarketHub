import { ViteShell } from '@/components/vite-shell'
import { ViteAuthPage } from '@/components/vite-auth'

export const metadata = {
  title: 'Sign in | MarketHub',
}

export default function LoginPage() {
  return (
    <ViteShell noFooter>
      <ViteAuthPage kind="login" />
    </ViteShell>
  )
}
