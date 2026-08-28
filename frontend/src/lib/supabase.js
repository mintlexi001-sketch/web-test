import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail closed: if env vars are missing, surface a clear error rather than
// silently constructing a broken client with empty/garbage values.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('[supabase.js] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
