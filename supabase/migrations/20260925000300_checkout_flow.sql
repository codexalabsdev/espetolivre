alter type public.order_status add value if not exists 'NEW';
alter table public.orders add column if not exists public_code text unique;
alter table public.orders add column if not exists payment_method text check (payment_method in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD'));
alter table public.orders add column if not exists cash_change_for numeric(12,2) check (cash_change_for is null or cash_change_for >= 0);
alter table public.business_settings add column if not exists delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0);
create unique index if not exists orders_public_code_idx on public.orders(public_code);

create or replace function public.generate_public_order_code()
returns text language plpgsql volatile set search_path = public as $$
declare candidate text;
begin
  loop
    candidate := 'ESP-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
    exit when not exists (select 1 from public.orders where public_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_public_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item jsonb; product_row public.products%rowtype; setting_row public.business_settings%rowtype;
  new_customer_id uuid; new_address_id uuid; new_order_id uuid; code text;
  calculated_subtotal numeric(12,2) := 0; calculated_fee numeric(12,2) := 0; line numeric(12,2);
  requested_type public.order_type; requested_payment text; quantity_int integer;
begin
  if jsonb_array_length(coalesce(payload->'items', '[]'::jsonb)) = 0 then raise exception 'cart_empty'; end if;
  if nullif(trim(payload->>'customer_name'), '') is null or nullif(trim(payload->>'customer_phone'), '') is null then raise exception 'customer_required'; end if;
  requested_type := (payload->>'type')::public.order_type;
  requested_payment := payload->>'payment_method';
  if requested_payment not in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD') then raise exception 'payment_invalid'; end if;
  if requested_type = 'DELIVERY' and (nullif(trim(payload->>'street'), '') is null or nullif(trim(payload->>'number'), '') is null or nullif(trim(payload->>'neighborhood'), '') is null or nullif(trim(payload->>'city'), '') is null or nullif(trim(payload->>'state'), '') is null or nullif(trim(payload->>'postal_code'), '') is null) then raise exception 'address_required'; end if;
  select * into setting_row from public.business_settings order by created_at limit 1;
  if setting_row.id is null then raise exception 'settings_missing'; end if;
  if not setting_row.delivery_enabled and requested_type = 'DELIVERY' then raise exception 'delivery_unavailable'; end if;
  if not setting_row.pickup_enabled and requested_type = 'PICKUP' then raise exception 'pickup_unavailable'; end if;
  for item in select * from jsonb_array_elements(payload->'items') loop
    quantity_int := (item->>'quantity')::integer;
    if quantity_int < 1 or quantity_int > 99 then raise exception 'quantity_invalid'; end if;
    select * into product_row from public.products where id = (item->>'product_id')::uuid and is_available = true;
    if product_row.id is null then raise exception 'product_unavailable'; end if;
    line := product_row.price * quantity_int; calculated_subtotal := calculated_subtotal + line;
  end loop;
  calculated_fee := case when requested_type = 'DELIVERY' then setting_row.delivery_fee else 0 end;
  if calculated_subtotal < setting_row.min_order_value then raise exception 'minimum_order'; end if;
  insert into public.customers (full_name, phone, email) values (trim(payload->>'customer_name'), trim(payload->>'customer_phone'), nullif(trim(payload->>'email'), '')) returning id into new_customer_id;
  if requested_type = 'DELIVERY' then
    insert into public.addresses (customer_id, street, number, complement, neighborhood, city, state, postal_code, reference) values (new_customer_id, trim(payload->>'street'), trim(payload->>'number'), nullif(trim(payload->>'complement'), ''), trim(payload->>'neighborhood'), trim(payload->>'city'), trim(payload->>'state'), trim(payload->>'postal_code'), nullif(trim(payload->>'reference'), '')) returning id into new_address_id;
  end if;
  code := public.generate_public_order_code();
  insert into public.orders (public_code, customer_id, address_id, type, status, subtotal, delivery_fee, customer_name, customer_phone, payment_method, cash_change_for, notes) values (code, new_customer_id, new_address_id, requested_type, 'NEW', calculated_subtotal, calculated_fee, trim(payload->>'customer_name'), trim(payload->>'customer_phone'), requested_payment, case when requested_payment = 'CASH' then (payload->>'cash_change_for')::numeric else null end, nullif(trim(payload->>'notes'), '')) returning id into new_order_id;
  for item in select * from jsonb_array_elements(payload->'items') loop
    select * into product_row from public.products where id = (item->>'product_id')::uuid;
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, notes) values (new_order_id, product_row.id, product_row.name, product_row.price, (item->>'quantity')::integer, nullif(trim(item->>'notes'), ''));
  end loop;
  insert into public.order_status_history (order_id, status, note) values (new_order_id, 'NEW', 'Pedido criado pelo cardápio público');
  return jsonb_build_object('id', new_order_id, 'public_code', code, 'total', calculated_subtotal + calculated_fee);
end;
$$;
revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;

create policy orders_public_code_select on public.orders for select to anon, authenticated using (public_code is not null);
create policy order_items_public_code_select on public.order_items for select to anon, authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.public_code is not null));
create policy history_public_code_select on public.order_status_history for select to anon, authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.public_code is not null));

alter table public.orders replica identity full;

-- Realtime is enabled for order tracking when the project enables the public publication.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT ON public.orders, public.order_items, public.order_status_history TO anon, authenticated;

create index if not exists orders_public_code_lower_idx on public.orders(lower(public_code));
update public.orders set public_code = public.generate_public_order_code() where public_code is null;
alter table public.orders alter column public_code set not null;
alter table public.orders alter column status set default 'NEW';

