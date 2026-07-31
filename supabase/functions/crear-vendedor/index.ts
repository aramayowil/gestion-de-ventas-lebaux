// supabase/functions/crear-vendedor/index.ts
//
// Edge Function que crea un vendedor nuevo:
//   1. Verifica que quien llama esté autenticado y sea 'admin'.
//   2. Crea el usuario en auth.users usando la Service Role Key
//      (esto NO afecta la sesión del admin que llama, a diferencia
//      de supabase.auth.signUp() desde el cliente).
//   3. Inserta la fila correspondiente en public.users.
//
// Deploy:
//   supabase functions deploy crear-vendedor
//
// Variables de entorno necesarias (ya provistas automáticamente por
// Supabase en cada Edge Function, no hace falta configurarlas a mano):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - SUPABASE_ANON_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // ── 1. Verificar quién llama (usando su JWT) ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'No autenticado.' }, 401)
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()

    if (callerError || !caller) {
      return json({ error: 'No autenticado.' }, 401)
    }

    // Cliente admin (service role) para bypasear RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerRow, error: callerRowError } = await adminClient
      .from('users')
      .select('rol')
      .eq('id', caller.id)
      .single()

    if (callerRowError || callerRow?.rol !== 'admin') {
      return json(
        { error: 'Solo un administrador puede crear vendedores.' },
        403,
      )
    }

    // ── 2. Validar body ──
    const body = await req.json().catch(() => null)
    const email = (body?.email ?? '').trim().toLowerCase()
    const password = body?.password ?? ''
    const username = (body?.username ?? '').trim().toLowerCase()
    const nombre = (body?.nombre ?? '').trim()

    if (!email || !email.includes('@')) {
      return json({ error: 'Email inválido.' }, 400)
    }
    if (!password || password.length < 4) {
      return json(
        { error: 'La contraseña debe tener al menos 4 caracteres.' },
        400,
      )
    }
    if (!username) {
      return json({ error: 'El nombre de usuario es obligatorio.' }, 400)
    }
    if (!nombre) {
      return json({ error: 'El nombre para mostrar es obligatorio.' }, 400)
    }

    // Verificar que el username no esté en uso
    const { data: existingUsername } = await adminClient
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingUsername) {
      return json({ error: 'Ese nombre de usuario ya está en uso.' }, 409)
    }

    // ── 3. Crear usuario en auth.users (Service Role) ──
    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // no requiere verificación por mail
      })

    if (createError || !created?.user) {
      return json(
        { error: createError?.message ?? 'No se pudo crear el usuario.' },
        400,
      )
    }

    // ── 4. Insertar fila en public.users ──
    const { error: insertError } = await adminClient.from('users').insert({
      id: created.user.id,
      username,
      nombre,
      rol: 'vendedor',
      creado_por: caller.id,
    })

    if (insertError) {
      // Si falla el insert en public.users, revertimos el usuario de auth
      // para no dejar un usuario "huérfano" sin fila de negocio.
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json({ error: insertError.message }, 400)
    }

    return json({ success: true, id: created.user.id })
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Error inesperado.' },
      500,
    )
  }
})
