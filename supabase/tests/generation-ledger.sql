-- Disposable test database only. All mutations in this suite roll back.
begin;
insert into auth.users(id,email) values
 ('30000000-0000-0000-0000-000000000001','ledger-tests@example.invalid'),
 ('30000000-0000-0000-0000-000000000002','ledger-other@example.invalid');

do $$
declare
  ws uuid; other_ws uuid; product uuid; other_product uuid;
  request uuid := gen_random_uuid(); rejected uuid := gen_random_uuid();
  balance integer; count_rows integer; result uuid; rpc text; role_name text;
begin
  select id into strict ws from public.workspaces where owner_id='30000000-0000-0000-0000-000000000001';
  select id into strict other_ws from public.workspaces where owner_id='30000000-0000-0000-0000-000000000002';
  insert into public.products(workspace_id,url) values(ws,'https://example.invalid') returning id into product;
  insert into public.products(workspace_id,url) values(other_ws,'https://example.invalid') returning id into other_product;

  result := public.reserve_generation(ws,request,product,'image_ads','test',20,'{"language":"english"}');
  if result <> request then raise exception 'Wrong generation returned'; end if;
  perform public.reserve_generation(ws,request,product,'image_ads','test',20,'{"language":"english"}');
  select credits into balance from public.workspaces where id=ws;
  if balance <> 80 then raise exception 'Duplicate reservation changed balance: %',balance; end if;
  select count(*) into count_rows from private.generation_credit_ledger where generation_id=request and kind='charge';
  if count_rows <> 1 then raise exception 'Duplicate ledger charge'; end if;

  begin
    perform public.reserve_generation(ws,request,product,'image_ads','test',20,'{"language":"polish"}');
    raise exception 'Conflicting request accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.reserve_generation(ws,rejected,other_product,'image_ads','test',20,'{}');
    raise exception 'Cross-workspace product accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.reserve_generation(other_ws,request,other_product,'image_ads','test',20,'{"language":"english"}');
    raise exception 'Cross-workspace ID reuse accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.reserve_generation(ws,rejected,product,'image_ads','test',0,'{}');
    raise exception 'Invalid charge accepted';
  exception when invalid_parameter_value then null; end;
  result := public.reserve_generation(ws,rejected,product,'image_ads','test',81,'{}');
  if result is not null then raise exception 'Insufficient funds accepted'; end if;
  if exists(select 1 from public.generations where id=rejected) then raise exception 'Rejected request left generation'; end if;
  if exists(select 1 from private.generation_credit_ledger where generation_id=rejected) then raise exception 'Rejected request left charge'; end if;

  update public.generations set status='running' where id=request;
  begin
    perform public.finalize_generation(request,'succeeded',21,null,null);
    raise exception 'Excess refund accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.finalize_generation(request,'failed',1,null,null);
    raise exception 'Incomplete failed-run refund accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.finalize_generation(request,'succeeded',-1,null,null);
    raise exception 'Negative refund accepted';
  exception when invalid_parameter_value then null; end;

  -- Force a balance-update failure and verify the whole settlement rolls back.
  update public.workspaces set credits=2147483647 where id=ws;
  begin
    perform public.finalize_generation(request,'succeeded',5,null,null);
    raise exception 'Overflow accepted';
  exception when numeric_value_out_of_range then null; end;
  if (select status from public.generations where id=request) <> 'running' then raise exception 'Failed refund closed run'; end if;
  if exists(select 1 from private.generation_credit_ledger where generation_id=request and kind='refund') then raise exception 'Failed refund left receipt'; end if;
  update public.workspaces set credits=80 where id=ws;

  if not public.finalize_generation(request,'succeeded',5,'partial','prompt') then raise exception 'Settlement failed'; end if;
  if public.finalize_generation(request,'succeeded',5,'partial','prompt') then raise exception 'Duplicate settlement succeeded'; end if;
  if public.finalize_generation(request,'failed',20,'stale failure',null) then raise exception 'Stale failure replaced successful result'; end if;
  select credits into balance from public.workspaces where id=ws;
  if balance <> 85 then raise exception 'Repeated settlement changed balance: %',balance; end if;
  if (select prompt from public.generations where id=request) <> 'prompt' then raise exception 'Prompt not recorded'; end if;

  -- A retry must still resolve after the initial charge exhausts the balance.
  update public.workspaces set credits=20 where id=ws;
  perform public.reserve_generation(ws,rejected,product,'video_ads','test',20,'{}');
  result := public.reserve_generation(ws,rejected,product,'video_ads','test',20,'{}');
  if result <> rejected then raise exception 'Retry at zero balance failed'; end if;
  if not public.finalize_generation(rejected,'failed',20,'failed',null) then raise exception 'Queued full refund failed'; end if;
  if (select credits from public.workspaces where id=ws) <> 20 then raise exception 'Full refund wrong'; end if;

  foreach rpc in array array[
    'public.reserve_generation(uuid,uuid,uuid,text,text,integer,jsonb)',
    'public.finalize_generation(uuid,public.generation_status,integer,text,text)'
  ] loop
    if not has_function_privilege('service_role',rpc,'EXECUTE') then raise exception 'Missing service permission'; end if;
    foreach role_name in array array['anon','authenticated','credit_unprivileged'] loop
      if has_function_privilege(role_name,rpc,'EXECUTE') then raise exception '% can execute %',role_name,rpc; end if;
    end loop;
  end loop;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_table_privilege(role_name,'private.generation_credit_ledger','INSERT,UPDATE,DELETE') then
      raise exception '% can mutate ledger directly',role_name;
    end if;
  end loop;
end;
$$;
rollback;
