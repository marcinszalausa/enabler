
create function public.can_connect_store(ws uuid) returns boolean language sql stable security invoker set search_path='' as $fn$
 select coalesce(plan in ('plus','growth') and stripe_subscription_id is not null and subscription_status in ('active','trialing','past_due'),false)
 from public.workspaces where id=ws
$fn$;
revoke all on function public.can_connect_store(uuid) from public,anon;
grant execute on function public.can_connect_store(uuid) to authenticated,service_role;


create table public.store_connect_intents(
 state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null,
 provider text not null check(provider in('woocommerce','wix','squarespace','bigcommerce')),
 expected_url text,
 expected_key text,
 receipt_hash text,
 expires_at timestamptz not null
);
create index store_intents_expiry_idx on public.store_connect_intents(expires_at);
create table public.store_install_receipts(
 claim_hash text primary key check(claim_hash ~ '^[a-f0-9]{64}$'),
 intent_hash text,
 provider text not null check(provider in('woocommerce','wix','squarespace','bigcommerce')),
 provider_id text not null,
 store_url text not null,
 store_key text not null,
 name text not null,
 credentials_cipher text not null,
 expires_at timestamptz not null
);
create index store_receipts_expiry_idx on public.store_install_receipts(expires_at);
create table public.platform_stores(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 connection_id uuid not null unique,
 provider text not null check(provider in('woocommerce','wix','squarespace','bigcommerce')),
 provider_id text not null,
 store_url text not null,
 name text not null,
 installation_id uuid not null default gen_random_uuid(),
 run_id uuid not null default gen_random_uuid(),
 status text not null default 'syncing' check(status in('syncing','connected','error','reconnect','disconnected')),
 credentials_cipher text,
 refresh_lock timestamptz,
 cursor text not null default '',
 sync_started_at timestamptz not null default now(),
 synced_at timestamptz,
 error_code text,
 foreign key(connection_id,workspace_id) references public.catalog_connections(id,workspace_id) on delete cascade,
 unique(provider,provider_id)
);
create index platform_stores_workspace_idx on public.platform_stores(workspace_id);
create index platform_stores_pending_idx on public.platform_stores(status,synced_at,sync_started_at);
do $private$
declare tab text;
begin
 foreach tab in array array['store_connect_intents','store_install_receipts','platform_stores'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 execute format('grant all on public.%I to service_role',tab);
 execute format('create policy service_access on public.%I for all to service_role using(true) with check(true)',tab);
 end loop;
end $private$;
create function public.guard_store_plan() returns trigger language plpgsql security invoker set search_path='' as $fn$
declare paid public.workspaces;
begin
 if tg_table_name='catalog_connections' then if not new.enabled then return new;end if;end if;
 select * into paid from public.workspaces where id=new.workspace_id for share;
 if not found or paid.plan not in ('plus','growth') or paid.stripe_subscription_id is null or coalesce(paid.subscription_status,'') not in ('active','trialing','past_due') then raise exception 'CATALOG_UPGRADE_REQUIRED';end if;
 return new;
end $fn$;
revoke all on function public.guard_store_plan() from public,anon,authenticated;
grant execute on function public.guard_store_plan() to service_role;
create trigger catalog_connection_plan_guard before insert or update of enabled,workspace_id,store_origin on public.catalog_connections for each row execute function public.guard_store_plan();
create trigger catalog_item_plan_guard before insert or update of images,name,product_url,inventory_quantity,source_updated_at on public.catalog_items for each row execute function public.guard_store_plan();
create trigger catalog_delivery_plan_guard before insert on public.catalog_deliveries for each row execute function public.guard_store_plan();

create function public.pause_downgraded_stores() returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if new.plan not in ('plus','growth') or new.stripe_subscription_id is null or coalesce(new.subscription_status,'') not in ('active','trialing','past_due') then
 update public.catalog_connections set enabled=false where workspace_id=new.id and enabled;
 update public.catalog_deliveries set status='failed' where workspace_id=new.id and status='pending';
 update public.shopify_stores set status='error',error_code='CATALOG_UPGRADE_REQUIRED' where workspace_id=new.id and status<>'disconnected';
 update public.platform_stores set status='error',error_code='CATALOG_UPGRADE_REQUIRED' where workspace_id=new.id and status<>'disconnected';
 end if;
 return new;
end $fn$;
revoke all on function public.pause_downgraded_stores() from public,anon,authenticated;
grant execute on function public.pause_downgraded_stores() to service_role;
create trigger workspace_store_downgrade after update of plan,stripe_subscription_id,subscription_status on public.workspaces for each row execute function public.pause_downgraded_stores();

do $policy$
declare tab text;
begin
 foreach tab in array array['catalog_connections','catalog_deliveries','catalog_items','catalog_training_jobs'] loop
 execute format('drop policy workspace_read on public.%I',tab);
 execute format('create policy workspace_read on public.%I for select to authenticated using(public.is_workspace_member(workspace_id) and public.can_connect_store(workspace_id))',tab);
 end loop;
end $policy$;


create function public.finish_store_connection(intent text,receipt text,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare i public.store_connect_intents; r public.store_install_receipts; existing public.platform_stores; installed public.platform_stores; source uuid; origin text;
begin
 select * into i from public.store_connect_intents where state_hash=intent and user_id=actor and expires_at>now() for update;
 if not found then raise exception 'STORE_STATE_INVALID';end if;
 if not coalesce(public.can_connect_store(i.workspace_id),false) then raise exception 'CATALOG_UPGRADE_REQUIRED';end if;
 select * into r from public.store_install_receipts where claim_hash=receipt and expires_at>now() for update;
 if not found or r.provider<>i.provider or (i.expected_key is not null and r.store_key<>i.expected_key) or (i.expected_key is null and r.intent_hash is distinct from i.state_hash) or (r.intent_hash is not null and r.intent_hash<>i.state_hash) or (r.provider='woocommerce' and i.receipt_hash is distinct from r.claim_hash) then raise exception 'STORE_PROOF_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.provider||':'||r.provider_id,711));
 select * into existing from public.platform_stores where provider=r.provider and provider_id=r.provider_id for update;
 if found and existing.workspace_id<>i.workspace_id then raise exception 'STORE_WORKSPACE_CONFLICT';end if;
 source:=existing.connection_id;
 origin:=substring(r.store_url from '^https://[a-z0-9.-]+');
 if origin is null then raise exception 'STORE_ADDRESS_INVALID';end if;
 if source is null then
 insert into public.catalog_connections(workspace_id,platform,store_origin,webhook_domain,enabled)
 values(i.workspace_id,case when r.provider in('woocommerce','wix') then r.provider else 'custom' end,origin,substring(origin from 9),true) returning id into source;
 else update public.catalog_connections set enabled=true,store_origin=origin where id=source;end if;
 insert into public.platform_stores(workspace_id,connection_id,provider,provider_id,store_url,name,credentials_cipher)
 values(i.workspace_id,source,r.provider,r.provider_id,r.store_url,r.name,r.credentials_cipher)
 on conflict(provider,provider_id) do update set store_url=excluded.store_url,name=excluded.name,credentials_cipher=excluded.credentials_cipher,
 installation_id=gen_random_uuid(),run_id=gen_random_uuid(),status='syncing',refresh_lock=null,cursor='',sync_started_at=now(),synced_at=null,error_code=null
 returning * into installed;
 delete from public.store_install_receipts where claim_hash=receipt;
 delete from public.store_connect_intents where state_hash=intent;
 return jsonb_build_object('id',installed.id,'run_id',installed.run_id);
end $fn$;
create function public.manage_platform_store(ws uuid,store_id uuid,operation text) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare store public.platform_stores;
begin
 select * into store from public.platform_stores where id=store_id and workspace_id=ws for update;
 if not found then raise exception 'STORE_NOT_FOUND';end if;
 if operation='disconnect' then
 update public.catalog_connections set enabled=false where id=store.connection_id;
 update public.platform_stores set status='disconnected',credentials_cipher=null,refresh_lock=null where id=store.id;
 elsif operation='refresh' then
 if not coalesce(public.can_connect_store(ws),false) then raise exception 'CATALOG_UPGRADE_REQUIRED';end if;
 if store.credentials_cipher is null or store.status='reconnect' then raise exception 'STORE_RECONNECT_REQUIRED';end if;
 if store.status<>'syncing' then
 update public.catalog_connections set enabled=true where id=store.connection_id;
 update public.platform_stores set status='syncing',run_id=gen_random_uuid(),cursor='',sync_started_at=now(),synced_at=null,error_code=null where id=store.id returning * into store;
 end if;
 else raise exception 'STORE_OPERATION_INVALID';end if;
 return jsonb_build_object('id',store.id,'run_id',store.run_id);
end $fn$;
revoke all on function public.finish_store_connection(text,text,uuid),public.manage_platform_store(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.finish_store_connection(text,text,uuid),public.manage_platform_store(uuid,uuid,text) to service_role;
update public.workspaces set plan=plan where id in(select workspace_id from public.catalog_connections);
