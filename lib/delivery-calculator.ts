export type DeliveryPricing = {
  gasPricePerLiter: number
  vehicleConsumptionKmPerLiter: number
  courierFixedFee: number
}

export function calculateDeliveryFee(distanceKm: number, pricing: DeliveryPricing) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error('Distância de entrega inválida.')
  if (pricing.gasPricePerLiter < 0 || pricing.vehicleConsumptionKmPerLiter <= 0 || pricing.courierFixedFee < 0) throw new Error('Parâmetros de frete inválidos.')
  return Number((pricing.courierFixedFee + (distanceKm * 2 * pricing.gasPricePerLiter) / pricing.vehicleConsumptionKmPerLiter).toFixed(2))
}

export function haversineDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos((from.latitude * Math.PI) / 180) * Math.cos((to.latitude * Math.PI) / 180) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function normalizeCoordinates(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const candidate = value as { latitude?: unknown; longitude?: unknown; lat?: unknown; lon?: unknown }
  const latitude = Number(candidate.latitude ?? candidate.lat)
  const longitude = Number(candidate.longitude ?? candidate.lon)
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null
}
