insert into public.workspaces values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into public.workspace_members values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','owner');
insert into public.catalog_connections(id,workspace_id,platform,store_origin,webhook_domain,enabled,training_allowance)
values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','custom','https://www.softmila.com','www.softmila.com',true,1);
insert into public.catalog_deliveries(id,connection_id,workspace_id,event_id,body_hash,products)
values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','first',repeat('a',64),
'[{"externalId":"p1","url":"https://www.softmila.com/products/test","name":"Current","images":[],"inventoryQuantity":0,"updatedAt":"2026-11-01T00:00:00Z","imageRevision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]');
set role service_role;
select public.apply_catalog_delivery('40000000-0000-4000-8000-000000000001');
do $$ begin if public.apply_catalog_delivery('40000000-0000-4000-8000-000000000001') then raise exception 'duplicate applied';end if;end $$;
reset role;
insert into public.catalog_deliveries(connection_id,workspace_id,event_id,body_hash,products)
select connection_id,workspace_id,'stale',repeat('b',64),jsonb_set(jsonb_set(products,'{0,name}','"Stale"'),'{0,updatedAt}','"2026-10-01T00:00:00Z"') from public.catalog_deliveries;
select public.apply_catalog_delivery(id) from public.catalog_deliveries where event_id='stale';
do $$ begin
 if (select name from public.catalog_items limit 1)<>'Current' then raise exception 'stale overwritten';end if;
 begin insert into public.catalog_training_jobs(workspace_id,item_id,image_revision,trainer_version,destination)
 select '10000000-0000-4000-8000-000000000002',id,repeat('a',64),repeat('a',64),'private/model' from public.catalog_items;
 raise exception 'tenant FK accepted'; exception when foreign_key_violation then null;end;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
do $$ begin if (select count(*) from public.catalog_connections)<>1 then raise exception 'owner read failed';end if;
 begin perform public.claim_catalog_training('00000000-0000-0000-0000-000000000000');raise exception 'auth could claim';exception when insufficient_privilege then null;end;
 begin perform * from public.catalog_connection_keys;raise exception 'auth read keys';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
do $$ begin if exists(select 1 from public.catalog_connections) or exists(select 1 from public.catalog_items) then raise exception 'tenant read leak';end if;end $$;
reset role;
insert into public.catalog_training_jobs(id,workspace_id,item_id,image_revision,trainer_version,destination,status)
select '50000000-0000-4000-8000-000000000001',workspace_id,id,image_revision,repeat('a',64),'private/model','dataset_ready' from public.catalog_items;
