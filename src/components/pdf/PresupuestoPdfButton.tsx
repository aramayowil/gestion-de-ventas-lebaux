/**
 * components/pdf/PresupuestoPdfButton.tsx — Botón que genera y descarga el
 * PDF del presupuesto. Importa @react-pdf/renderer dinámicamente.
 */
import * as React from 'react'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Cliente, Obra, TotalesObra } from '@/lib/types'
import { sanitizarNombreArchivo } from '@/lib/obra-totales'
import { useAjustes, AJUSTES_DEFAULT } from '@/hooks/queries'

interface Props {
  cliente: Cliente
  obra: Obra
  totales: TotalesObra
  label?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function PresupuestoPdfButton({
  cliente,
  obra,
  totales,
  label = 'Imprimir PDF',
  variant = 'default',
  size = 'default',
  className,
}: Props) {
  const [cargando, setCargando] = React.useState(false)
  const empresa = useAjustes(null).data?.empresa ?? AJUSTES_DEFAULT.empresa
  const ivaBasePct =
    useAjustes(null).data?.sistema.ivaBasePct ??
    AJUSTES_DEFAULT.sistema.ivaBasePct

  async function handleClick() {
    if (
      !obra.tipologias.length ||
      obra.tipologias.some((t) => !t.descripcion.trim() || t.cantidad <= 0)
    ) {
      toast.error(
        'Completá la descripción y cantidad de todas las aberturas antes de imprimir.',
      )
      return
    }
    setCargando(true)
    try {
      const [{ pdf }, { PresupuestoPdfLayout }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/PresupuestoPdfLayout'),
      ])
      const blob = await pdf(
        <PresupuestoPdfLayout
          cliente={cliente}
          obra={obra}
          totales={totales}
          empresa={empresa}
          ivaBasePct={ivaBasePct}
        />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Presupuesto_${sanitizarNombreArchivo(cliente.nombre)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Presupuesto descargado.')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo generar el PDF. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={cargando}
      aria-busy={cargando}
      aria-label={`Imprimir presupuesto de ${cliente.nombre || 'cliente'}`}
    >
      <Printer className="size-4" aria-hidden="true" />
      {label && <span>{cargando ? 'Generando…' : label}</span>}
    </Button>
  )
}
