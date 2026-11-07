insert into auth.users(id) values
('30000000-0000-4000-8000-000000000031'),('30000000-0000-4000-8000-000000000032');
insert into public.workspaces(id,plan) values
('10000000-0000-4000-8000-000000000031','free'),('10000000-0000-4000-8000-000000000032','starter');
insert into public.workspace_members(workspace_id,user_id,role) values
('10000000-0000-4000-8000-000000000031','30000000-0000-4000-8000-000000000031','owner'),
('10000000-0000-4000-8000-000000000031','30000000-0000-4000-8000-000000000032','editor'),
('10000000-0000-4000-8000-000000000032','30000000-0000-4000-8000-000000000032','owner');
set role service_role;
insert into public.store_connection_pilots(workspace_id,owner_user_id,store_host,expires_at) values
('10000000-0000-4000-8000-000000000031','30000000-0000-4000-8000-000000000031','softmila.com',now()+interval '7 days');
do $$ begin
 if not public.can_connect_store('10000000-0000-4000-8000-000000000031') then raise exception 'pilot denied';end if;
 if public.can_connect_store('10000000-0000-4000-8000-000000000032') then raise exception 'ungranted basic account accepted';end if;
 if not public.can_connect_store('10000000-0000-4000-8000-000000000004') then raise exception 'paid Scale access regressed';end if;
 begin
  insert into public.store_connection_pilots(workspace_id,owner_user_id,store_host,expires_at) values('10000000-0000-4000-8000-000000000032','30000000-0000-4000-8000-000000000032','softmila.com',now()+interval '8 days');
  raise exception 'eight day grant accepted';
 exception when check_violation then null;end;
 perform public.install_shopify_store('10000000-0000-4000-8000-000000000031','pilot.myshopify.com','https://www.softmila.com','Soft Mila','gid://shopify/Shop/31','cipher','cipher',now()+interval '1 hour',now()+interval '90 days');
 begin
  perform public.install_shopify_store('10000000-0000-4000-8000-000000000031','wrong.myshopify.com','https://other.example','Wrong','gid://shopify/Shop/32','cipher','cipher',now()+interval '1 hour',now()+interval '90 days');
  raise exception 'wrong store accepted';
 exception when raise_exception then if sqlerrm<>'CATALOG_PILOT_STORE_REQUIRED' then raise;end if;end;
 begin
  insert into public.catalog_connections(workspace_id,platform,store_origin,webhook_domain,enabled) values('10000000-0000-4000-8000-000000000031','woocommerce','https://softmila.com','softmila.com',true);
  raise exception 'pilot accepted non Shopify platform';
 exception when raise_exception then if sqlerrm<>'CATALOG_PILOT_STORE_REQUIRED' then raise;end if;end;
 insert into public.catalog_items(connection_id,workspace_id,external_id,name,product_url,images,inventory_quantity,source_updated_at,image_revision)
 select connection_id,workspace_id,'31','Cabin','https://www.softmila.com/products/cabin','[]'::jsonb,1,now(),repeat('d',64) from public.shopify_stores where shop='pilot.myshopify.com';
 if exists(select 1 from public.catalog_connections where workspace_id='10000000-0000-4000-8000-000000000031' and training_allowance<>0) then raise exception 'training allowance granted';end if;
 if exists(select 1 from public.workspaces where id='10000000-0000-4000-8000-000000000031' and (plan<>'free' or credits<>135 or stripe_subscription_id is not null)) then raise exception 'pilot changed billing or credits';end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000031',false);
do $$ begin
 if not public.can_connect_store('10000000-0000-4000-8000-000000000031') then raise exception 'pilot owner denied';end if;
 if (select count(*) from public.store_connection_pilots)<>1 then raise exception 'owner cannot read own pilot';end if;
 if (select count(*) from public.catalog_items)<>1 then raise exception 'owner catalog unavailable';end if;
 begin update public.store_connection_pilots set revoked_at=now();raise exception 'owner modified own grant';exception when insufficient_privilege then null;end;
 begin insert into public.store_connection_pilots(workspace_id,owner_user_id,store_host,expires_at) values('10000000-0000-4000-8000-000000000032','30000000-0000-4000-8000-000000000031','softmila.com',now()+interval '1 day');raise exception 'owner self-granted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000032',false);
do $$ begin
 if coalesce(public.can_connect_store('10000000-0000-4000-8000-000000000031'),false) then raise exception 'editor inherited owner pilot';end if;
 if exists(select 1 from public.store_connection_pilots) or exists(select 1 from public.catalog_items) then raise exception 'pilot data leaked';end if;
end $$;
reset role;
update public.workspace_members set role='viewer' where workspace_id='10000000-0000-4000-8000-000000000031' and user_id='30000000-0000-4000-8000-000000000031';
set role service_role;
do $$ begin if public.can_connect_store('10000000-0000-4000-8000-000000000031') then raise exception 'former owner pilot remained active';end if;end $$;
reset role;
update public.workspace_members set role='owner' where workspace_id='10000000-0000-4000-8000-000000000031' and user_id='30000000-0000-4000-8000-000000000031';
-- Billing-field updates must preserve an active pilot, while paid downgrade
-- behavior for other workspaces remains covered by premium-stores.sql.
update public.workspaces set plan=plan where id='10000000-0000-4000-8000-000000000031';
do $$ begin if not exists(select 1 from public.catalog_connections where workspace_id='10000000-0000-4000-8000-000000000031' and enabled) then raise exception 'active pilot paused by billing update';end if;end $$;
set role service_role;
update public.store_connection_pilots set revoked_at=now();
do $$ begin if public.can_connect_store('10000000-0000-4000-8000-000000000031') then raise exception 'revocation did not stop access';end if;end $$;
update public.store_connection_pilots set revoked_at=null,granted_at=now()-interval '2 days',expires_at=now()-interval '1 minute';
do $$ begin
 if public.can_connect_store('10000000-0000-4000-8000-000000000031') then raise exception 'expired pilot accepted';end if;
 begin update public.catalog_items set name='after expiry';raise exception 'expired pilot wrote catalog';exception when raise_exception then if sqlerrm<>'CATALOG_UPGRADE_REQUIRED' then raise;end if;end;
 begin update public.catalog_connections set enabled=true where workspace_id='10000000-0000-4000-8000-000000000031';raise exception 'expired pilot reenabled';exception when raise_exception then if sqlerrm<>'CATALOG_UPGRADE_REQUIRED' then raise;end if;end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000031',false);
do $$ begin if exists(select 1 from public.catalog_items) then raise exception 'expired pilot read catalog';end if;end $$;
reset role;
set role service_role;
select public.disconnect_shopify_store(id,installation_id) from public.shopify_stores where shop='pilot.myshopify.com';
do $$ begin if exists(select 1 from public.shopify_stores where shop='pilot.myshopify.com' and credentials_cipher is not null) then raise exception 'expired pilot cannot disconnect';end if;end $$;
reset role;
set role anon;
do $$ begin
 begin perform public.can_connect_store('10000000-0000-4000-8000-000000000031');raise exception 'anon access helper allowed';exception when insufficient_privilege then null;end;
 begin perform * from public.store_connection_pilots;raise exception 'anon grant read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
