import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

export type MenuCategory = Tables<'categories'>
export type MenuProduct = Tables<'products'>

export async function getPublicMenu() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { categories: [] as MenuCategory[], products: [], settings: null, hours: [] }
  }

  const supabase = await createClient()
  const [categoriesResult, productsResult, settingsResult, hoursResult] = await Promise.all([
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('products').select('*').eq('is_active', true).eq('is_available', true).order('sort_order'),
    supabase.from('business_settings').select('*').limit(1).maybeSingle(),
    supabase.from('business_hours').select('*').order('day_of_week'),
  ])

  return {
    categories: categoriesResult.data ?? [],
    products: productsResult.data ?? [],
    settings: settingsResult.data ?? null,
    hours: hoursResult.data ?? [],
  }
}

export function getProductImage(path: string | null) {
  if (!path) return null
  if (path.startsWith('http')) return path
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return baseUrl ? `${baseUrl}/storage/v1/object/public/product-images/${path}` : null
}
