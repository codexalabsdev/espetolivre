import { UsersManager } from '@/components/admin/users-manager'
import { requireOwnerOrDeveloper } from '@/lib/permissions/server'

export default async function UsersPage() {
  const { supabase } = await requireOwnerOrDeveloper()
  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  return <UsersManager profiles={profiles ?? []} />
}
