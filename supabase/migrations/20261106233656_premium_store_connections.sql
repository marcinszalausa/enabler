
create function public.can_connect_store(ws uuid) returns boolean language sql stable security invoker set search_path='' as $fn$
 select coalesce(plan in ('plus','growth') and stripe_subscription_id is not null and subscription_status in ('active','trialing','past_due'),false)
 from public.workspaces where id=ws
$fn$;
revoke all on function public.can_connect_store(uuid) from public,anon;
grant execute on function public.can_connect_store(uuid) to authenticated,service_role;

create table public.website_stores(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 connection_id uuid not null unique,
 origin text not null check(origin ~ '^https://[a-z0-9.-]+$'),
 status text not null default 'syncing' check(status in ('syncing','connected','error','disconnected')),
 run_id uuid not null default gen_random_uuid(),
 discovered boolean not null default false,
 candidate_urls jsonb not null default '[]' check(jsonb_typeof(candidate_urls)='array' and jsonb_array_length(candidate_urls)<=100),
 robots_rules jsonb not null default '[]' check(jsonb_typeof(robots_rules)='array'),
 cursor integer not null default 0 check(cursor between 0 and 100),
 sync_started_at timestamptz not null default now(),
 synced_at timestamptz,
 error_code text,
 foreign key(connection_id,workspace_id) references public.catalog_connections(id,workspace_id) on delete cascade,
 unique(workspace_id,origin)
);
create index website_stores_workspace_idx on public.website_stores(workspace_id);
create index website_stores_pending_idx on public.website_stores(sync_started_at) where status='syncing';
alter table public.website_stores enable row level security;
revoke all on public.website_stores from public,anon,authenticated;
grant all on public.website_stores to service_role;
create policy service_access on public.website_stores for all to service_role using(true) with check(true);

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
 update public.website_stores set status='error',error_code='CATALOG_UPGRADE_REQUIRED' where workspace_id=new.id and status<>'disconnected';
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

create function public.connect_website_store(ws uuid,origin text) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare store public.website_stores; source uuid;
begin
 if not coalesce(public.can_connect_store(ws),false) then raise exception 'CATALOG_UPGRADE_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(ws::text||origin,710));
 select * into store from public.website_stores where workspace_id=ws and website_stores.origin=connect_website_store.origin for update;
 if found then
  if store.status='syncing' then return jsonb_build_object('id',store.id,'run_id',store.run_id);end if;
  return public.manage_website_store(ws,store.id,'refresh');
 end if;
 insert into public.catalog_connections(workspace_id,platform,store_origin,webhook_domain,enabled) values(ws,'custom',origin,substring(origin from 9),true) returning id into source;
 insert into public.website_stores(workspace_id,connection_id,origin) values(ws,source,origin) returning * into store;
 return jsonb_build_object('id',store.id,'run_id',store.run_id);
end $fn$;
create function public.manage_website_store(ws uuid,store_id uuid,operation text) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare store public.website_stores;
begin
 select * into store from public.website_stores where id=store_id and workspace_id=ws for update;
 if not found then raise exception 'CATALOG_STORE_NOT_FOUND';end if;
 if operation='disconnect' then
 update public.catalog_connections set enabled=false where id=store.connection_id;
 update public.website_stores set status='disconnected' where id=store.id;
 elsif operation='refresh' then
 if not coalesce(public.can_connect_store(ws),false) then raise exception 'CATALOG_UPGRADE_REQUIRED';end if;
 if store.status<>'syncing' then
 update public.catalog_connections set enabled=true where id=store.connection_id;
 update public.website_stores set status='syncing',run_id=gen_random_uuid(),discovered=false,candidate_urls='[]',robots_rules='[]',cursor=0,sync_started_at=now(),synced_at=null,error_code=null where id=store.id returning * into store;
 end if;
 else raise exception 'CATALOG_OPERATION_INVALID';end if;
 return jsonb_build_object('id',store.id,'run_id',store.run_id);
end $fn$;
revoke all on function public.connect_website_store(uuid,text),public.manage_website_store(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.connect_website_store(uuid,text),public.manage_website_store(uuid,uuid,text) to service_role;
-- Existing lower-tier sources are paused; no credits, projects or generated ads are changed.
update public.workspaces set plan=plan where id in(select workspace_id from public.catalog_connections);
