
create table public.shopify_oauth_states(
 state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null,
 shop text not null check(shop ~ '^[a-z0-9][a-z0-9-]{0,61}[.]myshopify[.]com$'),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index shopify_oauth_expiry_idx on public.shopify_oauth_states(expires_at);
create table public.shopify_stores(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 connection_id uuid not null unique,
 shop text not null unique check(shop ~ '^[a-z0-9][a-z0-9-]{0,61}[.]myshopify[.]com$'),
 name text not null,
 provider_shop_id text not null,
 installation_id uuid not null default gen_random_uuid(),
 installed_at timestamptz not null default now(),
 status text not null default 'syncing' check(status in ('syncing','connected','error','reconnect','disconnected')),
 credentials_cipher text,
 access_expires_at timestamptz,
 refresh_expires_at timestamptz,
 refresh_lock timestamptz,
 sync_cursor text,
 sync_started_at timestamptz not null default now(),
 synced_at timestamptz,
 error_code text,
 foreign key(connection_id,workspace_id) references public.catalog_connections(id,workspace_id) on delete cascade
);
create index shopify_stores_workspace_idx on public.shopify_stores(workspace_id);
create index shopify_stores_sync_idx on public.shopify_stores(sync_started_at) where status='syncing';
alter table public.shopify_oauth_states enable row level security;
alter table public.shopify_stores enable row level security;
revoke all on public.shopify_oauth_states,public.shopify_stores from public,anon,authenticated;
grant all on public.shopify_oauth_states,public.shopify_stores to service_role;
create policy service_access on public.shopify_oauth_states for all to service_role using(true) with check(true);
create policy service_access on public.shopify_stores for all to service_role using(true) with check(true);
create function public.install_shopify_store(ws uuid,domain text,store_origin text,store_name text,provider_shop_id text,credentials text,webhook_key text,access_expiry timestamptz,refresh_expiry timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare existing public.shopify_stores; source_id uuid; installed public.shopify_stores;
begin
 perform pg_advisory_xact_lock(hashtextextended(domain,709));
 select * into existing from public.shopify_stores where shop=domain for update;
 if found and existing.workspace_id<>ws then raise exception 'SHOPIFY_WORKSPACE_CONFLICT';end if;
 source_id:=existing.connection_id;
 if source_id is null then
 insert into public.catalog_connections(workspace_id,platform,store_origin,webhook_domain,enabled)
 values(ws,'shopify',store_origin,domain,true) returning id into source_id;
 else
 update public.catalog_connections set enabled=true,store_origin=install_shopify_store.store_origin where id=source_id;
 end if;
 insert into public.catalog_connection_keys(connection_id,encrypted_secret) values(source_id,webhook_key)
 on conflict(connection_id) do update set encrypted_secret=excluded.encrypted_secret;
 insert into public.shopify_stores(workspace_id,connection_id,shop,name,provider_shop_id,credentials_cipher,access_expires_at,refresh_expires_at)
 values(ws,source_id,domain,store_name,provider_shop_id,credentials,access_expiry,refresh_expiry)
 on conflict(shop) do update set name=excluded.name,provider_shop_id=excluded.provider_shop_id,credentials_cipher=excluded.credentials_cipher,
 access_expires_at=excluded.access_expires_at,refresh_expires_at=excluded.refresh_expires_at,
 status='syncing',installation_id=gen_random_uuid(),installed_at=now(),sync_cursor=null,sync_started_at=now(),synced_at=null,error_code=null,refresh_lock=null
 returning * into installed;
 return jsonb_build_object('id',installed.id,'installation_id',installed.installation_id);
end
$fn$;
revoke all on function public.install_shopify_store(uuid,text,text,text,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.install_shopify_store(uuid,text,text,text,text,text,text,timestamptz,timestamptz) to service_role;
create function public.disconnect_shopify_store(store_id uuid,install uuid) returns boolean language plpgsql security invoker set search_path='' as $fn$
declare source_id uuid;
begin
 select connection_id into source_id from public.shopify_stores where id=store_id and installation_id=install for update;
 if not found then return false;end if;
 update public.catalog_connections set enabled=false where id=source_id;
 delete from public.catalog_connection_keys where connection_id=source_id;
 update public.shopify_stores set status='disconnected',credentials_cipher=null,refresh_lock=null where id=store_id and installation_id=install;
 return true;
end
$fn$;
revoke all on function public.disconnect_shopify_store(uuid,uuid) from public,anon,authenticated;
grant execute on function public.disconnect_shopify_store(uuid,uuid) to service_role;
