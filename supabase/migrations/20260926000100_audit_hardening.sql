-- Auditoria Parte 7: campos operacionais, checkout seguro e leitura pública restrita.
create extension if not exists pgcrypto;

alter table public.orders add column if not exists public_code text;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists cash_change_for numeric(12,2);
alter table public.orders add column if not exists idempotency_key uuid;
alter table public.orders add constraint orders_public_code_format check (public_code is null or public_code ~ '^ESP-[A-Z0-9]{4}$');
alter table public.orders add constraint orders_payment_method_check check (payment_method is null or payment_method in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD'));
alter table public.orders add constraint orders_cash_change_check check (cash_change_for is null or cash_change_for >= 0);
create unique index if not exists orders_public_code_unique on public.orders(public_code) where public_code is not null;
create unique index if not exists orders_idempotency_unique on public.orders(idempotency_key) where idempotency_key is not null;

alter table public.business_settings add column if not exists description text;
alter table public.business_settings add column if not exists estimated_minutes integer not null default 45 check (estimated_minutes > 0);
alter table public.business_settings add column if not exists delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0);
alter table public.business_settings add column if not exists accepting_orders boolean not null default true;
alter table public.business_settings add column if not exists manual_closed boolean not null default false;
alter table public.business_settings add column if not exists closed_message text;

alter table public.order_items add column if not exists subtotal numeric(12,2);
update public.order_items set subtotal = line_total where subtotal is null;
alter table public.order_items alter column subtotal set default 0;

create or replace function public.generate_public_order_code()
returns text language plpgsql volatile set search_path = public, pg_temp as $$
declare candidate text;
begin
  loop
    candidate := 'ESP-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4));
    exit when not exists (select 1 from public.orders where public_code = candidate);
  end loop;
  return candidate;
end; $$;

create or replace function public.set_order_public_code()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.public_code is null or new.public_code = '' then new.public_code := public.generate_public_order_code(); end if;
  return new;
end; $$;
drop trigger if exists orders_public_code_trigger on public.orders;
create trigger orders_public_code_trigger before insert on public.orders for each row execute function public.set_order_public_code();

create or replace function public.record_order_status_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status is distinct from new.status then
    insert into public.order_status_history(order_id, status, changed_by) values (new.id, new.status, auth.uid());
  end if;
  return new;
end; $$;
drop trigger if exists orders_status_history_trigger on public.orders;
create trigger orders_status_history_trigger after update of status on public.orders for each row execute function public.record_order_status_change();

create or replace function public.create_public_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb; p record; o public.orders; cid uuid; aid uuid; sub numeric(12,2) := 0; fee numeric(12,2) := 0; key uuid; setting record; q integer;
begin
  if jsonb_array_length(coalesce(payload->'items','[]'::jsonb)) = 0 then raise exception 'Carrinho vazio'; end if;
  select * into setting from public.business_settings order by created_at limit 1;
  if setting is not null and (not setting.accepting_orders or setting.manual_closed) then raise exception 'Pedidos pausados'; end if;
  key := nullif(payload->>'idempotency_key','')::uuid;
  if key is not null then select * into o from public.orders where idempotency_key = key; if found then return jsonb_build_object('id',o.id,'public_code',o.public_code,'total',o.total); end if; end if;
  select id into cid from public.customers where phone = trim(payload->>'customer_phone') limit 1;
  if cid is null then insert into public.customers(full_name, phone, email) values (trim(payload->>'customer_name'), trim(payload->>'customer_phone'), nullif(trim(payload->>'email'),'')) returning id into cid;
  else update public.customers set full_name=trim(payload->>'customer_name'), email=coalesce(nullif(trim(payload->>'email'),''),email) where id=cid; end if;
  if payload->>'type' = 'DELIVERY' then
    fee := coalesce(setting.delivery_fee, 0);
    insert into public.addresses(customer_id, street, number, complement, neighborhood, city, state, postal_code, reference) values (cid, payload->>'street', payload->>'number', nullif(payload->>'complement',''), payload->>'neighborhood', payload->>'city', payload->>'state', payload->>'postal_code', nullif(payload->>'reference','')) returning id into aid;
  end if;
  insert into public.orders(customer_id,address_id,type,status,subtotal,delivery_fee,customer_name,customer_phone,payment_method,cash_change_for,notes,idempotency_key) values (cid,aid,(payload->>'type')::public.order_type,'PENDING',0,fee,trim(payload->>'customer_name'),trim(payload->>'customer_phone'),payload->>'payment_method',nullif(payload->>'cash_change_for','')::numeric,payload->>'notes',key) returning * into o;
  for item in select * from jsonb_array_elements(payload->'items') loop
    q := (item->>'quantity')::integer; if q < 1 or q > 99 then raise exception 'Quantidade inválida'; end if;
    select id,name,price into p from public.products where id=(item->>'product_id')::uuid and is_available=true;
    if not found then raise exception 'Produto indisponível'; end if;
    sub := sub + p.price * q;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,notes,subtotal) values(o.id,p.id,p.name,p.price,q,item->>'notes',p.price*q);
  end loop;
  update public.orders set subtotal=sub where id=o.id returning * into o;
  insert into public.order_status_history(order_id,status) values(o.id,o.status);
  return jsonb_build_object('id',o.id,'public_code',o.public_code,'total',o.total);
exception when unique_violation then raise exception 'Pedido duplicado';
end; $$;
revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;

create or replace function public.get_public_order(order_code text)
returns jsonb language sql security definer stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'order', to_jsonb(o) - 'customer_id' - 'address_id' - 'idempotency_key',
    'items', coalesce((select jsonb_agg(to_jsonb(i) - 'order_id' order by i.created_at) from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(h) - 'order_id' - 'changed_by' order by h.created_at) from public.order_status_history h where h.order_id = o.id), '[]'::jsonb)
  ) from public.orders o where o.public_code = upper(trim(order_code));
$$;
revoke all on function public.get_public_order(text) from public;
grant execute on function public.get_public_order(text) to anon, authenticated;
revoke all on public.orders, public.order_items, public.order_status_history from anon;

do $$ begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.order_status_history; exception when duplicate_object then null; end $$;
