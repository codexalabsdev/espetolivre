create table if not exists public.public_order_updates (
  public_code text primary key references public.orders(public_code) on delete cascade,
  status public.order_status not null,
  updated_at timestamptz not null default now()
);

alter table public.public_order_updates enable row level security;
revoke all on public.public_order_updates from public;
grant select on public.public_order_updates to anon, authenticated;

drop policy if exists public_order_updates_read on public.public_order_updates;
create policy public_order_updates_read on public.public_order_updates
for select to anon, authenticated using (true);

create or replace function public.publish_public_order_update()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.public_order_updates(public_code, status, updated_at)
  values (new.public_code, new.status, coalesce(new.updated_at, now()))
  on conflict (public_code) do update set status = excluded.status, updated_at = excluded.updated_at;
  return new;
end;
$$;

revoke all on function public.publish_public_order_update() from public;
drop trigger if exists orders_public_realtime_trigger on public.orders;
create trigger orders_public_realtime_trigger
after insert or update of status on public.orders
for each row execute function public.publish_public_order_update();

do $$ begin
  alter publication supabase_realtime add table public.public_order_updates;
exception when duplicate_object then null;
end $$;

insert into public.public_order_updates(public_code, status, updated_at)
select public_code, status, updated_at from public.orders
where public_code is not null
on conflict (public_code) do update set status = excluded.status, updated_at = excluded.updated_at;
