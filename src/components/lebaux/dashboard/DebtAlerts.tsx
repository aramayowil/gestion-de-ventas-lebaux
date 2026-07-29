/**
 * components/lebaux/dashboard/DebtAlerts.tsx — Sección de alertas de deuda en Home.
 *
 * Lista compacta y accionable de clientes con saldo pendiente,
 * ordenados por monto descendente. Solo se muestra si hay deudores.
 *
 * Accesibilidad: el icono AlertTriangle + color rojo son refuerzo
 * visual, pero la información está en el texto (deuda en $).
 */
import * as React from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { Cliente } from '@/lib/types'
import { formatMoney } from '@/lib/obra-totales'
import { ClientAvatar } from '@/components/shared/ClientAvatar'
import { cn } from '@/lib/utils'

export interface Deudor {
  cliente: Cliente
  saldo: number
}

interface Props {
  deudores: Deudor[]
  onVerCliente: (id: string) => void
  className?: string
  /** Máximo de deudores a mostrar. */
  max?: number
}

export function DebtAlerts({ deudores, onVerCliente, className, max = 4 }: Props) {
  const visibles = React.useMemo(
    () => [...deudores].sort((a, b) => b.saldo - a.saldo).slice(0, max),
    [deudores, max],
  )

  if (visibles.length === 0) return null

  const total = deudores.reduce((acc, d) => acc + d.saldo, 0)

  return (
    <section
      className={cn(
        'rounded-2xl border border-destructive/25 bg-destructive/[0.04] backdrop-blur-sm overflow-hidden',
        'dark:bg-destructive/[0.07] dark:border-destructive/30',
        className,
      )}
      aria-label="Clientes con saldo pendiente"
    >
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-destructive/15">
        <span className="flex size-7 items-center justify-center rounded-full bg-destructive/15 text-destructive ring-1 ring-destructive/25">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight">
            Saldo pendiente
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {deudores.length} {deudores.length === 1 ? 'cliente' : 'clientes'} ·{' '}
            <span className="money text-destructive font-medium">
              ${formatMoney(total)}
            </span>
          </p>
        </div>
      </header>

      <ul className="divide-y divide-border/40">
        {visibles.map(({ cliente, saldo }) => (
          <li key={cliente.id}>
            <button
              onClick={() => onVerCliente(cliente.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-elevated/60 transition-colors active:scale-[0.99]"
            >
              <ClientAvatar nombre={cliente.nombre} size="sm" alert />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{cliente.nombre}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {cliente.telefonoWhatsApp || 'Sin WhatsApp'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="money text-sm font-semibold text-destructive">
                  ${formatMoney(saldo)}
                </p>
                <ChevronRight
                  className="ml-auto size-3.5 text-muted-foreground/70"
                  aria-hidden="true"
                />
              </div>
            </button>
          </li>
        ))}
      </ul>

      {deudores.length > max && (
        <div className="px-4 py-2 text-center text-[11px] text-muted-foreground border-t border-border/40">
          +{deudores.length - max} cliente(s) más con saldo
        </div>
      )}
    </section>
  )
}
