'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { roleLabels } from '@/lib/permissions'
import type { UserRole } from '@/types/database'

const navigation: { label: string; href: string; roles: UserRole[] }[] = [
  { label: 'Dashboard', href: '/admin', roles: ['OWNER', 'OPERATOR', 'ATTENDANT', 'DEVELOPER'] },
  { label: 'Pedidos', href: '/admin/pedidos', roles: ['OWNER', 'OPERATOR', 'ATTENDANT', 'DEVELOPER'] },
  { label: 'Cozinha', href: '/admin/cozinha', roles: ['OWNER', 'OPERATOR', 'DEVELOPER'] },
  { label: 'Produtos', href: '/admin/produtos', roles: ['OWNER', 'DEVELOPER'] },
  { label: 'Categorias', href: '/admin/categorias', roles: ['OWNER', 'DEVELOPER'] },
  { label: 'Clientes', href: '/admin/clientes', roles: ['OWNER', 'OPERATOR', 'ATTENDANT', 'DEVELOPER'] },
  { label: 'Usuários', href: '/admin/usuarios', roles: ['OWNER', 'DEVELOPER'] },
  { label: 'Configurações', href: '/admin/configuracoes', roles: ['OWNER', 'DEVELOPER'] },
] as const

export function AdminShell({ children, role, name }: { children: React.ReactNode; role: UserRole; name: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const visibleNavigation = navigation.filter((item) => item.roles.includes(role))

  async function logout() {
    await createBrowserSupabaseClient().auth.signOut()
    router.replace('/admin/login')
    router.refresh()
  }

  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#fffaf2_0%,#f8f4ef_38%,#efe7de_100%)] text-[#261812]">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-[#211711] px-5 py-7 text-white shadow-[12px_0_40px_rgba(33,23,17,0.12)] lg:flex">
      <Link href="/admin" className="mb-10 block"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f39b36]">Espeto Livre</p><p className="mt-1 text-xs text-[#aa9584]">Central de operação</p></Link>
      <nav className="space-y-1">{visibleNavigation.map((item) => <Link key={item.href} href={item.href} className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${pathname === item.href ? 'bg-[#f39b36] text-[#261812]' : 'text-[#cdb9a9] hover:bg-white/10 hover:text-white'}`}>{item.label}</Link>)}</nav>
      <div className="mt-auto border-t border-white/10 pt-5"><p className="truncate text-sm font-bold">{name || 'Usuário'}</p><p className="mt-1 text-xs text-[#aa9584]">{roleLabels[role]}</p><button onClick={logout} className="mt-5 text-sm font-semibold text-[#f39b36] hover:text-white">Sair da conta</button></div>
    </aside>
    <div className="lg:pl-64"><header className="sticky top-0 z-10 border-b border-[#eadfd4]/80 bg-[#fffaf5]/85 px-5 py-4 shadow-sm backdrop-blur-xl sm:px-8"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b47436]">Painel administrativo</p><h1 className="mt-1 text-xl font-black">{pathname === '/admin' ? 'Visão geral' : visibleNavigation.find((item) => item.href === pathname)?.label || 'Espeto Livre'}</h1></div><button onClick={logout} className="rounded-lg border border-[#dfd1c3] px-3 py-2 text-sm font-bold text-[#735b4a] lg:hidden">Sair</button></div><nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">{visibleNavigation.map((item) => <Link key={item.href} href={item.href} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${pathname === item.href ? 'bg-[#f39b36] text-[#261812]' : 'bg-white text-[#735b4a]'}`}>{item.label}</Link>)}</nav></header><main className="px-5 py-7 sm:px-8 sm:py-9">{children}</main></div>
  </div>
}
