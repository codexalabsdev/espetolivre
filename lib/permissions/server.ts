import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export async function requireRole(allowedRoles: UserRole[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
  if (!profile?.is_active || !allowedRoles.includes(profile.role as UserRole)) redirect('/admin')
  return { supabase, user, role: profile.role as UserRole }
}

export async function requireOwnerOrDeveloper() {
  return requireRole(['OWNER', 'DEVELOPER'])
}
