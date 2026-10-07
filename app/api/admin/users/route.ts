import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerOrDeveloper } from '@/lib/permissions/server'
import type { Database } from '@/types/database'

const roles = ['OWNER', 'OPERATOR', 'ATTENDANT', 'DEVELOPER'] as const

export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireOwnerOrDeveloper()
    const body = await request.json() as { id?: string; role?: Database['public']['Enums']['user_role']; is_active?: boolean }
    if (!body.id || (!body.role && typeof body.is_active !== 'boolean')) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    if (body.role && !roles.includes(body.role)) return NextResponse.json({ error: 'Role inválida.' }, { status: 400 })
    const { data: current } = await supabase.from('profiles').select('id').eq('id', body.id).maybeSingle()
    if (!current) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update({ ...(body.role ? { role: body.role } : {}), ...(typeof body.is_active === 'boolean' ? { is_active: body.is_active } : {}) }).eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não autorizado.' }, { status: 403 }) }
}
