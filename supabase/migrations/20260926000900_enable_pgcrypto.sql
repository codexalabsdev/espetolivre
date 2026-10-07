create extension if not exists pgcrypto with schema extensions;

comment on extension pgcrypto is 'Provides cryptographic functions used to generate secure public order codes.';

create or replace function public.generate_public_order_code()
returns text
language plpgsql
volatile
set search_path = public, extensions, pg_temp
as $$
declare
  candidate text;
begin
  loop
    candidate := 'ESP-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4));
    exit when not exists (select 1 from public.orders where public_code = candidate);
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_public_order_code() from public;
