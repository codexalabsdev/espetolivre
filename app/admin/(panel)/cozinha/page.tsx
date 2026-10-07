import { createClient } from '@/lib/supabase/server'
import { OperationsBoard } from '@/components/admin/operations-board'
import { getAdminDateRange } from '@/lib/admin-date'

export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createClient()
  const { start, end, date } = getAdminDateRange((await searchParams).date)
  const { data } = await (supabase as any).from('orders').select('*, order_items(*), order_status_history(*)').gte('created_at', start).lte('created_at', end).in('status', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']).order('created_at', { ascending: true })
  return <main><div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#e76f27]">KDS · Cozinha</p><h1 className="mt-2 text-3xl font-black text-[#201a16]">Fila de preparo</h1><p className="mt-2 text-[#89796e]">Leitura rápida, decisões simples e nenhum pedido perdido.</p></div><OperationsBoard initialOrders={data ?? []} mode="kitchen" selectedDate={date} /></main>
}
