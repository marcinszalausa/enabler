set role service_role;
update public.store_connection_pilots set access_kind='founder',expires_at=null,granted_at=now()-interval '365 days',revoked_at=null
 where workspace_id='10000000-0000-4000-8000-000000000031';
do $$ begin
 if not public.can_connect_store('10000000-0000-4000-8000-000000000031') then raise exception 'ongoing founder access expired';end if;
 if public.can_connect_store('10000000-0000-4000-8000-000000000032') then raise exception 'unpaid customer inherited founder access';end if;
 begin
  insert into public.store_connection_pilots(workspace_id,owner_user_id,store_host,expires_at) values('10000000-0000-4000-8000-000000000032','30000000-0000-4000-8000-000000000032','softmila.com',null);
  raise exception 'pilot without expiration accepted';
 exception when check_violation then null;end;
 begin
  insert into public.store_connection_pilots(workspace_id,owner_user_id,store_host,expires_at) values('10000000-0000-4000-8000-000000000032','30000000-0000-4000-8000-000000000032','softmila.com',now()+interval '8 days');
  raise exception 'eight-day pilot accepted';
 exception when check_violation then null;end;
 perform public.install_shopify_store('10000000-0000-4000-8000-000000000031','pilot.myshopify.com','https://www.softmila.com','Soft Mila','gid://shopify/Shop/31','cipher','cipher',now()+interval '1 hour',now()+interval '90 days');
 begin
  perform public.install_shopify_store('10000000-0000-4000-8000-000000000031','wrong.myshopify.com','https://other.example','Wrong','gid://shopify/Shop/32','cipher','cipher',now()+interval '1 hour',now()+interval '90 days');
  raise exception 'ongoing access accepted different store';
 exception when raise_exception then if sqlerrm<>'CATALOG_PILOT_STORE_REQUIRED' then raise;end if;end;
 if exists(select 1 from public.workspaces where id='10000000-0000-4000-8000-000000000031' and (plan<>'free' or credits<>135 or stripe_subscription_id is not null)) then raise exception 'founder changed billing/credits';end if;
 if exists(select 1 from public.catalog_connections where workspace_id='10000000-0000-4000-8000-000000000031' and training_allowance<>0) then raise exception 'founder enabled paid training';end if;
end $$;
reset role;
update public.workspaces set plan=plan where id='10000000-0000-4000-8000-000000000031';
do $$ begin if not exists(select 1 from public.catalog_connections where workspace_id='10000000-0000-4000-8000-000000000031' and enabled) then raise exception 'billing update paused ongoing founder store';end if;end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000031',false);
do $$ begin
 if not public.can_connect_store('10000000-0000-4000-8000-000000000031') then raise exception 'authenticated founder denied';end if;
 begin update public.store_connection_pilots set access_kind='founder';raise exception 'client modified founder entitlement';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000032',false);
do $$ begin
 if coalesce(public.can_connect_store('10000000-0000-4000-8000-000000000031'),false) then raise exception 'editor inherited founder entitlement';end if;
 if exists(select 1 from public.store_connection_pilots) then raise exception 'founder data leaked';end if;
end $$;
reset role;
update public.workspace_members set role='viewer' where workspace_id='10000000-0000-4000-8000-000000000031' and user_id='30000000-0000-4000-8000-000000000031';
set role service_role;
do $$ begin if public.can_connect_store('10000000-0000-4000-8000-000000000031') then raise exception 'former owner retained founder access';end if;end $$;
reset role;
update public.workspace_members set role='owner' where workspace_id='10000000-0000-4000-8000-000000000031' and user_id='30000000-0000-4000-8000-000000000031';
set role service_role;
update public.store_connection_pilots set revoked_at=now();
do $$ begin if public.can_connect_store('10000000-0000-4000-8000-000000000031') then raise exception 'revoked founder remained active';end if;end $$;
reset role;
