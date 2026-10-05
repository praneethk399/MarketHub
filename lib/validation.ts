import { z } from 'zod'

const normalizedEmail = z.string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('Enter a valid email address.')

const password = z.string()
  .min(8, 'Password must contain between 8 and 128 characters.')
  .max(128, 'Password must contain between 8 and 128 characters.')

export const authRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('register'),
    name: z.string().trim().min(2, 'Name must be between 2 and 80 characters.').max(80, 'Name must be between 2 and 80 characters.'),
    email: normalizedEmail,
    password,
  }).strict(),
  z.object({
    action: z.literal('login'),
    email: normalizedEmail,
    password,
  }).strict(),
])

export const quantitySchema = z.number().int().min(0).max(100)
export const productCartAddSchema = z.object({
  productId: z.string().trim().min(1).max(128),
  quantity: z.number().int().min(1).max(100).default(1),
}).strict()
export const productCartUpdateSchema = z.object({
  quantity: quantitySchema,
}).strict()

export const vendorApplicationSchema = z.object({
  storeName: z.string().trim().min(2).max(100),
  description: z.string().trim().min(20).max(2000),
  businessEmail: normalizedEmail,
  phone: z.string().trim().max(32).optional(),
}).strict()

export const vendorApplicationDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  adminNotes: z.string().trim().max(1000).optional(),
}).strict()

const productFields = {
  title: z.string().trim().min(2).max(180),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().min(20).max(10_000),
  author: z.string().trim().min(2).max(160),
  isbn: z.string().trim().max(32).optional(),
  publisher: z.string().trim().max(160).optional(),
  publicationYear: z.number().int().min(1000).max(2200).nullable().optional(),
  language: z.string().trim().min(2).max(20).default('en'),
  format: z.string().trim().min(2).max(40),
  categoryId: z.string().uuid().nullable().optional(),
  price: z.number().finite().min(0).max(1_000_000),
  compareAtPrice: z.number().finite().min(0).max(1_000_000).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).optional(),
  quantity: z.number().int().min(0).max(1_000_000).default(0),
  lowStockThreshold: z.number().int().min(0).max(100_000).default(5),
  images: z.array(z.object({
    url: z.string().url().max(2048).refine((value) => value.startsWith('https://'), 'Images must use HTTPS.'),
    alt: z.string().trim().min(1).max(240),
  }).strict()).max(12).default([]),
}

const productObjectSchema = z.object(productFields).strict()

export const createProductSchema = productObjectSchema.refine(
  (product) => product.compareAtPrice === undefined || product.compareAtPrice === null || product.compareAtPrice >= product.price,
  { message: 'Compare-at price must be greater than or equal to price.', path: ['compareAtPrice'] },
)

export const updateProductSchema = productObjectSchema.partial().refine(
  (product) => Object.keys(product).length > 0,
  { message: 'At least one product field is required.' },
).refine(
  (product) => product.price === undefined || product.compareAtPrice === undefined || product.compareAtPrice === null || product.compareAtPrice >= product.price,
  { message: 'Compare-at price must be greater than or equal to price.', path: ['compareAtPrice'] },
)

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(120).optional(),
  content: z.string().trim().min(20).max(4000),
  visibility: z.enum(['PRIVATE', 'FRIENDS', 'PUBLIC']).default('PUBLIC'),
  containsSpoilers: z.boolean().default(false),
}).strict()

const socialEmail = z.string().trim().toLowerCase().max(254).email('Enter a valid email address.')
const socialTargetId = z.string().trim().min(1).max(128)

export const friendRequestSchema = z.object({ email: socialEmail }).strict()
export const friendActionSchema = z.object({ action: z.enum(['accept', 'decline', 'block']) }).strict()

export const recommendationSchema = z.object({
  recipientId: z.string().trim().max(64).optional(),
  recipientEmail: socialEmail.optional(),
  targetType: z.enum(['BOOK', 'PRODUCT']).default('BOOK'),
  targetId: socialTargetId,
  message: z.string().trim().max(500).optional(),
}).strict().refine((value) => Boolean(value.recipientId || value.recipientEmail), {
  message: 'Choose the friend you want to recommend this to.',
})

export const listCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional(),
}).strict()

export const listUpdateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'No list update was provided.' })

export const listItemSchema = z.object({
  targetType: z.enum(['BOOK', 'PRODUCT']).default('BOOK'),
  targetId: socialTargetId,
  note: z.string().trim().max(300).optional(),
}).strict()

export const listMemberSchema = z.object({
  email: socialEmail,
  role: z.enum(['EDITOR', 'VIEWER']).default('VIEWER'),
}).strict()

export const preferredItemSchema = z.object({ preferred: z.boolean() }).strict()

export const aiChatSchema = z.object({
  message: z.string().trim().min(2).max(1000),
}).strict()

const addressFields = {
  label: z.string().trim().max(50).optional(),
  recipient: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().length(2).default('IN'),
  phone: z.string().trim().max(32).optional(),
  isDefault: z.boolean().default(false),
}
const addressObjectSchema = z.object(addressFields).strict()
export const addressSchema = addressObjectSchema
export const addressUpdateSchema = addressObjectSchema.partial().refine(
  (address) => Object.keys(address).length > 0,
  { message: 'At least one address field is required.' },
)

export function firstValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'The request is invalid.'
}
