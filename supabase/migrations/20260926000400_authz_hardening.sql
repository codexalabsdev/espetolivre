-- Autorização estrutural para módulos administrativos.
create or replace function public.has_role(required_roles public.user_role[])
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(public.current_user_role() = any(required_roles), false);
$$;
revoke all on function public.has_role(public.user_role[]) from public;
grant execute on function public.has_role(public.user_role[]) to authenticated;

-- O grant amplo anterior não deve substituir as policies por role.
revoke insert, update, delete on public.products, public.categories, public.business_settings, public.business_hours from authenticated;

 drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all to authenticated
using (public.has_role(array['OWNER'::public.user_role, 'DEVELOPER'::public.user_role]))
with check (public.has_role(array['OWNER'::public.user_role, 'DEVELOPER'::public.user_role]));

 drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories for all to authenticated
using (public.has_role(array['OWNER'::public.user_role, 'DEVELOPER'::public.user_role]))
with check (public.has_role(array['OWNER'::public.user_role, 'DEVELOPER'::public.user_role]));

 drop policy if exists settings_admin_write on public.business_settings;
create policy settings_admin_write on public.business_settings for all to authenticated
using (public.has_role(array['OWNER'::public.user_role, 'DEVELOPER'::public.user_role]))
with check (public.has_role(array['OWNER'::public.user_role, 'DEVELOPER'::public.user_role]));

 drop policy if exists hours_admin_write on public.business_hours;
create policy hours_admin_write on public.business_hours for all to authenticated
using (public.has_role(array['OWNER'::public.user_role, 'DEVELOPER'::public.user_role]))
with check (public.has_role(array['OWNER'::public.user_role, 'DEVELOPER'::public.user_role]));

-- Operadores/atendentes visualizam a operação, mas não assumem administração.
drop policy if exists profiles_authenticated_select on public.profiles;
create policy profiles_authenticated_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.has_role(array['OWNER'::public.user_role, 'DEVELOPER'::public.user_role]));
