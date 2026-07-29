/**
 * components/ui/mini-chart.tsx — Mini gráficos en SVG + HTML.
 *
 * Vive en ui/ (no en lebaux/) porque no conoce nada del negocio: solo
 * recibe números y labels por props, así que sirve para cualquier gráfico
 * chico en cualquier pantalla.
 *
 * Sin dependencias externas para no engordar el bundle. Dos variantes:
 *   · BarsChart: barras en SVG + labels HTML para mejor responsive
 *   · DonutProgress: donut con % cobrado vs pendiente
 *
 * Usa var(--primary) y var(--destructive) para que se adapte al tema.
 */
import { cn } from '@/lib/utils'

/* ───────────────── Bars ───────────────── */

export interface BarDatum {
  label: string
  value: number
}

interface BarsChartProps {
  data: BarDatum[]
  /** Formateador opcional del valor sobre cada barra. */
  formatValue?: (v: number) => string
  className?: string
  /** Altura de las barras (sin contar labels). */
  barAreaHeight?: number
}

export function BarsChart({
  data,
  formatValue,
  className,
  barAreaHeight = 72,
}: BarsChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value))

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-xs text-muted-foreground/70',
          className,
        )}
        style={{ height: barAreaHeight + 24 }}
      >
        Sin datos para mostrar
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Área de barras (SVG) */}
      <svg
        viewBox={`0 0 100 ${barAreaHeight}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: barAreaHeight }}
        role="img"
        aria-label="Gráfico de barras de pagos por mes"
      >
        <defs>
          <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const slot = 100 / Math.max(data.length, 1)
          const gap = slot * 0.32
          const w = slot - gap
          const h = (d.value / max) * (barAreaHeight - 4)
          const x = i * slot + gap / 2
          const y = barAreaHeight - h
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={Math.max(h, 1)}
              rx={1.5}
              fill="url(#bar-grad)"
            />
          )
        })}
      </svg>

      {/* Labels en HTML para mejor responsive */}
      <div
        className="mt-1 grid gap-1 text-[10px] text-muted-foreground"
        style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}
      >
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center text-center min-w-0">
            <span className="money truncate w-full leading-tight">
              {d.value > 0 && formatValue ? formatValue(d.value) : ''}
            </span>
            <span className="truncate w-full leading-tight">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────────── Donut ───────────────── */

interface DonutProgressProps {
  /** Fracción entre 0 y 1 ya cobrada. */
  progress: number
  size?: number
  strokeWidth?: number
  /** Texto central opcional. */
  label?: string
  sublabel?: string
  className?: string
}

export function DonutProgress({
  progress,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  className,
}: DonutProgressProps) {
  const clamped = Math.max(0, Math.min(1, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={`Cobrado: ${Math.round(clamped * 100)}% del total`}
      >
        <defs>
          <linearGradient id="donut-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          opacity={0.6}
        />
        {/* Progreso */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#donut-grad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label && (
          <span className="font-display text-xl font-semibold leading-none money">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}
