'use client'

import { useState } from 'react'
import type { Tables } from '@/types/database'

const roles = ['OWNER', 'OPERATOR', 'ATTENDANT', 'DEVELOPER'] as const

export function UsersManager({ profiles }: { profiles: Tables<'profiles'>[] }) {
  const [rows, setRows] = useState(profiles)
  const [error, setError] = useState('')
  async function update(id: string, patch: { role?: string; is_active?: boolean }) {
    setError('')
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.error ?? 'Não foi possível atualizar o usuário.'); return }
    setRows((current) => current.map((profile) => profile.id === id ? { ...profile, ...patch } as typeof profile : profile))
  }
  return <section className="rounded-3xl border border-[#eadfd4] bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#b47436]">Acesso e equipe</p><h2 className="mt-1 text-xl font-black">Usuários autorizados</h2>{error && <p role="alert" className="mt-4 rounded-xl bg-[#fff1e8] px-4 py-3 text-sm text-[#a44635]">{error}</p>}<div className="mt-5 grid gap-3">{rows.map((profile) => <article key={profile.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eee4db] p-4"><div><p className="font-bold">{profile.full_name || 'Usuário sem nome'}</p><p className="text-sm text-[#806d5d]">{profile.id}</p></div><div className="flex items-center gap-2"><select aria-label={`Role de ${profile.full_name || profile.id}`} value={profile.role} onChange={(event) => update(profile.id, { role: event.target.value })} className="rounded-xl border border-[#eadfd4] px-2 py-2 text-xs font-bold">{roles.map((role) => <option key={role}>{role}</option>)}</select><button type="button" onClick={() => update(profile.id, { is_active: !profile.is_active })} className="rounded-xl bg-[#f8ead9] px-3 py-2 text-xs font-bold">{profile.is_active ? 'Desativar' : 'Ativar'}</button></div></article>)}{rows.length === 0 && <p className="rounded-2xl border border-dashed border-[#dfd1c3] p-8 text-center text-sm text-[#806d5d]">Nenhum usuário autorizado encontrado.</p>}</div></section>
}
