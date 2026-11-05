begin;
insert into auth.users(id,email) values ('83000000-0000-4000-8000-000000000001','free-redo@example.invalid');
do $$
declare ws uuid; p uuid; original uuid; source uuid; g uuid; options jsonb; balance integer; i integer;
begin
 select id into ws from public.workspaces where owner_id='83000000-0000-4000-8000-000000000001';
 update public.workspaces set credits=100 where id=ws;
 insert into public.products(workspace_id,url) values(ws,'https://example.invalid/redo') returning id into p;
 original:=public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path) values(ws,original,'image','1:1',ws::text||'/original.jpg') returning id into source;
 perform public.finalize_generation(original,'succeeded',0,null,null);
 options:=jsonb_build_object('quality','best','free_redo',true,'revision',jsonb_build_object('version',1,'source_id',source,'kind','image','aspect','1:1','storage_path',ws::text||'/original.jpg','direction','Match the real color','headline','The real product','primary_text','A supported benefit','cta','Shop now','angle','benefit'));
 select credits into balance from public.workspaces where id=ws;
 if public.free_redos_left(ws)<>3 then raise exception 'Expected 3 free redos'; end if;
 g:=gen_random_uuid();
 if public.reserve_free_redo(ws,g,p,'single image best',5,options)<>g then raise exception 'Free redo not reserved'; end if;
 if (select credits from public.workspaces where id=ws)<>balance then raise exception 'Free redo changed the balance'; end if;
 if (select amount from private.generation_credit_ledger where generation_id=g and kind='charge')<>5 then raise exception 'Free redo charge missing from ledger'; end if;
 -- A retry neither grants nor charges again.
 if public.reserve_free_redo(ws,g,p,'single image best',5,options)<>g then raise exception 'Retry changed ID'; end if;
 if (select credits from public.workspaces where id=ws)<>balance then raise exception 'Retry changed the balance'; end if;
 if public.free_redos_left(ws)<>2 then raise exception 'Retry used another free redo'; end if;
 for i in 1..2 loop perform public.reserve_free_redo(ws,gen_random_uuid(),p,'single image best',5,options); end loop;
 if public.free_redos_left(ws)<>0 then raise exception 'Expected none left'; end if;
 begin perform public.reserve_free_redo(ws,gen_random_uuid(),p,'single image best',5,options);raise exception 'Fourth free redo accepted';exception when raise_exception then if sqlerrm<>'FREE_REDO_LIMIT' then raise; end if;end;
 if (select credits from public.workspaces where id=ws)<>balance then raise exception 'Rejected redo changed the balance'; end if;
 -- Last month's redos don't count.
 update private.free_redos set granted_at=date_trunc('month',now())-interval '1 day' where workspace_id=ws;
 if public.free_redos_left(ws)<>3 then raise exception 'Old redos still counted'; end if;
 -- Videos and requests without the flag are refused.
 begin perform public.reserve_free_redo(ws,gen_random_uuid(),p,'x',5,jsonb_set(options,'{revision,kind}','"video"'));raise exception 'Video free redo accepted';exception when invalid_parameter_value then null;end;
 begin perform public.reserve_free_redo(ws,gen_random_uuid(),p,'x',5,options-'free_redo');raise exception 'Unflagged free redo accepted';exception when invalid_parameter_value then null;end;
 begin perform public.reserve_free_redo(ws,gen_random_uuid(),p,'x',50,options);raise exception 'Oversized free redo accepted';exception when invalid_parameter_value then null;end;
 -- A bad source rolls back the grant.
 begin perform public.reserve_free_redo(ws,gen_random_uuid(),p,'x',5,jsonb_set(options,'{revision,storage_path}','"another/path.jpg"'));raise exception 'Forged path accepted';exception when invalid_parameter_value then null;end;
 if (select credits from public.workspaces where id=ws)<>balance then raise exception 'Failed redo leaked credits'; end if;
end $$;
rollback;
