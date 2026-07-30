/**
 * lib/stores/plantillas-store.ts — Plantillas de aberturas reutilizables.
 *
 * Por qué existe:
 *   Para obras grandes y repetitivas (mismo tipo de vivienda, mismo
 *   desarrollador), cargar desde cero el mismo conjunto de aberturas cada
 *   vez es trabajo perdido. El vendedor puede guardar el conjunto actual
 *   de ítems como plantilla con nombre, y aplicarla en cualquier
 *   presupuesto/venta nuevo (reemplaza los ítems cargados en ese momento).
 *
 *   Igual que los borradores (borrador-store.ts), viven solo en este
 *   dispositivo — no son dato de negocio compartido entre vendedores ni se
 *   sincronizan a Supabase. Si el equipo pide compartirlas entre
 *   dispositivos más adelante, se migra este store a una tabla.
 *
 * Esquema:
 *   {
 *     [id]: {
 *       id, nombre: string,
 *       tipologias: DatosTipologia[],   // snapshot, no referencia
 *       creadaEn: string (ISO)
 *     }
 *   }
 */
import { create } from 'zustand'
import type { DatosTipologia } from '../types'
import { uuid } from '../types'
import { STORAGE_KEY_PLANTILLAS } from '../storage-keys'

export interface PlantillaObra {
  id: string
  nombre: string
  tipologias: DatosTipologia[]
  creadaEn: string
}

type PlantillasMap = Record<string, PlantillaObra>

interface PlantillasStoreState {
  plantillas: PlantillasMap
  /** Lista ordenada por más reciente primero. */
  listar: () => PlantillaObra[]
  /** Guarda una nueva plantilla a partir de un set de tipologías (las
   * clona, así ediciones posteriores del form no la afectan). */
  guardar: (nombre: string, tipologias: DatosTipologia[]) => PlantillaObra
  eliminar: (id: string) => void
}

function leer(): PlantillasMap {
  try {
    const texto = localStorage.getItem(STORAGE_KEY_PLANTILLAS)
    if (!texto) return {}
    return JSON.parse(texto) as PlantillasMap
  } catch {
    return {}
  }
}

function persistir(plantillas: PlantillasMap): void {
  try {
    localStorage.setItem(STORAGE_KEY_PLANTILLAS, JSON.stringify(plantillas))
  } catch (e) {
    // localStorage lleno o privado — fail silenciosamente, no rompemos la app
    console.error('No se pudo persistir plantilla:', e)
  }
}

export const usePlantillasStore = create<PlantillasStoreState>((set, get) => ({
  plantillas: leer(),

  listar: () => {
    return Object.values(get().plantillas).sort(
      (a, b) => new Date(b.creadaEn).getTime() - new Date(a.creadaEn).getTime(),
    )
  },

  guardar: (nombre, tipologias) => {
    const nueva: PlantillaObra = {
      id: uuid(),
      nombre: nombre.trim(),
      // Clonamos y regeneramos IDs de ítem: al aplicar la plantilla no
      // queremos que los ítems del form nuevo compartan `id` con los de
      // la plantilla guardada (colisionarían las keys de React).
      tipologias: structuredClone(tipologias).map((t) => ({ ...t, id: uuid() })),
      creadaEn: new Date().toISOString(),
    }
    const plantillas = { ...get().plantillas, [nueva.id]: nueva }
    set({ plantillas })
    persistir(plantillas)
    return nueva
  },

  eliminar: (id) => {
    const plantillas = { ...get().plantillas }
    delete plantillas[id]
    set({ plantillas })
    persistir(plantillas)
  },
}))
