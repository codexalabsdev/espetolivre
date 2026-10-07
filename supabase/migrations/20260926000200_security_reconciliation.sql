-- Reconciliação de segurança da fundação Supabase.
-- Esta migration deve ser aplicada depois das migrations iniciais, checkout e auditoria.

create extension if not exists pgcrypto;

-- Código público obrigatório, curto e não sequencial.
update public.orders
set public_code = public.generate_public_order_code()
where public_code is null;
alter table public.orders alter column public_code set not null;
alter table public.orders drop constraint if exists orders_public_code_format;
alter table public.orders add constraint orders_public_code_format
  check (public_code ~ '^ESP-[A-Z0-9]{4}$');
create unique index if not exists orders_public_code_unique_idx
  on public.orders(public_code);

-- A leitura pública de pedidos acontece somente pela função que remove IDs internos.
-- As policies anteriores permitiam enumerar todos os pedidos pela Data API.
drop policy if exists orders_public_code_select on public.orders;
drop policy if exists order_items_public_code_select on public.order_items;
drop policy if exists history_public_code_select on public.order_status_history;
revoke select on public.orders, public.order_items, public.order_status_history from anon;

-- Apenas o dono e o desenvolvedor administram usuários, roles e configurações.
create or replace function public.is_admin()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('OWNER'::public.user_role, 'DEVELOPER'::public.user_role), false);
$$;

create or replace function public.can_manage_roles()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select public.is_admin();
$$;

-- Impede que um usuário autenticado altere seu próprio role ou status.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
for update to authenticated
using (id = (select auth.uid()) and not public.is_admin())
with check (
  id = (select auth.uid())
  and role = public.current_user_role()
  and is_active = (select is_active from public.profiles where id = (select auth.uid()))
);

-- Somente administradores podem alterar perfis de terceiros.
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
for all to authenticated
using (public.can_manage_roles())
with check (public.can_manage_roles());

-- Funções privilegiadas não ficam expostas como APIs abertas e usam search_path fixo.
revoke all on function public.generate_public_order_code() from public;
revoke all on function public.set_order_public_code() from public;
revoke all on function public.record_order_status_change() from public;
revoke all on function public.handle_new_user() from public;

-- Histórico sempre começa com o status inicial, mesmo quando a inserção vem de outro fluxo.
create or replace function public.record_initial_order_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.order_status_history h
    where h.order_id = new.id and h.status = new.status
  ) then
    insert into public.order_status_history(order_id, status, note)
    values (new.id, new.status, 'Pedido criado');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_initial_status_trigger on public.orders;
create trigger orders_initial_status_trigger
after insert on public.orders
for each row execute function public.record_initial_order_status();
revoke all on function public.record_initial_order_status() from public;

-- Realtime mantém a identidade completa para os consumidores autorizados.
alter table public.orders replica identity full;
alter table public.order_status_history replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.order_status_history;
exception when duplicate_object then null;
end $$;

-- Storage de imagens do catálogo: bucket público para leitura e escrita apenas administrativa.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'product-images' and public.is_admin());

-- Privilégios mínimos para a aplicação; o checkout usa a RPC SECURITY DEFINER.
revoke all on public.customers, public.addresses from anon;
revoke all on public.orders, public.order_items, public.order_status_history from anon;
revoke insert, update, delete on public.products, public.categories, public.business_settings, public.business_hours from authenticated;
grant select on public.categories, public.products, public.business_settings, public.business_hours to anon;
 grant select, insert, update, delete on public.products, public.categories, public.business_settings, public.business_hours to authenticated;
 grant execute on function public.create_public_order(jsonb) to anon, authenticated;
 grant execute on function public.get_public_order(text) to anon, authenticated;

-- A função pública de acompanhamento não expõe customer_id/address_id/IDs de usuários.
-- O cliente acessa somente o pedido que possui o código público.
revoke all on function public.get_public_order(text) from public;
grant execute on function public.get_public_order(text) to anon, authenticated;

-- Perfis são criados automaticamente no signup do Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

comment on table public.profiles is 'Roles administrativos vinculados exclusivamente a auth.users.';
comment on function public.create_public_order(jsonb) is 'Valida e recalcula o checkout dentro do PostgreSQL; nunca confia em preço do cliente.';
comment on function public.get_public_order(text) is 'Leitura pública limitada ao código não sequencial do pedido.';

-- Corrige a migration caso um ambiente tenha aplicado um default antigo.
alter table public.orders alter column status set default 'NEW';

-- A migration é estrutural; nenhuma credencial é armazenada no repositório.
