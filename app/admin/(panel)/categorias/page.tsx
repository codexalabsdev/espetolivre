import { CatalogManager } from '@/components/admin/catalog-manager'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

export default async function CategoriesPage() {
  let categories: Tables<'categories'>[] = []
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient()
    const result = await supabase.from('categories').select('*').order('sort_order')
    categories = result.data ?? []
  }
  return <CatalogManager mode="categories" initialCategories={categories} />
}

export const dynamic = 'force-dynamic'
