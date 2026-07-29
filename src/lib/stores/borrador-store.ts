/**
 * lib/stores/borrador-store.ts — Persistencia de drafts (borradores en curso).
 *
 * Por qué existe:
 *   El usuario pide que, mientras está cargando un presupuesto o venta, los
 *   ítems se guarden automáticamente en localStorage. Si sale o se cierra
 *   el sistema inesperadamente, al volver puede continuar desde donde dejó.
 *
 *   Estos borradores NO son obras todavía: son solo el estado intermedio del
 *   formulario. Cuando el usuario finaliza (presupuesto → pendiente, o venta
 *   → venta directa), el draft se elimina y la obra persistida pasa a vivir
 *   en Supabase (tabla `obras`).
 *
 * Identificación:
 *   Cada draft se guarda bajo una clave compuesta por `clienteId + tipo`.
 *   Esto permite tener a lo sumo 1 draft de presupuesto y 1 draft de venta
 *   por cliente simultáneamente.
 *
 * Esquema:
 *   {
 *     [clienteId:tipo]: {
 *       obra: Obra,                 // estado actual del form
 *       pagoInicialMonto: number,
 *       pagoInicialForma: FormaPago | '',
 *       actualizadoEn: string (ISO)
 *     }
 *   }
 */
import { create } from 'zustand'
import type { FormaPago, Obra, TipoObra } from '../types'
import { STORAGE_KEY_BORRADORES } from '../storage-keys'

export interface BorradorFormState {
  obra: Obra
  pagoInicialMonto: number
  pagoInicialForma: FormaPago | ''
  actualizadoEn: string
}

export type BorradoresMap = Record<string, BorradorFormState>

interface BorradorStoreState {
  borradores: BorradoresMap
  /** Lee un draft por (clienteId, tipo). Devuelve undefined si no existe. */
  obtenerBorrador: (clienteId: string, tipo: TipoObra) => BorradorFormState | undefined
  /** Guarda o reemplaza un draft. Limpia el campo `actualizadoEn` con ahora. */
  guardarBorrador: (clienteId: string, tipo: TipoObra, estado: Omit<BorradorFormState, 'actualizadoEn'>) => void
  /** Elimina un draft específico. */
  eliminarBorrador: (clienteId: string, tipo: TipoObra) => void
  /** Elimina todos los drafts de un cliente (cuando se elimina el cliente). */
  eliminarBorradoresDeCliente: (clienteId: string) => void
  /** Limpia todos los drafts (debug / reset). */
  limpiarTodo: () => void
}

function leerBorradores(): BorradoresMap {
  try {
    const texto = localStorage.getItem(STORAGE_KEY_BORRADORES)
    if (!texto) return {}
    return JSON.parse(texto) as BorradoresMap
  } catch {
    return {}
  }
}

function guardarBorradores(borradores: BorradoresMap): void {
  try {
    localStorage.setItem(STORAGE_KEY_BORRADORES, JSON.stringify(borradores))
  } catch (e) {
    // localStorage lleno o privado — fail silenciosamente, no rompemos la app
    console.error('No se pudo persistir borrador:', e)
  }
}

function clave(clienteId: string, tipo: TipoObra): string {
  return `${clienteId}::${tipo}`
}

export const useBorradorStore = create<BorradorStoreState>((set, get) => ({
  borradores: leerBorradores(),

  obtenerBorrador: (clienteId, tipo) => {
    return get().borradores[clave(clienteId, tipo)]
  },

  guardarBorrador: (clienteId, tipo, estado) => {
    const k = clave(clienteId, tipo)
    const nuevo: BorradorFormState = {
      ...estado,
      actualizadoEn: new Date().toISOString(),
    }
    const borradores = { ...get().borradores, [k]: nuevo }
    set({ borradores })
    guardarBorradores(borradores)
  },

  eliminarBorrador: (clienteId, tipo) => {
    const k = clave(clienteId, tipo)
    const borradores = { ...get().borradores }
    delete borradores[k]
    set({ borradores })
    guardarBorradores(borradores)
  },

  eliminarBorradoresDeCliente: (clienteId) => {
    const prefijo = `${clienteId}::`
    const borradores: BorradoresMap = {}
    for (const [k, v] of Object.entries(get().borradores)) {
      if (!k.startsWith(prefijo)) borradores[k] = v
    }
    set({ borradores })
    guardarBorradores(borradores)
  },

  limpiarTodo: () => {
    set({ borradores: {} })
    guardarBorradores({})
  },
}))

/**
 * Hook conveniente para suscribirse a un draft específico sin re-renderizar
 * cuando cambian otros drafts. Devuelve `undefined` si no existe.
 */
export function useBorrador(clienteId: string | undefined, tipo: TipoObra | undefined) {
  return useBorradorStore((s) =>
    clienteId && tipo ? s.borradores[clave(clienteId, tipo)] : undefined,
  )
}
