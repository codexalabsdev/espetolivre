'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'

const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

type Hour = Partial<Tables<'business_hours'>> & { day_of_week: number; is_closed: boolean; opens_at: string; closes_at: string }

export function BusinessHoursPanel({ initialHours }: { initialHours: Tables<'business_hours'>[] }) {
  const supabase = useMemo(() => createClient() as any, [])
  const [hours, setHours] = useState<Hour[]>(() => days.map((_, day_of_week) => { const existing = initialHours.find((item) => item.day_of_week === day_of_week); return { ...existing, day_of_week, is_closed: existing?.is_closed ?? false, opens_at: existing?.opens_at?.slice(0, 5) ?? '11:00', closes_at: existing?.closes_at?.slice(0, 5) ?? '22:00' } }))
  const [message, setMessage] = useState('')
  function update(day_of_week: number, patch: Partial<Hour>) { setHours((current) => current.map((hour) => hour.day_of_week === day_of_week ? { ...hour, ...patch } : hour)) }
  async function save(hour: Hour) { const payload = { day_of_week: hour.day_of_week, is_closed: hour.is_closed, opens_at: hour.is_closed ? null : hour.opens_at, closes_at: hour.is_closed ? null : hour.closes_at }; const query = hour.id ? supabase.from('business_hours').update(payload).eq('id', hour.id) : supabase.from('business_hours').insert(payload); const { error } = await query; setMessage(error?.message ?? `${days[hour.day_of_week]} salvo.`) }
  return <section className="rounded-3xl border border-[#eadfd4] bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#b47436]">Funcionamento</p><h2 className="mt-1 text-xl font-black">Horários da semana</h2><div className="mt-5 grid gap-3">{hours.map((hour) => <div key={hour.day_of_week} className="grid gap-3 rounded-2xl border border-[#eee4db] p-4 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-center"><strong>{days[hour.day_of_week]}</strong><label className="grid gap-1 text-xs font-bold">Abertura<input type="time" disabled={hour.is_closed} value={hour.opens_at} onChange={(event) => update(hour.day_of_week, { opens_at: event.target.value })} className="rounded-xl border border-[#dfd1c3] px-3 py-2 font-normal disabled:bg-[#f4eee8]" /></label><label className="grid gap-1 text-xs font-bold">Fechamento<input type="time" disabled={hour.is_closed} value={hour.closes_at} onChange={(event) => update(hour.day_of_week, { closes_at: event.target.value })} className="rounded-xl border border-[#dfd1c3] px-3 py-2 font-normal disabled:bg-[#f4eee8]" /></label><div className="flex items-center gap-2"><select value={hour.is_closed ? 'closed' : 'open'} onChange={(event) => update(hour.day_of_week, { is_closed: event.target.value === 'closed' })} className="rounded-xl border border-[#dfd1c3] px-3 py-2 text-sm"><option value="open">Aberto</option><option value="closed">Fechado</option></select><button type="button" onClick={() => save(hour)} className="rounded-xl bg-[#f39b36] px-3 py-2 text-xs font-bold">Salvar</button></div></div>)}</div>{message && <p className="mt-4 text-sm font-bold text-[#8f531e]">{message}</p>}</section>
}
