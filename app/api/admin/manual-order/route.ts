import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const payload = await request.json()
  if (!payload.customer_name || !payload.customer_phone || !Array.isArray(payload.items) || payload.items.length === 0) return NextResponse.json({ error: 'Informe cliente, telefone e pelo menos um produto.' }, { status: 400 })
  const admin = createAdminClient()
  const { data, error } = await (admin as any).rpc('create_public_order', { payload: { ...payload, type: payload.type ?? 'PICKUP', payment_method: payload.payment_method ?? 'CASH', idempotency_key: crypto.randomUUID() } })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(Array.isArray(data) ? data[0] : data)
}
