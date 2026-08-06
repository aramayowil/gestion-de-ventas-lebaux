/**
 * components/pdf/ComprobantePdfLayout.tsx
 *
 * PDF de UNA SOLA PÁGINA: "Recibo y Condiciones de Entrega".
 *
 *   Contenido de la página única:
 *     · Header (logo + empresa + título "Recibo y Condiciones de Entrega")
 *     · Datos del cliente y la obra
 *     · Tabla de elementos entregados (tipologías de la obra)
 *     · Sub-totales de la obra y aviso de Precio con IVA a la izquierda
 *     · Resumen del pago recibido (monto, total abonado, saldo)
 *     · Condiciones técnicas y cobertura del servicio (texto legal del acta)
 *     · Firmas (Receptor / Responsable)
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { Cliente, Obra, Pago, TotalesObra } from '@/lib/types'
import {
  formatMoney,
  formatFechaCorta,
  formatFechaLarga,
  pluralizar,
  calcularPrecioFinalConIva,
} from '@/lib/obra-totales'
import { EMPRESA_DEFAULT as EMPRESA } from '@/lib/constants'

/* ── Paleta corporativa ── */
const BRAND = '#C8852A' // Dorado del logo Lebaux (#FDC97D) oscurecido para AA sobre blanco
const TEXT_DARK = '#2B2B2B'
const TEXT_MUTED = '#4A4A4A'
const BORDER_SOFT = '#BFBFBF'
const BORDER_BRAND = BRAND
const RED_ALERT = '#D32F2F' // Rojo para avisos destacados

const styles = StyleSheet.create({
  /* ── Página ── */
  page: {
    fontFamily: 'Helvetica',
    color: TEXT_DARK,
    padding: 24,
    fontSize: 9,
    lineHeight: 1.3,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 7,
    borderBottomWidth: 0.75,
    borderBottomColor: BORDER_BRAND,
    marginBottom: 8,
  },
  headerLeft: { width: '45%', justifyContent: 'center' },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    width: '55%',
    gap: 1,
  },
  headerLogo: {
    width: 140,
    height: 36,
    objectFit: 'contain',
  },
  headerTitulo: {
    fontSize: 15.5,
    fontWeight: 'bold',
    color: BRAND,
    textAlign: 'right',
    letterSpacing: 0.4,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  headerSubtitulo: {
    fontSize: 8,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    textAlign: 'right',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerEmpresaDato: {
    fontSize: 8,
    color: TEXT_MUTED,
    textAlign: 'right',
  },
  headerNumeroLinea: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 4,
    color: TEXT_DARK,
  },

  /* ── Barra de sección ── */
  seccionBar: {
    fontSize: 8.5,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    color: TEXT_DARK,
    textTransform: 'uppercase',
    paddingVertical: 2,
    paddingHorizontal: 2,
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_BRAND,
  },
  filaCamposGrid: { flexDirection: 'row', gap: 16, marginBottom: 3 },
  columnaCampos: { flex: 1, gap: 3 },
  campo: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  campoLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: TEXT_DARK,
    width: 68,
  },
  campoValor: {
    fontSize: 8.5,
    color: TEXT_DARK,
    flex: 1,
  },

  /* ── Sección título ── */
  seccionTitulo: {
    fontSize: 9,
    fontWeight: 'bold',
    color: BRAND,
    paddingHorizontal: 2,
    paddingVertical: 3,
    marginTop: 7,
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_BRAND,
  },
  parrafo: {
    fontSize: 8.5,
    color: TEXT_DARK,
    textAlign: 'justify',
    marginBottom: 4,
    lineHeight: 1.3,
    paddingHorizontal: 2,
  },

  /* ── Tabla de elementos ── */
  tablaHeader: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: TEXT_DARK,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_BRAND,
  },
  tablaRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  colCantidad: {
    width: 34,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 9,
  },
  colDescripcion: { flex: 1, paddingHorizontal: 5, fontSize: 8.5 },
  colLinea: { width: 52, fontSize: 7.5, color: TEXT_MUTED },
  colColor: { width: 42, fontSize: 7.5, color: TEXT_MUTED },
  colPrecio: { width: 56, textAlign: 'right', fontSize: 8.5 },
  colTotal: {
    width: 56,
    textAlign: 'right',
    fontSize: 8.5,
    fontWeight: 'bold',
  },
  itemTitulo: { fontSize: 8.5, fontWeight: 'bold', marginBottom: 1 },
  itemSub: { fontSize: 7, color: TEXT_MUTED },

  /* ── Sub-totales inline (debajo de la tabla) ── */
  subtotalesBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 3,
    marginBottom: 3,
  },
  avisoIvaContainer: {
    flex: 1,
    marginRight: 12,
  },
  avisoIvaBox: {
    borderWidth: 0.75,
    borderColor: RED_ALERT,
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
  },
  avisoIvaEtiqueta: {
    fontSize: 8,
    fontWeight: 'bold',
    color: RED_ALERT,
    letterSpacing: 0.3,
  },
  avisoIvaMonto: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: RED_ALERT,
    marginTop: 1,
  },
  subtotalesTabla: {
    minWidth: 210,
    borderWidth: 0.5,
    borderColor: BORDER_SOFT,
    borderRadius: 3,
    padding: 5,
    gap: 2,
  },
  subtotalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
  },
  subtotalFilaDestacada: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9,
    fontWeight: 'bold',
    borderTopWidth: 0.5,
    borderTopColor: BORDER_SOFT,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: 1,
    borderRadius: 2,
  },

  /* ── Resumen del pago ── */
  pagoRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  pagoDestacadoBox: {
    flex: 1,
    borderRadius: 3,
    padding: 6,
  },
  pagoDestacadoLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: BRAND,
    letterSpacing: 0.4,
  },
  pagoDestacadoMonto: {
    fontSize: 15,
    fontWeight: 'bold',
    color: BRAND,
    marginTop: 2,
  },
  totalesResumenBox: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BORDER_SOFT,
    borderRadius: 3,
    padding: 6,
    gap: 2,
  },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8.5,
  },
  totalFilaDestacada: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9,
    fontWeight: 'bold',
    borderTopWidth: 0.5,
    borderTopColor: BORDER_SOFT,
    paddingHorizontal: 3,
    paddingVertical: 2,
    marginTop: 1,
    borderRadius: 2,
  },
  notaLegal: {
    fontSize: 8,
    color: TEXT_MUTED,
    lineHeight: 1.3,
    marginTop: 5,
    marginBottom: 2,
  },

  /* ── Condiciones / notas ── */
  notaDestacada: {
    fontSize: 8,
    fontWeight: 'bold',
    color: TEXT_DARK,
    borderLeftWidth: 2,
    borderLeftColor: BORDER_BRAND,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  bulletDot: {
    width: 10,
    fontSize: 8.5,
    color: BRAND,
    fontWeight: 'bold',
  },
  bulletText: {
    flex: 1,
    fontSize: 8,
    color: TEXT_DARK,
    textAlign: 'justify',
    lineHeight: 1.3,
  },
  notaAlerta: {
    borderLeftWidth: 2,
    borderLeftColor: TEXT_MUTED,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 3,
    marginBottom: 2,
  },
  notaAlertaTexto: {
    fontSize: 8,
    color: TEXT_DARK,
    textAlign: 'justify',
    lineHeight: 1.3,
  },

  /* ── Firmas ── */
  firmasRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 76,
    paddingHorizontal: 14,
  },
  firmaBox: {
    width: '42%',
    borderTopWidth: 0.5,
    borderTopColor: TEXT_DARK,
    paddingTop: 4,
    alignItems: 'center',
  },
  firmaRol: {
    fontSize: 7.5,
    color: TEXT_MUTED,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },

  piePagina: {
    position: 'absolute',
    bottom: 14,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 7.5,
    color: TEXT_MUTED,
    borderTopWidth: 0.5,
    borderTopColor: BORDER_SOFT,
    paddingTop: 4,
  },
})

/* ────────────── Sub-componentes ────────────── */

function Campo({ label, valor }: { label: string; valor?: string }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{label}:</Text>
      <Text style={styles.campoValor}>{valor || '—'}</Text>
    </View>
  )
}

function FilaElemento({
  descripcion,
  cantidad,
  linea,
  color,
  precioUnitario,
}: {
  descripcion: string
  cantidad: number
  linea: string
  color: string
  precioUnitario: number
}) {
  const total = (cantidad || 0) * (precioUnitario || 0)
  return (
    <View style={styles.tablaRow} wrap={false}>
      <Text style={styles.colCantidad}>{cantidad}</Text>
      <View style={styles.colDescripcion}>
        <Text style={styles.itemTitulo}>{descripcion || '—'}</Text>
        {precioUnitario > 0 ? (
          <Text style={styles.itemSub}>
            P. unit.: ${formatMoney(precioUnitario)}
          </Text>
        ) : null}
      </View>
      <Text style={styles.colLinea}>{linea}</Text>
      <Text style={styles.colColor}>{color}</Text>
      <Text style={styles.colPrecio}>
        {precioUnitario > 0 ? `$${formatMoney(precioUnitario)}` : '—'}
      </Text>
      <Text style={styles.colTotal}>
        {total > 0 ? `$${formatMoney(total)}` : '—'}
      </Text>
    </View>
  )
}

function SubtotalesBox({
  totales,
  obra,
  ivaBasePct,
}: {
  totales: TotalesObra
  obra: Obra
  ivaBasePct: number
}) {
  const mostrarPrecioConIva = !totales.incluyeIva && !!obra.mostrarPrecioConIva

  return (
    <View style={styles.subtotalesBox}>
      {/* Lado Izquierdo: Aviso destacado de Precio con IVA en rojo */}
      <View style={styles.avisoIvaContainer}>
        {mostrarPrecioConIva && (
          <View style={styles.avisoIvaBox}>
            <Text style={styles.avisoIvaEtiqueta}>
              AVISO — PRECIO CON IVA: $
              {formatMoney(
                calcularPrecioFinalConIva(
                  totales.totalConDescuento,
                  ivaBasePct,
                ),
              )}
            </Text>
          </View>
        )}
      </View>

      {/* Lado Derecho: Sub-totales tradicionales de la obra */}
      <View style={styles.subtotalesTabla}>
        <View style={styles.subtotalFila}>
          <Text>Total bruto:</Text>
          <Text>${formatMoney(totales.totalBruto)}</Text>
        </View>
        {totales.descuentoPct > 0 && (
          <View style={styles.subtotalFila}>
            <Text>Descuento ({Math.round(totales.descuentoPct * 100)}%):</Text>
            <Text>− ${formatMoney(totales.descuentoMonto)}</Text>
          </View>
        )}
        <View style={styles.subtotalFilaDestacada}>
          <Text>TOTAL OBRA:</Text>
          <Text>${formatMoney(totales.totalConDescuento)}</Text>
        </View>
      </View>
    </View>
  )
}

/* ────────────── Props ────────────── */

export interface ComprobantePdfProps {
  cliente: Cliente
  obra: Obra
  pago: Pago
  totales: TotalesObra
  /** IVA base del sistema (Ajustes), solo para calcular la línea
   * informativa "PRECIO CON IVA" cuando `obra.mostrarPrecioConIva` está
   * activo y la obra no discrimina IVA. */
  ivaBasePct?: number
}

/* ────────────── Documento ────────────── */

export function ComprobantePdfLayout({
  cliente,
  obra,
  pago,
  totales,
  ivaBasePct = 0,
}: ComprobantePdfProps) {
  const nombreCliente = cliente.nombre || '_______________'
  const localidad = 'San Miguel de Tucumán, Tucumán'
  const cantidadTotal = obra.tipologias.reduce(
    (acc, t) => acc + (t.cantidad || 0),
    0,
  )
  const nroReciboStr = String(pago.numeroRecibo).padStart(4, '0')

  return (
    <Document
      title={`Recibo y Condiciones de Entrega N° ${nroReciboStr} — ${cliente.nombre}`}
      author={EMPRESA.nombre}
      subject="Recibo y condiciones de entrega de obra"
      creator={EMPRESA.nombre}
    >
      <Page
        size="A4"
        style={styles.page}
        aria-label={`Recibo y Condiciones de Entrega, cliente ${cliente.nombre}`}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={{ fontSize: 0.01, color: '#FFFFFF' }}>
              {EMPRESA.nombre} — {EMPRESA.rubro}
            </Text>
            <Image src="/logo.png" style={styles.headerLogo} />
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitulo}>Recibo y Condiciones</Text>
            <Text style={styles.headerSubtitulo}>de Entrega</Text>
            <Text style={styles.headerEmpresaDato}>{EMPRESA.nombre}</Text>
            <Text style={styles.headerEmpresaDato}>{EMPRESA.direccion}</Text>
            <Text style={styles.headerEmpresaDato}>
              Tel: {EMPRESA.telefono}
            </Text>
            <Text style={styles.headerNumeroLinea}>
              RECIBO N°: {nroReciboStr} · FECHA: {formatFechaCorta(pago.fecha)}
            </Text>
          </View>
        </View>

        {/* Datos del cliente + obra */}
        <Text style={styles.seccionBar}>Datos del cliente y la obra</Text>
        <View style={styles.filaCamposGrid}>
          <View style={styles.columnaCampos}>
            <Campo label="FECHA" valor={formatFechaLarga(obra.fecha)} />
            <Campo label="CLIENTE" valor={cliente.nombre} />
            <Campo label="TELEFONO" valor={cliente.telefonoWhatsApp} />
          </View>
          <View style={styles.columnaCampos}>
            <Campo label="LOCALIDAD" valor={localidad} />
            <Campo
              label="FORMA DE PAGO"
              valor={pago.formaPago || obra.formaPago || '—'}
            />
          </View>
        </View>

        {/* Objeto del recibo */}
        <Text style={styles.seccionTitulo}>1. Objeto del recibo</Text>
        <Text style={styles.parrafo}>
          Por medio de la presente, se deja constancia formal de la entrega y
          recepción de las estructuras que se detallan a continuación, junto con
          el pago recibido por dicho concepto. El receptor declara haber
          verificado y constatado el correcto estado estético, estructural y el
          funcionamiento óptimo de cada uno de los componentes al momento de su
          recepción física.
        </Text>

        {/* Detalle de elementos entregados */}
        <Text style={styles.seccionTitulo}>
          2. Detalle de los elementos entregados
        </Text>
        <View style={styles.tablaHeader}>
          <Text style={styles.colCantidad}>Cant.</Text>
          <Text style={styles.colDescripcion}>Descripción de la Abertura</Text>
          <Text style={styles.colLinea}>Línea</Text>
          <Text style={styles.colColor}>Color</Text>
          <Text style={styles.colPrecio}>P. Unit</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>
        {obra.tipologias.map((t) => (
          <FilaElemento
            key={t.id}
            descripcion={t.descripcion}
            cantidad={t.cantidad}
            linea={t.linea}
            color={t.color}
            precioUnitario={t.precioUnitario}
          />
        ))}

        <Text style={styles.parrafo}>
          El cliente {nombreCliente} recibe en conformidad la totalidad de las{' '}
          {cantidadTotal} {pluralizar(cantidadTotal, 'abertura', 'aberturas')},
          habiendo realizado las pruebas pertinentes de apertura, cierre y
          encuadre en presencia del personal técnico encargado del transporte y
          entrega.
        </Text>

        {/* Sub-totales de la obra (incluye el aviso de IVA a la izquierda) */}
        <SubtotalesBox totales={totales} obra={obra} ivaBasePct={ivaBasePct} />

        {/* Resumen del pago */}
        <Text style={styles.seccionTitulo}>3. Resumen del pago recibido</Text>
        <View style={styles.pagoRow} wrap={false}>
          <View style={styles.pagoDestacadoBox}></View>
          <View style={styles.totalesResumenBox}>
            <View style={styles.totalFila}>
              <Text>TOTAL ABONADO A LA FECHA:</Text>
              <Text>${formatMoney(totales.totalAbonado)}</Text>
            </View>
            <View style={styles.totalFilaDestacada}>
              <Text>SALDO PENDIENTE:</Text>
              <Text>${formatMoney(totales.saldoPendiente)}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.notaLegal}>
          * Este documento sirve como comprobante oficial del pago recibido en
          la fecha indicada. El saldo pendiente se actualiza en función de todos
          los pagos registrados sobre esta obra.
          {pago.nota ? `\n\nNota del pago: ${pago.nota}` : ''}
          {obra.notaCliente ? `\n\nNota: ${obra.notaCliente}` : ''}
        </Text>

        {/* Condiciones técnicas */}
        <Text style={styles.seccionTitulo}>
          4. Condiciones técnicas y cobertura del servicio
        </Text>
        <Text style={styles.notaDestacada}>
          IMPORTANTE: NO NOS HACEMOS CARGO DE VANOS EN FALSA ESCUADRA.
        </Text>

        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={{ fontWeight: 'bold' }}>Instalación técnica:</Text> Se
            realizan exclusivamente colocaciones en seco.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={{ fontWeight: 'bold' }}>Exclusiones de obra:</Text> No
            se realizan trabajos de mampostería ni albañilería.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={{ fontWeight: 'bold' }}>Sellado perimetral:</Text> Se
            realiza con silicona neutra y poliuretano expandido hasta un máximo
            de 1 cm. Terminaciones estéticas posteriores corren por cuenta del
            cliente.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={{ fontWeight: 'bold' }}>Límite de garantía:</Text> La
            cobertura no contempla la rotura posterior de los vidrios.
          </Text>
        </View>

        <View style={styles.notaAlerta} wrap={false}>
          <Text style={styles.notaAlertaTexto}>
            <Text style={{ fontWeight: 'bold' }}>
              OBSERVACIÓN — PAÑOS FIJOS:
            </Text>{' '}
            La empresa no se responsabiliza por paños fijos instalados por
            terceros. La región del NOA es propensa a movimientos sísmicos, por
            lo que resulta imperativo el correcto emplazamiento de los zócalos
            para prevenir tensiones que comprometan la integridad del cristal.
          </Text>
        </View>

        {/* Firmas */}
        <View style={styles.firmasRow} wrap={false}>
          <View style={styles.firmaBox}>
            <Text style={styles.firmaRol}>D.N.I. / Firma del Receptor</Text>
          </View>
          <View style={styles.firmaBox}>
            <Text style={styles.firmaRol}>Firma Autorizada / Responsable</Text>
          </View>
        </View>

        <Text
          style={styles.piePagina}
          render={() => 'Recibo y Condiciones de Entrega'}
          fixed
        />
      </Page>
    </Document>
  )
}

export default ComprobantePdfLayout
