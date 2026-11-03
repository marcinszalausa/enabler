-- Disposable database fixtures only.
grant select,insert,update on public.brand_kits to authenticated;
grant usage on schema auth to authenticated;
grant select on public.creatives,public.generations,public.products,public.workspaces to authenticated;
create or replace function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
   nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
insert into auth.users(id,email) values
 ('81000000-0000-4000-8000-000000000001','library-owner@example.invalid'),
 ('81000000-0000-4000-8000-000000000002','library-viewer@example.invalid'),
 ('81000000-0000-4000-8000-000000000003','library-outsider@example.invalid');
insert into public.workspace_members(workspace_id,user_id,role)
 select id,'81000000-0000-4000-8000-000000000002','viewer' from public.workspaces where owner_id='81000000-0000-4000-8000-000000000001';
insert into public.products(id,workspace_id,name,url)
 select '82000000-0000-4000-8000-000000000001',id,'Example cardigan','https://example.invalid/cardigan' from public.workspaces where owner_id='81000000-0000-4000-8000-000000000001';
insert into public.products(id,workspace_id,name,url)
 select '82000000-0000-4000-8000-000000000002',id,'Private other product','https://other.invalid/private' from public.workspaces where owner_id='81000000-0000-4000-8000-000000000003';
insert into public.generations(id,workspace_id,product_id,type,status)
 select ('83000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,workspace_id,id,'image_ads',case n when 2 then 'running'::public.generation_status when 3 then 'failed'::public.generation_status else 'succeeded'::public.generation_status end
 from public.products cross join generate_series(1,3) n where id='82000000-0000-4000-8000-000000000001';
insert into public.generations(id,workspace_id,product_id,type,status)
 select '83000000-0000-4000-8000-000000000004',workspace_id,id,'image_ads','succeeded' from public.products where id='82000000-0000-4000-8000-000000000002';
insert into public.creatives(id,workspace_id,generation_id,kind,aspect,storage_path,headline,primary_text,created_at)
 select ('84000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,workspace_id,id,
 case when n>28 then 'video'::public.creative_kind else 'image'::public.creative_kind end,
 case when n%2=0 then '9:16' else '1:1' end,'fixture/no-real-file',
 'Example ad '||n,'Example caption '||n,'2026-11-03T00:00:00Z'::timestamptz+n*interval '1 minute'
 from public.generations cross join generate_series(1,30) n where id='83000000-0000-4000-8000-000000000001';
insert into public.creatives(id,workspace_id,generation_id,kind,aspect,storage_path,headline,status,created_at)
 select '84000000-0000-4000-8000-000000000031',workspace_id,id,'image','1:1','fixture/rejected','Rejected ad','rejected','2026-11-03T01:01:00Z' from public.generations where id='83000000-0000-4000-8000-000000000001';
insert into public.creatives(id,workspace_id,generation_id,kind,aspect,storage_path,headline,created_at)
 select '84000000-0000-4000-8000-000000000032',workspace_id,id,'image','1:1','fixture/running','Running ad','2026-11-03T01:02:00Z' from public.generations where id='83000000-0000-4000-8000-000000000002';
insert into public.creatives(id,workspace_id,generation_id,kind,aspect,storage_path,headline,created_at)
 select '84000000-0000-4000-8000-000000000033',workspace_id,id,'image','9:16','fixture/partial','Saved partial ad','2026-11-03T01:00:00Z' from public.generations where id='83000000-0000-4000-8000-000000000003';
insert into public.creatives(id,workspace_id,generation_id,kind,aspect,storage_path,headline)
 select '84000000-0000-4000-8000-000000000099',workspace_id,id,'image','1:1','fixture/foreign','Private other ad' from public.generations where id='83000000-0000-4000-8000-000000000004';
insert into public.creative_favorites(user_id,creative_id) values
 ('81000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000002'),
 ('81000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000028'),
 ('81000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000003'),
 ('81000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000099');
notify pgrst,'reload schema';
