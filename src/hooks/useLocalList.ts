import { useCallback, useEffect, useState } from 'react'

export interface LocalListItem {
  id: string
  [key: string]: unknown
}

/**
 * Persistencia local (localStorage) para registros administrativos sencillos.
 */
export function useLocalList<T extends { id: string }>(key: string) {
  const [items, setItems] = useState<T[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setItems(JSON.parse(raw) as T[])
    } catch {
      /* sin datos */
    }
  }, [key])

  const add = useCallback(
    (item: Omit<T, 'id'> & { id?: string }) => {
      const full = { ...item, id: item.id ?? `${Date.now()}` } as T
      setItems((prev) => {
        const next = [full, ...prev]
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* almacenamiento no disponible */
        }
        return next
      })
      return full
    },
    [key],
  )

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== id)
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* sin almacenamiento */
        }
        return next
      })
    },
    [key],
  )

  return { items, add, remove }
}
