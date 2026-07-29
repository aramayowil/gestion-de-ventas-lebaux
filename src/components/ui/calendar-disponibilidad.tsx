/**
 * components/ui/calendar-disponibilidad.tsx
 *
 * Calendario mensual que muestra la disponibilidad de turnos por día
 * con código de colores:
 *   · Verde: día disponible (≤ 50% de turnos ocupados)
 *   · Amarillo: disponible pero con mucha demanda (> 50% ocupados)
 *   · Rojo / deshabilitado: día sin turnos disponibles (100% ocupados)
 *
 * Solo muestra días laborables (Lun-Sáb). Los domingos se ocultan
 * visualmente como deshabilitados para mantener la grilla de 7 columnas.
 *
 * Diseño mobile-first: cada celda es toqueable (mínimo 36×36px).
 */
import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HORAS_TURNO } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props {
  /** Fecha seleccionada actualmente (YYYY-MM-DD). */
  value: string
  /** Callback cuando el usuario selecciona una fecha. */
  onChange: (fecha: string) => void
  /** Función que devuelve true si el turno (fecha+hora) está ocupado. */
  turnoOcupado: (fecha: string, hora: number) => boolean
  /** Fecha mínima seleccionable (YYYY-MM-DD). Default: hoy. */
  min?: string
}

type Disponibilidad = 'no-laborable' | 'pasado' | 'lleno' | 'alta-demanda' | 'disponible'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DIAS_HEADER = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Convierte un Date a string YYYY-MM-DD (sin zona horaria). */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parsea YYYY-MM-DD a Date a medianoche (sin offset de TZ). */
function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function CalendarDisponibilidad({
  value,
  onChange,
  turnoOcupado,
  min,
}: Props) {
  // Mes visible: arranca en el mes de `value` o hoy
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaMinima = min ? parseISODate(min) : hoy

  const [mesVisible, setMesVisible] = React.useState<Date>(() => {
    if (value) return parseISODate(value)
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  })

  // Generar grilla del mes (6 semanas × 7 días, empezando en domingo)
  const grilla = React.useMemo(() => {
    const primerDelMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1)
    const diaInicio = primerDelMes.getDay() // 0=Dom, 1=Lun, ...
    const inicio = new Date(primerDelMes)
    inicio.setDate(inicio.getDate() - diaInicio)

    const dias: { fecha: Date; iso: string }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio)
      d.setDate(d.getDate() + i)
      dias.push({ fecha: d, iso: toISODate(d) })
    }
    return dias
  }, [mesVisible])

  function getDisponibilidad(d: Date, iso: string): Disponibilidad {
    const diaSemana = d.getDay()
    // Domingo (0) → no laborable
    if (diaSemana === 0) return 'no-laborable'

    // Día pasado → no seleccionable
    if (d < fechaMinima) return 'pasado'

    // Contar turnos ocupados
    const totalTurnos = HORAS_TURNO.length
    let ocupados = 0
    for (const h of HORAS_TURNO) {
      if (turnoOcupado(iso, h)) ocupados++
    }

    if (ocupados >= totalTurnos) return 'lleno'
    if (ocupados / totalTurnos > 0.5) return 'alta-demanda'
    return 'disponible'
  }

  function puedeNavegarAtras(): boolean {
    const primerDelMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1)
    return primerDelMes > fechaMinima
  }

  function puedeNavegarAdelante(): boolean {
    // Permitir navegar hasta 6 meses adelante
    const limite = new Date(hoy)
    limite.setMonth(limite.getMonth() + 6)
    return mesVisible < limite
  }

  function mesAnterior() {
    setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }
  function mesSiguiente() {
    setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-3">
      {/* Header con navegación de mes */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={mesAnterior}
          disabled={!puedeNavegarAtras()}
          aria-label="Mes anterior"
          className="size-8"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-semibold font-display">
          {MESES[mesVisible.getMonth()]} {mesVisible.getFullYear()}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={mesSiguiente}
          disabled={!puedeNavegarAdelante()}
          aria-label="Mes siguiente"
          className="size-8"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Encabezado de días de la semana */}
      <div className="grid grid-cols-7 gap-1">
        {DIAS_HEADER.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7 gap-1">
        {grilla.map(({ fecha, iso }) => {
          const disp = getDisponibilidad(fecha, iso)
          const esDeOtroMes = fecha.getMonth() !== mesVisible.getMonth()
          const esSeleccionado = iso === value
          const esHoy = iso === toISODate(hoy)
          const deshabilitado = disp === 'no-laborable' || disp === 'pasado' || disp === 'lleno'

          return (
            <button
              key={iso}
              type="button"
              disabled={deshabilitado}
              onClick={() => !deshabilitado && onChange(iso)}
              aria-label={`${fecha.getDate()} de ${MESES[fecha.getMonth()]}${
                disp === 'disponible' ? ' — disponible'
                : disp === 'alta-demanda' ? ' — alta demanda'
                : disp === 'lleno' ? ' — sin turnos'
                : disp === 'pasado' ? ' — día pasado'
                : ''
              }`}
              className={cn(
                'relative aspect-square min-h-9 flex items-center justify-center rounded-md text-xs font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                // Día de otro mes: muy tenue
                esDeOtroMes && 'opacity-30',
                // Estado deshabilitado
                deshabilitado && 'cursor-not-allowed',
                // Día seleccionado: anillo dorado
                esSeleccionado && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                // Estilos por disponibilidad
                disp === 'disponible' && !esSeleccionado && 'bg-success/15 text-success hover:bg-success/25',
                disp === 'alta-demanda' && !esSeleccionado && 'bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25',
                disp === 'lleno' && 'bg-destructive/10 text-destructive/50 line-through',
                disp === 'pasado' && 'text-muted-foreground/40',
                disp === 'no-laborable' && 'text-muted-foreground/20',
                // Hoy: borde sutil
                esHoy && !esSeleccionado && 'ring-1 ring-primary/40',
              )}
            >
              {fecha.getDate()}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center justify-center gap-3 pt-1 flex-wrap text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-success/40" />
          Disponible
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-amber-500/40" />
          Alta demanda
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-destructive/30" />
          Sin turnos
        </span>
      </div>
    </div>
  )
}

export default CalendarDisponibilidad
