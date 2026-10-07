'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrderStatus, Tables } from '@/types/database'

const steps: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']
const labels: Record<string, string> = { PENDING: 'Pedido recebido', CONFIRMED: 'Pedido confirmado', PREPARING: 'Em preparação', READY: 'Pedido pronto', OUT_FOR_DELIVERY: 'Saiu para entrega', COMPLETED: 'Finalizado', CANCELLED: 'Cancelado' }

type HistoryEntry = Pick<Tables<'order_status_history'>, 'status' | 'created_at' | 'note'>

export function PublicOrderTracker({ code, initialStatus, initialHistory = [] }: { code: string; initialStatus: OrderStatus; initialHistory?: HistoryEntry[] }) {
  const [status, setStatus] = useState(initialStatus)
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`public-order-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'public_order_updates', filter: `public_code=eq.${code}` }, (payload: any) => {
        setStatus(payload.new.status as OrderStatus)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_status_history' }, async (payload) => {
        const { data } = await (supabase as any).rpc('get_public_order', { order_code: code })
        if (data?.history) setHistory(data.history as HistoryEntry[])
        if (payload.new.status) setStatus(payload.new.status as OrderStatus)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [code])

  const current = steps.indexOf(status)
  return <div className="mt-6 space-y-3 text-left">
    {status === 'CANCELLED' ? <div className="rounded-xl bg-red-50 p-4 font-bold text-red-700">Este pedido foi cancelado.</div> : steps.map((step, index) => <div key={step} className="flex items-center gap-3"><span className={`grid size-7 place-items-center rounded-full text-xs font-black ${index <= current ? 'bg-[#16845d] text-white' : 'bg-[#eee6df] text-[#89796e]'}`}>{index <= current ? '✓' : index + 1}</span><span className={index <= current ? 'font-bold text-[#201a16]' : 'text-[#89796e]'}>{labels[step]}</span></div>)}
    {history.length > 0 && <ol className="border-l border-[#eadfd4] pl-4 text-xs text-[#89796e]">{history.map((entry) => <li key={`${entry.status}-${entry.created_at}`} className="mb-2"><b className="text-[#55483f]">{new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</b> · {labels[entry.status] ?? entry.status}{entry.note ? ` — ${entry.note}` : ''}</li>)}</ol>}
  </div>
}

export function subscribeToOrders(onChange: () => void) {
  const supabase = createClient()
  return supabase.channel('admin-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange).subscribe()
}

export function subscribeToOrderHistory(onChange: () => void) {
  const supabase = createClient()
  return supabase.channel('admin-order-history').on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history' }, onChange).subscribe()
}

export type { HistoryEntry }

