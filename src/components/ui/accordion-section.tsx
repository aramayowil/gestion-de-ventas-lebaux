/**
 * components/ui/accordion-section.tsx
 *
 * Sección colapsable pensada para formularios largos en MÓVIL: agrupa el
 * formulario en pasos ("Cliente y obra" → "Aberturas" → "Pago y totales")
 * en vez de mostrar todo el contenido de una sola vez.
 *
 * Portado del patrón usado en el proyecto "Acta de Entrega" (mismo sistema
 * Lebaux), adaptado a Tailwind + tokens shadcn/ui en vez de variables CSS
 * custom, para no introducir un segundo sistema de estilos.
 *
 * ACCESIBILIDAD:
 *   · El trigger es un <button> real con aria-expanded, así que se anuncia
 *     correctamente el estado a lectores de pantalla (JAWS/NVDA/VoiceOver)
 *     sin necesitar aria-controls extra: el contenido sigue inmediatamente
 *     después en el DOM.
 *   · Altura mínima de 56px en el trigger y 44px en los controles internos
 *     — supera el mínimo de 44×44px recomendado por WCAG 2.5.5 (Target Size)
 *     para que sea cómodo de tocar con el dedo.
 *   · El estado "completo"/"pendiente" se comunica con texto (no solo con
 *     color), para que sea accesible a usuarios con daltonismo.
 *   · `forceOpen` permite reutilizar el mismo componente en desktop con
 *     el contenido siempre visible (deja de comportarse como botón).
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionSectionProps {
  /** Título corto de la sección */
  title: string
  /** Subtítulo opcional (ej: nombre del cliente cargado, cantidad de ítems) */
  subtitle?: string
  /** Icono a mostrar a la izquierda */
  icon?: ReactNode
  /** Estado controlado: si viene, el padre decide si está abierto */
  open?: boolean
  /** Callback al hacer clic en el header (solo si no es forceOpen) */
  onToggle?: () => void
  /** Si true, siempre abierto (útil para desktop) */
  forceOpen?: boolean
  /** Estado de completitud para mostrar el badge "Listo" / "Pendiente" */
  complete?: boolean
  /** Número de paso (1, 2, 3...) — se muestra si no hay icon */
  step?: number
  className?: string
  children: ReactNode
}

export function AccordionSection({
  title,
  subtitle,
  icon,
  open,
  onToggle,
  forceOpen = false,
  complete = false,
  step,
  className,
  children,
}: AccordionSectionProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = forceOpen || (open !== undefined ? open : internalOpen)

  function handleToggle() {
    if (forceOpen) return
    if (onToggle) {
      onToggle()
    } else {
      setInternalOpen((v) => !v)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden transition-colors',
        'dark:bg-gradient-to-b dark:from-card/90 dark:to-card/70',
        className,
      )}
    >
      {!forceOpen && (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          className={cn(
            'flex w-full items-center justify-between gap-3 px-4 py-3',
            'min-h-14 text-left text-sm font-semibold',
            'hover:bg-elevated/60 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
              {icon ?? (step ? <span className="text-sm font-bold">{step}</span> : null)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{title}</span>
              {subtitle && (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {complete ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                <Check className="size-3" aria-hidden="true" />
                Listo
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                Pendiente
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-5 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className={cn(
            'px-4 pb-4',
            !forceOpen && 'border-t pt-4 animate-in fade-in slide-in-from-top-1 duration-200',
          )}
        >
          {forceOpen && (
            <div className="flex items-center gap-2 pb-3 pt-1">
              {icon && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{title}</h3>
                {subtitle && (
                  <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  )
}

export default AccordionSection
