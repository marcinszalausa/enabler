grant select on public.workspaces to authenticated;
alter table public.workspaces enable row level security;
create policy fixture_workspace_read on public.workspaces for select to authenticated using(public.is_workspace_member(id));
insert into public.workspaces(id,plan,stripe_subscription_id,subscription_status) values
('10000000-0000-4000-8000-000000000001','free',null,null),
('10000000-0000-4000-8000-000000000002','starter','sub_basic','active'),
('10000000-0000-4000-8000-000000000003','plus','sub_grow','active'),
('10000000-0000-4000-8000-000000000004','growth','sub_scale','active'),
('10000000-0000-4000-8000-000000000005','plus',null,'active'),
('10000000-0000-4000-8000-000000000006','growth','sub_expired','canceled');
insert into public.workspace_members values('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','owner');
set role service_role;
do $$ declare ws uuid;begin
 foreach ws in array array['10000000-0000-4000-8000-000000000001'::uuid,'10000000-0000-4000-8000-000000000002'::uuid,'10000000-0000-4000-8000-000000000005'::uuid,'10000000-0000-4000-8000-000000000006'::uuid] loop
 if public.can_connect_store(ws) then raise exception 'ineligible plan accepted';end if;
 begin perform public.connect_website_store(ws,'https://store.example');raise exception 'basic connected website';exception when raise_exception then if sqlerrm<>'CATALOG_UPGRADE_REQUIRED' then raise;end if;end;
 begin perform public.install_shopify_store(ws,'store.myshopify.com','https://store.example','Store','gid://shopify/Shop/1','cipher','cipher',now()+interval '1 hour',now()+interval '90 days');raise exception 'basic connected Shopify';exception when raise_exception then if sqlerrm<>'CATALOG_UPGRADE_REQUIRED' then raise;end if;end;
 end loop;
 if not public.can_connect_store('10000000-0000-4000-8000-000000000003') or not public.can_connect_store('10000000-0000-4000-8000-000000000004') then raise exception 'eligible plan denied';end if;
 perform public.connect_website_store('10000000-0000-4000-8000-000000000003','https://store.example');
 perform public.connect_website_store('10000000-0000-4000-8000-000000000003','https://store.example');
 if (select count(*) from public.website_stores)<>1 then raise exception 'duplicate website';end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
do $$ begin
 if not public.can_connect_store('10000000-0000-4000-8000-000000000003') then raise exception 'owner cannot see entitlement';end if;
 if coalesce(public.can_connect_store('10000000-0000-4000-8000-000000000004'),false) then raise exception 'other workspace exposed';end if;
 if (select count(*) from public.catalog_connections)<>1 then raise exception 'eligible read denied';end if;
end $$;
reset role;
-- Downgrade through the same workspace columns written by billing webhooks.
update public.workspaces set plan='starter' where id='10000000-0000-4000-8000-000000000003';
do $$ begin
 if exists(select 1 from public.catalog_connections where enabled) then raise exception 'downgrade left active source';end if;
 if exists(select 1 from public.website_stores where status<>'error') then raise exception 'downgrade left job running';end if;
 begin update public.catalog_connections set enabled=true;raise exception 'basic reenabled source';exception when raise_exception then if sqlerrm<>'CATALOG_UPGRADE_REQUIRED' then raise;end if;end;
end $$;
set role authenticated;
do $$ begin if exists(select 1 from public.catalog_connections) then raise exception 'downgraded catalog still readable';end if;end $$;
reset role;
set role service_role;
select public.manage_website_store('10000000-0000-4000-8000-000000000003',id,'disconnect') from public.website_stores;
reset role;
update public.workspaces set plan='growth' where id='10000000-0000-4000-8000-000000000003';
set role service_role;
select public.manage_website_store('10000000-0000-4000-8000-000000000003',id,'refresh') from public.website_stores;
do $$ begin if not exists(select 1 from public.catalog_connections where enabled) then raise exception 'upgrade cannot resume';end if;end $$;
