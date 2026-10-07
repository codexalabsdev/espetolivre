-- Integridade adicional do checkout: validações server-side e idempotência.

create or replace function public.create_public_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.orders;
  request_key uuid;
  setting record;
  item jsonb;
  product record;
  quantity integer;
  subtotal numeric(12,2) := 0;
  delivery_fee numeric(12,2) := 0;
  customer_id uuid;
  address_id uuid;
  created public.orders;
begin
  if nullif(trim(payload->>'customer_name'), '') is null
    or nullif(trim(payload->>'customer_phone'), '') is null then
    raise exception 'Informe nome e telefone';
  end if;

  request_key := nullif(payload->>'idempotency_key', '')::uuid;
  if request_key is not null then
    select * into existing from public.orders where idempotency_key = request_key;
    if found then
      return jsonb_build_object('id', existing.id, 'public_code', existing.public_code, 'total', existing.total);
    end if;
  end if;

  select * into setting from public.business_settings order by created_at limit 1;
  if setting is not null and (not setting.accepting_orders or setting.manual_closed) then
    raise exception 'Pedidos pausados';
  end if;

  if payload->>'type' not in ('DELIVERY', 'PICKUP') then raise exception 'Tipo de entrega inválido'; end if;
  if payload->>'payment_method' not in ('PIX', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD') then raise exception 'Pagamento inválido'; end if;
  if payload->>'payment_method' = 'CASH' and coalesce((payload->>'cash_change_for')::numeric, 0) < 0 then raise exception 'Troco inválido'; end if;
  if jsonb_array_length(coalesce(payload->'items', '[]'::jsonb)) = 0 then raise exception 'Carrinho vazio'; end if;

  select id into customer_id from public.customers where phone = trim(payload->>'customer_phone') limit 1;
  if customer_id is null then
    insert into public.customers(full_name, phone, email) values (trim(payload->>'customer_name'), trim(payload->>'customer_phone'), nullif(trim(payload->>'email'), '')) returning id into customer_id;
  end if;

  if payload->>'type' = 'DELIVERY' then
    if nullif(trim(payload->>'street'), '') is null or nullif(trim(payload->>'number'), '') is null
      or nullif(trim(payload->>'neighborhood'), '') is null or nullif(trim(payload->>'city'), '') is null
      or nullif(trim(payload->>'state'), '') is null or nullif(trim(payload->>'postal_code'), '') is null then
      raise exception 'Informe o endereço completo';
    end if;
    delivery_fee := coalesce(setting.delivery_fee, 0);
    insert into public.addresses(customer_id, street, number, complement, neighborhood, city, state, postal_code, reference)
    values (customer_id, payload->>'street', payload->>'number', nullif(payload->>'complement',''), payload->>'neighborhood', payload->>'city', payload->>'state', payload->>'postal_code', nullif(payload->>'reference','')) returning id into address_id;
  end if;

  insert into public.orders(customer_id, address_id, type, status, subtotal, delivery_fee, customer_name, customer_phone, payment_method, cash_change_for, idempotency_key, notes)
  values (customer_id, address_id, payload->>'type', 'PENDING', 0, delivery_fee, trim(payload->>'customer_name'), trim(payload->>'customer_phone'), payload->>'payment_method', nullif(payload->>'cash_change_for','')::numeric, request_key, nullif(payload->>'notes','')) returning * into created;

  for item in select * from jsonb_array_elements(payload->'items') loop
    quantity := (item->>'quantity')::integer;
    if quantity < 1 or quantity > 99 then raise exception 'Quantidade inválida'; end if;
    select id, name, price, is_active, is_available into product from public.products where id = (item->>'product_id')::uuid for update;
    if not found or not product.is_active or not product.is_available then raise exception 'Produto indisponível'; end if;
    subtotal := subtotal + product.price * quantity;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, subtotal, notes)
    values (created.id, product.id, product.name, product.price, quantity, product.price * quantity, nullif(item->>'notes',''));
  end loop;

  update public.orders set subtotal = subtotal where id = created.id returning * into created;
  if setting is not null and created.subtotal < setting.min_order_value then raise exception 'Pedido mínimo não atingido'; end if;
  return jsonb_build_object('id', created.id, 'public_code', created.public_code, 'total', created.total);
exception when unique_violation then
  select * into existing from public.orders where idempotency_key = request_key;
  if found then return jsonb_build_object('id', existing.id, 'public_code', existing.public_code, 'total', existing.total); end if;
  raise;
end;
$$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;
