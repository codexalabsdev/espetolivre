-- Integra o cálculo configurado de entrega à criação segura do pedido.
create or replace function public.calculate_delivery_distance(
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric
) returns numeric
language plpgsql immutable strict set search_path = public as $$
declare
  earth_km constant numeric := 6371;
  lat_delta numeric;
  lng_delta numeric;
  a numeric;
begin
  if origin_lat not between -90 and 90 or destination_lat not between -90 and 90
    or origin_lng not between -180 and 180 or destination_lng not between -180 and 180 then
    raise exception 'coordinates_invalid';
  end if;
  lat_delta := radians(destination_lat - origin_lat);
  lng_delta := radians(destination_lng - origin_lng);
  a := power(sin(lat_delta / 2), 2)
    + cos(radians(origin_lat)) * cos(radians(destination_lat)) * power(sin(lng_delta / 2), 2);
  return round((earth_km * 2 * atan2(sqrt(a), sqrt(greatest(0, 1 - a))))::numeric, 2);
end;
$$;

revoke all on function public.calculate_delivery_distance(numeric,numeric,numeric,numeric) from public;
grant execute on function public.calculate_delivery_distance(numeric,numeric,numeric,numeric) to anon, authenticated;

create or replace function public.create_public_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item jsonb; p record; o public.orders; cid uuid; aid uuid;
  sub numeric(12,2) := 0; fee numeric(12,2) := 0; key uuid; setting record; q integer;
  distance numeric(12,2); destination_lat numeric; destination_lng numeric;
begin
  if jsonb_array_length(coalesce(payload->'items','[]'::jsonb)) = 0 then raise exception 'Carrinho vazio'; end if;
  if nullif(trim(payload->>'customer_name'),'') is null or nullif(trim(payload->>'customer_phone'),'') is null then raise exception 'Cliente obrigatório'; end if;
  select * into setting from public.business_settings order by created_at limit 1;
  if setting is null then raise exception 'Configuração da loja ausente'; end if;
  if not coalesce(setting.accepting_orders, true) or coalesce(setting.manual_closed, false) then raise exception 'Pedidos pausados'; end if;
  key := nullif(payload->>'idempotency_key','')::uuid;
  if key is not null then
    select * into o from public.orders where idempotency_key = key;
    if found then return jsonb_build_object('id',o.id,'public_code',o.public_code,'total',o.total,'delivery_fee',o.delivery_fee); end if;
  end if;
  select id into cid from public.customers where phone = trim(payload->>'customer_phone') limit 1;
  if cid is null then
    insert into public.customers(full_name, phone, email) values (trim(payload->>'customer_name'), trim(payload->>'customer_phone'), nullif(trim(payload->>'email'),'')) returning id into cid;
  else
    update public.customers set full_name=trim(payload->>'customer_name'), email=coalesce(nullif(trim(payload->>'email'),''),email) where id=cid;
  end if;
  if payload->>'type' = 'DELIVERY' then
    if nullif(trim(payload->>'street'),'') is null or nullif(trim(payload->>'number'),'') is null or nullif(trim(payload->>'neighborhood'),'') is null or nullif(trim(payload->>'city'),'') is null or nullif(trim(payload->>'state'),'') is null then raise exception 'Endereço obrigatório'; end if;
    destination_lat := (payload->>'latitude')::numeric;
    destination_lng := (payload->>'longitude')::numeric;
    if setting.latitude is null or setting.longitude is null or destination_lat is null or destination_lng is null then raise exception 'Endereço sem geolocalização'; end if;
    distance := public.calculate_delivery_distance(setting.latitude, setting.longitude, destination_lat, destination_lng);
    fee := public.calculate_delivery_fee(distance, setting.gas_price_per_liter, setting.vehicle_consumption_km_per_liter, setting.courier_fixed_fee);
    insert into public.addresses(customer_id, street, number, complement, neighborhood, city, state, postal_code, reference) values (cid, payload->>'street', payload->>'number', nullif(payload->>'complement',''), payload->>'neighborhood', payload->>'city', payload->>'state', payload->>'postal_code', nullif(payload->>'reference','')) returning id into aid;
  elsif payload->>'type' <> 'PICKUP' then raise exception 'Modalidade inválida'; end if;
  insert into public.orders(customer_id,address_id,type,status,subtotal,delivery_fee,customer_name,customer_phone,payment_method,cash_change_for,notes,idempotency_key) values (cid,aid,(payload->>'type')::public.order_type,'PENDING',0,fee,trim(payload->>'customer_name'),trim(payload->>'customer_phone'),payload->>'payment_method',nullif(payload->>'cash_change_for','')::numeric,payload->>'notes',key) returning * into o;
  for item in select * from jsonb_array_elements(payload->'items') loop
    q := (item->>'quantity')::integer;
    if q < 1 or q > 99 then raise exception 'Quantidade inválida'; end if;
    select id,name,price into p from public.products where id=(item->>'product_id')::uuid and is_active=true and is_available=true;
    if not found then raise exception 'Produto indisponível'; end if;
    sub := sub + p.price * q;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,notes,subtotal) values(o.id,p.id,p.name,p.price,q,item->>'notes',p.price*q);
  end loop;
  if sub < coalesce(setting.min_order_value,0) then raise exception 'Pedido mínimo não atingido'; end if;
  update public.orders set subtotal=sub where id=o.id returning * into o;
  insert into public.order_status_history(order_id,status) values(o.id,o.status);
  return jsonb_build_object('id',o.id,'public_code',o.public_code,'subtotal',o.subtotal,'delivery_fee',o.delivery_fee,'total',o.total,'distance_km',distance);
exception when unique_violation then
  select * into o from public.orders where idempotency_key = key;
  if found then return jsonb_build_object('id',o.id,'public_code',o.public_code,'total',o.total,'delivery_fee',o.delivery_fee); end if;
  raise;
end; $$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;

comment on function public.create_public_order(jsonb) is 'Cria pedido público, recalcula itens e frete no servidor usando coordenadas e parâmetros da loja; nunca confia no total do cliente.';
