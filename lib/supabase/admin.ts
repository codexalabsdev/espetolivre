import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Use only in trusted server code. Never import this module from client components. */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY_2)!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
