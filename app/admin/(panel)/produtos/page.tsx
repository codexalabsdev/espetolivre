import { CatalogManager } from '@/components/admin/catalog-manager'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

export default async function ProductsPage() {
  let products: Tables<'products'>[] = []
  let categories: Tables<'categories'>[] = []
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient()
    const [productResult, categoryResult] = await Promise.all([supabase.from('products').select('*').order('sort_order'), supabase.from('categories').select('*').order('sort_order')])
    products = productResult.data ?? []
    categories = categoryResult.data ?? []
  }
  return <CatalogManager mode="products" initialProducts={products} initialCategories={categories} />
}

export const dynamic = 'force-dynamic'
