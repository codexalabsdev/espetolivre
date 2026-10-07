import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/auth'
import { AdminShell } from '@/components/admin/admin-shell'
import type { UserRole } from '@/types/database'

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect('/admin/login?error=not-configured')
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', user.id).maybeSingle()
  if (!profile?.is_active) redirect('/admin/login?error=inactive')
  return <AdminShell role={profile.role as UserRole} name={profile.full_name}>{children}</AdminShell>
}
