import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'
import { compareSellers } from '@/services/sellerComparison.service'
import { getSellerPassport } from '@/services/sellerPassport.service'
import { getTrustedSummary } from '@/services/trusted-rating.service'
import { resolveTarget, type SocialTargetType } from '@/services/social-targets'

/**
 * AI Shopping Advisor (spec §27–§29).
 *
 * Architecture:
 *   Browser → /api/ai/chat → allowlisted tools → marketplace services → data
 *
 * Security properties:
 * - STRICT TOOL ALLOWLIST: only the five read-only tools below can run. Any
 *   other tool name is rejected; there is no direct database access, no write
 *   capability, no price/order/checkout mutation and no RBAC bypass (§29).
 * - The user message is parsed into typed parameters (budget, keywords,
 *   intent). Free text is never executed or interpolated into commands —
 *   retrieved content is treated as data, which is the prompt-injection
 *   defence (§29).
 * - Social tools run with the authenticated viewer's identity and reuse the
 *   privacy-scoped services, so the advisor can never see private friend
 *   activity or private purchase history (§29).
 * - No API keys are used: recommendations are a documented deterministic
 *   calculation over real marketplace data (§52), not a black box.
 */

export const AI_TOOLS = [
  'searchProducts',
  'getProductDetails',
  'compareProducts',
  'getSellerPassport',
  'getTrustedRecommendations',
] as const

export type AiToolName = (typeof AI_TOOLS)[number]

export type ToolContext = { viewerId: string | null }

const ALLOWLIST: ReadonlySet<string> = new Set(AI_TOOLS)

export function assertToolAllowed(name: string): asserts name is AiToolName {
  if (!ALLOWLIST.has(name)) {
    throw new DomainError(`Tool "${name}" is not allowed.`, 403)
  }
}

type Candidate = {
  type: SocialTargetType
  id: string
  title: string
  author: string
  cover: string | null
  price: number | null
  rating: number | null
  category: string | null
  vendorId: string | null
  isbn: string | null
}

async function loadCatalogue(): Promise<Candidate[]> {
  if (!isDatabaseConfigured) {
    return [...mockStore.books.values()].map((book) => ({
      type: 'BOOK' as const, id: book.id, title: book.title, author: book.author, cover: book.cover ?? null,
      price: book.price, rating: book.rating ?? null, category: book.category ?? null,
      vendorId: book.vendorId ?? null, isbn: book.isbn ?? null,
    }))
  }
  const [books, products] = await Promise.all([
    prisma.book.findMany({
      where: { active: true, OR: [{ vendorId: null }, { vendor: { status: 'APPROVED' } }] },
      select: { id: true, title: true, author: true, coverUrl: true, price: true, rating: true, category: true, vendorId: true, isbn: true },
    }),
    prisma.product.findMany({
      where: { status: 'ACTIVE', vendor: { status: 'APPROVED' } },
      select: {
        id: true, title: true, author: true, price: true, rating: true, vendorId: true, isbn: true,
        images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
      },
      take: 200,
    }),
  ])
  return [
    ...books.map((book) => ({
      type: 'BOOK' as const, id: book.id, title: book.title, author: book.author, cover: book.coverUrl,
      price: book.price, rating: book.rating, category: book.category, vendorId: book.vendorId, isbn: book.isbn,
    })),
    ...products.map((product) => ({
      type: 'PRODUCT' as const, id: product.id, title: product.title, author: product.author,
      cover: product.images[0]?.url ?? null, price: Number(product.price), rating: product.rating,
      category: null, vendorId: product.vendorId, isbn: product.isbn,
    })),
  ]
}

// ---------------------------------------------------------------------------
// Allowlisted tools (all read-only)
// ---------------------------------------------------------------------------

export async function searchProducts(args: { query?: string; budget?: number; limit?: number }, _ctx: ToolContext) {
  assertToolAllowed('searchProducts')
  const needle = (args.query ?? '').toLowerCase().trim()
  const limit = Math.min(Math.max(args.limit ?? 12, 1), 25)
  const catalogue = await loadCatalogue()
  const matches = catalogue.filter((item) => {
    if (args.budget !== undefined && item.price !== null && item.price > args.budget) return false
    if (item.price === null) return false
    if (!needle) return true
    return `${item.title} ${item.author} ${item.category ?? ''} ${item.isbn ?? ''}`.toLowerCase().includes(needle)
  })
  return matches.slice(0, limit)
}

export async function getProductDetails(args: { targetType: SocialTargetType; targetId: string }, ctx: ToolContext) {
  assertToolAllowed('getProductDetails')
  const target = await resolveTarget(args.targetType, args.targetId)
  if (!target) return null
  const trusted = ctx.viewerId
    ? await getTrustedSummary({ targetType: args.targetType, targetId: args.targetId, viewerId: ctx.viewerId })
    : null
  return { target, trusted }
}

export async function compareProducts(args: { targetType: SocialTargetType; targetId: string }) {
  assertToolAllowed('compareProducts')
  return compareSellers({ targetType: args.targetType, targetId: args.targetId })
}

export async function getSellerPassportTool(args: { vendorId: string }) {
  assertToolAllowed('getSellerPassport')
  return getSellerPassport(args.vendorId)
}

export async function getTrustedRecommendations(args: { targetType: SocialTargetType; targetId: string }, ctx: ToolContext) {
  assertToolAllowed('getTrustedRecommendations')
  if (!ctx.viewerId) return { authenticated: false, friendRecommended: { count: 0 }, network: null, friendReviews: [] }
  return getTrustedSummary({ targetType: args.targetType, targetId: args.targetId, viewerId: ctx.viewerId })
}

/** Single entry point used by the route — enforces the allowlist. */
export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  assertToolAllowed(name)
  switch (name) {
    case 'searchProducts':
      return searchProducts(args as { query?: string; budget?: number }, ctx)
    case 'getProductDetails':
      return getProductDetails(args as { targetType: SocialTargetType; targetId: string }, ctx)
    case 'compareProducts':
      return compareProducts(args as { targetType: SocialTargetType; targetId: string })
    case 'getSellerPassport':
      return getSellerPassportTool(args as { vendorId: string })
    case 'getTrustedRecommendations':
      return getTrustedRecommendations(args as { targetType: SocialTargetType; targetId: string }, ctx)
    default:
      throw new DomainError('Tool not allowed.', 403)
  }
}

// ---------------------------------------------------------------------------
// Deterministic decision assistant
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'a', 'an', 'the', 'for', 'of', 'and', 'or', 'to', 'in', 'on', 'with', 'under', 'below', 'within',
  'book', 'books', 'please', 'i', 'need', 'want', 'buy', 'get', 'me', 'my', 'show', 'find', 'rs', 'rupees', '₹',
])

export function parseAdvisorRequest(message: string) {
  const budgetMatch = message.match(/(?:under|below|less than|within|max(?:imum)?|upto|up to)?\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(?:rupees|rs)?/i)
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : undefined
  const intent = /gift/i.test(message) ? 'GIFT' as const
    : /\b(compare|versus|vs\.?|difference)\b/i.test(message) ? 'COMPARE' as const
      : /\b(recommend|suggest|best)\b/i.test(message) ? 'RECOMMEND' as const
        : 'FIND' as const
  const keywords = message
    .replace(/(?:₹|rs\.?|inr)?\s*\d{1,3}(?:,\d{3})+|\d{3,6}/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  return { budget, intent, keywords: [...new Set(keywords)] }
}

type Pick = {
  label: string
  target: { type: SocialTargetType; id: string; title: string; author: string; cover: string | null; price: number | null }
  why: string[]
}

async function trustFor(candidate: Candidate) {
  if (!candidate.vendorId) return null
  const passport = await getSellerPassport(candidate.vendorId)
  return passport ? { score: passport.score, reasons: passport.reasons, verified: passport.vendor.verified } : null
}

export async function advise(message: string, ctx: ToolContext) {
  const parsed = parseAdvisorRequest(message)
  const search = await searchProducts({ query: parsed.keywords.join(' '), budget: parsed.budget, limit: 25 }, ctx)
  const pool = search.length ? search : await searchProducts({ budget: parsed.budget, limit: 25 }, ctx)
  if (!pool.length) {
    return {
      reply: 'I could not find anything in the catalogue matching that request. Try a broader keyword or a higher budget.',
      picks: [] as Pick[],
      toolsUsed: ['searchProducts'] as string[],
      intent: parsed.intent,
      budget: parsed.budget ?? null,
    }
  }

  const withTrust = await Promise.all(pool.map(async (candidate) => ({
    candidate,
    trust: await trustFor(candidate),
    trusted: ctx.viewerId && candidate.type
      ? await getTrustedSummary({ targetType: candidate.type, targetId: candidate.id, viewerId: ctx.viewerId }).catch(() => null)
      : null,
  })))

  const trustValue = (entry: (typeof withTrust)[number]) => entry.trust?.score ?? null
  const ratingValue = (candidate: Candidate) => candidate.rating ?? 0
  const priceValue = (candidate: Candidate) => candidate.price ?? Number.MAX_SAFE_INTEGER

  const picks: Pick[] = []
  const toPick = (label: string, entry: (typeof withTrust)[number], why: string[]): Pick => ({
    label,
    target: {
      type: entry.candidate.type, id: entry.candidate.id, title: entry.candidate.title,
      author: entry.candidate.author, cover: entry.candidate.cover, price: entry.candidate.price,
    },
    why,
  })

  // Best Overall: rating + seller trust, budget respected.
  const overall = [...withTrust].sort((a, b) => {
    const scoreA = ratingValue(a.candidate) * 10 + (trustValue(a) ?? 55) * 0.5
    const scoreB = ratingValue(b.candidate) * 10 + (trustValue(b) ?? 55) * 0.5
    return scoreB - scoreA
  })[0]
  picks.push(toPick('Best Overall', overall, [
    ...(ratingValue(overall.candidate) ? [`Marketplace rating ${ratingValue(overall.candidate)}/5`] : []),
    ...(trustValue(overall) !== null ? [`Seller trust ${trustValue(overall)}/100`] : ['Seller trust: not enough data']),
    ...(parsed.budget && overall.candidate.price !== null ? [`Within your budget (₹${overall.candidate.price} ≤ ₹${parsed.budget})`] : []),
    ...(overall.trusted?.friendRecommended.count ? [`${overall.trusted.friendRecommended.count} people in your network recommended this`] : []),
  ]))

  // Best Value: lowest price among well-rated options.
  const valuePool = withTrust.filter((entry) => ratingValue(entry.candidate) >= 4.3)
  const value = (valuePool.length ? valuePool : withTrust).sort((a, b) => priceValue(a.candidate) - priceValue(b.candidate))[0]
  picks.push(toPick('Best Value', value, [
    ...(value.candidate.price !== null ? [`Lowest effective price at ₹${value.candidate.price}`] : []),
    ...(ratingValue(value.candidate) ? [`Still well rated at ${ratingValue(value.candidate)}/5`] : []),
    ...(parsed.budget && value.candidate.price !== null && value.candidate.price <= parsed.budget ? ['Fits your stated budget'] : []),
  ]))

  // Best for Beginners: strongest rating in the matched set.
  const beginner = [...withTrust].sort((a, b) => ratingValue(b.candidate) - ratingValue(a.candidate))[0]
  picks.push(toPick('Best for Beginners', beginner, [
    ...(ratingValue(beginner.candidate) ? [`Highest rated match at ${ratingValue(beginner.candidate)}/5`] : []),
    ...(parsed.keywords.length ? [`Matches your keywords: ${parsed.keywords.slice(0, 3).join(', ')}`] : []),
    ...(beginner.candidate.category ? [`Category: ${beginner.candidate.category}`] : []),
  ]))

  // Best Trusted Seller: requires real trust data — never fabricated.
  const trustedPool = withTrust.filter((entry) => trustValue(entry) !== null)
  if (trustedPool.length) {
    const trusted = [...trustedPool].sort((a, b) => trustValue(b)! - trustValue(a)!)[0]
    picks.push(toPick('Best Trusted Seller', trusted, [
      `Seller trust ${trustValue(trusted)}/100`,
      ...(trusted.trust?.reasons.slice(0, 2) ?? []),
      ...(trusted.trust?.verified ? ['Identity-verified seller'] : []),
    ]))
  }

  const replyParts = [
    parsed.intent === 'GIFT' ? 'Gift shortlist based on your interests and budget.' : 'Here is my decision summary:',
    ...picks.map((pick) => `${pick.label}: ${pick.target.title} — ${pick.why[0] ?? 'matches your request'}.`),
  ]
  if (!trustedPool.length) {
    replyParts.push('No seller in this set has enough marketplace history for a trusted-seller pick, so I am not inventing one.')
  }

  return {
    reply: replyParts.join(' '),
    picks,
    toolsUsed: ['searchProducts', 'getSellerPassport', 'getTrustedRecommendations'],
    intent: parsed.intent,
    budget: parsed.budget ?? null,
  }
}
