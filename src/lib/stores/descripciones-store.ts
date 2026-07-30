/**
 * lib/stores/descripciones-store.ts — Historial de descripciones de
 * abertura ya tipeadas, para autocompletar en TipologiaRow.
 *
 * Por qué existe:
 *   El vendedor suele cotizar tipos de abertura parecidos ("Ventana
 *   corrediza 2 hojas — 1,20 x 1,10 m") una y otra vez. En vez de
 *   re-escribir el texto largo cada vez, se sugieren las descripciones
 *   ya usadas por ESTE vendedor en ESTE dispositivo (no es dato de
 *   negocio ni se comparte entre vendedores — es puramente conveniencia
 *   de tipeo local, similar en espíritu al autocompletado del teclado).
 *
 * Cada descripción se guarda una sola vez (Set por texto normalizado) y
 * se recorta a las últimas N para no crecer indefinidamente.
 */
import { create } from 'zustand'
import { STORAGE_KEY_DESCRIPCIONES_FRECUENTES } from '../storage-keys'

const MAX_DESCRIPCIONES = 60

interface DescripcionesStoreState {
  descripciones: string[]
  /** Sugerencias que empiezan con `query` (case/acento-insensible),
   * más recientes primero, máximo `limit`. */
  buscar: (query: string, limit?: number) => string[]
  /** Registra una descripción como usada (la sube al tope del historial). */
  registrar: (texto: string) => void
}

function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function leer(): string[] {
  try {
    const texto = localStorage.getItem(STORAGE_KEY_DESCRIPCIONES_FRECUENTES)
    if (!texto) return []
    const parsed = JSON.parse(texto)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistir(descripciones: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DESCRIPCIONES_FRECUENTES, JSON.stringify(descripciones))
  } catch (e) {
    console.error('No se pudo persistir descripciones frecuentes:', e)
  }
}

export const useDescripcionesStore = create<DescripcionesStoreState>((set, get) => ({
  descripciones: leer(),

  buscar: (query, limit = 5) => {
    const q = normalizar(query)
    if (q.length < 3) return [] // muy corto, no vale la pena sugerir todavía
    return get()
      .descripciones.filter((d) => normalizar(d).includes(q) && normalizar(d) !== q)
      .slice(0, limit)
  },

  registrar: (texto) => {
    const limpio = texto.trim()
    if (limpio.length < 3) return
    const actuales = get().descripciones.filter(
      (d) => normalizar(d) !== normalizar(limpio),
    )
    const descripciones = [limpio, ...actuales].slice(0, MAX_DESCRIPCIONES)
    set({ descripciones })
    persistir(descripciones)
  },
}))
