import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'
import { listProducts } from '@/services/products'
import { listReadingProgress } from '@/services/social.service'

/**
 * "My library" shelves (reading progress, spec §24) — the viewer's own shelf.
 *
 * Only the signed-in viewer's progress is read here, so private notes and
 * private reading activity can never leak: the service is always called with
 * the session user id, never with a client-supplied one.
 *
 * Shelves:
 * - Currently reading: tracked entries with status CURRENTLY_READING
 * - Next up:           tracked NOT_STARTED entries plus purchased books that
 *                      have no reading record yet
 * - Finished:          tracked entries with status FINISHED
 */

export type ShelfStatus = 'NOT_STARTED' | 'CURRENTLY_READING' | 'FINISHED'

export type ShelfBook = {
  bookId: string
  title: string
  author: string
  cover: string
  price: number | null
  status: ShelfStatus
  progressPercentage: number
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC'
  updatedAt: string | null
  tracked: boolean
}

export type LibraryShelf = { key: 'currently-reading' | 'next-up' | 'finished'; title: string; books: ShelfBook[] }

export type LibraryShelves = {
  shelves: LibraryShelf[]
  continueReading: ShelfBook | null
  totals: { tracked: number; owned: number; finished: number }
}

async function ownedBookIds(userId: string): Promise<string[]> {
  if (!isDatabaseConfigured) {
    const ids = new Set<string>()
    for (const order of mockStore.orders) {
      if (order.userId !== userId || order.status === 'CANCELLED') continue
      for (const item of order.items) ids.add(item.bookId)
    }
    return [...ids]
  }
  const rows = await prisma.orderItem.findMany({
    where: { bookId: { not: null }, order: { userId, status: { not: 'CANCELLED' } } },
    select: { bookId: true },
  })
  return [...new Set(rows.map((row) => row.bookId).filter((id): id is string => Boolean(id)))]
}

export async function getLibraryShelves(userId: string): Promise<LibraryShelves> {
  const [progress, catalogue, owned] = await Promise.all([
    listReadingProgress(userId),
    listProducts(),
    ownedBookIds(userId),
  ])

  const byId = new Map(catalogue.map((book) => [book.id, book]))
  const tracked = progress
    .map((entry): ShelfBook | null => {
      const book = byId.get(entry.targetId)
      if (!book) return null
      return {
        bookId: book.id,
        title: book.title,
        author: book.author,
        cover: book.cover,
        price: book.price,
        status: entry.status as ShelfStatus,
        progressPercentage: entry.progressPercentage,
        visibility: entry.visibility as ShelfBook['visibility'],
        updatedAt: entry.updatedAt,
        tracked: true,
      }
    })
    .filter((entry): entry is ShelfBook => entry !== null)

  const trackedIds = new Set(tracked.map((book) => book.bookId))
  const untrackedOwned = owned
    .filter((bookId) => !trackedIds.has(bookId))
    .map((bookId): ShelfBook | null => {
      const book = byId.get(bookId)
      if (!book) return null
      return {
        bookId: book.id, title: book.title, author: book.author, cover: book.cover, price: book.price,
        status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE',
        updatedAt: null, tracked: false,
      }
    })
    .filter((entry): entry is ShelfBook => entry !== null)

  const byRecent = (a: ShelfBook, b: ShelfBook) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
  const currentlyReading = tracked.filter((book) => book.status === 'CURRENTLY_READING').sort(byRecent)
  const finished = tracked.filter((book) => book.status === 'FINISHED').sort(byRecent)
  const nextUp = [...tracked.filter((book) => book.status === 'NOT_STARTED'), ...untrackedOwned]
    .sort((a, b) => a.title.localeCompare(b.title))

  return {
    shelves: [
      { key: 'currently-reading', title: 'Currently reading', books: currentlyReading },
      { key: 'next-up', title: 'Next up', books: nextUp },
      { key: 'finished', title: 'Finished', books: finished },
    ],
    continueReading: currentlyReading[0] ?? nextUp[0] ?? null,
    totals: { tracked: tracked.length, owned: owned.length, finished: finished.length },
  }
}
