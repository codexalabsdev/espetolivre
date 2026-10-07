import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManage } from '@/lib/permissions'
import type { OrderStatus } from '@/types/database'

const allowed: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED']
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: profile } = await (supabase as any).from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canManage(profile?.role)) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!allowed.includes(body?.status)) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  const { error } = await (supabase as any).rpc('set_order_status', { next_status: body.status, target_order: id, status_note: typeof body.note === 'string' ? body.note.trim() || null : null })
  if (error) return NextResponse.json({ error: 'Não foi possível atualizar o pedido' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
