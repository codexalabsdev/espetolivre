'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) {
      setError('E-mail ou senha inválidos. Tente novamente.')
      return
    }
    router.replace('/admin')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#17120f] px-5 py-10 text-[#fff8f1]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full rounded-[2rem] border border-white/10 bg-[#241b16] p-7 shadow-2xl shadow-black/30 sm:p-9">
          <div className="mb-10">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#f39b36]">Espeto Livre</p>
            <h1 className="text-3xl font-black tracking-tight">Acesso administrativo</h1>
            <p className="mt-2 text-sm text-[#c8b8aa]">Entre para cuidar da operação da sua loja.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm font-semibold">E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#17120f] px-4 outline-none transition focus:border-[#f39b36]" /></label>
            <label className="block text-sm font-semibold">Senha<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#17120f] px-4 outline-none transition focus:border-[#f39b36]" /></label>
            {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
            <button disabled={loading} className="h-12 w-full rounded-xl bg-[#f39b36] font-bold text-[#24150d] transition hover:bg-[#ffb85d] disabled:cursor-wait disabled:opacity-60">{loading ? 'Entrando...' : 'Entrar no painel'}</button>
          </form>
          <a href="/" className="mt-7 block text-center text-sm font-semibold text-[#c8b8aa] hover:text-white">Voltar para a loja</a>
        </div>
      </div>
    </main>
  )
}
