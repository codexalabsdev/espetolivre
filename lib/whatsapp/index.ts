export type WhatsAppMessage = { phone: string; text: string }
export function normalizeBrazilianPhone(phone: string) { return phone.replace(/\D/g, '').replace(/^0/, '55') }

export function buildOrderWhatsAppUrl(phone: string, publicCode: string) {
  const normalized = normalizeBrazilianPhone(phone)
  const text = encodeURIComponent(`Olá! Estou entrando em contato sobre o pedido ${publicCode}.`)
  return `https://wa.me/${normalized}?text=${text}`
}
