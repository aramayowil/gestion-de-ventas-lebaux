/**
 * components/shared/EstadoPresupuestoBadge.tsx — Pill para estado de presupuesto.
 *
 * Vive en shared/ (no en lebaux/<pagina>/) porque lo usan varias pantallas
 * distintas: ClienteDetalle, DashboardPage, PagosObraPage,
 * PresupuestoModal, RegistrosPage y el formulario de obra.
 *
 * Variantes:
 *   · borrador  → gris
 *   · pendiente → dorado (con dot animado sutil)
 *   · aceptado  → verde (ya es una venta)
 *   · rechazado → rojo
 */
import { FileText, Clock, CheckCircle2, XCircle, Edit3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { EstadoPresupuesto } from '@/lib/types'

interface Props {
  estado: EstadoPresupuesto
  size?: 'sm' | 'md'
}

const CONFIG: Record<
  EstadoPresupuesto,
  { icon: typeof FileText; label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'outline'; className?: string }
> = {
  borrador: {
    icon: Edit3,
    label: 'Borrador',
    variant: 'outline',
    className: 'text-muted-foreground',
  },
  pendiente: {
    icon: Clock,
    label: 'Pendiente',
    variant: 'default',
  },
  aceptado: {
    icon: CheckCircle2,
    label: 'Aceptado',
    variant: 'success',
  },
  rechazado: {
    icon: XCircle,
    label: 'Rechazado',
    variant: 'destructive',
  },
}

export function EstadoPresupuestoBadge({ estado, size = 'md' }: Props) {
  const cfg = CONFIG[estado]
  const Icon = cfg.icon
  const iconSize = size === 'sm' ? 'size-3' : 'size-3.5'
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      <Icon className={iconSize} aria-hidden="true" />
      {cfg.label}
    </Badge>
  )
}
