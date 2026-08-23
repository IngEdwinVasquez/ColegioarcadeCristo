import { useCallback, useEffect, useState } from 'react'

/** Evento global emitido tras guardar/eliminar; el contexto refresca los catálogos al recibirlo. */
export const DATA_CHANGED_EVENT = 'arca:data-changed'
const emitDataChanged = () => window.dispatchEvent(new Event(DATA_CHANGED_EVENT))

export interface UseCollectionResult<T> {
  items: T[]
  loading: boolean
  saving: boolean
  error: string | null
  refresh: () => Promise<void>
  save: (item: T) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useCollection<T>(
  fetcher: () => Promise<T[]>,
  saver?: (item: T) => Promise<void>,
  remover?: (id: string) => Promise<void>,
): UseCollectionResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetcher()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (item: T) => {
      if (!saver) return
      setSaving(true)
      setError(null)
      try {
        await saver(item)
        await refresh()
        emitDataChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [saver, refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!remover) return
      setSaving(true)
      setError(null)
      try {
        await remover(id)
        await refresh()
        emitDataChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [remover, refresh],
  )

  return { items, loading, saving, error, refresh, save, remove }
}
