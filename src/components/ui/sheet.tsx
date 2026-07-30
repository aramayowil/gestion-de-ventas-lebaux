"use client"

/**
 * components/ui/sheet.tsx — Modal responsivo: bottom-sheet en mobile,
 * dialog centrado en desktop.
 *
 * Por qué existe: hasta ahora todos los formularios (nuevo cliente,
 * registrar pago, crear vendedor, etc.) usaban `Dialog`, que siempre se
 * ve como una caja centrada flotando sobre el contenido. En desktop eso
 * está bien, pero en mobile —donde vive la mayoría del uso real de esta
 * app— una caja centrada angosta para un formulario se siente "web
 * embebida", no "app nativa". El patrón nativo esperado en mobile es
 * que el formulario suba desde abajo, ocupe el ancho completo y tenga
 * un handle visual arriba, como cualquier bottom-sheet de iOS/Android.
 *
 * `Sheet` es exactamente esa idea: en pantallas chicas (`< 640px`, el
 * mismo breakpoint que ya usa `useIsDesktop` en el resto del proyecto)
 * el contenido se ancla abajo, ocupa el ancho completo, tiene esquinas
 * redondeadas solo arriba y un handle (barrita) para sugerir que se
 * puede arrastrar para cerrar. En desktop cae exactamente al mismo
 * layout que `Dialog` (centrado, `max-w-lg`, esquinas redondeadas en
 * las 4 puntas) — mismo componente, dos presentaciones.
 *
 * Reutiliza `@radix-ui/react-dialog` (el mismo primitivo que `Dialog` en
 * dialog.tsx), así que hereda gratis todo lo ya resuelto ahí: foco
 * atrapado, cierre con Escape, overlay con blur, portal. La única
 * diferencia real está en las clases del `Content` y en que la altura
 * máxima + scroll interno del cuerpo reemplazan a
 * `useVisualViewportTop`: como el sheet está anclado abajo (no
 * centrado), el teclado virtual simplemente empuja el viewport visual
 * y el `max-h-[85dvh]` + `overflow-y-auto` del body hacen que el campo
 * enfocado quede visible sin necesidad de recalcular ninguna posición.
 *
 * Cuándo usar `Sheet` vs `Dialog` vs `AlertDialog`:
 *   · Sheet: formularios (crear/editar algo) — el caso de uso principal.
 *   · Dialog: contenido no-formulario que sigue queriendo el mismo look
 *     en ambos tamaños (por ejemplo, un preview de PDF).
 *   · AlertDialog: confirmaciones cortas de una sola decisión ("¿Eliminar
 *     turno?"). Estas quedan bien centradas incluso en mobile porque son
 *     solo texto + 2 botones, no ameritan el peso visual de un sheet.
 */
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsDesktop } from "@/hooks/use-is-desktop"

function Sheet({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/70 backdrop-blur-md dark:bg-black/80",
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const isDesktop = useIsDesktop()

  return (
    <SheetPortal data-slot="sheet-portal">
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-card fixed z-50 flex max-h-[85dvh] min-h-0 flex-col gap-4 border border-border/60 shadow-2xl dark:bg-gradient-to-b dark:from-card dark:to-card/90",
          // ── Mobile: sheet anclado abajo, ancho completo ──
          "inset-x-0 bottom-0 w-full rounded-t-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-300 data-[state=closed]:duration-200",
          // ── Desktop (sm+): mismo look que Dialog — centrado, esquinas en las 4 puntas ──
          "sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg",
          "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-6",
          "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
          "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        {/* Handle: solo visible en mobile, sugiere "se puede arrastrar
            para cerrar" aunque el swipe-to-dismiss real todavía no esté
            implementado — es una señal visual de affordance, estándar
            en iOS/Android, que además ayuda a distinguir de un Dialog. */}
        {!isDesktop && (
          <div
            className="mx-auto -mt-2 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-border"
            aria-hidden="true"
          />
        )}

        {children}

        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

/** Contenido intermedio (campos del formulario, etc.): el único que
 * scrollea cuando el form no entra completo en pantalla. Header y
 * footer quedan siempre visibles arriba/abajo. Equivale al
 * `<div className="space-y-4 py-2">` que los modales viejos repetían
 * a mano — con Sheet, ese wrapper ya viene resuelto acá. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto py-2", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:pt-0",
        className,
      )}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
