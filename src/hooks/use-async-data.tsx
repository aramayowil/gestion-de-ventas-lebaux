/**
 * hooks/use-async-data.ts — Hook para manejar datos asíncronos.
 *
 * Maneja los 3 estados: loading, error, data. Pensado para usarse
 * cuando migremos de localStorage a Supabase.
 *
 * Uso:
 *   const { data, loading, error, refetch } = useAsyncData(
 *     () => supabase.from('clientes').select('*'),
 *     []
 *   )
 */
import { useState, useEffect, useCallback, type ReactNode } from 'react'

interface AsyncDataState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

/**
 * Componente condicional: muestra un spinner mientras carga,
 * un mensaje de error si falla, o los children si hay data.
 */
export function AsyncBoundary({
  loading,
  error,
  children,
}: {
  loading: boolean
  error: string | null
  children: ReactNode
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }
  return <>{children}</>
}

/**
 * Spinner simple (loading indicator).
 */
export function Spinner({ className = 'size-6' }: { className?: string }) {
  return (
    <div
      className={`
        ${className}
        animate-spin rounded-full
        border-2 border-muted border-t-primary
      `}
      role="status"
      aria-label="Cargando"
    />
  )
}
