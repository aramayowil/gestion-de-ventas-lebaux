/**
 * lib/link-corto.ts — Acorta una signed URL de Supabase Storage a un
 * link propio del tipo `https://<dominio>/l/<codigo>`, llamando a la
 * Netlify Function `acortar-link` (ver netlify/functions/acortar-link.ts).
 *
 * Si el acortado falla por lo que sea (función caída, sin conexión,
 * etc.) devolvemos la signed URL original tal cual — es más importante
 * que el mensaje de WhatsApp salga con ALGÚN link a que no salga nada
 * por un problema del acortador.
 */

interface AcortarLinkOpts {
  /** Signed URL larga de Supabase Storage a acortar. */
  urlDestino: string
  /** Path dentro del bucket (ej. "obraId/presupuesto.pdf"). Si se pasa,
   * el backend reutiliza el mismo código corto cuando se reenvía el
   * mismo comprobante en vez de crear uno nuevo cada vez. */
  storagePath?: string
}

/**
 * Pide un código corto al backend y arma la URL final con el dominio
 * actual (window.location.origin) — así funciona tanto en el dominio
 * gratuito de Netlify como en un dominio propio, sin hardcodear nada.
 */
export async function acortarLink({
  urlDestino,
  storagePath,
}: AcortarLinkOpts): Promise<string> {
  try {
    const res = await fetch('/.netlify/functions/acortar-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlDestino, storagePath }),
    })
    if (!res.ok) return urlDestino

    const data = (await res.json()) as { codigo?: string }
    if (!data.codigo) return urlDestino

    return `${window.location.origin}/l/${data.codigo}`
  } catch {
    // Sin conexión, función caída, lo que sea: mandamos la URL larga
    // en vez de romper el flujo de envío del PDF.
    return urlDestino
  }
}
