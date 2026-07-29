import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Skeleton — placeholder animado para contenido que todavía está cargando.
 *
 * Uso: <Skeleton className="h-4 w-32" /> — el tamaño lo define quien lo usa.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-muted/60', className)}
      {...props}
    />
  )
}

export { Skeleton }
