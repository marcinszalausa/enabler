-- Existing time-limited pilots keep their original cap. Only the operator can
-- assign ongoing founder store access; public roles still have SELECT only.
alter table public.store_connection_pilots
 add column access_kind text not null default 'pilot' check(access_kind in ('pilot','founder')),
 alter column expires_at drop not null,
 drop constraint store_connection_pilots_check;
alter table public.store_connection_pilots add constraint store_connection_access_duration check(
 (access_kind='founder' and expires_at is null)
 or (access_kind='pilot' and expires_at is not null and expires_at>granted_at and expires_at<=granted_at+interval '7 days')
);
create or replace function public.can_connect_store(ws uuid) returns boolean
language sql stable security invoker set search_path='' as $fn$
 select coalesce(
  (w.plan in ('plus','growth') and w.stripe_subscription_id is not null and w.subscription_status in ('active','trialing','past_due'))
  or exists(select 1 from public.store_connection_pilots p
   where p.workspace_id=w.id and p.revoked_at is null and p.granted_at<=statement_timestamp() and (p.access_kind='founder' or p.expires_at>statement_timestamp())
   and exists(select 1 from public.workspace_members m where m.workspace_id=p.workspace_id and m.user_id=p.owner_user_id and m.role='owner')),
 false) from public.workspaces w where w.id=ws
$fn$;
revoke all on function public.can_connect_store(uuid) from public,anon;
grant execute on function public.can_connect_store(uuid) to authenticated,service_role;

create or replace function public.guard_store_plan() returns trigger
language plpgsql security invoker set search_path='' as $fn$
declare target public.workspaces; pilot public.store_connection_pilots; source_platform text; source_origin text;
begin
 if tg_table_name='catalog_connections' then if not new.enabled then return new;end if;end if;
 select * into target from public.workspaces where id=new.workspace_id for share;
 if not found then raise exception 'CATALOG_UPGRADE_REQUIRED';end if;
 if target.plan in ('plus','growth') and target.stripe_subscription_id is not null and target.subscription_status in ('active','trialing','past_due') then return new;end if;
 if not coalesce(public.can_connect_store(new.workspace_id),false) then raise exception 'CATALOG_UPGRADE_REQUIRED';end if;
 select * into pilot from public.store_connection_pilots
  where workspace_id=new.workspace_id and revoked_at is null and granted_at<=statement_timestamp() and (access_kind='founder' or expires_at>statement_timestamp()) for share;
 if not found then raise exception 'CATALOG_UPGRADE_REQUIRED';end if;
 if tg_table_name='catalog_connections' then source_platform:=new.platform;source_origin:=new.store_origin;
 else select platform,store_origin into source_platform,source_origin from public.catalog_connections where id=new.connection_id and workspace_id=new.workspace_id;end if;
 if source_platform is distinct from 'shopify' or regexp_replace(substring(source_origin from '^https://([^/:]+)'),'^www[.]','') is distinct from pilot.store_host then
  raise exception 'CATALOG_PILOT_STORE_REQUIRED';
 end if;
 return new;
end $fn$;
revoke all on function public.guard_store_plan() from public,anon,authenticated;
grant execute on function public.guard_store_plan() to service_role;

create or replace function public.pause_downgraded_stores() returns trigger
language plpgsql security invoker set search_path='' as $fn$
begin
 if (new.plan not in ('plus','growth') or new.stripe_subscription_id is null or coalesce(new.subscription_status,'') not in ('active','trialing','past_due'))
 and not exists(select 1 from public.store_connection_pilots p where p.workspace_id=new.id and p.revoked_at is null and p.granted_at<=statement_timestamp() and (p.access_kind='founder' or p.expires_at>statement_timestamp())
  and exists(select 1 from public.workspace_members m where m.workspace_id=p.workspace_id and m.user_id=p.owner_user_id and m.role='owner')) then
  update public.catalog_connections set enabled=false where workspace_id=new.id and enabled;
  update public.catalog_deliveries set status='failed' where workspace_id=new.id and status='pending';
  update public.shopify_stores set status='error',error_code='CATALOG_UPGRADE_REQUIRED' where workspace_id=new.id and status<>'disconnected';
  update public.platform_stores set status='error',error_code='CATALOG_UPGRADE_REQUIRED' where workspace_id=new.id and status<>'disconnected';
 end if;
 return new;
end $fn$;
revoke all on function public.pause_downgraded_stores() from public,anon,authenticated;
grant execute on function public.pause_downgraded_stores() to service_role;
