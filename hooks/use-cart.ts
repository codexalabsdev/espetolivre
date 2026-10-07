'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { MenuProduct } from '@/services/menu'

export type CartItem = { product: MenuProduct; quantity: number; notes: string }
const KEY = 'espeto-livre-cart'
let items: CartItem[] = []
let hydrated = false
const listeners = new Set<() => void>()
const EMPTY_CART: CartItem[] = []

function readCart() {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(KEY) || '[]')
    if (Array.isArray(stored)) items = stored
  } catch {
    items = []
  }
}

function notify() {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(KEY, JSON.stringify(items))
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  readCart()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  readCart()
  return items
}

function getServerSnapshot() {
  return EMPTY_CART
}

export function useCart() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const add = useCallback((product: MenuProduct, quantity = 1, notes = '') => {
    readCart()
    const safeQuantity = Math.max(1, Math.min(99, Math.floor(quantity)))
    const existing = items.find((item) => item.product.id === product.id && item.notes === notes)
    items = existing
      ? items.map((item) => item === existing ? { ...item, quantity: Math.min(99, item.quantity + safeQuantity), product } : item)
      : [...items, { product, quantity: safeQuantity, notes }]
    notify()
  }, [])
  const update = useCallback((id: string, quantity: number, notes?: string) => {
    readCart()
    items = quantity <= 0
      ? items.filter((item) => item.product.id !== id)
      : items.map((item) => item.product.id === id ? { ...item, quantity: Math.max(1, Math.min(99, Math.floor(quantity))), notes: notes ?? item.notes } : item)
    notify()
  }, [])
  const clear = useCallback(() => { items = []; notify() }, [])
  const subtotal = useMemo(() => current.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0), [current])
  return { items: current, subtotal, count: current.reduce((sum, item) => sum + item.quantity, 0), add, update, clear, ready: hydrated }
}
