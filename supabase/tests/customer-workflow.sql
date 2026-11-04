-- Disposable database only. No real users, credits, campaigns or posts.
do $$
declare owner_user uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); viewer uuid:=gen_random_uuid(); ws uuid; other_ws uuid; product uuid; other_product uuid; campaign uuid; n integer;
begin
 insert into auth.users(id,email) values(owner_user,'owner@example.invalid'),(stranger,'stranger@example.invalid'),(viewer,'viewer@example.invalid');
 select id into ws from public.workspaces where owner_id=owner_user;
 select id into other_ws from public.workspaces where owner_id=stranger;
 insert into public.workspace_members(workspace_id,user_id,role) values(ws,viewer,'viewer');
 insert into public.products(workspace_id,url) values(ws,'https://example.invalid/ours') returning id into product;
 insert into public.products(workspace_id,url) values(other_ws,'https://example.invalid/theirs') returning id into other_product;
 perform set_config('request.jwt.claim.sub',owner_user::text,true);
 set local role authenticated;
 insert into public.brand_kits(workspace_id,profile) values(ws,'{"name":"Test","audience":"Customers","tone":"Warm","avoid":"Hype"}');
 insert into public.campaigns(workspace_id,product_id,name,goal,message) values(ws,product,'Test campaign','introduce','A real benefit') returning id into campaign;
 begin
  insert into public.campaigns(workspace_id,product_id,name,goal,message) values(ws,other_product,'Cross-workspace','introduce','No');
  raise exception 'Cross-workspace product allowed';
 exception when insufficient_privilege then null; end;
 reset role;
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 set local role authenticated;
 select count(*) into n from public.campaigns where id=campaign;
 if n<>0 then raise exception 'Stranger can read campaign'; end if;
 select count(*) into n from public.brand_kits where workspace_id=ws;
 if n<>0 then raise exception 'Stranger can read brand memory'; end if;
 begin
  insert into public.campaigns(workspace_id,product_id,name,goal,message) values(ws,product,'Stranger','introduce','No');
  raise exception 'Stranger inserted campaign';
 exception when insufficient_privilege then null; end;
 reset role;
 perform set_config('request.jwt.claim.sub',viewer::text,true);
 set local role authenticated;
 select count(*) into n from public.campaigns where id=campaign;
 if n<>1 then raise exception 'Viewer cannot read campaign'; end if;
 begin
  insert into public.campaigns(workspace_id,product_id,name,goal,message) values(ws,product,'Viewer','introduce','No');
  raise exception 'Viewer inserted campaign';
 exception when insufficient_privilege then null; end;
 update public.brand_kits set profile='{}' where workspace_id=ws;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Viewer edited brand memory'; end if;
 reset role;
 if (select credits from public.workspaces where id=ws)<>100 then raise exception 'Planning spent credits'; end if;
 if (select count(*) from public.generations where workspace_id=ws)<>0 then raise exception 'Planning created a generation'; end if;
 if has_table_privilege('anon','public.campaigns','SELECT') then raise exception 'Anonymous campaign access'; end if;
end;
$$;
