'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  getCatalogueSnapshot,
  getServerCatalogueSnapshot,
  loadCatalogue,
  subscribeCatalogue,
} from './catalogue-store'

/**
 * Reads the shared live catalogue. Every component that calls this shares one
 * `/api/books` request and one array, so the featured showcase and the catalogue
 * can never disagree about what the collection contains.
 *
 * `useSyncExternalStore` is what keeps first paint honest: the server snapshot is
 * the seeded catalogue, and the client's first render reads the same thing, so
 * there is no hydration mismatch and no empty flash before the fetch lands.
 */
export function useLiveCatalogue() {
  const snapshot = useSyncExternalStore(
    subscribeCatalogue,
    getCatalogueSnapshot,
    getServerCatalogueSnapshot,
  )

  useEffect(() => {
    void loadCatalogue()
  }, [])

  const refresh = useCallback(() => {
    void loadCatalogue({ force: true })
  }, [])

  return { ...snapshot, refresh }
}
