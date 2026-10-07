import { CustomerManager } from '@/components/admin/catalog-manager'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

export default async function CustomersPage() {
  let customers: Tables<'customers'>[] = []
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient()
    const result = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    customers = result.data ?? []
  }
  return <CustomerManager initialCustomers={customers} />
}

export const dynamic = 'force-dynamic'
