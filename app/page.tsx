import { Storefront } from '@/components/menu/storefront'
import { getPublicMenu } from '@/services/menu'

function getStoreStatus(hours: { day_of_week: number; opens_at: string | null; closes_at: string | null; is_closed: boolean }[], settings: { accepting_orders: boolean; manual_closed: boolean } | null) {
  const now = new Date()
  const localParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now)
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const
  const weekday = localParts.find((part) => part.type === 'weekday')?.value as keyof typeof weekdays
  const current = Number(localParts.find((part) => part.type === 'hour')?.value ?? 0) * 60 + Number(localParts.find((part) => part.type === 'minute')?.value ?? 0)
  const today = hours.find((hour) => hour.day_of_week === weekdays[weekday])
  const todayHours = today?.opens_at && today?.closes_at ? `${today.opens_at.slice(0, 5)} — ${today.closes_at.slice(0, 5)}` : null
  if (!today || today.is_closed || !today.opens_at || !today.closes_at || settings?.manual_closed || settings?.accepting_orders !== true) return { isOpen: false, acceptingOrders: false, todayHours }
  const [openHour, openMinute] = today.opens_at.split(':').map(Number)
  const [closeHour, closeMinute] = today.closes_at.split(':').map(Number)
  const opens = openHour * 60 + openMinute
  const closes = closeHour * 60 + closeMinute
  const isOpen = closes > opens ? current >= opens && current < closes : current >= opens || current < closes
  return { isOpen, acceptingOrders: isOpen && settings?.accepting_orders === true, todayHours }
}

export default async function Page() {
  const menu = await getPublicMenu()
  const status = getStoreStatus(menu.hours, menu.settings)
  const hoursSummary = menu.hours.map((hour) => `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][hour.day_of_week]}: ${hour.is_closed || !hour.opens_at || !hour.closes_at ? 'Fechado' : `${hour.opens_at.slice(0, 5)}–${hour.closes_at.slice(0, 5)}`}`).join(' · ')
  return <Storefront categories={menu.categories} products={menu.products} businessName={menu.settings?.business_name || 'Espeto Livre'} logoPath={menu.settings?.logo_path ?? null} phone={menu.settings?.phone ?? null} whatsapp={menu.settings?.whatsapp ?? null} address={menu.settings?.address ?? null} isOpen={status.isOpen} acceptingOrders={status.acceptingOrders} todayHours={status.todayHours} hoursSummary={hoursSummary} />
}
