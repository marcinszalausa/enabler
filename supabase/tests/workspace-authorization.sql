-- Model Supabase's API grants on the disposable fixture only.
begin;
grant select on all tables in schema public to authenticated,anon;
grant insert,update,delete on public.products,public.brand_kits,public.workspace_members,public.social_accounts to authenticated;
grant usage on schema storage to authenticated,anon;
grant select on storage.objects to authenticated,anon;
alter table storage.objects enable row level security;

insert into auth.users(id,email) values
 ('81000000-0000-0000-0000-000000000001','owner-a@example.invalid'),
 ('81000000-0000-0000-0000-000000000002','owner-b@example.invalid'),
 ('81000000-0000-0000-0000-000000000003','editor@example.invalid'),
 ('81000000-0000-0000-0000-000000000004','viewer@example.invalid'),
 ('81000000-0000-0000-0000-000000000005','outsider@example.invalid');
do $$
declare a uuid; b uuid; ga uuid; gb uuid; creative uuid;
begin
  select id into strict a from public.workspaces where owner_id='81000000-0000-0000-0000-000000000001';
  select id into strict b from public.workspaces where owner_id='81000000-0000-0000-0000-000000000002';
  insert into public.workspace_members(workspace_id,user_id,role) values
    (a,'81000000-0000-0000-0000-000000000003','editor'),
    (a,'81000000-0000-0000-0000-000000000004','viewer');
  insert into public.generations(workspace_id,type) values(a,'image_ads') returning id into ga;
  insert into public.generations(workspace_id,type) values(b,'image_ads') returning id into gb;
  insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path)
    values(a,ga,'image','1:1',a::text||'/'||ga::text||'/image.jpg') returning id into creative;
  insert into public.brand_kits(workspace_id) values(a);
  insert into storage.objects(id,bucket_id,name) values
    (gen_random_uuid(),'creatives',a::text||'/test.jpg'),
    (gen_random_uuid(),'creatives',b::text||'/test.jpg');
  perform set_config('auth_test.a',a::text,true);
  perform set_config('auth_test.b',b::text,true);
  perform set_config('auth_test.gb',gb::text,true);
  perform set_config('auth_test.creative',creative::text,true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000003',true);
do $$
declare a uuid:=current_setting('auth_test.a')::uuid; c uuid:=current_setting('auth_test.creative')::uuid; n integer; col text; value text;
begin
  if not public.is_workspace_member(a,'editor') then raise exception 'Editor denied'; end if;
  if public.is_workspace_member(current_setting('auth_test.b')::uuid) then raise exception 'Cross-workspace membership accepted'; end if;
  if (select count(*) from public.workspaces where id=current_setting('auth_test.b')::uuid)<>0 then raise exception 'Foreign workspace visible'; end if;
  if (select count(*) from storage.objects where bucket_id='creatives')<>1 then raise exception 'Foreign stored media visible'; end if;
  update public.creatives set headline='Edited',status='approved' where id=c;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Editor copy/approval edit failed'; end if;
  foreach col in array array['id','workspace_id','generation_id','storage_path','kind','aspect','created_at','angle'] loop
    value:=case col
      when 'id' then gen_random_uuid()::text
      when 'workspace_id' then current_setting('auth_test.b')
      when 'generation_id' then current_setting('auth_test.gb')
      when 'storage_path' then current_setting('auth_test.b')||'/private.jpg'
      when 'kind' then 'video' when 'aspect' then '9:16'
      when 'created_at' then now()::text else 'forged' end;
    begin
      execute format('update public.creatives set %I=%L where id=%L',col,value,c);
      raise exception 'Protected creative column % was writable',col;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    update public.workspaces set credits=1000000 where id=a;
    raise exception 'Client changed credits';
  exception when insufficient_privilege then null; end;
  begin
    update public.brand_kits set logo_path=current_setting('auth_test.b')||'/brand/logo.jpg' where workspace_id=a;
    raise exception 'Foreign logo accepted';
  exception when check_violation then null; end;
  update public.brand_kits set logo_path=a::text||'/brand/logo-123.jpg' where workspace_id=a;
end;
$$;

select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000004',true);
do $$
declare a uuid:=current_setting('auth_test.a')::uuid; n integer;
begin
  if public.is_workspace_member(a,'editor') then raise exception 'Viewer received editor permission'; end if;
  if (select count(*) from public.creatives where workspace_id=a)<>1 then raise exception 'Viewer cannot read own media'; end if;
  if (select count(*) from storage.objects where bucket_id='creatives')<>1 then raise exception 'Viewer storage isolation failed'; end if;
  update public.creatives set headline='Viewer edit' where workspace_id=a;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Viewer edited creative'; end if;
  update public.workspace_members set role='editor' where workspace_id=a and user_id='81000000-0000-0000-0000-000000000004';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Viewer escalated membership'; end if;
  begin
    insert into public.social_accounts(id,workspace_id,platform) values('forged-account',a,'instagram');
    raise exception 'Client forged provider account';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000005',true);
do $$
begin
  if public.is_workspace_member(current_setting('auth_test.a')::uuid) then raise exception 'Outsider accepted'; end if;
  if (select count(*) from public.creatives where workspace_id=current_setting('auth_test.a')::uuid)<>0 then raise exception 'Outsider read creative'; end if;
  if (select count(*) from public.generations where workspace_id=current_setting('auth_test.a')::uuid)<>0 then raise exception 'Outsider read generation'; end if;
  if (select count(*) from storage.objects where bucket_id='creatives')<>0 then raise exception 'Outsider read stored media'; end if;
end;
$$;

select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',true);
do $$
begin
  if not public.is_workspace_member(current_setting('auth_test.a')::uuid,'editor') then raise exception 'Owner denied editor permission'; end if;
  if public.is_workspace_member(current_setting('auth_test.b')::uuid) then raise exception 'Owner crossed tenant boundary'; end if;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
begin
  if public.is_workspace_member(current_setting('auth_test.a')::uuid) then raise exception 'Anonymous membership accepted'; end if;
  if (select count(*) from public.creatives where workspace_id=current_setting('auth_test.a')::uuid)<>0 then raise exception 'Anonymous read private creative'; end if;
  if (select count(*) from storage.objects where bucket_id='creatives')<>0 then raise exception 'Anonymous read private media'; end if;
end;
$$;
reset role;
rollback;
