-- Disposable database suite; mutations roll back.
begin;
insert into auth.users(id,email) values
 ('70000000-0000-0000-0000-000000000001','recovery@example.invalid'),
 ('70000000-0000-0000-0000-000000000002','recovery-other@example.invalid');
do $$
declare
 ws uuid; other_ws uuid; p uuid; g uuid; fresh uuid; video uuid;
 queued uuid; running uuid; n integer; b integer; stamp timestamptz;
begin
 select id into ws from public.workspaces where owner_id='70000000-0000-0000-0000-000000000001';
 select id into other_ws from public.workspaces where owner_id='70000000-0000-0000-0000-000000000002';
 insert into public.products(workspace_id,url) values(ws,'https://example.invalid') returning id into p;
 update public.workspaces set credits=1000 where id=ws;

 -- A queued callback that never started is fully refunded.
 queued := public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 update public.generations set created_at=now()-interval '1 hour' where id=queued;
 if private.recover_stale_generations() <> 1 then raise exception 'Queued recovery missing'; end if;
 if (select credits from public.workspaces where id=ws) <> 1000 then raise exception 'Queued refund wrong'; end if;
 if (select status from public.generations where id=queued) <> 'failed' then raise exception 'Queued not closed'; end if;

 -- Claiming an old queued job starts its own clock, not its reservation clock.
 fresh := public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 update public.generations set created_at=now()-interval '1 hour' where id=fresh;
 update public.generations set status='running' where id=fresh;
 select started_at into stamp from public.generations where id=fresh;
 if stamp is null or stamp < now()-interval '1 minute' then raise exception 'Missing claim timestamp'; end if;
 if private.recover_stale_generations() <> 0 then raise exception 'Fresh worker recovered too soon'; end if;

 -- Kill after three durable images: retain three ads, refund exactly seven.
 g := public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 update public.generations set status='running' where id=g;
 insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path)
 select ws,g,'image','1:1','recovery-'||g||'-'||i from generate_series(1,3) i;
 begin
   insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path)
     values(other_ws,g,'image','1:1','cross-workspace');
   raise exception 'Cross-workspace output accepted';
 exception when invalid_parameter_value then null; end;
 begin
   insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path)
     values(ws,g,'image','1:1','recovery-'||g||'-1');
   raise exception 'Duplicate output accepted';
 exception when unique_violation then null; end;
 update public.generations set started_at=now()-interval '16 minutes' where id=g;
 if private.recover_stale_generations() <> 1 then raise exception 'Partial recovery missing'; end if;
 if (select status from public.generations where id=g) <> 'succeeded' then raise exception 'Saved ads lost'; end if;
 if (select amount from private.generation_credit_ledger where generation_id=g and kind='refund') <> 7 then raise exception 'Partial refund wrong'; end if;
 if (select recovered_at from public.generations where id=g) is null then raise exception 'Missing recovery timestamp'; end if;
 select credits into b from public.workspaces where id=ws;
 if private.recover_stale_generations() <> 0 then raise exception 'Recovered twice'; end if;
 if public.finalize_generation(g,'failed',10,'late worker',null) then raise exception 'Late settlement won'; end if;
 if (select credits from public.workspaces where id=ws) <> b then raise exception 'Duplicate refund'; end if;
 begin
   insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path) values(ws,g,'image','1:1','late');
   raise exception 'Terminal generation accepted late output';
 exception when invalid_parameter_value then null; end;

 -- An empty running job is fully refunded after its deadline.
 running := public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 update public.generations set status='running' where id=running;
 update public.generations set started_at=now()-interval '16 minutes' where id=running;
 if private.recover_stale_generations() <> 1 then raise exception 'Empty running recovery missing'; end if;
 if (select amount from private.generation_credit_ledger where generation_id=running and kind='refund') <> 10 then raise exception 'Full refund wrong'; end if;

 -- Videos get a longer provider/collection window. Final saved videos count
 -- even if the worker died before marking its video_job done.
 video := public.reserve_generation(ws,gen_random_uuid(),p,'video_ads','test',40,'{}');
 update public.generations set status='running' where id=video;
 update public.generations set started_at=now()-interval '1 hour' where id=video;
 if private.recover_stale_generations() <> 0 then raise exception 'Video recovered too soon'; end if;
 insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path) values(ws,video,'video','9:16','video-recovered');
 update public.generations set started_at=now()-interval '3 hours' where id=video;
 if private.recover_stale_generations() <> 1 then raise exception 'Video recovery missing'; end if;
 if (select amount from private.generation_credit_ledger where generation_id=video and kind='refund') <> 20 then raise exception 'Video refund wrong'; end if;

 -- A fully delivered run with a lost settlement response needs zero refund.
 g := public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 update public.generations set status='running' where id=g;
 insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path)
 select ws,g,'image','1:1','complete-'||g||'-'||i from generate_series(1,10) i;
 update public.generations set started_at=now()-interval '16 minutes' where id=g;
 if private.recover_stale_generations() <> 1 then raise exception 'Full delivery not settled'; end if;
 if (select amount from private.generation_credit_ledger where generation_id=g and kind='refund') <> 0 then raise exception 'Delivered run refunded'; end if;

 -- Legacy workers have no started_at. Old reservations are the fallback.
 g := public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 update public.generations set status='running' where id=g;
 update public.generations set started_at=null,created_at=now()-interval '1 hour' where id=g;
 if private.recover_stale_generations() <> 1 then raise exception 'Legacy worker not recovered'; end if;

 begin perform private.recover_stale_generations(0); raise exception 'Unbounded batch accepted';
 exception when invalid_parameter_value then null; end;
 foreach g in array array[fresh] loop
   if (select status from public.generations where id=g) <> 'running' then raise exception 'Fresh job changed'; end if;
 end loop;
 if has_function_privilege('anon','private.recover_stale_generations(integer)','execute')
 or has_function_privilege('authenticated','private.recover_stale_generations(integer)','execute')
 or has_function_privilege('service_role','private.recover_stale_generations(integer)','execute') then
   raise exception 'Recovery function exposed';
 end if;
end $$;
rollback;
