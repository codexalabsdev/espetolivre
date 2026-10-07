import { createAdminClient } from '@/lib/supabase/admin'

export type CheckoutPayload = {
  customer_name: string; customer_phone: string; email?: string; idempotency_key: string; type: 'DELIVERY' | 'PICKUP'
  payment_method: 'PIX' | 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD'; cash_change_for?: number; notes?: string
  street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; postal_code?: string; reference?: string; latitude?: number; longitude?: number
  items: Array<{ product_id: string; quantity: number; notes?: string }>
}

export async function createOrder(payload: CheckoutPayload) {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('create_public_order', { payload })
  if (error) throw new Error(error.message || 'Não foi possível criar o pedido. Confira os dados e tente novamente.')
  const result = Array.isArray(data) ? data[0] : data
  return (result?.order ?? result) as { id: string; public_code: string; total: number }
}

export async function getPublicOrder(code: string) {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('get_public_order', { order_code: code })
  if (error || !data) return null
  return { ...(data.order ?? data), items: data.items ?? data.order?.items ?? [], history: data.history ?? data.order?.history ?? [] }
}
