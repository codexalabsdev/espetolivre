import type { Tables } from '@/types/database'

export type BusinessHour = Tables<'business_hours'>
export function isBusinessDay(hour: BusinessHour) { return !hour.is_closed && Boolean(hour.opens_at && hour.closes_at) }
