import { createServerSupabaseClient } from '@/lib/auth'
import { getAdminDateRange, formatAdminDate } from '@/lib/admin-date'
import { DateFilter } from '@/components/admin/date-filter'

import { ReportActions } from '@/components/admin/report-actions'
import { ManualOrderDialog } from '@/components/admin/manual-order-dialog'

function money(value: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) }

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { start, end, date } = getAdminDateRange((await searchParams).date)
  const [{ data: orders }, { count: customerCount }, { count: productCount, data: products }] = await Promise.all([
    supabase.from('orders').select('status, total').gte('created_at', start).lte('created_at', end),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id, name, price', { count: 'exact' }).eq('is_active', true).eq('is_available', true).order('name'),
  ])
  const rows = orders ?? []
  const open = rows.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status))
  const preparing = rows.filter((order) => order.status === 'PREPARING')
  const ready = rows.filter((order) => order.status === 'READY')
  const completed = rows.filter((order) => order.status === 'COMPLETED')
  const revenue = completed.reduce((total, order) => total + Number(order.total), 0)
  const stats = [
    ['Pedidos hoje', rows.length.toString(), 'Todos os pedidos recebidos'],
    ['Pedidos abertos', open.length.toString(), 'Aguardando conclusão'],
    ['Em preparação', preparing.length.toString(), 'Na cozinha agora'],
    ['Prontos', ready.length.toString(), 'Aguardando retirada ou entrega'],
    ['Finalizados', completed.length.toString(), 'Concluídos hoje'],
    ['Faturamento', money(revenue), 'Pedidos finalizados'],
    ['Ticket médio', completed.length ? money(revenue / completed.length) : money(0), 'Finalizados hoje'],
    ['Clientes', String(customerCount ?? 0), 'Base cadastrada'],
    ['Produtos ativos', String(productCount ?? 0), 'Disponíveis no catálogo'],
  ]
  return <div className="mx-auto max-w-7xl"><div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[#b47436]">{formatAdminDate(date)}</p><h2 className="mt-1 text-3xl font-black tracking-tight">Bom trabalho na operação.</h2><p className="mt-2 text-[#806b5b]">Acompanhe o pulso do Espeto Livre em um só lugar.</p></div><div className="flex flex-wrap items-center gap-3"><DateFilter date={date} /><ManualOrderDialog products={products ?? []} /><ReportActions date={date} /><div className="rounded-full bg-[#fff0df] px-4 py-2 text-sm font-bold text-[#a45d1e]">Dados em tempo real</div></div></div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{stats.map(([label, value, description]) => <article key={label} className="rounded-2xl border border-[#eadfd4] bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-[#806b5b]">{label}</p><p className="mt-3 text-3xl font-black tracking-tight text-[#261812]">{value}</p><p className="mt-2 text-xs text-[#a08c7d]">{description}</p></article>)}</section><section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><div className="rounded-2xl border border-[#eadfd4] bg-white p-6"><div className="flex items-center justify-between"><h3 className="font-black">Operação de hoje</h3><a href="/admin/pedidos" className="text-sm font-bold text-[#b47436]">Ver pedidos</a></div><div className="mt-5 space-y-4"><div className="flex items-center justify-between border-b border-[#f0e7df] pb-4"><span className="text-sm text-[#806b5b]">Pedidos em andamento</span><strong>{open.length}</strong></div><div className="flex items-center justify-between border-b border-[#f0e7df] pb-4"><span className="text-sm text-[#806b5b]">Ticket médio finalizado</span><strong>{completed.length ? money(revenue / completed.length) : money(0)}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-[#806b5b]">Status da cozinha</span><span className="rounded-full bg-[#e9f7ee] px-3 py-1 text-xs font-bold text-[#247543]">Operando</span></div></div></div><div className="rounded-2xl bg-[#261812] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f39b36]">Atalho rápido</p><h3 className="mt-3 text-xl font-black">Precisa lançar um pedido?</h3><p className="mt-2 text-sm leading-relaxed text-[#cdb9a9]">A equipe pode registrar pedidos recebidos por telefone ou balcão.</p><a href="#manual-order" className="mt-6 inline-flex rounded-xl bg-[#f39b36] px-4 py-3 text-sm font-bold text-[#261812]">Criar pedido manual</a></div></section></div>
}
