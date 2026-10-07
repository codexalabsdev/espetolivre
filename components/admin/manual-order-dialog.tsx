'use client'

import { useEffect, useState } from 'react'

type Product = { id: string; name: string; price: number }
export function ManualOrderDialog({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (window.location.hash === '#manual-order') setOpen(true) }, [])
  const [customer, setCustomer] = useState({ name: '', phone: '' })
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage('')
    const items = Object.entries(selected).filter(([, quantity]) => quantity > 0).map(([product_id, quantity]) => ({ product_id, quantity }))
    const response = await fetch('/api/admin/manual-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_name: customer.name, customer_phone: customer.phone, items }) })
    const result = await response.json()
    if (!response.ok) { setMessage(result.error ?? 'Não foi possível criar o pedido.'); return }
    const publicCode = result.public_code ?? result.order?.public_code ?? result.data?.public_code ?? result.data?.order?.public_code; if (!publicCode) { setMessage('O pedido foi criado, mas o código não foi retornado.'); return } setMessage(`Pedido ${publicCode} criado com sucesso.`); setSelected({}); setCustomer({ name: '', phone: '' })
  }
  return <><button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-[#f39b36] px-4 py-2 text-sm font-black text-[#261812]">Criar pedido manual</button>{open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-black">Novo pedido interno</h3><button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button></div><div className="mt-4 grid gap-3"><input required placeholder="Nome do cliente" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="rounded-xl border p-3" /><input required placeholder="Telefone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="rounded-xl border p-3" />{products.map((product) => <label key={product.id} className="flex items-center justify-between rounded-xl border p-3 text-sm"><span>{product.name} — R$ {Number(product.price).toFixed(2).replace('.', ',')}</span><input type="number" min="0" max="99" value={selected[product.id] ?? 0} onChange={(e) => setSelected({ ...selected, [product.id]: Number(e.target.value) })} className="w-20 rounded-lg border p-2" /></label>)}<button className="rounded-xl bg-[#261812] px-4 py-3 font-black text-white">Lançar pedido</button>{message && <p className="text-sm font-semibold">{message}</p>}</div></form></div>}</>
}
