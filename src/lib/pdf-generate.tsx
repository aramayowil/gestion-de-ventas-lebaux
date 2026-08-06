/**
 * lib/pdf-generate.ts — Utilidades compartidas para generar, descargar y
 * subir PDFs (para poder enviarlos por WhatsApp con un link).
 *
 * Tanto el flujo "Acta + Recibo" (2 páginas) como "Recibo solo" (1 página)
 * y el presupuesto usan estas funciones para evitar duplicar la lógica de
 * construcción del blob.
 *
 * @react-pdf/renderer y los layouts se importan de forma DINÁMICA: es una
 * librería pesada que solo hace falta cuando el usuario efectivamente
 * imprime un comprobante, así que no viaja en el bundle inicial (clave
 * para el tiempo de carga en conexiones móviles).
 *
 * SUBIDA A SUPABASE STORAGE (para WhatsApp):
 * El bucket "comprobantes" es privado (ver src/sql/schema.sql). Subimos el
 * PDF con upsert=true (así regenerar un comprobante pisa el archivo viejo
 * en vez de acumular basura) y generamos una signed URL de 30 días. Esa
 * signed URL es larga y muestra el dominio de Supabase, así que antes de
 * devolverla la pasamos por el acortador propio (lib/link-corto.ts), que
 * la envuelve en un link corto con nuestro dominio. Nadie necesita estar
 * logueado para abrir ese link, pero deja de funcionar a los 30 días.
 */

import { supabase } from '@/lib/supabase-client'
import type { Cliente, ConfigEmpresa, Obra, Pago, TotalesObra } from '@/lib/types'
import { sanitizarNombreArchivo } from '@/lib/obra-totales'
import { acortarLink } from '@/lib/link-corto'

export type TipoComprobante = 'combinado' | 'recibo-solo'

export interface DatosComprobante {
  cliente: Cliente
  obra: Obra
  pago: Pago
  totales: TotalesObra
  /** IVA base del sistema (Ajustes), para la línea informativa "PRECIO
   * CON IVA" en ComprobantePdfLayout cuando corresponde. */
  ivaBasePct?: number
}

export interface DatosPresupuestoPdf {
  cliente: Cliente
  obra: Obra
  totales: TotalesObra
  empresa: ConfigEmpresa
  ivaBasePct?: number
}

const BUCKET_COMPROBANTES = 'comprobantes'
/** 30 días, en segundos. Pasado ese plazo el link deja de servir el PDF. */
const EXPIRACION_SIGNED_URL_SEGUNDOS = 60 * 60 * 24 * 30

/* ────────────── Construcción de blobs (sin descargar ni subir) ────────────── */

async function construirBlobCombinado({
  cliente,
  obra,
  pago,
  totales,
  ivaBasePct,
}: DatosComprobante): Promise<Blob> {
  const [{ pdf }, { ComprobantePdfLayout }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/ComprobantePdfLayout'),
  ])
  return pdf(
    <ComprobantePdfLayout
      cliente={cliente}
      obra={obra}
      pago={pago}
      totales={totales}
      ivaBasePct={ivaBasePct}
    />,
  ).toBlob()
}

async function construirBlobReciboSolo({
  cliente,
  obra,
  pago,
  totales,
}: DatosComprobante): Promise<Blob> {
  const [{ pdf }, { ReciboPagoPdfLayout }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/ReciboPagoPdfLayout'),
  ])
  return pdf(
    <ReciboPagoPdfLayout
      cliente={cliente}
      obra={obra}
      pago={pago}
      totales={totales}
    />,
  ).toBlob()
}

async function construirBlobComprobante(
  tipo: TipoComprobante,
  datos: DatosComprobante,
): Promise<Blob> {
  return tipo === 'combinado'
    ? construirBlobCombinado(datos)
    : construirBlobReciboSolo(datos)
}

/* ────────────── Generar + descargar (flujo original, sin tocar) ────────────── */

/** Genera el PDF COMBINADO: Acta de Entrega (pág. 1) + Recibo de Pago (pág. 2). */
export async function generarPdfCombinado(datos: DatosComprobante): Promise<void> {
  const blob = await construirBlobCombinado(datos)
  const nroRecibo = String(datos.pago.numeroRecibo).padStart(4, '0')
  descargarBlob(
    blob,
    `Lebaux_Acta_Recibo_${sanitizarNombreArchivo(datos.cliente.nombre)}_N${nroRecibo}.pdf`,
  )
}

/** Genera el PDF de una SOLA página: Recibo de Pago individual. */
export async function generarPdfReciboSolo(datos: DatosComprobante): Promise<void> {
  const blob = await construirBlobReciboSolo(datos)
  const nroRecibo = String(datos.pago.numeroRecibo).padStart(4, '0')
  descargarBlob(
    blob,
    `Recibo_${sanitizarNombreArchivo(datos.cliente.nombre)}_N${nroRecibo}.pdf`,
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

/* ────────────── Subida a Supabase Storage + signed URL (para WhatsApp) ────────────── */

/** Path del PDF de un pago dentro del bucket "comprobantes". */
function pathComprobantePago(obraId: string, numeroRecibo: number, tipo: TipoComprobante): string {
  const nro = String(numeroRecibo).padStart(4, '0')
  const sufijo = tipo === 'combinado' ? 'combinado' : 'recibo'
  return `${obraId}/pago-${nro}-${sufijo}.pdf`
}

/** Path del PDF de un presupuesto/venta dentro del bucket "comprobantes". */
function pathPresupuesto(obraId: string): string {
  return `${obraId}/presupuesto.pdf`
}

/**
 * Sube un blob al bucket "comprobantes" (upsert: pisa el archivo si ya
 * existía en ese path), genera una signed URL válida por 30 días, y la
 * devuelve ACORTADA (dominio propio, corta) para pegar en WhatsApp —
 * ver lib/link-corto.ts. Si el acortador falla, devuelve la signed URL
 * larga de Supabase tal cual (mejor un link feo que ningún link).
 * Tira un Error con mensaje legible si falla la subida o la firma —
 * pensado para mostrarse directo en un toast.
 */
async function subirComprobantePdf(blob: Blob, path: string): Promise<string> {
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(path, blob, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (uploadError) {
    throw new Error(`No se pudo subir el PDF: ${uploadError.message}`)
  }

  const { data, error: signError } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .createSignedUrl(path, EXPIRACION_SIGNED_URL_SEGUNDOS)
  if (signError || !data?.signedUrl) {
    throw new Error(
      `No se pudo generar el link del PDF: ${signError?.message ?? 'respuesta vacía'}`,
    )
  }

  return acortarLink({ urlDestino: data.signedUrl, storagePath: path })
}

/**
 * Genera el PDF de comprobante/recibo (combinado o solo) y lo sube al
 * bucket "comprobantes". Devuelve la signed URL para pegar en el mensaje
 * de WhatsApp. NO descarga el archivo localmente — para eso está
 * `generarPdf`/`generarPdfCombinado`/`generarPdfReciboSolo`.
 */
export async function generarYSubirPdfComprobante(
  tipo: TipoComprobante,
  datos: DatosComprobante,
): Promise<string> {
  const blob = await construirBlobComprobante(tipo, datos)
  const path = pathComprobantePago(datos.obra.id, datos.pago.numeroRecibo, tipo)
  return subirComprobantePdf(blob, path)
}

/**
 * Genera el PDF de presupuesto/venta y lo sube al bucket "comprobantes".
 * Devuelve la signed URL para pegar en el mensaje de WhatsApp.
 */
export async function generarYSubirPdfPresupuesto(
  datos: DatosPresupuestoPdf,
): Promise<string> {
  const [{ pdf }, { PresupuestoPdfLayout }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/PresupuestoPdfLayout'),
  ])
  const blob = await pdf(
    <PresupuestoPdfLayout
      cliente={datos.cliente}
      obra={datos.obra}
      totales={datos.totales}
      empresa={datos.empresa}
      ivaBasePct={datos.ivaBasePct}
    />,
  ).toBlob()
  const path = pathPresupuesto(datos.obra.id)
  return subirComprobantePdf(blob, path)
}
