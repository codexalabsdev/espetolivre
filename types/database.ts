export type UserRole = 'OWNER' | 'OPERATOR' | 'ATTENDANT' | 'DEVELOPER'
export type OrderStatus = 'NEW' | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED'
export type OrderType = 'PICKUP' | 'DELIVERY' | 'DINE_IN'

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] }

type Profile = { id: string; full_name: string | null; phone: string | null; role: UserRole; is_active: boolean; created_at: string; updated_at: string }
type Customer = { id: string; user_id: string | null; full_name: string; phone: string; email: string | null; notes: string | null; created_at: string; updated_at: string }
type Address = { id: string; customer_id: string; label: string; street: string; number: string; complement: string | null; neighborhood: string; city: string; state: string; postal_code: string; reference: string | null; is_default: boolean; created_at: string; updated_at: string }
type Category = { id: string; name: string; slug: string; description: string | null; sort_order: number; is_active: boolean; created_at: string; updated_at: string }
type Product = { id: string; category_id: string; name: string; slug: string; description: string | null; price: number; image_path: string | null; sort_order: number; is_active: boolean; is_available: boolean; created_at: string; updated_at: string }
type Order = { id: string; order_number: number; public_code: string; customer_id: string | null; address_id: string | null; type: OrderType; status: OrderStatus; subtotal: number; delivery_fee: number; total: number; customer_name: string; customer_phone: string; payment_method: 'PIX' | 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | null; cash_change_for: number | null; idempotency_key: string | null; notes: string | null; created_at: string; updated_at: string }
type OrderItem = { id: string; order_id: string; product_id: string | null; product_name: string; unit_price: number; quantity: number; notes: string | null; line_total: number; created_at: string }
type OrderStatusHistory = { id: string; order_id: string; status: OrderStatus; changed_by: string | null; note: string | null; created_at: string }
type BusinessSettings = { id: string; business_name: string; description: string | null; phone: string | null; whatsapp: string | null; pix_key?: string | null; address: string | null; logo_path: string | null; delivery_enabled: boolean; pickup_enabled: boolean; dine_in_enabled: boolean; min_order_value: number; delivery_fee: number; gas_price_per_liter?: number | null; vehicle_consumption_km_per_liter?: number | null; courier_fixed_fee?: number | null; estimated_minutes: number; accepting_orders: boolean; manual_closed: boolean; closed_message: string | null; created_at: string; updated_at: string }
type BusinessHours = { id: string; day_of_week: number; opens_at: string | null; closes_at: string | null; is_closed: boolean; created_at: string; updated_at: string }

export interface Database {
  public: {
    Tables: {
      profiles: Row<Profile>; customers: Row<Customer>; addresses: Row<Address>; categories: Row<Category>; products: Row<Product>; orders: Row<Order>; order_items: Row<OrderItem>; order_status_history: Row<OrderStatusHistory>; business_settings: Row<BusinessSettings>; business_hours: Row<BusinessHours>
    }
    Views: Record<string, never>
    Functions: { current_user_role: { Args: Record<string, never>; Returns: UserRole | null }; is_staff: { Args: Record<string, never>; Returns: boolean }; is_admin: { Args: Record<string, never>; Returns: boolean } }
    Enums: { user_role: UserRole; order_status: OrderStatus; order_type: OrderType }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
