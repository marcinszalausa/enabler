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
create function public.fixture_connect_native(ws uuid,kind text,expected text default 'https://store.example') returns jsonb language plpgsql as $$
begin
 insert into public.store_connect_intents(state_hash,workspace_id,user_id,provider,expected_url,expected_key,receipt_hash,expires_at)
 values(repeat('a',64),ws,'20000000-0000-4000-8000-000000000001',kind,expected,expected,repeat('b',64),now()+interval '10 minutes');
 insert into public.store_install_receipts(claim_hash,intent_hash,provider,provider_id,store_url,store_key,name,credentials_cipher,expires_at)
 values(repeat('b',64),repeat('a',64),kind,'provider-identity','https://store.example','https://store.example','Store','encrypted',now()+interval '10 minutes');
 return public.finish_store_connection(repeat('a',64),repeat('b',64),'20000000-0000-4000-8000-000000000001');
end $$;
grant execute on function public.fixture_connect_native(uuid,text,text) to service_role;
set role service_role;
do $$ declare ws uuid;kind text;begin
 foreach ws in array array['10000000-0000-4000-8000-000000000001'::uuid,'10000000-0000-4000-8000-000000000002'::uuid,'10000000-0000-4000-8000-000000000005'::uuid,'10000000-0000-4000-8000-000000000006'::uuid] loop
 if public.can_connect_store(ws) then raise exception 'ineligible plan accepted';end if;
 foreach kind in array array['woocommerce','wix','squarespace','bigcommerce'] loop
 begin perform public.fixture_connect_native(ws,kind);raise exception 'basic connected native platform';exception when raise_exception then if sqlerrm<>'CATALOG_UPGRADE_REQUIRED' then raise;end if;end;
 end loop;
 begin perform public.install_shopify_store(ws,'store.myshopify.com','https://store.example','Store','gid://shopify/Shop/1','cipher','cipher',now()+interval '1 hour',now()+interval '90 days');raise exception 'basic connected Shopify';exception when raise_exception then if sqlerrm<>'CATALOG_UPGRADE_REQUIRED' then raise;end if;end;
 end loop;
 if not public.can_connect_store('10000000-0000-4000-8000-000000000003') or not public.can_connect_store('10000000-0000-4000-8000-000000000004') then raise exception 'eligible plan denied';end if;
 begin perform public.fixture_connect_native('10000000-0000-4000-8000-000000000003','woocommerce','https://other-store.example');raise exception 'wrong store bound';exception when raise_exception then if sqlerrm<>'STORE_PROOF_INVALID' then raise;end if;end;
 perform public.fixture_connect_native('10000000-0000-4000-8000-000000000003','woocommerce');
 begin perform public.finish_store_connection(repeat('a',64),repeat('b',64),'20000000-0000-4000-8000-000000000001');raise exception 'replayed approval';exception when raise_exception then if sqlerrm<>'STORE_STATE_INVALID' then raise;end if;end;
 perform public.fixture_connect_native('10000000-0000-4000-8000-000000000003','woocommerce');
 if (select count(*) from public.platform_stores)<>1 then raise exception 'duplicate connection';end if;
 begin perform public.fixture_connect_native('10000000-0000-4000-8000-000000000004','woocommerce');raise exception 'cross-tenant takeover';exception when raise_exception then if sqlerrm<>'STORE_WORKSPACE_CONFLICT' then raise;end if;end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
do $$ begin
 if not public.can_connect_store('10000000-0000-4000-8000-000000000003') then raise exception 'owner cannot see entitlement';end if;
 if coalesce(public.can_connect_store('10000000-0000-4000-8000-000000000004'),false) then raise exception 'other workspace exposed';end if;
 if (select count(*) from public.catalog_connections)<>1 then raise exception 'eligible read denied';end if;
 begin perform * from public.platform_stores;raise exception 'tokens exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.workspaces set plan='starter' where id='10000000-0000-4000-8000-000000000003';
do $$ begin
 if exists(select 1 from public.catalog_connections where enabled) then raise exception 'downgrade left active source';end if;
 if exists(select 1 from public.platform_stores where status<>'error') then raise exception 'downgrade left job running';end if;
 begin update public.catalog_connections set enabled=true;raise exception 'basic reenabled source';exception when raise_exception then if sqlerrm<>'CATALOG_UPGRADE_REQUIRED' then raise;end if;end;
end $$;
set role authenticated;
do $$ begin if exists(select 1 from public.catalog_connections) then raise exception 'downgraded catalog readable';end if;end $$;
reset role;
update public.workspaces set plan='growth' where id='10000000-0000-4000-8000-000000000003';
set role service_role;
select public.manage_platform_store('10000000-0000-4000-8000-000000000003',id,'refresh') from public.platform_stores;
do $$ begin if not exists(select 1 from public.catalog_connections where enabled) then raise exception 'upgrade cannot resume';end if;end $$;
reset role;
update public.workspaces set plan='free' where id='10000000-0000-4000-8000-000000000003';
set role service_role;
select public.manage_platform_store('10000000-0000-4000-8000-000000000003',id,'disconnect') from public.platform_stores;
do $$ begin if exists(select 1 from public.platform_stores where credentials_cipher is not null) then raise exception 'disconnect retained credentials';end if;end $$;
