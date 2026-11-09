const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const env = {
  supabaseUrl: url?.trim() || null,
  supabaseAnonKey: anonKey?.trim() || null,
}

/** Demo mode: no Supabase configured → everything runs locally in the browser (IndexedDB). */
export const isDemoMode = !env.supabaseUrl || !env.supabaseAnonKey

/** Above this many rows filtering moves from the cached client list to the server. */
export const CLIENT_FILTER_LIMIT = 5000
