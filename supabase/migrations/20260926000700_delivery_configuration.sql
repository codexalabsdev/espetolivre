-- Configuração persistente da fórmula de entrega.
alter table public.business_settings
  add column if not exists gas_price_per_liter numeric(12,2) not null default 6.99,
  add column if not exists vehicle_consumption_km_per_liter numeric(12,2) not null default 18,
  add column if not exists courier_fixed_fee numeric(12,2) not null default 4,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7);

alter table public.business_settings
  drop constraint if exists business_settings_delivery_parameters_check;
alter table public.business_settings
  add constraint business_settings_delivery_parameters_check check (
    gas_price_per_liter >= 0 and
    vehicle_consumption_km_per_liter > 0 and
    courier_fixed_fee >= 0
  );

create or replace function public.calculate_delivery_fee(
  distance_km numeric,
  gas_price numeric,
  consumption_km_per_liter numeric,
  fixed_courier_fee numeric
) returns numeric
language plpgsql immutable strict set search_path = public as $$
begin
  if distance_km < 0 or gas_price < 0 or consumption_km_per_liter <= 0 or fixed_courier_fee < 0 then
    raise exception 'delivery_parameters_invalid';
  end if;
  return round((fixed_courier_fee + (distance_km * 2 * gas_price / consumption_km_per_liter))::numeric, 2);
end;
$$;

revoke all on function public.calculate_delivery_fee(numeric, numeric, numeric, numeric) from public;
grant execute on function public.calculate_delivery_fee(numeric, numeric, numeric, numeric) to anon, authenticated;

-- Remove políticas que expunham todos os pedidos públicos. O acompanhamento deve usar a RPC segura.
drop policy if exists orders_public_code_select on public.orders;
drop policy if exists order_items_public_code_select on public.order_items;
drop policy if exists history_public_code_select on public.order_status_history;
revoke select on public.orders, public.order_items, public.order_status_history from anon;

create or replace function public.get_public_order(order_code text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'public_code', o.public_code,
    'status', o.status,
    'type', o.type,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'payment_method', o.payment_method,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'address', case when a.id is null then null else jsonb_build_object('street', a.street, 'number', a.number, 'complement', a.complement, 'neighborhood', a.neighborhood, 'city', a.city, 'state', a.state, 'postal_code', a.postal_code, 'reference', a.reference) end,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'product_id', i.product_id, 'product_name', i.product_name, 'unit_price', i.unit_price, 'quantity', i.quantity, 'notes', i.notes, 'line_total', i.line_total) order by i.created_at) from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'status', h.status, 'note', h.note, 'created_at', h.created_at) order by h.created_at) from public.order_status_history h where h.order_id = o.id), '[]'::jsonb)
  ) into result
  from public.orders o left join public.addresses a on a.id = o.address_id
  where upper(o.public_code) = upper(trim(order_code));
  return result;
end;
$$;

revoke all on function public.get_public_order(text) from public;
grant execute on function public.get_public_order(text) to anon, authenticated;

-- Storage usado pelo catálogo e pela logo.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists product_images_public_read on storage.objects;
drop policy if exists product_images_staff_insert on storage.objects;
drop policy if exists product_images_staff_update on storage.objects;
drop policy if exists product_images_staff_delete on storage.objects;
create policy product_images_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
create policy product_images_staff_insert on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_staff_update on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_staff_delete on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- Garante que o catálogo público respeita ambos os estados.
drop policy if exists products_public_select on public.products;
create policy products_public_select on public.products for select to anon, authenticated using ((is_active and is_available) or public.is_staff());

create index if not exists business_settings_location_idx on public.business_settings(latitude, longitude);
create index if not exists products_public_catalog_idx on public.products(category_id, is_active, is_available, sort_order);
comment on function public.calculate_delivery_fee(numeric, numeric, numeric, numeric) is 'Fórmula: taxa fixa + (distância em km x 2 x preço da gasolina / consumo km/litro).';
comment on column public.business_settings.latitude is 'Latitude do estabelecimento para cálculo de distância.';
comment on column public.business_settings.longitude is 'Longitude do estabelecimento para cálculo de distância.';
comment on column public.business_settings.gas_price_per_liter is 'Preço atual da gasolina em R$/litro.';
comment on column public.business_settings.vehicle_consumption_km_per_liter is 'Consumo do veículo em km/litro.';
comment on column public.business_settings.courier_fixed_fee is 'Taxa fixa do entregador em R$.';

-- Aplicar a taxa configurada às novas criações exige que o payload da RPC envie distance_km.
-- A aplicação deve chamar calculate_delivery_fee no servidor; nunca aceitar delivery_fee vindo do navegador.
