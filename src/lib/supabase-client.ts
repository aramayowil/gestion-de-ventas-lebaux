/**
 * lib/supabase-client.ts — Cliente de Supabase (sin fallback).
 *
 * Requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.
 * Si no están, lanza error al importar (la app no arranca sin DB).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Falta configurar Supabase. Copiá .env.example a .env y llená VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
