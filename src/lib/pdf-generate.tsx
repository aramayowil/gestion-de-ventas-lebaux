/**
 * lib/pdf-generate.ts — Utilidades compartidas para generar y descargar PDFs.
 *
 * Tanto el flujo "Acta + Recibo" (2 páginas) como "Recibo solo" (1 página)
 * usan estas funciones para evitar duplicar la lógica de blob + anchor download.
 *
 * @react-pdf/renderer y los layouts se importan de forma DINÁMICA: es una
 * librería pesada que solo hace falta cuando el usuario efectivamente
 * imprime un comprobante, así que no viaja en el bundle inicial (clave
 * para el tiempo de carga en conexiones móviles).
 */

import type { Cliente, Obra, Pago, TotalesObra } from '@/lib/types'
import { sanitizarNombreArchivo } from '@/lib/obra-totales'

export type TipoComprobante = 'combinado' | 'recibo-solo'

export interface DatosComprobante {
  cliente: Cliente
  obra: Obra
  pago: Pago
  totales: TotalesObra
}

/** Genera el PDF COMBINADO: Acta de Entrega (pág. 1) + Recibo de Pago (pág. 2). */
export async function generarPdfCombinado({
  cliente,
  obra,
  pago,
  totales,
}: DatosComprobante): Promise<void> {
  const [{ pdf }, { ComprobantePdfLayout }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/ComprobantePdfLayout'),
  ])
  const blob = await pdf(
    <ComprobantePdfLayout
      cliente={cliente}
      obra={obra}
      pago={pago}
      totales={totales}
    />,
  ).toBlob()
  const nroRecibo = String(pago.numeroRecibo).padStart(4, '0')
  descargarBlob(
    blob,
    `Lebaux_Acta_Recibo_${sanitizarNombreArchivo(cliente.nombre)}_N${nroRecibo}.pdf`,
  )
}

/** Genera el PDF de una SOLA página: Recibo de Pago individual. */
export async function generarPdfReciboSolo({
  cliente,
  obra,
  pago,
  totales,
}: DatosComprobante): Promise<void> {
  const [{ pdf }, { ReciboPagoPdfLayout }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/ReciboPagoPdfLayout'),
  ])
  const blob = await pdf(
    <ReciboPagoPdfLayout
      cliente={cliente}
      obra={obra}
      pago={pago}
      totales={totales}
    />,
  ).toBlob()
  const nroRecibo = String(pago.numeroRecibo).padStart(4, '0')
  descargarBlob(
    blob,
    `Recibo_${sanitizarNombreArchivo(cliente.nombre)}_N${nroRecibo}.pdf`,
  )
}

/** Genera el PDF según el tipo elegido. */
export async function generarPdf(
  tipo: TipoComprobante,
  datos: DatosComprobante,
): Promise<void> {
  if (tipo === 'combinado') {
    return generarPdfCombinado(datos)
  }
  return generarPdfReciboSolo(datos)
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
