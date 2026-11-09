import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { env, isDemoMode } from './env'

export type TypedSupabase = SupabaseClient<Database>

export const supabase: TypedSupabase | null = isDemoMode
  ? null
  : createClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'shidduchim-auth' },
    })

export function requireSupabase(): TypedSupabase {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}
