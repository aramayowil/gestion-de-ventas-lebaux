/**
 * hooks/queries.ts — Hooks de TanStack Query para todas las entidades.
 *
 * Patrón:
 *   · useXxx() → useQuery para leer datos (con caching automático)
 *   · useCreateXxx() → useMutation para crear (invalida cache)
 *   · useUpdateXxx() → useMutation para actualizar (invalida cache)
 *   · useDeleteXxx() → useMutation para eliminar (invalida cache)
 *
 * Las query keys siguen el patrámbol ['entidad', ...params] para que
 * las invalidaciones sean precisas.
 *
 * Reemplazan a los Zustand stores para datos del servidor. Zustand
 * queda solo para UI state (modales, accordions, sesión auth).
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { EMPRESA_DEFAULT, SISTEMA_DEFAULT } from '@/lib/constants'
import type {
  Cliente,
  Obra,
  Pago,
  Remito,
  Turno,
  EstadoTurno,
  User,
  ConfigEmpresa,
  ConfigSistema,
} from '@/lib/types'

// ─── Query keys ───
export const QK = {
  clientes: ['clientes'] as const,
  obras: ['obras'] as const,
  pagos: ['pagos'] as const,
  ajustes: ['ajustes'] as const,
  remitos: ['remitos'] as const,
  turnos: ['turnos'] as const,
  users: ['users'] as const,
  numeroRecibo: ['numero-recibo'] as const,
}

/* ═══════════════════════════════════════════════════
 * CLIENTES
 * ═══════════════════════════════════════════════════ */

function mapCliente(d: Record<string, unknown>): Cliente {
  return {
    id: d.id as string,
    nombre: d.nombre as string,
    telefonoWhatsApp: d.telefono_whatsapp as string,
    creadoEn: d.creado_en as string,
    vendedorId: (d.vendedor_id as string) ?? null,
    compartidoCon: (d.compartido_con as string[]) ?? [],
    isMayorista: (d.is_mayorista as boolean) ?? false,
  }
}

export function useClientes(): UseQueryResult<Cliente[]> {
  const currentUser = useAuthStore((s) => s.currentUser)
  return useQuery({
    queryKey: [...QK.clientes, currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return []
      let query = supabase
        .from('clientes')
        .select('*')
        .order('creado_en', { ascending: false })

      if (currentUser.rol !== 'admin') {
        // Un vendedor ve: los clientes propios, o los clientes que le
        // compartieron (su id aparece en el array `compartido_con`).
        //
        // OJO: `compartido_con` es una columna `jsonb` (no un array nativo
        // de postgres), así que el filtro "contains" (cs) necesita sintaxis
        // JSON: corchetes + comillas, ej. `["uuid-del-vendedor"]`.
        // La sintaxis de array de postgres (llaves, sin comillas, ej.
        // `{uuid-del-vendedor}`) NO funciona con columnas jsonb.
        const esPropio = `vendedor_id.eq.${currentUser.id}`
        const fueCompartidoConEsteVendedor = `compartido_con.cs.["${currentUser.id}"]`
        query = query.or(`${esPropio},${fueCompartidoConEsteVendedor}`)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapCliente)
    },
    enabled: !!currentUser,
  })
}

export function useCreateCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cliente: Partial<Cliente>) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nombre: cliente.nombre,
          telefono_whatsapp: cliente.telefonoWhatsApp,
          vendedor_id: cliente.vendedorId,
          compartido_con: cliente.compartidoCon ?? [],
          is_mayorista: cliente.isMayorista ?? false,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data ? mapCliente(data as Record<string, unknown>) : null
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.clientes }),
  })
}

export function useUpdateCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cliente: Cliente) => {
      const { error } = await supabase
        .from('clientes')
        .update({
          nombre: cliente.nombre,
          telefono_whatsapp: cliente.telefonoWhatsApp,
          vendedor_id: cliente.vendedorId,
          compartido_con: cliente.compartidoCon,
          is_mayorista: cliente.isMayorista,
        })
        .eq('id', cliente.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.clientes }),
  })
}

export function useDeleteCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.clientes })
      qc.invalidateQueries({ queryKey: QK.obras })
      qc.invalidateQueries({ queryKey: QK.pagos })
    },
  })
}

/* ═══════════════════════════════════════════════════
 * OBRAS
 * ═══════════════════════════════════════════════════ */

function mapObra(d: Record<string, unknown>): Obra {
  return {
    id: d.id as string,
    clienteId: d.cliente_id as string,
    fecha: d.fecha as string,
    tipologias: ((d.tipologias as Record<string, unknown>[]) ?? []).map(
      (t) => ({
        id: t.id as string,
        descripcion: t.descripcion as string,
        cantidad: t.cantidad as number,
        precioUnitario: t.precio_unitario as number,
        linea: t.linea as Obra['tipologias'][0]['linea'],
        color: t.color as Obra['tipologias'][0]['color'],
      }),
    ),
    formaPago: (d.forma_pago as Obra['formaPago']) ?? undefined,
    descuentoPct: (d.descuento_pct as number) ?? 0,
    creadoEn: d.creado_en as string,
    tipo: (d.tipo as 'presupuesto' | 'venta') ?? 'venta',
    incluyeIva: (d.incluye_iva as boolean) ?? false,
    ivaPct: (d.iva_pct as number) ?? 0,
    mostrarPrecioConIva: (d.mostrar_precio_con_iva as boolean) ?? false,
    notaCliente: (d.nota_cliente as string) ?? undefined,
    estadoPresupuesto:
      (d.estado_presupuesto as Obra['estadoPresupuesto']) ?? 'borrador',
    pendienteEn: (d.pendiente_en as string) ?? undefined,
    aceptadoEn: (d.aceptado_en as string) ?? undefined,
    rechazadoEn: (d.rechazado_en as string) ?? undefined,
    rechazadoMotivo: (d.rechazado_motivo as string) ?? undefined,
  }
}

export function useObras(clienteIds: string[]): UseQueryResult<Obra[]> {
  return useQuery({
    queryKey: [...QK.obras, clienteIds],
    queryFn: async () => {
      if (clienteIds.length === 0) return []
      const { data, error } = await supabase
        .from('obras')
        .select('*, tipologias(*)')
        .in('cliente_id', clienteIds)
        .order('creado_en', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []).map((d) => mapObra(d as Record<string, unknown>))
    },
    enabled: clienteIds.length > 0,
  })
}

/** Busca una obra por id sin conocer de antemano su clienteId (p. ej. PagosObraPage). */
export function useObraById(
  obraId: string | undefined,
): UseQueryResult<Obra | null> {
  return useQuery({
    queryKey: [...QK.obras, 'byId', obraId],
    queryFn: async () => {
      if (!obraId) return null
      const { data, error } = await supabase
        .from('obras')
        .select('*, tipologias(*)')
        .eq('id', obraId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ? mapObra(data as Record<string, unknown>) : null
    },
    enabled: !!obraId,
  })
}

export function useCreateObra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (obra: Obra) => {
      // Insertar obra
      const { data, error } = await supabase
        .from('obras')
        .insert({
          cliente_id: obra.clienteId,
          fecha: obra.fecha,
          forma_pago: obra.formaPago ?? null,
          descuento_pct: obra.descuentoPct,
          tipo: obra.tipo,
          incluye_iva: obra.incluyeIva,
          iva_pct: obra.ivaPct,
          mostrar_precio_con_iva: obra.mostrarPrecioConIva ?? false,
          nota_cliente: obra.notaCliente ?? null,
          estado_presupuesto: obra.estadoPresupuesto,
          pendiente_en: obra.pendienteEn ?? null,
          aceptado_en: obra.aceptadoEn ?? null,
          rechazado_en: obra.rechazadoEn ?? null,
          rechazado_motivo: obra.rechazadoMotivo ?? null,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)

      const obraId = data.id

      // Insertar tipologías
      if (obra.tipologias.length > 0) {
        const tipologiasData = obra.tipologias.map((t, i) => ({
          obra_id: obraId,
          descripcion: t.descripcion,
          cantidad: t.cantidad,
          precio_unitario: t.precioUnitario,
          linea: t.linea,
          color: t.color,
          orden: i,
        }))
        const { error: tipError } = await supabase
          .from('tipologias')
          .insert(tipologiasData)
        if (tipError) throw new Error(tipError.message)
      }
      return obraId
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.obras }),
  })
}

export function useUpdateObra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (obra: Obra) => {
      const { error } = await supabase
        .from('obras')
        .update({
          fecha: obra.fecha,
          forma_pago: obra.formaPago ?? null,
          descuento_pct: obra.descuentoPct,
          tipo: obra.tipo,
          incluye_iva: obra.incluyeIva,
          iva_pct: obra.ivaPct,
          mostrar_precio_con_iva: obra.mostrarPrecioConIva ?? false,
          nota_cliente: obra.notaCliente ?? null,
          estado_presupuesto: obra.estadoPresupuesto,
          pendiente_en: obra.pendienteEn ?? null,
          aceptado_en: obra.aceptadoEn ?? null,
          rechazado_en: obra.rechazadoEn ?? null,
          rechazado_motivo: obra.rechazadoMotivo ?? null,
        })
        .eq('id', obra.id)
      if (error) throw new Error(error.message)

      // Actualizar tipologías: delete + insert
      await supabase.from('tipologias').delete().eq('obra_id', obra.id)
      if (obra.tipologias.length > 0) {
        const tipologiasData = obra.tipologias.map((t, i) => ({
          obra_id: obra.id,
          descripcion: t.descripcion,
          cantidad: t.cantidad,
          precio_unitario: t.precioUnitario,
          linea: t.linea,
          color: t.color,
          orden: i,
        }))
        const { error: tipError } = await supabase
          .from('tipologias')
          .insert(tipologiasData)
        if (tipError) throw new Error(tipError.message)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.obras }),
  })
}

export function useDeleteObra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('obras').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.obras })
      qc.invalidateQueries({ queryKey: QK.pagos })
      qc.invalidateQueries({ queryKey: QK.remitos })
      qc.invalidateQueries({ queryKey: QK.turnos })
    },
  })
}

/** Actualiza solo los campos de estado de un presupuesto (sin toque de tipologías). */
function patchEstadoObra(
  id: string,
  patch: {
    estado_presupuesto: string
    pendiente_en?: string | null
    aceptado_en?: string | null
    rechazado_en?: string | null
    rechazado_motivo?: string | null
  },
) {
  return supabase.from('obras').update(patch).eq('id', id)
}

function useEstadoObraMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Parameters<typeof patchEstadoObra>[1]
    }) => {
      const { error } = await patchEstadoObra(id, patch)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.obras }),
  })
}

export function useMarcarPendientePresupuesto() {
  const mutation = useEstadoObraMutation()
  return {
    ...mutation,
    mutateAsync: (obra: Obra) =>
      mutation.mutateAsync({
        id: obra.id,
        patch: {
          estado_presupuesto: 'pendiente',
          pendiente_en: obra.pendienteEn ?? new Date().toISOString(),
          rechazado_en: null,
          rechazado_motivo: null,
        },
      }),
  }
}

export function useAceptarPresupuesto() {
  const mutation = useEstadoObraMutation()
  return {
    ...mutation,
    mutateAsync: (obra: Obra) =>
      mutation.mutateAsync({
        id: obra.id,
        patch: {
          estado_presupuesto: 'aceptado',
          aceptado_en: obra.aceptadoEn ?? new Date().toISOString(),
          rechazado_en: null,
          rechazado_motivo: null,
        },
      }),
  }
}

export function useRechazarPresupuesto() {
  const mutation = useEstadoObraMutation()
  return {
    ...mutation,
    mutateAsync: (obra: Obra, motivo?: string) =>
      mutation.mutateAsync({
        id: obra.id,
        patch: {
          estado_presupuesto: 'rechazado',
          rechazado_en: new Date().toISOString(),
          rechazado_motivo: motivo ?? 'Rechazado por el usuario',
        },
      }),
  }
}

export function useResetearPresupuesto() {
  const mutation = useEstadoObraMutation()
  return {
    ...mutation,
    mutateAsync: (obra: Obra) =>
      mutation.mutateAsync({
        id: obra.id,
        patch: {
          estado_presupuesto: 'pendiente',
          pendiente_en: obra.pendienteEn ?? new Date().toISOString(),
          aceptado_en: null,
          rechazado_en: null,
          rechazado_motivo: null,
        },
      }),
  }
}

/* ═══════════════════════════════════════════════════
 * PAGOS
 * ═══════════════════════════════════════════════════ */

function mapPago(d: Record<string, unknown>): Pago {
  return {
    id: d.id as string,
    obraId: d.obra_id as string,
    numeroRecibo: d.numero_recibo as number,
    fecha: d.fecha as string,
    monto: d.monto as number,
    montoBase: (d.monto_base as number) ?? (d.monto as number),
    formaPago: (d.forma_pago as Pago['formaPago']) ?? undefined,
    nota: (d.nota as string) ?? undefined,
    anulado: (d.anulado as boolean) ?? false,
    anuladoMotivo: (d.anulado_motivo as string) ?? undefined,
    creadoEn: d.creado_en as string,
  }
}

export function usePagos(obraIds: string[]): UseQueryResult<Pago[]> {
  return useQuery({
    queryKey: [...QK.pagos, obraIds],
    queryFn: async () => {
      if (obraIds.length === 0) return []
      const { data, error } = await supabase
        .from('pagos')
        .select('*')
        .in('obra_id', obraIds)
        .order('creado_en', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapPago)
    },
    enabled: obraIds.length > 0,
  })
}

export function useSiguienteNumeroRecibo(): UseQueryResult<number> {
  return useQuery({
    queryKey: QK.numeroRecibo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagos')
        .select('numero_recibo')
        .order('numero_recibo', { ascending: false })
        .limit(1)
        .maybeSingle()
      const ultimo = error
        ? 0
        : ((data?.numero_recibo as number | undefined) ?? 0)
      return ultimo + 1
    },
    staleTime: 0, // siempre fresco: nunca reciclar un número ya usado
  })
}

export function useCreatePago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pago: Pago) => {
      const { data, error } = await supabase
        .from('pagos')
        .insert({
          obra_id: pago.obraId,
          numero_recibo: pago.numeroRecibo,
          fecha: pago.fecha,
          monto: pago.monto,
          monto_base: pago.montoBase ?? pago.monto,
          forma_pago: pago.formaPago ?? null,
          nota: pago.nota ?? null,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data ? mapPago(data as Record<string, unknown>) : null
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.pagos })
      qc.invalidateQueries({ queryKey: QK.numeroRecibo })
    },
  })
}

export function useUpdatePago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pago: Pago) => {
      const { error } = await supabase
        .from('pagos')
        .update({
          monto: pago.monto,
          monto_base: pago.montoBase ?? pago.monto,
          forma_pago: pago.formaPago ?? null,
          nota: pago.nota ?? null,
          anulado: pago.anulado,
          anulado_motivo: pago.anuladoMotivo ?? null,
        })
        .eq('id', pago.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.pagos }),
  })
}

export function useDeletePago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pagoId: string) => {
      const { error } = await supabase.from('pagos').delete().eq('id', pagoId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.pagos }),
  })
}

/* ═══════════════════════════════════════════════════
 * REMITOS
 * ═══════════════════════════════════════════════════ */

function mapRemito(d: Record<string, unknown>): Remito {
  return {
    id: d.id as string,
    obraId: d.obra_id as string,
    clienteId: d.cliente_id as string,
    tipologiaIds: (d.tipologia_ids as string[]) ?? [],
    fechaEntrega: d.fecha_entrega as string,
    nota: (d.nota as string) ?? undefined,
    creadoEn: d.creado_en as string,
    turnoId: (d.turno_id as string) ?? undefined,
  }
}

export function useRemitos(): UseQueryResult<Remito[]> {
  return useQuery({
    queryKey: QK.remitos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remitos')
        .select('*')
        .order('creado_en', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapRemito)
    },
  })
}

export function useCreateRemito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (remito: Remito) => {
      const { data, error } = await supabase
        .from('remitos')
        .insert({
          obra_id: remito.obraId,
          cliente_id: remito.clienteId,
          tipologia_ids: remito.tipologiaIds,
          fecha_entrega: remito.fechaEntrega,
          nota: remito.nota ?? null,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data ? mapRemito(data as Record<string, unknown>) : null
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.remitos }),
  })
}

export function useUpdateRemito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (remito: Remito) => {
      const { error } = await supabase
        .from('remitos')
        .update({
          tipologia_ids: remito.tipologiaIds,
          nota: remito.nota ?? null,
          turno_id: remito.turnoId ?? null,
        })
        .eq('id', remito.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.remitos }),
  })
}

export function useDeleteRemito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('remitos').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.remitos })
      qc.invalidateQueries({ queryKey: QK.turnos })
    },
  })
}

/* ═══════════════════════════════════════════════════
 * TURNOS
 * ═══════════════════════════════════════════════════ */

function mapTurno(d: Record<string, unknown>): Turno {
  return {
    id: d.id as string,
    remitoId: d.remito_id as string,
    obraId: d.obra_id as string,
    clienteId: d.cliente_id as string,
    fecha: d.fecha as string,
    hora: d.hora as number,
    estado: (d.estado as EstadoTurno) ?? 'pendiente',
    nota: (d.nota as string) ?? undefined,
    creadoEn: d.creado_en as string,
    enFabricaEn: (d.en_fabrica_en as string) ?? undefined,
    listoEn: (d.listo_en as string) ?? undefined,
    entregadoEn: (d.entregado_en as string) ?? undefined,
    canceladoEn: (d.cancelado_en as string) ?? undefined,
  }
}

export function useTurnos(): UseQueryResult<Turno[]> {
  return useQuery({
    queryKey: QK.turnos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turnos')
        .select('*')
        .order('fecha', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapTurno)
    },
  })
}

export function useCreateTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (turno: Turno) => {
      const { data, error } = await supabase
        .from('turnos')
        .insert({
          remito_id: turno.remitoId,
          obra_id: turno.obraId,
          cliente_id: turno.clienteId,
          fecha: turno.fecha,
          hora: turno.hora,
          estado: turno.estado,
          nota: turno.nota ?? null,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      const creado = data ? mapTurno(data as Record<string, unknown>) : null
      // Marcar remito con turnoId
      if (creado) {
        await supabase
          .from('remitos')
          .update({ turno_id: creado.id })
          .eq('id', turno.remitoId)
      }
      return creado
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.turnos })
      qc.invalidateQueries({ queryKey: QK.remitos })
    },
  })
}

export function useUpdateTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (turno: Turno) => {
      const { error } = await supabase
        .from('turnos')
        .update({
          fecha: turno.fecha,
          hora: turno.hora,
          estado: turno.estado,
          nota: turno.nota ?? null,
          en_fabrica_en: turno.enFabricaEn ?? null,
          listo_en: turno.listoEn ?? null,
          entregado_en: turno.entregadoEn ?? null,
          cancelado_en: turno.canceladoEn ?? null,
        })
        .eq('id', turno.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.turnos }),
  })
}

export function useDeleteTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // remitos.turno_id no tiene FK: hay que desasignarlo a mano antes de borrar.
      await supabase
        .from('remitos')
        .update({ turno_id: null })
        .eq('turno_id', id)
      const { error } = await supabase.from('turnos').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.turnos })
      qc.invalidateQueries({ queryKey: QK.remitos })
    },
  })
}

/* ═══════════════════════════════════════════════════
 * USERS
 * ═══════════════════════════════════════════════════ */

function mapUser(d: Record<string, unknown>): User {
  return {
    id: d.id as string,
    username: d.username as string,
    passwordHash: '',
    rol: d.rol as 'admin' | 'vendedor',
    nombre: d.nombre as string,
    creadoEn: d.creado_en as string,
    creadoPor: (d.creado_por as string) ?? null,
  }
}

export function useUsers(): UseQueryResult<User[]> {
  return useQuery({
    queryKey: QK.users,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('creado_en', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapUser)
    },
  })
}

/**
 * Crea un vendedor llamando a la Edge Function `crear-vendedor`.
 * Se usa una Edge Function (en vez de supabase.auth.signUp directo) porque
 * signUp() inicia sesión automáticamente con el usuario recién creado en
 * el navegador, lo que "saca" al admin de su propia sesión. La Edge
 * Function crea el usuario del lado del servidor sin afectar la sesión
 * actual del admin.
 */
export function useCrearVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      email,
      password,
      username,
      nombre,
    }: {
      email: string
      password: string
      username: string
      nombre: string
      creadoPor: string
    }) => {
      const u = username.trim().toLowerCase()
      if (!u) throw new Error('El alias visible es obligatorio.')
      if (!password || password.length < 4) {
        throw new Error('La contraseña debe tener al menos 4 caracteres.')
      }

      const { data, error } = await supabase.functions.invoke(
        'crear-vendedor',
        {
          body: { email, password, username: u, nombre },
        },
      )

      if (error) {
        // Intentar extraer el mensaje de error real del body de la respuesta.
        const ctx = (
          error as { context?: { json?: () => Promise<{ error?: string }> } }
        ).context
        const body = await ctx?.json?.().catch(() => null)
        throw new Error(body?.error ?? error.message)
      }
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  })
}

/**
 * Diagnóstico: prueba la conexión con la Edge Function `crear-vendedor`
 * sin crear ningún usuario real. Sirve para detectar si el problema es:
 *   · La función no está desplegada (404 / "Failed to send a request")
 *   · Problema de permisos/sesión (401 / 403)
 *   · La función está desplegada pero tira otro error interno (500)
 */
export function useTestEdgeFunction() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'crear-vendedor',
        // Body intencionalmente inválido: si la función responde con
        // un error de VALIDACIÓN (ej. "Email inválido"), es una buena
        // señal: la función existe y corrió. Si en cambio no hay
        // respuesta o da 404, la función no está desplegada.
        { body: { _diagnostico: true } },
      )

      const status = (
        error as { context?: { status?: number } } | undefined
      )?.context?.status

      const ctx = (
        error as { context?: { json?: () => Promise<{ error?: string }> } }
      )?.context
      const body = await ctx?.json?.().catch(() => null)
      const serverMessage: string | undefined = body?.error

      if (error && !status) {
        // No hubo respuesta HTTP en absoluto: la función no existe,
        // no está desplegada, o hay un problema de red/CORS.
        throw new Error(
          'No se pudo contactar la función "crear-vendedor". Probablemente no está desplegada en este proyecto de Supabase. Desplegala con: supabase functions deploy crear-vendedor',
        )
      }

      if (status === 401 || status === 403) {
        throw new Error(
          `La función respondió (status ${status}) pero rechazó el pedido: "${serverMessage ?? error?.message}". Revisá que tu usuario tenga rol 'admin' en la tabla public.users.`,
        )
      }

      if (status && status >= 400) {
        // Cualquier otro 4xx con mensaje de validación = la función
        // SÍ está desplegada y funcionando correctamente.
        return {
          ok: true,
          status,
          message: serverMessage ?? error?.message ?? 'Función activa.',
        }
      }

      if (data?.error) {
        return { ok: true, status: 200, message: data.error }
      }

      return { ok: true, status: status ?? 200, message: 'Función activa y respondiendo.' }
    },
  })
}

/** Elimina el acceso de un vendedor (no borra sus clientes/obras). */
export function useEliminarVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('users').delete().eq('id', userId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  })
}

/** Actualiza los datos visibles del perfil; el email de acceso vive en Auth. */
export function useActualizarPerfil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      nuevoNombre,
      nuevoUsername,
    }: {
      userId: string
      nuevoNombre: string
      nuevoUsername: string
    }) => {
      const nombre = nuevoNombre.trim()
      const u = nuevoUsername.trim().toLowerCase()
      if (!nombre) throw new Error('El nombre completo es obligatorio.')
      if (!u) throw new Error('El alias visible es obligatorio.')
      const { error } = await supabase
        .from('users')
        .update({ nombre, username: u })
        .eq('id', userId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  })
}

/* ═══════════════════════════════════════════════════
 * AJUSTES (empresa + reglas del sistema)
 * ═══════════════════════════════════════════════════ */

export interface DatosAjustes {
  empresa: ConfigEmpresa
  sistema: ConfigSistema
}

export const AJUSTES_DEFAULT: DatosAjustes = {
  empresa: EMPRESA_DEFAULT,
  sistema: SISTEMA_DEFAULT,
}

/** Lee la config: fila propia del vendedor, o la fila global (vendedor_id null). */
export function useAjustes(
  vendedorId: string | null | undefined,
): UseQueryResult<DatosAjustes> {
  return useQuery({
    queryKey: [...QK.ajustes, vendedorId],
    queryFn: async () => {
      const query = supabase.from('ajustes').select('*')
      const { data, error } = vendedorId
        ? await query
            .or(`vendedor_id.eq.${vendedorId},vendedor_id.is.null`)
            .limit(1)
            .maybeSingle()
        : await query.is('vendedor_id', null).limit(1).maybeSingle()
      if (error || !data) return AJUSTES_DEFAULT
      return {
        empresa: { ...EMPRESA_DEFAULT, ...(data.empresa as ConfigEmpresa) },
        // Merge con defaults: si la fila en la base es de antes de que
        // existieran `ivaBasePct`/`ivaPorLinea`, completamos con los
        // valores por defecto en vez de dejarlos `undefined`.
        sistema: {
          ...SISTEMA_DEFAULT,
          ...(data.sistema as ConfigSistema),
          ivaPorLinea: {
            ...SISTEMA_DEFAULT.ivaPorLinea,
            ...((data.sistema as ConfigSistema)?.ivaPorLinea ?? {}),
          },
        },
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useActualizarAjustes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      vendedorId,
      datos,
    }: {
      vendedorId: string | null
      datos: DatosAjustes
    }) => {
      const { error } = await supabase.from('ajustes').upsert({
        vendedor_id: vendedorId,
        empresa: datos.empresa,
        sistema: datos.sistema,
        actualizado_en: new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.ajustes }),
  })
}

/* ═══════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════ */

/** Helper: check si un turno está ocupado (para el calendario). */
export function useTurnoOcupado() {
  const { data: turnos = [] } = useTurnos()
  return (fecha: string, hora: number, excluirId?: string) =>
    turnos.some(
      (t) =>
        t.id !== excluirId &&
        t.fecha === fecha &&
        t.hora === hora &&
        t.estado !== 'cancelado',
    )
}

/** Helper: primer turno libre desde hoy. */
export function usePrimerTurnoLibre() {
  const { data: turnos = [] } = useTurnos()
  return (desde?: Date) => {
    const inicio = desde ?? new Date()
    inicio.setHours(0, 0, 0, 0)
    const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
    const DIAS = [1, 2, 3, 4, 5, 6] // L-S
    for (let i = 0; i < 60; i++) {
      const d = new Date(inicio)
      d.setDate(d.getDate() + i)
      if (!DIAS.includes(d.getDay())) continue
      const fecha = d.toISOString().slice(0, 10)
      for (const hora of HORAS) {
        if (
          !turnos.some(
            (t) =>
              t.fecha === fecha && t.hora === hora && t.estado !== 'cancelado',
          )
        ) {
          return { fecha, hora }
        }
      }
    }
    return null
  }
}
