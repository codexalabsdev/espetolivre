import { createClient } from '@/lib/supabase/server'
import { OperationsBoard } from '@/components/admin/operations-board'
import { getAdminDateRange } from '@/lib/admin-date'

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createClient()
  const { start, end, date } = getAdminDateRange((await searchParams).date)
  const { data } = await (supabase as any).from('orders').select('*, order_items(*), order_status_history(*)').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(100)
  return <main><div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#e76f27]">Operação</p><h1 className="mt-2 text-3xl font-black text-[#201a16]">Pedidos</h1><p className="mt-2 text-[#89796e]">Acompanhe cada pedido do balcão à entrega.</p></div><OperationsBoard initialOrders={data ?? []} mode="orders" selectedDate={date} /></main>
}
