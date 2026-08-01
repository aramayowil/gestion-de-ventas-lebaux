/**
 * pages/obra-form/useObraForm.ts
 *
 * Hook con toda la lógica del formulario de obra/presupuesto/venta.
 *
 * Cambios en esta iteración:
 *   · Autosave con debounce de 400ms (no en cada tecla).
 *   · `onFinalizado` para navegación "punto sin retorno" al cerrar un
 *     presupuesto/venta (reemplaza el historial, no se puede volver atrás).
 *   · Botón único en barra inferior fija: la acción se calcula a partir
 *     del estado (borrador/pendiente/rechazado/aceptado) y del tipo
 *     (presupuesto/venta):
 *       - borrador + presupuesto → "Finalizar Presupuesto"
 *       - borrador + venta       → "Finalizar Venta"
 *       - pendiente/rechazado    → "Actualizar Presupuesto"
 *       - aceptado (= venta)     → "Actualizar Venta"
 *   · El draft se guarda en `borrador-store` (separado de las obras en
 *     Supabase), así el listado de obras del cliente solo muestra obras
 *     finalizadas.
 */
import * as React from 'react'
import { toast } from 'sonner'
import {
  useClientes,
  useObraById,
  useCreateObra,
  useUpdateObra,
  useDeleteObra,
  usePagos,
  useCreatePago,
  useUpdatePago,
  useDeletePago,
  useSiguienteNumeroRecibo,
  useAjustes,
  AJUSTES_DEFAULT,
} from '@/hooks/queries'
import { useBorradorStore } from '@/lib/stores/borrador-store'
import { useDescripcionesStore } from '@/lib/stores/descripciones-store'
import { calcularTotalesObra, calcularMontoConRecargoTarjeta, formatMoney } from '@/lib/obra-totales'
import {
  nuevaObra,
  nuevaTipologia,
  nuevoPago,
  uuid,
  type FormaPago,
  type Obra,
  type Pago,
  type TipoObra,
} from '@/lib/types'

export type SeccionAcordeon = 'aberturas' | 'pago' | 'descuentos' | ''

interface UseObraFormParams {
  clienteId: string
  obraId?: string
  /** En desktop no se usa el acordeón, así que no hace falta auto-abrir. */
  isDesktop: boolean
  onVolver: () => void
  /** Navegación "punto sin retorno": reemplaza el historial. */
  onFinalizado: () => void
  /** Tipo elegido en TipoObraModal antes de entrar. Solo aplica a obras nuevas. */
  tipoInicial?: TipoObra
}

export function useObraForm({ clienteId, obraId, isDesktop, onVolver, onFinalizado, tipoInicial }: UseObraFormParams) {
  const { data: clientes = [], isLoading: cargandoCliente } = useClientes()
  const cliente = clientes.find((c) => c.id === clienteId)
  const { data: existente, isLoading: cargandoExistente } = useObraById(obraId)
  const crearObraMutation = useCreateObra()
  const actualizarObraMutation = useUpdateObra()
  const eliminarObraMutation = useDeleteObra()
  const { data: pagosExistente = [], isLoading: cargandoPagosExistente } = usePagos(
    existente ? [existente.id] : [],
  )
  const { data: siguienteNumero = 1 } = useSiguienteNumeroRecibo()
  const crearPagoMutation = useCreatePago()
  const actualizarPagoMutation = useUpdatePago()
  const eliminarPagoMutation = useDeletePago()
  const obtenerBorrador = useBorradorStore((s) => s.obtenerBorrador)
  const guardarBorrador = useBorradorStore((s) => s.guardarBorrador)
  const eliminarBorrador = useBorradorStore((s) => s.eliminarBorrador)
  const registrarDescripcion = useDescripcionesStore((s) => s.registrar)

  // Mientras editamos una obra existente, esperamos a que lleguen tanto la
  // obra como sus pagos antes de mostrar el formulario (evita "flash" de
  // formulario vacío y builds a partir de datos parciales).
  const cargando = cargandoCliente || (!!obraId && (cargandoExistente || (!!existente && cargandoPagosExistente)))

  /* ──────────── Estado del form ────────────
   * Si llegamos con obraId, la obra existente llega async (TanStack Query);
   * arrancamos con el draft/obra nueva y, cuando `existente` resuelve, un
   * efecto más abajo sobrescribe el estado con los datos reales (una sola vez).
   */
  const tipo = existente?.tipo ?? tipoInicial ?? 'venta'

  const [obra, setObra] = React.useState<Obra>(() => {
    if (existente) return structuredClone(existente)
    const draft = obtenerBorrador(clienteId, tipo)
    if (draft) {
      const o = structuredClone(draft.obra)
      // Asegurar forma de pago por defecto según el tipo si el draft no la tenía
      // ('A convenir' solo tiene sentido en presupuestos).
      if (!o.formaPago) o.formaPago = tipo === 'presupuesto' ? 'A convenir' : 'Efectivo'
      return o
    }
    // nuevaObra ya setea la forma de pago por defecto según el tipo.
    return nuevaObra(clienteId, tipo)
  })

  // `obraGuardadaId` guarda el ID real (asignado por Supabase) de la obra
  // persistida, para evitar duplicados al hacer doble click en Finalizar
  // y para poder actualizar (en vez de re-crear) en guardados posteriores.
  const [obraGuardadaId, setObraGuardadaId] = React.useState<string | null>(
    existente?.id ?? null,
  )

  // Al editar una venta existente, buscamos el primer pago registrado
  // (ordenado por fecha) para mostrarlo como "pago inicial editable".
  // Si no hay pagos, arrancamos en 0 con checkbox destildado.
  const primerPagoExistente = React.useMemo<Pago | null>(() => {
    if (!existente) return null
    const pagosObra = pagosExistente
      .filter((p) => !p.anulado)
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    return pagosObra[0] ?? null
  }, [existente, pagosExistente])

  const [pagoInicialMonto, setPagoInicialMonto] = React.useState<number>(() => {
    if (existente) return primerPagoExistente?.monto ?? 0
    const draft = obtenerBorrador(clienteId, tipo)
    return draft?.pagoInicialMonto ?? 0
  })
  const [pagoInicialForma, setPagoInicialForma] = React.useState<FormaPago | ''>(() => {
    if (existente) return primerPagoExistente?.formaPago ?? existente.formaPago ?? ''
    const draft = obtenerBorrador(clienteId, tipo)
    return draft?.pagoInicialForma ?? ''
  })
  // El checkbox de pago inicial:
  //   · Si es obra nueva: arranca destildado (a menos que el draft tuviera monto > 0)
  //   · Si es edición con pago existente: arranca tildado
  const [pagoInicialActivo, setPagoInicialActivo] = React.useState<boolean>(() => {
    if (existente) return !!primerPagoExistente
    const draft = obtenerBorrador(clienteId, tipo)
    return (draft?.pagoInicialMonto ?? 0) > 0
  })

  // Cuando `existente` (y sus pagos) llegan de forma async DESPUÉS del
  // primer render (lo normal, ya que TanStack Query resuelve async), el
  // useState de arriba ya se inicializó con el draft/obra nueva. Este
  // efecto sincroniza el estado real una sola vez apenas los datos llegan.
  const existenteAplicadoRef = React.useRef(false)
  React.useEffect(() => {
    if (existenteAplicadoRef.current) return
    if (!existente || cargandoPagosExistente) return
    existenteAplicadoRef.current = true
    setObra(structuredClone(existente))
    setObraGuardadaId(existente.id)
    const pagosOrdenados = pagosExistente
      .filter((p) => !p.anulado)
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    const primerPago = pagosOrdenados[0] ?? null
    setPagoInicialMonto(primerPago?.monto ?? 0)
    setPagoInicialForma(primerPago?.formaPago ?? existente.formaPago ?? '')
    setPagoInicialActivo(!!primerPago)
  }, [existente, pagosExistente, cargandoPagosExistente])

  /* ──────────── Modales ──────────── */
  // Paso 1 (solo presupuesto): resumen + Confirmar/Cancelar
  const [modalConfirmarPresupuesto, setModalConfirmarPresupuesto] = React.useState(false)
  // Paso 2 (presupuesto, luego de confirmar): imprimir/enviar/volver.
  // También se usa fuera del flujo de finalizar (se abre desde el ⋮ de ClienteDetalle)
  // — cuando `modoFinalizarPresupuesto` es true, el modal está en modo sin retorno.
  const [modalPresupuesto, setModalPresupuesto] = React.useState(false)
  const [modoFinalizarPresupuesto, setModoFinalizarPresupuesto] = React.useState(false)
  // Cierre de venta (auto-save, sin confirmación previa)
  const [modalFinalizarVenta, setModalFinalizarVenta] = React.useState(false)
  // Pago inicial creado al finalizar (para ofrecer imprimir recibo)
  const [pagoRecienCreado, setPagoRecienCreado] = React.useState<Pago | null>(null)

  // Evita duplicar el pago inicial / doble "aceptar" si el usuario hace
  // doble click en Finalizar Venta.
  const ventaFinalizadaRef = React.useRef(false)

  /* ── Acordeón (solo móvil) ── */
  const [seccionAbierta, setSeccionAbierta] = React.useState<SeccionAcordeon>('aberturas')

  /* ── Estados derivados ── */
  const esPresupuesto = obra.tipo === 'presupuesto'
  const esBorrador = obra.estadoPresupuesto === 'borrador'
  const esPresupuestoAbierto =
    esPresupuesto && (obra.estadoPresupuesto === 'pendiente' || obra.estadoPresupuesto === 'rechazado')
  const esVentaCerrada = obra.estadoPresupuesto === 'aceptado'

  // Los presupuestos en borrador/pendiente/rechazado no permiten pago
  // inicial: si por algún motivo el estado viene con un valor > 0 (ej:
  // draft viejo), lo reseteamos a 0. Los presupuestos ACEPTADOS sí
  // permiten pago inicial (operan como venta), así que no los reseteamos.
  const permitePagoInicial = !esPresupuesto || obra.estadoPresupuesto === 'aceptado'
  React.useEffect(() => {
    if (!permitePagoInicial && pagoInicialMonto > 0) {
      setPagoInicialMonto(0)
    }
  }, [permitePagoInicial, pagoInicialMonto])

  // IVA por línea configurado en Ajustes (ivaBasePct = tope, ej. 21%;
  // ivaPorLinea = IVA que cada línea ya trae incluido en su precio).
  // Se usan solo cuando `incluyeIva` está activo, para el desglose
  // correcto del presupuesto por ítem.
  const sistemaAjustes = useAjustes(null).data?.sistema ?? AJUSTES_DEFAULT.sistema
  const ivaConfig = React.useMemo(
    () => ({
      ivaBasePct: sistemaAjustes.ivaBasePct,
      ivaPorLinea: sistemaAjustes.ivaPorLinea,
    }),
    [sistemaAjustes],
  )

  const totales = React.useMemo(
    () => calcularTotalesObra(obra, [], ivaConfig),
    [obra, ivaConfig],
  )

  // Para que TipologiasSection muestre el precio unitario ya ajustado
  // en cada ítem cuando el vendedor activa "Discriminar IVA".
  const ivaInfo = React.useMemo(
    () => ({ incluyeIva: !!obra.incluyeIva, ...ivaConfig }),
    [obra.incluyeIva, ivaConfig],
  )

  /* ──────────── Autosave de borrador con debounce (solo obras nuevas) ────────────
   * Cada cambio al form se re-guarda en borrador-store tras 400ms de inactividad,
   * para no escribir en localStorage en cada tecla.
   */
  const obraRef = React.useRef(obra)
  obraRef.current = obra
  const pagoMontoRef = React.useRef(pagoInicialMonto)
  pagoMontoRef.current = pagoInicialMonto
  const pagoFormaRef = React.useRef(pagoInicialForma)
  pagoFormaRef.current = pagoInicialForma

  React.useEffect(() => {
    if (existente) return // No guardamos draft si estamos editando obra persistida
    if (obraGuardadaId) return // Ni siquiera si ya fue finalizada en esta sesión
    const t = setTimeout(() => {
      guardarBorrador(clienteId, tipo, {
        obra: obraRef.current,
        pagoInicialMonto: pagoMontoRef.current,
        pagoInicialForma: pagoFormaRef.current,
      })
    }, 400)
    return () => clearTimeout(t)
  }, [obra, pagoInicialMonto, pagoInicialForma, clienteId, tipo, existente, obraGuardadaId, guardarBorrador])

  // ── Validaciones ──
  const tipologiasValidas = React.useMemo(() => {
    return (
      obra.tipologias.length > 0 &&
      obra.tipologias.every(
        (t) => t.descripcion.trim().length > 0 && t.cantidad > 0,
      )
    )
  }, [obra.tipologias])

  const pagoInicialNum = pagoInicialMonto || 0
  const pagoInicialValido =
    pagoInicialNum === 0 ||
    (pagoInicialNum > 0 && pagoInicialNum <= totales.totalConIva + 0.01)

  const puedeFinalizar = tipologiasValidas && pagoInicialValido

  // Mensaje breve para mostrar arriba del botón cuando está deshabilitado,
  // así el vendedor entiende de un vistazo qué falta en vez de solo ver
  // el botón gris. Prioriza el motivo de aberturas (más común / primer
  // paso) sobre el de pago inicial.
  const motivoNoPuedeFinalizar = !tipologiasValidas
    ? obra.tipologias.length === 0
      ? 'Agregá al menos una abertura para continuar.'
      : 'Completá la descripción y cantidad de todas las aberturas.'
    : !pagoInicialValido
      ? `El pago inicial no puede superar el total ($${formatMoney(totales.totalConIva)}).`
      : null

  const totalAberturas = obra.tipologias.reduce((acc, t) => acc + (t.cantidad || 0), 0)
  // Ítems sin descripción o sin precio: mismo criterio que el círculo
  // verde/ámbar de cada fila, para que el subtítulo del acordeón (visible
  // con la sección cerrada) adelante si hay algo pendiente adentro.
  const itemsIncompletos = obra.tipologias.filter(
    (t) => t.descripcion.trim().length === 0 || !(t.precioUnitario > 0),
  ).length
  const aberturasSubtitle =
    obra.tipologias.length > 0
      ? `${obra.tipologias.length} ítem${obra.tipologias.length === 1 ? '' : 's'} · ${totalAberturas} abertura${totalAberturas === 1 ? '' : 's'}${
          totales.totalConIva > 0 ? ` · $${formatMoney(totales.totalConIva)}` : ''
        }${itemsIncompletos > 0 ? ` · ${itemsIncompletos} por completar` : ''}`
      : 'Agregá al menos una abertura para empezar'
  const pagoSubtitle = `Total: $${formatMoney(totales.totalConIva)}`

  /* ──────────── Handlers de tipologías ──────────── */
  function actualizarTipologia(id: string, patch: Partial<Obra['tipologias'][0]>) {
    setObra((o) => ({
      ...o,
      tipologias: o.tipologias.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }
  function agregarTipologia() {
    setObra((o) => ({ ...o, tipologias: [...o.tipologias, nuevaTipologia()] }))
    if (!isDesktop && obra.tipologias.length === 0) {
      setSeccionAbierta('aberturas')
    }
  }
  function eliminarTipologia(id: string) {
    setObra((o) => ({
      ...o,
      tipologias: o.tipologias.filter((t) => t.id !== id),
    }))
  }
  /** Inserta una copia del ítem justo después del original, con nuevo id.
   * Útil para aberturas repetidas con alguna pequeña variante (medida,
   * color) — evita recargar todo desde cero. */
  function duplicarTipologia(id: string) {
    setObra((o) => {
      const idx = o.tipologias.findIndex((t) => t.id === id)
      if (idx === -1) return o
      const copia = { ...o.tipologias[idx], id: uuid() }
      const tipologias = [...o.tipologias]
      tipologias.splice(idx + 1, 0, copia)
      return { ...o, tipologias }
    })
  }

  /* ──────────── Validación común a ambos flujos ──────────── */
  function validarAntesDeFinalizar(): boolean {
    if (!tipologiasValidas) {
      toast.error('Cada ítem necesita descripción y cantidad mayor a cero.')
      return false
    }
    if (!pagoInicialValido) {
      toast.error(
        `El pago inicial no puede superar el total ($${formatMoney(totales.totalConIva)}).`,
      )
      return false
    }
    // Alimentamos el historial de autocompletado con las descripciones
    // de esta obra, para sugerirlas en la próxima cotización.
    for (const t of obra.tipologias) {
      registrarDescripcion(t.descripcion)
    }
    return true
  }

  /**
   * Sincroniza el pago inicial contra el store según el estado del checkbox.
   * Devuelve el pago creado/actualizado (o null si se eliminó / no había).
   *
   * Reglas:
   *   · Si la obra no permite pago inicial (presupuesto no aceptado) → null.
   *   · Si el checkbox está destildado:
   *       - Si había un pago inicial existente → lo ELIMINA.
   *       - Si no → no hace nada.
   *   · Si el checkbox está tildado pero monto <= 0 → null.
   *   · Si hay pago existente → lo actualiza.
   *   · Si no hay → lo crea nuevo.
   *   · Si ya se procesó en esta sesión (pagoRecienCreado) → devuelve ese.
   */
  async function sincronizarPagoInicial(obraId: string): Promise<Pago | null> {
    if (!permitePagoInicial) return null

    // Caso 1: checkbox destildado → eliminar pago existente si lo había
    if (!pagoInicialActivo) {
      if (primerPagoExistente && !pagoRecienCreado) {
        await eliminarPagoMutation.mutateAsync(primerPagoExistente.id)
      }
      return null
    }

    // Caso 2: checkbox tildado pero sin monto → no registrar
    if (pagoInicialNum <= 0) return null

    // Caso 3: ya procesado en esta sesión
    if (pagoRecienCreado) return pagoRecienCreado

    // `pagoInicialNum` es siempre el monto BASE (lo que cubre del saldo).
    // Si la forma es Tarjeta, el monto REAL registrado incluye el recargo.
    const montoReal =
      pagoInicialForma === 'Tarjeta'
        ? calcularMontoConRecargoTarjeta(pagoInicialNum, sistemaAjustes.recargoTarjetaPct)
        : pagoInicialNum

    // Caso 4: actualizar pago existente
    if (primerPagoExistente) {
      const pagoActualizado: Pago = {
        ...primerPagoExistente,
        monto: montoReal,
        montoBase: pagoInicialNum,
        formaPago: (pagoInicialForma || undefined) as FormaPago | undefined,
      }
      await actualizarPagoMutation.mutateAsync(pagoActualizado)
      setPagoRecienCreado(pagoActualizado)
      return pagoActualizado
    }

    // Caso 5: crear nuevo pago (el id real lo asigna Supabase)
    const pagoBase = nuevoPago(obraId, siguienteNumero)
    pagoBase.monto = montoReal
    pagoBase.montoBase = pagoInicialNum
    pagoBase.formaPago = (pagoInicialForma || undefined) as FormaPago | undefined
    const pagoCreado = await crearPagoMutation.mutateAsync(pagoBase)
    const pagoReal = pagoCreado ?? pagoBase
    setPagoRecienCreado(pagoReal)
    return pagoReal
  }

  /* ──────────── Flujo Presupuesto: Finalizar / Actualizar ──────────── */
  function handleAbrirConfirmarPresupuesto() {
    if (!validarAntesDeFinalizar()) return
    // Guardamos ya lo que esté cargado (por si el debounce no llegó a correr).
    // Para obras nuevas todavía no persistidas, esto no hace nada;
    // la persistencia real ocurre en handleConfirmarPresupuesto.
    if (obraGuardadaId) {
      actualizarObraMutation.mutateAsync({ ...obra, id: obraGuardadaId }).catch(() => {
        // Silencioso: el guardado real ocurre igual al confirmar
      })
    }
    setModalConfirmarPresupuesto(true)
  }

  async function handleConfirmarPresupuesto() {
    // Persistir obra como 'pendiente'
    let obraFinal: Obra = {
      ...obra,
      estadoPresupuesto: 'pendiente',
      pendienteEn: obra.pendienteEn ?? new Date().toISOString(),
      rechazadoEn: undefined,
      rechazadoMotivo: undefined,
    }

    try {
      if (obraGuardadaId) {
        obraFinal = { ...obraFinal, id: obraGuardadaId }
        await actualizarObraMutation.mutateAsync(obraFinal)
      } else if (existente) {
        obraFinal = { ...obraFinal, id: existente.id }
        await actualizarObraMutation.mutateAsync(obraFinal)
      } else {
        const nuevoId = await crearObraMutation.mutateAsync(obraFinal)
        if (nuevoId) obraFinal = { ...obraFinal, id: nuevoId }
        setObraGuardadaId(obraFinal.id)
      }
      setObra(obraFinal)

      // Registrar pago inicial si lo hay
      const pago = await sincronizarPagoInicial(obraFinal.id)

      // Limpiar draft (obra ya persistida)
      eliminarBorrador(clienteId, tipo)

      // Cerrar confirmación, abrir modal de presupuesto en modo finalizar
      setModalConfirmarPresupuesto(false)
      setModoFinalizarPresupuesto(true)
      setModalPresupuesto(true)
      toast.success(
        pago
          ? `Presupuesto guardado con pago inicial de $${formatMoney(pago.monto)}.`
          : 'Presupuesto guardado como pendiente.',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar el presupuesto.')
    }
  }

  function handleCancelarConfirmarPresupuesto() {
    setModalConfirmarPresupuesto(false)
  }

  /* ──────────── Flujo Venta: Finalizar / Actualizar ──────────── */
  async function handleFinalizarVenta() {
    if (!validarAntesDeFinalizar()) return

    // Si ya se finalizó en esta sesión (doble click o "Actualizar venta" de nuevo):
    // solo re-guardamos los cambios y volvemos a mostrar el cierre.
    if (ventaFinalizadaRef.current) {
      try {
        await actualizarObraMutation.mutateAsync(obra)
        setModalFinalizarVenta(true)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar la venta.')
      }
      return
    }
    ventaFinalizadaRef.current = true

    // Persistir obra como 'aceptado' (es una venta)
    let obraFinal: Obra = {
      ...obra,
      estadoPresupuesto: 'aceptado',
      aceptadoEn: obra.aceptadoEn ?? new Date().toISOString(),
      rechazadoEn: undefined,
      rechazadoMotivo: undefined,
    }

    try {
      if (obraGuardadaId) {
        obraFinal = { ...obraFinal, id: obraGuardadaId }
        await actualizarObraMutation.mutateAsync(obraFinal)
      } else if (existente) {
        obraFinal = { ...obraFinal, id: existente.id }
        await actualizarObraMutation.mutateAsync(obraFinal)
      } else {
        const nuevoId = await crearObraMutation.mutateAsync(obraFinal)
        if (nuevoId) obraFinal = { ...obraFinal, id: nuevoId }
        setObraGuardadaId(obraFinal.id)
      }
      setObra(obraFinal)

      // Registrar pago inicial si lo hay
      const pago = await sincronizarPagoInicial(obraFinal.id)

      // Limpiar draft (obra ya persistida)
      eliminarBorrador(clienteId, tipo)

      toast.success(
        pago
          ? `Venta guardada con pago inicial de $${formatMoney(pago.monto)}.`
          : 'Venta guardada.',
      )
      setModalFinalizarVenta(true)
    } catch (e) {
      ventaFinalizadaRef.current = false
      toast.error(e instanceof Error ? e.message : 'Error al guardar la venta.')
    }
  }

  /* ──────────── Cierre del modal FinalizarVenta ────────────
   * Cierra el modal de venta y navega con onFinalizado (replace: true).
   * El remito de fábrica NO se crea acá: se genera desde el menú ⋮
   * de la card de obra en ClienteDetalle (solo si la venta está aceptada). */
  function handleCerrarFinalizarVenta() {
    setModalFinalizarVenta(false)
    onFinalizado()
  }

  /* ──────────── Cierre final (después de remito o presupuesto) ────────────
   * Punto sin retorno: navegamos con onFinalizado (replace: true). */
  function handleVolverClienteDesdeModal() {
    setModalPresupuesto(false)
    setModoFinalizarPresupuesto(false)
    setModalFinalizarVenta(false)
    onFinalizado()
  }

  /* ──────────── Cierre normal del modal de presupuesto (no finalizar) ──────────── */
  function handleCerrarModalPresupuesto() {
    setModalPresupuesto(false)
    setModoFinalizarPresupuesto(false)
  }

  async function handleEliminar() {
    const idPersistido = obraGuardadaId ?? existente?.id
    try {
      if (idPersistido) {
        // Cascada (pagos/tipologías/remitos → turnos) via FK, no hace falta borrarlos a mano.
        await eliminarObraMutation.mutateAsync(idPersistido)
      }
      // Por las dudas, también limpiar draft
      eliminarBorrador(clienteId, tipo)
      toast.success('Obra eliminada.')
      onVolver()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar la obra.')
    }
  }

  /* ──────────── Acción del botón único de la barra inferior ────────────
   * Devuelve { label, onClick } según el estado actual del form. */
  const accionBoton = esBorrador
    ? esPresupuesto
      ? { label: 'Finalizar Presupuesto', onClick: handleAbrirConfirmarPresupuesto }
      : { label: 'Finalizar Venta', onClick: handleFinalizarVenta }
    : esPresupuestoAbierto
      ? { label: 'Actualizar Presupuesto', onClick: handleAbrirConfirmarPresupuesto }
      : { label: 'Actualizar Venta', onClick: handleFinalizarVenta }

  return {
    cargando,
    cliente,
    existente,
    obra,
    setObra,
    pagoInicialMonto,
    setPagoInicialMonto,
    pagoInicialForma,
    setPagoInicialForma,
    pagoInicialActivo,
    setPagoInicialActivo,
    permitePagoInicial,
    pagoRecienCreado,
    seccionAbierta,
    setSeccionAbierta,
    esBorrador,
    esPresupuesto,
    esPresupuestoAbierto,
    esVentaCerrada,
    totales,
    ivaInfo,
    tipologiasValidas,
    pagoInicialNum,
    pagoInicialValido,
    puedeFinalizar,
    motivoNoPuedeFinalizar,
    aberturasSubtitle,
    pagoSubtitle,
    actualizarTipologia,
    agregarTipologia,
    eliminarTipologia,
    duplicarTipologia,
    handleEliminar,
    eliminandoObra: eliminarObraMutation.isPending,
    guardando: crearObraMutation.isPending || actualizarObraMutation.isPending,
    onFinalizado,

    // Botón único de barra inferior
    accionBoton,

    // Presupuesto
    modalConfirmarPresupuesto,
    handleConfirmarPresupuesto,
    handleCancelarConfirmarPresupuesto,
    modalPresupuesto,
    handleCerrarModalPresupuesto,
    modoFinalizarPresupuesto,
    handleVolverClienteDesdeModal,

    // Venta
    modalFinalizarVenta,
    handleCerrarFinalizarVenta,
  }
}
