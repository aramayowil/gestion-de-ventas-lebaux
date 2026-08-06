// netlify/functions/l.ts
//
// Redirector de links cortos. Se accede como /l/<codigo> (ver el
// redirect configurado en netlify.toml, que mapea /l/* a esta función
// pasando el código como query param).
//
// Busca el código en `links_cortos`, y si existe y no expiró, hace un
// 302 a la signed URL real de Supabase Storage. Si no existe o
// expiró, devuelve una página simple de error en vez de redirigir a
// cualquier lado (nunca a un destino default/adivinado).
//
// Variables de entorno necesarias en Netlify (las mismas que
// acortar-link.ts):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

function paginaError(mensaje: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Link no disponible — Lebaux</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0f10; color: #eee;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
    .caja { max-width: 380px; }
    h1 { font-size: 1.1rem; margin-bottom: 8px; }
    p { color: #999; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="caja">
    <h1>Este link ya no está disponible</h1>
    <p>${mensaje}</p>
  </div>
</body>
</html>`
}

export const handler: Handler = async (event) => {
  try {
    // El código llega como query param `codigo` (ver el rewrite en
    // netlify.toml: /l/:codigo → /.netlify/functions/l?codigo=:codigo)
    const codigo = event.queryStringParameters?.codigo?.trim()

    if (!codigo) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: paginaError('Falta el código del link.'),
      }
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: paginaError('Error de configuración del servidor.'),
      }
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: link } = await admin
      .from('links_cortos')
      .select('url_destino, expira_en')
      .eq('codigo', codigo)
      .maybeSingle()

    if (!link) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: paginaError('El link no existe o es incorrecto.'),
      }
    }

    if (new Date(link.expira_en).getTime() < Date.now()) {
      return {
        statusCode: 410,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: paginaError(
          'Este link venció. Pedile al vendedor que te lo reenvíe.',
        ),
      }
    }

    return {
      statusCode: 302,
      headers: {
        Location: link.url_destino,
        // El destino final (signed URL de Supabase) ya tiene su propia
        // caché/expiración; acá evitamos que el navegador cachee el
        // redirect en sí, para no pegarse a una URL vieja si el link
        // corto se reasigna.
        'Cache-Control': 'no-store',
      },
      body: '',
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: paginaError(
        e instanceof Error ? e.message : 'Error inesperado.',
      ),
    }
  }
}
