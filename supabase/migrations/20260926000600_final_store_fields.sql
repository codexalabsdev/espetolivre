alter table public.products add column if not exists is_active boolean not null default true;
alter table public.business_settings add column if not exists description text;
alter table public.business_settings add column if not exists delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0);
alter table public.business_settings add column if not exists estimated_minutes integer not null default 35 check (estimated_minutes between 1 and 480);
alter table public.business_settings add column if not exists accepting_orders boolean not null default true;
alter table public.business_settings add column if not exists manual_closed boolean not null default false;
alter table public.business_settings add column if not exists closed_message text;
create index if not exists products_public_catalog_idx on public.products(category_id, is_active, is_available, sort_order);
update public.products set is_active = true where is_active is null;

create or replace function public.set_order_status(next_status public.order_status, target_order uuid, status_note text default null)
returns public.orders language plpgsql security invoker set search_path = public as $$
declare updated_order public.orders;
begin
  if not public.is_staff() then raise exception 'Acesso negado'; end if;
  update public.orders set status = next_status, updated_at = now() where id = target_order returning * into updated_order;
  if updated_order.id is null then raise exception 'Pedido não encontrado'; end if;
  insert into public.order_status_history(order_id, status, changed_by, note) values (target_order, next_status, auth.uid(), status_note);
  return updated_order;
end; $$;
revoke all on function public.set_order_status(public.order_status, uuid, text) from public;
grant execute on function public.set_order_status(public.order_status, uuid, text) to authenticated;
