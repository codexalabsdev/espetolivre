import type { OrderStatus, OrderType } from '@/types/database'

export type OrderDraft = { type: OrderType; customerName: string; customerPhone: string; status?: OrderStatus; notes?: string }
export const orderStatusLabels: Record<OrderStatus, string> = { NEW: 'Novo', PENDING: 'Novo', CONFIRMED: 'Confirmado', PREPARING: 'Em preparo', READY: 'Pronto', OUT_FOR_DELIVERY: 'Saiu para entrega', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }
