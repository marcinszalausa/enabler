-- Disposable database only. All fixture rows roll back.
begin;
insert into auth.users(id,email) values
 ('70000000-0000-0000-0000-000000000001','receipt-owner@example.invalid'),
 ('70000000-0000-0000-0000-000000000002','receipt-other@example.invalid'),
 ('70000000-0000-0000-0000-000000000003','receipt-viewer@example.invalid');
do $$
declare ws uuid; other_ws uuid; product uuid; other_product uuid; legacy uuid:=gen_random_uuid(); settled uuid:=gen_random_uuid(); active uuid:=gen_random_uuid(); r record;
begin
 select id into strict ws from public.workspaces where owner_id='70000000-0000-0000-0000-000000000001';
 select id into strict other_ws from public.workspaces where owner_id='70000000-0000-0000-0000-000000000002';
 insert into public.products(workspace_id,url) values(ws,'https://example.invalid/one') returning id into product;
 insert into public.products(workspace_id,url) values(other_ws,'https://example.invalid/two') returning id into other_product;
 insert into public.workspace_members(workspace_id,user_id,role) values(ws,'70000000-0000-0000-0000-000000000003','viewer');
 perform public.reserve_generation(ws,settled,product,'video_ads','test',40,'{}');
 perform public.finalize_generation(settled,'succeeded',20,'partial',null);
 perform public.reserve_generation(ws,active,product,'image_ads','test',10,'{}');
 insert into public.generations(id,workspace_id,product_id,type,status,cost_credits)
   values(legacy,ws,product,'image_ads','succeeded',10);
 if has_function_privilege('anon','public.generation_receipts(uuid)','execute') then raise exception 'Anonymous execute granted'; end if;
 if not has_function_privilege('authenticated','public.generation_receipts(uuid)','execute') then raise exception 'Member execute missing'; end if;
 if has_table_privilege('authenticated','private.generation_credit_ledger','select') then raise exception 'Ledger exposed directly'; end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',true);
 select * into strict r from public.generation_receipts(product) where generation_id=settled;
 if r.charged_credits<>40 or r.returned_credits<>20 then raise exception 'Wrong receipt'; end if;
 select * into strict r from public.generation_receipts(product) where generation_id=active;
 if r.charged_credits<>10 or r.returned_credits is not null then raise exception 'Active refund invented'; end if;
 select * into strict r from public.generation_receipts(product) where generation_id=legacy;
 if r.charged_credits is not null or r.returned_credits is not null then raise exception 'Legacy receipt invented'; end if;
 if exists(select 1 from public.generation_receipts(other_product)) then raise exception 'Cross-workspace receipts exposed'; end if;
 perform set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000002',true);
 if exists(select 1 from public.generation_receipts(product)) then raise exception 'Unrelated user read receipts'; end if;
 perform set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000003',true);
 if (select count(*) from public.generation_receipts(product))<>3 then raise exception 'Viewer cannot read own receipts'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from public.generation_receipts(product)) then raise exception 'Missing user read receipts'; end if;

end $$;
rollback;
