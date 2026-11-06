insert into public.workspaces(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
set role service_role;
select public.install_shopify_store('10000000-0000-4000-8000-000000000001','store.myshopify.com','https://store.example','Test store','gid://shopify/Shop/1','encrypted-token','encrypted-key',now()+interval '1 hour',now()+interval '90 days');
do $$ declare source uuid; first_install uuid; new_install uuid;
begin
 select connection_id,installation_id into source,first_install from public.shopify_stores;
 begin
 perform public.install_shopify_store('10000000-0000-4000-8000-000000000002','store.myshopify.com','https://store.example','Other','gid://shopify/Shop/1','other','key',now(),now());
 raise exception 'cross-workspace store theft';
 exception when raise_exception then if sqlerrm<>'SHOPIFY_WORKSPACE_CONFLICT' then raise;end if;end;
 perform public.install_shopify_store('10000000-0000-4000-8000-000000000001','store.myshopify.com','https://store.example','Test store','gid://shopify/Shop/1','new-token','new-key',now()+interval '1 hour',now()+interval '90 days');
 if (select count(*) from public.shopify_stores)<>1 or (select count(*) from public.catalog_connections)<>1 then raise exception 'duplicate connection';end if;
 select installation_id into new_install from public.shopify_stores;
 if first_install=new_install then raise exception 'installation not rotated';end if;
 if public.disconnect_shopify_store((select id from public.shopify_stores),first_install) then raise exception 'old install disconnected new install';end if;
 if not public.disconnect_shopify_store((select id from public.shopify_stores),new_install) then raise exception 'disconnect failed';end if;
 if exists(select 1 from public.catalog_connection_keys where connection_id=source) or exists(select 1 from public.catalog_connections where id=source and enabled) or exists(select 1 from public.shopify_stores where credentials_cipher is not null) then raise exception 'disconnect retained access';end if;
end $$;
reset role;
set role authenticated;
do $$ begin
 begin perform * from public.shopify_stores;raise exception 'credentials exposed';exception when insufficient_privilege then null;end;
 begin perform * from public.shopify_oauth_states;raise exception 'OAuth states exposed';exception when insufficient_privilege then null;end;
 begin perform public.disconnect_shopify_store(gen_random_uuid(),gen_random_uuid());raise exception 'public disconnect RPC';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.shopify_oauth_states(state_hash,workspace_id,user_id,shop,expires_at) values(repeat('a',64),'10000000-0000-4000-8000-000000000001',gen_random_uuid(),'store.myshopify.com',now()+interval '10 minutes');
