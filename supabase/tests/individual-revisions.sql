begin;
insert into auth.users(id,email) values
 ('82000000-0000-4000-8000-000000000001','single-revision@example.invalid'),
 ('82000000-0000-4000-8000-000000000002','single-other@example.invalid');
do $$
declare ws uuid; other_ws uuid; p uuid; other_p uuid; original uuid; source uuid; g uuid; v uuid; options jsonb; balance integer;
begin
 select id into ws from public.workspaces where owner_id='82000000-0000-4000-8000-000000000001';
 select id into other_ws from public.workspaces where owner_id='82000000-0000-4000-8000-000000000002';
 update public.workspaces set credits=1000 where id=ws;
 insert into public.products(workspace_id,url) values(ws,'https://example.invalid/product') returning id into p;
 insert into public.products(workspace_id,url) values(other_ws,'https://example.invalid/other') returning id into other_p;
 original:=public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path) values(ws,original,'image','1:1',ws::text||'/original.jpg') returning id into source;
 perform public.finalize_generation(original,'succeeded',0,null,null);
 options:=jsonb_build_object('quality','best','revision',jsonb_build_object('version',1,'source_id',source,'kind','image','aspect','1:1','storage_path',ws::text||'/original.jpg','direction','Brighter daylight','headline','The real product','primary_text','A supported benefit','cta','Shop now','angle','benefit'));
 select credits into balance from public.workspaces where id=ws;
 g:=public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','single',5,options);
 if public.reserve_generation(ws,g,p,'image_ads','single',5,options)<>g then raise exception 'Revision retry changed ID'; end if;
 if (select credits from public.workspaces where id=ws)<>balance-5 then raise exception 'Revision charged more than once'; end if;
 begin perform public.reserve_generation(ws,g,p,'image_ads','single',5,jsonb_set(options,'{revision,direction}','"Another direction"'));raise exception 'Changed retry accepted';exception when invalid_parameter_value then null;end;
 insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path) values(ws,g,'image','1:1',ws::text||'/'||g||'.jpg');
 update public.generations set created_at=now()-interval '1 hour' where id=g;
 if private.recover_stale_generations()<>1 then raise exception 'Revision recovery missing';end if;
 if (select amount from private.generation_credit_ledger where generation_id=g and kind='refund')<>0 then raise exception 'Delivered single image refunded';end if;
 if private.recover_stale_generations()<>0 then raise exception 'Revision recovered twice';end if;
 g:=public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','single',5,options);
 update public.generations set created_at=now()-interval '1 hour' where id=g;
 perform private.recover_stale_generations();
 if (select amount from private.generation_credit_ledger where generation_id=g and kind='refund')<>5 then raise exception 'Empty revision not fully refunded';end if;
 if public.finalize_generation(g,'failed',5,null,null) then raise exception 'Duplicate revision settlement accepted';end if;
 begin perform public.reserve_generation(other_ws,gen_random_uuid(),other_p,'image_ads','single',5,options);raise exception 'Cross-workspace revision accepted';exception when invalid_parameter_value then null;end;
 begin perform public.reserve_generation(ws,gen_random_uuid(),p,'video_ads','single',5,options);raise exception 'Wrong media type accepted';exception when invalid_parameter_value then null;end;
 begin perform public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','single',5,jsonb_set(options,'{revision,source_id}','"invalid"'));raise exception 'Invalid source accepted';exception when invalid_parameter_value then null;end;
 begin perform public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','single',5,jsonb_set(options,'{revision,storage_path}','"another/path.jpg"'));raise exception 'Forged path accepted';exception when invalid_parameter_value then null;end;
 -- A single delivered video settles without a half-video refund.
 original:=public.reserve_generation(ws,gen_random_uuid(),p,'video_ads','test',40,'{}');
 insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path) values(ws,original,'video','9:16',ws::text||'/original.mp4') returning id into source;
 perform public.finalize_generation(original,'succeeded',0,null,null);
 options:=jsonb_set(options,'{revision}',jsonb_build_object('version',1,'source_id',source,'kind','video','aspect','9:16','storage_path',ws::text||'/original.mp4','direction','Brighter opening','headline','Product','primary_text','Benefit','cta','Shop now','angle','benefit'));
 v:=public.reserve_generation(ws,gen_random_uuid(),p,'video_ads','single',65,options);
 insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path) values(ws,v,'video','9:16',ws::text||'/'||v||'.mp4');
 update public.generations set status='running' where id=v;
 update public.generations set started_at=now()-interval '3 hours' where id=v;
 perform private.recover_stale_generations();
 if (select amount from private.generation_credit_ledger where generation_id=v and kind='refund')<>0 then raise exception 'Single delivered video refunded';end if;
 if not exists(select 1 from public.creatives where generation_id=original and id=source) then raise exception 'Original was altered';end if;
end $$;
rollback;
