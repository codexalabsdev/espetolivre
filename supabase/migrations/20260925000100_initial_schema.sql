create extension if not exists pgcrypto;

create type public.user_role as enum ('OWNER', 'OPERATOR', 'ATTENDANT', 'DEVELOPER');
create type public.order_status as enum ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');
create type public.order_type as enum ('PICKUP', 'DELIVERY', 'DINE_IN');

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'ATTENDANT',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'Principal',
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  reference text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  price numeric(12,2) not null check (price >= 0),
  image_path text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid references public.customers(id) on delete set null,
  address_id uuid references public.addresses(id) on delete set null,
  type public.order_type not null,
  status public.order_status not null default 'PENDING',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) generated always as (subtotal + delivery_fee) stored,
  customer_name text not null,
  customer_phone text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 99),
  notes text,
  line_total numeric(12,2) generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'Espeto Livre',
  phone text,
  whatsapp text,
  address text,
  logo_path text,
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  dine_in_enabled boolean not null default false,
  min_order_value numeric(12,2) not null default 0 check (min_order_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null unique check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_closed and opens_at is null and closes_at is null) or (not is_closed and opens_at is not null and closes_at is not null and opens_at < closes_at))
);

create index products_category_active_idx on public.products(category_id, is_available, sort_order);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index order_history_order_created_idx on public.order_status_history(order_id, created_at desc);
create index addresses_customer_idx on public.addresses(customer_id);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger business_settings_updated_at before update on public.business_settings for each row execute function public.set_updated_at();
create trigger business_hours_updated_at before update on public.business_hours for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', '')) on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.current_user_role() returns public.user_role
language sql stable security invoker set search_path = public as $$
  select role from public.profiles where id = (select auth.uid()) and is_active = true limit 1;
$$;

create or replace function public.is_staff() returns boolean
language sql stable security invoker set search_path = public as $$
  select coalesce(public.current_user_role() in ('OWNER', 'OPERATOR', 'ATTENDANT', 'DEVELOPER'), false);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = public as $$
  select coalesce(public.current_user_role() in ('OWNER', 'OPERATOR', 'DEVELOPER'), false);
$$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_hours enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid()) or public.is_admin()) with check (id = (select auth.uid()) or public.is_admin());
create policy profiles_admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy categories_public_select on public.categories for select to anon, authenticated using (is_active or public.is_staff());
create policy categories_staff_write on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_public_select on public.products for select to anon, authenticated using (is_available or public.is_staff());
create policy products_staff_write on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_public_select on public.business_settings for select to anon, authenticated using (true);
create policy settings_admin_write on public.business_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy hours_public_select on public.business_hours for select to anon, authenticated using (true);
create policy hours_admin_write on public.business_hours for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy customers_self_or_staff on public.customers for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
create policy customers_self_insert on public.customers for insert to authenticated with check (user_id = (select auth.uid()) or public.is_staff());
create policy customers_self_update on public.customers for update to authenticated using (user_id = (select auth.uid()) or public.is_staff()) with check (user_id = (select auth.uid()) or public.is_staff());
create policy addresses_owner_or_staff on public.addresses for all to authenticated using (exists (select 1 from public.customers c where c.id = customer_id and (c.user_id = (select auth.uid()) or public.is_staff()))) with check (exists (select 1 from public.customers c where c.id = customer_id and (c.user_id = (select auth.uid()) or public.is_staff())));

create policy orders_owner_or_staff on public.orders for select to authenticated using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())) or public.is_staff());
create policy orders_customer_insert on public.orders for insert to authenticated with check (public.is_staff() or exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())));
create policy orders_staff_update on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy order_items_order_access on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (public.is_staff() or exists (select 1 from public.customers c where c.id = o.customer_id and c.user_id = (select auth.uid())))));
create policy order_items_insert_access on public.order_items for insert to authenticated with check (exists (select 1 from public.orders o where o.id = order_id and (public.is_staff() or exists (select 1 from public.customers c where c.id = o.customer_id and c.user_id = (select auth.uid())))));
create policy history_staff_access on public.order_status_history for select to authenticated using (public.is_staff());
create policy history_staff_insert on public.order_status_history for insert to authenticated with check (public.is_staff() and changed_by = (select auth.uid()));

revoke all on public.profiles, public.customers, public.addresses, public.categories, public.products, public.orders, public.order_items, public.order_status_history, public.business_settings, public.business_hours from anon;
grant select on public.categories, public.products, public.business_settings, public.business_hours to anon;
grant select, insert, update on public.customers, public.addresses, public.orders, public.order_items to authenticated;
grant select, update on public.profiles to authenticated;
