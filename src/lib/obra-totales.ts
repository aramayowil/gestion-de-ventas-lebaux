/**
 * lib/obra-totales.ts — Cálculos puros sobre una Obra y sus Pagos.
 * El saldo NUNCA se persiste: siempre se deriva de los pagos no anulados.
 */
import type {
  DatosTipologia,
  EstadoPago,
  Obra,
  Pago,
  TotalesObra,
} from './types'

/**
 * Redondea un valor monetario a centavos para evitar arrastre de errores
 * de punto flotante (ej: 128374.99999999999 en vez de 128375) a través de
 * sumas, restas y multiplicaciones encadenadas.
 */
export function redondearMoneda(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

export function totalTipologia(t: DatosTipologia): number {
  return redondearMoneda((t.cantidad || 0) * (t.precioUnitario || 0))
}

export function totalAbonadoDePagos(pagos: Pago[]): number {
  return redondearMoneda(
    pagos
      .filter((p) => !p.anulado)
      .reduce((acc, p) => acc + (p.monto || 0), 0),
  )
}

export function calcularTotalesObra(
  obra: Pick<Obra, 'tipologias' | 'descuentoPct' | 'incluyeIva' | 'ivaPct'>,
  pagos: Pago[],
): TotalesObra {
  const totalBruto = redondearMoneda(
    obra.tipologias.reduce((acc, t) => acc + totalTipologia(t), 0),
  )
  const descuentoMonto = redondearMoneda(totalBruto * (obra.descuentoPct || 0))
  const totalConDescuento = redondearMoneda(totalBruto - descuentoMonto)
  const totalAbonado = totalAbonadoDePagos(pagos)
  const saldoPendiente = redondearMoneda(
    Math.max(0, totalConDescuento - totalAbonado),
  )

  // IVA: puramente informativo para el presupuesto (no afecta saldo/pagos,
  // que siguen calculándose sobre totalConDescuento como siempre).
  const incluyeIva = obra.incluyeIva ?? false
  const ivaPct = obra.ivaPct ?? 0
  const ivaMonto = incluyeIva ? redondearMoneda(totalConDescuento * ivaPct) : 0
  const totalConIva = redondearMoneda(totalConDescuento + ivaMonto)

  return {
    totalBruto,
    descuentoPct: obra.descuentoPct || 0,
    descuentoMonto,
    totalConDescuento,
    incluyeIva,
    ivaPct,
    ivaMonto,
    totalConIva,
    totalAbonado,
    saldoPendiente,
  }
}

export function estadoDeSaldo(
  saldoPendiente: number,
  totalConDescuento: number,
): EstadoPago {
  if (totalConDescuento <= 0) return 'sin-datos'
  return saldoPendiente > 0 ? 'debe' : 'pagado'
}

/** Formatea un número como moneda ARS sin decimales. */
export function formatMoney(v: number): string {
  return (v || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/** Normaliza texto para búsqueda (minúsculas, sin acentos ni espacios extra). */
export function normalizarTexto(v: string | undefined | null): string {
  if (!v) return ''
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Sanea un string para usarlo como nombre de archivo. */
export function sanitizarNombreArchivo(nombre: string): string {
  return (nombre || 'documento')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '')
    .slice(0, 60)
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** "12 de marzo de 2025" */
export function formatFechaLarga(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
  } catch {
    return iso
  }
}

/** "12/03/2025" */
export function formatFechaCorta(iso: string): string {
  try {
    const d = new Date(iso)
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    return `${dia}/${mes}/${d.getFullYear()}`
  } catch {
    return iso
  }
}

export function pluralizar(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural
}

/* ────────────── WhatsApp / Teléfono ────────────── */

/**
 * Normaliza un teléfono WhatsApp a solo dígitos, aplicando las siguientes
 * reglas para el caso argentino:
 *   · Quita el prefijo internacional `54` (y el `9` de móvil que le sigue)
 *     cuando el número viene copiado de WhatsApp (ej: "+54 9 381 572 9129").
 *   · Quita el `0` inicial si lo tiene (formato local argentino).
 *   · Quita el `15` (prefijo de móvil argentino) que aparece entre el
 *     código de área y el número (ej: "381 15 572 9129" → "3815729129").
 *
 * Ejemplos:
 *   "+54 9 381 572 9129"  → "3815729129"
 *   "5493815729129"       → "3815729129"
 *   "0381 15 572 9129"    → "3815729129"
 *   "381 15 572 9129"     → "3815729129"
 *   "3815729129"          → "3815729129"
 */
export function normalizarWhatsApp(v: string | undefined | null): string {
  if (!v) return ''
  let s = v.replace(/\D/g, '')

  // 1) Si empieza con 54 (prefijo internacional Argentina), lo quitamos.
  //    Puede venir con un "9" después (móvil): "5493815729129" → "3815729129"
  if (s.startsWith('54')) {
    const resto = s.slice(2)
    if (resto.startsWith('9') && resto.length === 11) {
      // "549" + 10 dígitos = móvil argentino
      s = resto.slice(1) // quitamos el "9"
    } else if (resto.length >= 10) {
      s = resto
    }
  }

  // 2) Si arranca con 0 (formato local "0381..."), lo quitamos
  if (s.startsWith('0')) s = s.slice(1)

  // 3) Quitar el "15" (prefijo de móvil argentino) entre código de área
  //    y número local. Casos típicos:
  //      "381155729129" → "3815729129"  (15 después de 3 dígitos de área)
  //      "381 15 5729129" → ya normalizado a dígitos "381155729129"
  //    Validamos que el "15" esté en la posición 3-4 (después del código
  //    de área de 3 dígitos) y que el resultado final tenga 10 dígitos.
  if (s.length === 12 && s.slice(3, 5) === '15') {
    s = s.slice(0, 3) + s.slice(5) // "38115XXXX" → "381XXXX"
  }

  return s
}

/**
 * Formatea un número WhatsApp para mostrar: agrupa en bloques
 * legibles. Solo a nivel display, no se persiste.
 *   "3815729129" → "381 572 9129"
 *   "5493815729129" → "+54 9 381 572 9129"
 */
export function formatWhatsApp(v: string | undefined | null, prefijo = '54'): string {
  const n = normalizarWhatsApp(v)
  if (!n) return ''
  if (n.startsWith(prefijo) && n.length > 10) {
    const rest = n.slice(prefijo.length)
    // Si después del prefijo viene un 9 (Argentina móvil), lo mostramos
    if (rest.startsWith('9') && rest.length === 11) {
      const area = rest.slice(1, 4)
      const parte1 = rest.slice(4, 7)
      const parte2 = rest.slice(7, 11)
      return `+${prefijo} 9 ${area} ${parte1} ${parte2}`
    }
    return `+${prefijo} ${rest}`
  }
  // Sin prefijo: formato local
  if (n.length === 10) {
    return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 10)}`
  }
  return n
}

/**
 * Formatea un teléfono MIENTRAS se tipea/pega en el input del form
 * de cliente. Aplica la máscara "XXX XXX-XXXX" (3 + 3 + 4).
 *
 * Recibe el valor crudo del input, lo normaliza (quitando 0, 15, 54, 9)
 * y lo formatea con espacios y guion.
 *
 *   "381"           → "381"
 *   "3815"          → "381 5"
 *   "381572"        → "381 572"
 *   "3815729"       → "381 572-9"
 *   "3815729129"    → "381 572-9129"
 *   "+54 9 381 572 9129" → "381 572-9129"
 */
export function formatearTelefonoInput(v: string): string {
  const n = normalizarWhatsApp(v)
  if (!n) return ''
  // Limitar a 10 dígitos (número argentino sin prefijos)
  const digits = n.slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Valida que un teléfono normalizado sea un número argentino válido.
 * Acepta 10 dígitos (código de área 2-4 dígitos + número local 6-8 dígitos).
 *
 * Casos válidos después de normalizar:
 *   "3815729129"    (10 dígitos, área 381 + 7 dígitos)
 *   "1135729129"    (10 dígitos, área 11 + 8 dígitos)
 *   "2914572912"    (10 dígitos, área 291 + 7 dígitos)
 *
 * No acepta:
 *   - Menos de 10 dígitos
 *   - Más de 10 dígitos (algo quedó sin normalizar)
 *   - Vacío
 */
export function validarTelefonoArgentina(v: string | undefined | null): boolean {
  const n = normalizarWhatsApp(v)
  if (!n) return false
  // 10 dígitos, empezando con dígitos válidos de área argentina (1-3)
  return /^\d{10}$/.test(n) && /^[1-9]/.test(n)
}

/**
 * Construye un mensaje de WhatsApp con el resumen del presupuesto.
 * Pensado para `wa.me/<numero>?text=<mensaje_urlencoded>`.
 */
export function construirMensajePresupuesto(opts: {
  nombreCliente: string
  items: { descripcion: string; cantidad: number; precioUnitario: number }[]
  totalBruto: number
  descuentoPct: number
  descuentoMonto: number
  totalConDescuento: number
  nombreEmpresa: string
  incluyeIva?: boolean
  ivaPct?: number
  ivaMonto?: number
  totalConIva?: number
}): string {
  const lineas: string[] = []
  lineas.push(`*${opts.nombreEmpresa}*`)
  lineas.push(`Presupuesto para *${opts.nombreCliente}*`)
  lineas.push('')
  lineas.push('─'.repeat(20))
  lineas.push('')

  opts.items.forEach((it, i) => {
    if (!it.descripcion.trim()) return
    const subtotal = it.cantidad * it.precioUnitario
    lineas.push(
      `${i + 1}. ${it.cantidad}x ${it.descripcion}`,
    )
    lineas.push(`   $${formatMoney(subtotal)}`)
  })

  lineas.push('')
  lineas.push('─'.repeat(20))
  lineas.push(`Total bruto: $${formatMoney(opts.totalBruto)}`)
  if (opts.descuentoMonto > 0) {
    lineas.push(`Descuento (${Math.round(opts.descuentoPct * 100)}%): −$${formatMoney(opts.descuentoMonto)}`)
  }
  if (opts.incluyeIva && opts.ivaMonto) {
    lineas.push(
      `IVA (${Math.round((opts.ivaPct || 0) * 1000) / 10}%): +$${formatMoney(opts.ivaMonto)}`,
    )
  }
  const totalFinal = opts.incluyeIva ? (opts.totalConIva ?? opts.totalConDescuento) : opts.totalConDescuento
  lineas.push(`*TOTAL: $${formatMoney(totalFinal)}*`)
  lineas.push('')
  lineas.push('Quedamos a disposición por cualquier consulta.')
  return lineas.join('\n')
}

/* ────────────── Presupuesto ────────────── */

/**
 * Calcula si un presupuesto en estado 'pendiente' debería auto-rechazarse
 * por vencimiento (más de `dias` días desde pendienteEn sin aceptar).
 */
export function presupuestoVencido(
  obra: Pick<Obra, 'estadoPresupuesto' | 'pendienteEn' | 'aceptadoEn'>,
  dias: number,
): boolean {
  if (obra.estadoPresupuesto !== 'pendiente') return false
  if (!obra.pendienteEn) return false
  if (obra.aceptadoEn) return false
  const diff = Date.now() - new Date(obra.pendienteEn).getTime()
  return diff > dias * 24 * 60 * 60 * 1000
}

/**
 * Calcula la fecha de vencimiento de un presupuesto pendiente
 * (pendienteEn + dias). Devuelve ISO string o undefined.
 */
export function fechaVencimientoPresupuesto(
  obra: Pick<Obra, 'pendienteEn'>,
  dias: number,
): string | undefined {
  if (!obra.pendienteEn) return undefined
  const d = new Date(obra.pendienteEn)
  d.setDate(d.getDate() + dias)
  return d.toISOString()
}

/**
 * Devuelve los días restantes hasta el vencimiento (negativo si vencido).
 */
export function diasHastaVencimiento(
  obra: Pick<Obra, 'pendienteEn'>,
  dias: number,
): number | undefined {
  if (!obra.pendienteEn) return undefined
  const venc = fechaVencimientoPresupuesto(obra, dias)!
  const diff = new Date(venc).getTime() - Date.now()
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

