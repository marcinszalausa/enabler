insert into public.workspaces(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into public.workspace_members values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','owner'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','viewer');
insert into public.catalog_connections(id,workspace_id,platform,store_origin,webhook_domain,enabled) values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','custom','https://store.example','store.example',true);
insert into public.catalog_items(id,workspace_id,connection_id,external_id,product_url,name,images,inventory_quantity,source_updated_at,image_revision,inventory_updated_at)
select '40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','p1','https://store.example/p1','Product',jsonb_agg('https://store.example/photo-'||n||'.jpg'),5,now()-interval '1 hour',repeat('a',64),now()-interval '1 hour' from generate_series(1,10) n;
insert into public.catalog_ad_accounts(id,workspace_id,provider,external_account_id,credentials_cipher,enabled) values('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','meta','11','fixture',true);
insert into public.catalog_ad_bindings(id,workspace_id,item_id,account_id,external_ad_id) values('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','22');
set role service_role;
select public.apply_catalog_inventory('30000000-0000-4000-8000-000000000001','p1',0,now());
do $$ begin
 if (select count(*) from public.catalog_stock_pauses where status='pending')<>1 then raise exception 'zero stock did not queue a pause';end if;
 if public.apply_catalog_inventory('30000000-0000-4000-8000-000000000001','p1',99,now()-interval '1 minute') then raise exception 'stale stock was accepted';end if;
 if (select inventory_quantity from public.catalog_items limit 1)<>0 then raise exception 'stale event undid zero stock';end if;
 begin insert into public.catalog_ad_bindings(workspace_id,item_id,account_id,external_ad_id) values('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','23');raise exception 'activation on zero stock succeeded';exception when others then if sqlerrm<>'CATALOG_PRODUCT_OUT_OF_STOCK' then raise;end if;end;
end $$;
update public.catalog_ad_bindings set status='paused';update public.catalog_stock_pauses set status='confirmed',confirmed_at=now();
select public.apply_catalog_inventory('30000000-0000-4000-8000-000000000001','p1',12,now()+interval '1 second');
do $$ begin if exists(select 1 from public.catalog_ad_bindings where status='active') then raise exception 'restocking restarted an ad';end if;end $$;
select public.register_catalog_training_photo('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/fixture.jpg',repeat('a',64),1024,1024,'20000000-0000-4000-8000-000000000001');
select public.register_catalog_training_photo('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/duplicate.jpg',repeat('a',64),1024,1024,'20000000-0000-4000-8000-000000000001');
do $$ begin if (select count(*) from public.catalog_training_photos)<>1 then raise exception 'duplicate photo stored twice';end if;end $$;
reset role;
set role authenticated;set request.jwt.claim.sub='20000000-0000-4000-8000-000000000002';
do $$ begin if exists(select 1 from public.catalog_training_photos) then raise exception 'viewer read private training photo';end if;
if has_function_privilege('authenticated','public.claim_catalog_training(uuid)','EXECUTE') or has_table_privilege('authenticated','public.catalog_ad_accounts','SELECT') then raise exception 'privileged training or account access exposed';end if;end $$;
set request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
do $$ begin if (select count(*) from public.catalog_training_photos)<>1 then raise exception 'owner could not read training photos';end if;end $$;
reset role;
insert into public.catalog_training_jobs(id,workspace_id,item_id,image_revision,source_revision,source_reviewed_at,consent_user_id,training_requested_at,budget_cents,trainer_version,destination,status)
values('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',repeat('b',64),repeat('a',64),now(),'20000000-0000-4000-8000-000000000001',now(),1000,repeat('a',64),'fixture/private','dataset_ready');
set role service_role;
do $$ begin if public.claim_catalog_training('50000000-0000-4000-8000-000000000001') then raise exception 'unfunded training claimed';end if;end $$;
reset role;
insert into public.catalog_training_limits(workspace_id,max_budget_cents,remaining_runs) values('10000000-0000-4000-8000-000000000001',1000,1);
