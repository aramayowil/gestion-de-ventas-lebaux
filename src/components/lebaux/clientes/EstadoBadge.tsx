/**
 * components/lebaux/clientes/EstadoBadge.tsx — Pill coloreada para el estado del saldo.
 *
 * Rediseñada: pills translúcidas con ring sutil, manteniendo
 * la semántica (verde=pagado, rojo=debe, gris=sin datos).
 */
import { CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { EstadoPago } from '@/lib/types'
import { formatMoney } from '@/lib/obra-totales'

interface Props {
  estado: EstadoPago
  saldoPendiente?: number
  size?: 'sm' | 'md'
}

export function EstadoBadge({ estado, saldoPendiente, size = 'md' }: Props) {
  if (estado === 'pagado') {
    return (
      <Badge variant="success">
        <CheckCircle2
          className={size === 'sm' ? 'size-3' : 'size-3.5'}
          aria-hidden="true"
        />
        Pagado
      </Badge>
    )
  }
  if (estado === 'debe') {
    return (
      <Badge variant="destructive">
        <AlertCircle
          className={size === 'sm' ? 'size-3' : 'size-3.5'}
          aria-hidden="true"
        />
        {saldoPendiente !== undefined
          ? `Debe $${formatMoney(saldoPendiente)}`
          : 'Debe'}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <MinusCircle
        className={size === 'sm' ? 'size-3' : 'size-3.5'}
        aria-hidden="true"
      />
      Sin datos
    </Badge>
  )
}
