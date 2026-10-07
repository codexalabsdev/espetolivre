'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tables, OrderStatus } from '@/types/database'
import { buildOrderWhatsAppUrl } from '@/lib/whatsapp'

const labels: Record<OrderStatus, string> = { NEW: 'Novo', PENDING: 'Novo', CONFIRMED: 'Confirmado', PREPARING: 'Em preparação', READY: 'Pronto', OUT_FOR_DELIVERY: 'Saiu para entrega', COMPLETED: 'Finalizado', CANCELLED: 'Cancelado' }
const columns: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']
const money = (value: number) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`

type OrderWithItems = Tables<'orders'> & { order_items: Tables<'order_items'>[]; order_status_history: Tables<'order_status_history'>[] }

export function OperationsBoard({ initialOrders, mode, selectedDate }: { initialOrders: OrderWithItems[]; mode: 'orders' | 'kitchen'; selectedDate: string }) {
  const router = useRouter()
  const [orders, setOrders] = useState(initialOrders)
  const [status, setStatus] = useState('ALL')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const channel = subscribeToOrders(() => router.refresh())
    return () => { void createClient().removeChannel(channel) }
  }, [router])

  useEffect(() => setOrders(initialOrders), [initialOrders])

  const visible = useMemo(() => status === 'ALL' ? orders : orders.filter((order) => order.status === status), [orders, status])
  async function move(order: OrderWithItems, next: OrderStatus) {
    setBusy(order.id)
    setError('')
    const response = await fetch(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
    if (response.ok) setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: next, order_status_history: [...(item.order_status_history ?? []), { id: crypto.randomUUID(), order_id: item.id, status: next, changed_by: null, note: null, created_at: new Date().toISOString() }] } : item))
    else { const body = await response.json().catch(() => null); setError(body?.error ?? 'Não foi possível atualizar o status.') }
    setBusy(null)
  }

  const card = (order: OrderWithItems) => <article key={order.id} className="rounded-2xl border border-[#eadfd4] bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#201a16]">{order.public_code}</p><p className="text-xs text-[#89796e]">{new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {order.customer_name}</p></div><span className="rounded-full bg-[#fff1e8] px-2 py-1 text-[10px] font-black uppercase text-[#c95518]">{order.type === 'DELIVERY' ? 'Entrega' : 'Retirada'}</span></div>
    <div className="mt-3 space-y-1 text-sm text-[#55483f]">{order.order_items?.map((item) => <p key={item.id}><b>{item.quantity}x</b> {item.product_name}{item.notes ? ` — ${item.notes}` : ''}</p>)}</div>
    <div className="mt-4 flex items-center justify-between border-t border-[#f0e7df] pt-3"><strong>{money(order.total)}</strong><a href={buildOrderWhatsAppUrl(order.customer_phone, order.public_code)} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#16845d]">WhatsApp</a></div>
    {mode === 'kitchen' && <select aria-label={`Atualizar ${order.public_code}`} value={order.status} disabled={busy === order.id} onChange={(event) => move(order, event.target.value as OrderStatus)} className="mt-3 w-full rounded-xl border border-[#eadfd4] bg-[#fffaf6] px-3 py-2 text-sm font-bold"><option value="NEW">Novo</option><option value="CONFIRMED">Confirmado</option><option value="PREPARING">Em preparação</option><option value="READY">Pronto</option><option value="OUT_FOR_DELIVERY">Saiu para entrega</option><option value="COMPLETED">Finalizado</option><option value="CANCELLED">Cancelado</option></select>}
  </article>

  return <div className="space-y-5">{error && <p role="alert" className="rounded-xl bg-[#fff1e8] px-4 py-3 text-sm font-semibold text-[#a44635]">{error}</p>}<label className="flex w-fit items-center gap-3 rounded-xl border border-[#eadfd4] bg-white px-4 py-2 text-sm font-bold text-[#55483f]">Dia<input type="date" value={selectedDate} onChange={(event) => router.push(`?date=${event.target.value}`)} className="rounded-lg border border-[#eadfd4] bg-[#fffaf6] px-2 py-1 font-normal" /></label><div className="flex flex-wrap gap-2">{['ALL', ...columns, 'COMPLETED', 'CANCELLED'].map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded-full px-4 py-2 text-xs font-black ${status === item ? 'bg-[#201a16] text-white' : 'bg-white text-[#89796e] ring-1 ring-[#eadfd4]'}`}>{item === 'ALL' ? 'Todos' : labels[item as OrderStatus]}</button>)}</div>{mode === 'kitchen' ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{columns.map((column) => <section key={column} className="min-h-48 rounded-3xl bg-[#f2eae2] p-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-black uppercase tracking-widest text-[#55483f]">{labels[column]}</h2><span className="rounded-full bg-white px-2 py-1 text-xs font-black">{visible.filter((order) => order.status === column).length}</span></div><div className="space-y-3">{visible.filter((order) => order.status === column).map(card)}</div></section>)}</div> : <div className="grid gap-3">{visible.map(card)}{!visible.length && <div className="rounded-3xl border border-dashed border-[#d9c9bb] p-12 text-center text-[#89796e]">Nenhum pedido encontrado.</div>}</div>}</div>
}

export function subscribeToOrders(onChange: () => void) { const supabase = createClient(); return supabase.channel('admin-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange).subscribe() }
