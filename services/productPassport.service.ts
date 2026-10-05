import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'
import { resolveTarget, type SocialTargetType } from '@/services/social-targets'
import { getSellerPassport } from '@/services/sellerPassport.service'
import { compareSellers } from '@/services/sellerComparison.service'

/**
 * Product Passport (spec §17) — customer-facing, integrated into the existing
 * product/book detail page. Every field is either real platform data or an
 * explicit "Not enough data / Not specified" marker (spec §53).
 */

export type ProductPassportDto = {
  target: {
    type: SocialTargetType
    id: string
    title: string
    author: string
    category: string | null
    isbn: string | null
    format: string | null
    price: number | null
  }
  sellerVerification: { verified: boolean; label: string }
  authenticity: { label: string; detail: string }
  warranty: { label: string; detail: string }
  returns: { label: string; detail: string }
  delivery: { label: string; detail: string }
  priceHistory: {
    tracked: boolean
    label: string
    points: { price: number; recordedAt: string }[]
    currentPrice: number | null
    listPrice: number | null
  }
  sellerPassport: Awaited<ReturnType<typeof getSellerPassport>>
  sellerComparison: Awaited<ReturnType<typeof compareSellers>>
}

export async function getProductPassport(options: { targetType: SocialTargetType; targetId: string }): Promise<ProductPassportDto | null> {
  const target = await resolveTarget(options.targetType, options.targetId)
  if (!target) return null

  const [passport, comparison] = await Promise.all([
    target.vendorId ? getSellerPassport(target.vendorId) : Promise.resolve(null),
    compareSellers({ targetType: options.targetType, targetId: target.id }),
  ])

  // Price history: real PriceHistory rows for relational products. Books keep
  // their current/list price context; without tracked points we say so.
  let priceHistory: ProductPassportDto['priceHistory'] = {
    tracked: false, label: 'Price history is not tracked for this item yet.', points: [],
    currentPrice: target.price, listPrice: null,
  }
  if (options.targetType === 'PRODUCT' && isDatabaseConfigured) {
    const points = await prisma.priceHistory.findMany({
      where: { productId: target.id },
      orderBy: { recordedAt: 'asc' },
      select: { price: true, recordedAt: true },
    })
    priceHistory = {
      tracked: points.length >= 2,
      label: points.length >= 2
        ? `${points.length} recorded price points`
        : 'Not enough data — fewer than two recorded price points.',
      points: points.map((point) => ({ price: Number(point.price), recordedAt: point.recordedAt.toISOString() })),
      currentPrice: target.price,
      listPrice: null,
    }
  } else if (options.targetType === 'BOOK' && !isDatabaseConfigured) {
    const book = mockStore.books.get(target.id)
    priceHistory = {
      tracked: false,
      label: book?.originalPrice
        ? 'Price history is not tracked for this title yet — showing the current sale price and original list price.'
        : 'Price history is not tracked for this item yet.',
      points: [],
      currentPrice: target.price,
      listPrice: book?.originalPrice ?? null,
    }
  }

  const verified = passport?.vendor.verified ?? false
  const scoreAvailable = passport?.score !== null && passport?.score !== undefined
  const deliveryFactor = passport?.factors.find((factor) => factor.key === 'delivery')

  return {
    target: {
      type: target.type, id: target.id, title: target.title, author: target.author,
      category: null, isbn: target.isbn, format: target.format, price: target.price,
    },
    sellerVerification: passport
      ? { verified, label: verified ? 'Identity-verified seller' : 'Seller not identity-verified' }
      : { verified: false, label: 'Fulfilled by MarketHub' },
    authenticity: passport
      ? {
          label: passport.factors.find((factor) => factor.key === 'authenticity')?.display ?? 'Not enough data',
          detail: 'Share of active listings with a checksum-valid ISBN-10 or ISBN-13. This identifier check does not prove a physical item is authentic.',
        }
      : { label: 'Not enough data', detail: 'This item is sold directly by MarketHub; seller authenticity metrics do not apply.' },
    warranty: {
      label: 'Not specified',
      detail: 'The seller has not published a warranty for this item.',
    },
    returns: {
      label: passport ? (passport.factors.find((factor) => factor.key === 'returns')?.display ?? 'Not specified') : 'Not specified',
      detail: 'Return tracking is not available on this platform yet.',
    },
    delivery: deliveryFactor
      ? { label: deliveryFactor.display, detail: deliveryFactor.reason }
      : { label: 'Not enough data', detail: 'Delivery outcomes for this seller have not accumulated yet.' },
    priceHistory,
    sellerPassport: passport && scoreAvailable ? passport : passport ? { ...passport } : null,
    sellerComparison: comparison,
  }
}
