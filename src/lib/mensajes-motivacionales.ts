/**
 * lib/mensajes-motivacionales.ts — Mensajes diarios para la bienvenida.
 *
 * El catálogo vive localmente para que Inicio funcione igual con mala señal y
 * no dependa del costo, disponibilidad ni tono impredecible de una API externa.
 * La selección usa fecha + usuario: cambia cada día, pero no salta de mensaje
 * cada vez que React vuelve a renderizar la pantalla.
 */
const MENSAJES_MOTIVACIONALES = [
  'Cada nuevo día es una oportunidad para avanzar, crecer y hacer la diferencia.',
  'Los grandes resultados nacen de pequeños pasos bien hechos.',
  'La constancia de hoy construye las oportunidades de mañana.',
  'Cada conversación puede ser el comienzo de una gran relación.',
  'Avanzar con claridad hace que cada esfuerzo cuente.',
  'Un buen seguimiento transforma el interés en confianza.',
  'La excelencia se construye cuidando cada detalle.',
  'Hoy es un buen día para convertir planes en resultados.',
  'La confianza del cliente empieza con una atención sincera.',
  'Cada tarea terminada acerca un poco más a la meta.',
  'Organizar el día es darle dirección al esfuerzo.',
  'Las mejores oportunidades aparecen cuando estamos preparados.',
  'Escuchar con atención es el primer paso para ofrecer una solución.',
  'La paciencia y la constancia también forman parte del progreso.',
  'Un paso firme vale más que muchas intenciones.',
  'Cada cliente bien atendido fortalece el camino recorrido.',
  'La calidad de hoy es la recomendación de mañana.',
  'Los desafíos son oportunidades para encontrar mejores soluciones.',
  'Empezar con energía es importante; continuar con constancia, aún más.',
  'El progreso se nota cuando cada día hacemos algo un poco mejor.',
  'Una respuesta clara puede marcar la diferencia para un cliente.',
  'Las metas grandes se alcanzan resolviendo bien lo que tenemos delante.',
  'Hoy puede ser el día de ese próximo gran acuerdo.',
  'La dedicación convierte una buena idea en un resultado concreto.',
  'Cada seguimiento pendiente es una nueva oportunidad de conectar.',
  'Trabajar con orden deja más espacio para crear oportunidades.',
  'Una buena experiencia permanece mucho después de cerrar una venta.',
  'El compromiso diario es la base de los resultados duraderos.',
  'Conocer la necesidad del cliente nos acerca a la mejor respuesta.',
  'La mejora continua empieza con una decisión sencilla: avanzar.',
  'Cada jornada trae una oportunidad distinta para superarnos.',
  'La confianza se gana con coherencia, atención y buenos resultados.',
  'Lo importante no es hacerlo todo hoy, sino avanzar en lo importante.',
  'Cada detalle cuidado habla del valor de nuestro trabajo.',
  'Una actitud positiva abre caminos que antes no veíamos.',
  'Los buenos resultados comienzan con prioridades claras.',
  'Hoy tenemos una nueva oportunidad para hacer un trabajo memorable.',
  'La perseverancia convierte los objetivos en logros.',
  'Resolver con amabilidad también es una forma de excelencia.',
  'El mejor momento para dar el siguiente paso es ahora.',
  'Cada avance merece ser reconocido y cada desafío, aprovechado.',
  'El crecimiento sostenido nace del trabajo consciente de cada día.',
  'Una gestión clara transmite seguridad y construye confianza.',
  'Las oportunidades crecen cuando cuidamos las relaciones.',
  'Hacerlo simple, claro y bien siempre deja una buena impresión.',
  'El entusiasmo abre la puerta; la constancia mantiene el camino.',
  'Cada día bien aprovechado suma valor al proyecto que construimos.',
  'La atención genuina convierte clientes en relaciones duraderas.',
] as const

export function obtenerMensajeMotivacional(
  fecha: Date,
  semillaUsuario = '',
): string {
  const dia = `${fecha.getFullYear()}-${fecha.getMonth() + 1}-${fecha.getDate()}`
  const semilla = `${dia}:${semillaUsuario}`
  let indice = 0

  for (const caracter of semilla) {
    indice = (indice * 31 + caracter.charCodeAt(0)) % MENSAJES_MOTIVACIONALES.length
  }

  return MENSAJES_MOTIVACIONALES[indice]
}
