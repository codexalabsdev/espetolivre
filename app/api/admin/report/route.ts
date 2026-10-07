import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { utils, write } from 'xlsx'

function escape(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"` }
export async function GET(request: Request) {
  const session = await createClient(); const { data: { user } } = await session.auth.getUser(); if (!user) return new NextResponse('Não autorizado.', { status: 401 })
  const date = new URL(request.url).searchParams.get('date') ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const start = `${date}T00:00:00-03:00`; const end = `${date}T23:59:59.999-03:00`; const format = new URL(request.url).searchParams.get('format') ?? 'csv'
  const { data } = await (session as any).from('orders').select('public_code,customer_name,customer_phone,status,total,payment_method,created_at').gte('created_at', start).lte('created_at', end).order('created_at')
  const rows = [['Código', 'Cliente', 'Telefone', 'Status', 'Total', 'Pagamento', 'Criado em'], ...(data ?? []).map((row: any) => [row.public_code, row.customer_name, row.customer_phone, row.status, row.total, row.payment_method, new Date(row.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })])]
  if (format === 'csv') return new Response(rows.map((row) => row.map(escape).join(';')).join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="relatorio-${date}.csv"` } })
  const table = `<table border="1"><thead><tr>${rows[0].map((cell: unknown) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((row) => `<tr>${row.map((cell: unknown) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  const body = `<html><head><meta charset="utf-8"><title>Relatório ${date}</title></head><body><h1>Relatório de pedidos — ${date}</h1>${table}</body></html>`
  if (format === 'pdf') return new Response(`${body}<script>window.onload=()=>window.print()</script>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `inline; filename="relatorio-${date}.html"` } })
  if (format === 'xlsx') { const workbook = utils.book_new(); utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), 'Relatório'); const buffer = write(workbook, { bookType: 'xlsx', type: 'buffer' }); return new Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="relatorio-${date}.xlsx"` } }) }
  const contentType = 'application/msword'
  return new Response(body, { headers: { 'Content-Type': `${contentType}; charset=utf-8`, 'Content-Disposition': `attachment; filename="relatorio-${date}.${format === 'xlsx' ? 'xls' : 'doc'}"` } })
}
