import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrder, type CheckoutPayload } from '@/services/orders'

async function geocodeAddress(payload: Record<string, unknown>) {
  if (payload.type !== 'DELIVERY') return payload
  if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') return payload
  const parts = [payload.street, payload.number, payload.neighborhood, payload.city, payload.state, payload.postal_code, 'Brasil'].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
  if (parts.length < 4) throw new Error('Informe o endereço completo para calcular a entrega.')
  const queries = [
    parts.join(', '),
    [payload.postal_code, 'Brasil'].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(', '),
    [payload.street, payload.city, payload.state, 'Brasil'].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(', '),
  ].filter((query, index, all) => query.length > 0 && all.indexOf(query) === index)
  let latitude = Number.NaN
  let longitude = Number.NaN
  for (const query of queries) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'EspetoLivre/1.0 (pedido de entrega)' }, cache: 'no-store' })
    if (!response.ok) continue
    const results = await response.json() as Array<{ lat?: string; lon?: string }>
    latitude = Number(results[0]?.lat)
    longitude = Number(results[0]?.lon)
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) break
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Não foi possível localizar esse endereço. Confira CEP, rua, número, cidade e estado.')
  return { ...payload, latitude, longitude }
}

async function ensureStoreGeolocation() {
  const supabase = createAdminClient()
  const { data: settings, error } = await (supabase as any).from('business_settings').select('id,address,latitude,longitude').order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (error || !settings) throw new Error('Configuração da loja ausente')
  if (Number.isFinite(Number(settings.latitude)) && Number.isFinite(Number(settings.longitude))) return
  if (!settings.address?.trim()) throw new Error('Cadastre e salve o endereço da loja nas configurações antes de aceitar entregas.')
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(`${settings.address}, Brasil`)}`, { headers: { 'User-Agent': 'EspetoLivre/1.0 (configuração de entrega)' }, cache: 'no-store' })
  const result = (await response.json() as Array<{ lat?: string; lon?: string }>)[0]
  const latitude = Number(result?.lat)
  const longitude = Number(result?.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Não foi possível localizar o endereço da loja salvo nas configurações.')
  const { error: updateError } = await (supabase as any).from('business_settings').update({ latitude, longitude }).eq('id', settings.id)
  if (updateError) throw new Error('Não foi possível salvar a geolocalização da loja.')
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    if (!Array.isArray(payload?.items) || payload.items.length === 0) return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 })
    if (payload.type === 'DELIVERY') await ensureStoreGeolocation()
    const result = await createOrder(await geocodeAddress(payload) as CheckoutPayload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível criar o pedido.' }, { status: 400 }) }
}
