/**
 * components/ui/kpi-card.tsx — Tarjeta KPI premium para el dashboard.
 *
 * Vive en ui/ (no en lebaux/) porque no conoce nada del negocio (Cliente,
 * Obra, Pago): recibe todo por props, así que sirve para cualquier tablero.
 *
 * Estructura:
 *   [ícono en chip dorado]   [label chiquito arriba]
 *                            [valor display (Space Grotesk) grande]
 *                            [subtexto opcional con trend]
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string
  subtexto?: string
  icon: React.ComponentType<{ className?: string }>
  /** Variante de color del icon chip. */
  tone?: 'gold' | 'success' | 'danger' | 'muted'
  className?: string
  /** Si se provee, la tarjeta se vuelve clickeable y navega a la data que resume
   * (ej: "Saldo" → lista de deudores). Si no, la tarjeta es solo informativa. */
  onClick?: () => void
}

const TONE_CLASS: Record<NonNullable<Props['tone']>, string> = {
  gold: 'bg-primary/15 text-primary ring-primary/25',
  success: 'bg-success/15 text-success ring-success/25',
  danger: 'bg-destructive/15 text-destructive ring-destructive/25',
  muted: 'bg-muted/60 text-muted-foreground ring-border/60',
}

export function KpiCard({
  label,
  value,
  subtexto,
  icon: Icon,
  tone = 'gold',
  className,
  onClick,
}: Props) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 text-left w-full',
        'dark:bg-gradient-to-b dark:from-card/90 dark:to-card/60',
        'transition-all hover:border-primary/30 hover:shadow-md',
        onClick && 'cursor-pointer active:scale-[0.98]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-display text-xl sm:text-2xl font-semibold tracking-tight money leading-none">
            {value}
          </p>
          {subtexto && (
            <p className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
              {subtexto}
            </p>
          )}
        </div>
        <span
          className={cn(
            'flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
            TONE_CLASS[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
    </Comp>
  )
}
