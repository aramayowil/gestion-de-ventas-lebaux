/**
 * lib/constants.ts — Catálogos compartidos.
 */
import type { ColorAbertura, FormaPago, LineaAbertura, ConfigEmpresa, ConfigSistema } from './types'

export const LINEAS: LineaAbertura[] = ['Modena', 'Herrero', 'A30']
export const COLORES: ColorAbertura[] = ['Blanco', 'Negro', 'Gris']
/** Formas de pago para PRESUPUESTOS (incluye 'A convenir', ya que todavía
 * no hay cobro real). 'Mixto' ya no existe como forma de pago. */
export const FORMAS_PAGO: FormaPago[] = [
  'Efectivo',
  'Transferencia',
  'Tarjeta',
  'A convenir',
]

/** Formas de pago para VENTAS (pago inicial y pagos posteriores). No
 * incluye 'A convenir' (no aplica a un cobro real) ni 'Mixto' (cada pago
 * puntual tiene su propia forma de pago; para cubrir el saldo con más de
 * una forma, se registran pagos separados). */
export const FORMAS_PAGO_VENTA: FormaPago[] = ['Efectivo', 'Transferencia', 'Tarjeta']

/** Configuración por defecto de la empresa — sobrescribible desde Ajustes. */
export const EMPRESA_DEFAULT: ConfigEmpresa = {
  nombre: 'LEBAUX SRL',
  rubro: 'Aberturas',
  direccion: 'Av. Alem 1930, San Miguel de Tucumán',
  telefono: '(381) 572-9129',
  email: 'lebauxaberturas1930@gmail.com',
}

/** Configuración del sistema — sobrescribible desde Ajustes. */
export const SISTEMA_DEFAULT: ConfigSistema = {
  diasAutoRechazo: 14,
  prefijoWhatsApp: '54',
  moneda: 'ARS',
  ivaPct: 0.105,
  // IVA base (tope) al que debe llegar cualquier ítem al discriminar
  // IVA, y el IVA que cada línea ya trae incluido en su precio.
  ivaBasePct: 0.21,
  ivaPorLinea: {
    Modena: 0.21,
    Herrero: 0.105,
    A30: 0.105,
  },
  // Recargo por pago con tarjeta, configurable desde Ajustes.
  recargoTarjetaPct: 0.3,
}

/** Etiquetas de estado de presupuesto (solo para UI). */
export const ESTADO_PRESUPUESTO_LABEL: Record<
  'borrador' | 'pendiente' | 'aceptado' | 'rechazado',
  string
> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
}

/* ────────────── Agenda de fábrica ────────────── */

/** Horas de turnos: 8 a 17 (9 turnos por día). */
export const HORAS_TURNO = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]

/** Días de la semana laborables: 1=Lunes … 6=Sábado (excluye domingo=0). */
export const DIAS_LABORABLES = [1, 2, 3, 4, 5, 6]

/** Etiquetas cortas de días de la semana (Lun-Dom). */
export const DIA_SEMANA_CORTO: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
}

/** Etiquetas largas de días de la semana. */
export const DIA_SEMANA_LARGO: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

/** Etiquetas y colores de estado de turno. */
export const ESTADO_TURNO_LABEL: Record<
  'pendiente' | 'en-fabrica' | 'listo' | 'entregado' | 'cancelado',
  string
> = {
  pendiente: 'Pendiente',
  'en-fabrica': 'En fábrica',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}
