/**
 * components/shared/ClientAvatar.tsx — Avatar circular con iniciales
 * del cliente y color determinístico basado en su nombre.
 *
 * Vive en shared/ (no en lebaux/<pagina>/) porque lo usan 4 pantallas
 * distintas: ClientesHome, ClienteDetalle, RegistrosPage y DebtAlerts.
 *
 * - Sin imágenes externas: pura tipografía + tailwind.
 * - Color: hash simple del nombre → hue del anillo de marca dorado/bronze.
 * - Tamaños: sm (lista), md (detalle), lg (hero vacío).
 */
import { cn } from '@/lib/utils'

interface Props {
  nombre: string
  size?: 'sm' | 'md' | 'lg'
  /** Cuando el cliente debe, se le agrega un anillo rojo sutil. */
  alert?: boolean
  className?: string
}

function obtenerIniciales(nombre: string): string {
  const limpio = nombre.trim()
  if (!limpio) return '?'
  const partes = limpio.split(/\s+/).filter(Boolean)
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase()
  }
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * Genera un hue dentro del rango cálido (40-90) para que combine
 * con la paleta dorada de Lebaux. Mismo nombre → mismo color.
 */
function hashHue(nombre: string): number {
  let h = 0
  for (let i = 0; i < nombre.length; i++) {
    h = (h * 31 + nombre.charCodeAt(i)) | 0
  }
  return 40 + Math.abs(h) % 50 // 40..90 (ámbar → dorado → bronce)
}

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'size-10 text-xs',
  md: 'size-12 text-sm',
  lg: 'size-16 text-lg',
}

export function ClientAvatar({ nombre, size = 'md', alert, className }: Props) {
  const iniciales = obtenerIniciales(nombre)
  const hue = hashHue(nombre)

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        'ring-1 ring-inset',
        SIZE_CLASSES[size],
        alert
          ? 'ring-destructive/40'
          : 'ring-border/60',
        className,
      )}
      style={{
        // Dorado/bronce determinístico, translúcido para no gritar.
        background: `linear-gradient(135deg, hsl(${hue} 45% 30% / 0.85), hsl(${hue} 40% 20% / 0.9))`,
        color: `hsl(${hue} 70% 80%)`,
      }}
      aria-hidden="true"
    >
      <span className="font-display tracking-tight">{iniciales}</span>
      {alert && (
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background" />
      )}
    </span>
  )
}
