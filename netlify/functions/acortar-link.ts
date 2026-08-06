// netlify/functions/acortar-link.ts
//
// Recibe una signed URL larga de Supabase Storage (la de un PDF de
// presupuesto/comprobante) y devuelve un link corto propio, del tipo
// https://<tu-dominio>/l/<codigo>, que redirige a la URL real.
//
// Por qué existe: las signed URL de Supabase son larguísimas (llevan
// un token de firma en el query string) y muestran el dominio de
// Supabase en vez del propio. Este endpoint las "envuelve" en un
// código corto guardado en la tabla `links_cortos`.
//
// Uso desde el frontend (ver src/lib/link-corto.ts):
//   POST /.netlify/functions/acortar-link
//   body: { urlDestino: string, storagePath?: string, expiraEn?: string }
//   → { codigo: string, urlCorta: string }
//
// Variables de entorno necesarias en Netlify (Site settings → Environment):
//   - SUPABASE_URL                (misma URL que VITE_SUPABASE_URL)
//   - SUPABASE_SERVICE_ROLE_KEY   (Service Role Key — NUNCA la VITE_* pública)
//
// Usamos la Service Role Key (no la anon key) porque `links_cortos` no
// tiene policies de RLS para el cliente autenticado — se opera solo
// desde funciones de servidor, igual que la Edge Function
// `crear-vendedor` ya hace con Service Role para lo suyo.

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

/** 30 días, igual que la expiración de la signed URL que envolvemos. */
const EXPIRACION_DEFAULT_MS = 30 * 24 * 60 * 60 * 1000

/** Código corto de 8 caracteres, alfanumérico, sin ambigüedades visuales
 * (sin 0/O, 1/I/l) para que si alguien lo tipea a mano no se confunda. */
function generarCodigo(): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let codigo = ''
  for (let i = 0; i < 8; i++) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)]
  }
  return codigo
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido.' }),
    }
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error:
            'Faltan variables de entorno SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Netlify.',
        }),
      }
    }

    const body = JSON.parse(event.body || '{}')
    const urlDestino = (body.urlDestino ?? '').trim()
    const storagePath: string | null = body.storagePath ?? null

    if (!urlDestino || !urlDestino.startsWith('http')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'urlDestino inválida o faltante.' }),
      }
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Si ya generamos un link corto para este mismo comprobante (mismo
    // storagePath) y todavía no expiró, lo reutilizamos en vez de crear
    // uno nuevo cada vez que se reenvía el mismo PDF. Esto evita
    // acumular filas basura cuando el vendedor manda el mismo
    // presupuesto varias veces.
    if (storagePath) {
      const { data: existente } = await admin
        .from('links_cortos')
        .select('codigo, expira_en')
        .eq('storage_path', storagePath)
        .gt('expira_en', new Date().toISOString())
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existente) {
        // Igual actualizamos la url_destino: la signed URL vieja pudo
        // haber cambiado de token si se regeneró el PDF.
        await admin
          .from('links_cortos')
          .update({ url_destino: urlDestino })
          .eq('codigo', existente.codigo)

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ codigo: existente.codigo }),
        }
      }
    }

    // Generar un código nuevo, reintentando si por casualidad choca
    // con uno existente (la tabla tiene `codigo` unique).
    let codigo = ''
    for (let intento = 0; intento < 5; intento++) {
      const candidato = generarCodigo()
      const { data: choque } = await admin
        .from('links_cortos')
        .select('id')
        .eq('codigo', candidato)
        .maybeSingle()
      if (!choque) {
        codigo = candidato
        break
      }
    }
    if (!codigo) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'No se pudo generar un código único, reintentá.',
        }),
      }
    }

    const expiraEn = new Date(Date.now() + EXPIRACION_DEFAULT_MS).toISOString()

    const { error: insertError } = await admin.from('links_cortos').insert({
      codigo,
      url_destino: urlDestino,
      storage_path: storagePath,
      expira_en: expiraEn,
    })

    if (insertError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: insertError.message }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ codigo }),
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: e instanceof Error ? e.message : 'Error inesperado.',
      }),
    }
  }
}
