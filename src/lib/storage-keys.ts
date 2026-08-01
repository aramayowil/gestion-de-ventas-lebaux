/**
 * lib/storage-keys.ts — Claves de localStorage usadas por los stores.
 *
 * Por qué existe este archivo:
 * Los datos de negocio (clientes, obras, pagos, ajustes) ya viven en
 * Supabase. Lo único que sigue guardándose en localStorage son los
 * borradores en curso (borrador-store.ts), para no perder una obra a
 * medio armar si se cierra la pestaña.
 *
 * Cada clave se escribe UNA sola vez, acá, y los stores que la necesitan
 * la importan por su nombre en vez de escribirla "a mano".
 */

export const STORAGE_KEY_CLIENTES = 'lebaux-clientes'
export const STORAGE_KEY_OBRAS = 'lebaux-obras'
export const STORAGE_KEY_PAGOS = 'lebaux-pagos'
export const STORAGE_KEY_AJUSTES = 'lebaux-ajustes'
/** Drafts en curso (form de obra no finalizado). */
export const STORAGE_KEY_BORRADORES = 'lebaux-borradores'
/** Plantillas locales de obras reutilizables (solo en este dispositivo). */
export const STORAGE_KEY_PLANTILLAS = 'lebaux-plantillas'
/** Historial local de descripciones de abertura ya tipeadas, para
 * autocompletar. Solo vive en este dispositivo (no es dato de negocio). */
export const STORAGE_KEY_DESCRIPCIONES_FRECUENTES =
  'lebaux-descripciones-frecuentes'
/** Remitos de fábrica (generados al finalizar venta). */
export const STORAGE_KEY_REMITOS = 'lebaux-remitos'
/** Turnos de fábrica (agenda L-S 8-17). */
export const STORAGE_KEY_TURNOS = 'lebaux-turnos'
/** Usuarios (admins + vendedores). */
export const STORAGE_KEY_USERS = 'lebaux-users'
/** Sesión actual (ID del usuario logueado). */
export const STORAGE_KEY_SESSION = 'lebaux-session'
