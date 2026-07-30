/**
 * pages/obra-form/PlantillasMenu.tsx
 *
 * Botón "Plantillas" en la sección de aberturas del form de obra. Abre un
 * Sheet con dos funciones:
 *   · Aplicar una plantilla guardada — reemplaza las aberturas actuales
 *     (con confirmación si ya hay ítems cargados, para no perder trabajo).
 *   · Guardar el set actual como plantilla nueva, con nombre.
 *
 * Pensado para obras grandes y repetitivas (mismo tipo de vivienda, mismo
 * desarrollador): evita recargar desde cero el mismo conjunto de
 * aberturas en cada presupuesto/venta parecido.
 */
import * as React from 'react'
import { LayoutTemplate, Trash2, Save, FileStack } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { usePlantillasStore, type PlantillaObra } from '@/lib/stores/plantillas-store'
import { cn } from '@/lib/utils'

interface Props {
  /** Cantidad de aberturas cargadas actualmente (para saber si confirmar
   * antes de reemplazar por una plantilla). */
  cantidadItemsActuales: number
  onAplicar: (plantilla: PlantillaObra) => void
  onGuardar: (nombre: string) => void
  /** Clases extra para el botón trigger (ej: ocupar un grid en mobile). */
  triggerClassName?: string
}

export function PlantillasMenu({
  cantidadItemsActuales,
  onAplicar,
  onGuardar,
  triggerClassName,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [modo, setModo] = React.useState<'lista' | 'guardar'>('lista')
  const [nombreNuevo, setNombreNuevo] = React.useState('')
  const [plantillaAConfirmar, setPlantillaAConfirmar] = React.useState<PlantillaObra | null>(null)

  const listar = usePlantillasStore((s) => s.listar)
  const eliminar = usePlantillasStore((s) => s.eliminar)
  const plantillas = listar()

  function abrir() {
    setModo('lista')
    setNombreNuevo('')
    setOpen(true)
  }

  function elegirPlantilla(p: PlantillaObra) {
    // Si ya hay ítems cargados, confirmamos antes de pisarlos.
    if (cantidadItemsActuales > 0) {
      setPlantillaAConfirmar(p)
      return
    }
    aplicar(p)
  }

  function aplicar(p: PlantillaObra) {
    onAplicar(p)
    setPlantillaAConfirmar(null)
    setOpen(false)
  }

  function confirmarGuardado() {
    if (!nombreNuevo.trim()) return
    onGuardar(nombreNuevo.trim())
    setOpen(false)
  }

  return (
    <>
      <Button variant="outline" size="sm" type="button" onClick={abrir} className={cn(triggerClassName)}>
        <LayoutTemplate className="size-4" />
        Plantillas
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md">
          {modo === 'lista' ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-xl">Plantillas</SheetTitle>
                <SheetDescription>
                  Aplicá un set de aberturas guardado, o guardá el actual para reutilizarlo.
                </SheetDescription>
              </SheetHeader>

              <SheetBody className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-11 border-dashed"
                  type="button"
                  onClick={() => setModo('guardar')}
                  disabled={cantidadItemsActuales === 0}
                >
                  <Save className="size-4" />
                  Guardar aberturas actuales como plantilla
                </Button>

                {plantillas.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    <FileStack className="size-6 mx-auto mb-2 text-muted-foreground/60" aria-hidden="true" />
                    Todavía no guardaste ninguna plantilla.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {plantillas.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-3"
                      >
                        <button
                          type="button"
                          onClick={() => elegirPlantilla(p)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <span className="block font-medium truncate">{p.nombre}</span>
                          <span className="block text-xs text-muted-foreground">
                            {p.tipologias.length} ítem{p.tipologias.length === 1 ? '' : 's'}
                          </span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => eliminar(p.id)}
                          aria-label={`Eliminar plantilla ${p.nombre}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </SheetBody>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-xl">Guardar plantilla</SheetTitle>
                <SheetDescription>
                  Ponele un nombre para reconocerla después (ej: "Depto 2 amb. tipo A").
                </SheetDescription>
              </SheetHeader>

              <SheetBody className="space-y-3">
                <Input
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  placeholder="Nombre de la plantilla"
                  autoFocus
                  autoComplete="off"
                  className="h-11"
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" type="button" onClick={() => setModo('lista')}>
                    Volver
                  </Button>
                  <Button
                    className="flex-1"
                    type="button"
                    onClick={confirmarGuardado}
                    disabled={!nombreNuevo.trim()}
                  >
                    Guardar
                  </Button>
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!plantillaAConfirmar} onOpenChange={(v) => !v && setPlantillaAConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar aberturas actuales?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya tenés {cantidadItemsActuales} ítem{cantidadItemsActuales === 1 ? '' : 's'} cargado
              {cantidadItemsActuales === 1 ? '' : 's'}. Aplicar "{plantillaAConfirmar?.nombre}" los va a
              reemplazar por los de la plantilla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => plantillaAConfirmar && aplicar(plantillaAConfirmar)}>
              Sí, reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
