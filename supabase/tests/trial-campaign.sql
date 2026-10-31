-- Disposable PostgreSQL only. No production users or balance changes.
do $$
declare u uuid:=gen_random_uuid(); v uuid; ws uuid; extra uuid; p uuid; req uuid:=gen_random_uuid(); n integer;
begin
 if (select credits from public.workspaces where owner_id='71000000-0000-4000-8000-000000000001')<>73 then raise exception 'Existing balance changed'; end if;
 insert into auth.users(id,email) values(u,'trial@example.invalid');
 select id into ws from public.workspaces where owner_id=u;
 if (select credits from public.workspaces where id=ws)<>0 then raise exception 'Unverified signup funded'; end if;
 update auth.users set email_confirmed_at=now() where id=u;
 if (select credits from public.workspaces where id=ws)<>100 then raise exception 'Verified signup not funded'; end if;
 update auth.users set email_confirmed_at=null where id=u;
 update auth.users set email_confirmed_at=now() where id=u;
 if (select credits from public.workspaces where id=ws)<>100 then raise exception 'Confirmation replay funded'; end if;
 insert into public.workspaces(name,owner_id) values('Extra',u) returning id into extra;
 if (select credits from public.workspaces where id=extra)<>0 then raise exception 'Extra workspace funded'; end if;
 insert into public.products(workspace_id,url) values(ws,'https://example.invalid') returning id into p;
 perform public.reserve_generation(ws,req,p,'image_ads','test',10,'{}');
 if public.reserve_generation(ws,req,p,'image_ads','test',10,'{}')<>req then raise exception 'Idempotency broken'; end if;
 begin
  perform public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
  raise exception 'Parallel trial batch allowed';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'TRIAL_BATCH_ACTIVE' then raise; end if;
 end;
 if (select credits from public.workspaces where id=ws)<>90 then raise exception 'Blocked batch charged'; end if;
 perform public.finalize_generation(req,'failed',10,'fixture',null);
 for n in 2..10 loop
  req:=gen_random_uuid();perform public.reserve_generation(ws,req,p,'image_ads','test',10,'{}');
  perform public.finalize_generation(req,'failed',10,'fixture',null);
 end loop;
 begin
  perform public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
  raise exception 'Unlimited refunded batches allowed';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'TRIAL_BATCH_RATE' then raise; end if;
 end;
 if (select credits from public.workspaces where id=ws)<>100 then raise exception 'Refund accounting changed'; end if;
 -- Paid plans retain their previous concurrency behavior.
 update public.workspaces set plan='starter' where id=ws;
 perform public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 perform public.reserve_generation(ws,gen_random_uuid(),p,'image_ads','test',10,'{}');
 if (select credits from public.workspaces where id=ws)<>80 then raise exception 'Paid plan changed'; end if;
 delete from auth.users where id=u;
 v:=gen_random_uuid();insert into auth.users(id,email,email_confirmed_at) values(v,'TRIAL@example.invalid',now());
 if (select credits from public.workspaces where owner_id=v)<>0 then raise exception 'Account recreation reset trial'; end if;
 -- Email changes cannot claim another allowance for the same user.
 update auth.users set email='different@example.invalid',email_confirmed_at=null where id=v;
 update auth.users set email_confirmed_at=now() where id=v;
 -- v was never granted (email already claimed), so may claim one verified email.
 -- A funded account still cannot receive another allowance.
 if (select credits from public.workspaces where owner_id=v)<>100 then raise exception 'Legitimate first allowance failed'; end if;
 update auth.users set email='third@example.invalid',email_confirmed_at=null where id=v;
 update auth.users set email_confirmed_at=now() where id=v;
 if (select credits from public.workspaces where owner_id=v)<>100 then raise exception 'Email change reset trial'; end if;
 if has_table_privilege('authenticated','private.trial_credit_claims','SELECT')
 or has_table_privilege('service_role','private.trial_credit_claims','INSERT')
 or has_function_privilege('authenticated','private.grant_starter_credits(uuid)','EXECUTE')
 or has_function_privilege('anon','public.handle_new_user()','EXECUTE')
 or has_table_privilege('anon','public.workspaces','TRUNCATE')
 or has_table_privilege('authenticated','public.workspaces','INSERT')
 then raise exception 'Trial grants exposed'; end if;
end;
$$;
