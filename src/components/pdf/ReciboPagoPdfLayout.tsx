/**
 * components/pdf/ReciboPagoPdfLayout.tsx
 *
 * PDF de una SOLA página: Comprobante de Pago individual.
 * (Antes llamado "Recibo de Pago"; se renombró a "Comprobante de Pago"
 * para no confundirse con el nuevo documento combinado "Recibo y
 * Condiciones de Entrega", que fusiona el acta y el pago en una hoja.)
 * Se usa para pagos posteriores al inicial (cuando las condiciones de
 * entrega ya fueron entregadas y no hace falta reimprimirlas).
 *
 * OPTIMIZACIONES APLICADAS (versión 2 — impresión económica + accesibilidad):
 *
 *   1. AHORRO DE TINTA
 *      · Se eliminan las 3 barras grises sólidas (GRAY_BAR #6B6B6B) que
 *        imprimían un rectángulo por cada sección. Ahora es solo texto bold
 *        en mayúsculas + una línea fina de 0.5 pt en color marca debajo.
 *      · Se elimina el fondo #f2f2f2 del encabezado de tabla y de la fila
 *        destacada "SALDO PENDIENTE". Se reemplaza por negrita + borde sup.
 *      · Se elimina el fondo BRAND_SOFT del monto destacado — se reemplaza
 *        por borde fino color marca + texto bold color marca.
 *      · Se elimina el subrayado gris (borderBottomWidth 0.5) que tenía
 *        cada campoValor — era tinta innecesaria que ensuciaba la lectura.
 *      · Se elimina el borde inferior de cada fila de la tabla — la
 *        separación la da el padding vertical.
 *      · Se reduce el grosor de los bordes de los badges de 0.75 → 0.5 pt.
 *      · Se reduce el borderBottomWidth del header de 1.5 → 0.75 pt.
 *
 *   2. OPTIMIZACIÓN DE ESPACIO
 *      · Padding de página 34 → 26 pt (−24 %, mantiene margen de impresión).
 *      · Padding vertical de fila de tabla 8 → 5 pt.
 *      · Tamaños del logo 150×74 → 130×58 (libera ~16 pt de altura).
 *      · Margins de sección marginTop 14 → 10, marginBottom 10 → 6.
 *      · Bloque de firmas reorganizado bajo la nota legal.
 *
 *   3. ACCESIBILIDAD
 *      · TEXT_MUTED #666666 → #4A4A4A (contraste AAA sobre blanco).
 *      · Tamaño mínimo de fuente: 7.5 → 8 pt (nota legal).
 *      · El Document lleva title/author/subject para que los lectores de
 *        pantalla y los visores de PDF identifiquen el contenido.
 *      · Texto adyacente al logo con el nombre de la empresa, ya que el
 *        Image de @react-pdf/renderer no soporta alt.
 *      · El estado del saldo se transmite con texto ("SALDO PENDIENTE")
 *        y no solo con color — accesible para daltónicos.
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
  redondearMoneda,
} from '@/lib/obra-totales'
import { EMPRESA_DEFAULT as EMPRESA } from '@/lib/constants'

const BRAND = '#C8852A' // Dorado del logo Lebaux (#FDC97D) oscurecido para AA sobre blanco
const TEXT_DARK = '#2B2B2B'
// Mejor contraste AAA sobre blanco (antes #666666).
const TEXT_MUTED = '#4A4A4A'
const BORDER_SOFT = '#BFBFBF'
const BORDER_BRAND = BRAND

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    color: TEXT_DARK,
    // Padding reducido 34 → 26 pt.
    padding: 26,
    fontSize: 9,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 8,
    // Borde inferior del header reducido de 1.5 → 0.75 pt.
    borderBottomWidth: 0.75,
    borderBottomColor: BORDER_BRAND,
  },
  // Logo completo (rectangular): 140×36.
  logo: {
    height: 36,
    width: 140,
    objectFit: 'contain',
    objectPosition: 'left center',
    marginBottom: 4,
  },
  empresaDato: { fontSize: 8, color: TEXT_MUTED, marginTop: 2 },
  tituloDoc: {
    fontSize: 17,
    fontWeight: 'bold',
    color: TEXT_DARK,
    textAlign: 'right',
    letterSpacing: 0.3,
  },
  subtituloDoc: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: BRAND,
    textAlign: 'right',
    letterSpacing: 0.6,
    marginTop: 3,
  },
  numeroLinea: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 8,
    color: TEXT_DARK,
  },
  fechaLinea: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 2,
    color: TEXT_DARK,
  },
  /* ── Barra de sección — sin fondo gris, solo tipografía + línea fina ── */
  seccionBar: {
    fontSize: 8.5,
    fontWeight: 'bold',
    letterSpacing: 0.6,
    color: TEXT_DARK,
    textTransform: 'uppercase',
    paddingVertical: 3,
    paddingHorizontal: 2,
    // Reducido: 14 → 10 (top), 10 → 6 (bottom).
    marginTop: 10,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_BRAND,
  },
  filaCamposGrid: { flexDirection: 'row', gap: 24 },
  columnaCampos: { flex: 1, gap: 6 },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  campoLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: TEXT_DARK,
    width: 78,
  },
  // Sin el subrayado gris que tenía antes — lee más limpio y ahorra tinta.
  campoValor: {
    fontSize: 8.5,
    color: TEXT_DARK,
    flex: 1,
  },
  // Encabezado de tabla sin fondo #f2f2f2 — solo negrita + borde inferior fino.
  tablaHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: TEXT_DARK,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_BRAND,
  },
  // Filas sin borde inferior — la separación la da el padding vertical.
  filaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  colDescripcion: { flex: 1 },
  colUnidades: { width: 60, textAlign: 'center' },
  colTotal: { width: 80, textAlign: 'right' },
  itemTitulo: { fontSize: 9.5, fontWeight: 'bold', marginBottom: 3 },
  badgesRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  // Badge con borde más fino: 0.75 → 0.5 pt.
  badge: {
    fontSize: 7.5,
    borderWidth: 0.5,
    borderColor: BORDER_BRAND,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    color: TEXT_DARK,
  },
  badgeLabel: { fontWeight: 'bold' },
  itemUnidades: { fontSize: 10, fontWeight: 'bold' },
  itemTotal: { fontSize: 9.5, fontWeight: 'bold' },

  // Footer más compacto: marginTop 22 → 16.
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  // Contenedor izquierdo para la nota legal y el sello
  footerLeftColumn: {
    width: '46%',
    flexDirection: 'column',
  },
  // Nota legal con tamaño mínimo 8 pt (antes 7.5).
  notaLegal: {
    fontSize: 8,
    color: TEXT_MUTED,
    lineHeight: 1.4,
  },
  // Estilo para el sello de la empresa bajo la nota legal
  firmaBox: {
    width: 140,
    borderTopWidth: 0.5,
    borderTopColor: TEXT_DARK,
    paddingTop: 4,
    marginLeft: 35,
    marginTop: 60, // Espaciado entre la nota legal y el sello
    textAlign: 'center',
    fontSize: 8,
    fontWeight: 'bold',
  },
  // Box de totales con borde fino, sin fondos internos.
  totalesBox: {
    minWidth: 210,
    gap: 3,
    borderWidth: 0.5,
    borderColor: BORDER_SOFT,
    borderRadius: 3,
    padding: 7,
  },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9,
  },
  // El monto destacado ahora es SOLO borde + texto bold en color marca,
  // sin el fondo BRAND_SOFT.
  pagoDestacadoBox: {
    borderWidth: 0.5,
    borderColor: BORDER_BRAND,
    borderRadius: 3,
    padding: 7,
    marginBottom: 3,
  },
  pagoDestacadoLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: BRAND,
    letterSpacing: 0.5,
  },
  pagoDestacadoMonto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BRAND,
    marginTop: 2,
  },
  pagoDestacadoSub: {
    fontSize: 7.5,
    color: TEXT_MUTED,
    marginTop: 1,
  },
  // Fila destacada "SALDO PENDIENTE" sin fondo #f2f2f2 — solo negrita +
  // borde superior fino.
  totalFilaDestacada: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9.5,
    fontWeight: 'bold',
    color: TEXT_DARK,
    borderTopWidth: 0.5,
    borderTopColor: BORDER_SOFT,
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginTop: 3,
    borderRadius: 2,
  },
})

function Campo({ label, valor }: { label: string; valor?: string }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{label}:</Text>
      <Text style={styles.campoValor}>{valor || ''}</Text>
    </View>
  )
}

function FilaTipologia({
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
  const titulo = descripcion?.trim() || 'Abertura'
  return (
    <View style={styles.filaItem} wrap={false}>
      <View style={styles.colDescripcion}>
        <Text style={styles.itemTitulo}>{titulo}</Text>
        <View style={styles.badgesRow}>
          <Text style={styles.badge}>
            <Text style={styles.badgeLabel}>Línea: </Text>
            {linea}
          </Text>
          <Text style={styles.badge}>
            <Text style={styles.badgeLabel}>Color: </Text>
            {color}
          </Text>
          {precioUnitario > 0 && (
            <Text style={styles.badge}>
              <Text style={styles.badgeLabel}>P. Unit: </Text>$
              {formatMoney(precioUnitario)}
            </Text>
          )}
        </View>
      </View>
      <Text style={[styles.colUnidades, styles.itemUnidades]}>{cantidad}</Text>
      <Text style={[styles.colTotal, styles.itemTotal]}>
        ${formatMoney(redondearMoneda(cantidad * precioUnitario))}
      </Text>
    </View>
  )
}

interface Props {
  cliente: Cliente
  obra: Obra
  pago: Pago
  totales: TotalesObra
}

export function ReciboPagoPdfLayout({ cliente, obra, pago, totales }: Props) {
  const nroReciboStr = String(pago.numeroRecibo).padStart(4, '0')
  return (
    <Document
      title={`Comprobante de Pago N° ${nroReciboStr} — ${cliente.nombre}`}
      author={EMPRESA.nombre}
      subject="Comprobante de pago"
      creator={EMPRESA.nombre}
    >
      <Page
        size="A4"
        style={styles.page}
        aria-label={`Comprobante de Pago N° ${nroReciboStr} — Cliente ${cliente.nombre}`}
      >
        {/* ── ENCABEZADO ── */}
        <View style={styles.headerBar}>
          <View>
            {/* Texto adyacente al logo para lectores de pantalla. */}
            <Text style={{ fontSize: 0.01, color: '#FFFFFF' }}>
              {EMPRESA.nombre} — {EMPRESA.rubro}
            </Text>
            {/* Image es un primitivo de @react-pdf/renderer, no un <img> HTML */}
            <Image src="/logo.png" style={styles.logo} />
            <Text style={styles.empresaDato}>{EMPRESA.direccion}</Text>
            <Text style={styles.empresaDato}>
              {EMPRESA.telefono} · {EMPRESA.email}
            </Text>
          </View>

          {/* Aplicamos alignItems: 'flex-end' para alinear por completo los campos a la derecha */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.tituloDoc}>COMPROBANTE DE PAGO</Text>
            <Text style={styles.subtituloDoc}>CONSTANCIA DE PAGO</Text>
            <Text style={styles.numeroLinea}>RECIBO N°: {nroReciboStr}</Text>
            <Text style={styles.fechaLinea}>
              FECHA: {formatFechaCorta(pago.fecha)}
            </Text>
          </View>
        </View>

        {/* ── DATOS DEL CLIENTE ── */}
        <Text style={styles.seccionBar}>Datos del cliente</Text>
        <View style={styles.filaCamposGrid}>
          <View style={styles.columnaCampos}>
            <Campo label="CLIENTE" valor={cliente.nombre} />
            {/* Se reemplazó "WHATSAPP" por "TELÉFONO" */}
            <Campo label="TELÉFONO" valor={cliente.telefonoWhatsApp} />
          </View>
          <View style={styles.columnaCampos}>
            <Campo label="FORMA DE PAGO" valor={pago.formaPago || '-'} />
          </View>
        </View>

        {/* ── DETALLE DE LA OBRA ── */}
        <Text style={styles.seccionBar}>Detalle de productos / servicios</Text>
        <View style={styles.tablaHeader}>
          <Text style={styles.colDescripcion}>Descripción del ítem</Text>
          <Text style={styles.colUnidades}>Unidades</Text>
          <Text style={styles.colTotal}>Total ($)</Text>
        </View>
        {obra.tipologias.map((t) => (
          <FilaTipologia
            key={t.id}
            descripcion={t.descripcion}
            cantidad={t.cantidad}
            linea={t.linea}
            color={t.color}
            precioUnitario={t.precioUnitario}
          />
        ))}

        {/* ── PAGO REGISTRADO + TOTALES Y SELLO ── */}
        <View style={styles.footerRow}>
          {/* Columna izquierda con nota legal y sello de empresa */}
          <View style={styles.footerLeftColumn}>
            <Text style={styles.notaLegal}>
              * Este documento sirve como comprobante oficial del pago recibido
              en la fecha indicada. El saldo pendiente se actualiza en función
              de todos los pagos registrados sobre esta obra.
              {pago.nota ? `\n\nNota: ${pago.nota}` : ''}
            </Text>

            {/* Sello de la empresa ubicado directamente debajo de la nota */}
            <Text style={styles.firmaBox}>SELLO DE LA EMPRESA</Text>
          </View>

          <View style={styles.totalesBox}>
            <View style={styles.pagoDestacadoBox}>
              <Text style={styles.pagoDestacadoLabel}>MONTO DE ESTE PAGO</Text>
              <Text style={styles.pagoDestacadoMonto}>
                ${formatMoney(pago.monto)}
              </Text>
              {(pago.formaPago === 'Tarjeta' || pago.formaPago === 'Cheque') &&
                pago.montoBase != null &&
                pago.montoBase < pago.monto && (
                  <Text style={styles.pagoDestacadoSub}>
                    Incluye recargo por{' '}
                    {pago.formaPago === 'Tarjeta' ? 'tarjeta' : 'cheque (IVA)'} · Se descuenta $
                    {formatMoney(pago.montoBase)} del saldo
                  </Text>
                )}
            </View>
            <View style={styles.totalFila}>
              <Text>TOTAL DE LA OBRA:</Text>
              <Text>${formatMoney(totales.totalConDescuento)}</Text>
            </View>
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
      </Page>
    </Document>
  )
}

export default ReciboPagoPdfLayout
