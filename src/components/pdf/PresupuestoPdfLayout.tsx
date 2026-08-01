/**
 * components/pdf/PresupuestoPdfLayout.tsx
 *
 * PDF de UNA SOLA PÁGINA: Presupuesto de obra.
 *
 * Contenido:
 *   · Header (logo + empresa + título "PRESUPUESTO")
 *   · Datos del cliente y fecha
 *   · Estado del presupuesto (borrador/enviado/aceptado/rechazado) + vencimiento
 *   · Tabla de aberturas (descripción, cantidad, precio unit., subtotal)
 *   · Sub-totales (bruto, descuento, total)
 *   · Condiciones del presupuesto (validez, forma de pago)
 *   · Datos de contacto de la empresa
 *
 * Estilo consistente con ComprobantePdfLayout (ahorro de tinta, AA contrast).
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { Cliente, Obra, TotalesObra } from '@/lib/types'
import {
  formatMoney,
  formatFechaCorta,
  formatFechaLarga,
  redondearMoneda,
} from '@/lib/obra-totales'
import { EMPRESA_DEFAULT } from '@/lib/constants'

/* ── Paleta ── */
const BRAND = '#C8852A' // Dorado del logo Lebaux (#FDC97D) oscurecido para AA sobre blanco
const TEXT_DARK = '#2B2B2B'
const TEXT_MUTED = '#4A4A4A'
const BORDER_SOFT = '#BFBFBF'
const BORDER_BRAND = BRAND

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    color: TEXT_DARK,
    padding: 24,
    fontSize: 9,
    lineHeight: 1.3,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 7,
    borderBottomWidth: 0.75,
    borderBottomColor: BORDER_BRAND,
    marginBottom: 10,
  },
  headerLeft: { width: '45%', justifyContent: 'center' },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    width: '55%',
    gap: 1,
  },
  headerLogo: { width: 140, height: 36, objectFit: 'contain' },
  headerTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: BRAND,
    textAlign: 'right',
    letterSpacing: 0.6,
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
  headerEmpresaDato: { fontSize: 8, color: TEXT_MUTED, textAlign: 'right' },
  headerNumeroLinea: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 4,
    color: TEXT_DARK,
  },

  /* Estado del presupuesto — caja destacada */
  estadoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 0.75,
    borderColor: BORDER_BRAND,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 8,
  },
  estadoLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  estadoValor: {
    fontSize: 11,
    fontWeight: 'bold',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vencimientoText: {
    fontSize: 8,
    color: TEXT_MUTED,
  },

  /* Sección bar */
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
  filaCamposGrid: { flexDirection: 'row', gap: 16, marginBottom: 6 },
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

  /* Tabla */
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

  /* Sub-totales */
  subtotalesBox: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 8,
  },
  subtotalesTabla: {
    minWidth: 220,
    borderWidth: 0.5,
    borderColor: BORDER_SOFT,
    borderRadius: 3,
    padding: 6,
    gap: 2,
  },
  subtotalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8.5,
  },
  subtotalFilaDestacada: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 11,
    fontWeight: 'bold',
    color: BRAND,
    borderTopWidth: 0.5,
    borderTopColor: BORDER_SOFT,
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginTop: 2,
    borderRadius: 2,
  },

  /* Condiciones */
  seccionTitulo: {
    fontSize: 9,
    fontWeight: 'bold',
    color: BRAND,
    paddingHorizontal: 2,
    paddingVertical: 3,
    marginTop: 8,
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_BRAND,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 3,
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

  /* Contacto */
  contactoBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 0.5,
    borderColor: BORDER_SOFT,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 8,
    gap: 14,
  },
  contactoItem: { flexDirection: 'column', alignItems: 'center', gap: 1 },
  contactoLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  contactoValor: {
    fontSize: 8.5,
    color: TEXT_DARK,
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
  precioUnitarioAjustado,
}: {
  descripcion: string
  cantidad: number
  linea: string
  color: string
  precioUnitario: number
  /** Precio unitario ya "completado" al IVA base (solo cuando
   * `incluyeIva` está activo) — reemplaza al precio unitario original
   * en la vista, no se muestra por separado. */
  precioUnitarioAjustado?: number
}) {
  const precioAMostrar = precioUnitarioAjustado ?? precioUnitario
  const total = (cantidad || 0) * (precioAMostrar || 0)
  return (
    <View style={styles.tablaRow} wrap={false}>
      <Text style={styles.colCantidad}>{cantidad}</Text>
      <View style={styles.colDescripcion}>
        <Text style={styles.itemTitulo}>{descripcion || '—'}</Text>
        {precioAMostrar > 0 ? (
          <Text style={styles.itemSub}>
            P. unit.: ${formatMoney(precioAMostrar)}
          </Text>
        ) : null}
      </View>
      <Text style={styles.colLinea}>{linea}</Text>
      <Text style={styles.colColor}>{color}</Text>
      <Text style={styles.colPrecio}>
        {precioAMostrar > 0 ? `$${formatMoney(precioAMostrar)}` : '—'}
      </Text>
      <Text style={styles.colTotal}>
        {total > 0 ? `$${formatMoney(total)}` : '—'}
      </Text>
    </View>
  )
}

/* ────────────── Props ────────────── */

export interface PresupuestoPdfProps {
  cliente: Cliente
  obra: Obra
  totales: TotalesObra
  /** Datos de empresa (opcional, default a EMPRESA_DEFAULT). */
  empresa?: typeof EMPRESA_DEFAULT
}

/* ────────────── Documento ────────────── */

export function PresupuestoPdfLayout({
  cliente,
  obra,
  totales,
  empresa = EMPRESA_DEFAULT,
}: PresupuestoPdfProps) {
  return (
    <Document
      title={`Presupuesto — ${cliente.nombre}`}
      author={empresa.nombre}
      subject="Presupuesto de obra"
      creator={empresa.nombre}
    >
      <Page
        size="A4"
        style={styles.page}
        aria-label={`Presupuesto para ${cliente.nombre}`}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={{ fontSize: 0.01, color: '#FFFFFF' }}>
              {empresa.nombre} — {empresa.rubro}
            </Text>
            {/* Image es un primitivo de @react-pdf/renderer, no un <img> HTML */}
            <Image src="/logo.png" style={styles.headerLogo} />
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitulo}>Presupuesto</Text>
            <Text style={styles.headerSubtitulo}>{empresa.rubro}</Text>
            <Text style={styles.headerEmpresaDato}>{empresa.nombre}</Text>
            <Text style={styles.headerEmpresaDato}>{empresa.direccion}</Text>
            <Text style={styles.headerEmpresaDato}>
              Tel: {empresa.telefono}
            </Text>
            <Text style={styles.headerNumeroLinea}>
              FECHA: {formatFechaCorta(obra.fecha)}
            </Text>
          </View>
        </View>

        {/* Datos del cliente */}
        <Text style={styles.seccionBar}>Datos del cliente</Text>
        <View style={styles.filaCamposGrid}>
          <View style={styles.columnaCampos}>
            <Campo label="FECHA" valor={formatFechaLarga(obra.fecha)} />
            <Campo label="CLIENTE" valor={cliente.nombre} />
          </View>
          <View style={styles.columnaCampos}>
            <Campo label="WHATSAPP" valor={cliente.telefonoWhatsApp} />
            <Campo
              label="FORMA DE PAGO"
              valor={obra.formaPago || 'A convenir'}
            />
          </View>
        </View>

        {/* Detalle de aberturas */}
        <Text style={styles.seccionBar}>Detalle de aberturas</Text>
        <View style={styles.tablaHeader}>
          <Text style={styles.colCantidad}>Cant.</Text>
          <Text style={styles.colDescripcion}>Descripción</Text>
          <Text style={styles.colLinea}>Línea</Text>
          <Text style={styles.colColor}>Color</Text>
          <Text style={styles.colPrecio}>P. Unit</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>
        {obra.tipologias.map((t) => {
          const desglose = totales.desgloseItems.find((d) => d.tipologiaId === t.id)
          const precioUnitarioAjustado =
            totales.incluyeIva && desglose && t.cantidad > 0
              ? redondearMoneda(desglose.totalAjustado / t.cantidad)
              : undefined
          return (
            <FilaElemento
              key={t.id}
              descripcion={t.descripcion}
              cantidad={t.cantidad}
              linea={t.linea}
              color={t.color}
              precioUnitario={t.precioUnitario}
              precioUnitarioAjustado={precioUnitarioAjustado}
            />
          )
        })}

        {/* Sub-totales */}
        <View style={styles.subtotalesBox}>
          <View style={styles.subtotalesTabla}>
            <View style={styles.subtotalFila}>
              <Text>Total bruto:</Text>
              <Text>
                ${formatMoney(totales.incluyeIva ? totales.totalAjustadoIva : totales.totalBruto)}
              </Text>
            </View>
            {totales.descuentoPct > 0 && (
              <View style={styles.subtotalFila}>
                <Text>
                  Descuento ({Math.round(totales.descuentoPct * 100)}%):
                </Text>
                <Text>− ${formatMoney(totales.descuentoMonto)}</Text>
              </View>
            )}
            {totales.incluyeIva && (
              <>
                <View style={styles.subtotalFila}>
                  <Text>Precio base (neto):</Text>
                  <Text>${formatMoney(totales.totalBaseConDescuento)}</Text>
                </View>
                <View style={styles.subtotalFila}>
                  <Text>IVA ({Math.round(totales.ivaPct * 1000) / 10}%):</Text>
                  <Text>+ ${formatMoney(totales.ivaMonto)}</Text>
                </View>
              </>
            )}
            <View style={styles.subtotalFilaDestacada}>
              <Text>TOTAL:</Text>
              <Text>${formatMoney(totales.totalConIva)}</Text>
            </View>
          </View>
        </View>

        {/* Condiciones */}
        <Text style={styles.seccionTitulo}>Condiciones del presupuesto</Text>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={{ fontWeight: 'bold' }}>Forma de pago:</Text>{' '}
            {obra.formaPago || 'A convenir con el vendedor'}.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={{ fontWeight: 'bold' }}>Instalación:</Text> Colocación
            en seco exclusivamente. No incluye trabajos de mampostería ni
            albañilería. Sellado perimetral con silicona neutra y poliuretano
            expandido hasta 1 cm.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={{ fontWeight: 'bold' }}>Garantía:</Text> No se
            responsabiliza por paños fijos instalados por terceros ni por rotura
            posterior de vidrios. IMPORTANTE: No nos hacemos cargo de vanos en
            falsa escuadra.
          </Text>
        </View>

        {/* Contacto */}
        <View style={styles.contactoBox}>
          <View style={styles.contactoItem}>
            <Text style={styles.contactoLabel}>Teléfono</Text>
            <Text style={styles.contactoValor}>{empresa.telefono}</Text>
          </View>
          <View style={styles.contactoItem}>
            <Text style={styles.contactoLabel}>Email</Text>
            <Text style={styles.contactoValor}>{empresa.email}</Text>
          </View>
          <View style={styles.contactoItem}>
            <Text style={styles.contactoLabel}>Domicilio</Text>
            <Text style={styles.contactoValor}>{empresa.direccion}</Text>
          </View>
        </View>

        <Text
          style={styles.piePagina}
          render={() => `Presupuesto · ${empresa.nombre}`}
          fixed
        />
      </Page>
    </Document>
  )
}

export default PresupuestoPdfLayout
