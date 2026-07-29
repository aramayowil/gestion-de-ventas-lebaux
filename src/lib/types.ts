/**
 * lib/types.ts — Modelos de datos del sistema Lebaux.
 *
 * Cliente (1) ───< Obra (N) ───< Pago (N)
 *
 * Cambios en esta iteración:
 *  - Cliente: solo nombre + telefonoWhatsApp (único por app).
 *  - Obra: incluye estadoPresupuesto y fechas de presupuesto.
 *  - El presupuesto NO es una entidad separada: es el estado de la obra.
 */

export type LineaAbertura = 'Modena' | 'Herrero' | 'A30'
export type ColorAbertura = 'Blanco' | 'Negro' | 'Gris'
export type FormaPago =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta'
  | 'Mixto'
  | 'A convenir'

/**
 * Estado del presupuesto asociado a una obra:
 *   · borrador  — el usuario está armando el presupuesto (guardado en localStorage
 *                  como draft, aún no se finalizó). Si sale sin finalizar, queda acá.
 *   · pendiente — el presupuesto fue finalizado y guardado. Espera respuesta del
 *                  cliente. Se puede editar, eliminar, reenviar, imprimir o cambiar
 *                  a aceptado / rechazado.
 *   · aceptado  — el cliente aceptó → el presupuesto se convierte en VENTA y se
 *                  habilita "Registrar pago".
 *   · rechazado — manual, o auto-rechazado a los N días de pendiente sin aceptar.
 */
export type EstadoPresupuesto = 'borrador' | 'pendiente' | 'aceptado' | 'rechazado'

/**
 * Tipo de obra elegido ANTES de cargar aberturas:
 *   · presupuesto — cotización para el cliente (puede discriminar IVA)
 *   · venta       — flujo normal existente (sin resumen fijo / sin IVA)
 */
export type TipoObra = 'presupuesto' | 'venta'

/* ────────────── Usuario ──────────────
 * Dos roles: admin (ve todo, gestiona vendedores) y vendedor (ve sus
 * propios clientes + los compartidos con él).
 */
export type Rol = 'admin' | 'vendedor'

export interface User {
  id: string
  /** Nombre de usuario único (login). El vendedor puede cambiarlo. */
  username: string
  /** Hash simple (no seguro, solo demo localStorage). */
  passwordHash: string
  rol: Rol
  /** Nombre para mostrar (ej: "Juan Pérez"). */
  nombre: string
  creadoEn: string
  /** ID del admin que creó a este vendedor (null si es admin seed). */
  creadoPor?: string | null
}

/* ────────────── Cliente ────────────── */
export interface Cliente {
  id: string
  nombre: string
  /** Teléfono WhatsApp — solo dígitos, sin + ni espacios. Único por vendedor. */
  telefonoWhatsApp: string
  creadoEn: string // ISO
  /** ID del vendedor propietario. Si null, es legacy (asignar al primer vendedor). */
  vendedorId: string | null
  /** IDs de vendedores con los que se compartió este cliente. */
  compartidoCon: string[]
}

/* ────────────── Tipología (línea de obra / abertura) ────────────── */
export interface DatosTipologia {
  id: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  linea: LineaAbertura
  color: ColorAbertura
}

/* ────────────── Obra ────────────── */
export interface Obra {
  id: string
  clienteId: string
  fecha: string // ISO — fecha de alta
  tipologias: DatosTipologia[]
  formaPago?: FormaPago
  descuentoPct: number // 0..1 (fracción)
  creadoEn: string

  /** Elegido en el modal previo a cargar la obra. Obras viejas sin este
   * campo se tratan como 'venta' (ver calcularTotalesObra / valores por
   * defecto con `??`). */
  tipo?: TipoObra
  /** Si el presupuesto discrimina IVA sobre el total con descuento. */
  incluyeIva?: boolean
  /** Alícuota de IVA aplicada (0..1), fijada al activar el switch. */
  ivaPct?: number

  /* ── Presupuesto (estado + fechas para auto-rechazo) ── */
  estadoPresupuesto: EstadoPresupuesto
  /** Fecha en que el presupuesto pasó a 'pendiente' por primera vez (ISO). */
  pendienteEn?: string
  /** Fecha en que fue aceptado (ISO). */
  aceptadoEn?: string
  /** Fecha en que fue rechazado (ISO) — manual o por vencimiento. */
  rechazadoEn?: string
  /** Motivo opcional del rechazo (auto / manual). */
  rechazadoMotivo?: string
}

/* ────────────── Pago ────────────── */
export interface Pago {
  id: string
  obraId: string
  numeroRecibo: number // correlativo global
  fecha: string // ISO
  monto: number
  formaPago?: FormaPago
  nota?: string
  anulado: boolean
  anuladoMotivo?: string
  creadoEn: string
}

/* ────────────── Totales derivados ────────────── */
export interface TotalesObra {
  totalBruto: number
  descuentoPct: number
  descuentoMonto: number
  totalConDescuento: number
  /** ── IVA (solo informativo — no afecta saldoPendiente/pagos) ── */
  incluyeIva: boolean
  ivaPct: number
  ivaMonto: number
  /** totalConDescuento + ivaMonto. Es el importe final a mostrar/cobrar. */
  totalConIva: number
  totalAbonado: number
  saldoPendiente: number
}

export type EstadoPago = 'pagado' | 'debe' | 'sin-datos'

/* ────────────── Configuración (Ajustes) ────────────── */
export interface ConfigEmpresa {
  nombre: string
  rubro: string
  direccion: string
  telefono: string
  email: string
}

export interface ConfigSistema {
  /** Días para auto-rechazar presupuestos enviados sin aceptar. */
  diasAutoRechazo: number
  /** Prefijo de país para WhatsApp (sin +). Default: 54 (Argentina). */
  prefijoWhatsApp: string
  /** Moneda para formatear montos. */
  moneda: string
  /** Alícuota de IVA (0..1) que se ofrece al armar un presupuesto. */
  ivaPct: number
}

/* ────────────── Fábricas ────────────── */
export function nuevoCliente(
  datos: Partial<Omit<Cliente, 'id' | 'creadoEn'>> = {},
): Cliente {
  return {
    id: uuid(),
    nombre: datos.nombre ?? '',
    telefonoWhatsApp: datos.telefonoWhatsApp ?? '',
    creadoEn: new Date().toISOString(),
    vendedorId: datos.vendedorId ?? null,
    compartidoCon: datos.compartidoCon ?? [],
  }
}

export function nuevaTipologia(): DatosTipologia {
  return {
    id: uuid(),
    descripcion: '',
    cantidad: 1,
    precioUnitario: 0,
    linea: 'Herrero',
    color: 'Blanco',
  }
}

export function nuevaObra(clienteId: string, tipo: TipoObra = 'venta'): Obra {
  const ahora = new Date().toISOString()
  return {
    id: uuid(),
    clienteId,
    fecha: ahora,
    tipologias: [nuevaTipologia()],
    formaPago: 'A convenir',
    descuentoPct: 0,
    creadoEn: ahora,
    estadoPresupuesto: 'borrador',
    tipo,
    incluyeIva: false,
    ivaPct: 0,
  }
}

export function nuevoPago(obraId: string, numeroRecibo: number): Pago {
  return {
    id: uuid(),
    obraId,
    numeroRecibo,
    fecha: new Date().toISOString(),
    monto: 0,
    formaPago: undefined,
    nota: undefined,
    anulado: false,
    creadoEn: new Date().toISOString(),
  }
}

/* ────────────── Remito de fábrica ──────────────
 * Un remito se genera al finalizar una venta. Detalla qué aberturas
 * van a fábrica para su fabricación. Una vez generado, el usuario le
 * asigna un Turno (fecha + hora de entrega) desde la página de Agenda.
 */
export interface Remito {
  id: string
  obraId: string
  clienteId: string
  /** IDs de tipologías incluidas. Si está vacío, se asume "toda la obra". */
  tipologiaIds: string[]
  /** Fecha de entrega deseada (ISO date YYYY-MM-DD, sin hora). */
  fechaEntrega: string
  /** Nota opcional para fábrica (ej: "llevar perfil reforzado"). */
  nota?: string
  /** Fecha de creación (ISO). */
  creadoEn: string
  /** ID del turno asignado, si lo tiene. */
  turnoId?: string
}

/* ────────────── Turno de fábrica ──────────────
 * Un turno es una franja horaria (1 hora, de 8 a 17) en un día
 * específico. Cada turno tiene a lo sumo 1 remito asignado.
 */
export type EstadoTurno = 'pendiente' | 'en-fabrica' | 'listo' | 'entregado' | 'cancelado'

export interface Turno {
  id: string
  /** Remito asignado a este turno. */
  remitoId: string
  obraId: string
  clienteId: string
  /** Fecha del turno (ISO date YYYY-MM-DD). */
  fecha: string
  /** Hora del turno (8-17, entero). */
  hora: number
  estado: EstadoTurno
  /** Nota opcional visible en la agenda. */
  nota?: string
  creadoEn: string
  /** Marcadores de cambio de estado (timestamps ISO). */
  enFabricaEn?: string
  listoEn?: string
  entregadoEn?: string
  canceladoEn?: string
}

/* ────────────── Fábricas ────────────── */
export function nuevoRemito(
  obraId: string,
  clienteId: string,
  tipologiaIds: string[],
  fechaEntrega: string,
  nota?: string,
): Remito {
  return {
    id: uuid(),
    obraId,
    clienteId,
    tipologiaIds,
    fechaEntrega,
    nota,
    creadoEn: new Date().toISOString(),
  }
}

export function nuevoTurno(
  remitoId: string,
  obraId: string,
  clienteId: string,
  fecha: string,
  hora: number,
): Turno {
  return {
    id: uuid(),
    remitoId,
    obraId,
    clienteId,
    fecha,
    hora,
    estado: 'pendiente',
    creadoEn: new Date().toISOString(),
  }
}

/* ────────────── UUID (con fallback) ────────────── */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
