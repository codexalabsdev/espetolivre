import Link from 'next/link'
import { getPublicOrder } from '@/services/orders'
import { PublicOrderTracker } from '@/components/orders/public-order-tracker'
import { PixCopyButton } from '@/components/orders/pix-copy-button'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPixPayload, pixQrUrl } from '@/lib/pix'

export default async function OrderPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const order = await getPublicOrder(codigo)
  if (!order) return <main className="grid min-h-screen place-items-center bg-[#f7f3ed] p-6 text-center"><div><h1 className="text-3xl font-black">Pedido não encontrado</h1><p className="mt-2 text-[#89796e]">Confira o código informado.</p><Link href="/" className="mt-5 inline-block rounded-full bg-[#e76f27] px-5 py-3 font-bold text-white">Voltar ao cardápio</Link></div></main>

  const { data: settings } = await (createAdminClient() as any).from('business_settings').select('pix_key,business_name').limit(1).maybeSingle()
  const pixPayload = order.payment_method === 'PIX' && settings?.pix_key ? createPixPayload({ key: settings.pix_key, amount: Number(order.total), txid: order.public_code, merchantName: settings.business_name ?? 'ESPETO LIVRE' }) : null
  const pixQr = pixPayload ? pixQrUrl(pixPayload) : null

  return <main className="grid min-h-screen place-items-center bg-[#f7f3ed] p-6"><div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><div className="mx-auto grid size-16 place-items-center rounded-full bg-[#e4f8ed] text-3xl">✓</div><p className="mt-6 text-xs font-black uppercase tracking-widest text-[#e76f27]">Pedido realizado!</p><h1 className="mt-2 text-4xl font-black text-[#201a16]">{order.public_code}</h1><p className="mt-3 text-[#89796e]">Seu pedido foi recebido e já está sendo preparado.</p><div className="my-7 rounded-2xl bg-[#f7f3ed] p-4"><p className="text-sm text-[#89796e]">Acompanhamento em tempo real</p><PublicOrderTracker code={order.public_code} initialStatus={order.status} initialHistory={order.history ?? []} /><p className="mt-5 text-sm text-[#89796e]">Total: <b className="text-[#201a16]">R$ {Number(order.total).toFixed(2).replace('.', ',')}</b></p></div>{pixQr&&<div className="rounded-2xl border border-[#e8dfd5] bg-white p-4"><h2 className="font-black text-[#201a16]">Pague com Pix</h2><img src={pixQr} alt="QR Code Pix do pedido" className="mx-auto mt-3 size-52" /><p className="mt-2 text-xs text-[#89796e]">Escaneie o QR Code ou copie o código Pix</p><PixCopyButton value={pixPayload ?? ''} /></div>}{!pixQr&&order.payment_method==='PIX'&&<p className="mt-4 text-sm text-[#b45309]">A chave Pix da loja ainda não foi cadastrada nas configurações.</p>}<Link href="/" className="mt-5 block rounded-xl bg-[#e76f27] px-4 py-3 font-black text-white">Voltar ao cardápio</Link></div></main>
}
